import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import dbSqlite from '../db/database-sqlite.js';
import dbPostgres from '../db/database.js';

// Choose database based on environment
const pool = process.env.USE_SQLITE === 'true' ? dbSqlite : dbPostgres;

const router = express.Router();

// Tüm girişleri getir (raporlama için)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        gr.*,
        o.otpa_number,
        o.project_name,
        u.full_name as created_by_name,
        b.material_name,
        b.unit,
        qr.status as quality_status,
        qr.accepted_quantity,
        qr.rejected_quantity,
        qr.reason
      FROM goods_receipt gr
      LEFT JOIN users u ON gr.created_by = u.id
      LEFT JOIN otpa o ON gr.otpa_id = o.id
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id AND gr.material_code = b.material_code
      LEFT JOIN quality_results qr ON gr.id = qr.receipt_id
      ORDER BY gr.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Tüm giriş kayıtları hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Tüm malzeme giriş kayıtlarını listele (filtrelenmiş)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { otpa_id, material_code } = req.query;

    let query = `
      SELECT 
        gr.*,
        o.otpa_number,
        o.project_name,
        u.full_name as created_by_name,
        qr.status as quality_status,
        qr.accepted_quantity,
        qr.rejected_quantity
      FROM goods_receipt gr
      LEFT JOIN otpa o ON gr.otpa_id = o.id
      LEFT JOIN users u ON gr.created_by = u.id
      LEFT JOIN quality_results qr ON gr.id = qr.receipt_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (otpa_id) {
      query += ` AND gr.otpa_id = $${paramIndex}`;
      params.push(otpa_id);
      paramIndex++;
    }

    if (material_code) {
      query += ` AND gr.material_code = $${paramIndex}`;
      params.push(material_code);
      paramIndex++;
    }

    query += ' ORDER BY gr.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Giriş kaydı listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// OTPA'ya göre giriş kayıtlarını getir
router.get('/otpa/:otpaId', authenticateToken, async (req, res) => {
  try {
    const { otpaId } = req.params;

    const result = await pool.query(`
      SELECT 
        gr.*,
        u.full_name as created_by_name,
        b.material_name,
        b.required_quantity,
        b.unit,
        qr.status as quality_status,
        qr.accepted_quantity,
        qr.rejected_quantity,
        qr.reason
      FROM goods_receipt gr
      LEFT JOIN users u ON gr.created_by = u.id
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id AND gr.material_code = b.material_code
      LEFT JOIN quality_results qr ON gr.id = qr.receipt_id
      WHERE gr.otpa_id = ?
      ORDER BY gr.created_at DESC
    `, [otpaId]);

    res.json(result.rows);
  } catch (error) {
    console.error('OTPA giriş kayıtları hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Yeni malzeme giriş kaydı oluştur
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { otpa_id, component_type, material_code, received_quantity, return_of_rejected, notes } = req.body;

    if (!otpa_id || !component_type || !material_code || !received_quantity) {
      return res.status(400).json({ error: 'OTPA, komponent, malzeme kodu ve miktar gereklidir' });
    }

    // BOM'da bu malzeme var mı kontrol et
    const bomCheck = await pool.query(
      'SELECT * FROM bom_items WHERE otpa_id = ? AND component_type = ? AND material_code = ?',
      [otpa_id, component_type, material_code]
    );

    if (bomCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Bu malzeme kodu bu OTPA\'nın bu komponent BOM\'unda yok' });
    }

    // Giriş kaydı oluştur
    const receiptResult = await pool.query(
      `INSERT INTO goods_receipt (otpa_id, component_type, material_code, received_quantity, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      [otpa_id, component_type, material_code, received_quantity, notes, req.user.id]
    );

    const receipt = receiptResult.rows[0];

    // Otomatik olarak kalite kaydı oluştur (başlangıç durumu: bekliyor)
    await pool.query(
      `INSERT INTO quality_results (receipt_id, status, accepted_quantity, rejected_quantity)
       VALUES (?, ?, ?, ?)`,
      [receipt.id, 'bekliyor', 0, 0]
    );

    res.status(201).json(receipt);
  } catch (error) {
    console.error('Giriş kaydı oluşturma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Giriş kaydı detayı
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        gr.*,
        o.otpa_number,
        o.project_name,
        u.full_name as created_by_name,
        b.material_name,
        b.required_quantity,
        b.unit,
        qr.id as quality_id,
        qr.status as quality_status,
        qr.accepted_quantity,
        qr.rejected_quantity,
        qr.reason,
        qr.decision_date,
        qu.full_name as decision_by_name
      FROM goods_receipt gr
      LEFT JOIN otpa o ON gr.otpa_id = o.id
      LEFT JOIN users u ON gr.created_by = u.id
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id AND gr.material_code = b.material_code
      LEFT JOIN quality_results qr ON gr.id = qr.receipt_id
      LEFT JOIN users qu ON qr.decision_by = qu.id
      WHERE gr.id = ?
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Giriş kaydı bulunamadı' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Giriş kaydı detay hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
