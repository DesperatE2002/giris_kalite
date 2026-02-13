import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import pool from '../db/database.js';

const router = express.Router();

// ─── İŞ GÜNÜ HESAPLAMA ───────────────────────────────────────────────────────

function isWeekend(date) {
  const d = new Date(date);
  return d.getDay() === 0 || d.getDay() === 6;
}

function addWorkdays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) added++;
  }
  return result;
}

function formatDate(d) {
  const dt = new Date(d);
  return dt.toISOString().split('T')[0];
}

// ─── PLANLAMA ALGORİTMASI ────────────────────────────────────────────────────

function scheduleTasks(tasks, projectStartDate) {
  const taskMap = {};
  tasks.forEach(t => { taskMap[t.id] = { ...t }; });

  // Döngüsel bağımlılık kontrolü
  function hasCycle(taskId, visited = new Set()) {
    if (visited.has(taskId)) return true;
    visited.add(taskId);
    const t = taskMap[taskId];
    if (t && t.depends_on_task_id) {
      return hasCycle(t.depends_on_task_id, visited);
    }
    return false;
  }

  // Topolojik sıralama ile hesaplama
  const resolved = new Set();
  
  function resolveTask(taskId) {
    if (resolved.has(taskId)) return taskMap[taskId];
    const task = taskMap[taskId];
    if (!task) return null;

    let startDate;

    if (task.depends_on_task_id && taskMap[task.depends_on_task_id]) {
      // Bağımlılık varsa - bağımlı görev bitince başla
      if (hasCycle(taskId)) {
        // Döngüsel bağımlılık — project start kullan
        startDate = new Date(projectStartDate);
      } else {
        const dep = resolveTask(task.depends_on_task_id);
        if (dep && dep.calculated_end_date) {
          startDate = addWorkdays(dep.calculated_end_date, 0);
          // Bağımlı görevin bittiği günün ertesi iş günü
          if (isWeekend(startDate)) {
            startDate = addWorkdays(startDate, 0);
          }
          // Aslında end_date'in 1 sonraki iş günü
          startDate = new Date(dep.calculated_end_date);
          startDate.setDate(startDate.getDate() + 1);
          while (isWeekend(startDate)) {
            startDate.setDate(startDate.getDate() + 1);
          }
        } else {
          startDate = new Date(projectStartDate);
        }
      }
    } else if (task.manual_start_date) {
      startDate = new Date(task.manual_start_date);
    } else {
      startDate = new Date(projectStartDate);
    }

    // Eğer başlangıç hafta sonuna denk geliyorsa ileri al
    while (isWeekend(startDate)) {
      startDate.setDate(startDate.getDate() + 1);
    }

    const duration = task.duration_workdays || 1;
    const endDate = addWorkdays(startDate, duration);

    task.calculated_start_date = formatDate(startDate);
    task.calculated_end_date = formatDate(endDate);

    // Deadline varsa: deadline'ı kullan override olarak
    if (task.deadline) {
      task.calculated_end_date = task.deadline;
    }
    
    resolved.add(taskId);
    return task;
  }

  // Tüm görevleri çöz
  Object.keys(taskMap).forEach(id => resolveTask(parseInt(id)));

  return Object.values(taskMap);
}

function calculateProjectProgress(tasks) {
  if (!tasks || tasks.length === 0) return 0;
  const totalWeight = tasks.reduce((sum, t) => sum + (t.duration_workdays || 1), 0);
  const weightedProgress = tasks.reduce((sum, t) => sum + ((t.progress_percent || 0) * (t.duration_workdays || 1)), 0);
  return totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
}

function calculateEstimatedEndDate(tasks) {
  if (!tasks || tasks.length === 0) return null;
  let maxEnd = null;
  tasks.forEach(t => {
    if (t.calculated_end_date) {
      const d = new Date(t.calculated_end_date);
      if (!maxEnd || d > maxEnd) maxEnd = d;
    }
  });
  return maxEnd ? formatDate(maxEnd) : null;
}

// ─── PROJE CRUD ──────────────────────────────────────────────────────────────

// Tüm projeleri listele
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'blocked') as blocked_count,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'done') as done_count
      FROM projects p
      ORDER BY p.created_at DESC
    `);
    
    // Her proje için ilerleme hesapla
    for (const project of result.rows) {
      const tasksResult = await pool.query(
        'SELECT * FROM project_tasks WHERE project_id = ? ORDER BY id',
        [project.id]
      );
      const scheduledTasks = scheduleTasks(tasksResult.rows, project.start_date);
      project.progress_percent = calculateProjectProgress(scheduledTasks);
      project.estimated_end_date = calculateEstimatedEndDate(scheduledTasks);
      
      // Geciken görev sayısı
      const today = formatDate(new Date());
      project.overdue_count = scheduledTasks.filter(t => 
        t.status !== 'done' && t.calculated_end_date && t.calculated_end_date < today
      ).length;
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('Proje listesi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// Tek proje detayı (görevlerle birlikte)
router.get('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const projectResult = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    
    const project = projectResult.rows[0];
    const tasksResult = await pool.query(
      'SELECT * FROM project_tasks WHERE project_id = ? ORDER BY id',
      [project.id]
    );
    
    const scheduledTasks = scheduleTasks(tasksResult.rows, project.start_date);
    project.tasks = scheduledTasks;
    project.progress_percent = calculateProjectProgress(scheduledTasks);
    project.estimated_end_date = calculateEstimatedEndDate(scheduledTasks);
    
    // Geciken görevler
    const today = formatDate(new Date());
    project.overdue_count = scheduledTasks.filter(t => 
      t.status !== 'done' && t.calculated_end_date && t.calculated_end_date < today
    ).length;
    
    // Kritik yol hesapla
    if (scheduledTasks.length > 0) {
      const maxEnd = project.estimated_end_date;
      project.critical_tasks = scheduledTasks
        .filter(t => t.calculated_end_date === maxEnd)
        .map(t => t.id);
    } else {
      project.critical_tasks = [];
    }
    
    res.json(project);
  } catch (error) {
    console.error('Proje detayı hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// Proje oluştur
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { name, start_date } = req.body;
    if (!name || !start_date) {
      return res.status(400).json({ error: 'Proje adı ve başlangıç tarihi gereklidir' });
    }
    
    const result = await pool.query(
      `INSERT INTO projects (name, start_date) VALUES (?, ?) RETURNING *`,
      [name, start_date]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Proje oluşturma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// Proje güncelle
router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { name, start_date } = req.body;
    const result = await pool.query(
      `UPDATE projects SET name = ?, start_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`,
      [name, start_date, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Proje güncelleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// Proje sil
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM project_tasks WHERE project_id = ?', [req.params.id]);
    const result = await pool.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    
    res.json({ message: 'Proje silindi' });
  } catch (error) {
    console.error('Proje silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// ─── GÖREV CRUD ──────────────────────────────────────────────────────────────

// Görev oluştur
router.post('/:projectId/tasks', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { title, owner_text, status, duration_workdays, progress_percent, manual_start_date, depends_on_task_id, blocked_reason, notes, deadline } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Görev adı gereklidir' });
    }

    // Döngüsel bağımlılık kontrolü
    if (depends_on_task_id) {
      const depCheck = await pool.query('SELECT * FROM project_tasks WHERE id = ? AND project_id = ?', [depends_on_task_id, req.params.projectId]);
      if (depCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Bağımlı görev bu projede bulunamadı' });
      }
    }
    
    const result = await pool.query(
      `INSERT INTO project_tasks (project_id, title, owner_text, status, duration_workdays, progress_percent, manual_start_date, depends_on_task_id, blocked_reason, notes, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [req.params.projectId, title, owner_text || '', status || 'backlog', duration_workdays || 1, progress_percent || 0, manual_start_date || null, depends_on_task_id || null, blocked_reason || null, notes || null, deadline || null]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Görev oluşturma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// Görev güncelle
router.put('/:projectId/tasks/:taskId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { title, owner_text, status, duration_workdays, progress_percent, manual_start_date, depends_on_task_id, blocked_reason, notes, deadline } = req.body;
    
    // Döngüsel bağımlılık kontrolü
    if (depends_on_task_id) {
      if (parseInt(depends_on_task_id) === parseInt(req.params.taskId)) {
        return res.status(400).json({ error: 'Görev kendine bağımlı olamaz' });
      }
      
      // Zincir kontrolü — bağımlı görev bize mi bağlı?
      let checkId = depends_on_task_id;
      const visited = new Set([parseInt(req.params.taskId)]);
      while (checkId) {
        if (visited.has(parseInt(checkId))) {
          return res.status(400).json({ error: 'Döngüsel bağımlılık tespit edildi!' });
        }
        visited.add(parseInt(checkId));
        const depResult = await pool.query('SELECT depends_on_task_id FROM project_tasks WHERE id = ?', [checkId]);
        checkId = depResult.rows[0]?.depends_on_task_id || null;
      }
    }
    
    const result = await pool.query(
      `UPDATE project_tasks SET 
        title = ?, owner_text = ?, status = ?, duration_workdays = ?,
        progress_percent = ?, manual_start_date = ?, depends_on_task_id = ?,
        blocked_reason = ?, notes = ?, deadline = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND project_id = ? RETURNING *`,
      [title, owner_text || '', status || 'backlog', duration_workdays || 1, 
       progress_percent || 0, manual_start_date || null, depends_on_task_id || null,
       blocked_reason || null, notes || null, deadline || null, req.params.taskId, req.params.projectId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Görev bulunamadı' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Görev güncelleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// Görev sil
router.delete('/:projectId/tasks/:taskId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Bu göreve bağımlı olan görevlerin bağımlılığını kaldır
    await pool.query(
      'UPDATE project_tasks SET depends_on_task_id = NULL WHERE depends_on_task_id = ?',
      [req.params.taskId]
    );
    
    const result = await pool.query(
      'DELETE FROM project_tasks WHERE id = ? AND project_id = ?',
      [req.params.taskId, req.params.projectId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Görev bulunamadı' });
    }
    
    res.json({ message: 'Görev silindi' });
  } catch (error) {
    console.error('Görev silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// ─── EXCEL / WORD EXPORT ──────────────────────────────────────────────────────

// Proje rapor verisi (JSON → frontend'de Excel/Word oluşturulacak)
router.get('/:id/export', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const projectResult = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    
    const project = projectResult.rows[0];
    const tasksResult = await pool.query(
      'SELECT * FROM project_tasks WHERE project_id = ? ORDER BY id',
      [project.id]
    );
    
    const scheduledTasks = scheduleTasks(tasksResult.rows, project.start_date);
    
    const today = formatDate(new Date());
    
    res.json({
      project: {
        name: project.name,
        start_date: project.start_date,
        estimated_end_date: calculateEstimatedEndDate(scheduledTasks),
        progress_percent: calculateProjectProgress(scheduledTasks),
        export_date: today
      },
      tasks: scheduledTasks.map(t => ({
        title: t.title,
        owner: t.owner_text || '-',
        status: t.status,
        duration: t.duration_workdays,
        progress: t.progress_percent,
        start_date: t.calculated_start_date,
        end_date: t.calculated_end_date,
        dependency: t.depends_on_task_id ? scheduledTasks.find(x => x.id === t.depends_on_task_id)?.title || '-' : '-',
        blocked_reason: t.blocked_reason || '-',
        deadline: t.deadline || null,
        is_overdue: t.status !== 'done' && t.calculated_end_date < today
      })),
      summary: {
        total_tasks: scheduledTasks.length,
        done: scheduledTasks.filter(t => t.status === 'done').length,
        doing: scheduledTasks.filter(t => t.status === 'doing').length,
        blocked: scheduledTasks.filter(t => t.status === 'blocked').length,
        backlog: scheduledTasks.filter(t => t.status === 'backlog').length,
        overdue: scheduledTasks.filter(t => t.status !== 'done' && t.calculated_end_date < today).length
      }
    });
  } catch (error) {
    console.error('Export hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

export default router;
