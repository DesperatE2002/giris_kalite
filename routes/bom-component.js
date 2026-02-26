// routes/bom.js - Yeni endpoint ekleyelim
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireModuleAccess } from './roles.js';
import fs from 'fs';
import pool from '../db/database.js';

const router = express.Router();

// Komponent bazlı BOM yükleme (YEN İ)
router.post('/upload-component', authenticateToken, requireModuleAccess('admin'), async (req, res) => {
  try {
    const { otpa_id, component_type, items } = req.body;

    if (!otpa_id || !component_type || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'otpa_id, component_type ve items gereklidir' });
    }

    // Component type kontrolü
    const validTypes = ['batarya', 'vccu', 'junction_box', 'pdu'];
    if (!validTypes.includes(component_type)) {
      return res.status(400).json({ error: 'Geçersiz component_type' });
    }

    // OTPA'nın paket sayısını al
    const otpaResult = await pool.query(
      'SELECT battery_pack_count FROM otpa WHERE id = ?',
      [otpa_id]
    );
    
    const batteryPackCount = otpaResult.rows[0]?.battery_pack_count || 1;
    
    // Sadece batarya için paket sayısıyla çarp, diğerleri için 1x
    const multiplier = component_type === 'batarya' ? batteryPackCount : 1;
    
    console.log(`📦 ${component_type.toUpperCase()} BOM yükleniyor - Çarpan: ${multiplier}x`);

    // Önce bu komponent için mevcut BOM'u sil
    await pool.query(
      'DELETE FROM bom_items WHERE otpa_id = ? AND component_type = ?',
      [otpa_id, component_type]
    );

    // Yeni BOM'u ekle
    let successCount = 0;
    for (const item of items) {
      const adjustedQuantity = item.required_quantity * multiplier;
      await pool.query(
        `INSERT INTO bom_items (otpa_id, component_type, material_code, material_name, required_quantity, unit)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [otpa_id, component_type, item.material_code, item.material_name, adjustedQuantity, item.unit]
      );
      successCount++;
    }

    res.json({
      message: `${component_type.toUpperCase()} BOM başarıyla yüklendi`,
      count: successCount,
      component_type: component_type,
      multiplier: multiplier
    });
  } catch (error) {
    console.error('BOM yükleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

export default router;
