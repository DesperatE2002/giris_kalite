import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/database.js';

const router = express.Router();

// OTPA tamamlama raporu
router.get('/otpa-completion', authenticateToken, async (req, res) => {
  try {
    const { otpa_id } = req.query;

    // TEK QUERY - SÜPER HIZLI!
    let query = `
      SELECT 
        o.id,
        o.otpa_number,
        o.project_name,
        o.customer_info,
        o.status,
        COUNT(DISTINCT b.id) as total_items,
        COUNT(DISTINCT CASE 
          WHEN (
            SELECT COALESCE(SUM(qr.accepted_quantity), 0)
            FROM goods_receipt gr
            LEFT JOIN quality_results qr ON gr.id = qr.receipt_id
            WHERE gr.otpa_id = b.otpa_id 
              AND gr.material_code = b.material_code
          ) >= b.required_quantity 
          THEN b.id 
        END) as completed_items
      FROM otpa o
      LEFT JOIN bom_items b ON o.id = b.otpa_id
    `;

    const params = [];
    if (otpa_id) {
      query += ' WHERE o.id = ?';
      params.push(otpa_id);
    }

    query += ' GROUP BY o.id, o.otpa_number, o.project_name, o.customer_info, o.status ORDER BY o.otpa_number';

    const result = await pool.query(query, params);
    
    // Calculate completion percentage
    const rows = result.rows.map(otpa => ({
      ...otpa,
      completion_percentage: otpa.total_items > 0 
        ? Math.round((otpa.completed_items / otpa.total_items) * 100) 
        : 0
    }));

    res.json(rows);
  } catch (error) {
    console.error('OTPA tamamlama raporu hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Eksik malzeme raporu
router.get('/missing-materials', authenticateToken, async (req, res) => {
  try {
    const { otpa_id } = req.query;

    // TEK QUERY - KABUL EDİLEN MİKTARI DA GETİR!
    let query = `
      SELECT 
        o.otpa_number,
        o.project_name,
        b.component_type,
        b.material_code,
        b.material_name,
        b.required_quantity,
        b.unit,
        b.otpa_id,
        COALESCE(SUM(qr.accepted_quantity), 0) as accepted_quantity
      FROM bom_items b
      JOIN otpa o ON b.otpa_id = o.id
      LEFT JOIN goods_receipt gr ON gr.otpa_id = b.otpa_id 
        AND gr.material_code = b.material_code
      LEFT JOIN quality_results qr ON qr.receipt_id = gr.id
      GROUP BY b.id, o.otpa_number, o.project_name, b.component_type, 
               b.material_code, b.material_name, b.required_quantity, b.unit, b.otpa_id
    `;

    const params = [];
    if (otpa_id) {
      query += ' WHERE o.id = ?';
      params.push(otpa_id);
    }

    query += ' ORDER BY o.otpa_number, b.material_code';

    const result = await pool.query(query, params);
    
    // TEK QUERY İLE EKSİK HESAPLA - SÜPER HIZLI!
    const missing = result.rows
      .map(item => {
        const accepted = item.accepted_quantity || 0;
        const missingQty = item.required_quantity - accepted;
        
        if (missingQty > 0) {
          return {
            ...item,
            missing_quantity: missingQty,
            status: accepted > 0 ? 'Kısmi' : 'Hiç Gelmedi'
          };
        }
        return null;
      })
      .filter(item => item !== null);

    res.json(missing);
  } catch (error) {
    console.error('Eksik malzeme raporu hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Red/İade raporu
router.get('/rejections', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, otpa_id } = req.query;

    let query = `
      SELECT 
        o.otpa_number,
        o.project_name,
        gr.component_type,
        gr.material_code,
        b.material_name,
        gr.received_quantity,
        gr.receipt_date,
        qr.status,
        qr.accepted_quantity,
        qr.rejected_quantity,
        qr.reason,
        qr.decision_date,
        u.full_name as decision_by_name
      FROM quality_results qr
      JOIN goods_receipt gr ON qr.receipt_id = gr.id
      JOIN otpa o ON gr.otpa_id = o.id
      LEFT JOIN bom_items b ON gr.otpa_id = b.otpa_id 
        AND gr.component_type = b.component_type 
        AND gr.material_code = b.material_code
      LEFT JOIN users u ON qr.decision_by = u.id
      WHERE qr.status = ?
        AND qr.rejected_quantity > 0
    `;

    const params = ['iade'];

    if (start_date) {
      query += ` AND gr.receipt_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND gr.receipt_date <= ?`;
      params.push(end_date);
    }

    if (otpa_id) {
      query += ` AND gr.otpa_id = ?`;
      params.push(otpa_id);
    }

    query += ' ORDER BY qr.decision_date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Red raporu hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// İade İstatistikleri
router.get('/return-statistics', authenticateToken, async (req, res) => {
  try {
    const { period, material_code } = req.query;
    
    let dateFilter = '';
    if (period === '1month') {
      dateFilter = `AND qr.decision_date >= CURRENT_DATE - INTERVAL '1 month'`;
    } else if (period === '3months') {
      dateFilter = `AND qr.decision_date >= CURRENT_DATE - INTERVAL '3 months'`;
    } else if (period === '1year') {
      dateFilter = `AND qr.decision_date >= CURRENT_DATE - INTERVAL '1 year'`;
    }

    // Toplam iade miktarları (rejected_quantity > 0 olan tüm kayıtlar)
    const totalQuery = `
      SELECT 
        COUNT(DISTINCT gr.id) as total_return_transactions,
        COALESCE(SUM(qr.rejected_quantity), 0) as total_return_quantity
      FROM quality_results qr
      JOIN goods_receipt gr ON qr.receipt_id = gr.id
      WHERE qr.rejected_quantity > 0
        ${dateFilter}
    `;
    const totalResult = await pool.query(totalQuery);

    // En çok iade edilen malzemeler (rejected_quantity > 0 olan tüm kayıtlar)
    const topMaterialsQuery = `
      SELECT 
        gr.material_code,
        b.material_name,
        COUNT(DISTINCT gr.id) as return_transactions,
        COALESCE(SUM(qr.rejected_quantity), 0) as total_return_quantity
      FROM quality_results qr
      JOIN goods_receipt gr ON qr.receipt_id = gr.id
      LEFT JOIN bom_items b ON gr.material_code = b.material_code
      WHERE qr.rejected_quantity > 0
        ${dateFilter}
      GROUP BY gr.material_code, b.material_name
      ORDER BY total_return_quantity DESC, return_transactions DESC
      LIMIT 10
    `;
    const topMaterials = await pool.query(topMaterialsQuery);

    // Belirli malzeme için detaylı istatistik (geçmiş tüm iade kayıtları)
    let materialDetail = null;
    if (material_code) {
      const materialQuery = `
        SELECT 
          gr.material_code,
          b.material_name,
          COUNT(DISTINCT gr.id) as return_transactions,
          COALESCE(SUM(qr.rejected_quantity), 0) as total_return_quantity,
          MIN(qr.decision_date) as first_return,
          MAX(qr.decision_date) as last_return
        FROM quality_results qr
        JOIN goods_receipt gr ON qr.receipt_id = gr.id
        LEFT JOIN bom_items b ON gr.material_code = b.material_code
        WHERE qr.rejected_quantity > 0
          AND gr.material_code = $1
          ${dateFilter}
        GROUP BY gr.material_code, b.material_name
      `;
      const materialResult = await pool.query(materialQuery, [material_code]);
      materialDetail = materialResult.rows[0] || null;
    }

    res.json({
      total: totalResult.rows[0],
      topMaterials: topMaterials.rows,
      materialDetail: materialDetail
    });
  } catch (error) {
    console.error('İade istatistikleri hatası:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Sunucu hatası', details: error.message });
  }
});

// Özet istatistikler
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const openOtpa = await pool.query(`SELECT COUNT(*) as count FROM otpa WHERE status = ?`, ['acik']);
    const inProductionOtpa = await pool.query(`SELECT COUNT(*) as count FROM otpa WHERE status = ?`, ['uretimde']);
    const pendingQuality = await pool.query(`SELECT COUNT(*) as count FROM quality_results WHERE status = ?`, ['bekliyor']);
    const rejectionsLastMonth = await pool.query(`
      SELECT COUNT(*) as count FROM quality_results 
      WHERE status = ? AND decision_date >= CURRENT_DATE - INTERVAL '30 days'
    `, ['iade']);

    res.json({
      open_otpa: parseInt(openOtpa.rows[0]?.count || 0),
      in_production_otpa: parseInt(inProductionOtpa.rows[0]?.count || 0),
      pending_quality: parseInt(pendingQuality.rows[0]?.count || 0),
      rejections_last_month: parseInt(rejectionsLastMonth.rows[0]?.count || 0)
    });
  } catch (error) {
    console.error('Özet istatistik hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
