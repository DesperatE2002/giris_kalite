import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireModuleAccess } from './roles.js';
import pool from '../db/database.js';

const router = express.Router();

// Tüm girişleri getir (raporlama için)
router.get('/all', authenticateToken, requireModuleAccess('goods-receipt'), async (req, res) => {
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
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id AND gr.component_type = b.component_type AND gr.material_code = b.material_code
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
router.get('/', authenticateToken, requireModuleAccess('goods-receipt'), async (req, res) => {
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
router.get('/otpa/:otpaId', authenticateToken, requireModuleAccess('goods-receipt'), async (req, res) => {
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
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id AND gr.component_type = b.component_type AND gr.material_code = b.material_code
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
router.post('/', authenticateToken, requireModuleAccess('goods-receipt'), async (req, res) => {
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

// Malzeme eksiltme - yanlış girilen fazla miktarı düşür
router.post('/deduct', authenticateToken, requireModuleAccess('goods-receipt'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { otpa_id, component_type, material_code, deduct_quantity, notes } = req.body;

    if (!otpa_id || !component_type || !material_code || !deduct_quantity || deduct_quantity <= 0) {
      return res.status(400).json({ error: 'OTPA, komponent, malzeme kodu ve geçerli bir miktar gereklidir' });
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

    // Kabul edilmiş toplam miktarı hesapla
    const acceptedResult = await client.query(`
      SELECT COALESCE(SUM(qr.accepted_quantity), 0) as total_accepted
      FROM goods_receipt gr
      JOIN quality_results qr ON gr.id = qr.receipt_id
      WHERE gr.otpa_id = $1 
        AND gr.component_type = $2
        AND gr.material_code = $3
        AND qr.accepted_quantity > 0
    `, [otpa_id, component_type, material_code]);

    const totalAccepted = parseFloat(acceptedResult.rows[0].total_accepted);

    if (totalAccepted < deduct_quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Eksiltme miktarı kabul edilmiş miktardan fazla olamaz. Mevcut kabul: ${totalAccepted}, Talep: ${deduct_quantity}` 
      });
    }

    // LIFO - en yeni kayıtlardan başlayarak eksilt
    let remaining = deduct_quantity;
    
    const entriesResult = await client.query(`
      SELECT qr.id, qr.accepted_quantity, gr.id as receipt_id
      FROM goods_receipt gr
      JOIN quality_results qr ON gr.id = qr.receipt_id
      WHERE gr.otpa_id = $1 
        AND gr.component_type = $2
        AND gr.material_code = $3
        AND qr.accepted_quantity > 0
      ORDER BY gr.created_at DESC
    `, [otpa_id, component_type, material_code]);

    for (const entry of entriesResult.rows) {
      if (remaining <= 0) break;

      const deductAmount = Math.min(remaining, parseFloat(entry.accepted_quantity));
      
      await client.query(`
        UPDATE quality_results
        SET accepted_quantity = accepted_quantity - $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [deductAmount, entry.id]);

      remaining -= deductAmount;
    }

    // Eksiltme log kaydı oluştur (negatif giriş olarak kaydet)
    const logResult = await client.query(
      `INSERT INTO goods_receipt (otpa_id, component_type, material_code, received_quantity, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [otpa_id, component_type, material_code, -deduct_quantity, 
       `Malzeme eksiltme${notes ? ' - ' + notes : ''}`, req.user.id]
    );

    const logEntry = logResult.rows[0];

    // Log kaydı için kalite sonucu (kabul olarak, negatif miktar)
    await client.query(
      `INSERT INTO quality_results (receipt_id, status, accepted_quantity, rejected_quantity, reason, decision_by, decision_date)
       VALUES ($1, 'kabul', $2, 0, $3, $4, CURRENT_TIMESTAMP)`,
      [logEntry.id, -deduct_quantity, `Malzeme eksiltme${notes ? ' - ' + notes : ''}`, req.user.id]
    );

    await client.query('COMMIT');

    res.json({ 
      message: `${deduct_quantity} adet başarıyla eksiltildi`,
      deducted: deduct_quantity,
      new_total_accepted: totalAccepted - deduct_quantity
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Malzeme eksiltme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  } finally {
    client.release();
  }
});

// Toplu malzeme girişi - seçilen malzemelerin tamamını tam miktarda giriş yap
router.post('/bulk', authenticateToken, requireModuleAccess('goods-receipt'), async (req, res) => {
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
router.get('/:id', authenticateToken, requireModuleAccess('goods-receipt'), async (req, res) => {
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
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id AND gr.component_type = b.component_type AND gr.material_code = b.material_code
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

// Toplu giriş geri alma - belirli zaman aralığında yapılan "Toplu giriş" kayıtlarını sil
router.delete('/bulk-undo', authenticateToken, requireModuleAccess('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { otpa_id, created_after, created_before } = req.body;

    if (!created_after || !created_before) {
      return res.status(400).json({ error: 'Zaman aralığı gereklidir' });
    }

    await client.query('BEGIN');

    // Silinecek kayıtları bul
    let findQuery = `SELECT gr.id FROM goods_receipt gr WHERE gr.notes = 'Toplu giriş' AND gr.created_at >= ? AND gr.created_at <= ?`;
    const findParams = [created_after, created_before];
    if (otpa_id) {
      findQuery += ' AND gr.otpa_id = ?';
      findParams.push(otpa_id);
    }
    const toDelete = await client.query(findQuery, findParams);
    const ids = toDelete.rows.map(r => r.id);

    if (ids.length === 0) {
      await client.query('ROLLBACK');
      return res.json({ message: 'Silinecek kayıt bulunamadı', deleted: 0 });
    }

    // Quality results sil
    for (const id of ids) {
      await client.query('DELETE FROM quality_results WHERE receipt_id = ?', [id]);
    }
    // Goods receipt sil
    for (const id of ids) {
      await client.query('DELETE FROM goods_receipt WHERE id = ?', [id]);
    }

    await client.query('COMMIT');
    res.json({ message: `${ids.length} kayıt başarıyla silindi`, deleted: ids.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Toplu geri alma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  } finally {
    client.release();
  }
});

// Tek veya çoklu giriş kaydı silme (ID listesi ile)
router.delete('/bulk-delete-by-ids', authenticateToken, requireModuleAccess('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Silinecek kayıt ID listesi gereklidir' });
    }

    await client.query('BEGIN');

    for (const id of ids) {
      await client.query('DELETE FROM quality_results WHERE receipt_id = ?', [id]);
      await client.query('DELETE FROM goods_receipt WHERE id = ?', [id]);
    }

    await client.query('COMMIT');
    res.json({ message: `${ids.length} kayıt başarıyla silindi`, deleted: ids.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Toplu silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  } finally {
    client.release();
  }
});

// Belirli OTPA'nın tüm "Toplu giriş" kayıtlarını listele (silme öncesi kontrol)
router.get('/bulk-entries/:otpaId', authenticateToken, requireModuleAccess('admin'), async (req, res) => {
  try {
    const { otpaId } = req.params;
    const result = await pool.query(`
      SELECT gr.id, gr.component_type, gr.material_code, gr.received_quantity, gr.created_at, gr.notes,
        qr.status as quality_status, qr.accepted_quantity, qr.rejected_quantity
      FROM goods_receipt gr 
      LEFT JOIN quality_results qr ON gr.id = qr.receipt_id
      WHERE gr.otpa_id = ? AND gr.notes = 'Toplu giriş'
      ORDER BY gr.created_at DESC, gr.component_type, gr.material_code
    `, [otpaId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Toplu giriş listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
