import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireModuleAccess } from './roles.js';
import pool from '../db/database.js';

const router = express.Router();

// Tüm OTPA'ları listele
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Tek query ile tüm bilgileri çek (N+1 problemi yok!)
    const result = await pool.query(`
      SELECT 
        o.id,
        o.otpa_number,
        o.project_name,
        o.customer_info,
        o.battery_pack_count,
        o.status,
        o.created_by,
        o.created_at,
        o.updated_at,
        u.full_name as created_by_name,
        COALESCE(COUNT(DISTINCT b.id), 0) as total_items,
        COALESCE(COUNT(DISTINCT CASE 
          WHEN b.required_quantity <= (
            SELECT COALESCE(SUM(qr.accepted_quantity), 0)
            FROM goods_receipt gr
            LEFT JOIN quality_results qr ON gr.id = qr.receipt_id
            WHERE gr.otpa_id = o.id 
              AND gr.component_type = b.component_type
              AND gr.material_code = b.material_code
          )
          THEN b.id 
        END), 0) as completed_items
      FROM otpa o
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN bom_items b ON o.id = b.otpa_id
      GROUP BY o.id, o.otpa_number, o.project_name, o.customer_info, 
               o.battery_pack_count, o.status, o.created_by, o.created_at, 
               o.updated_at, u.full_name
      ORDER BY o.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('OTPA listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// OTPA detayı ve BOM özeti
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // PARALEL QUERY - Tüm verileri aynı anda çek!
    const [otpaResult, bomResult] = await Promise.all([
      // OTPA bilgisi
      pool.query(`
        SELECT o.id, o.otpa_number, o.project_name, o.customer_info, o.status, o.created_by, o.created_at, o.updated_at, u.full_name as created_by_name
        FROM otpa o
        LEFT JOIN users u ON o.created_by = u.id
        WHERE o.id = ?
      `, [id]),
      
      // BOM items + receipts + quality tek sorguda (SÜPER HIZLI!)
      pool.query(`
        SELECT 
          b.id,
          b.material_code,
          b.material_name,
          b.required_quantity,
          b.unit,
          b.component_type,
          COALESCE(SUM(gr.received_quantity), 0) as total_received,
          COALESCE(SUM(qr.accepted_quantity), 0) as total_accepted,
          COALESCE(SUM(qr.rejected_quantity), 0) as total_rejected,
          COUNT(CASE WHEN qr.status IN ('red', 'sartli_kabul') THEN 1 END) as quality_issues
        FROM bom_items b
        LEFT JOIN goods_receipt gr ON b.otpa_id = gr.otpa_id AND b.component_type = gr.component_type AND b.material_code = gr.material_code
        LEFT JOIN quality_results qr ON gr.id = qr.receipt_id
        WHERE b.otpa_id = ?
        GROUP BY b.id, b.material_code, b.material_name, b.required_quantity, b.unit, b.component_type
        ORDER BY b.component_type, b.material_code
      `, [id])
    ]);

    if (otpaResult.rows.length === 0) {
      return res.status(404).json({ error: 'OTPA bulunamadı' });
    }

    // Calculate completion for each BOM item
    const bomItems = bomResult.rows.map(item => {
      const missing_quantity = Math.max(0, item.required_quantity - item.total_accepted);
      const completion = item.required_quantity > 0 
        ? (item.total_accepted / item.required_quantity * 100) 
        : 0;
      
      return {
        ...item,
        missing_quantity,
        completion_percentage: Math.min(100, Math.round(completion * 100) / 100)
      };
    });

    res.json({
      otpa: otpaResult.rows[0],
      bom: bomItems
    });
  } catch (error) {
    console.error('OTPA detay hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Yeni OTPA oluştur
router.post('/', authenticateToken, requireModuleAccess('admin'), async (req, res) => {
  try {
    const { otpa_number, project_name, customer_info, battery_pack_count, status } = req.body;

    if (!otpa_number || !project_name) {
      return res.status(400).json({ error: 'OTPA numarası ve proje adı gereklidir' });
    }

    const result = await pool.query(
      `INSERT INTO otpa (otpa_number, project_name, customer_info, battery_pack_count, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      [otpa_number, project_name, customer_info || null, battery_pack_count || 8, status || 'acik', req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('OTPA oluşturma hatası:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Bu OTPA numarası zaten mevcut' });
    }
    console.error('OTPA oluşturma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// OTPA güncelle
router.put('/:id', authenticateToken, requireModuleAccess('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { project_name, customer_info, battery_pack_count, status } = req.body;

    // Eski paket sayısını al
    const oldOtpa = await pool.query('SELECT battery_pack_count FROM otpa WHERE id = ?', [id]);
    const oldPackCount = oldOtpa.rows[0]?.battery_pack_count || 1;
    const newPackCount = battery_pack_count || oldPackCount;

    const result = await pool.query(
      `UPDATE otpa 
       SET project_name = COALESCE(?, project_name),
           customer_info = COALESCE(?, customer_info),
           battery_pack_count = COALESCE(?, battery_pack_count),
           status = COALESCE(?, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
       RETURNING *`,
      [project_name, customer_info, battery_pack_count, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'OTPA bulunamadı' });
    }

    // Eğer paket sayısı değiştiyse, sadece batarya BOM miktarlarını güncelle
    if (newPackCount !== oldPackCount && oldPackCount > 0) {
      console.log(`📦 Batarya paket sayısı değişti: ${oldPackCount} → ${newPackCount}`);
      
      // Sadece batarya BOM kalemlerini al
      const bomItems = await pool.query(
        "SELECT id, required_quantity FROM bom_items WHERE otpa_id = ? AND component_type = 'batarya'",
        [id]
      );

      // Her BOM kalemini yeniden hesapla
      for (const item of bomItems.rows) {
        // Eski paket sayısına göre birim miktarı bul
        const unitQuantity = item.required_quantity / oldPackCount;
        // Yeni paket sayısıyla çarp
        const newQuantity = unitQuantity * newPackCount;
        
        await pool.query(
          'UPDATE bom_items SET required_quantity = ? WHERE id = ?',
          [newQuantity, item.id]
        );
      }
      
      console.log(`✅ ${bomItems.rows.length} Batarya BOM kalemi güncellendi`);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('OTPA güncelleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// OTPA sil
router.delete('/:id', authenticateToken, requireModuleAccess('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if exists
    const check = await pool.query('SELECT * FROM otpa WHERE id = ?', [id]);
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'OTPA bulunamadı' });
    }

    await pool.query('DELETE FROM otpa WHERE id = ?', [id]);

    res.json({ message: 'OTPA silindi', otpa: check.rows[0] });
  } catch (error) {
    console.error('OTPA silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
