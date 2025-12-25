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

// Manuel iade oluştur - Stoğu azalt (ÖNEMLİ: /:receiptId'den ÖNCE olmalı!)
router.post('/manual-return', authenticateToken, authorizeRoles('teknisyen', 'kalite', 'admin'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { otpa_id, component_type, material_code, return_quantity, reason } = req.body;

    if (!otpa_id || !component_type || !material_code || !return_quantity || !reason) {
      return res.status(400).json({ error: 'OTPA, komponent, malzeme, miktar ve sebep gereklidir' });
    }

    await client.query('BEGIN');

    // Son kabul edilmiş goods_receipt'i bul
    const receiptResult = await client.query(`
      SELECT 
        gr.id as receipt_id,
        qr.id as quality_id,
        qr.accepted_quantity,
        qr.rejected_quantity,
        qr.status
      FROM goods_receipt gr
      JOIN quality_results qr ON gr.id = qr.receipt_id
      WHERE gr.otpa_id = $1 
        AND gr.component_type = $2
        AND gr.material_code = $3
        AND qr.status = 'kabul'
        AND qr.accepted_quantity > 0
      ORDER BY gr.receipt_date DESC
      LIMIT 1
    `, [otpa_id, component_type, material_code]);

    if (receiptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Kabul edilmiş malzeme kaydı bulunamadı' });
    }

    const record = receiptResult.rows[0];

    // Kabul edilmiş miktardan fazla iade edilemez
    if (return_quantity > record.accepted_quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `İade miktarı kabul edilmiş miktardan fazla olamaz (Maks: ${record.accepted_quantity})` 
      });
    }

    // Quality result'ı güncelle - Stoktan düş, iade havuzuna ekle
    await client.query(`
      UPDATE quality_results
      SET status = 'iade',
          accepted_quantity = accepted_quantity - $1,
          rejected_quantity = rejected_quantity + $2,
          reason = $3,
          decision_by = $4,
          decision_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [return_quantity, return_quantity, reason, req.user.userId, record.quality_id]);

    await client.query('COMMIT');

    res.json({ 
      message: 'İade başarıyla oluşturuldu',
      returned_quantity: return_quantity,
      remaining_accepted: record.accepted_quantity - return_quantity
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Manuel iade hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  } finally {
    client.release();
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
    // En basit query - sadece quality_results ve goods_receipt
    const result = await pool.query(`
      SELECT 
        qr.id as quality_id,
        qr.rejected_quantity,
        qr.reason,
        qr.decision_date,
        qr.status,
        qr.decision_by,
        gr.id as receipt_id,
        gr.material_code,
        gr.component_type,
        gr.received_quantity,
        gr.created_at,
        gr.otpa_id
      FROM quality_results qr
      INNER JOIN goods_receipt gr ON qr.receipt_id = gr.id
      WHERE qr.rejected_quantity > 0
      ORDER BY COALESCE(qr.decision_date, qr.created_at) DESC
      LIMIT 100
    `);

    if (result.rows.length === 0) {
      return res.json([]);
    }

    // OTPA bilgilerini toplu çek
    const otpaIds = [...new Set(result.rows.map(r => r.otpa_id).filter(Boolean))];
    const otpaMap = {};
    if (otpaIds.length > 0) {
      const otpaResult = await pool.query(
        `SELECT id, otpa_number, project_name FROM otpa WHERE id = ANY($1)`,
        [otpaIds]
      );
      otpaResult.rows.forEach(o => {
        otpaMap[o.id] = o;
      });
    }

    // Malzeme bilgilerini toplu çek
    const bomKeys = result.rows
      .filter(r => r.otpa_id && r.material_code && r.component_type)
      .map(r => `${r.otpa_id}-${r.material_code}-${r.component_type}`);
    
    const bomMap = {};
    if (bomKeys.length > 0) {
      const bomResult = await pool.query(
        `SELECT otpa_id, material_code, component_type, material_name, unit 
         FROM bom_items 
         WHERE otpa_id = ANY($1)`,
        [otpaIds]
      );
      bomResult.rows.forEach(b => {
        const key = `${b.otpa_id}-${b.material_code}-${b.component_type}`;
        bomMap[key] = b;
      });
    }

    // Kullanıcı bilgilerini toplu çek
    const userIds = [...new Set(result.rows.map(r => r.decision_by).filter(Boolean))];
    const userMap = {};
    if (userIds.length > 0) {
      const userResult = await pool.query(
        `SELECT id, full_name FROM users WHERE id = ANY($1)`,
        [userIds]
      );
      userResult.rows.forEach(u => {
        userMap[u.id] = u.full_name;
      });
    }

    // Sonuçları zenginleştir
    const enrichedResults = result.rows.map(item => {
      const otpa = otpaMap[item.otpa_id] || {};
      const bomKey = `${item.otpa_id}-${item.material_code}-${item.component_type}`;
      const bom = bomMap[bomKey] || {};
      
      return {
        id: item.receipt_id,
        material_code: item.material_code,
        component_type: item.component_type,
        received_quantity: item.received_quantity,
        created_at: item.created_at,
        otpa_number: otpa.otpa_number || null,
        project_name: otpa.project_name || null,
        material_name: bom.material_name || null,
        unit: bom.unit || null,
        rejected_quantity: item.rejected_quantity,
        reason: item.reason,
        decision_date: item.decision_date,
        quality_status: item.status,
        decision_by_name: userMap[item.decision_by] || null
      };
    });

    res.json(enrichedResults);
  } catch (error) {
    console.error('İade listesi hatası:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    res.status(500).json({ 
      error: 'Sunucu hatası', 
      message: error.message,
      code: error.code 
    });
  }
});

// İade havuzunu kontrol et (rejected pool)
router.get('/rejected-pool/:otpaId/:componentType/:materialCode', authenticateToken, async (req, res) => {
  try {
    const { otpaId, componentType, materialCode } = req.params;

    const result = await pool.query(`
      SELECT SUM(qr.rejected_quantity) as total_rejected
      FROM quality_results qr
      JOIN goods_receipt gr ON qr.receipt_id = gr.id
      WHERE gr.otpa_id = $1 
        AND gr.component_type = $2
        AND gr.material_code = $3
        AND qr.status = 'iade'
        AND qr.rejected_quantity > 0
    `, [otpaId, componentType, materialCode]);

    res.json({ 
      total_rejected: parseFloat(result.rows[0]?.total_rejected || 0) 
    });
  } catch (error) {
    console.error('İade havuzu hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Kabul edilmiş malzemeleri getir (iade için) - Component'e göre
router.get('/accepted-materials/:otpaId/:componentType', authenticateToken, async (req, res) => {
  try {
    const { otpaId, componentType } = req.params;

    const result = await pool.query(`
      SELECT 
        gr.material_code,
        gr.component_type,
        b.material_name,
        b.unit,
        SUM(qr.accepted_quantity) as accepted_quantity
      FROM goods_receipt gr
      JOIN quality_results qr ON gr.id = qr.receipt_id
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id 
        AND gr.material_code = b.material_code
        AND gr.component_type = b.component_type
      WHERE gr.otpa_id = $1 
        AND gr.component_type = $2
        AND qr.status = 'kabul'
        AND qr.accepted_quantity > 0
      GROUP BY gr.material_code, gr.component_type, b.material_name, b.unit
      ORDER BY gr.material_code
    `, [otpaId, componentType]);

    res.json(result.rows);
  } catch (error) {
    console.error('Kabul edilmiş malzemeler hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
