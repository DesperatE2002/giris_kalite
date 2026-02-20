// ═══════════════════════════════════════════════════════════════════════════════
// SAHA DEĞİŞİKLİK GEÇMİŞİ MODÜLÜ — Backend
// Field Change Log: Araç/OTPA bazlı saha müdahale kayıtları
// Prefix: fcl_ (field-changelog)
// ═══════════════════════════════════════════════════════════════════════════════
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import pool from '../db/database.js';

const router = express.Router();

// ─── Upload Config ──────────────────────────────────────────────────
const uploadsDir = process.env.VERCEL ? '/tmp/uploads/field-changelog' : './uploads/field-changelog';
if (!process.env.VERCEL) {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// ─── KATEGORİLER (Statik — v1) ─────────────────────────────────────
const CATEGORIES = [
  'PDU', 'VCCU', 'BATARYA', 'Kart Değişimi (BCU)', 'Kart Değişimi (BMU)',
  'Tesisat Değişimi', 'Akım Sensörü Değişimi', 'Kontaktör Değişimi',
  'Hasarlı/Hatalı Cell Değişimi', 'Yazılım Güncelleme', 'LENZE',
  'Direksiyon Pompası', 'Hava Kompresörü', 'Araç Üzeri 24V Kontrol',
  'Sigorta', 'Soğutma Modül ve Bağlantı Kompleleri', 'Diğer'
];

// ─── MİGRASYON ──────────────────────────────────────────────────────
export async function migrateFieldChangelog() {
  try {
    // 1) Ana kayıt tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcl_logs (
        id SERIAL PRIMARY KEY,
        otpa_no TEXT NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        performed_by TEXT,
        checked_by TEXT NOT NULL,
        fault_info TEXT,
        description TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2) Kategori ilişki tablosu (many-to-many)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcl_log_categories (
        id SERIAL PRIMARY KEY,
        log_id INTEGER NOT NULL REFERENCES fcl_logs(id) ON DELETE CASCADE,
        category TEXT NOT NULL
      )
    `);

    // 3) Parça değişim tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcl_part_changes (
        id SERIAL PRIMARY KEY,
        log_id INTEGER NOT NULL REFERENCES fcl_logs(id) ON DELETE CASCADE,
        component_group TEXT,
        component_detail TEXT,
        part_no TEXT,
        qty INTEGER DEFAULT 1,
        note TEXT
      )
    `);

    // 4) Yazılım versiyon tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcl_software_versions (
        id SERIAL PRIMARY KEY,
        log_id INTEGER NOT NULL REFERENCES fcl_logs(id) ON DELETE CASCADE,
        module_name TEXT NOT NULL,
        version_from TEXT,
        version_to TEXT
      )
    `);

    // 5) Ek dosyalar tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcl_attachments (
        id SERIAL PRIMARY KEY,
        log_id INTEGER NOT NULL REFERENCES fcl_logs(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        file_original_name TEXT,
        file_size INTEGER DEFAULT 0,
        file_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Saha Değişiklik Geçmişi tabloları hazır');
  } catch (e) {
    if (!e.message.includes('already exists')) {
      console.error('⚠️ Field Changelog migration error:', e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── İstatistikler ──────────────────────────────────────────────────
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const logCount = await pool.query('SELECT COUNT(*) as count FROM fcl_logs');
    const otpaCount = await pool.query('SELECT COUNT(DISTINCT otpa_no) as count FROM fcl_logs');
    const partCount = await pool.query('SELECT COUNT(*) as count FROM fcl_part_changes');
    const swCount = await pool.query('SELECT COUNT(*) as count FROM fcl_software_versions');
    res.json({
      log_count: parseInt(logCount.rows[0]?.count) || 0,
      unique_otpa_count: parseInt(otpaCount.rows[0]?.count) || 0,
      part_change_count: parseInt(partCount.rows[0]?.count) || 0,
      software_update_count: parseInt(swCount.rows[0]?.count) || 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Kategoriler listesi ────────────────────────────────────────────
router.get('/categories', authenticateToken, (req, res) => {
  res.json(CATEGORIES);
});

// ─── Kayıtları listele (filtrelenebilir arşiv) ─────────────────────
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const { otpa, category, checked_by, performed_by, part_no, date_from, date_to, has_software, search, limit = 50, offset = 0 } = req.query;

    let where = [];
    let params = [];
    let pIdx = 1;

    if (otpa) {
      where.push(`l.otpa_no ILIKE $${pIdx++}`);
      params.push(`%${otpa}%`);
    }
    if (search) {
      where.push(`(l.otpa_no ILIKE $${pIdx} OR l.fault_info ILIKE $${pIdx} OR l.description ILIKE $${pIdx} OR l.checked_by ILIKE $${pIdx} OR l.performed_by ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }
    if (checked_by) {
      where.push(`l.checked_by ILIKE $${pIdx++}`);
      params.push(`%${checked_by}%`);
    }
    if (performed_by) {
      where.push(`l.performed_by ILIKE $${pIdx++}`);
      params.push(`%${performed_by}%`);
    }
    if (date_from) {
      where.push(`l.start_date >= $${pIdx++}`);
      params.push(date_from);
    }
    if (date_to) {
      where.push(`l.start_date <= $${pIdx++}`);
      params.push(date_to + 'T23:59:59');
    }
    if (category) {
      where.push(`EXISTS (SELECT 1 FROM fcl_log_categories c WHERE c.log_id = l.id AND c.category = $${pIdx++})`);
      params.push(category);
    }
    if (part_no) {
      where.push(`EXISTS (SELECT 1 FROM fcl_part_changes p WHERE p.log_id = l.id AND p.part_no ILIKE $${pIdx++})`);
      params.push(`%${part_no}%`);
    }
    if (has_software === 'true') {
      where.push(`EXISTS (SELECT 1 FROM fcl_software_versions sv WHERE sv.log_id = l.id)`);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Count
    const countQ = await pool.query(`SELECT COUNT(*) as total FROM fcl_logs l ${whereClause}`, params);
    const total = parseInt(countQ.rows[0]?.total) || 0;

    // Data
    const dataQ = await pool.query(`
      SELECT l.*,
        u.full_name as created_by_name,
        (SELECT string_agg(c.category, ', ') FROM fcl_log_categories c WHERE c.log_id = l.id) as categories,
        (SELECT COUNT(*) FROM fcl_part_changes p WHERE p.log_id = l.id) as part_count,
        (SELECT COUNT(*) FROM fcl_software_versions sv WHERE sv.log_id = l.id) as sw_count,
        (SELECT COUNT(*) FROM fcl_attachments a WHERE a.log_id = l.id) as attachment_count
      FROM fcl_logs l
      LEFT JOIN users u ON u.id = l.created_by
      ${whereClause}
      ORDER BY l.start_date DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `, [...params, parseInt(limit), parseInt(offset)]);

    res.json({ logs: dataQ.rows, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── OTPA bazlı timeline ────────────────────────────────────────────
router.get('/timeline/:otpaNo', authenticateToken, async (req, res) => {
  try {
    const { otpaNo } = req.params;
    const logs = await pool.query(`
      SELECT l.*,
        u.full_name as created_by_name
      FROM fcl_logs l
      LEFT JOIN users u ON u.id = l.created_by
      WHERE l.otpa_no = $1
      ORDER BY l.start_date DESC
    `, [otpaNo]);

    // Her log için alt verileri çek
    for (const log of logs.rows) {
      const cats = await pool.query('SELECT category FROM fcl_log_categories WHERE log_id = $1', [log.id]);
      log.categories = cats.rows.map(c => c.category);

      const parts = await pool.query('SELECT * FROM fcl_part_changes WHERE log_id = $1 ORDER BY id', [log.id]);
      log.parts = parts.rows;

      const sw = await pool.query('SELECT * FROM fcl_software_versions WHERE log_id = $1 ORDER BY id', [log.id]);
      log.software = sw.rows;

      const att = await pool.query('SELECT id, file_original_name, file_size, file_type, created_at FROM fcl_attachments WHERE log_id = $1 ORDER BY id', [log.id]);
      log.attachments = att.rows;
    }

    res.json({ otpaNo, logs: logs.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Tek kayıt detay ────────────────────────────────────────────────
router.get('/logs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const logQ = await pool.query(`
      SELECT l.*, u.full_name as created_by_name
      FROM fcl_logs l LEFT JOIN users u ON u.id = l.created_by
      WHERE l.id = $1
    `, [id]);
    if (!logQ.rows.length) return res.status(404).json({ error: 'Kayıt bulunamadı' });

    const log = logQ.rows[0];
    const cats = await pool.query('SELECT category FROM fcl_log_categories WHERE log_id = $1', [id]);
    log.categories = cats.rows.map(c => c.category);

    const parts = await pool.query('SELECT * FROM fcl_part_changes WHERE log_id = $1 ORDER BY id', [id]);
    log.parts = parts.rows;

    const sw = await pool.query('SELECT * FROM fcl_software_versions WHERE log_id = $1 ORDER BY id', [id]);
    log.software = sw.rows;

    const att = await pool.query('SELECT id, file_original_name, file_size, file_type, created_at FROM fcl_attachments WHERE log_id = $1 ORDER BY id', [id]);
    log.attachments = att.rows;

    res.json(log);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Yeni kayıt oluştur ────────────────────────────────────────────
router.post('/logs', authenticateToken, async (req, res) => {
  try {
    const { otpa_no, start_date, end_date, performed_by, checked_by, fault_info, description, categories, parts, software } = req.body;
    if (!otpa_no) return res.status(400).json({ error: 'OTPA No zorunludur' });
    if (!start_date) return res.status(400).json({ error: 'Başlangıç tarihi zorunludur' });
    if (!checked_by) return res.status(400).json({ error: 'Kontrol eden personel zorunludur' });
    if (categories?.includes('Diğer') && !description) return res.status(400).json({ error: '"Diğer" seçildiğinde açıklama zorunludur' });
    if (categories?.includes('Yazılım Güncelleme') && (!software || !software.length)) {
      return res.status(400).json({ error: 'Yazılım güncelleme seçildiyse en az 1 yazılım bilgisi gereklidir' });
    }

    // Ana kayıt
    const result = await pool.query(`
      INSERT INTO fcl_logs (otpa_no, start_date, end_date, performed_by, checked_by, fault_info, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [otpa_no, start_date, end_date || null, performed_by || null, checked_by, fault_info || null, description || null, req.user.id]);

    const logId = result.rows[0].id;

    // Kategoriler
    if (categories?.length) {
      for (const cat of categories) {
        await pool.query('INSERT INTO fcl_log_categories (log_id, category) VALUES ($1, $2)', [logId, cat]);
      }
    }

    // Parça değişimleri
    if (parts?.length) {
      for (const p of parts) {
        await pool.query(
          'INSERT INTO fcl_part_changes (log_id, component_group, component_detail, part_no, qty, note) VALUES ($1, $2, $3, $4, $5, $6)',
          [logId, p.component_group || null, p.component_detail || null, p.part_no || null, p.qty || 1, p.note || null]
        );
      }
    }

    // Yazılım versiyonları
    if (software?.length) {
      for (const s of software) {
        await pool.query(
          'INSERT INTO fcl_software_versions (log_id, module_name, version_from, version_to) VALUES ($1, $2, $3, $4)',
          [logId, s.module_name, s.version_from || null, s.version_to || null]
        );
      }
    }

    res.status(201).json({ id: logId, message: 'Kayıt oluşturuldu' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Kayıt güncelle ─────────────────────────────────────────────────
router.put('/logs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { otpa_no, start_date, end_date, performed_by, checked_by, fault_info, description, categories, parts, software } = req.body;

    // Yetki kontrolü: admin veya kendi kaydı
    const existing = await pool.query('SELECT * FROM fcl_logs WHERE id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    if (req.user.role !== 'admin' && existing.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Yetkiniz yok' });
    }

    if (!otpa_no) return res.status(400).json({ error: 'OTPA No zorunludur' });
    if (!start_date) return res.status(400).json({ error: 'Başlangıç tarihi zorunludur' });
    if (!checked_by) return res.status(400).json({ error: 'Kontrol eden personel zorunludur' });

    await pool.query(`
      UPDATE fcl_logs SET otpa_no=$1, start_date=$2, end_date=$3, performed_by=$4, checked_by=$5,
        fault_info=$6, description=$7, updated_at=CURRENT_TIMESTAMP
      WHERE id=$8
    `, [otpa_no, start_date, end_date || null, performed_by || null, checked_by, fault_info || null, description || null, id]);

    // Kategoriler yenile
    await pool.query('DELETE FROM fcl_log_categories WHERE log_id = $1', [id]);
    if (categories?.length) {
      for (const cat of categories) {
        await pool.query('INSERT INTO fcl_log_categories (log_id, category) VALUES ($1, $2)', [id, cat]);
      }
    }

    // Parçalar yenile
    await pool.query('DELETE FROM fcl_part_changes WHERE log_id = $1', [id]);
    if (parts?.length) {
      for (const p of parts) {
        await pool.query(
          'INSERT INTO fcl_part_changes (log_id, component_group, component_detail, part_no, qty, note) VALUES ($1, $2, $3, $4, $5, $6)',
          [id, p.component_group || null, p.component_detail || null, p.part_no || null, p.qty || 1, p.note || null]
        );
      }
    }

    // Yazılımlar yenile
    await pool.query('DELETE FROM fcl_software_versions WHERE log_id = $1', [id]);
    if (software?.length) {
      for (const s of software) {
        await pool.query(
          'INSERT INTO fcl_software_versions (log_id, module_name, version_from, version_to) VALUES ($1, $2, $3, $4)',
          [id, s.module_name, s.version_from || null, s.version_to || null]
        );
      }
    }

    res.json({ message: 'Kayıt güncellendi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Kayıt sil ──────────────────────────────────────────────────────
router.delete('/logs/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    // Dosya temizliği
    const atts = await pool.query('SELECT file_path FROM fcl_attachments WHERE log_id = $1', [id]);
    for (const a of atts.rows) {
      try { if (a.file_path && fs.existsSync(a.file_path)) fs.unlinkSync(a.file_path); } catch {}
    }
    await pool.query('DELETE FROM fcl_logs WHERE id = $1', [id]);
    res.json({ message: 'Kayıt silindi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Dosya yükle (bir kayda ek) ─────────────────────────────────────
router.post('/logs/:id/attachments', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await pool.query('SELECT id FROM fcl_logs WHERE id = $1', [id]);
    if (!exists.rows.length) return res.status(404).json({ error: 'Kayıt bulunamadı' });

    const results = [];
    for (const file of (req.files || [])) {
      const r = await pool.query(
        'INSERT INTO fcl_attachments (log_id, file_path, file_original_name, file_size, file_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [id, file.path, file.originalname, file.size, file.mimetype]
      );
      results.push(r.rows[0]);
    }
    res.json({ attachments: results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Dosya indir ────────────────────────────────────────────────────
router.get('/attachments/:id/download', authenticateToken, async (req, res) => {
  try {
    const att = await pool.query('SELECT * FROM fcl_attachments WHERE id = $1', [req.params.id]);
    if (!att.rows.length) return res.status(404).json({ error: 'Dosya bulunamadı' });

    const a = att.rows[0];
    let filePath = a.file_path;

    // 3-stage resolution
    if (!fs.existsSync(filePath)) {
      filePath = filePath.replace(/^\//, '');
      if (!fs.existsSync(filePath)) {
        filePath = path.join(uploadsDir, path.basename(a.file_path));
      }
    }

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Dosya bulunamadı' });

    const isPreview = req.query.preview === '1';
    if (isPreview) {
      res.setHeader('Content-Type', a.file_type || 'application/octet-stream');
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(a.file_original_name || 'file')}"`);
    }
    res.sendFile(path.resolve(filePath));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Dosya sil ──────────────────────────────────────────────────────
router.delete('/attachments/:id', authenticateToken, async (req, res) => {
  try {
    const att = await pool.query('SELECT * FROM fcl_attachments WHERE id = $1', [req.params.id]);
    if (!att.rows.length) return res.status(404).json({ error: 'Dosya bulunamadı' });

    const a = att.rows[0];
    try { if (a.file_path && fs.existsSync(a.file_path)) fs.unlinkSync(a.file_path); } catch {}
    await pool.query('DELETE FROM fcl_attachments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Dosya silindi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── EXCEL IMPORT ───────────────────────────────────────────────────
router.post('/import', authenticateToken, authorizeRoles('admin', 'kalite'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Excel dosyası yükleyin' });

    // Dinamik import xlsx
    let XLSX;
    try { XLSX = (await import('xlsx')).default || (await import('xlsx')); } catch {
      return res.status(500).json({ error: 'xlsx kütüphanesi yüklü değil. npm install xlsx yapın.' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const errors = [];
    let successCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row (1-indexed header + data)

      try {
        // OTPA No
        const otpaNo = String(row['Araç OTPA'] || row['OTPA'] || row['otpa_no'] || '').trim();
        if (!otpaNo) { errors.push({ row: rowNum, error: 'OTPA No boş' }); continue; }

        // Tarihler
        let startDate = row['Başlangıç tarihi'] || row['start_date'] || row['Başlangıç'] || null;
        let endDate = row['Bitiş tarihi'] || row['end_date'] || row['Bitiş'] || null;
        if (startDate && typeof startDate === 'number') {
          // Excel serial number
          startDate = new Date((startDate - 25569) * 86400 * 1000).toISOString();
        }
        if (endDate && typeof endDate === 'number') {
          endDate = new Date((endDate - 25569) * 86400 * 1000).toISOString();
        }
        if (!startDate) { errors.push({ row: rowNum, error: 'Başlangıç tarihi boş' }); continue; }

        // Kontrol eden
        const checkedBy = String(row['Kontrol eden'] || row['checked_by'] || row['Kontrol Eden Personel'] || '').trim();
        if (!checkedBy) { errors.push({ row: rowNum, error: 'Kontrol eden personel boş' }); continue; }

        const performedBy = String(row['Yapan'] || row['performed_by'] || row['Yapan Personel'] || '').trim() || null;
        const faultInfo = String(row['Arıza'] || row['fault_info'] || row['Arıza Bilgisi'] || '').trim() || null;
        const description = String(row['Açıklama'] || row['description'] || row['Yapılan İşlemler'] || '').trim() || null;

        // Kategoriler — kolon isimlerinden bul
        const foundCategories = [];
        for (const cat of CATEGORIES) {
          const colVal = row[cat];
          if (colVal && String(colVal).trim() !== '' && String(colVal).trim() !== '0' && String(colVal).trim().toLowerCase() !== 'hayır') {
            foundCategories.push(cat);
          }
        }
        // Metin olarak verilmiş kategoriler
        const catText = String(row['Kategoriler'] || row['İşlemler'] || row['Yapılan İşlemler'] || '').trim();
        if (catText) {
          const splits = catText.split(/[,;\/]+/).map(s => s.trim()).filter(Boolean);
          for (const s of splits) {
            const match = CATEGORIES.find(c => c.toLowerCase() === s.toLowerCase());
            if (match && !foundCategories.includes(match)) foundCategories.push(match);
            else if (!match && !foundCategories.includes('Diğer')) foundCategories.push('Diğer');
          }
        }

        // Parça no
        const partNoRaw = String(row['Parça No'] || row['part_no'] || '').trim();
        const partNos = partNoRaw ? partNoRaw.split(/[,;\/]+/).map(s => s.trim()).filter(Boolean) : [];

        // Yazılım
        const swModule = String(row['Yazılım Modül'] || row['SW Module'] || '').trim();
        const swFrom = String(row['Yazılım Eski'] || row['SW From'] || '').trim();
        const swTo = String(row['Yazılım Yeni'] || row['SW To'] || '').trim();

        // Insert
        const result = await pool.query(`
          INSERT INTO fcl_logs (otpa_no, start_date, end_date, performed_by, checked_by, fault_info, description, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [otpaNo, startDate, endDate || null, performedBy, checkedBy, faultInfo, description, req.user.id]);
        const logId = result.rows[0].id;

        // Kategoriler
        for (const cat of foundCategories) {
          await pool.query('INSERT INTO fcl_log_categories (log_id, category) VALUES ($1, $2)', [logId, cat]);
        }

        // Parçalar
        for (const pn of partNos) {
          await pool.query(
            'INSERT INTO fcl_part_changes (log_id, part_no, qty) VALUES ($1, $2, 1)',
            [logId, pn]
          );
        }

        // Yazılım
        if (swModule && swTo) {
          await pool.query(
            'INSERT INTO fcl_software_versions (log_id, module_name, version_from, version_to) VALUES ($1, $2, $3, $4)',
            [logId, swModule, swFrom || null, swTo]
          );
        }

        successCount++;
      } catch (rowError) {
        errors.push({ row: rowNum, error: rowError.message });
      }
    }

    // Temizle
    try { fs.unlinkSync(req.file.path); } catch {}

    res.json({
      message: `Import tamamlandı: ${successCount} başarılı, ${errors.length} hatalı`,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 100) // Max 100 hata göster
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── OTPA bazlı rapor export ────────────────────────────────────────
router.get('/export/:otpaNo', authenticateToken, async (req, res) => {
  try {
    const { otpaNo } = req.params;
    const logs = await pool.query(`
      SELECT l.* FROM fcl_logs l WHERE l.otpa_no = $1 ORDER BY l.start_date DESC
    `, [otpaNo]);

    const exportData = [];
    for (const log of logs.rows) {
      const cats = await pool.query('SELECT category FROM fcl_log_categories WHERE log_id = $1', [log.id]);
      const parts = await pool.query('SELECT * FROM fcl_part_changes WHERE log_id = $1', [log.id]);
      const sw = await pool.query('SELECT * FROM fcl_software_versions WHERE log_id = $1', [log.id]);

      exportData.push({
        ...log,
        categories: cats.rows.map(c => c.category),
        parts: parts.rows,
        software: sw.rows
      });
    }

    res.json({ otpaNo, logs: exportData });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
