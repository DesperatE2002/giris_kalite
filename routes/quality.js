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
        b.component_type,
        u.full_name as created_by_name,
        qr.id as quality_id,
        qr.status as quality_status
      FROM goods_receipt gr
      JOIN quality_results qr ON gr.id = qr.receipt_id
      LEFT JOIN otpa o ON gr.otpa_id = o.id
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id 
        AND gr.material_code = b.material_code 
        AND gr.component_type = b.component_type
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
      'SELECT * FROM goods_receipt WHERE id = $1',
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
        status = $1,
        accepted_quantity = $2,
        rejected_quantity = $3,
        reason = $4,
        decision_by = $5,
        decision_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE receipt_id = $6
      RETURNING *
    `, [status, acceptedQty, rejectedQty, reason, req.user.userId, receiptId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kalite kaydı bulunamadı' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Kalite kararı hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Toplu kalite onayı
router.post('/bulk/approve-all', authenticateToken, authorizeRoles('kalite', 'admin'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Bekleyen tüm kayıtları getir
    const pendingResult = await client.query(`
      SELECT 
        gr.id as receipt_id,
        gr.received_quantity,
        qr.id as quality_id
      FROM goods_receipt gr
      JOIN quality_results qr ON gr.id = qr.receipt_id
      WHERE qr.status = 'bekliyor'
    `);

    if (pendingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.json({ 
        message: 'Onaylanacak kayıt bulunamadı',
        approved_count: 0 
      });
    }

    // Tüm kayıtları onayla
    for (const item of pendingResult.rows) {
      await client.query(`
        UPDATE quality_results
        SET 
          status = 'kabul',
          accepted_quantity = $1,
          rejected_quantity = 0,
          reason = 'Toplu onay',
          decision_by = $2,
          decision_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [item.received_quantity, req.user.userId, item.quality_id]);
    }

    await client.query('COMMIT');

    res.json({
      message: `${pendingResult.rows.length} kayıt başarıyla onaylandı`,
      approved_count: pendingResult.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Toplu onaylama hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  } finally {
    client.release();
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
      WHERE qr.receipt_id = $1
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
    // Önce basit bir query ile test edelim
    const result = await pool.query(`
      SELECT 
        qr.id,
        qr.rejected_quantity,
        qr.reason,
        qr.decision_date,
        qr.status,
        gr.id as receipt_id,
        gr.material_code,
        gr.component_type,
        gr.received_quantity,
        gr.created_at,
        gr.otpa_id
      FROM quality_results qr
      INNER JOIN goods_receipt gr ON qr.receipt_id = gr.id
      WHERE qr.rejected_quantity > 0
      ORDER BY qr.decision_date DESC NULLS LAST
      LIMIT 100
    `);

    // Eğer sonuç varsa, ek bilgileri ekleyelim
    const enrichedResults = await Promise.all(result.rows.map(async (item) => {
      // OTPA bilgisi
      let otpaInfo = { otpa_number: null, project_name: null };
      if (item.otpa_id) {
        const otpaResult = await pool.query(
          'SELECT otpa_number, project_name FROM otpa WHERE id = $1',
          [item.otpa_id]
        );
        if (otpaResult.rows.length > 0) {
          otpaInfo = otpaResult.rows[0];
        }
      }

      // Malzeme bilgisi
      let materialInfo = { material_name: null, unit: null };
      if (item.otpa_id && item.material_code && item.component_type) {
        const materialResult = await pool.query(
          'SELECT material_name, unit FROM bom_items WHERE otpa_id = $1 AND material_code = $2 AND component_type = $3 LIMIT 1',
          [item.otpa_id, item.material_code, item.component_type]
        );
        if (materialResult.rows.length > 0) {
          materialInfo = materialResult.rows[0];
        }
      }

      // Karar veren kişi
      let decisionBy = null;
      if (item.decision_by) {
        const userResult = await pool.query(
          'SELECT full_name FROM users WHERE id = $1',
          [item.decision_by]
        );
        if (userResult.rows.length > 0) {
          decisionBy = userResult.rows[0].full_name;
        }
      }

      return {
        ...item,
        otpa_number: otpaInfo.otpa_number,
        project_name: otpaInfo.project_name,
        material_name: materialInfo.material_name,
        unit: materialInfo.unit,
        decision_by_name: decisionBy,
        quality_status: item.status
      };
    }));

    res.json(enrichedResults);
  } catch (error) {
    console.error('İade listesi hatası:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ 
      error: 'Sunucu hatası', 
      details: error.message,
      code: error.code 
    });
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
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id 
        AND gr.material_code = b.material_code
        AND gr.component_type = b.component_type
      WHERE gr.otpa_id = $1 
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
      WHERE qr.receipt_id = $1
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
      SET status = 'iade',
          accepted_quantity = accepted_quantity - $1,
          rejected_quantity = rejected_quantity + $2,
          reason = $3,
          decision_by = $4,
          decision_date = NOW(),
          updated_at = NOW()
      WHERE receipt_id = $5
    `, [return_quantity, return_quantity, reason, req.user.userId, receipt_id]);

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
