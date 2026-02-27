import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireModuleAccess } from './roles.js';
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
      task.calculated_end_date = formatDate(task.deadline);
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

// ─── İŞ GÜNÜ FARKI ───────────────────────────────────────────────────────

function workdaysBetween(date1Str, date2Str) {
  const d1 = new Date(date1Str);
  const d2 = new Date(date2Str);
  if (d1 >= d2) return 0;
  let count = 0;
  const cursor = new Date(d1);
  while (cursor < d2) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isWeekend(cursor)) count++;
  }
  return count;
}

// ─── ÖNGÖRÜ BİTİŞ TARİHİ (PREDICTED END DATE) ──────────────────────────

function calculatePredictedSchedule(scheduledTasks) {
  if (!scheduledTasks || scheduledTasks.length === 0) {
    return { predicted_end_date: null, delay_workdays: 0 };
  }

  const today = formatDate(new Date());
  const taskMap = {};
  scheduledTasks.forEach(t => { taskMap[t.id] = t; });

  const resolved = new Set();

  function predictTask(taskId) {
    if (resolved.has(taskId)) return taskMap[taskId];
    const task = taskMap[taskId];
    if (!task) return null;

    // Tamamlanmış görevler: orijinal tarihleri koru
    if (task.status === 'done') {
      task.predicted_end_date = task.calculated_end_date;
      task.task_delay_days = 0;
      resolved.add(taskId);
      return task;
    }

    // Kalan iş günü hesapla
    const progress = task.progress_percent || 0;
    const totalDuration = task.duration_workdays || 1;
    const remainingDays = Math.max(1, Math.ceil((1 - progress / 100) * totalDuration));

    // En erken başlayabileceği tarih
    let earliestStart;

    if (task.depends_on_task_id && taskMap[task.depends_on_task_id]) {
      // Bağımlılık varsa — bağımlı görevin öngörü bitişinden sonra başla
      const dep = predictTask(task.depends_on_task_id);
      if (dep && dep.predicted_end_date) {
        let afterDep = new Date(dep.predicted_end_date);
        afterDep.setDate(afterDep.getDate() + 1);
        while (isWeekend(afterDep)) afterDep.setDate(afterDep.getDate() + 1);

        const todayDate = new Date(today);
        earliestStart = afterDep > todayDate ? afterDep : todayDate;
      } else {
        earliestStart = new Date(today);
      }
    } else {
      // Bağımlılık yok — orijinal başlangıç veya bugün (hangisi daha geçse)
      const originalStart = new Date(task.calculated_start_date);
      const todayDate = new Date(today);
      earliestStart = originalStart > todayDate ? originalStart : todayDate;
    }

    // Hafta sonuna denk geliyorsa ileri al
    while (isWeekend(earliestStart)) earliestStart.setDate(earliestStart.getDate() + 1);

    const predictedEnd = addWorkdays(earliestStart, remainingDays);
    task.predicted_end_date = formatDate(predictedEnd);

    // Bu görev için gecikme (iş günü)
    const origEnd = task.calculated_end_date;
    if (origEnd && task.predicted_end_date > origEnd) {
      task.task_delay_days = workdaysBetween(origEnd, task.predicted_end_date);
    } else {
      task.task_delay_days = 0;
    }

    resolved.add(taskId);
    return task;
  }

  // Tüm görevleri tahminle
  Object.keys(taskMap).forEach(id => predictTask(parseInt(id)));

  // Projenin öngörü bitiş tarihi = en geç predicted_end_date
  let maxPredicted = null;
  Object.values(taskMap).forEach(t => {
    if (t.predicted_end_date) {
      const d = new Date(t.predicted_end_date);
      if (!maxPredicted || d > maxPredicted) maxPredicted = d;
    }
  });

  const predictedEndDate = maxPredicted ? formatDate(maxPredicted) : null;
  const estimatedEndDate = calculateEstimatedEndDate(scheduledTasks);

  // Toplam proje gecikmesi (iş günü)
  let delayWorkdays = 0;
  if (estimatedEndDate && predictedEndDate && predictedEndDate > estimatedEndDate) {
    delayWorkdays = workdaysBetween(estimatedEndDate, predictedEndDate);
  }

  return { predicted_end_date: predictedEndDate, delay_workdays: delayWorkdays };
}

// ─── PROJE CRUD ──────────────────────────────────────────────────────────────

// Tüm projeleri listele
router.get('/', authenticateToken, requireModuleAccess('projects'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'blocked') as blocked_count,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'done') as done_count,
        o.otpa_number as linked_otpa_number
      FROM projects p
      LEFT JOIN otpa o ON p.linked_otpa_id = o.id
      ORDER BY COALESCE(p.is_archived, 0) ASC, p.created_at DESC
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
      
      // Öngörü bitiş tarihi
      const prediction = calculatePredictedSchedule(scheduledTasks);
      project.predicted_end_date = prediction.predicted_end_date;
      project.delay_workdays = prediction.delay_workdays;
      
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
router.get('/:id', authenticateToken, requireModuleAccess('projects'), async (req, res) => {
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
    
    // Öngörü bitiş tarihi hesapla
    const prediction = calculatePredictedSchedule(scheduledTasks);
    project.predicted_end_date = prediction.predicted_end_date;
    project.delay_workdays = prediction.delay_workdays;
    
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
router.post('/', authenticateToken, requireModuleAccess('projects'), async (req, res) => {
  try {
    const { name, start_date, linked_otpa_id } = req.body;
    if (!name || !start_date) {
      return res.status(400).json({ error: 'Proje adı ve başlangıç tarihi gereklidir' });
    }
    
    const result = await pool.query(
      `INSERT INTO projects (name, start_date, linked_otpa_id) VALUES (?, ?, ?) RETURNING *`,
      [name, start_date, linked_otpa_id || null]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Proje oluşturma hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// Proje güncelle
router.put('/:id', authenticateToken, requireModuleAccess('projects'), async (req, res) => {
  try {
    const { name, start_date, linked_otpa_id } = req.body;
    const result = await pool.query(
      `UPDATE projects SET name = ?, start_date = ?, linked_otpa_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`,
      [name, start_date, linked_otpa_id !== undefined ? (linked_otpa_id || null) : null, req.params.id]
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

// Proje arşivle / arşivden çıkar
router.patch('/:id/archive', authenticateToken, requireModuleAccess('projects'), async (req, res) => {
  try {
    const { is_archived } = req.body;
    const val = is_archived ? 1 : 0;
    const result = await pool.query(
      'UPDATE projects SET is_archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *',
      [val, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Arşiv hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// Proje sil
router.delete('/:id', authenticateToken, requireModuleAccess('projects'), async (req, res) => {
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
router.post('/:projectId/tasks', authenticateToken, requireModuleAccess('projects'), async (req, res) => {
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
router.put('/:projectId/tasks/:taskId', authenticateToken, requireModuleAccess('projects'), async (req, res) => {
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
router.delete('/:projectId/tasks/:taskId', authenticateToken, requireModuleAccess('projects'), async (req, res) => {
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

// ─── PROJE MALZEME DURUMU (OTPA BOM'UNDAN ÇEKİLİR) ────────────────────────

router.get('/:id/materials', authenticateToken, requireModuleAccess('projects'), async (req, res) => {
  try {
    const projectResult = await pool.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proje bulunamadı' });
    }
    const project = projectResult.rows[0];
    if (!project.linked_otpa_id) {
      return res.json({ linked: false, otpa: null, materials: [] });
    }

    // OTPA bilgisi
    const otpaResult = await pool.query(
      'SELECT id, otpa_number, project_name, status FROM otpa WHERE id = ?',
      [project.linked_otpa_id]
    );
    if (otpaResult.rows.length === 0) {
      return res.json({ linked: true, otpa: null, materials: [], error: 'Bağlı OTPA bulunamadı' });
    }
    const otpa = otpaResult.rows[0];

    // BOM + giriş + kalite verisini tek sorguda çek
    const bomResult = await pool.query(`
      SELECT 
        b.id,
        b.material_code,
        b.material_name,
        b.required_quantity,
        b.unit,
        b.component_type,
        COALESCE(SUM(gr.received_quantity), 0) as total_received,
        COALESCE(SUM(qr.accepted_quantity), 0) as total_accepted,
        COALESCE(SUM(qr.rejected_quantity), 0) as total_rejected
      FROM bom_items b
      LEFT JOIN goods_receipt gr ON b.otpa_id = gr.otpa_id AND b.material_code = gr.material_code
      LEFT JOIN quality_results qr ON gr.id = qr.receipt_id
      WHERE b.otpa_id = ?
      GROUP BY b.id, b.material_code, b.material_name, b.required_quantity, b.unit, b.component_type
      ORDER BY b.component_type, b.material_code
    `, [project.linked_otpa_id]);

    const materials = bomResult.rows.map(item => {
      const missing = Math.max(0, item.required_quantity - item.total_accepted);
      const pct = item.required_quantity > 0 ? Math.min(100, Math.round(item.total_accepted / item.required_quantity * 100)) : 0;
      return { ...item, missing_quantity: missing, completion_pct: pct };
    });

    const totalItems = materials.length;
    const completedItems = materials.filter(m => m.completion_pct >= 100).length;
    const overallPct = totalItems > 0 ? Math.round(completedItems / totalItems * 100) : 0;

    res.json({
      linked: true,
      otpa,
      summary: { total_items: totalItems, completed_items: completedItems, overall_pct: overallPct },
      materials
    });
  } catch (error) {
    console.error('Proje malzeme durumu hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// ─── EXCEL / WORD EXPORT ──────────────────────────────────────────────────────

// Proje rapor verisi (JSON → frontend'de Excel/Word oluşturulacak)
router.get('/:id/export', authenticateToken, requireModuleAccess('projects'), async (req, res) => {
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
    
    // Client tarafından gelen bugünün tarihini kullan (timezone uyumu için)
    const today = req.query.today || formatDate(new Date());
    
    // Öngörü hesapla
    const prediction = calculatePredictedSchedule(scheduledTasks);
    
    res.json({
      project: {
        name: project.name,
        start_date: project.start_date,
        estimated_end_date: calculateEstimatedEndDate(scheduledTasks),
        predicted_end_date: prediction.predicted_end_date,
        delay_workdays: prediction.delay_workdays,
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
        predicted_end_date: t.predicted_end_date || t.calculated_end_date,
        task_delay_days: t.task_delay_days || 0,
        dependency: t.depends_on_task_id ? scheduledTasks.find(x => x.id === t.depends_on_task_id)?.title || '-' : '-',
        blocked_reason: t.blocked_reason || '-',
        deadline: t.deadline || null,
        is_overdue: t.status !== 'done' && !!t.calculated_end_date && t.calculated_end_date < today
      })),
      summary: {
        total_tasks: scheduledTasks.length,
        done: scheduledTasks.filter(t => t.status === 'done').length,
        doing: scheduledTasks.filter(t => t.status === 'doing').length,
        blocked: scheduledTasks.filter(t => t.status === 'blocked').length,
        backlog: scheduledTasks.filter(t => t.status === 'backlog').length,
        overdue: scheduledTasks.filter(t => t.status !== 'done' && !!t.calculated_end_date && t.calculated_end_date < today).length
      }
    });
  } catch (error) {
    console.error('Export hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

export default router;
