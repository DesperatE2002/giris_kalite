import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import pool from '../db/database.js';

const router = express.Router();

// Kalite bekleyen kayıtlar
router.get('/pending', authenticateToken, authorizeRoles('kalite', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        gr.*,
        o.otpa_number,
        o.project_name,
        b.material_name,
        b.unit,
        u.full_name as created_by_name,
        qr.id as quality_id,
        qr.status as quality_status
      FROM goods_receipt gr
      JOIN quality_results qr ON gr.id = qr.receipt_id
      LEFT JOIN otpa o ON gr.otpa_id = o.id
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id AND gr.material_code = b.material_code
      LEFT JOIN users u ON gr.created_by = u.id
      WHERE qr.status = 'bekliyor'
      ORDER BY gr.created_at ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Bekleyen kalite listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Kalite kararı ver
router.post('/:receiptId', authenticateToken, authorizeRoles('kalite', 'admin'), async (req, res) => {
  try {
    const { receiptId } = req.params;
    const { status, accepted_quantity, rejected_quantity, reason } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Kalite durumu gereklidir' });
    }

    if (!['kabul', 'red', 'sartli_kabul', 'bekliyor'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz kalite durumu' });
    }

    // Giriş kaydını kontrol et
    const receiptResult = await pool.query(
      'SELECT * FROM goods_receipt WHERE id = ?',
      [receiptId]
    );

    if (receiptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Giriş kaydı bulunamadı' });
    }

    const receipt = receiptResult.rows[0];

    // Miktarları doğrula
    const acceptedQty = parseFloat(accepted_quantity) || 0;
    const rejectedQty = parseFloat(rejected_quantity) || 0;

    if (acceptedQty + rejectedQty > receipt.received_quantity) {
      return res.status(400).json({ 
        error: 'Kabul + Red miktarı toplam gelen miktardan fazla olamaz' 
      });
    }

    // Kalite kaydını güncelle
    const result = await pool.query(`
      UPDATE quality_results
      SET 
        status = ?,
        accepted_quantity = ?,
        rejected_quantity = ?,
        reason = ?,
        decision_by = ?,
        decision_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE receipt_id = ?
      RETURNING *
    `, [status, acceptedQty, rejectedQty, reason, req.user.id, receiptId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kalite kaydı bulunamadı' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Kalite kararı hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Kalite sonucunu görüntüle
router.get('/:receiptId', authenticateToken, async (req, res) => {
  try {
    const { receiptId } = req.params;

    const result = await pool.query(`
      SELECT 
        qr.*,
        u.full_name as decision_by_name,
        gr.received_quantity,
        gr.material_code,
        o.otpa_number,
        b.material_name
      FROM quality_results qr
      LEFT JOIN users u ON qr.decision_by = u.id
      LEFT JOIN goods_receipt gr ON qr.receipt_id = gr.id
      LEFT JOIN otpa o ON gr.otpa_id = o.id
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id AND gr.material_code = b.material_code
      WHERE qr.receipt_id = ?
    `, [receiptId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kalite kaydı bulunamadı' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Kalite sonucu görüntüleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Tüm kalite kayıtlarını listele (filtreleme ile)
router.get('/', authenticateToken, authorizeRoles('kalite', 'admin'), async (req, res) => {
  try {
    const { status, otpa_id, start_date, end_date } = req.query;

    let query = `
      SELECT 
        qr.*,
        gr.material_code,
        gr.received_quantity,
        gr.receipt_date,
        o.otpa_number,
        o.project_name,
        b.material_name,
        u.full_name as decision_by_name
      FROM quality_results qr
      JOIN goods_receipt gr ON qr.receipt_id = gr.id
      LEFT JOIN otpa o ON gr.otpa_id = o.id
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id AND gr.material_code = b.material_code
      LEFT JOIN users u ON qr.decision_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND qr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (otpa_id) {
      query += ` AND gr.otpa_id = $${paramIndex}`;
      params.push(otpa_id);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND gr.receipt_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND gr.receipt_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ' ORDER BY qr.updated_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Kalite listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// İade edilmiş malzemeleri listele
router.get('/returns', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        gr.id,
        gr.material_code,
        gr.received_quantity,
        gr.receipt_date,
        gr.created_at,
        o.otpa_number,
        o.project_name,
        b.material_name,
        b.unit,
        qr.rejected_quantity,
        qr.reason,
        qr.decision_date,
        qr.status as quality_status,
        u.full_name as decision_by_name
      FROM quality_results qr
      JOIN goods_receipt gr ON qr.receipt_id = gr.id
      LEFT JOIN otpa o ON gr.otpa_id = o.id
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id AND gr.material_code = b.material_code
      LEFT JOIN users u ON qr.decision_by = u.id
      WHERE qr.status = 'red' AND qr.rejected_quantity > 0
      ORDER BY qr.decision_date DESC NULLS LAST
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('İade listesi hatası:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// Kabul edilmiş malzemeleri getir (iade için)
router.get('/accepted-materials/:otpaId', authenticateToken, async (req, res) => {
  try {
    const { otpaId } = req.params;

    const result = await pool.query(`
      SELECT 
        gr.id as receipt_id,
        gr.material_code,
        b.material_name,
        b.unit,
        qr.accepted_quantity
      FROM goods_receipt gr
      JOIN quality_results qr ON gr.id = qr.receipt_id
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id AND gr.material_code = b.material_code
      WHERE gr.otpa_id = ? 
        AND qr.status = 'kabul'
        AND qr.accepted_quantity > 0
      ORDER BY gr.receipt_date DESC
    `, [otpaId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Kabul edilmiş malzemeler hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Manuel iade oluştur
router.post('/manual-return', authenticateToken, authorizeRoles('kalite', 'admin'), async (req, res) => {
  try {
    const { receipt_id, return_quantity, reason } = req.body;

    if (!receipt_id || !return_quantity || !reason) {
      return res.status(400).json({ error: 'Eksik bilgi' });
    }

    // Mevcut quality result'ı kontrol et
    const existing = await pool.query(`
      SELECT qr.*, gr.received_quantity
      FROM quality_results qr
      JOIN goods_receipt gr ON qr.receipt_id = gr.id
      WHERE qr.receipt_id = ?
    `, [receipt_id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Kalite kaydı bulunamadı' });
    }

    const currentRecord = existing.rows[0];

    // Kabul edilmiş miktardan fazla iade edilemez
    if (return_quantity > currentRecord.accepted_quantity) {
      return res.status(400).json({ 
        error: `İade miktarı kabul edilmiş miktardan fazla olamaz (Maks: ${currentRecord.accepted_quantity})` 
      });
    }

    // Quality result'ı güncelle
    await pool.query(`
      UPDATE quality_results
      SET status = 'red',
          accepted_quantity = accepted_quantity - ?,
          rejected_quantity = rejected_quantity + ?,
          reason = ?,
          decision_by = ?,
          decision_date = NOW(),
          updated_at = NOW()
      WHERE receipt_id = ?
    `, [return_quantity, return_quantity, reason, req.user.id, receipt_id]);

    res.json({ 
      message: 'İade başarıyla oluşturuldu',
      returned_quantity: return_quantity 
    });

  } catch (error) {
    console.error('Manuel iade hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
