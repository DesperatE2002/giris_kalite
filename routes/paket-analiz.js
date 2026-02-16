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
    const { name, code, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Paket adı gereklidir' });

    const result = await pool.query(
      `INSERT INTO pa_packages (name, code, description) VALUES (?, ?, ?) RETURNING *`,
      [name, code || null, description || null]
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
    const { name, code, description } = req.body;
    const result = await pool.query(
      `UPDATE pa_packages SET name = ?, code = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? RETURNING *`,
      [name, code || null, description || null, req.params.id]
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

// ─── EXPORT ─────────────────────────────────────────────────────────────────────

// Eksik kalemler export
router.get('/packages/:id/export/missing', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const packageCount = parseInt(req.query.count) || 1;
    const items = await pool.query('SELECT * FROM pa_items WHERE package_id = ? ORDER BY part_code', [req.params.id]);
    const pkg = await pool.query('SELECT * FROM pa_packages WHERE id = ?', [req.params.id]);

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
      'Birim Fiyat': m.unit_price,
      'Eksik Maliyet': m.missing_cost,
      'Lead Time (gün)': m.lead_time_days,
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

    const critical = items.rows.map(item => {
      const totalNeed = (item.bom_quantity || 0) * packageCount;
      const miss = Math.max(totalNeed - (item.temsa_stock || 0), 0);
      return { ...item, total_need: totalNeed, missing_quantity: miss, missing_cost: miss * (item.unit_price || 0) };
    }).filter(i => i.missing_quantity > 0 && (i.lead_time_days || 0) > 0);

    const ws = XLSX.utils.json_to_sheet(critical.map(m => ({
      'Parça Kodu': m.part_code,
      'Parça Adı': m.part_name || '',
      'Lead Time (gün)': m.lead_time_days,
      'Eksik Adet': m.missing_quantity,
      'Eksik Maliyet': m.missing_cost,
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

    const counts = [1, 5, 10, 20, 50];
    const rows = items.rows.map(item => {
      const row = {
        'Parça Kodu': item.part_code,
        'Parça Adı': item.part_name || '',
        'BOM Adedi': item.bom_quantity,
        'TEMSA Stok': item.temsa_stock,
        'Birim Fiyat': item.unit_price
      };
      counts.forEach(c => {
        const need = (item.bom_quantity || 0) * c;
        const miss = Math.max(need - (item.temsa_stock || 0), 0);
        row[`${c} Paket İhtiyaç`] = need;
        row[`${c} Paket Eksik`] = miss;
        row[`${c} Paket Maliyet`] = miss * (item.unit_price || 0);
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

export default router;
