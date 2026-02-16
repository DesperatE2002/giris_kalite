import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import pool from '../db/database.js';
import multer from 'multer';
import XLSX from 'xlsx';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── AUTO-MİGRATİON ────────────────────────────────────────────────────────────

export async function migratePacketAnaliz() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pa_packages (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT,
        description TEXT,
        currency TEXT DEFAULT 'EUR',
        time_unit TEXT DEFAULT 'gun',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pa_items (
        id SERIAL PRIMARY KEY,
        package_id INTEGER NOT NULL REFERENCES pa_packages(id) ON DELETE CASCADE,
        part_code TEXT NOT NULL,
        part_name TEXT,
        bom_quantity REAL DEFAULT 0,
        unit_price REAL DEFAULT 0,
        lead_time_days INTEGER DEFAULT 0,
        delivery_date TEXT,
        temsa_stock REAL DEFAULT 0,
        supplier TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add currency and time_unit columns if missing (for existing deployments)
    try { await pool.query(`ALTER TABLE pa_packages ADD COLUMN currency TEXT DEFAULT 'EUR'`); } catch(e) { /* column exists */ }
    try { await pool.query(`ALTER TABLE pa_packages ADD COLUMN time_unit TEXT DEFAULT 'gun'`); } catch(e) { /* column exists */ }
    console.log('✅ Auto-migration: pa_packages ve pa_items tabloları hazır');
  } catch (e) {
    if (!e.message?.includes('already exists')) {
      console.error('⚠️ Paket-Analiz migration:', e.message);
    }
  }
}

// ─── PAKET CRUD ─────────────────────────────────────────────────────────────────

// Tüm paketler
router.get('/packages', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM pa_items WHERE package_id = p.id) as item_count
      FROM pa_packages p 
      ORDER BY p.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Paket listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Paket oluştur
router.post('/packages', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { name, code, description, currency, time_unit } = req.body;
    if (!name) return res.status(400).json({ error: 'Paket adı gereklidir' });

    const result = await pool.query(
      `INSERT INTO pa_packages (name, code, description, currency, time_unit) VALUES (?, ?, ?, ?, ?) RETURNING *`,
      [name, code || null, description || null, currency || 'EUR', time_unit || 'gun']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Paket oluşturma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Paket güncelle
router.put('/packages/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { name, code, description, currency, time_unit } = req.body;
    const result = await pool.query(
      `UPDATE pa_packages SET name = ?, code = ?, description = ?, currency = ?, time_unit = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? RETURNING *`,
      [name, code || null, description || null, currency || 'EUR', time_unit || 'gun', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Paket bulunamadı' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Paket güncelleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Paket sil
router.delete('/packages/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM pa_items WHERE package_id = ?', [req.params.id]);
    await pool.query('DELETE FROM pa_packages WHERE id = ?', [req.params.id]);
    res.json({ message: 'Paket silindi' });
  } catch (error) {
    console.error('Paket silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ─── KALEM CRUD ─────────────────────────────────────────────────────────────────

// Paketin kalemleri
router.get('/packages/:id/items', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM pa_items WHERE package_id = ? ORDER BY part_code`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Kalem listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Tek kalem ekle
router.post('/packages/:id/items', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { part_code, part_name, bom_quantity, unit_price, lead_time_days, delivery_date, temsa_stock, supplier } = req.body;
    if (!part_code) return res.status(400).json({ error: 'Parça kodu gereklidir' });

    const result = await pool.query(
      `INSERT INTO pa_items (package_id, part_code, part_name, bom_quantity, unit_price, lead_time_days, delivery_date, temsa_stock, supplier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [req.params.id, part_code, part_name || null, bom_quantity || 0, unit_price || 0, lead_time_days || 0, delivery_date || null, temsa_stock || 0, supplier || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Kalem ekleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Kalem güncelle
router.put('/items/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { part_code, part_name, bom_quantity, unit_price, lead_time_days, delivery_date, temsa_stock, supplier } = req.body;
    const result = await pool.query(
      `UPDATE pa_items SET part_code = ?, part_name = ?, bom_quantity = ?, unit_price = ?, 
       lead_time_days = ?, delivery_date = ?, temsa_stock = ?, supplier = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? RETURNING *`,
      [part_code, part_name, bom_quantity || 0, unit_price || 0, lead_time_days || 0, delivery_date || null, temsa_stock || 0, supplier || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Kalem bulunamadı' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Kalem güncelleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Kalem sil
router.delete('/items/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM pa_items WHERE id = ?', [req.params.id]);
    res.json({ message: 'Kalem silindi' });
  } catch (error) {
    console.error('Kalem silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ─── ANALİZ ─────────────────────────────────────────────────────────────────────

// Analiz hesapla
router.get('/packages/:id/analysis', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const packageCount = parseInt(req.query.count) || 1;
    const items = await pool.query(
      `SELECT * FROM pa_items WHERE package_id = ? ORDER BY part_code`,
      [req.params.id]
    );

    const pkg = await pool.query('SELECT * FROM pa_packages WHERE id = ?', [req.params.id]);
    if (pkg.rows.length === 0) return res.status(404).json({ error: 'Paket bulunamadı' });

    const analysis = items.rows.map(item => {
      const totalNeed = (item.bom_quantity || 0) * packageCount;
      const stock = item.temsa_stock || 0;
      const missing = Math.max(totalNeed - stock, 0);
      const missingCost = missing * (item.unit_price || 0);
      const isCritical = (item.lead_time_days || 0) >= 30 || missing > 0;

      return {
        ...item,
        total_need: totalNeed,
        missing_quantity: missing,
        missing_cost: missingCost,
        is_critical: isCritical
      };
    });

    // Özet
    const totalItems = analysis.length;
    const missingItems = analysis.filter(a => a.missing_quantity > 0).length;
    const totalMissingCost = analysis.reduce((s, a) => s + a.missing_cost, 0);
    const topCritical = [...analysis].filter(a => a.missing_quantity > 0).sort((a, b) => (b.lead_time_days || 0) - (a.lead_time_days || 0)).slice(0, 5);
    const topCostly = [...analysis].filter(a => a.missing_quantity > 0).sort((a, b) => b.missing_cost - a.missing_cost).slice(0, 5);

    // Senaryolar
    const scenarios = [1, 5, 10, 20, 50].map(count => {
      let cost = 0;
      items.rows.forEach(item => {
        const need = (item.bom_quantity || 0) * count;
        const miss = Math.max(need - (item.temsa_stock || 0), 0);
        cost += miss * (item.unit_price || 0);
      });
      return { count, total_missing_cost: cost };
    });

    res.json({
      package: pkg.rows[0],
      package_count: packageCount,
      items: analysis,
      summary: {
        total_items: totalItems,
        missing_items: missingItems,
        total_missing_cost: totalMissingCost,
        top_critical: topCritical,
        top_costly: topCostly
      },
      scenarios
    });
  } catch (error) {
    console.error('Analiz hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ─── EXCEL IMPORT — BOM ─────────────────────────────────────────────────────────

router.post('/import/bom', authenticateToken, authorizeRoles('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya gereklidir' });

    const packageId = req.body.package_id;
    if (!packageId) return res.status(400).json({ error: 'Paket seçilmelidir' });

    const mapping = JSON.parse(req.body.mapping || '{}');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const partCodeCol = mapping.part_code || 'Parça Kodu';
    const partNameCol = mapping.part_name || 'Parça Adı';
    const bomQtyCol = mapping.bom_quantity || 'BOM Adedi';

    let updated = 0, inserted = 0, skipped = 0;
    const processedCodes = new Set();

    for (const row of rows) {
      const partCode = String(row[partCodeCol] || '').trim();
      if (!partCode) { skipped++; continue; }

      processedCodes.add(partCode);
      const partName = String(row[partNameCol] || '').trim() || null;
      const bomQty = parseFloat(row[bomQtyCol]) || 0;

      // Mevcut kaydı kontrol et
      const existing = await pool.query(
        'SELECT id FROM pa_items WHERE package_id = ? AND part_code = ?',
        [packageId, partCode]
      );

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE pa_items SET part_name = COALESCE(?, part_name), bom_quantity = ?, updated_at = CURRENT_TIMESTAMP
           WHERE package_id = ? AND part_code = ?`,
          [partName, bomQty, packageId, partCode]
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO pa_items (package_id, part_code, part_name, bom_quantity) VALUES (?, ?, ?, ?)`,
          [packageId, partCode, partName, bomQty]
        );
        inserted++;
      }
    }

    // Full Sync: Dosyada olmayan kalemlerin BOM adedini 0'a çek
    const allItems = await pool.query('SELECT id, part_code FROM pa_items WHERE package_id = ?', [packageId]);
    let zeroed = 0;
    for (const item of allItems.rows) {
      if (!processedCodes.has(item.part_code)) {
        await pool.query(
          'UPDATE pa_items SET bom_quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [item.id]
        );
        zeroed++;
      }
    }

    res.json({
      message: 'BOM import tamamlandı',
      report: {
        total_rows: rows.length,
        updated,
        inserted,
        skipped,
        zeroed,
        processed_codes: processedCodes.size
      }
    });
  } catch (error) {
    console.error('BOM import hatası:', error);
    res.status(500).json({ error: 'Import hatası: ' + error.message });
  }
});

// ─── EXCEL IMPORT — MALİYET ─────────────────────────────────────────────────────

router.post('/import/cost', authenticateToken, authorizeRoles('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya gereklidir' });

    const packageId = req.body.package_id;
    if (!packageId) return res.status(400).json({ error: 'Paket seçilmelidir' });

    const mapping = JSON.parse(req.body.mapping || '{}');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const partCodeCol = mapping.part_code || 'Parça Kodu';
    const priceCol = mapping.unit_price || 'Birim Fiyat';

    let updated = 0;
    const unmatched = [];
    const processedCodes = new Set();

    for (const row of rows) {
      const partCode = String(row[partCodeCol] || '').trim();
      if (!partCode) continue;

      processedCodes.add(partCode);
      const price = parseFloat(row[priceCol]) || 0;

      const result = await pool.query(
        `UPDATE pa_items SET unit_price = ?, updated_at = CURRENT_TIMESTAMP
         WHERE package_id = ? AND part_code = ? RETURNING id`,
        [price, packageId, partCode]
      );

      if (result.rows.length > 0) {
        updated++;
      } else {
        unmatched.push(partCode);
      }
    }

    // Full Sync: Dosyada olmayan kalemlerin fiyatını 0'a çek
    const allItems = await pool.query('SELECT id, part_code FROM pa_items WHERE package_id = ?', [packageId]);
    let zeroed = 0;
    for (const item of allItems.rows) {
      if (!processedCodes.has(item.part_code)) {
        await pool.query(
          'UPDATE pa_items SET unit_price = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [item.id]
        );
        zeroed++;
      }
    }

    res.json({
      message: 'Maliyet import tamamlandı',
      report: {
        total_rows: rows.length,
        updated,
        unmatched_count: unmatched.length,
        unmatched_codes: unmatched.slice(0, 50),
        zeroed,
        processed_codes: processedCodes.size
      }
    });
  } catch (error) {
    console.error('Maliyet import hatası:', error);
    res.status(500).json({ error: 'Import hatası: ' + error.message });
  }
});

// ─── EXCEL IMPORT — LEAD TIME ───────────────────────────────────────────────────

router.post('/import/leadtime', authenticateToken, authorizeRoles('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya gereklidir' });

    const packageId = req.body.package_id;
    if (!packageId) return res.status(400).json({ error: 'Paket seçilmelidir' });

    const mapping = JSON.parse(req.body.mapping || '{}');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const partCodeCol = mapping.part_code || 'Parça Kodu';
    const leadTimeCol = mapping.lead_time_days || 'Lead Time';

    let updated = 0;
    const unmatched = [];
    const processedCodes = new Set();

    for (const row of rows) {
      const partCode = String(row[partCodeCol] || '').trim();
      if (!partCode) continue;

      processedCodes.add(partCode);
      const lt = parseInt(row[leadTimeCol]) || 0;

      const result = await pool.query(
        `UPDATE pa_items SET lead_time_days = ?, updated_at = CURRENT_TIMESTAMP
         WHERE package_id = ? AND part_code = ? RETURNING id`,
        [lt, packageId, partCode]
      );

      if (result.rows.length > 0) {
        updated++;
      } else {
        unmatched.push(partCode);
      }
    }

    // Full Sync
    const allItems = await pool.query('SELECT id, part_code FROM pa_items WHERE package_id = ?', [packageId]);
    let zeroed = 0;
    for (const item of allItems.rows) {
      if (!processedCodes.has(item.part_code)) {
        await pool.query(
          'UPDATE pa_items SET lead_time_days = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [item.id]
        );
        zeroed++;
      }
    }

    res.json({
      message: 'Lead time import tamamlandı',
      report: {
        total_rows: rows.length,
        updated,
        unmatched_count: unmatched.length,
        unmatched_codes: unmatched.slice(0, 50),
        zeroed,
        processed_codes: processedCodes.size
      }
    });
  } catch (error) {
    console.error('Lead time import hatası:', error);
    res.status(500).json({ error: 'Import hatası: ' + error.message });
  }
});

// ─── EXCEL IMPORT — STOK ────────────────────────────────────────────────────────

router.post('/import/stock', authenticateToken, authorizeRoles('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya gereklidir' });

    const packageId = req.body.package_id;
    if (!packageId) return res.status(400).json({ error: 'Paket seçilmelidir' });

    const mapping = JSON.parse(req.body.mapping || '{}');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const partCodeCol = mapping.part_code || 'Parça Kodu';
    const stockCol = mapping.temsa_stock || 'Stok';

    let updated = 0;
    const unmatched = [];
    const processedCodes = new Set();

    for (const row of rows) {
      const partCode = String(row[partCodeCol] || '').trim();
      if (!partCode) continue;

      processedCodes.add(partCode);
      const stock = parseFloat(row[stockCol]) || 0;

      const result = await pool.query(
        `UPDATE pa_items SET temsa_stock = ?, updated_at = CURRENT_TIMESTAMP
         WHERE package_id = ? AND part_code = ? RETURNING id`,
        [stock, packageId, partCode]
      );

      if (result.rows.length > 0) {
        updated++;
      } else {
        unmatched.push(partCode);
      }
    }

    // Full Sync
    const allItems = await pool.query('SELECT id, part_code FROM pa_items WHERE package_id = ?', [packageId]);
    let zeroed = 0;
    for (const item of allItems.rows) {
      if (!processedCodes.has(item.part_code)) {
        await pool.query(
          'UPDATE pa_items SET temsa_stock = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [item.id]
        );
        zeroed++;
      }
    }

    res.json({
      message: 'Stok import tamamlandı',
      report: {
        total_rows: rows.length,
        updated,
        unmatched_count: unmatched.length,
        unmatched_codes: unmatched.slice(0, 50),
        zeroed,
        processed_codes: processedCodes.size
      }
    });
  } catch (error) {
    console.error('Stok import hatası:', error);
    res.status(500).json({ error: 'Import hatası: ' + error.message });
  }
});

// ─── EXCEL IMPORT — FULL (Tüm alanlar tek seferde) ──────────────────────────────

router.post('/import/full', authenticateToken, authorizeRoles('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya gereklidir' });

    const packageId = req.body.package_id;
    if (!packageId) return res.status(400).json({ error: 'Paket seçilmelidir' });

    const mapping = JSON.parse(req.body.mapping || '{}');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    let updated = 0, inserted = 0, skipped = 0;

    for (const row of rows) {
      const partCode = String(row[mapping.part_code] || '').trim();
      if (!partCode) { skipped++; continue; }

      const data = {
        part_name: mapping.part_name ? String(row[mapping.part_name] || '').trim() || null : null,
        bom_quantity: mapping.bom_quantity ? (parseFloat(row[mapping.bom_quantity]) || 0) : undefined,
        unit_price: mapping.unit_price ? (parseFloat(row[mapping.unit_price]) || 0) : undefined,
        lead_time_days: mapping.lead_time_days ? (parseInt(row[mapping.lead_time_days]) || 0) : undefined,
        delivery_date: mapping.delivery_date ? String(row[mapping.delivery_date] || '').trim() || null : null,
        temsa_stock: mapping.temsa_stock ? (parseFloat(row[mapping.temsa_stock]) || 0) : undefined,
        supplier: mapping.supplier ? String(row[mapping.supplier] || '').trim() || null : null
      };

      const existing = await pool.query(
        'SELECT id FROM pa_items WHERE package_id = ? AND part_code = ?',
        [packageId, partCode]
      );

      if (existing.rows.length > 0) {
        // Build dynamic SET clause
        const sets = [];
        const vals = [];
        if (data.part_name !== null && data.part_name !== undefined) { sets.push('part_name = ?'); vals.push(data.part_name); }
        if (data.bom_quantity !== undefined) { sets.push('bom_quantity = ?'); vals.push(data.bom_quantity); }
        if (data.unit_price !== undefined) { sets.push('unit_price = ?'); vals.push(data.unit_price); }
        if (data.lead_time_days !== undefined) { sets.push('lead_time_days = ?'); vals.push(data.lead_time_days); }
        if (data.delivery_date !== undefined) { sets.push('delivery_date = ?'); vals.push(data.delivery_date); }
        if (data.temsa_stock !== undefined) { sets.push('temsa_stock = ?'); vals.push(data.temsa_stock); }
        if (data.supplier !== undefined) { sets.push('supplier = ?'); vals.push(data.supplier); }
        
        if (sets.length > 0) {
          sets.push('updated_at = CURRENT_TIMESTAMP');
          vals.push(existing.rows[0].id);
          await pool.query(`UPDATE pa_items SET ${sets.join(', ')} WHERE id = ?`, vals);
        }
        updated++;
      } else {
        await pool.query(
          `INSERT INTO pa_items (package_id, part_code, part_name, bom_quantity, unit_price, lead_time_days, delivery_date, temsa_stock, supplier)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [packageId, partCode, data.part_name, data.bom_quantity || 0, data.unit_price || 0, data.lead_time_days || 0, data.delivery_date, data.temsa_stock || 0, data.supplier]
        );
        inserted++;
      }
    }

    res.json({
      message: 'Full import tamamlandı',
      report: { total_rows: rows.length, updated, inserted, skipped }
    });
  } catch (error) {
    console.error('Full import hatası:', error);
    res.status(500).json({ error: 'Import hatası: ' + error.message });
  }
});

// ─── EXCEL PREVIEW (kolon isimleri al) ──────────────────────────────────────────

router.post('/import/preview', authenticateToken, authorizeRoles('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya gereklidir' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const preview = rows.slice(0, 5);

    res.json({ columns, preview, total_rows: rows.length, sheet_names: workbook.SheetNames });
  } catch (error) {
    console.error('Preview hatası:', error);
    res.status(500).json({ error: 'Preview hatası: ' + error.message });
  }
});

// ─── KOPYALA-YAPIŞTIR IMPORT (JSON tabanlı) ─────────────────────────────────────

router.post('/import/paste/:type', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { package_id, mapping, rows } = req.body;
    const importType = req.params.type;

    if (!package_id) return res.status(400).json({ error: 'Paket seçilmelidir' });
    if (!rows || !Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Veri bulunamadı' });

    const packageId = package_id;

    if (importType === 'bom') {
      const partCodeCol = mapping.part_code;
      const partNameCol = mapping.part_name;
      const bomQtyCol = mapping.bom_quantity;

      let updated = 0, inserted = 0, skipped = 0;
      const processedCodes = new Set();

      for (const row of rows) {
        const partCode = String(row[partCodeCol] || '').trim();
        if (!partCode) { skipped++; continue; }

        processedCodes.add(partCode);
        const partName = partNameCol ? (String(row[partNameCol] || '').trim() || null) : null;
        const bomQty = bomQtyCol ? (parseFloat(row[bomQtyCol]) || 0) : 0;

        const existing = await pool.query(
          'SELECT id FROM pa_items WHERE package_id = ? AND part_code = ?',
          [packageId, partCode]
        );

        if (existing.rows.length > 0) {
          await pool.query(
            `UPDATE pa_items SET part_name = COALESCE(?, part_name), bom_quantity = ?, updated_at = CURRENT_TIMESTAMP
             WHERE package_id = ? AND part_code = ?`,
            [partName, bomQty, packageId, partCode]
          );
          updated++;
        } else {
          await pool.query(
            `INSERT INTO pa_items (package_id, part_code, part_name, bom_quantity) VALUES (?, ?, ?, ?)`,
            [packageId, partCode, partName, bomQty]
          );
          inserted++;
        }
      }

      const allItems = await pool.query('SELECT id, part_code FROM pa_items WHERE package_id = ?', [packageId]);
      let zeroed = 0;
      for (const item of allItems.rows) {
        if (!processedCodes.has(item.part_code)) {
          await pool.query('UPDATE pa_items SET bom_quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.id]);
          zeroed++;
        }
      }

      return res.json({ message: 'BOM import tamamlandı', report: { total_rows: rows.length, updated, inserted, skipped, zeroed } });

    } else if (importType === 'cost') {
      const partCodeCol = mapping.part_code;
      const priceCol = mapping.unit_price;
      const supplierCol = mapping.supplier;

      let updated = 0;
      const unmatched = [];
      const processedCodes = new Set();

      for (const row of rows) {
        const partCode = String(row[partCodeCol] || '').trim();
        if (!partCode) continue;

        processedCodes.add(partCode);
        const price = parseFloat(row[priceCol]) || 0;
        const supplier = supplierCol ? (String(row[supplierCol] || '').trim() || null) : undefined;

        let sql, params;
        if (supplier !== undefined) {
          sql = `UPDATE pa_items SET unit_price = ?, supplier = ?, updated_at = CURRENT_TIMESTAMP WHERE package_id = ? AND part_code = ? RETURNING id`;
          params = [price, supplier, packageId, partCode];
        } else {
          sql = `UPDATE pa_items SET unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE package_id = ? AND part_code = ? RETURNING id`;
          params = [price, packageId, partCode];
        }

        const result = await pool.query(sql, params);
        if (result.rows.length > 0) updated++;
        else unmatched.push(partCode);
      }

      const allItems = await pool.query('SELECT id, part_code FROM pa_items WHERE package_id = ?', [packageId]);
      let zeroed = 0;
      for (const item of allItems.rows) {
        if (!processedCodes.has(item.part_code)) {
          await pool.query('UPDATE pa_items SET unit_price = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.id]);
          zeroed++;
        }
      }

      return res.json({ message: 'Maliyet import tamamlandı', report: { total_rows: rows.length, updated, zeroed, unmatched_count: unmatched.length, unmatched_codes: unmatched.slice(0, 50) } });

    } else if (importType === 'leadtime') {
      const partCodeCol = mapping.part_code;
      const ltCol = mapping.lead_time_days;

      let updated = 0;
      const unmatched = [];
      const processedCodes = new Set();

      for (const row of rows) {
        const partCode = String(row[partCodeCol] || '').trim();
        if (!partCode) continue;

        processedCodes.add(partCode);
        const lt = parseInt(row[ltCol]) || 0;

        const result = await pool.query(
          `UPDATE pa_items SET lead_time_days = ?, updated_at = CURRENT_TIMESTAMP WHERE package_id = ? AND part_code = ? RETURNING id`,
          [lt, packageId, partCode]
        );
        if (result.rows.length > 0) updated++;
        else unmatched.push(partCode);
      }

      const allItems = await pool.query('SELECT id, part_code FROM pa_items WHERE package_id = ?', [packageId]);
      let zeroed = 0;
      for (const item of allItems.rows) {
        if (!processedCodes.has(item.part_code)) {
          await pool.query('UPDATE pa_items SET lead_time_days = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.id]);
          zeroed++;
        }
      }

      return res.json({ message: 'Lead time import tamamlandı', report: { total_rows: rows.length, updated, zeroed, unmatched_count: unmatched.length, unmatched_codes: unmatched.slice(0, 50) } });

    } else if (importType === 'stock') {
      const partCodeCol = mapping.part_code;
      const stockCol = mapping.temsa_stock;

      let updated = 0;
      const unmatched = [];
      const processedCodes = new Set();

      for (const row of rows) {
        const partCode = String(row[partCodeCol] || '').trim();
        if (!partCode) continue;

        processedCodes.add(partCode);
        const stock = parseFloat(row[stockCol]) || 0;

        const result = await pool.query(
          `UPDATE pa_items SET temsa_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE package_id = ? AND part_code = ? RETURNING id`,
          [stock, packageId, partCode]
        );
        if (result.rows.length > 0) updated++;
        else unmatched.push(partCode);
      }

      const allItems = await pool.query('SELECT id, part_code FROM pa_items WHERE package_id = ?', [packageId]);
      let zeroed = 0;
      for (const item of allItems.rows) {
        if (!processedCodes.has(item.part_code)) {
          await pool.query('UPDATE pa_items SET temsa_stock = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.id]);
          zeroed++;
        }
      }

      return res.json({ message: 'Stok import tamamlandı', report: { total_rows: rows.length, updated, zeroed, unmatched_count: unmatched.length, unmatched_codes: unmatched.slice(0, 50) } });

    } else if (importType === 'full') {
      let updated = 0, inserted = 0, skipped = 0;

      for (const row of rows) {
        const partCode = String(row[mapping.part_code] || '').trim();
        if (!partCode) { skipped++; continue; }

        const data = {
          part_name: mapping.part_name ? String(row[mapping.part_name] || '').trim() || null : null,
          bom_quantity: mapping.bom_quantity ? (parseFloat(row[mapping.bom_quantity]) || 0) : undefined,
          unit_price: mapping.unit_price ? (parseFloat(row[mapping.unit_price]) || 0) : undefined,
          lead_time_days: mapping.lead_time_days ? (parseInt(row[mapping.lead_time_days]) || 0) : undefined,
          delivery_date: mapping.delivery_date ? String(row[mapping.delivery_date] || '').trim() || null : null,
          temsa_stock: mapping.temsa_stock ? (parseFloat(row[mapping.temsa_stock]) || 0) : undefined,
          supplier: mapping.supplier ? String(row[mapping.supplier] || '').trim() || null : null
        };

        const existing = await pool.query(
          'SELECT id FROM pa_items WHERE package_id = ? AND part_code = ?',
          [packageId, partCode]
        );

        if (existing.rows.length > 0) {
          const sets = [];
          const vals = [];
          if (data.part_name !== null && data.part_name !== undefined) { sets.push('part_name = ?'); vals.push(data.part_name); }
          if (data.bom_quantity !== undefined) { sets.push('bom_quantity = ?'); vals.push(data.bom_quantity); }
          if (data.unit_price !== undefined) { sets.push('unit_price = ?'); vals.push(data.unit_price); }
          if (data.lead_time_days !== undefined) { sets.push('lead_time_days = ?'); vals.push(data.lead_time_days); }
          if (data.delivery_date !== undefined) { sets.push('delivery_date = ?'); vals.push(data.delivery_date); }
          if (data.temsa_stock !== undefined) { sets.push('temsa_stock = ?'); vals.push(data.temsa_stock); }
          if (data.supplier !== undefined) { sets.push('supplier = ?'); vals.push(data.supplier); }

          if (sets.length > 0) {
            sets.push('updated_at = CURRENT_TIMESTAMP');
            vals.push(existing.rows[0].id);
            await pool.query(`UPDATE pa_items SET ${sets.join(', ')} WHERE id = ?`, vals);
          }
          updated++;
        } else {
          await pool.query(
            `INSERT INTO pa_items (package_id, part_code, part_name, bom_quantity, unit_price, lead_time_days, delivery_date, temsa_stock, supplier)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [packageId, partCode, data.part_name, data.bom_quantity || 0, data.unit_price || 0, data.lead_time_days || 0, data.delivery_date, data.temsa_stock || 0, data.supplier]
          );
          inserted++;
        }
      }

      return res.json({ message: 'Full import tamamlandı', report: { total_rows: rows.length, updated, inserted, skipped } });

    } else {
      return res.status(400).json({ error: 'Geçersiz import türü' });
    }
  } catch (error) {
    console.error('Paste import hatası:', error);
    res.status(500).json({ error: 'Import hatası: ' + error.message });
  }
});

// ─── EXPORT ─────────────────────────────────────────────────────────────────────

// Eksik kalemler export
router.get('/packages/:id/export/missing', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const packageCount = parseInt(req.query.count) || 1;
    const items = await pool.query('SELECT * FROM pa_items WHERE package_id = ? ORDER BY part_code', [req.params.id]);
    const pkg = await pool.query('SELECT * FROM pa_packages WHERE id = ?', [req.params.id]);

    const currSymbols = { EUR: '€', USD: '$', TL: '₺', GBP: '£' };
    const timeLabelsMap = { gun: 'gün', hafta: 'hafta', ay: 'ay' };
    const cs = currSymbols[pkg.rows[0]?.currency] || '€';
    const tl = timeLabelsMap[pkg.rows[0]?.time_unit] || 'gün';

    const missing = items.rows.map(item => {
      const totalNeed = (item.bom_quantity || 0) * packageCount;
      const miss = Math.max(totalNeed - (item.temsa_stock || 0), 0);
      return { ...item, total_need: totalNeed, missing_quantity: miss, missing_cost: miss * (item.unit_price || 0) };
    }).filter(i => i.missing_quantity > 0);

    const ws = XLSX.utils.json_to_sheet(missing.map(m => ({
      'Parça Kodu': m.part_code,
      'Parça Adı': m.part_name || '',
      'BOM Adedi': m.bom_quantity,
      'Toplam İhtiyaç': m.total_need,
      'TEMSA Stok': m.temsa_stock,
      'Eksik Adet': m.missing_quantity,
      [`Birim Fiyat (${cs})`]: m.unit_price,
      [`Eksik Maliyet (${cs})`]: m.missing_cost,
      [`Lead Time (${tl})`]: m.lead_time_days,
      'Tedarikçi': m.supplier || ''
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Eksik Kalemler');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Eksik_Kalemler_${pkg.rows[0]?.name || 'paket'}_${packageCount}adet.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Export hatası:', error);
    res.status(500).json({ error: 'Export hatası' });
  }
});

// Kritik kalemler export
router.get('/packages/:id/export/critical', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const packageCount = parseInt(req.query.count) || 1;
    const items = await pool.query('SELECT * FROM pa_items WHERE package_id = ? ORDER BY lead_time_days DESC', [req.params.id]);
    const pkg = await pool.query('SELECT * FROM pa_packages WHERE id = ?', [req.params.id]);

    const currSymbols = { EUR: '€', USD: '$', TL: '₺', GBP: '£' };
    const timeLabelsMap = { gun: 'gün', hafta: 'hafta', ay: 'ay' };
    const cs = currSymbols[pkg.rows[0]?.currency] || '€';
    const tl = timeLabelsMap[pkg.rows[0]?.time_unit] || 'gün';

    const critical = items.rows.map(item => {
      const totalNeed = (item.bom_quantity || 0) * packageCount;
      const miss = Math.max(totalNeed - (item.temsa_stock || 0), 0);
      return { ...item, total_need: totalNeed, missing_quantity: miss, missing_cost: miss * (item.unit_price || 0) };
    }).filter(i => i.missing_quantity > 0 && (i.lead_time_days || 0) > 0);

    const ws = XLSX.utils.json_to_sheet(critical.map(m => ({
      'Parça Kodu': m.part_code,
      'Parça Adı': m.part_name || '',
      [`Lead Time (${tl})`]: m.lead_time_days,
      'Eksik Adet': m.missing_quantity,
      [`Eksik Maliyet (${cs})`]: m.missing_cost,
      'Tedarikçi': m.supplier || '',
      'Teslimat Tarihi': m.delivery_date || ''
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kritik Kalemler');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Kritik_Kalemler_${pkg.rows[0]?.name || 'paket'}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Export hatası:', error);
    res.status(500).json({ error: 'Export hatası' });
  }
});

// Senaryo raporu export
router.get('/packages/:id/export/scenarios', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const items = await pool.query('SELECT * FROM pa_items WHERE package_id = ? ORDER BY part_code', [req.params.id]);
    const pkg = await pool.query('SELECT * FROM pa_packages WHERE id = ?', [req.params.id]);

    const currSymbols = { EUR: '€', USD: '$', TL: '₺', GBP: '£' };
    const timeLabelsMap = { gun: 'gün', hafta: 'hafta', ay: 'ay' };
    const cs = currSymbols[pkg.rows[0]?.currency] || '€';
    const tl = timeLabelsMap[pkg.rows[0]?.time_unit] || 'gün';

    const counts = [1, 5, 10, 20, 50];
    const rows = items.rows.map(item => {
      const row = {
        'Parça Kodu': item.part_code,
        'Parça Adı': item.part_name || '',
        'BOM Adedi': item.bom_quantity,
        'TEMSA Stok': item.temsa_stock,
        [`Birim Fiyat (${cs})`]: item.unit_price
      };
      counts.forEach(c => {
        const need = (item.bom_quantity || 0) * c;
        const miss = Math.max(need - (item.temsa_stock || 0), 0);
        row[`${c} Paket İhtiyaç`] = need;
        row[`${c} Paket Eksik`] = miss;
        row[`${c} Paket Maliyet (${cs})`] = miss * (item.unit_price || 0);
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Senaryo Analizi');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Senaryo_Raporu_${pkg.rows[0]?.name || 'paket'}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Export hatası:', error);
    res.status(500).json({ error: 'Export hatası' });
  }
});

// ─── DETAY EXCEL RAPOR ──────────────────────────────────────────────────────────

router.get('/packages/:id/export/detail-excel', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const packageCount = parseInt(req.query.count) || 1;
    const items = await pool.query('SELECT * FROM pa_items WHERE package_id = ? ORDER BY part_code', [req.params.id]);
    const pkg = await pool.query('SELECT * FROM pa_packages WHERE id = ?', [req.params.id]);
    if (pkg.rows.length === 0) return res.status(404).json({ error: 'Paket bulunamadı' });

    const pkgData = pkg.rows[0];
    const currSymbols = { EUR: '€', USD: '$', TL: '₺', GBP: '£' };
    const timeLabelsMap = { gun: 'Gün', hafta: 'Hafta', ay: 'Ay' };
    const cs = currSymbols[pkgData.currency] || '€';
    const tl = timeLabelsMap[pkgData.time_unit] || 'Gün';

    const analysis = items.rows.map(item => {
      const totalNeed = (item.bom_quantity || 0) * packageCount;
      const stock = item.temsa_stock || 0;
      const missing = Math.max(totalNeed - stock, 0);
      const missingCost = missing * (item.unit_price || 0);
      return { ...item, total_need: totalNeed, missing_quantity: missing, missing_cost: missingCost };
    });

    const totalItems = analysis.length;
    const missingItems = analysis.filter(a => a.missing_quantity > 0);
    const totalMissingCost = analysis.reduce((s, a) => s + a.missing_cost, 0);
    const totalBomCost = analysis.reduce((s, a) => s + ((a.bom_quantity || 0) * packageCount * (a.unit_price || 0)), 0);
    const avgLeadTime = totalItems > 0 ? analysis.reduce((s, a) => s + (a.lead_time_days || 0), 0) / totalItems : 0;
    const maxLeadTime = Math.max(...analysis.map(a => a.lead_time_days || 0), 0);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Özet
    const summaryData = [
      ['PAKET ANALİZ DETAY RAPORU', '', '', ''],
      ['', '', '', ''],
      ['Paket Bilgileri', '', '', ''],
      ['Paket Adı', pkgData.name, '', ''],
      ['Paket Kodu', pkgData.code || '-', '', ''],
      ['Açıklama', pkgData.description || '-', '', ''],
      ['Para Birimi', `${pkgData.currency || 'EUR'} (${cs})`, '', ''],
      ['Süre Birimi', tl, '', ''],
      ['Üretim Adedi', packageCount, '', ''],
      ['Rapor Tarihi', new Date().toLocaleDateString('tr-TR'), '', ''],
      ['', '', '', ''],
      ['Analiz Sonuçları', '', '', ''],
      ['Toplam Kalem Sayısı', totalItems, '', ''],
      ['Eksik Kalem Sayısı', missingItems.length, '', ''],
      ['Tam Kalem Sayısı', totalItems - missingItems.length, '', ''],
      ['Eksiklik Oranı', `%${totalItems > 0 ? ((missingItems.length / totalItems) * 100).toFixed(1) : 0}`, '', ''],
      ['', '', '', ''],
      ['Maliyet Özeti', '', '', ''],
      [`Toplam BOM Maliyeti (${cs})`, totalBomCost.toFixed(2), '', ''],
      [`Toplam Eksik Maliyet (${cs})`, totalMissingCost.toFixed(2), '', ''],
      [`Mevcut Stok Değeri (${cs})`, (totalBomCost - totalMissingCost).toFixed(2), '', ''],
      ['', '', '', ''],
      ['Lead Time Özeti', '', '', ''],
      [`Ortalama Lead Time (${tl})`, avgLeadTime.toFixed(1), '', ''],
      [`Maksimum Lead Time (${tl})`, maxLeadTime, '', ''],
      [`30+ ${tl} Lead Time Kalem Sayısı`, analysis.filter(a => (a.lead_time_days || 0) >= 30).length, '', ''],
      ['', '', '', ''],
      ['Tedarikçi Dağılımı', '', '', ''],
    ];

    // Tedarikçi bazlı grupla
    const supplierGroups = {};
    analysis.forEach(item => {
      const sup = item.supplier || 'Belirtilmemiş';
      if (!supplierGroups[sup]) supplierGroups[sup] = { count: 0, cost: 0, missingCost: 0 };
      supplierGroups[sup].count++;
      supplierGroups[sup].cost += (item.bom_quantity || 0) * packageCount * (item.unit_price || 0);
      supplierGroups[sup].missingCost += item.missing_cost;
    });
    Object.entries(supplierGroups).sort((a, b) => b[1].missingCost - a[1].missingCost).forEach(([sup, data]) => {
      summaryData.push([sup, `${data.count} kalem`, `Eksik: ${data.missingCost.toFixed(2)} ${cs}`, `Toplam: ${data.cost.toFixed(2)} ${cs}`]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Özet');

    // Sheet 2: Tüm Kalemler
    const allItemsSheet = analysis.map(m => ({
      'Parça Kodu': m.part_code,
      'Parça Adı': m.part_name || '',
      'BOM Adedi': m.bom_quantity,
      [`Toplam İhtiyaç (${packageCount} adet)`]: m.total_need,
      'TEMSA Stok': m.temsa_stock,
      'Eksik Adet': m.missing_quantity,
      [`Birim Fiyat (${cs})`]: m.unit_price,
      [`BOM Maliyet (${cs})`]: (m.bom_quantity || 0) * packageCount * (m.unit_price || 0),
      [`Eksik Maliyet (${cs})`]: m.missing_cost,
      [`Lead Time (${tl})`]: m.lead_time_days || 0,
      'Teslimat Tarihi': m.delivery_date || '',
      'Tedarikçi': m.supplier || '',
      'Durum': m.missing_quantity > 0 ? 'EKSİK' : 'TAM'
    }));
    const ws2 = XLSX.utils.json_to_sheet(allItemsSheet);
    ws2['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Tüm Kalemler');

    // Sheet 3: Eksik Kalemler
    const missingSheet = missingItems.sort((a, b) => b.missing_cost - a.missing_cost).map(m => ({
      'Parça Kodu': m.part_code,
      'Parça Adı': m.part_name || '',
      'İhtiyaç': m.total_need,
      'Stok': m.temsa_stock,
      'Eksik Adet': m.missing_quantity,
      [`Birim Fiyat (${cs})`]: m.unit_price,
      [`Eksik Maliyet (${cs})`]: m.missing_cost,
      [`Lead Time (${tl})`]: m.lead_time_days || 0,
      'Tedarikçi': m.supplier || ''
    }));
    const ws3 = XLSX.utils.json_to_sheet(missingSheet);
    ws3['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Eksik Kalemler');

    // Sheet 4: Tedarikçi Bazlı
    const supplierSheet = [];
    Object.entries(supplierGroups).sort((a, b) => b[1].missingCost - a[1].missingCost).forEach(([sup, data]) => {
      const supItems = analysis.filter(i => (i.supplier || 'Belirtilmemiş') === sup);
      supItems.filter(i => i.missing_quantity > 0).forEach(item => {
        supplierSheet.push({
          'Tedarikçi': sup,
          'Parça Kodu': item.part_code,
          'Parça Adı': item.part_name || '',
          'Eksik Adet': item.missing_quantity,
          [`Birim Fiyat (${cs})`]: item.unit_price,
          [`Eksik Maliyet (${cs})`]: item.missing_cost,
          [`Lead Time (${tl})`]: item.lead_time_days || 0
        });
      });
    });
    const ws4 = XLSX.utils.json_to_sheet(supplierSheet.length > 0 ? supplierSheet : [{ 'Bilgi': 'Eksik kalem yok' }]);
    ws4['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Tedarikçi Bazlı');

    // Sheet 5: Senaryo Karşılaştırma
    const scenarioCounts = [1, 5, 10, 20, 50];
    const scenarioSheet = items.rows.map(item => {
      const row = {
        'Parça Kodu': item.part_code,
        'Parça Adı': item.part_name || '',
        'BOM Adedi': item.bom_quantity,
        'Stok': item.temsa_stock,
        [`Birim Fiyat (${cs})`]: item.unit_price
      };
      scenarioCounts.forEach(c => {
        const need = (item.bom_quantity || 0) * c;
        const miss = Math.max(need - (item.temsa_stock || 0), 0);
        row[`${c}x Eksik`] = miss;
        row[`${c}x Maliyet (${cs})`] = (miss * (item.unit_price || 0)).toFixed(2);
      });
      return row;
    });

    // Add totals row
    const totalsRow = { 'Parça Kodu': 'TOPLAM', 'Parça Adı': '', 'BOM Adedi': '', 'Stok': '', [`Birim Fiyat (${cs})`]: '' };
    scenarioCounts.forEach(c => {
      let totalMiss = 0, totalCost = 0;
      items.rows.forEach(item => {
        const need = (item.bom_quantity || 0) * c;
        const miss = Math.max(need - (item.temsa_stock || 0), 0);
        totalMiss += miss;
        totalCost += miss * (item.unit_price || 0);
      });
      totalsRow[`${c}x Eksik`] = totalMiss;
      totalsRow[`${c}x Maliyet (${cs})`] = totalCost.toFixed(2);
    });
    scenarioSheet.push(totalsRow);

    const ws5 = XLSX.utils.json_to_sheet(scenarioSheet);
    XLSX.utils.book_append_sheet(wb, ws5, 'Senaryo Karşılaştırma');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Detay_Rapor_${pkgData.name}_${packageCount}adet.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Detay Excel export hatası:', error);
    res.status(500).json({ error: 'Export hatası' });
  }
});

// ─── DETAY WORD RAPOR ───────────────────────────────────────────────────────────

router.get('/packages/:id/export/detail-word', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const packageCount = parseInt(req.query.count) || 1;
    const items = await pool.query('SELECT * FROM pa_items WHERE package_id = ? ORDER BY part_code', [req.params.id]);
    const pkg = await pool.query('SELECT * FROM pa_packages WHERE id = ?', [req.params.id]);
    if (pkg.rows.length === 0) return res.status(404).json({ error: 'Paket bulunamadı' });

    const pkgData = pkg.rows[0];
    const currSymbols = { EUR: '€', USD: '$', TL: '₺', GBP: '£' };
    const timeLabelsMap = { gun: 'Gün', hafta: 'Hafta', ay: 'Ay' };
    const cs = currSymbols[pkgData.currency] || '€';
    const tl = timeLabelsMap[pkgData.time_unit] || 'Gün';
    const fmt = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

    const analysis = items.rows.map(item => {
      const totalNeed = (item.bom_quantity || 0) * packageCount;
      const stock = item.temsa_stock || 0;
      const missing = Math.max(totalNeed - stock, 0);
      const missingCost = missing * (item.unit_price || 0);
      return { ...item, total_need: totalNeed, missing_quantity: missing, missing_cost: missingCost };
    });

    const totalItems = analysis.length;
    const missingItems = analysis.filter(a => a.missing_quantity > 0);
    const totalMissingCost = analysis.reduce((s, a) => s + a.missing_cost, 0);
    const totalBomCost = analysis.reduce((s, a) => s + ((a.bom_quantity || 0) * packageCount * (a.unit_price || 0)), 0);
    const avgLeadTime = totalItems > 0 ? analysis.reduce((s, a) => s + (a.lead_time_days || 0), 0) / totalItems : 0;
    const maxLeadTime = Math.max(...analysis.map(a => a.lead_time_days || 0), 0);

    // Tedarikçi grupları
    const supplierGroups = {};
    analysis.forEach(item => {
      const sup = item.supplier || 'Belirtilmemiş';
      if (!supplierGroups[sup]) supplierGroups[sup] = { count: 0, missingCount: 0, cost: 0, missingCost: 0 };
      supplierGroups[sup].count++;
      if (item.missing_quantity > 0) supplierGroups[sup].missingCount++;
      supplierGroups[sup].cost += (item.bom_quantity || 0) * packageCount * (item.unit_price || 0);
      supplierGroups[sup].missingCost += item.missing_cost;
    });

    // Senaryolar
    const scenarioCounts = [1, 5, 10, 20, 50];
    const scenarios = scenarioCounts.map(count => {
      let cost = 0, missingCount = 0;
      items.rows.forEach(item => {
        const need = (item.bom_quantity || 0) * count;
        const miss = Math.max(need - (item.temsa_stock || 0), 0);
        cost += miss * (item.unit_price || 0);
        if (miss > 0) missingCount++;
      });
      return { count, total_missing_cost: cost, missing_count: missingCount };
    });

    const top5Costly = [...analysis].filter(a => a.missing_quantity > 0).sort((a, b) => b.missing_cost - a.missing_cost).slice(0, 10);
    const top5Critical = [...analysis].filter(a => a.missing_quantity > 0).sort((a, b) => (b.lead_time_days || 0) - (a.lead_time_days || 0)).slice(0, 10);

    const dateStr = new Date().toLocaleDateString('tr-TR');
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Generate HTML-based Word document
    const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Paket Analiz Detay Raporu</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #333; line-height: 1.4; }
  h1 { color: #1e40af; font-size: 22pt; text-align: center; margin-bottom: 5pt; border-bottom: 3px solid #1e40af; padding-bottom: 10pt; }
  h2 { color: #1e40af; font-size: 14pt; margin-top: 20pt; margin-bottom: 8pt; border-bottom: 1px solid #93c5fd; padding-bottom: 4pt; }
  h3 { color: #374151; font-size: 12pt; margin-top: 14pt; margin-bottom: 6pt; }
  .subtitle { text-align: center; color: #6b7280; font-size: 10pt; margin-bottom: 20pt; }
  .info-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4pt; padding: 10pt; margin: 10pt 0; }
  .warning-box { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 4pt; padding: 10pt; margin: 10pt 0; }
  .danger-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 4pt; padding: 10pt; margin: 10pt 0; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9pt; }
  th { background: #1e40af; color: white; padding: 6pt 8pt; text-align: left; font-weight: bold; }
  td { padding: 5pt 8pt; border: 1px solid #e5e7eb; }
  tr:nth-child(even) { background: #f9fafb; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .text-red { color: #dc2626; font-weight: bold; }
  .text-green { color: #16a34a; font-weight: bold; }
  .text-orange { color: #ea580c; font-weight: bold; }
  .text-blue { color: #2563eb; font-weight: bold; }
  .highlight-row { background: #fef2f2 !important; }
  .metric-grid { display: flex; flex-wrap: wrap; gap: 10pt; margin: 10pt 0; }
  .metric-box { border: 2px solid #e5e7eb; border-radius: 6pt; padding: 10pt 15pt; text-align: center; min-width: 120pt; }
  .metric-box .value { font-size: 18pt; font-weight: bold; }
  .metric-box .label { font-size: 8pt; color: #6b7280; }
  .page-break { page-break-before: always; }
  .footer { text-align: center; color: #9ca3af; font-size: 8pt; margin-top: 30pt; border-top: 1px solid #e5e7eb; padding-top: 5pt; }
</style>
</head>
<body>

<h1>📦 PAKET ANALİZ DETAY RAPORU</h1>
<div class="subtitle">
  <strong>${pkgData.name}</strong> ${pkgData.code ? `(${pkgData.code})` : ''} — ${packageCount} Paket Üretimi İçin Analiz<br/>
  Rapor Tarihi: ${dateStr} ${timeStr} | Para Birimi: ${pkgData.currency || 'EUR'} (${cs}) | Süre Birimi: ${tl}
</div>

<h2>📋 1. PAKET BİLGİLERİ</h2>
<div class="info-box">
  <table style="border: none;">
    <tr><td style="border: none; width: 150pt; font-weight: bold;">Paket Adı:</td><td style="border: none;">${pkgData.name}</td></tr>
    <tr><td style="border: none; font-weight: bold;">Paket Kodu:</td><td style="border: none;">${pkgData.code || '-'}</td></tr>
    <tr><td style="border: none; font-weight: bold;">Açıklama:</td><td style="border: none;">${pkgData.description || '-'}</td></tr>
    <tr><td style="border: none; font-weight: bold;">Üretim Adedi:</td><td style="border: none;">${packageCount} adet</td></tr>
    <tr><td style="border: none; font-weight: bold;">Para Birimi:</td><td style="border: none;">${pkgData.currency || 'EUR'} (${cs})</td></tr>
    <tr><td style="border: none; font-weight: bold;">Süre Birimi:</td><td style="border: none;">${tl}</td></tr>
  </table>
</div>

<h2>📊 2. GENEL ÖZET</h2>

<table>
  <tr><th style="width: 60%;">Metrik</th><th style="width: 40%;" class="text-right">Değer</th></tr>
  <tr><td>Toplam Kalem Sayısı</td><td class="text-right text-blue">${totalItems}</td></tr>
  <tr><td>Eksik Kalem Sayısı</td><td class="text-right text-red">${missingItems.length}</td></tr>
  <tr><td>Tam Kalem Sayısı</td><td class="text-right text-green">${totalItems - missingItems.length}</td></tr>
  <tr><td>Eksiklik Oranı</td><td class="text-right text-orange">%${totalItems > 0 ? ((missingItems.length / totalItems) * 100).toFixed(1) : 0}</td></tr>
  <tr><td>Toplam BOM Maliyeti</td><td class="text-right">${fmt(totalBomCost)} ${cs}</td></tr>
  <tr><td>Toplam Eksik Maliyet</td><td class="text-right text-red">${fmt(totalMissingCost)} ${cs}</td></tr>
  <tr><td>Mevcut Stok Değeri</td><td class="text-right text-green">${fmt(totalBomCost - totalMissingCost)} ${cs}</td></tr>
  <tr><td>Ortalama Lead Time</td><td class="text-right">${avgLeadTime.toFixed(1)} ${tl}</td></tr>
  <tr><td>Maksimum Lead Time</td><td class="text-right text-orange">${maxLeadTime} ${tl}</td></tr>
  <tr><td>30+ ${tl} Lead Time Kalem</td><td class="text-right">${analysis.filter(a => (a.lead_time_days || 0) >= 30).length}</td></tr>
</table>

${missingItems.length > 0 ? `
<div class="danger-box">
  <strong>⚠️ DİKKAT:</strong> ${packageCount} adet üretim için ${missingItems.length} kalemde eksiklik tespit edilmiştir. 
  Toplam eksik maliyet: <strong>${fmt(totalMissingCost)} ${cs}</strong>
</div>
` : `
<div class="info-box">
  <strong>✅ HAZIR:</strong> Tüm kalemler ${packageCount} adet üretim için yeterli stoğa sahiptir.
</div>
`}

<h2>📈 3. SENARYO ANALİZİ</h2>
<p>Farklı üretim adetleri için maliyet karşılaştırması:</p>
<table>
  <tr>
    <th>Üretim Adedi</th>
    <th class="text-right">Eksik Kalem</th>
    <th class="text-right">Toplam Eksik Maliyet (${cs})</th>
    <th class="text-center">Mevcut Seçim</th>
  </tr>
  ${scenarios.map(sc => `
  <tr ${sc.count == packageCount ? 'style="background: #dbeafe; font-weight: bold;"' : ''}>
    <td>${sc.count} Paket</td>
    <td class="text-right">${sc.missing_count}</td>
    <td class="text-right">${fmt(sc.total_missing_cost)} ${cs}</td>
    <td class="text-center">${sc.count == packageCount ? '◀ SEÇİLİ' : ''}</td>
  </tr>`).join('')}
</table>

${top5Costly.length > 0 ? `
<h2 class="page-break">💰 4. EN MALİYETLİ EKSİK KALEMLER (İlk 10)</h2>
<p>Eksik maliyete göre sıralanmış en kritik kalemler:</p>
<table>
  <tr>
    <th>#</th>
    <th>Parça Kodu</th>
    <th>Parça Adı</th>
    <th class="text-right">Eksik Adet</th>
    <th class="text-right">Birim Fiyat (${cs})</th>
    <th class="text-right">Eksik Maliyet (${cs})</th>
    <th>Tedarikçi</th>
  </tr>
  ${top5Costly.map((item, i) => `
  <tr class="highlight-row">
    <td class="text-center">${i + 1}</td>
    <td><strong>${item.part_code}</strong></td>
    <td>${item.part_name || '-'}</td>
    <td class="text-right text-red">${fmt(item.missing_quantity)}</td>
    <td class="text-right">${fmt(item.unit_price)}</td>
    <td class="text-right text-red">${fmt(item.missing_cost)}</td>
    <td>${item.supplier || '-'}</td>
  </tr>`).join('')}
</table>
` : ''}

${top5Critical.length > 0 ? `
<h2>⏱️ 5. EN UZUN LEAD TIME KALEMLER (İlk 10)</h2>
<p>Lead time'a göre sıralanmış eksik kalemler:</p>
<table>
  <tr>
    <th>#</th>
    <th>Parça Kodu</th>
    <th>Parça Adı</th>
    <th class="text-right">Lead Time (${tl})</th>
    <th class="text-right">Eksik Adet</th>
    <th class="text-right">Eksik Maliyet (${cs})</th>
    <th>Tedarikçi</th>
  </tr>
  ${top5Critical.map((item, i) => `
  <tr>
    <td class="text-center">${i + 1}</td>
    <td><strong>${item.part_code}</strong></td>
    <td>${item.part_name || '-'}</td>
    <td class="text-right text-orange">${item.lead_time_days || 0} ${tl}</td>
    <td class="text-right">${fmt(item.missing_quantity)}</td>
    <td class="text-right">${fmt(item.missing_cost)}</td>
    <td>${item.supplier || '-'}</td>
  </tr>`).join('')}
</table>
` : ''}

<h2>🏭 6. TEDARİKÇİ BAZLI ANALİZ</h2>
<table>
  <tr>
    <th>Tedarikçi</th>
    <th class="text-right">Toplam Kalem</th>
    <th class="text-right">Eksik Kalem</th>
    <th class="text-right">Toplam Maliyet (${cs})</th>
    <th class="text-right">Eksik Maliyet (${cs})</th>
  </tr>
  ${Object.entries(supplierGroups).sort((a, b) => b[1].missingCost - a[1].missingCost).map(([sup, data]) => `
  <tr>
    <td><strong>${sup}</strong></td>
    <td class="text-right">${data.count}</td>
    <td class="text-right ${data.missingCount > 0 ? 'text-red' : 'text-green'}">${data.missingCount}</td>
    <td class="text-right">${fmt(data.cost)}</td>
    <td class="text-right ${data.missingCost > 0 ? 'text-red' : ''}">${fmt(data.missingCost)}</td>
  </tr>`).join('')}
</table>

<h2 class="page-break">📋 7. TÜM KALEMLER DETAY TABLOSU</h2>
<table>
  <tr>
    <th>Parça Kodu</th>
    <th>Parça Adı</th>
    <th class="text-right">BOM</th>
    <th class="text-right">İhtiyaç</th>
    <th class="text-right">Stok</th>
    <th class="text-right">Eksik</th>
    <th class="text-right">Fiyat (${cs})</th>
    <th class="text-right">Eksik Maliyet (${cs})</th>
    <th class="text-right">LT (${tl})</th>
    <th>Tedarikçi</th>
  </tr>
  ${analysis.map(item => `
  <tr ${item.missing_quantity > 0 ? 'class="highlight-row"' : ''}>
    <td><strong>${item.part_code}</strong></td>
    <td>${item.part_name || '-'}</td>
    <td class="text-right">${fmt(item.bom_quantity)}</td>
    <td class="text-right">${fmt(item.total_need)}</td>
    <td class="text-right">${fmt(item.temsa_stock)}</td>
    <td class="text-right ${item.missing_quantity > 0 ? 'text-red' : 'text-green'}">${fmt(item.missing_quantity)}</td>
    <td class="text-right">${fmt(item.unit_price)}</td>
    <td class="text-right ${item.missing_cost > 0 ? 'text-red' : ''}">${fmt(item.missing_cost)}</td>
    <td class="text-right">${item.lead_time_days || 0}</td>
    <td>${item.supplier || '-'}</td>
  </tr>`).join('')}
  <tr style="background: #1e40af; color: white; font-weight: bold;">
    <td colspan="2">TOPLAM</td>
    <td class="text-right">${fmt(analysis.reduce((s, a) => s + (a.bom_quantity || 0), 0))}</td>
    <td class="text-right">${fmt(analysis.reduce((s, a) => s + a.total_need, 0))}</td>
    <td class="text-right">${fmt(analysis.reduce((s, a) => s + (a.temsa_stock || 0), 0))}</td>
    <td class="text-right">${fmt(analysis.reduce((s, a) => s + a.missing_quantity, 0))}</td>
    <td class="text-right">-</td>
    <td class="text-right">${fmt(totalMissingCost)}</td>
    <td class="text-right">-</td>
    <td>-</td>
  </tr>
</table>

<div class="footer">
  E-LAB Süreç Kontrol — Paket Analiz Detay Raporu — ${dateStr} ${timeStr}<br/>
  Bu rapor otomatik olarak oluşturulmuştur.
</div>

</body>
</html>`;

    const buffer = Buffer.from(html, 'utf-8');
    res.setHeader('Content-Type', 'application/msword');
    res.setHeader('Content-Disposition', `attachment; filename=Detay_Rapor_${pkgData.name}_${packageCount}adet.doc`);
    res.send(buffer);
  } catch (error) {
    console.error('Detay Word export hatası:', error);
    res.status(500).json({ error: 'Export hatası' });
  }
});

export default router;
