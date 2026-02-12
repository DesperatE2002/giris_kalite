import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import pool from '../db/database.js';

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
      WHERE gr.otpa_id = $1
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
  const client = await pool.connect();
  
  try {
    const { otpa_id, component_type, material_code, received_quantity, return_of_rejected, notes } = req.body;

    if (!otpa_id || !component_type || !material_code || !received_quantity) {
      return res.status(400).json({ error: 'OTPA, komponent, malzeme kodu ve miktar gereklidir' });
    }

    await client.query('BEGIN');

    // BOM'da bu malzeme var mı kontrol et
    const bomCheck = await client.query(
      'SELECT * FROM bom_items WHERE otpa_id = $1 AND component_type = $2 AND material_code = $3',
      [otpa_id, component_type, material_code]
    );

    if (bomCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Bu malzeme kodu bu OTPA\'nın bu komponent BOM\'unda yok' });
    }

    // İade dönüşü ise, iade havuzunu kontrol et
    if (return_of_rejected) {
      const rejectedCheck = await client.query(`
        SELECT SUM(qr.rejected_quantity) as total_rejected
        FROM goods_receipt gr
        JOIN quality_results qr ON gr.id = qr.receipt_id
        WHERE gr.otpa_id = $1 
          AND gr.component_type = $2
          AND gr.material_code = $3
          AND qr.rejected_quantity > 0
      `, [otpa_id, component_type, material_code]);

      const totalRejected = parseFloat(rejectedCheck.rows[0]?.total_rejected || 0);

      if (totalRejected < received_quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `İade havuzunda yeterli miktar yok. Mevcut: ${totalRejected}, Talep: ${received_quantity}` 
        });
      }

      // İade havuzundan düş - FIFO mantığı ile en eski kayıtlardan başla
      let remainingToDeduct = received_quantity;
      
      const rejectionsResult = await client.query(`
        SELECT qr.id, qr.rejected_quantity, gr.id as receipt_id
        FROM goods_receipt gr
        JOIN quality_results qr ON gr.id = qr.receipt_id
        WHERE gr.otpa_id = $1 
          AND gr.component_type = $2
          AND gr.material_code = $3
          AND qr.rejected_quantity > 0
        ORDER BY qr.decision_date ASC, qr.created_at ASC
      `, [otpa_id, component_type, material_code]);

      for (const rejection of rejectionsResult.rows) {
        if (remainingToDeduct <= 0) break;

        const deductAmount = Math.min(remainingToDeduct, rejection.rejected_quantity);
        
        await client.query(`
          UPDATE quality_results
          SET rejected_quantity = rejected_quantity - $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [deductAmount, rejection.id]);

        remainingToDeduct -= deductAmount;
      }
    }

    // Giriş kaydı oluştur
    const receiptResult = await client.query(
      `INSERT INTO goods_receipt (otpa_id, component_type, material_code, received_quantity, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [otpa_id, component_type, material_code, received_quantity, 
       return_of_rejected ? `İade dönüşü - ${notes || ''}` : notes, req.user.id]
    );

    const receipt = receiptResult.rows[0];

    // Otomatik olarak kalite kaydı oluştur (başlangıç durumu: bekliyor)
    await client.query(
      `INSERT INTO quality_results (receipt_id, status, accepted_quantity, rejected_quantity)
       VALUES ($1, $2, $3, $4)`,
      [receipt.id, 'bekliyor', 0, 0]
    );

    await client.query('COMMIT');

    res.status(201).json(receipt);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Giriş kaydı oluşturma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  } finally {
    client.release();
  }
});

// Toplu malzeme girişi - seçilen malzemelerin tamamını tam miktarda giriş yap
router.post('/bulk', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { items } = req.body; // [{ otpa_id, component_type, material_code, required_quantity }]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Malzeme listesi gereklidir' });
    }

    await client.query('BEGIN');

    const createdReceipts = [];

    for (const item of items) {
      const { otpa_id, component_type, material_code, required_quantity } = item;

      if (!otpa_id || !component_type || !material_code || !required_quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Her malzeme için OTPA, komponent, malzeme kodu ve miktar gereklidir' });
      }

      // BOM'da bu malzeme var mı kontrol et
      const bomCheck = await client.query(
        'SELECT * FROM bom_items WHERE otpa_id = $1 AND component_type = $2 AND material_code = $3',
        [otpa_id, component_type, material_code]
      );

      if (bomCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Malzeme ${material_code} bu OTPA'nın ${component_type} BOM'unda bulunamadı` 
        });
      }

      // Giriş kaydı oluştur
      const receiptResult = await client.query(
        `INSERT INTO goods_receipt (otpa_id, component_type, material_code, received_quantity, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [otpa_id, component_type, material_code, required_quantity, 'Toplu giriş', req.user.id]
      );

      const receipt = receiptResult.rows[0];

      // Otomatik kalite kaydı oluştur
      await client.query(
        `INSERT INTO quality_results (receipt_id, status, accepted_quantity, rejected_quantity)
         VALUES ($1, $2, $3, $4)`,
        [receipt.id, 'bekliyor', 0, 0]
      );

      createdReceipts.push(receipt);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `${createdReceipts.length} malzeme başarıyla giriş yapıldı`,
      receipts: createdReceipts
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Toplu giriş hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  } finally {
    client.release();
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
      WHERE gr.id = $1
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
