import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import dbSqlite from '../db/database-sqlite.js';
import dbPostgres from '../db/database.js';

// Choose database based on environment
const pool = process.env.USE_SQLITE === 'true' ? dbSqlite : dbPostgres;

const router = express.Router();

// OTPA tamamlama raporu
router.get('/otpa-completion', authenticateToken, async (req, res) => {
  try {
    const { otpa_id } = req.query;

    let query = `
      SELECT 
        o.id,
        o.otpa_number,
        o.project_name,
        o.customer_info,
        o.status
      FROM otpa o
    `;

    const params = [];
    if (otpa_id) {
      query += ' WHERE o.id = ?';
      params.push(otpa_id);
    }

    query += ' ORDER BY o.otpa_number';

    const result = await pool.query(query, params);
    
    // Calculate totals for each OTPA
    for (let otpa of result.rows) {
      // Toplam BOM kalemi sayısı
      const bomCount = await pool.query(
        'SELECT COUNT(*) as count FROM bom_items WHERE otpa_id = ?',
        [otpa.id]
      );
      otpa.total_items = bomCount.rows[0]?.count || 0;
      
      // Tamamlanan malzeme sayısı (kabul edilen miktar >= gereken miktar)
      const completedCount = await pool.query(`
        SELECT COUNT(*) as count
        FROM bom_items b
        WHERE b.otpa_id = ? 
        AND (
          SELECT COALESCE(SUM(qr.accepted_quantity), 0)
          FROM goods_receipt gr
          LEFT JOIN quality_results qr ON gr.id = qr.receipt_id AND qr.status = ?
          WHERE gr.otpa_id = b.otpa_id 
            AND gr.component_type = b.component_type 
            AND gr.material_code = b.material_code
        ) >= b.required_quantity
      `, [otpa.id, 'kabul']);
      
      otpa.completed_items = completedCount.rows[0]?.count || 0;
      otpa.completion_percentage = otpa.total_items > 0 
        ? Math.round((otpa.completed_items / otpa.total_items) * 100) 
        : 0;
    }

    res.json(result.rows);
  } catch (error) {
    console.error('OTPA tamamlama raporu hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Eksik malzeme raporu
router.get('/missing-materials', authenticateToken, async (req, res) => {
  try {
    const { otpa_id } = req.query;

    let query = `
      SELECT 
        o.otpa_number,
        o.project_name,
        b.component_type,
        b.material_code,
        b.material_name,
        b.required_quantity,
        b.unit,
        b.otpa_id
      FROM bom_items b
      JOIN otpa o ON b.otpa_id = o.id
    `;

    const params = [];
    if (otpa_id) {
      query += ' WHERE o.id = ?';
      params.push(otpa_id);
    }

    query += ' ORDER BY o.otpa_number, b.material_code';

    const result = await pool.query(query, params);
    
    // Calculate for each item
    const missing = [];
    for (let item of result.rows) {
      const qualityResult = await pool.query(`
        SELECT SUM(qr.accepted_quantity) as total_accepted
        FROM goods_receipt gr
        LEFT JOIN quality_results qr ON gr.id = qr.receipt_id AND qr.status = ?
        WHERE gr.otpa_id = ? AND gr.component_type = ? AND gr.material_code = ?
      `, ['kabul', item.otpa_id, item.component_type, item.material_code]);
      
      const accepted = qualityResult.rows[0]?.total_accepted || 0;
      const missingQty = item.required_quantity - accepted;
      
      if (missingQty > 0) {
        item.accepted_quantity = accepted;
        item.missing_quantity = missingQty;
        item.status = accepted > 0 ? 'Kısmi' : 'Hiç Gelmedi';
        missing.push(item);
      }
    }

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
