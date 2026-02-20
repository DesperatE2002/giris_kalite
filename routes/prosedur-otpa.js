// ═══════════════════════════════════════════════════════════════════════════════
// PROSEDÜR & OTPA RAPOR MODÜLÜ — Backend
// 1) Prosedür/Doküman Yönetimi
// 2) OTPA Bazlı Kalite Kontrol & Rapor Arşivleme
// Prefix: po_ (prosedur-otpa)
// ═══════════════════════════════════════════════════════════════════════════════
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import pool from '../db/database.js';

const router = express.Router();

// ─── Upload Config ──────────────────────────────────────────────────
const uploadsDir = process.env.VERCEL ? '/tmp/uploads/prosedur-otpa' : './uploads/prosedur-otpa';
if (!process.env.VERCEL) {
  ['documents', 'otpa-files'].forEach(sub => {
    const dir = path.join(uploadsDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sub = req.uploadSubDir || 'documents';
    const dir = path.join(uploadsDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
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
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// ─── MİGRASYON ──────────────────────────────────────────────────────
export async function migrateProsedurOtpa() {
  try {
    // 1) Prosedür / Dokümanlar
    await pool.query(`
      CREATE TABLE IF NOT EXISTS po_documents (
        id SERIAL PRIMARY KEY,
        doc_name TEXT NOT NULL,
        doc_code TEXT,
        revision_no TEXT DEFAULT '0',
        publish_date DATE,
        department TEXT,
        doc_type TEXT DEFAULT 'prosedur',
        description TEXT,
        file_path TEXT,
        file_original_name TEXT,
        file_size INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2) Doküman revizyon geçmişi
    await pool.query(`
      CREATE TABLE IF NOT EXISTS po_document_revisions (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES po_documents(id) ON DELETE CASCADE,
        revision_no TEXT NOT NULL,
        change_description TEXT,
        file_path TEXT,
        file_original_name TEXT,
        revised_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3) OTPA Kayıtları
    await pool.query(`
      CREATE TABLE IF NOT EXISTS po_otpa (
        id SERIAL PRIMARY KEY,
        otpa_no TEXT UNIQUE NOT NULL,
        project_name TEXT,
        production_date DATE,
        responsible_tech TEXT,
        battery_count INTEGER DEFAULT 8,
        status TEXT DEFAULT 'open',
        notes TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4) Kalite Form Şablonları
    await pool.query(`
      CREATE TABLE IF NOT EXISTS po_form_templates (
        id SERIAL PRIMARY KEY,
        form_name TEXT NOT NULL,
        form_type TEXT NOT NULL DEFAULT 'giris',
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5) Form Maddeleri
    await pool.query(`
      CREATE TABLE IF NOT EXISTS po_form_items (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES po_form_templates(id) ON DELETE CASCADE,
        item_no INTEGER NOT NULL,
        item_text TEXT NOT NULL,
        control_type TEXT DEFAULT 'evet_hayir',
        is_required BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6) OTPA Form Kayıtları (doldurulmuş formlar)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS po_otpa_forms (
        id SERIAL PRIMARY KEY,
        otpa_id INTEGER NOT NULL REFERENCES po_otpa(id) ON DELETE CASCADE,
        template_id INTEGER NOT NULL REFERENCES po_form_templates(id) ON DELETE CASCADE,
        battery_no INTEGER,
        status TEXT DEFAULT 'draft',
        filled_by INTEGER,
        filled_at TIMESTAMP,
        approved_by INTEGER,
        approved_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7) Form Cevapları
    await pool.query(`
      CREATE TABLE IF NOT EXISTS po_form_answers (
        id SERIAL PRIMARY KEY,
        otpa_form_id INTEGER NOT NULL REFERENCES po_otpa_forms(id) ON DELETE CASCADE,
        form_item_id INTEGER NOT NULL REFERENCES po_form_items(id) ON DELETE CASCADE,
        answer_value TEXT,
        numeric_value REAL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8) OTPA Dosyaları (görseller, cycle raporu, test raporları)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS po_otpa_files (
        id SERIAL PRIMARY KEY,
        otpa_id INTEGER NOT NULL REFERENCES po_otpa(id) ON DELETE CASCADE,
        file_type TEXT DEFAULT 'image',
        file_category TEXT DEFAULT 'genel',
        file_path TEXT NOT NULL,
        file_original_name TEXT,
        file_size INTEGER DEFAULT 0,
        description TEXT,
        uploaded_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_po_docs_code ON po_documents(doc_code)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_po_docs_type ON po_documents(doc_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_po_otpa_no ON po_otpa(otpa_no)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_po_oforms_otpa ON po_otpa_forms(otpa_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_po_answers_form ON po_form_answers(otpa_form_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_po_files_otpa ON po_otpa_files(otpa_id)');

    console.log('✅ Prosedür-OTPA tabloları hazır (po_documents, po_otpa, po_form_templates, vb.)');
  } catch (e) {
    if (!e.message?.includes('already exists')) {
      console.error('⚠️ Prosedür-OTPA migration:', e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1) PROSEDÜR / DOKÜMAN YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════════════════

// Liste + arama
router.get('/documents', authenticateToken, async (req, res) => {
  try {
    const { search, department, doc_type } = req.query;
    let q = `SELECT d.*, u.full_name as created_by_name FROM po_documents d LEFT JOIN users u ON d.created_by = u.id WHERE 1=1`;
    const p = [];
    if (search) { q += ` AND (d.doc_name ILIKE ? OR d.doc_code ILIKE ? OR d.description ILIKE ?)`; p.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (department) { q += ` AND d.department = ?`; p.push(department); }
    if (doc_type) { q += ` AND d.doc_type = ?`; p.push(doc_type); }
    q += ' ORDER BY d.updated_at DESC';
    const result = await pool.query(q, p);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

// Doküman yükle
router.post('/documents', authenticateToken, authorizeRoles('admin'), (req, res, next) => { req.uploadSubDir = 'documents'; next(); }, upload.single('file'), async (req, res) => {
  try {
    const { doc_name, doc_code, revision_no, publish_date, department, doc_type, description } = req.body;
    if (!doc_name?.trim()) return res.status(400).json({ error: 'Doküman adı zorunlu' });

    const filePath = req.file ? req.file.path : null;
    const r = await pool.query(
      `INSERT INTO po_documents (doc_name, doc_code, revision_no, publish_date, department, doc_type, description, file_path, file_original_name, file_size, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *`,
      [doc_name.trim(), doc_code || null, revision_no || '0', publish_date || null, department || null, doc_type || 'prosedur', description || null, filePath, req.file?.originalname || null, req.file?.size || 0, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Yükleme hatası: ' + e.message }); }
});

// Doküman güncelle
router.put('/documents/:id', authenticateToken, authorizeRoles('admin'), (req, res, next) => { req.uploadSubDir = 'documents'; next(); }, upload.single('file'), async (req, res) => {
  try {
    const { doc_name, doc_code, revision_no, publish_date, department, doc_type, description } = req.body;

    // Eski revizyonu kaydet
    const old = await pool.query('SELECT * FROM po_documents WHERE id=?', [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ error: 'Doküman bulunamadı' });
    const oldDoc = old.rows[0];

    if (revision_no && revision_no !== oldDoc.revision_no) {
      await pool.query(
        `INSERT INTO po_document_revisions (document_id, revision_no, change_description, file_path, file_original_name, revised_by) VALUES (?,?,?,?,?,?)`,
        [req.params.id, oldDoc.revision_no, `Rev ${oldDoc.revision_no} → ${revision_no}`, oldDoc.file_path, oldDoc.file_original_name, req.user.id]
      );
    }

    const filePath = req.file ? req.file.path : oldDoc.file_path;
    const fileName = req.file ? req.file.originalname : oldDoc.file_original_name;
    const fileSize = req.file ? req.file.size : oldDoc.file_size;

    await pool.query(
      `UPDATE po_documents SET doc_name=?, doc_code=?, revision_no=?, publish_date=?, department=?, doc_type=?, description=?, file_path=?, file_original_name=?, file_size=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [doc_name || oldDoc.doc_name, doc_code ?? oldDoc.doc_code, revision_no || oldDoc.revision_no, publish_date || oldDoc.publish_date, department || oldDoc.department, doc_type || oldDoc.doc_type, description ?? oldDoc.description, filePath, fileName, fileSize, req.params.id]
    );
    const r = await pool.query('SELECT * FROM po_documents WHERE id=?', [req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Güncelleme hatası: ' + e.message }); }
});

// Doküman sil
router.delete('/documents/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM po_documents WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Silme hatası' }); }
});

// Revizyon geçmişi
router.get('/documents/:id/revisions', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.*, u.full_name as revised_by_name FROM po_document_revisions r LEFT JOIN users u ON r.revised_by = u.id WHERE r.document_id=? ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

// Doküman indir
router.get('/documents/:id/download', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query('SELECT file_path, file_original_name FROM po_documents WHERE id=?', [req.params.id]);
    if (!r.rows.length || !r.rows[0].file_path) return res.status(404).json({ error: 'Dosya bulunamadı' });
    const doc = r.rows[0];
    // Önce doğrudan kayıtlı path'i dene (req.file.path ile kaydedilen)
    let absPath = path.isAbsolute(doc.file_path) ? doc.file_path : path.resolve(doc.file_path);
    // Eğer bulunamazsa eski format ile dene (hardcoded /uploads/... → relative)
    if (!fs.existsSync(absPath)) {
      absPath = path.resolve(doc.file_path.replace(/^\//, ''));
    }
    // Hâlâ bulunamazsa uploadsDir ile birleştir
    if (!fs.existsSync(absPath)) {
      const fname = path.basename(doc.file_path);
      absPath = path.resolve(uploadsDir, 'documents', fname);
    }
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'Dosya sunucuda bulunamadı. Dosya yeniden yüklenmelidir.' });
    // İndirme mi yoksa önizleme mi?
    if (req.query.preview === '1') {
      const mimeTypes = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
      const ext = path.extname(doc.file_original_name || absPath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_original_name || 'document')}"`);
      return fs.createReadStream(absPath).pipe(res);
    }
    res.download(absPath, doc.file_original_name || 'document');
  } catch (e) { res.status(500).json({ error: 'İndirme hatası: ' + e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2) OTPA YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/otpa', authenticateToken, async (req, res) => {
  try {
    const { search } = req.query;
    let q = `SELECT o.*, u.full_name as created_by_name,
      (SELECT COUNT(*) FROM po_otpa_forms WHERE otpa_id = o.id) as form_count,
      (SELECT COUNT(*) FROM po_otpa_files WHERE otpa_id = o.id) as file_count,
      (SELECT COUNT(*) FROM po_otpa_forms WHERE otpa_id = o.id AND status = 'completed') as completed_form_count
      FROM po_otpa o LEFT JOIN users u ON o.created_by = u.id WHERE 1=1`;
    const p = [];
    if (search) { q += ` AND (o.otpa_no ILIKE ? OR o.project_name ILIKE ? OR o.responsible_tech ILIKE ?)`; p.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    q += ' ORDER BY o.created_at DESC';
    const result = await pool.query(q, p);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

router.get('/otpa/:id', authenticateToken, async (req, res) => {
  try {
    const [otpaR, formsR, filesR] = await Promise.all([
      pool.query('SELECT o.*, u.full_name as created_by_name FROM po_otpa o LEFT JOIN users u ON o.created_by = u.id WHERE o.id=?', [req.params.id]),
      pool.query(`SELECT f.*, t.form_name, t.form_type, u.full_name as filled_by_name
        FROM po_otpa_forms f LEFT JOIN po_form_templates t ON f.template_id = t.id LEFT JOIN users u ON f.filled_by = u.id
        WHERE f.otpa_id=? ORDER BY t.form_type, f.battery_no`, [req.params.id]),
      pool.query('SELECT * FROM po_otpa_files WHERE otpa_id=? ORDER BY created_at DESC', [req.params.id])
    ]);
    if (!otpaR.rows.length) return res.status(404).json({ error: 'OTPA bulunamadı' });
    res.json({ otpa: otpaR.rows[0], forms: formsR.rows, files: filesR.rows });
  } catch (e) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

router.post('/otpa', authenticateToken, authorizeRoles('admin', 'kalite'), async (req, res) => {
  try {
    const { otpa_no, project_name, production_date, responsible_tech, battery_count, notes } = req.body;
    if (!otpa_no?.trim()) return res.status(400).json({ error: 'OTPA No zorunlu' });
    const r = await pool.query(
      `INSERT INTO po_otpa (otpa_no, project_name, production_date, responsible_tech, battery_count, notes, created_by) VALUES (?,?,?,?,?,?,?) RETURNING *`,
      [otpa_no.trim(), project_name || '', production_date || null, responsible_tech || '', battery_count || 8, notes || '', req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) {
    if (e.message?.includes('unique') || e.code === '23505') return res.status(400).json({ error: 'Bu OTPA No zaten mevcut' });
    res.status(500).json({ error: 'Oluşturma hatası: ' + e.message });
  }
});

router.put('/otpa/:id', authenticateToken, authorizeRoles('admin', 'kalite'), async (req, res) => {
  try {
    const { project_name, production_date, responsible_tech, battery_count, status, notes } = req.body;
    await pool.query(
      `UPDATE po_otpa SET project_name=COALESCE(?,project_name), production_date=COALESCE(?,production_date), responsible_tech=COALESCE(?,responsible_tech), battery_count=COALESCE(?,battery_count), status=COALESCE(?,status), notes=COALESCE(?,notes), updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [project_name, production_date, responsible_tech, battery_count, status, notes, req.params.id]
    );
    const r = await pool.query('SELECT * FROM po_otpa WHERE id=?', [req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

router.delete('/otpa/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM po_otpa WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Silme hatası' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3) KALİTE FORM ŞABLONLARI
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/form-templates', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT t.*, (SELECT COUNT(*) FROM po_form_items WHERE template_id = t.id) as item_count
      FROM po_form_templates t ORDER BY t.form_type, t.form_name
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

router.post('/form-templates', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { form_name, form_type, description } = req.body;
    if (!form_name?.trim()) return res.status(400).json({ error: 'Form adı zorunlu' });
    const r = await pool.query('INSERT INTO po_form_templates (form_name, form_type, description) VALUES (?,?,?) RETURNING *', [form_name.trim(), form_type || 'giris', description || '']);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Oluşturma hatası' }); }
});

router.put('/form-templates/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { form_name, form_type, description, is_active } = req.body;
    await pool.query('UPDATE po_form_templates SET form_name=COALESCE(?,form_name), form_type=COALESCE(?,form_type), description=COALESCE(?,description), is_active=COALESCE(?,is_active) WHERE id=?',
      [form_name, form_type, description, is_active, req.params.id]);
    const r = await pool.query('SELECT * FROM po_form_templates WHERE id=?', [req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

router.delete('/form-templates/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM po_form_templates WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Silme hatası' }); }
});

// Form maddeleri
router.get('/form-templates/:id/items', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM po_form_items WHERE template_id=? ORDER BY sort_order, item_no', [req.params.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

router.post('/form-templates/:id/items', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { item_no, item_text, control_type, is_required, sort_order } = req.body;
    if (!item_text?.trim()) return res.status(400).json({ error: 'Madde metni zorunlu' });
    const r = await pool.query(
      'INSERT INTO po_form_items (template_id, item_no, item_text, control_type, is_required, sort_order) VALUES (?,?,?,?,?,?) RETURNING *',
      [req.params.id, item_no || 1, item_text.trim(), control_type || 'evet_hayir', is_required !== false, sort_order || 0]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Ekleme hatası' }); }
});

router.put('/form-items/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { item_no, item_text, control_type, is_required, sort_order } = req.body;
    await pool.query('UPDATE po_form_items SET item_no=COALESCE(?,item_no), item_text=COALESCE(?,item_text), control_type=COALESCE(?,control_type), is_required=COALESCE(?,is_required), sort_order=COALESCE(?,sort_order) WHERE id=?',
      [item_no, item_text, control_type, is_required, sort_order, req.params.id]);
    const r = await pool.query('SELECT * FROM po_form_items WHERE id=?', [req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

router.delete('/form-items/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM po_form_items WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Silme hatası' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4) OTPA FORM DOLDURMA
// ═══════════════════════════════════════════════════════════════════════════════

// OTPA için form başlat (batarya bazlı veya genel)
router.post('/otpa/:id/forms', authenticateToken, async (req, res) => {
  try {
    const { template_id, battery_no } = req.body;
    if (!template_id) return res.status(400).json({ error: 'Form şablonu seçilmeli' });

    // Aynı OTPA + şablon + batarya için tekrar oluşturma kontrolü
    const exists = await pool.query(
      'SELECT id FROM po_otpa_forms WHERE otpa_id=? AND template_id=? AND (battery_no=? OR (battery_no IS NULL AND ? IS NULL))',
      [req.params.id, template_id, battery_no || null, battery_no || null]
    );
    if (exists.rows.length) return res.json(exists.rows[0]);

    const r = await pool.query(
      'INSERT INTO po_otpa_forms (otpa_id, template_id, battery_no, filled_by) VALUES (?,?,?,?) RETURNING *',
      [req.params.id, template_id, battery_no || null, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'Form oluşturma hatası' }); }
});

// Toplu batarya formu oluştur
router.post('/otpa/:id/forms/bulk', authenticateToken, async (req, res) => {
  try {
    const { template_id, battery_count } = req.body;
    if (!template_id || !battery_count) return res.status(400).json({ error: 'Şablon ve batarya sayısı gerekli' });

    const created = [];
    for (let i = 1; i <= battery_count; i++) {
      const exists = await pool.query('SELECT id FROM po_otpa_forms WHERE otpa_id=? AND template_id=? AND battery_no=?', [req.params.id, template_id, i]);
      if (!exists.rows.length) {
        const r = await pool.query('INSERT INTO po_otpa_forms (otpa_id, template_id, battery_no, filled_by) VALUES (?,?,?,?) RETURNING *', [req.params.id, template_id, i, req.user.id]);
        created.push(r.rows[0]);
      } else {
        created.push(exists.rows[0]);
      }
    }
    res.json({ created: created.length, forms: created });
  } catch (e) { res.status(500).json({ error: 'Toplu form oluşturma hatası' }); }
});

// Form detay (maddeler + cevaplar)
router.get('/otpa-forms/:formId', authenticateToken, async (req, res) => {
  try {
    const formR = await pool.query(`
      SELECT f.*, t.form_name, t.form_type, u.full_name as filled_by_name
      FROM po_otpa_forms f LEFT JOIN po_form_templates t ON f.template_id = t.id LEFT JOIN users u ON f.filled_by = u.id
      WHERE f.id=?`, [req.params.formId]);
    if (!formR.rows.length) return res.status(404).json({ error: 'Form bulunamadı' });

    const itemsR = await pool.query(`
      SELECT i.*, a.answer_value, a.numeric_value, a.comment, a.id as answer_id
      FROM po_form_items i LEFT JOIN po_form_answers a ON a.form_item_id = i.id AND a.otpa_form_id = ?
      WHERE i.template_id = ?
      ORDER BY i.sort_order, i.item_no
    `, [req.params.formId, formR.rows[0].template_id]);

    res.json({ form: formR.rows[0], items: itemsR.rows });
  } catch (e) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

// Form cevaplarını kaydet
router.post('/otpa-forms/:formId/answers', authenticateToken, async (req, res) => {
  try {
    const { answers, notes } = req.body; // answers: [{ form_item_id, answer_value, numeric_value, comment }]
    if (!answers?.length) return res.status(400).json({ error: 'Cevaplar boş' });

    // Mevcut cevapları sil, yeniden yaz
    await pool.query('DELETE FROM po_form_answers WHERE otpa_form_id=?', [req.params.formId]);

    let nonConformCount = 0;
    for (const ans of answers) {
      await pool.query(
        'INSERT INTO po_form_answers (otpa_form_id, form_item_id, answer_value, numeric_value, comment) VALUES (?,?,?,?,?)',
        [req.params.formId, ans.form_item_id, ans.answer_value || null, ans.numeric_value || null, ans.comment || null]
      );
      if (ans.answer_value === 'hayir' || ans.answer_value === 'nok') nonConformCount++;
    }

    // Form durumunu güncelle
    await pool.query(
      'UPDATE po_otpa_forms SET status=?, filled_by=?, filled_at=CURRENT_TIMESTAMP, notes=COALESCE(?,notes) WHERE id=?',
      ['completed', req.user.id, notes, req.params.formId]
    );

    res.json({ success: true, saved: answers.length, nonConformCount });
  } catch (e) { res.status(500).json({ error: 'Kaydetme hatası: ' + e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5) OTPA DOSYA YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/otpa/:id/files', authenticateToken, (req, res, next) => { req.uploadSubDir = 'otpa-files'; next(); }, upload.array('files', 10), async (req, res) => {
  try {
    const { file_type, file_category, description } = req.body;
    const uploaded = [];
    for (const f of (req.files || [])) {
      const r = await pool.query(
        'INSERT INTO po_otpa_files (otpa_id, file_type, file_category, file_path, file_original_name, file_size, description, uploaded_by) VALUES (?,?,?,?,?,?,?,?) RETURNING *',
        [req.params.id, file_type || 'image', file_category || 'genel', f.path, f.originalname, f.size, description || '', req.user.id]
      );
      uploaded.push(r.rows[0]);
    }
    res.json({ success: true, uploaded });
  } catch (e) { res.status(500).json({ error: 'Yükleme hatası' }); }
});

router.delete('/otpa-files/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM po_otpa_files WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Silme hatası' }); }
});

// Dosya indir
router.get('/otpa-files/:id/download', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query('SELECT file_path, file_original_name FROM po_otpa_files WHERE id=?', [req.params.id]);
    if (!r.rows.length || !r.rows[0].file_path) return res.status(404).json({ error: 'Dosya bulunamadı' });
    const f = r.rows[0];
    let absPath = path.isAbsolute(f.file_path) ? f.file_path : path.resolve(f.file_path);
    if (!fs.existsSync(absPath)) {
      absPath = path.resolve(f.file_path.replace(/^\//, ''));
    }
    if (!fs.existsSync(absPath)) {
      const fname = path.basename(f.file_path);
      absPath = path.resolve(uploadsDir, 'otpa-files', fname);
    }
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'Dosya sunucuda bulunamadı' });
    res.download(absPath, f.file_original_name || 'file');
  } catch (e) { res.status(500).json({ error: 'İndirme hatası' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6) İSTATİSTİKLER & RAPOR
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const [dc, oc, fc, tc] = await Promise.all([
      pool.query('SELECT COUNT(*) as c FROM po_documents'),
      pool.query('SELECT COUNT(*) as c FROM po_otpa'),
      pool.query('SELECT COUNT(*) as c FROM po_otpa_forms WHERE status=?', ['completed']),
      pool.query('SELECT COUNT(*) as c FROM po_form_templates WHERE is_active=true')
    ]);
    res.json({
      document_count: parseInt(dc.rows[0].c),
      otpa_count: parseInt(oc.rows[0].c),
      completed_form_count: parseInt(fc.rows[0].c),
      template_count: parseInt(tc.rows[0].c)
    });
  } catch (e) { res.status(500).json({ error: 'İstatistik hatası' }); }
});

// OTPA Genel Raporu
router.get('/otpa/:id/report', authenticateToken, async (req, res) => {
  try {
    const [otpaR, formsR, filesR] = await Promise.all([
      pool.query('SELECT o.*, u.full_name as created_by_name FROM po_otpa o LEFT JOIN users u ON o.created_by = u.id WHERE o.id=?', [req.params.id]),
      pool.query(`
        SELECT f.*, t.form_name, t.form_type, u.full_name as filled_by_name,
          (SELECT COUNT(*) FROM po_form_answers WHERE otpa_form_id = f.id AND answer_value IN ('hayir','nok')) as nonconform_count,
          (SELECT COUNT(*) FROM po_form_answers WHERE otpa_form_id = f.id) as total_answers
        FROM po_otpa_forms f LEFT JOIN po_form_templates t ON f.template_id = t.id LEFT JOIN users u ON f.filled_by = u.id
        WHERE f.otpa_id=? ORDER BY t.form_type, f.battery_no
      `, [req.params.id]),
      pool.query('SELECT * FROM po_otpa_files WHERE otpa_id=? ORDER BY file_category, created_at', [req.params.id])
    ]);
    if (!otpaR.rows.length) return res.status(404).json({ error: 'OTPA bulunamadı' });

    const totalForms = formsR.rows.length;
    const completedForms = formsR.rows.filter(f => f.status === 'completed').length;
    const totalNonConform = formsR.rows.reduce((s, f) => s + (parseInt(f.nonconform_count) || 0), 0);

    res.json({
      otpa: otpaR.rows[0],
      forms: formsR.rows,
      files: filesR.rows,
      summary: { totalForms, completedForms, totalNonConform, fileCount: filesR.rows.length }
    });
  } catch (e) { res.status(500).json({ error: 'Rapor hatası' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7) BATARYA DETAY RAPORU — Bir bataryaya ait tüm form ve cevaplar
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/otpa/:id/battery/:batteryNo/report', authenticateToken, async (req, res) => {
  try {
    const otpaR = await pool.query(
      'SELECT o.*, u.full_name as created_by_name FROM po_otpa o LEFT JOIN users u ON o.created_by = u.id WHERE o.id=?',
      [req.params.id]
    );
    if (!otpaR.rows.length) return res.status(404).json({ error: 'OTPA bulunamadı' });

    // Bu batarya numarasına ait tüm formları getir
    const formsR = await pool.query(`
      SELECT f.*, t.form_name, t.form_type, u.full_name as filled_by_name
      FROM po_otpa_forms f
      LEFT JOIN po_form_templates t ON f.template_id = t.id
      LEFT JOIN users u ON f.filled_by = u.id
      WHERE f.otpa_id=? AND f.battery_no=?
      ORDER BY t.form_type, f.id
    `, [req.params.id, req.params.batteryNo]);

    // Her form için maddeleri ve cevapları getir
    const formsWithItems = [];
    for (const form of formsR.rows) {
      const itemsR = await pool.query(`
        SELECT i.item_no, i.item_text, i.control_type, i.is_required,
               a.answer_value, a.numeric_value, a.comment
        FROM po_form_items i
        LEFT JOIN po_form_answers a ON a.form_item_id = i.id AND a.otpa_form_id = ?
        WHERE i.template_id = ?
        ORDER BY i.sort_order, i.item_no
      `, [form.id, form.template_id]);

      const totalItems = itemsR.rows.length;
      const answeredItems = itemsR.rows.filter(i => i.answer_value != null).length;
      const okItems = itemsR.rows.filter(i => i.answer_value === 'evet').length;
      const nokItems = itemsR.rows.filter(i => i.answer_value === 'hayir' || i.answer_value === 'nok').length;

      formsWithItems.push({
        ...form,
        items: itemsR.rows,
        summary: { totalItems, answeredItems, okItems, nokItems }
      });
    }

    res.json({
      otpa: otpaR.rows[0],
      batteryNo: parseInt(req.params.batteryNo),
      forms: formsWithItems
    });
  } catch (e) {
    console.error('Battery report error:', e);
    res.status(500).json({ error: 'Batarya rapor hatası' });
  }
});

export default router;
