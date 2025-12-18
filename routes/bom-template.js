import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import pool from '../db/database.js';

const router = express.Router();

// Tüm BOM şablonlarını listele
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        bt.id,
        bt.template_name,
        bt.description,
        bt.created_by,
        bt.created_at,
        bt.updated_at,
        u.full_name as created_by_name,
        COUNT(bti.id)::integer as item_count
      FROM bom_templates bt
      LEFT JOIN users u ON bt.created_by = u.id
      LEFT JOIN bom_template_items bti ON bt.id = bti.template_id
      GROUP BY bt.id, bt.template_name, bt.description, bt.created_by, bt.created_at, bt.updated_at, u.full_name
      ORDER BY bt.template_name ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('BOM şablonları listeleme hatası:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// Belirli bir şablonun detayını getir
router.get('/:templateId', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;

    const templateResult = await pool.query(`
      SELECT 
        bt.*,
        u.full_name as created_by_name
      FROM bom_templates bt
      LEFT JOIN users u ON bt.created_by = u.id
      WHERE bt.id = $1
    `, [templateId]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Şablon bulunamadı' });
    }

    const itemsResult = await pool.query(`
      SELECT *
      FROM bom_template_items
      WHERE template_id = $1
      ORDER BY material_code ASC
    `, [templateId]);

    res.json({
      template: templateResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('BOM şablon detay hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Yeni BOM şablonu oluştur
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { template_name, description, items } = req.body;

    if (!template_name || !items || items.length === 0) {
      return res.status(400).json({ error: 'Şablon adı ve malzemeler gereklidir' });
    }

    // Şablon adı kontrolü
    const existingTemplate = await client.query(`
      SELECT id FROM bom_templates WHERE template_name = $1
    `, [template_name]);

    if (existingTemplate.rows.length > 0) {
      return res.status(400).json({ error: 'Bu isimde bir şablon zaten mevcut' });
    }

    // Şablonu oluştur
    const templateResult = await client.query(`
      INSERT INTO bom_templates (template_name, description, created_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [template_name, description || null, req.user.userId]);

    const templateId = templateResult.rows[0].id;

    // Malzemeleri ekle
    for (const item of items) {
      await client.query(`
        INSERT INTO bom_template_items (template_id, material_code, material_name, quantity, unit)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        templateId,
        item.material_code,
        item.material_name,
        item.quantity,
        item.unit || 'Adet'
      ]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'BOM şablonu başarıyla oluşturuldu',
      template: templateResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('BOM şablon oluşturma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  } finally {
    client.release();
  }
});

// Şablonu güncelle
router.put('/:templateId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { templateId } = req.params;
    const { template_name, description, items } = req.body;

    // Şablonu güncelle
    await client.query(`
      UPDATE bom_templates 
      SET template_name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [template_name, description || null, templateId]);

    // Eski malzemeleri sil
    await client.query(`
      DELETE FROM bom_template_items WHERE template_id = $1
    `, [templateId]);

    // Yeni malzemeleri ekle
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(`
          INSERT INTO bom_template_items (template_id, material_code, material_name, quantity, unit)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          templateId,
          item.material_code,
          item.material_name,
          item.quantity,
          item.unit || 'Adet'
        ]);
      }
    }

    await client.query('COMMIT');

    res.json({ message: 'BOM şablonu başarıyla güncellendi' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('BOM şablon güncelleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  } finally {
    client.release();
  }
});

// Şablonu sil
router.delete('/:templateId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { templateId } = req.params;

    const result = await pool.query(`
      DELETE FROM bom_templates WHERE id = $1
    `, [templateId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Şablon bulunamadı' });
    }

    res.json({ message: 'BOM şablonu başarıyla silindi' });
  } catch (error) {
    console.error('BOM şablon silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Şablonu OTPA'ya uygula (component_type ile)
router.post('/:templateId/apply/:otpaId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { templateId, otpaId } = req.params;
    const { component_type } = req.body; // batarya, vccu, junction_box, pdu

    if (!component_type) {
      return res.status(400).json({ error: 'Component type gereklidir (batarya, vccu, junction_box, pdu)' });
    }

    // OTPA'nın var olduğunu kontrol et
    const otpaCheck = await client.query(`
      SELECT id FROM otpa WHERE id = $1
    `, [otpaId]);

    if (otpaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'OTPA bulunamadı' });
    }

    // Şablon malzemelerini getir
    const itemsResult = await client.query(`
      SELECT * FROM bom_template_items WHERE template_id = $1
    `, [templateId]);

    if (itemsResult.rows.length === 0) {
      return res.status(400).json({ error: 'Şablonda malzeme bulunamadı' });
    }

    // Mevcut component_type BOM'unu sil
    await client.query(`
      DELETE FROM bom_items WHERE otpa_id = $1 AND component_type = $2
    `, [otpaId, component_type]);

    // Şablon malzemelerini OTPA'ya kopyala
    for (const item of itemsResult.rows) {
      await client.query(`
        INSERT INTO bom_items (otpa_id, component_type, material_code, material_name, required_quantity, unit)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (otpa_id, component_type, material_code) 
        DO UPDATE SET required_quantity = EXCLUDED.required_quantity, material_name = EXCLUDED.material_name, unit = EXCLUDED.unit
      `, [
        otpaId,
        component_type,
        item.material_code,
        item.material_name,
        item.quantity,
        item.unit
      ]);
    }

    await client.query('COMMIT');

    res.json({
      message: `BOM şablonu ${component_type} için başarıyla uygulandı`,
      item_count: itemsResult.rows.length,
      component_type: component_type
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('BOM şablon uygulama hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  } finally {
    client.release();
  }
});

export default router;
