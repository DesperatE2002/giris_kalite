// ═══════════════════════════════════════════════════════════════════════════════
// PAKET-ANALİZ MODÜLÜ — TAMAMEN İZOLE BACKEND
// Tablolar: pa_master_materials, pa_bom_packages, pa_bom_items
// Mevcut BOM sistemi (bom_*, bom_templates vb.) ile SIFIR çakışma
// ═══════════════════════════════════════════════════════════════════════════════
import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import pool from '../db/database.js';

const router = express.Router();

// ─── MİGRASYON ──────────────────────────────────────────────────────────────
export async function migratePacketAnaliz() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pa_master_materials (
        id SERIAL PRIMARY KEY,
        malzeme_no TEXT UNIQUE NOT NULL,
        parca_tanimi TEXT,
        birim_adet REAL DEFAULT 1,
        stok REAL DEFAULT 0,
        lead_time_gun INTEGER DEFAULT 0,
        birim_maliyet REAL DEFAULT 0,
        tedarikci TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pa_bom_packages (
        id SERIAL PRIMARY KEY,
        paket_adi TEXT NOT NULL,
        aciklama TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pa_bom_items (
        id SERIAL PRIMARY KEY,
        package_id INTEGER NOT NULL REFERENCES pa_bom_packages(id) ON DELETE CASCADE,
        malzeme_no TEXT NOT NULL,
        miktar REAL NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pa_mm_no ON pa_master_materials(malzeme_no)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pa_bi_pkg ON pa_bom_items(package_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pa_bi_malz ON pa_bom_items(malzeme_no)');
    console.log('✅ Paket-Analiz tabloları hazır (pa_master_materials, pa_bom_packages, pa_bom_items)');
  } catch (e) {
    if (!e.message?.includes('already exists')) {
      console.error('⚠️ Paket-Analiz migration:', e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANA MALZEME VERİTABANI (Master Materials)
// ═══════════════════════════════════════════════════════════════════════════════

// Liste + arama
router.get('/materials', authenticateToken, async (req, res) => {
  try {
    const s = req.query.search || '';
    let q = 'SELECT * FROM pa_master_materials';
    const p = [];
    if (s) {
      q += ` WHERE malzeme_no ILIKE ? OR parca_tanimi ILIKE ? OR tedarikci ILIKE ?`;
      p.push(`%${s}%`, `%${s}%`, `%${s}%`);
    }
    q += ' ORDER BY malzeme_no';
    const result = await pool.query(q, p);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Toplu içe aktarım (UPSERT by malzeme_no)
router.post('/materials/import-paste', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { rows, mapping } = req.body;
    if (!rows?.length || mapping?.malzeme_no === undefined) {
      return res.status(400).json({ error: 'Geçersiz veri. Malzeme No kolonu zorunlu.' });
    }
    const col = mapping;
    let inserted = 0, updated = 0, errors = [];

    for (const row of rows) {
      const malzeme_no = String(row[col.malzeme_no] || '').trim();
      if (!malzeme_no) continue;

      const vals = {
        parca_tanimi: col.parca_tanimi !== undefined ? String(row[col.parca_tanimi] || '').trim() : '',
        birim_adet: col.birim_adet !== undefined ? parseFloat(row[col.birim_adet]) || 1 : 1,
        stok: col.stok !== undefined ? parseFloat(row[col.stok]) || 0 : 0,
        lead_time_gun: col.lead_time_gun !== undefined ? parseInt(row[col.lead_time_gun]) || 0 : 0,
        birim_maliyet: col.birim_maliyet !== undefined ? parseFloat(String(row[col.birim_maliyet]).replace(',', '.')) || 0 : 0,
        tedarikci: col.tedarikci !== undefined ? String(row[col.tedarikci] || '').trim() : ''
      };

      try {
        const existing = await pool.query('SELECT id FROM pa_master_materials WHERE malzeme_no = ?', [malzeme_no]);
        if (existing.rows.length > 0) {
          await pool.query(
            `UPDATE pa_master_materials SET parca_tanimi=?, birim_adet=?, stok=?, lead_time_gun=?, birim_maliyet=?, tedarikci=?, updated_at=CURRENT_TIMESTAMP WHERE malzeme_no=?`,
            [vals.parca_tanimi, vals.birim_adet, vals.stok, vals.lead_time_gun, vals.birim_maliyet, vals.tedarikci, malzeme_no]
          );
          updated++;
        } else {
          await pool.query(
            `INSERT INTO pa_master_materials (malzeme_no, parca_tanimi, birim_adet, stok, lead_time_gun, birim_maliyet, tedarikci) VALUES (?,?,?,?,?,?,?)`,
            [malzeme_no, vals.parca_tanimi, vals.birim_adet, vals.stok, vals.lead_time_gun, vals.birim_maliyet, vals.tedarikci]
          );
          inserted++;
        }
      } catch (e) {
        errors.push(`${malzeme_no}: ${e.message}`);
      }
    }
    res.json({ success: true, inserted, updated, total: inserted + updated, errors: errors.length ? errors : undefined });
  } catch (error) {
    res.status(500).json({ error: 'İçe aktarma hatası: ' + error.message });
  }
});

// Tek malzeme güncelle
router.put('/materials/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { parca_tanimi, birim_adet, stok, lead_time_gun, birim_maliyet, tedarikci } = req.body;
    await pool.query(
      `UPDATE pa_master_materials SET parca_tanimi=?, birim_adet=?, stok=?, lead_time_gun=?, birim_maliyet=?, tedarikci=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [parca_tanimi || '', birim_adet || 1, stok || 0, lead_time_gun || 0, birim_maliyet || 0, tedarikci || '', req.params.id]
    );
    const r = await pool.query('SELECT * FROM pa_master_materials WHERE id=?', [req.params.id]);
    res.json(r.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

// Tek malzeme sil
router.delete('/materials/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM pa_master_materials WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Silme hatası' }); }
});

// Tüm master veriyi sil
router.delete('/materials', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM pa_master_materials');
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Silme hatası' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOM PAKETLERİ
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/bom-packages', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, (SELECT COUNT(*) FROM pa_bom_items WHERE package_id = p.id) as item_count
      FROM pa_bom_packages p ORDER BY p.paket_adi
    `);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

router.post('/bom-packages', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { paket_adi, aciklama } = req.body;
    if (!paket_adi?.trim()) return res.status(400).json({ error: 'Paket adı zorunlu' });
    const r = await pool.query('INSERT INTO pa_bom_packages (paket_adi, aciklama) VALUES (?,?) RETURNING *', [paket_adi.trim(), aciklama || '']);
    res.json(r.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Oluşturma hatası' }); }
});

router.put('/bom-packages/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { paket_adi, aciklama } = req.body;
    await pool.query('UPDATE pa_bom_packages SET paket_adi=?, aciklama=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [paket_adi, aciklama || '', req.params.id]);
    const r = await pool.query('SELECT * FROM pa_bom_packages WHERE id=?', [req.params.id]);
    res.json(r.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

router.delete('/bom-packages/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM pa_bom_packages WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Silme hatası' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOM KALEMLERİ
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/bom-packages/:id/items', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT b.*, m.parca_tanimi, m.birim_adet AS master_birim_adet, m.stok, m.lead_time_gun, m.birim_maliyet, m.tedarikci
      FROM pa_bom_items b LEFT JOIN pa_master_materials m ON b.malzeme_no = m.malzeme_no
      WHERE b.package_id = ? ORDER BY b.malzeme_no
    `, [req.params.id]);
    res.json(r.rows);
  } catch (error) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

// BOM toplu aktarım — paketin kalemlerini sil, yeniden yaz
router.post('/bom-packages/:id/items/import-paste', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const pkgId = req.params.id;
    const { rows, mapping } = req.body;
    const pkg = await pool.query('SELECT id FROM pa_bom_packages WHERE id=?', [pkgId]);
    if (!pkg.rows.length) return res.status(404).json({ error: 'Paket bulunamadı' });
    if (!rows?.length || mapping?.malzeme_no === undefined) {
      return res.status(400).json({ error: 'Geçersiz veri. Malzeme No kolonu zorunlu.' });
    }

    await pool.query('DELETE FROM pa_bom_items WHERE package_id=?', [pkgId]);
    let imported = 0;
    const warnings = [];

    for (const row of rows) {
      const malzeme_no = String(row[mapping.malzeme_no] || '').trim();
      if (!malzeme_no) continue;
      const miktar = mapping.miktar !== undefined ? parseFloat(String(row[mapping.miktar]).replace(',', '.')) || 1 : 1;

      const mc = await pool.query('SELECT malzeme_no FROM pa_master_materials WHERE malzeme_no=?', [malzeme_no]);
      if (!mc.rows.length) warnings.push(`${malzeme_no} master listede bulunamadı`);

      await pool.query('INSERT INTO pa_bom_items (package_id, malzeme_no, miktar) VALUES (?,?,?)', [pkgId, malzeme_no, miktar]);
      imported++;
    }
    res.json({ success: true, imported, warnings: warnings.length ? warnings : undefined });
  } catch (error) { res.status(500).json({ error: 'İçe aktarma hatası: ' + error.message }); }
});

// Tek kalem ekle
router.post('/bom-packages/:id/items', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { malzeme_no, miktar } = req.body;
    if (!malzeme_no?.trim()) return res.status(400).json({ error: 'Malzeme No zorunlu' });
    const r = await pool.query('INSERT INTO pa_bom_items (package_id, malzeme_no, miktar) VALUES (?,?,?) RETURNING *', [req.params.id, malzeme_no.trim(), miktar || 1]);
    res.json(r.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Ekleme hatası' }); }
});

// Kalem sil
router.delete('/bom-items/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM pa_bom_items WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Silme hatası' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANALİZ MOTORU — Çekirdek hesaplama
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const { selections } = req.body; // [{ package_id, adet }]
    if (!selections?.length) return res.status(400).json({ error: 'En az bir paket seçin' });

    const packageResults = [];

    for (const sel of selections) {
      const pkgR = await pool.query('SELECT * FROM pa_bom_packages WHERE id=?', [sel.package_id]);
      if (!pkgR.rows.length) continue;
      const pkg = pkgR.rows[0];

      const bomR = await pool.query('SELECT * FROM pa_bom_items WHERE package_id=?', [sel.package_id]);
      if (!bomR.rows.length) {
        packageResults.push({ package_id: sel.package_id, paket_adi: pkg.paket_adi, adet: sel.adet, items: [], birim_maliyet: 0, toplam_maliyet: 0, eksik_kalem_sayisi: 0, bulunamadi_sayisi: 0, max_lead_time: 0, kritik_parca: null, toplam_eksik_maliyet: 0, warnings: ['Bu pakette BOM kalemi yok'] });
        continue;
      }

      // Master verileri toplu çek
      const malzNos = bomR.rows.map(b => b.malzeme_no);
      const ph = malzNos.map(() => '?').join(',');
      const masterR = await pool.query(`SELECT * FROM pa_master_materials WHERE malzeme_no IN (${ph})`, malzNos);
      const mMap = {};
      masterR.rows.forEach(m => { mMap[m.malzeme_no] = m; });

      const items = [];
      const warnings = [];

      for (const bom of bomR.rows) {
        const m = mMap[bom.malzeme_no];

        if (m) {
          // Efektif BOM miktarı: BOM'da özel miktar varsa (>1) onu kullan,
          // yoksa master'daki birim_adet kullan (asıl kullanım adedi)
          const masterBirim = parseFloat(m.birim_adet) || 1;
          const bomMiktar = parseFloat(bom.miktar) || 1;
          const effective_miktar = bomMiktar > 1 ? bomMiktar : masterBirim;
          const toplam_ihtiyac = effective_miktar * sel.adet;

          const stok = parseFloat(m.stok) || 0;
          const eksik = Math.max(0, toplam_ihtiyac - stok);
          const bm = parseFloat(m.birim_maliyet) || 0;
          const lt = parseInt(m.lead_time_gun) || 0;
          items.push({
            malzeme_no: bom.malzeme_no, parca_tanimi: m.parca_tanimi || '', bom_miktar: effective_miktar,
            toplam_ihtiyac, stok, eksik, lead_time: eksik > 0 ? lt : 0,
            birim_maliyet: bm, kalem_maliyet: effective_miktar * bm, eksik_maliyet: eksik * bm,
            tedarikci: m.tedarikci || '-', durum: eksik > 0 ? 'eksik' : 'yeterli'
          });
        } else {
          const bomMiktar = parseFloat(bom.miktar) || 1;
          const toplam_ihtiyac = bomMiktar * sel.adet;
          warnings.push(`${bom.malzeme_no} master listede bulunamadı`);
          items.push({
            malzeme_no: bom.malzeme_no, parca_tanimi: '⚠️ Master listede yok', bom_miktar: bomMiktar,
            toplam_ihtiyac, stok: 0, eksik: toplam_ihtiyac, lead_time: 0,
            birim_maliyet: 0, kalem_maliyet: 0, eksik_maliyet: 0,
            tedarikci: '-', durum: 'bulunamadi'
          });
        }
      }

      const birim_maliyet = items.reduce((s, i) => s + i.kalem_maliyet, 0);
      const eksikItems = items.filter(i => i.durum === 'eksik');
      const maxLead = Math.max(0, ...items.map(i => i.lead_time));
      const kritik = items.find(i => i.lead_time === maxLead && i.lead_time > 0);

      packageResults.push({
        package_id: sel.package_id, paket_adi: pkg.paket_adi, adet: sel.adet,
        birim_maliyet,
        toplam_maliyet: birim_maliyet * sel.adet,
        eksik_kalem_sayisi: eksikItems.length,
        bulunamadi_sayisi: items.filter(i => i.durum === 'bulunamadi').length,
        max_lead_time: maxLead,
        kritik_parca: kritik ? { malzeme_no: kritik.malzeme_no, tanimi: kritik.parca_tanimi, lead_time: kritik.lead_time } : null,
        toplam_eksik_maliyet: items.reduce((s, i) => s + i.eksik_maliyet, 0),
        items, warnings
      });
    }

    // Kombine analiz
    const allItems = packageResults.flatMap(r => r.items);
    const validItems = allItems.filter(i => i.durum !== 'bulunamadi');

    // Risk analizi
    const risk_analysis = {
      critical_lead_time: validItems.filter(i => i.lead_time >= 30).sort((a, b) => b.lead_time - a.lead_time),
      zero_stock: validItems.filter(i => i.stok === 0 && i.eksik > 0),
      high_cost: [...validItems].sort((a, b) => b.eksik_maliyet - a.eksik_maliyet).slice(0, 10),
      single_supplier: (() => {
        const supMap = {};
        validItems.forEach(i => { if (i.tedarikci && i.tedarikci !== '-') { supMap[i.tedarikci] = (supMap[i.tedarikci] || 0) + 1; } });
        return validItems.filter(i => i.tedarikci && i.tedarikci !== '-' && supMap[i.tedarikci] === 1);
      })()
    };

    // Tedarikçi dağılımı
    const supplier_distribution = {};
    validItems.forEach(i => {
      const sup = i.tedarikci && i.tedarikci !== '-' ? i.tedarikci : 'Belirtilmemiş';
      supplier_distribution[sup] = (supplier_distribution[sup] || 0) + i.kalem_maliyet;
    });

    // Pareto analizi
    const sortedCost = [...validItems].sort((a, b) => b.kalem_maliyet - a.kalem_maliyet);
    const totalCost = sortedCost.reduce((s, i) => s + i.kalem_maliyet, 0);
    let cum = 0;
    const pareto = sortedCost.map(i => {
      cum += i.kalem_maliyet;
      return { malzeme_no: i.malzeme_no, parca_tanimi: i.parca_tanimi, kalem_maliyet: i.kalem_maliyet, cumulative_percent: totalCost > 0 ? Math.round(cum / totalCost * 1000) / 10 : 0 };
    });

    // Senaryo simülasyonu (1 paket için farklı adetler)
    const firstPkg = packageResults[0];
    const scenarios = firstPkg ? [1, 5, 10, 25, 50, 100].map(n => {
      let eksikMal = 0;
      let toplamMal = 0;
      for (const item of firstPkg.items) {
        const need = item.bom_miktar * n;
        const short = Math.max(0, need - item.stok);
        eksikMal += short * item.birim_maliyet;
        toplamMal += item.bom_miktar * item.birim_maliyet * n;
      }
      return { adet: n, toplam_maliyet: toplamMal, eksik_maliyet: eksikMal };
    }) : [];

    res.json({
      packages: packageResults,
      combined: {
        toplam_maliyet: packageResults.reduce((s, p) => s + (p.toplam_maliyet || 0), 0),
        toplam_eksik_maliyet: packageResults.reduce((s, p) => s + (p.toplam_eksik_maliyet || 0), 0),
        max_lead_time: Math.max(0, ...packageResults.map(p => p.max_lead_time || 0)),
        toplam_kalem: allItems.length,
        toplam_eksik_kalem: allItems.filter(i => i.durum === 'eksik').length,
        risk_analysis, supplier_distribution, pareto, scenarios
      }
    });
  } catch (error) {
    console.error('Analiz hatası:', error);
    res.status(500).json({ error: 'Analiz hatası: ' + error.message });
  }
});

// İstatistikler
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const mc = await pool.query('SELECT COUNT(*) as c FROM pa_master_materials');
    const pc = await pool.query('SELECT COUNT(*) as c FROM pa_bom_packages');
    const bc = await pool.query('SELECT COUNT(*) as c FROM pa_bom_items');
    const al = await pool.query('SELECT COALESCE(AVG(lead_time_gun),0) as v FROM pa_master_materials WHERE lead_time_gun>0');
    const sv = await pool.query('SELECT COALESCE(SUM(stok * birim_maliyet),0) as v FROM pa_master_materials');
    res.json({
      material_count: parseInt(mc.rows[0].c),
      package_count: parseInt(pc.rows[0].c),
      bom_item_count: parseInt(bc.rows[0].c),
      avg_lead_time: Math.round(parseFloat(al.rows[0].v)),
      total_stock_value: parseFloat(sv.rows[0].v)
    });
  } catch (error) { res.status(500).json({ error: 'İstatistik hatası' }); }
});

export default router;
