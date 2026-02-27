// ─── PROJE TAKİP MODÜLÜ ──────────────────────────────────────────────────────
const ProjectsPage = {
  projects: [],
  currentProject: null,
  currentTab: 'dashboard',

  async render() {
    showLoading(true);
    const container = document.getElementById('content');

    try {
      this.projects = await api.request('/projects');
    } catch (e) {
      this.projects = [];
    }

    container.innerHTML = `
      <div class="max-w-7xl mx-auto">
        <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-white flex items-center">
              <i class="fas fa-project-diagram mr-3 text-purple-600"></i>
              Proje Takip
            </h1>
            <p class="text-gray-400 mt-1">Proje süreçlerini yönetin, takip edin</p>
          </div>
          <button onclick="ProjectsPage.showCreateProject()" 
            class="gradient-btn text-white px-6 py-3 rounded-xl font-semibold hover-lift flex items-center">
            <i class="fas fa-plus mr-2"></i>Yeni Proje
          </button>
        </div>

        <!-- Proje Seçimi -->
        <div id="projectSelector" class="mb-6">
          ${this.projects.length === 0 ? `
            <div class="glass-card rounded-2xl p-12 text-center">
              <i class="fas fa-folder-open text-6xl text-gray-300 mb-4"></i>
              <h3 class="text-xl font-semibold text-gray-400">Henüz proje yok</h3>
              <p class="text-gray-400 mt-2">Yeni bir proje oluşturarak başlayın</p>
            </div>
          ` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              ${this.projects.map(p => `
                <div onclick="ProjectsPage.selectProject(${p.id})" 
                  class="glass-card rounded-xl p-5 cursor-pointer hover-lift transition-all border-2 ${this.currentProject?.id === p.id ? 'border-purple-500 shadow-lg' : 'border-transparent'}">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="font-bold text-white truncate">${p.name}</h3>
                    <div class="flex gap-1">
                      <button onclick="event.stopPropagation();ProjectsPage.showEditProject(${p.id})" class="text-gray-400 hover:text-blue-500 p-1"><i class="fas fa-edit text-sm"></i></button>
                      <button onclick="event.stopPropagation();ProjectsPage.deleteProject(${p.id})" class="text-gray-400 hover:text-red-500 p-1"><i class="fas fa-trash text-sm"></i></button>
                    </div>
                  </div>
                  <div class="flex items-center gap-3 text-sm text-gray-400 mb-3">
                    <span><i class="fas fa-calendar mr-1"></i>${p.start_date}</span>
                    <span><i class="fas fa-tasks mr-1"></i>${p.task_count || 0} görev</span>
                    ${p.linked_otpa_number ? `<span class="text-blue-400"><i class="fas fa-link mr-1"></i>${p.linked_otpa_number}</span>` : ''}
                  </div>
                  <div class="w-full bg-gray-700 rounded-full h-2.5 mb-1">
                    <div class="h-2.5 rounded-full transition-all ${(p.progress_percent || 0) === 100 ? 'bg-green-500' : 'bg-purple-500'}" 
                      style="width: ${p.progress_percent || 0}%"></div>
                  </div>
                  <div class="flex justify-between text-xs text-gray-400">
                    <span>%${p.progress_percent || 0}</span>
                    <span>${p.overdue_count > 0 
                      ? `<span class="text-red-500 font-bold">${p.overdue_count} gecikme!</span>${p.delay_workdays > 0 ? ` <span class="text-yellow-400">(+${p.delay_workdays} gün)</span>` : ''}` 
                      : (p.estimated_end_date || '—')}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Proje Detayı -->
        <div id="projectDetail" class="${this.currentProject ? '' : 'hidden'}"></div>
      </div>
    `;

    if (this.currentProject) {
      await this.loadProjectDetail(this.currentProject.id);
    }

    showLoading(false);
  },

  // ─── PROJE SEÇ & DETAY YÜKLE ──────────────────────────────────────────

  async selectProject(id) {
    showLoading(true);
    await this.loadProjectDetail(id);
    showLoading(false);
  },

  async loadProjectDetail(id) {
    try {
      this.currentProject = await api.request(`/projects/${id}`);
    } catch (e) {
      alert('Proje yüklenemedi: ' + e.message);
      return;
    }

    // Proje kartı seçimini güncelle
    document.querySelectorAll('#projectSelector .glass-card').forEach(el => {
      el.classList.remove('border-purple-500', 'shadow-lg');
      el.classList.add('border-transparent');
    });
    event?.target?.closest?.('.glass-card')?.classList?.add('border-purple-500', 'shadow-lg');

    const detail = document.getElementById('projectDetail');
    if (!detail) return;
    detail.classList.remove('hidden');

    detail.innerHTML = `
      <!-- Tab Nav -->
      <div class="glass-card rounded-xl mb-6 overflow-hidden">
        <div class="border-b border-white/5 flex">
          <button onclick="ProjectsPage.switchTab('dashboard')" class="ptab-btn px-6 py-4 text-sm font-medium ${this.currentTab === 'dashboard' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-gray-400 hover:text-gray-200'}" data-tab="dashboard">
            <i class="fas fa-tachometer-alt mr-2"></i>Dashboard
          </button>
          <button onclick="ProjectsPage.switchTab('tasks')" class="ptab-btn px-6 py-4 text-sm font-medium ${this.currentTab === 'tasks' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-gray-400 hover:text-gray-200'}" data-tab="tasks">
            <i class="fas fa-list mr-2"></i>Görevler
          </button>
          <button onclick="ProjectsPage.switchTab('gantt')" class="ptab-btn px-6 py-4 text-sm font-medium ${this.currentTab === 'gantt' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-gray-400 hover:text-gray-200'}" data-tab="gantt">
            <i class="fas fa-chart-gantt mr-2"></i>Gantt
          </button>
          <button onclick="ProjectsPage.switchTab('materials')" class="ptab-btn px-6 py-4 text-sm font-medium ${this.currentTab === 'materials' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-gray-400 hover:text-gray-200'}" data-tab="materials">
            <i class="fas fa-boxes mr-2"></i>Malzeme Durumu
          </button>
        </div>
      </div>

      <div id="ptabContent"></div>
    `;

    this.switchTab(this.currentTab);
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.ptab-btn').forEach(btn => {
      if (btn.dataset.tab === tab) {
        btn.classList.add('border-b-2', 'border-purple-500', 'text-purple-600');
        btn.classList.remove('text-gray-400');
      } else {
        btn.classList.remove('border-b-2', 'border-purple-500', 'text-purple-600');
        btn.classList.add('text-gray-400');
      }
    });

    const content = document.getElementById('ptabContent');
    if (tab === 'dashboard') this.renderDashboard(content);
    else if (tab === 'tasks') this.renderTasks(content);
    else if (tab === 'gantt') this.renderGantt(content);
    else if (tab === 'materials') this.renderMaterials(content);
  },

  // ─── DASHBOARD ─────────────────────────────────────────────────────────

  renderDashboard(container) {
    const p = this.currentProject;
    const tasks = p.tasks || [];
    const today = new Date().toISOString().split('T')[0];
    
    const overdue = tasks.filter(t => t.status !== 'done' && t.calculated_end_date && t.calculated_end_date < today);
    const blocked = tasks.filter(t => t.status === 'blocked');
    const doing = tasks.filter(t => t.status === 'doing');
    const done = tasks.filter(t => t.status === 'done');
    
    // Kritik görevler
    const criticalIds = p.critical_tasks || [];
    const criticalTasks = tasks.filter(t => criticalIds.includes(t.id));

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Üst Kartlar -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div class="glass-card rounded-xl p-5">
            <div class="text-sm text-gray-400 mb-1">Planlanan Bitiş</div>
            <div class="text-xl font-bold text-white">${p.estimated_end_date || '—'}</div>
          </div>
          <div class="glass-card rounded-xl p-5 ${p.delay_workdays > 0 ? 'border border-red-500/30 bg-red-500/5' : 'border border-green-500/30 bg-green-500/5'}">
            <div class="text-sm text-gray-400 mb-1">Öngörü Bitiş</div>
            <div class="text-xl font-bold ${p.delay_workdays > 0 ? 'text-red-400' : 'text-green-400'}">${p.predicted_end_date || '—'}</div>
            ${p.delay_workdays > 0 
              ? `<div class="text-xs text-red-400 mt-1 font-semibold"><i class="fas fa-arrow-up mr-1"></i>${p.delay_workdays} iş günü gecikme</div>` 
              : `<div class="text-xs text-green-400 mt-1 font-semibold"><i class="fas fa-check mr-1"></i>Yolunda</div>`}
          </div>
          <div class="glass-card rounded-xl p-5">
            <div class="text-sm text-gray-400 mb-1">Genel İlerleme</div>
            <div class="text-3xl font-bold text-purple-600">%${p.progress_percent || 0}</div>
            <div class="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div class="h-2 rounded-full bg-purple-500" style="width:${p.progress_percent || 0}%"></div>
            </div>
          </div>
          <div class="glass-card rounded-xl p-5">
            <div class="text-sm text-gray-400 mb-1">Toplam Görev</div>
            <div class="text-3xl font-bold text-white">${tasks.length}</div>
            <div class="text-xs text-green-600 mt-1">${done.length} tamamlandı</div>
          </div>
          <div class="glass-card rounded-xl p-5">
            <div class="text-sm text-gray-400 mb-1">Sorunlar</div>
            <div class="flex items-center gap-3">
              ${blocked.length > 0 ? `<span class="text-xl font-bold text-orange-500">${blocked.length} <span class="text-xs">bloke</span></span>` : ''}
              ${overdue.length > 0 ? `<span class="text-xl font-bold text-red-500">${overdue.length} <span class="text-xs">geciken</span></span>` : ''}
              ${blocked.length === 0 && overdue.length === 0 ? '<span class="text-green-500 font-bold"><i class="fas fa-check-circle mr-1"></i>Sorun yok</span>' : ''}
            </div>
          </div>
        </div>

        <!-- Durum Dağılımı -->
        <div class="glass-card rounded-xl p-6">
          <h3 class="font-semibold text-white mb-4">Durum Dağılımı</h3>
          <div class="flex gap-2 h-8 rounded-full overflow-hidden bg-white/5">
            ${done.length > 0 ? `<div class="bg-green-500 flex items-center justify-center text-white text-xs font-bold" style="width:${tasks.length > 0 ? (done.length / tasks.length * 100) : 0}%">${done.length}</div>` : ''}
            ${doing.length > 0 ? `<div class="bg-blue-500 flex items-center justify-center text-white text-xs font-bold" style="width:${tasks.length > 0 ? (doing.length / tasks.length * 100) : 0}%">${doing.length}</div>` : ''}
            ${blocked.length > 0 ? `<div class="bg-orange-500 flex items-center justify-center text-white text-xs font-bold" style="width:${tasks.length > 0 ? (blocked.length / tasks.length * 100) : 0}%">${blocked.length}</div>` : ''}
            ${(tasks.length - done.length - doing.length - blocked.length) > 0 ? `<div class="bg-gray-500 flex items-center justify-center text-white text-xs font-bold" style="width:${tasks.length > 0 ? ((tasks.length - done.length - doing.length - blocked.length) / tasks.length * 100) : 0}%">${tasks.length - done.length - doing.length - blocked.length}</div>` : ''}
          </div>
          <div class="flex gap-4 mt-3 text-xs text-gray-400">
            <span><span class="inline-block w-3 h-3 rounded bg-green-500 mr-1"></span>Tamamlandı</span>
            <span><span class="inline-block w-3 h-3 rounded bg-blue-500 mr-1"></span>Yapılıyor</span>
            <span><span class="inline-block w-3 h-3 rounded bg-orange-500 mr-1"></span>Bloke</span>
            <span><span class="inline-block w-3 h-3 rounded bg-gray-300 mr-1"></span>Bekleyen</span>
          </div>
        </div>

        <!-- Geciken & Kritik Görevler -->
        ${overdue.length > 0 ? `
        <div class="glass-card rounded-xl p-6 border-l-4 border-red-500">
          <h3 class="font-semibold text-red-400 mb-3"><i class="fas fa-exclamation-triangle mr-2"></i>Geciken Görevler</h3>
          <div class="space-y-2">
            ${overdue.map(t => {
              const delayDays = t.task_delay_days || 0;
              return `
              <div class="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div class="flex-1 min-w-0">
                  <span class="font-medium text-white">${t.title}</span>
                  <span class="text-sm text-gray-400 ml-2">(${t.owner_text || '—'})</span>
                </div>
                <div class="flex items-center gap-3 flex-shrink-0 ml-3">
                  <div class="text-right">
                    <div class="text-xs text-gray-400">Plan: <span class="text-red-400 line-through">${t.calculated_end_date}</span></div>
                    ${t.predicted_end_date ? `<div class="text-xs text-yellow-400">Öngörü: <span class="font-bold">${t.predicted_end_date}</span></div>` : ''}
                  </div>
                  ${delayDays > 0 ? `<span class="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold whitespace-nowrap">+${delayDays} gün</span>` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
        ` : ''}

        ${criticalTasks.length > 0 ? `
        <div class="glass-card rounded-xl p-6 border-l-4 border-purple-500">
          <h3 class="font-semibold text-purple-400 mb-3"><i class="fas fa-fire mr-2"></i>Kritik Yol Görevleri</h3>
          <p class="text-xs text-gray-400 mb-3">Bu görevler gecikirse tüm proje gecikir.</p>
          <div class="space-y-2">
            ${criticalTasks.map(t => `
              <div class="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <span class="font-medium text-white">${t.title}</span>
                <span class="text-xs text-purple-400">${t.calculated_start_date} → ${t.calculated_end_date}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Export Butonları -->
        <div class="flex gap-3">
          <button onclick="ProjectsPage.exportExcel()" class="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm">
            <i class="fas fa-file-excel mr-2"></i>Excel Çıktısı
          </button>
          <button onclick="ProjectsPage.exportWord()" class="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
            <i class="fas fa-file-word mr-2"></i>Word Çıktısı
          </button>
        </div>
      </div>
    `;
  },

  // ─── GÖREVLER TAB ──────────────────────────────────────────────────────

  renderTasks(container) {
    const p = this.currentProject;
    const tasks = p.tasks || [];
    const today = new Date().toISOString().split('T')[0];

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="font-bold text-lg text-white">Görevler (${tasks.length})</h3>
          <button onclick="ProjectsPage.showTaskForm()" class="gradient-btn text-white px-4 py-2 rounded-lg text-sm font-semibold">
            <i class="fas fa-plus mr-1"></i>Görev Ekle
          </button>
        </div>

        <div id="taskFormArea"></div>

        ${tasks.length === 0 ? `
          <div class="glass-card rounded-xl p-10 text-center">
            <i class="fas fa-clipboard-list text-5xl text-gray-300 mb-3"></i>
            <p class="text-gray-400">Henüz görev eklenmedi</p>
          </div>
        ` : `
          <div class="space-y-3">
            ${tasks.map(t => {
              const isOverdue = t.status !== 'done' && t.calculated_end_date && t.calculated_end_date < today;
              const isCritical = (p.critical_tasks || []).includes(t.id);
              const depTask = t.depends_on_task_id ? tasks.find(x => x.id === t.depends_on_task_id) : null;
              const taskDelay = t.task_delay_days || 0;
              
              const statusColors = {
                'backlog': 'bg-gray-500/15 text-gray-400',
                'doing': 'bg-blue-500/15 text-blue-400',
                'blocked': 'bg-orange-500/15 text-orange-400',
                'done': 'bg-emerald-500/15 text-emerald-400'
              };
              const statusLabels = { 'backlog': 'Bekliyor', 'doing': 'Yapılıyor', 'blocked': 'Bloke', 'done': 'Tamamlandı' };

              return `
              <div class="glass-card rounded-xl p-5 ${isOverdue ? 'border-l-4 border-red-500' : ''} ${isCritical ? 'ring-2 ring-purple-200' : ''}">
                <div class="flex flex-col lg:flex-row lg:items-center gap-4">
                  <!-- Sol: Bilgi -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h4 class="font-bold text-white truncate">${t.title}</h4>
                      ${isCritical ? '<span class="text-xs bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-full font-medium">Kritik</span>' : ''}
                      ${isOverdue ? '<span class="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-bold animate-pulse">GECİKİYOR</span>' : ''}
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span><i class="fas fa-user mr-1"></i>${t.owner_text || '—'}</span>
                      <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status]}">${statusLabels[t.status]}</span>
                      <span><i class="fas fa-clock mr-1"></i>${t.duration_workdays} iş günü</span>
                      <span><i class="fas fa-calendar-alt mr-1"></i>${t.calculated_start_date} → ${t.calculated_end_date}</span>
                      ${taskDelay > 0 ? `<span class="bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-full font-medium"><i class="fas fa-chart-line mr-1"></i>Öngörü: ${t.predicted_end_date} (+${taskDelay} gün)</span>` : ''}
                      ${t.deadline ? (() => {
                        const dl = new Date(t.deadline + 'T23:59:59');
                        const diffD = Math.ceil((dl - new Date()) / (1000*60*60*24));
                        const isLate = diffD < 0 && t.status !== 'done';
                        const isClose = diffD >= 0 && diffD <= 3 && t.status !== 'done';
                        const cls = isLate ? 'bg-red-500/15 text-red-400' : isClose ? 'bg-orange-500/15 text-orange-400' : 'bg-indigo-500/15 text-indigo-400';
                        const label = t.status === 'done' ? '✓' : isLate ? `${Math.abs(diffD)} gün gecikmiş!` : diffD === 0 ? 'Bugün son gün!' : `${diffD} gün kaldı`;
                        return `<span class="${cls} px-2 py-0.5 rounded-full font-medium"><i class="fas fa-flag mr-1"></i>${new Date(t.deadline).toLocaleDateString('tr-TR')} — ${label}</span>`;
                      })() : ''}
                      ${depTask ? `<span class="text-purple-600"><i class="fas fa-link mr-1"></i>${depTask.title}</span>` : ''}
                    </div>
                    ${t.status === 'blocked' && t.blocked_reason ? `<div class="mt-1 text-xs text-orange-600"><i class="fas fa-ban mr-1"></i>${t.blocked_reason}</div>` : ''}
                    ${t.notes ? `<div class="mt-1 text-xs text-gray-400 bg-white/5 rounded px-2 py-1"><i class="fas fa-sticky-note mr-1 text-yellow-500"></i>${t.notes}</div>` : ''}
                  </div>

                  <!-- Sağ: İlerleme & Aksiyonlar -->
                  <div class="flex items-center gap-3 flex-shrink-0">
                    <!-- İlerleme -->
                    <div class="w-32">
                      <div class="flex justify-between text-xs text-gray-400 mb-1">
                        <span>İlerleme</span>
                        <span class="font-bold">%${t.progress_percent}</span>
                      </div>
                      <input type="range" min="0" max="100" step="5" value="${t.progress_percent}" 
                        class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        onchange="ProjectsPage.quickUpdateProgress(${t.id}, this.value)">
                    </div>

                    <!-- Durum Dropdown -->
                    <select onchange="ProjectsPage.quickUpdateStatus(${t.id}, this.value)" 
                      class="text-xs border rounded-lg px-2 py-1.5 bg-white/5 border-white/10 text-white">
                      <option value="backlog" ${t.status === 'backlog' ? 'selected' : ''}>Bekliyor</option>
                      <option value="doing" ${t.status === 'doing' ? 'selected' : ''}>Yapılıyor</option>
                      <option value="blocked" ${t.status === 'blocked' ? 'selected' : ''}>Bloke</option>
                      <option value="done" ${t.status === 'done' ? 'selected' : ''}>Tamamlandı</option>
                    </select>

                    <!-- Butonlar -->
                    <button onclick="ProjectsPage.showTaskForm(${t.id})" class="text-gray-400 hover:text-blue-500 p-1" title="Düzenle"><i class="fas fa-edit"></i></button>
                    <button onclick="ProjectsPage.deleteTask(${t.id})" class="text-gray-400 hover:text-red-500 p-1" title="Sil"><i class="fas fa-trash"></i></button>
                  </div>
                </div>
              </div>
            `}).join('')}
          </div>
        `}
      </div>
    `;
  },

  // ─── GANTT CHART ────────────────────────────────────────────────────────

  renderGantt(container) {
    const p = this.currentProject;
    const tasks = p.tasks || [];

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="glass-card rounded-xl p-10 text-center">
          <i class="fas fa-chart-bar text-5xl text-gray-300 mb-3"></i>
          <p class="text-gray-400">Görev ekleyin, Gantt şeması oluşturulsun</p>
        </div>
      `;
      return;
    }

    // Tarih aralığı hesapla (öngörü tarihlerini de dahil et)
    const allDates = tasks.flatMap(t => [t.calculated_start_date, t.calculated_end_date, t.predicted_end_date]).filter(Boolean);
    const minDate = new Date(allDates.reduce((a, b) => a < b ? a : b));
    const maxDate = new Date(allDates.reduce((a, b) => a > b ? a : b));
    
    // Ekstra boşluk
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 3);

    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
    const dayWidth = Math.max(28, Math.min(50, 900 / totalDays));
    const chartWidth = totalDays * dayWidth;
    const today = new Date().toISOString().split('T')[0];

    // Gün başlıkları oluştur
    let headerHtml = '';
    let monthHeaders = '';
    let currentMonth = '';
    let monthStartX = 0;
    let monthCount = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(minDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayNum = d.getDate();
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isToday = dateStr === today;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (monthKey !== currentMonth) {
        if (currentMonth) {
          const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
          const [y, m] = currentMonth.split('-');
          monthHeaders += `<div class="absolute top-0 text-xs font-bold text-gray-400 border-l border-white/10 px-1" style="left:${monthStartX}px;width:${(i * dayWidth) - monthStartX}px">${monthNames[parseInt(m) - 1]} ${y}</div>`;
        }
        currentMonth = monthKey;
        monthStartX = i * dayWidth;
      }

      headerHtml += `
        <div class="absolute top-0 text-center text-xs select-none ${isWeekend ? 'bg-white/5 text-gray-500' : 'text-gray-400'} ${isToday ? 'bg-purple-500/20 font-bold text-purple-400' : ''}" 
          style="left:${i * dayWidth}px;width:${dayWidth}px;height:100%">
          ${dayNum}
        </div>
      `;
    }

    // Son ay
    if (currentMonth) {
      const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      const [y, m] = currentMonth.split('-');
      monthHeaders += `<div class="absolute top-0 text-xs font-bold text-gray-400 border-l border-white/10 px-1" style="left:${monthStartX}px;width:${chartWidth - monthStartX}px">${monthNames[parseInt(m) - 1]} ${y}</div>`;
    }

    // Bugün çizgisi
    const todayDate = new Date(today);
    const todayOffset = Math.ceil((todayDate - minDate) / (1000 * 60 * 60 * 24));
    const todayLineX = todayOffset * dayWidth;

    // Görev barları  
    const rowHeight = 44;
    const barH = 28;
    const barMargin = 8;
    const taskBars = tasks.map((t, idx) => {
      const start = new Date(t.calculated_start_date);
      const end = new Date(t.calculated_end_date);
      const startOffset = Math.ceil((start - minDate) / (1000 * 60 * 60 * 24));
      const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const x = startOffset * dayWidth;
      const w = Math.max(duration * dayWidth, dayWidth);
      const y = idx * rowHeight + barMargin;
      const isOverdue = t.status !== 'done' && t.calculated_end_date < today;
      const isCritical = (p.critical_tasks || []).includes(t.id);

      const colors = {
        'done': 'bg-green-500',
        'doing': 'bg-blue-500',
        'blocked': 'bg-orange-500',
        'backlog': 'bg-gray-400'
      };

      // Bağımlılık oku
      let arrow = '';
      if (t.depends_on_task_id) {
        const depIdx = tasks.findIndex(x => x.id === t.depends_on_task_id);
        if (depIdx >= 0) {
          const depTask = tasks[depIdx];
          const depEnd = new Date(depTask.calculated_end_date);
          const depEndOffset = Math.ceil((depEnd - minDate) / (1000 * 60 * 60 * 24));
          const depX = depEndOffset * dayWidth;
          const depY = depIdx * rowHeight + barMargin + barH / 2;
          const thisY = y + barH / 2;
          arrow = `<line x1="${depX}" y1="${depY}" x2="${x}" y2="${thisY}" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="4" marker-end="url(#arrowhead)"/>`;
        }
      }

      // Öngörü uzantısı (gecikme varsa)
      let predictedBar = '';
      if (t.predicted_end_date && t.predicted_end_date > t.calculated_end_date && t.status !== 'done') {
        const predEnd = new Date(t.predicted_end_date);
        const predDuration = Math.ceil((predEnd - end) / (1000 * 60 * 60 * 24));
        const predW = Math.max(predDuration * dayWidth, dayWidth / 2);
        predictedBar = `
          <div class="absolute rounded-r-md bg-yellow-500/30 border border-yellow-500/40 border-dashed flex items-center justify-center text-yellow-400 text-xs font-bold overflow-hidden"
            style="left:${x + w}px;top:${y}px;width:${predW}px;height:${barH}px" title="Öngörü uzantısı: ${t.calculated_end_date} → ${t.predicted_end_date} (+${t.task_delay_days || 0} iş günü)">
            +${t.task_delay_days || ''}
          </div>
        `;
      }

      return {
        html: `
          <div class="absolute rounded-md ${colors[t.status]} ${isOverdue ? 'ring-2 ring-red-400' : ''} ${isCritical ? 'ring-2 ring-purple-400' : ''} flex items-center px-2 text-white text-xs font-medium overflow-hidden cursor-pointer group shadow-sm"
            style="left:${x}px;top:${y}px;width:${w}px;height:${barH}px" title="${t.title} (${t.owner_text || '—'})">
            <span class="truncate">${t.title}</span>
            <!-- İlerleme overlay -->
            <div class="absolute left-0 top-0 h-full bg-black bg-opacity-15 rounded-md" style="width:${t.progress_percent}%"></div>
          </div>
          ${predictedBar}
        `,
        arrow
      };
    });

    const chartHeight = tasks.length * rowHeight + 10;

    container.innerHTML = `
      <div class="glass-card rounded-xl overflow-hidden">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="font-bold text-white"><i class="fas fa-chart-gantt mr-2"></i>Gantt Şeması</h3>
          <div class="flex items-center gap-3 text-xs text-gray-400">
            <span><span class="inline-block w-3 h-3 rounded bg-green-500 mr-1"></span>Tamamlandı</span>
            <span><span class="inline-block w-3 h-3 rounded bg-blue-500 mr-1"></span>Yapılıyor</span>
            <span><span class="inline-block w-3 h-3 rounded bg-orange-500 mr-1"></span>Bloke</span>
            <span><span class="inline-block w-3 h-3 rounded bg-gray-400 mr-1"></span>Bekliyor</span>
            <span><span class="inline-block w-3 h-3 rounded border border-dashed border-yellow-500 bg-yellow-500/30 mr-1"></span>Öngörü Uzantısı</span>
          </div>
        </div>

        <div class="flex">
          <!-- Sol: Görev isimleri -->
          <div class="flex-shrink-0 bg-white/5 border-r border-white/10" style="width:200px">
            <div class="h-10 border-b border-white/10 flex items-center px-3 text-xs font-bold text-gray-400">Görev</div>
            <div class="h-5 border-b border-white/10 flex items-center px-3 text-xs text-gray-400">Ay</div>
            ${tasks.map(t => `
              <div class="flex items-center px-3 text-sm truncate border-b border-white/5" style="height:${rowHeight}px">
                <span class="truncate" title="${t.title}">${t.title}</span>
              </div>
            `).join('')}
          </div>

          <!-- Sağ: Gantt alanı -->
          <div class="flex-1 overflow-x-auto">
            <!-- Gün başlıkları -->
            <div class="relative border-b" style="width:${chartWidth}px;height:10px">
            </div>
            <div class="relative border-b" style="width:${chartWidth}px;height:20px">
              ${monthHeaders}
            </div>
            <div class="relative border-b border-white/10 bg-white/5" style="width:${chartWidth}px;height:20px">
              ${headerHtml}
            </div>

            <!-- Görev barları -->
            <div class="relative" style="width:${chartWidth}px;height:${chartHeight}px">
              <!-- Satır çizgileri -->
              ${tasks.map((_, i) => `<div class="absolute w-full border-b border-white/5" style="top:${(i + 1) * rowHeight}px"></div>`).join('')}
              
              <!-- Bugün çizgisi -->
              ${todayLineX > 0 && todayLineX < chartWidth ? `
                <div class="absolute top-0 bottom-0 border-l-2 border-red-400 z-10" style="left:${todayLineX}px">
                  <div class="absolute -top-1 -left-3 text-xs text-red-500 font-bold bg-gray-900 px-1 rounded">Bugün</div>
                </div>
              ` : ''}

              <!-- Bağımlılık okları (SVG) -->
              <svg class="absolute inset-0 z-5 pointer-events-none" width="${chartWidth}" height="${chartHeight}">
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#8b5cf6"/>
                  </marker>
                </defs>
                ${taskBars.map(b => b.arrow).join('')}
              </svg>

              <!-- Görev barları -->
              ${taskBars.map(b => b.html).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ─── MALZEME DURUMU TAB ────────────────────────────────────────────────

  async renderMaterials(container) {
    const p = this.currentProject;
    container.innerHTML = `<div class="flex items-center justify-center h-32"><i class="fas fa-spinner fa-spin text-3xl text-purple-400"></i></div>`;

    if (!p.linked_otpa_id) {
      // OTPA bağlı değil — OTPA listesini göster, kullanıcı buradan seçsin
      await this._renderOtpaSelector(container);
      return;
    }

    try {
      const data = await api.request(`/projects/${p.id}/materials`);
      
      if (!data.linked || !data.otpa) {
        container.innerHTML = `
          <div class="glass-card rounded-xl p-8 text-center">
            <i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-3"></i>
            <p class="text-gray-400">Bağlı OTPA bulunamadı.</p>
            <button onclick="ProjectsPage.unlinkOtpa()" class="mt-3 text-sm text-red-400 hover:text-red-300 underline">Bağlantıyı Kaldır</button>
          </div>`;
        return;
      }

      const { otpa, summary, materials } = data;
      
      // Component type gruplama
      const groups = {};
      materials.forEach(m => {
        const ct = m.component_type || 'Diğer';
        if (!groups[ct]) groups[ct] = [];
        groups[ct].push(m);
      });

      const groupNames = { batarya: 'Batarya', vccu: 'VCCU', junction_box: 'Junction Box', pdu: 'PDU', 'Diğer': 'Diğer' };

      container.innerHTML = `
        <div class="space-y-6">
          <!-- OTPA Bilgisi & Özet -->
          <div class="glass-card rounded-xl p-6">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 class="text-lg font-bold text-white">
                  <i class="fas fa-link text-blue-400 mr-2"></i>${otpa.otpa_number}
                </h3>
                <p class="text-sm text-gray-400 mt-1">${otpa.project_name || ''}</p>
              </div>
              <div class="flex items-center gap-6">
                <div class="text-center">
                  <div class="text-2xl font-bold ${summary.overall_pct === 100 ? 'text-green-400' : 'text-purple-400'}">${summary.overall_pct}%</div>
                  <div class="text-xs text-gray-500">Tamamlanma</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-white">${summary.completed_items}/${summary.total_items}</div>
                  <div class="text-xs text-gray-500">Malzeme</div>
                </div>
                <button onclick="ProjectsPage.unlinkOtpa()" class="text-xs text-gray-500 hover:text-red-400 transition-colors" title="OTPA bağlantısını kaldır">
                  <i class="fas fa-unlink mr-1"></i>Değiştir
                </button>
              </div>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-3 mt-4">
              <div class="h-3 rounded-full transition-all ${summary.overall_pct === 100 ? 'bg-green-500' : summary.overall_pct > 50 ? 'bg-purple-500' : 'bg-yellow-500'}" style="width:${summary.overall_pct}%"></div>
            </div>
          </div>

          <!-- Malzeme Grupları -->
          ${Object.entries(groups).map(([ct, items]) => {
            const completedInGroup = items.filter(m => m.completion_pct >= 100).length;
            return `
            <div class="glass-card rounded-xl overflow-hidden">
              <div class="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                <h4 class="font-bold text-white"><i class="fas fa-cube mr-2 text-purple-400"></i>${groupNames[ct] || ct}</h4>
                <span class="text-sm ${completedInGroup === items.length ? 'text-green-400' : 'text-gray-400'}">${completedInGroup}/${items.length} tam</span>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-gray-500 text-xs uppercase">
                      <th class="px-4 py-3">Malzeme Kodu</th>
                      <th class="px-4 py-3">Malzeme Adı</th>
                      <th class="px-4 py-3 text-center">Gereken</th>
                      <th class="px-4 py-3 text-center">Kabul</th>
                      <th class="px-4 py-3 text-center">Eksik</th>
                      <th class="px-4 py-3 text-center">Durum</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/[0.03]">
                    ${items.map(m => `
                      <tr class="hover:bg-white/[0.02] ${m.missing_quantity > 0 ? '' : 'opacity-70'}">
                        <td class="px-4 py-3 font-mono text-xs text-gray-300">${m.material_code}</td>
                        <td class="px-4 py-3 text-gray-200">${m.material_name}</td>
                        <td class="px-4 py-3 text-center text-gray-400">${m.required_quantity} ${m.unit}</td>
                        <td class="px-4 py-3 text-center ${m.total_accepted >= m.required_quantity ? 'text-green-400 font-bold' : 'text-white'}">${m.total_accepted}</td>
                        <td class="px-4 py-3 text-center ${m.missing_quantity > 0 ? 'text-red-400 font-bold' : 'text-green-400'}">${m.missing_quantity > 0 ? m.missing_quantity : '✓'}</td>
                        <td class="px-4 py-3 text-center">
                          <div class="w-16 mx-auto">
                            <div class="w-full bg-gray-700 rounded-full h-1.5">
                              <div class="h-1.5 rounded-full ${m.completion_pct >= 100 ? 'bg-green-500' : m.completion_pct > 0 ? 'bg-yellow-500' : 'bg-gray-600'}" style="width:${Math.min(100, m.completion_pct)}%"></div>
                            </div>
                            <div class="text-[10px] text-gray-500 mt-0.5">${m.completion_pct}%</div>
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
          }).join('')}
        </div>`;
    } catch (e) {
      container.innerHTML = `<div class="glass-card rounded-xl p-6 text-red-400"><i class="fas fa-exclamation-circle mr-2"></i>Malzeme bilgisi yüklenemedi: ${e.message}</div>`;
    }
  },

  // ─── OTPA SEÇİCİ (Malzeme tab içinde) ─────────────────────────────────

  async _renderOtpaSelector(container) {
    let otpaList = [];
    let fetchError = null;
    try { 
      otpaList = await api.otpa.list(); 
      if (!Array.isArray(otpaList)) otpaList = [];
    } catch(e) { 
      fetchError = e.message || 'OTPA listesi alınamadı';
      console.error('OTPA listesi hatası:', e);
    }

    if (fetchError) {
      container.innerHTML = `
        <div class="glass-card rounded-xl p-10 text-center">
          <i class="fas fa-exclamation-triangle text-5xl text-yellow-500 mb-4"></i>
          <h3 class="text-lg font-bold text-gray-400">OTPA Listesi Yüklenemedi</h3>
          <p class="text-sm text-red-400 mt-2">${fetchError}</p>
          <button onclick="ProjectsPage.renderMaterials(document.getElementById('ptabContent'))" class="mt-4 gradient-btn text-white px-6 py-2 rounded-xl font-semibold text-sm">
            <i class="fas fa-redo mr-2"></i>Tekrar Dene
          </button>
        </div>`;
      return;
    }

    if (otpaList.length === 0) {
      container.innerHTML = `
        <div class="glass-card rounded-xl p-10 text-center">
          <i class="fas fa-inbox text-5xl text-gray-500 mb-4"></i>
          <h3 class="text-lg font-bold text-gray-400">Henüz OTPA Kaydı Yok</h3>
          <p class="text-sm text-gray-500 mt-2">Prosedür & OTPA modülünden OTPA oluşturun, sonra buradan bağlayın.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="space-y-4">
        <div class="glass-card rounded-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-white">
              <i class="fas fa-link text-blue-400 mr-2"></i>OTPA Bağla
            </h3>
            <p class="text-sm text-gray-400">Bir OTPA seçerek malzeme takibini başlatın</p>
          </div>
          <!-- Arama -->
          <input type="text" id="otpaSearchInput" placeholder="OTPA veya proje adı ara..." 
            onInput="ProjectsPage._filterOtpaList()"
            class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-purple-500 focus:outline-none text-white text-sm mb-4">
        </div>

        <!-- OTPA Tamamlama Raporu Tablosu -->
        <div class="glass-card rounded-xl overflow-hidden">
          <div class="px-6 py-4 bg-white/[0.02] border-b border-white/5">
            <h4 class="font-bold text-white"><i class="fas fa-clipboard-list mr-2 text-purple-400"></i>OTPA Tamamlama Raporu</h4>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm" id="otpaListTable">
              <thead>
                <tr class="text-left text-gray-500 text-xs uppercase">
                  <th class="px-4 py-3">OTPA</th>
                  <th class="px-4 py-3">Proje</th>
                  <th class="px-4 py-3 text-center">Toplam</th>
                  <th class="px-4 py-3 text-center">Tamamlanan</th>
                  <th class="px-4 py-3 text-center">%</th>
                  <th class="px-4 py-3 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.03]" id="otpaListBody">
                ${otpaList.map(o => {
                  const pct = o.total_items > 0 ? Math.round(o.completed_items / o.total_items * 100) : 0;
                  const pctColor = pct === 100 ? 'text-green-400' : pct > 50 ? 'text-blue-400' : pct > 0 ? 'text-yellow-400' : 'text-gray-500';
                  const barColor = pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-blue-500' : pct > 0 ? 'bg-yellow-500' : 'bg-gray-600';
                  return `
                  <tr class="hover:bg-white/[0.04] cursor-pointer otpa-row transition-colors" data-search="${(o.otpa_number + ' ' + (o.project_name || '')).toLowerCase()}">
                    <td class="px-4 py-4">
                      <span class="font-bold text-white">${o.otpa_number}</span>
                    </td>
                    <td class="px-4 py-4 text-gray-300">${o.project_name || '-'}</td>
                    <td class="px-4 py-4 text-center text-gray-400">${o.total_items}</td>
                    <td class="px-4 py-4 text-center text-gray-300">${o.completed_items}</td>
                    <td class="px-4 py-4 text-center">
                      <div class="flex items-center justify-center gap-2">
                        <span class="font-bold ${pctColor}">${pct}%</span>
                        <div class="w-16 bg-gray-700 rounded-full h-2">
                          <div class="h-2 rounded-full ${barColor} transition-all" style="width:${pct}%"></div>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-4 text-center">
                      <button onclick="event.stopPropagation();ProjectsPage.linkOtpaToProject(${o.id})" 
                        class="gradient-btn text-white px-4 py-2 rounded-lg text-xs font-semibold hover:scale-105 transition-transform">
                        <i class="fas fa-link mr-1"></i>Bağla
                      </button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  },

  _filterOtpaList() {
    const q = (document.getElementById('otpaSearchInput')?.value || '').toLowerCase();
    document.querySelectorAll('#otpaListBody .otpa-row').forEach(row => {
      row.style.display = row.dataset.search.includes(q) ? '' : 'none';
    });
  },

  async linkOtpaToProject(otpaId) {
    const p = this.currentProject;
    if (!p) return;
    try {
      showLoading(true);
      await api.request(`/projects/${p.id}`, { 
        method: 'PUT', 
        body: JSON.stringify({ name: p.name, start_date: p.start_date, linked_otpa_id: otpaId }) 
      });
      // Proje verisini yenile
      this.currentProject = await api.request(`/projects/${p.id}`);
      // Listeyi de yenile (OTPA badge göstermek için)
      const listResult = await api.request('/projects');
      this.projects = listResult;
      // Malzeme tab'ını yeniden render et
      const content = document.getElementById('ptabContent');
      if (content) await this.renderMaterials(content);
    } catch (e) { 
      alert('OTPA bağlama hatası: ' + e.message); 
    } finally { 
      showLoading(false); 
    }
  },

  async unlinkOtpa() {
    const p = this.currentProject;
    if (!p) return;
    if (!confirm('OTPA bağlantısını kaldırmak istediğinize emin misiniz?')) return;
    try {
      showLoading(true);
      await api.request(`/projects/${p.id}`, { 
        method: 'PUT', 
        body: JSON.stringify({ name: p.name, start_date: p.start_date, linked_otpa_id: null }) 
      });
      this.currentProject = await api.request(`/projects/${p.id}`);
      const listResult = await api.request('/projects');
      this.projects = listResult;
      const content = document.getElementById('ptabContent');
      if (content) await this.renderMaterials(content);
    } catch (e) { 
      alert('Hata: ' + e.message); 
    } finally { 
      showLoading(false); 
    }
  },

  // ─── GÖREV FORM ────────────────────────────────────────────────────────

  showTaskForm(editId = null) {
    const p = this.currentProject;
    const tasks = p.tasks || [];
    const task = editId ? tasks.find(t => t.id === editId) : null;

    const formArea = document.getElementById('taskFormArea');
    formArea.innerHTML = `
      <div class="glass-card rounded-xl p-6 mb-4 border-2 border-purple-200">
        <h4 class="font-bold text-white mb-4">${task ? 'Görevi Düzenle' : 'Yeni Görev'}</h4>
        <form id="taskForm" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Görev Adı *</label>
              <input type="text" id="tf_title" value="${task?.title || ''}" required
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Görev adı">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Sorumlu Kişi</label>
              <input type="text" id="tf_owner" value="${task?.owner_text || ''}" 
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Kimin üzerinde?">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Süre (İş Günü)</label>
              <input type="number" id="tf_duration" value="${task?.duration_workdays || 1}" min="1"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Durum</label>
              <select id="tf_status" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
                <option value="backlog" ${task?.status === 'backlog' ? 'selected' : ''}>Bekliyor</option>
                <option value="doing" ${task?.status === 'doing' ? 'selected' : ''}>Yapılıyor</option>
                <option value="blocked" ${task?.status === 'blocked' ? 'selected' : ''}>Bloke</option>
                <option value="done" ${task?.status === 'done' ? 'selected' : ''}>Tamamlandı</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">İlerleme (%)</label>
              <div class="flex items-center gap-3">
                <input type="range" id="tf_progress" min="0" max="100" step="5" value="${task?.progress_percent || 0}"
                  class="flex-1 accent-purple-600" oninput="document.getElementById('tf_progressLabel').textContent = this.value + '%'">
                <span id="tf_progressLabel" class="text-sm font-bold text-purple-600 w-12">${task?.progress_percent || 0}%</span>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Manuel Başlangıç (opsiyonel)</label>
              <input type="date" id="tf_manual_start" value="${task?.manual_start_date || ''}"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
            </div>
            <div>
              <label class="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1">
                <input type="checkbox" id="tf_hasDep" ${task?.depends_on_task_id ? 'checked' : ''}
                  onchange="document.getElementById('tf_depSelect').style.display = this.checked ? 'block' : 'none'">
                Bağımlı mı?
              </label>
              <select id="tf_depSelect" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${task?.depends_on_task_id ? '' : 'hidden'}">
                <option value="">Bağımlılık yok</option>
                ${tasks.filter(t => t.id !== editId).map(t => `
                  <option value="${t.id}" ${task?.depends_on_task_id === t.id ? 'selected' : ''}>${t.title}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Blocked Reason -->
          <div id="tf_blockedArea" class="${task?.status === 'blocked' ? '' : 'hidden'}">
            <label class="block text-sm font-medium text-gray-300 mb-1">Bloke Sebebi</label>
            <input type="text" id="tf_blocked_reason" value="${task?.blocked_reason || ''}" 
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500" placeholder="Neden bloke?">
          </div>

          <!-- Notlar -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1"><i class="fas fa-sticky-note text-yellow-500 mr-1"></i>Notlar</label>
            <textarea id="tf_notes" rows="2" 
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Görevle ilgili kısa notlar...">${task?.notes || ''}</textarea>
          </div>

          <!-- Son Tarih (Deadline) -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1"><i class="fas fa-calendar-times text-red-400 mr-1"></i>Son Tarih (Deadline)</label>
            <input type="date" id="tf_deadline" value="${task?.deadline || ''}"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
            <p class="text-xs text-gray-400 mt-1">Opsiyonel — belirlenirse otomatik hesaplanan bitiş yerine bu tarih kullanılır</p>
          </div>

          <div class="flex gap-3">
            <button type="submit" class="gradient-btn text-white px-6 py-2 rounded-lg font-semibold">
              <i class="fas fa-save mr-1"></i>${task ? 'Güncelle' : 'Ekle'}
            </button>
            <button type="button" onclick="document.getElementById('taskFormArea').innerHTML=''" 
              class="px-6 py-2 border rounded-lg text-gray-400 hover:bg-white/[0.03]">Iptal</button>
          </div>
        </form>
      </div>
    `;

    // Status change → show/hide blocked reason
    document.getElementById('tf_status').addEventListener('change', (e) => {
      document.getElementById('tf_blockedArea').classList.toggle('hidden', e.target.value !== 'blocked');
    });

    document.getElementById('taskForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveTask(editId);
    });
  },

  async saveTask(editId) {
    const data = {
      title: document.getElementById('tf_title').value,
      owner_text: document.getElementById('tf_owner').value,
      duration_workdays: parseInt(document.getElementById('tf_duration').value) || 1,
      status: document.getElementById('tf_status').value,
      progress_percent: parseInt(document.getElementById('tf_progress').value) || 0,
      manual_start_date: document.getElementById('tf_manual_start').value || null,
      depends_on_task_id: document.getElementById('tf_hasDep').checked ? (parseInt(document.getElementById('tf_depSelect').value) || null) : null,
      blocked_reason: document.getElementById('tf_status').value === 'blocked' ? document.getElementById('tf_blocked_reason').value : null,
      notes: document.getElementById('tf_notes').value || null,
      deadline: document.getElementById('tf_deadline').value || null
    };

    // Done ise %100 yap
    if (data.status === 'done') data.progress_percent = 100;

    try {
      showLoading(true);
      if (editId) {
        await api.request(`/projects/${this.currentProject.id}/tasks/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        await api.request(`/projects/${this.currentProject.id}/tasks`, { method: 'POST', body: JSON.stringify(data) });
      }
      await this.loadProjectDetail(this.currentProject.id);
    } catch (e) {
      alert('Hata: ' + e.message);
    } finally {
      showLoading(false);
    }
  },

  async quickUpdateProgress(taskId, value) {
    try {
      const task = this.currentProject.tasks.find(t => t.id === taskId);
      if (!task) return;
      await api.request(`/projects/${this.currentProject.id}/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...task, progress_percent: parseInt(value), depends_on_task_id: task.depends_on_task_id || null })
      });
      await this.loadProjectDetail(this.currentProject.id);
    } catch (e) {
      alert('Hata: ' + e.message);
    }
  },

  async quickUpdateStatus(taskId, status) {
    try {
      const task = this.currentProject.tasks.find(t => t.id === taskId);
      if (!task) return;
      const data = { ...task, status, depends_on_task_id: task.depends_on_task_id || null };
      if (status === 'done') data.progress_percent = 100;
      if (status === 'blocked' && !task.blocked_reason) {
        const reason = prompt('Bloke sebebi:');
        if (!reason) return;
        data.blocked_reason = reason;
      }
      await api.request(`/projects/${this.currentProject.id}/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      await this.loadProjectDetail(this.currentProject.id);
    } catch (e) {
      alert('Hata: ' + e.message);
    }
  },

  async deleteTask(taskId) {
    if (!confirm('Bu görevi silmek istediğinize emin misiniz?')) return;
    try {
      showLoading(true);
      await api.request(`/projects/${this.currentProject.id}/tasks/${taskId}`, { method: 'DELETE' });
      await this.loadProjectDetail(this.currentProject.id);
    } catch (e) {
      alert('Hata: ' + e.message);
    } finally {
      showLoading(false);
    }
  },

  // ─── PROJE CRUD UI ─────────────────────────────────────────────────────

  async showCreateProject() {
    let otpaList = [];
    try { otpaList = await api.otpa.list(); } catch(e) {}
    
    const modal = document.createElement('div');
    modal.className = 'project-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-bold text-white"><i class="fas fa-folder-plus mr-2 text-purple-400"></i>Yeni Proje</h2>
          <button onclick="this.closest('.project-modal').remove()" class="text-gray-400 hover:text-red-400 p-2"><i class="fas fa-times"></i></button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-1">Proje Adı *</label>
            <input type="text" id="cp_name" class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-purple-500 focus:outline-none text-white" placeholder="Proje adı">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-1">Başlangıç Tarihi *</label>
            <input type="date" id="cp_start" value="${new Date().toISOString().split('T')[0]}" class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-purple-500 focus:outline-none text-white">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-1">
              <i class="fas fa-link mr-1 text-blue-400"></i>Bağlı OTPA (Malzeme Takibi)
            </label>
            <select id="cp_otpa" class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-purple-500 focus:outline-none text-white">
              <option value="">— OTPA Bağlama (opsiyonel) —</option>
              ${otpaList.map(o => `<option value="${o.id}">${o.otpa_number} — ${o.project_name || ''}</option>`).join('')}
            </select>
            <p class="text-xs text-gray-500 mt-1">OTPA bağlarsanız proje detayında malzeme durumu görüntülenir</p>
          </div>
          <button onclick="ProjectsPage._saveNewProject()" class="w-full gradient-btn text-white py-3 rounded-xl font-semibold">
            <i class="fas fa-save mr-2"></i>Oluştur
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  async _saveNewProject() {
    const name = document.getElementById('cp_name')?.value?.trim();
    const start_date = document.getElementById('cp_start')?.value;
    const linked_otpa_id = document.getElementById('cp_otpa')?.value || null;
    if (!name || !start_date) { alert('Proje adı ve başlangıç tarihi gerekli'); return; }
    
    // Modalı hemen kapat
    document.querySelector('.project-modal')?.remove();
    
    try {
      showLoading(true);
      const project = await api.request('/projects', { 
        method: 'POST', 
        body: JSON.stringify({ name, start_date, linked_otpa_id: linked_otpa_id ? parseInt(linked_otpa_id) : null }) 
      });
      this.currentProject = { id: project.id };
      showLoading(false);
      await this.render();
    } catch (e) { 
      showLoading(false);
      alert('Hata: ' + e.message); 
    }
  },

  async showEditProject(id) {
    const p = this.projects.find(x => x.id === id);
    if (!p) return;
    let otpaList = [];
    try { otpaList = await api.otpa.list(); } catch(e) {}
    
    const modal = document.createElement('div');
    modal.className = 'project-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-bold text-white"><i class="fas fa-edit mr-2 text-blue-400"></i>Proje Düzenle</h2>
          <button onclick="this.closest('.project-modal').remove()" class="text-gray-400 hover:text-red-400 p-2"><i class="fas fa-times"></i></button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-1">Proje Adı *</label>
            <input type="text" id="ep_name" value="${p.name}" class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-purple-500 focus:outline-none text-white">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-1">Başlangıç Tarihi *</label>
            <input type="date" id="ep_start" value="${p.start_date}" class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-purple-500 focus:outline-none text-white">
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-1">
              <i class="fas fa-link mr-1 text-blue-400"></i>Bağlı OTPA (Malzeme Takibi)
            </label>
            <select id="ep_otpa" class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-purple-500 focus:outline-none text-white">
              <option value="">— OTPA Bağlama Yok —</option>
              ${otpaList.map(o => `<option value="${o.id}" ${p.linked_otpa_id == o.id ? 'selected' : ''}>${o.otpa_number} — ${o.project_name || ''}</option>`).join('')}
            </select>
          </div>
          <button onclick="ProjectsPage._saveEditProject(${id})" class="w-full gradient-btn text-white py-3 rounded-xl font-semibold">
            <i class="fas fa-save mr-2"></i>Kaydet
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  async _saveEditProject(id) {
    const name = document.getElementById('ep_name')?.value?.trim();
    const start_date = document.getElementById('ep_start')?.value;
    const linked_otpa_id = document.getElementById('ep_otpa')?.value || null;
    if (!name || !start_date) { alert('Proje adı ve başlangıç tarihi gerekli'); return; }
    
    document.querySelector('.project-modal')?.remove();
    
    try {
      showLoading(true);
      await api.request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify({ name, start_date, linked_otpa_id: linked_otpa_id ? parseInt(linked_otpa_id) : null }) });
      showLoading(false);
      await this.render();
    } catch (e) { 
      showLoading(false);
      alert('Hata: ' + e.message); 
    }
  },

  async deleteProject(id) {
    if (!confirm('Bu projeyi ve tüm görevlerini silmek istediğinize emin misiniz?')) return;
    try {
      showLoading(true);
      await api.request(`/projects/${id}`, { method: 'DELETE' });
      if (this.currentProject?.id === id) this.currentProject = null;
      await this.render();
    } catch (e) {
      alert('Hata: ' + e.message);
    } finally {
      showLoading(false);
    }
  },

  // ─── EXPORT ─────────────────────────────────────────────────────────────

  async exportExcel() {
    try {
      showLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const data = await api.request(`/projects/${this.currentProject.id}/export?today=${today}`);
      
      // CSV olarak üret (Excel uyumlu)
      const BOM = '\uFEFF';
      let csv = BOM;
      csv += `"PROJE RAPORU"\n`;
      csv += `"Proje","${data.project.name}"\n`;
      csv += `"Başlangıç","${data.project.start_date}"\n`;
      csv += `"Tahmini Bitiş","${data.project.estimated_end_date || '-'}"\n`;
      csv += `"Öngörü Bitiş","${data.project.predicted_end_date || '-'}"\n`;
      csv += `"Gecikme (iş günü)","${data.project.delay_workdays || 0}"\n`;
      csv += `"İlerleme","%${data.project.progress_percent}"\n`;
      csv += `"Rapor Tarihi","${data.project.export_date}"\n\n`;
      
      csv += `"ÖZET"\n`;
      csv += `"Toplam Görev","${data.summary.total_tasks}"\n`;
      csv += `"Tamamlanan","${data.summary.done}"\n`;
      csv += `"Yapılan","${data.summary.doing}"\n`;
      csv += `"Bloke","${data.summary.blocked}"\n`;
      csv += `"Bekleyen","${data.summary.backlog}"\n`;
      csv += `"Geciken","${data.summary.overdue}"\n\n`;
      
      csv += `"GÖREVLER"\n`;
      csv += `"Görev","Sorumlu","Durum","Süre (gün)","İlerleme (%)","Başlangıç","Bitiş","Öngörü Bitiş","Gecikme (gün)","Bağımlılık","Bloke Sebebi","Gecikiyor"\n`;
      
      const statusTR = { 'backlog': 'Bekliyor', 'doing': 'Yapılıyor', 'blocked': 'Bloke', 'done': 'Tamamlandı' };
      data.tasks.forEach(t => {
        csv += `"${t.title}","${t.owner}","${statusTR[t.status] || t.status}","${t.duration}","${t.progress}","${t.start_date}","${t.end_date}","${t.predicted_end_date || t.end_date}","${t.task_delay_days || 0}","${t.dependency}","${t.blocked_reason}","${t.is_overdue ? 'EVET' : 'Hayır'}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${data.project.name.replace(/\s+/g, '_')}_Rapor_${data.project.export_date}.csv`;
      link.click();
    } catch (e) {
      alert('Export hatası: ' + e.message);
    } finally {
      showLoading(false);
    }
  },

  async exportWord() {
    try {
      showLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const data = await api.request(`/projects/${this.currentProject.id}/export?today=${today}`);
      
      const statusTR = { 'backlog': 'Bekliyor', 'doing': 'Yapılıyor', 'blocked': 'Bloke', 'done': 'Tamamlandı' };
      const statusColor = { 'done': '#16a34a', 'doing': '#2563eb', 'blocked': '#ea580c', 'backlog': '#6b7280' };
      
      // Profesyonel Word raporu — doğru sayfa düzeni
      let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:SpellingState>Clean</w:SpellingState>
  <w:GrammarState>Clean</w:GrammarState>
  <w:DoNotOptimizeForBrowser/>
  <w:AllowPNG/>
</w:WordDocument>
<o:OfficeDocumentSettings>
  <o:AllowPNG/>
  <o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
<![endif]-->
<style>
  /* Sayfa Ayarları */
  @page {
    size: A4 landscape;
    margin: 1.5cm 2cm 2cm 2cm;
    mso-header-margin: .5cm;
    mso-footer-margin: .75cm;
    mso-page-orientation: landscape;
  }
  @page Section1 {
    size: 29.7cm 21cm;
    margin: 1.5cm 2cm 2cm 2cm;
    mso-header-margin: .5cm;
    mso-footer-margin: .75cm;
    mso-page-orientation: landscape;
  }
  div.Section1 { page: Section1; }

  /* Genel Stiller */
  body {
    font-family: Calibri, 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    color: #1f2937;
    line-height: 1.4;
    margin: 0;
    padding: 0;
  }

  /* Başlık Alanı */
  .report-header {
    border-bottom: 3px solid #4f46e5;
    padding-bottom: 12pt;
    margin-bottom: 16pt;
  }
  .report-title {
    font-size: 20pt;
    font-weight: bold;
    color: #312e81;
    margin: 0 0 4pt 0;
    letter-spacing: -0.5pt;
  }
  .report-subtitle {
    font-size: 10pt;
    color: #6b7280;
    margin: 0;
  }

  /* Bilgi Kutusu */
  .info-box {
    background: #f8fafc;
    border: 1pt solid #e2e8f0;
    border-radius: 4pt;
    padding: 10pt 14pt;
    margin-bottom: 16pt;
  }
  .info-grid {
    border-collapse: collapse;
    width: 100%;
  }
  .info-grid td {
    border: none;
    padding: 3pt 8pt;
    font-size: 10pt;
    vertical-align: top;
  }
  .info-label {
    font-weight: bold;
    color: #4b5563;
    width: 140pt;
    white-space: nowrap;
  }
  .info-value {
    color: #1f2937;
  }

  /* İlerleme Çubuğu */
  .progress-bar-outer {
    background: #e5e7eb;
    height: 14pt;
    border-radius: 7pt;
    overflow: hidden;
    width: 200pt;
    display: inline-block;
    vertical-align: middle;
  }
  .progress-bar-inner {
    height: 14pt;
    border-radius: 7pt;
    background: #4f46e5;
  }

  /* Bölüm Başlıkları */
  .section-title {
    font-size: 13pt;
    font-weight: bold;
    color: #312e81;
    border-bottom: 2pt solid #e0e7ff;
    padding-bottom: 5pt;
    margin: 18pt 0 10pt 0;
  }

  /* Özet Kartları Tablosu */
  .summary-cards {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 14pt;
  }
  .summary-cards td {
    border: 1pt solid #e5e7eb;
    padding: 8pt 12pt;
    text-align: center;
    width: 16.66%;
    vertical-align: top;
  }
  .summary-number {
    font-size: 18pt;
    font-weight: bold;
    display: block;
    margin-bottom: 2pt;
  }
  .summary-label {
    font-size: 8pt;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
  }

  /* Görev Tablosu */
  table.task-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 9pt;
    margin-bottom: 14pt;
  }
  table.task-table th {
    background: #312e81;
    color: white;
    padding: 6pt 8pt;
    text-align: left;
    font-weight: bold;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.3pt;
    border: 1pt solid #312e81;
  }
  table.task-table td {
    border: 1pt solid #d1d5db;
    padding: 5pt 8pt;
    vertical-align: top;
  }
  table.task-table tr:nth-child(even) {
    background: #f9fafb;
  }
  table.task-table tr.overdue-row {
    background: #fef2f2;
  }
  table.task-table tr.done-row {
    background: #f0fdf4;
  }

  /* Durum Badge */
  .status-badge {
    padding: 2pt 6pt;
    border-radius: 3pt;
    font-size: 8pt;
    font-weight: bold;
    white-space: nowrap;
  }

  /* Mini İlerleme */
  .mini-progress {
    background: #e5e7eb;
    height: 6pt;
    border-radius: 3pt;
    overflow: hidden;
    width: 60pt;
    margin-top: 2pt;
  }
  .mini-progress-fill {
    height: 6pt;
    border-radius: 3pt;
  }

  /* Geciken Tablo */
  .overdue-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 9.5pt;
    margin-bottom: 14pt;
  }
  .overdue-table th {
    background: #dc2626;
    color: white;
    padding: 6pt 10pt;
    text-align: left;
    font-weight: bold;
    border: 1pt solid #dc2626;
  }
  .overdue-table td {
    border: 1pt solid #fca5a5;
    padding: 5pt 10pt;
    background: #fef2f2;
  }

  /* Footer */
  .report-footer {
    margin-top: 20pt;
    padding-top: 8pt;
    border-top: 1pt solid #d1d5db;
    text-align: center;
    font-size: 8pt;
    color: #9ca3af;
  }

  /* Sayfa Kesme */
  .page-break {
    page-break-before: always;
    mso-break-type: section-break;
  }
</style>
</head>
<body>
<div class="Section1">

  <!-- BAŞLIK -->
  <div class="report-header">
    <p class="report-title">📊 ${data.project.name}</p>
    <p class="report-subtitle">Proje Durum Raporu — ${data.project.export_date}</p>
  </div>

  <!-- PROJE BİLGİLERİ -->
  <div class="info-box">
    <table class="info-grid">
      <tr>
        <td class="info-label">Proje Adı:</td>
        <td class="info-value"><strong>${data.project.name}</strong></td>
        <td class="info-label">Rapor Tarihi:</td>
        <td class="info-value">${data.project.export_date}</td>
      </tr>
      <tr>
        <td class="info-label">Başlangıç Tarihi:</td>
        <td class="info-value">${data.project.start_date}</td>
        <td class="info-label">Planlanan Bitiş:</td>
        <td class="info-value"><strong>${data.project.estimated_end_date || '—'}</strong></td>
      </tr>
      <tr>
        <td class="info-label">Öngörü Bitiş:</td>
        <td class="info-value"><strong style="color:${data.project.delay_workdays > 0 ? '#dc2626' : '#16a34a'};">${data.project.predicted_end_date || '—'}</strong>
          ${data.project.delay_workdays > 0 ? `<span style="color:#dc2626;font-size:9pt;margin-left:6pt;">(+${data.project.delay_workdays} iş günü gecikme)</span>` : `<span style="color:#16a34a;font-size:9pt;margin-left:6pt;">✓ Yolunda</span>`}
        </td>
        <td class="info-label">Rapor Tarihi:</td>
        <td class="info-value">${data.project.export_date}</td>
      </tr>
      <tr>
        <td class="info-label">Genel İlerleme:</td>
        <td class="info-value" colspan="3">
          <strong>%${data.project.progress_percent}</strong>
          <span style="margin-left:8pt;">
            <span class="progress-bar-outer">
              <span class="progress-bar-inner" style="width:${data.project.progress_percent}%;"></span>
            </span>
          </span>
        </td>
      </tr>
    </table>
  </div>

  <!-- ÖZET KARTLARI -->
  <p class="section-title">📋 Görev Özeti</p>
  <table class="summary-cards">
    <tr>
      <td style="border-left:3pt solid #4f46e5;">
        <span class="summary-number" style="color:#4f46e5;">${data.summary.total_tasks}</span>
        <span class="summary-label">Toplam</span>
      </td>
      <td style="border-left:3pt solid #16a34a;">
        <span class="summary-number" style="color:#16a34a;">${data.summary.done}</span>
        <span class="summary-label">Tamamlanan</span>
      </td>
      <td style="border-left:3pt solid #2563eb;">
        <span class="summary-number" style="color:#2563eb;">${data.summary.doing}</span>
        <span class="summary-label">Yapılıyor</span>
      </td>
      <td style="border-left:3pt solid #ea580c;">
        <span class="summary-number" style="color:#ea580c;">${data.summary.blocked}</span>
        <span class="summary-label">Bloke</span>
      </td>
      <td style="border-left:3pt solid #6b7280;">
        <span class="summary-number" style="color:#6b7280;">${data.summary.backlog}</span>
        <span class="summary-label">Bekleyen</span>
      </td>
      <td style="border-left:3pt solid #dc2626;">
        <span class="summary-number" style="color:#dc2626;">${data.summary.overdue}</span>
        <span class="summary-label">Geciken</span>
      </td>
    </tr>
  </table>

  <!-- GÖREV DETAY TABLOSU -->
  <p class="section-title">📝 Görev Detayları</p>
  <table class="task-table">
    <thead>
      <tr>
        <th style="width:20pt;">#</th>
        <th style="width:auto;">Görev Adı</th>
        <th style="width:80pt;">Sorumlu</th>
        <th style="width:65pt;">Durum</th>
        <th style="width:40pt;">Süre</th>
        <th style="width:55pt;">İlerleme</th>
        <th style="width:65pt;">Başlangıç</th>
        <th style="width:65pt;">Bitiş</th>
        <th style="width:65pt;">Öngörü Bitiş</th>
        <th style="width:80pt;">Bağımlılık</th>
        <th style="width:80pt;">Not</th>
      </tr>
    </thead>
    <tbody>
      ${data.tasks.map((t, i) => {
        const rowClass = t.is_overdue ? 'overdue-row' : t.status === 'done' ? 'done-row' : '';
        const statusBg = { 'done': '#dcfce7', 'doing': '#dbeafe', 'blocked': '#ffedd5', 'backlog': '#f3f4f6' }[t.status] || '#f3f4f6';
        const statusClr = statusColor[t.status] || '#6b7280';
        const progressClr = t.progress >= 80 ? '#16a34a' : t.progress >= 40 ? '#2563eb' : '#6b7280';
        return `
          <tr class="${rowClass}">
            <td style="text-align:center;font-weight:bold;color:#6b7280;">${i + 1}</td>
            <td><strong>${t.title}</strong></td>
            <td>${t.owner}</td>
            <td><span class="status-badge" style="background:${statusBg};color:${statusClr};">${statusTR[t.status] || t.status}</span></td>
            <td style="text-align:center;">${t.duration} gün</td>
            <td>
              <span style="font-weight:bold;color:${progressClr};">%${t.progress}</span>
              <div class="mini-progress"><div class="mini-progress-fill" style="width:${t.progress}%;background:${progressClr};"></div></div>
            </td>
            <td style="font-size:8.5pt;">${t.start_date}</td>
            <td style="font-size:8.5pt;${t.is_overdue ? 'color:#dc2626;font-weight:bold;' : ''}">${t.end_date}${t.is_overdue ? ' ⚠️' : ''}</td>
            <td style="font-size:8.5pt;${t.task_delay_days > 0 ? 'color:#dc2626;font-weight:bold;' : 'color:#16a34a;'}">${t.predicted_end_date || t.end_date}${t.task_delay_days > 0 ? ` (+${t.task_delay_days})` : ''}</td>
            <td style="font-size:8.5pt;">${t.dependency !== '-' ? t.dependency : ''}</td>
            <td style="font-size:8.5pt;color:#6b7280;">${t.blocked_reason !== '-' ? t.blocked_reason : ''}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  ${data.summary.overdue > 0 ? `
  <!-- GECİKEN GÖREVLER -->
  <p class="section-title" style="color:#dc2626;">⚠️ Geciken Görevler</p>
  <table class="overdue-table">
    <thead>
      <tr>
        <th>Görev</th>
        <th>Sorumlu</th>
        <th>Planlanan Bitiş</th>
        <th>Öngörü Bitiş</th>
        <th>Gecikme</th>
      </tr>
    </thead>
    <tbody>
      ${data.tasks.filter(t => t.is_overdue).map(t => {
        const daysLate = Math.ceil((new Date() - new Date(t.end_date)) / (1000*60*60*24));
        return `<tr><td><strong>${t.title}</strong></td><td>${t.owner}</td><td>${t.end_date}</td><td style="font-weight:bold;">${t.predicted_end_date || '—'}</td><td style="color:#dc2626;font-weight:bold;">+${t.task_delay_days || daysLate} iş günü</td></tr>`;
      }).join('')}
    </tbody>
  </table>
  ` : `
  <div class="info-box" style="background:#f0fdf4;border-color:#bbf7d0;">
    <p style="margin:0;color:#16a34a;font-weight:bold;">✅ Geciken görev bulunmamaktadır.</p>
  </div>
  `}

  <!-- FOOTER -->
  <div class="report-footer">
    <p style="margin:0;">Bu rapor <strong>E-LAB Süreç Kontrol</strong> sistemi tarafından ${data.project.export_date} tarihinde otomatik oluşturulmuştur.</p>
    <p style="margin:2pt 0 0 0;">Sayfa 1</p>
  </div>

</div>
</body>
</html>`;

      const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${data.project.name.replace(/\s+/g, '_')}_Rapor_${data.project.export_date}.doc`;
      link.click();
    } catch (e) {
      alert('Export hatası: ' + e.message);
    } finally {
      showLoading(false);
    }
  }
};

window.ProjectsPage = ProjectsPage;
