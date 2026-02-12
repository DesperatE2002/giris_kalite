import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import pool from '../db/database.js';

const router = express.Router();

// ─── PERFORMANS PUANI HESAPLAMA ──────────────────────────────────────────────

function calculatePerformanceScore(difficulty, durationMinutes) {
  if (!durationMinutes || durationMinutes <= 0) return 0;
  // Beklenen süre: zorluk * 120 dakika (2 saat)
  const expectedMinutes = difficulty * 120;
  // Oran: beklenen / gerçek (hızlı bitirme = yüksek oran)
  const ratio = expectedMinutes / durationMinutes;
  // Puan: zorluk * oran, min 0.5, max 10
  const raw = difficulty * ratio;
  return Math.round(Math.min(10, Math.max(0.5, raw)) * 10) / 10;
}

// ─── TEKNİKER LİSTESİ ───────────────────────────────────────────────────────

// Aktif teknikerleri getir (admin için)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, role FROM users WHERE role = 'tekniker' AND is_active = 1 ORDER BY full_name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Tekniker listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ─── İŞ GÜCÜ GÖRÜNÜRLÜĞÜ ────────────────────────────────────────────────────

// Kim boşta, kim çalışıyor, kim yoğun
router.get('/workforce', authenticateToken, async (req, res) => {
  try {
    // Tüm teknikerler
    const techResult = await pool.query(
      `SELECT id, username, full_name FROM users WHERE role = 'tekniker' AND is_active = 1 ORDER BY full_name`
    );
    const technicians = techResult.rows;

    // Her tekniker için aktif görev sayısı
    const today = new Date().toISOString().split('T')[0];
    const assignmentResult = await pool.query(
      `SELECT assigned_to, 
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_today
       FROM tech_assignments 
       WHERE status IN ('active', 'pending') 
         OR (status = 'completed' AND DATE(completed_at) = ?)
       GROUP BY assigned_to`,
      [today]
    );

    const assignmentMap = {};
    assignmentResult.rows.forEach(r => {
      assignmentMap[r.assigned_to] = {
        active: parseInt(r.active_count) || 0,
        pending: parseInt(r.pending_count) || 0,
        completed_today: parseInt(r.completed_today) || 0
      };
    });

    const workforce = technicians.map(t => {
      const stats = assignmentMap[t.id] || { active: 0, pending: 0, completed_today: 0 };
      let availability = 'free'; // boşta
      if (stats.active > 0) availability = 'busy'; // çalışıyor
      if (stats.active + stats.pending >= 3) availability = 'overloaded'; // yoğun
      
      return {
        ...t,
        active_tasks: stats.active,
        pending_tasks: stats.pending,
        completed_today: stats.completed_today,
        availability
      };
    });

    res.json(workforce);
  } catch (error) {
    console.error('İşgücü görünürlüğü hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ─── GÖREV CRUD ──────────────────────────────────────────────────────────────

// Tüm görevleri getir (admin: hepsi, tekniker: kendininki)
router.get('/assignments', authenticateToken, async (req, res) => {
  try {
    const { status, assigned_to, date } = req.query;
    let query = `
      SELECT a.*, 
        u1.full_name as assigned_to_name,
        u2.full_name as assigned_by_name
      FROM tech_assignments a
      LEFT JOIN users u1 ON a.assigned_to = u1.id
      LEFT JOIN users u2 ON a.assigned_by = u2.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 0;

    // Tekniker sadece kendi görevlerini görür
    if (req.user.role === 'tekniker') {
      paramIdx++;
      query += ` AND a.assigned_to = ?`;
      params.push(req.user.id);
    } else if (assigned_to) {
      paramIdx++;
      query += ` AND a.assigned_to = ?`;
      params.push(assigned_to);
    }

    if (status) {
      paramIdx++;
      query += ` AND a.status = ?`;
      params.push(status);
    }

    if (date) {
      paramIdx++;
      query += ` AND DATE(a.created_at) = ?`;
      params.push(date);
    }

    query += ` ORDER BY 
      CASE a.status 
        WHEN 'active' THEN 1 
        WHEN 'pending' THEN 2 
        WHEN 'blocked' THEN 3 
        WHEN 'completed' THEN 4 
      END, a.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Görev listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Görev oluştur (admin)
router.post('/assignments', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { title, description, assigned_to, difficulty, notes } = req.body;

    if (!title || !assigned_to) {
      return res.status(400).json({ error: 'Görev adı ve tekniker seçimi gereklidir' });
    }

    const result = await pool.query(
      `INSERT INTO tech_assignments (title, description, assigned_to, assigned_by, difficulty, notes)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      [title, description || null, assigned_to, req.user.id, difficulty || 3, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Görev oluşturma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Görev güncelle (admin)
router.put('/assignments/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { title, description, assigned_to, difficulty, notes, status } = req.body;

    const result = await pool.query(
      `UPDATE tech_assignments SET title = ?, description = ?, assigned_to = ?, 
        difficulty = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? RETURNING *`,
      [title, description || null, assigned_to, difficulty || 3, notes || null, status || 'pending', req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Görev bulunamadı' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Görev güncelleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Görev sil (admin)
router.delete('/assignments/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM tech_activity_logs WHERE assignment_id = ?', [req.params.id]);
    const result = await pool.query('DELETE FROM tech_assignments WHERE id = ?', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Görev bulunamadı' });
    }
    res.json({ message: 'Görev silindi' });
  } catch (error) {
    console.error('Görev silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ─── TEKNİKER AKSİYONLARI ───────────────────────────────────────────────────

// Görevi başlat
router.post('/assignments/:id/start', authenticateToken, async (req, res) => {
  try {
    // Sadece kendi görevi mi kontrol et
    const check = await pool.query('SELECT * FROM tech_assignments WHERE id = ?', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Görev bulunamadı' });
    
    const assignment = check.rows[0];
    if (req.user.role === 'tekniker' && assignment.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Bu görev size atanmamış' });
    }

    if (assignment.status === 'completed') {
      return res.status(400).json({ error: 'Bu görev zaten tamamlanmış' });
    }

    // Görevi başlat
    await pool.query(
      `UPDATE tech_assignments SET status = 'active', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );

    // Aktivite logu
    await pool.query(
      `INSERT INTO tech_activity_logs (assignment_id, user_id, action, note) VALUES (?, ?, 'start', ?)`,
      [req.params.id, req.user.id, req.body.note || 'Görev başlatıldı']
    );

    const updated = await pool.query(
      `SELECT a.*, u1.full_name as assigned_to_name FROM tech_assignments a LEFT JOIN users u1 ON a.assigned_to = u1.id WHERE a.id = ?`,
      [req.params.id]
    );
    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Görev başlatma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Görevi tamamla
router.post('/assignments/:id/complete', authenticateToken, async (req, res) => {
  try {
    const check = await pool.query('SELECT * FROM tech_assignments WHERE id = ?', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Görev bulunamadı' });
    
    const assignment = check.rows[0];
    if (req.user.role === 'tekniker' && assignment.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Bu görev size atanmamış' });
    }

    if (assignment.status === 'completed') {
      return res.status(400).json({ error: 'Bu görev zaten tamamlanmış' });
    }

    // Süre hesapla (dakika)
    let durationMinutes = 0;
    if (assignment.started_at) {
      const startedAt = new Date(assignment.started_at);
      const now = new Date();
      durationMinutes = Math.round((now - startedAt) / (1000 * 60));
    }

    // Performans puanı hesapla
    const score = calculatePerformanceScore(assignment.difficulty || 3, durationMinutes);

    // Güncelle
    await pool.query(
      `UPDATE tech_assignments SET status = 'completed', completed_at = CURRENT_TIMESTAMP, 
        actual_duration_minutes = ?, performance_score = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [durationMinutes, score, req.params.id]
    );

    // Aktivite logu
    await pool.query(
      `INSERT INTO tech_activity_logs (assignment_id, user_id, action, note) VALUES (?, ?, 'complete', ?)`,
      [req.params.id, req.user.id, req.body.note || `Görev tamamlandı (${durationMinutes} dk, puan: ${score})`]
    );

    const updated = await pool.query(
      `SELECT a.*, u1.full_name as assigned_to_name FROM tech_assignments a LEFT JOIN users u1 ON a.assigned_to = u1.id WHERE a.id = ?`,
      [req.params.id]
    );
    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Görev tamamlama hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Görevi bloke et
router.post('/assignments/:id/block', authenticateToken, async (req, res) => {
  try {
    const check = await pool.query('SELECT * FROM tech_assignments WHERE id = ?', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Görev bulunamadı' });
    
    const assignment = check.rows[0];
    if (req.user.role === 'tekniker' && assignment.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Bu görev size atanmamış' });
    }

    await pool.query(
      `UPDATE tech_assignments SET status = 'blocked', blocked_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.body.reason || 'Belirtilmedi', req.params.id]
    );

    await pool.query(
      `INSERT INTO tech_activity_logs (assignment_id, user_id, action, note) VALUES (?, ?, 'block', ?)`,
      [req.params.id, req.user.id, req.body.reason || 'Görev bloke edildi']
    );

    const updated = await pool.query(
      `SELECT a.*, u1.full_name as assigned_to_name FROM tech_assignments a LEFT JOIN users u1 ON a.assigned_to = u1.id WHERE a.id = ?`,
      [req.params.id]
    );
    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Görev bloke hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ─── GÜNLÜK RAPOR ────────────────────────────────────────────────────────────

router.get('/daily-report', authenticateToken, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Bugünkü tamamlananlar
    const completed = await pool.query(
      `SELECT a.*, u.full_name as assigned_to_name 
       FROM tech_assignments a 
       LEFT JOIN users u ON a.assigned_to = u.id 
       WHERE DATE(a.completed_at) = ? 
       ORDER BY a.completed_at DESC`,
      [date]
    );

    // Bugünkü aktifler
    const active = await pool.query(
      `SELECT a.*, u.full_name as assigned_to_name
       FROM tech_assignments a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.status = 'active'
       ORDER BY a.started_at`
    );

    // Bugünkü bloklar
    const blocked = await pool.query(
      `SELECT a.*, u.full_name as assigned_to_name
       FROM tech_assignments a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.status = 'blocked'
       ORDER BY a.updated_at DESC`
    );

    // Kişi bazlı süre özet
    const personSummary = await pool.query(
      `SELECT u.full_name, 
        COUNT(*) as task_count,
        COALESCE(SUM(a.actual_duration_minutes), 0) as total_minutes,
        COALESCE(AVG(a.performance_score), 0) as avg_score
       FROM tech_assignments a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE DATE(a.completed_at) = ?
       GROUP BY u.full_name
       ORDER BY total_minutes DESC`,
      [date]
    );

    // Bugünkü aktivite logları
    const logs = await pool.query(
      `SELECT l.*, u.full_name, a.title as task_title
       FROM tech_activity_logs l
       LEFT JOIN users u ON l.user_id = u.id
       LEFT JOIN tech_assignments a ON l.assignment_id = a.id
       WHERE DATE(l.created_at) = ?
       ORDER BY l.created_at DESC
       LIMIT 50`,
      [date]
    );

    res.json({
      date,
      completed: completed.rows,
      active: active.rows,
      blocked: blocked.rows,
      person_summary: personSummary.rows,
      activity_logs: logs.rows,
      summary: {
        total_completed: completed.rows.length,
        total_active: active.rows.length,
        total_blocked: blocked.rows.length,
        total_minutes: completed.rows.reduce((s, r) => s + (parseInt(r.actual_duration_minutes) || 0), 0)
      }
    });
  } catch (error) {
    console.error('Günlük rapor hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ─── LİDERLİK TABLOSU ───────────────────────────────────────────────────────

router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const period = req.query.period || 'all'; // week, month, all

    let dateFilter = '';
    const dateParams = [];
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = `AND a.completed_at >= ?`;
      dateParams.push(weekAgo.toISOString());
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      dateFilter = `AND a.completed_at >= ?`;
      dateParams.push(monthAgo.toISOString());
    }

    const result = await pool.query(`
      SELECT 
        u.id, u.full_name, u.username,
        COUNT(a.id) as total_tasks,
        COALESCE(SUM(a.actual_duration_minutes), 0) as total_minutes,
        COALESCE(AVG(a.performance_score), 0) as avg_score,
        COALESCE(SUM(a.performance_score), 0) as total_score,
        COALESCE(AVG(a.difficulty), 0) as avg_difficulty,
        MAX(a.performance_score) as best_score
      FROM users u
      LEFT JOIN tech_assignments a ON a.assigned_to = u.id AND a.status = 'completed' ${dateFilter}
      WHERE u.role = 'tekniker' AND u.is_active = 1
      GROUP BY u.id, u.full_name, u.username
      ORDER BY total_score DESC, avg_score DESC
    `, dateParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Liderlik tablosu hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
