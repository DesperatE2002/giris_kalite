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
            <h1 class="text-3xl font-bold text-gray-800 flex items-center">
              <i class="fas fa-project-diagram mr-3 text-purple-600"></i>
              Proje Takip
            </h1>
            <p class="text-gray-600 mt-1">Proje süreçlerini yönetin, takip edin</p>
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
              <h3 class="text-xl font-semibold text-gray-500">Henüz proje yok</h3>
              <p class="text-gray-400 mt-2">Yeni bir proje oluşturarak başlayın</p>
            </div>
          ` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              ${this.projects.map(p => `
                <div onclick="ProjectsPage.selectProject(${p.id})" 
                  class="glass-card rounded-xl p-5 cursor-pointer hover-lift transition-all border-2 ${this.currentProject?.id === p.id ? 'border-purple-500 shadow-lg' : 'border-transparent'}">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="font-bold text-gray-800 truncate">${p.name}</h3>
                    <div class="flex gap-1">
                      <button onclick="event.stopPropagation();ProjectsPage.showEditProject(${p.id})" class="text-gray-400 hover:text-blue-500 p-1"><i class="fas fa-edit text-sm"></i></button>
                      <button onclick="event.stopPropagation();ProjectsPage.deleteProject(${p.id})" class="text-gray-400 hover:text-red-500 p-1"><i class="fas fa-trash text-sm"></i></button>
                    </div>
                  </div>
                  <div class="flex items-center gap-3 text-sm text-gray-500 mb-3">
                    <span><i class="fas fa-calendar mr-1"></i>${p.start_date}</span>
                    <span><i class="fas fa-tasks mr-1"></i>${p.task_count || 0} görev</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                    <div class="h-2.5 rounded-full transition-all ${(p.progress_percent || 0) === 100 ? 'bg-green-500' : 'bg-purple-500'}" 
                      style="width: ${p.progress_percent || 0}%"></div>
                  </div>
                  <div class="flex justify-between text-xs text-gray-400">
                    <span>%${p.progress_percent || 0}</span>
                    <span>${p.overdue_count > 0 ? `<span class="text-red-500 font-bold">${p.overdue_count} gecikme!</span>` : (p.estimated_end_date || '—')}</span>
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
    detail.classList.remove('hidden');

    detail.innerHTML = `
      <!-- Tab Nav -->
      <div class="glass-card rounded-xl mb-6 overflow-hidden">
        <div class="border-b border-gray-200 flex">
          <button onclick="ProjectsPage.switchTab('dashboard')" class="ptab-btn px-6 py-4 text-sm font-medium ${this.currentTab === 'dashboard' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}" data-tab="dashboard">
            <i class="fas fa-tachometer-alt mr-2"></i>Dashboard
          </button>
          <button onclick="ProjectsPage.switchTab('tasks')" class="ptab-btn px-6 py-4 text-sm font-medium ${this.currentTab === 'tasks' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}" data-tab="tasks">
            <i class="fas fa-list mr-2"></i>Görevler
          </button>
          <button onclick="ProjectsPage.switchTab('gantt')" class="ptab-btn px-6 py-4 text-sm font-medium ${this.currentTab === 'gantt' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}" data-tab="gantt">
            <i class="fas fa-chart-gantt mr-2"></i>Gantt
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
        btn.classList.remove('text-gray-500');
      } else {
        btn.classList.remove('border-b-2', 'border-purple-500', 'text-purple-600');
        btn.classList.add('text-gray-500');
      }
    });

    const content = document.getElementById('ptabContent');
    if (tab === 'dashboard') this.renderDashboard(content);
    else if (tab === 'tasks') this.renderTasks(content);
    else if (tab === 'gantt') this.renderGantt(content);
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
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="glass-card rounded-xl p-5">
            <div class="text-sm text-gray-500 mb-1">Tahmini Bitiş</div>
            <div class="text-xl font-bold text-gray-800">${p.estimated_end_date || '—'}</div>
          </div>
          <div class="glass-card rounded-xl p-5">
            <div class="text-sm text-gray-500 mb-1">Genel İlerleme</div>
            <div class="text-3xl font-bold text-purple-600">%${p.progress_percent || 0}</div>
            <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div class="h-2 rounded-full bg-purple-500" style="width:${p.progress_percent || 0}%"></div>
            </div>
          </div>
          <div class="glass-card rounded-xl p-5">
            <div class="text-sm text-gray-500 mb-1">Toplam Görev</div>
            <div class="text-3xl font-bold text-gray-800">${tasks.length}</div>
            <div class="text-xs text-green-600 mt-1">${done.length} tamamlandı</div>
          </div>
          <div class="glass-card rounded-xl p-5">
            <div class="text-sm text-gray-500 mb-1">Sorunlar</div>
            <div class="flex items-center gap-3">
              ${blocked.length > 0 ? `<span class="text-xl font-bold text-orange-500">${blocked.length} <span class="text-xs">bloke</span></span>` : ''}
              ${overdue.length > 0 ? `<span class="text-xl font-bold text-red-500">${overdue.length} <span class="text-xs">geciken</span></span>` : ''}
              ${blocked.length === 0 && overdue.length === 0 ? '<span class="text-green-500 font-bold"><i class="fas fa-check-circle mr-1"></i>Sorun yok</span>' : ''}
            </div>
          </div>
        </div>

        <!-- Durum Dağılımı -->
        <div class="glass-card rounded-xl p-6">
          <h3 class="font-semibold text-gray-800 mb-4">Durum Dağılımı</h3>
          <div class="flex gap-2 h-8 rounded-full overflow-hidden bg-gray-100">
            ${done.length > 0 ? `<div class="bg-green-500 flex items-center justify-center text-white text-xs font-bold" style="width:${tasks.length > 0 ? (done.length / tasks.length * 100) : 0}%">${done.length}</div>` : ''}
            ${doing.length > 0 ? `<div class="bg-blue-500 flex items-center justify-center text-white text-xs font-bold" style="width:${tasks.length > 0 ? (doing.length / tasks.length * 100) : 0}%">${doing.length}</div>` : ''}
            ${blocked.length > 0 ? `<div class="bg-orange-500 flex items-center justify-center text-white text-xs font-bold" style="width:${tasks.length > 0 ? (blocked.length / tasks.length * 100) : 0}%">${blocked.length}</div>` : ''}
            ${(tasks.length - done.length - doing.length - blocked.length) > 0 ? `<div class="bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-bold" style="width:${tasks.length > 0 ? ((tasks.length - done.length - doing.length - blocked.length) / tasks.length * 100) : 0}%">${tasks.length - done.length - doing.length - blocked.length}</div>` : ''}
          </div>
          <div class="flex gap-4 mt-3 text-xs text-gray-500">
            <span><span class="inline-block w-3 h-3 rounded bg-green-500 mr-1"></span>Tamamlandı</span>
            <span><span class="inline-block w-3 h-3 rounded bg-blue-500 mr-1"></span>Yapılıyor</span>
            <span><span class="inline-block w-3 h-3 rounded bg-orange-500 mr-1"></span>Bloke</span>
            <span><span class="inline-block w-3 h-3 rounded bg-gray-300 mr-1"></span>Bekleyen</span>
          </div>
        </div>

        <!-- Geciken & Kritik Görevler -->
        ${overdue.length > 0 ? `
        <div class="glass-card rounded-xl p-6 border-l-4 border-red-500">
          <h3 class="font-semibold text-red-600 mb-3"><i class="fas fa-exclamation-triangle mr-2"></i>Geciken Görevler</h3>
          <div class="space-y-2">
            ${overdue.map(t => `
              <div class="flex items-center justify-between bg-red-50 rounded-lg p-3">
                <div>
                  <span class="font-medium text-gray-800">${t.title}</span>
                  <span class="text-sm text-gray-500 ml-2">(${t.owner_text || '—'})</span>
                </div>
                <span class="text-xs text-red-600 font-bold">Bitiş: ${t.calculated_end_date}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        ${criticalTasks.length > 0 ? `
        <div class="glass-card rounded-xl p-6 border-l-4 border-purple-500">
          <h3 class="font-semibold text-purple-600 mb-3"><i class="fas fa-fire mr-2"></i>Kritik Yol Görevleri</h3>
          <p class="text-xs text-gray-500 mb-3">Bu görevler gecikirse tüm proje gecikir.</p>
          <div class="space-y-2">
            ${criticalTasks.map(t => `
              <div class="flex items-center justify-between bg-purple-50 rounded-lg p-3">
                <span class="font-medium">${t.title}</span>
                <span class="text-xs text-purple-600">${t.calculated_start_date} → ${t.calculated_end_date}</span>
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
          <h3 class="font-bold text-lg text-gray-800">Görevler (${tasks.length})</h3>
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
              
              const statusColors = {
                'backlog': 'bg-gray-100 text-gray-600',
                'doing': 'bg-blue-100 text-blue-700',
                'blocked': 'bg-orange-100 text-orange-700',
                'done': 'bg-green-100 text-green-700'
              };
              const statusLabels = { 'backlog': 'Bekliyor', 'doing': 'Yapılıyor', 'blocked': 'Bloke', 'done': 'Tamamlandı' };

              return `
              <div class="glass-card rounded-xl p-5 ${isOverdue ? 'border-l-4 border-red-500' : ''} ${isCritical ? 'ring-2 ring-purple-200' : ''}">
                <div class="flex flex-col lg:flex-row lg:items-center gap-4">
                  <!-- Sol: Bilgi -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h4 class="font-bold text-gray-800 truncate">${t.title}</h4>
                      ${isCritical ? '<span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Kritik</span>' : ''}
                      ${isOverdue ? '<span class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold animate-pulse">GECİKİYOR</span>' : ''}
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span><i class="fas fa-user mr-1"></i>${t.owner_text || '—'}</span>
                      <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status]}">${statusLabels[t.status]}</span>
                      <span><i class="fas fa-clock mr-1"></i>${t.duration_workdays} iş günü</span>
                      <span><i class="fas fa-calendar-alt mr-1"></i>${t.calculated_start_date} → ${t.calculated_end_date}</span>
                      ${t.deadline ? (() => {
                        const dl = new Date(t.deadline + 'T23:59:59');
                        const diffD = Math.ceil((dl - new Date()) / (1000*60*60*24));
                        const isLate = diffD < 0 && t.status !== 'done';
                        const isClose = diffD >= 0 && diffD <= 3 && t.status !== 'done';
                        const cls = isLate ? 'bg-red-100 text-red-700' : isClose ? 'bg-orange-100 text-orange-700' : 'bg-indigo-50 text-indigo-600';
                        const label = t.status === 'done' ? '✓' : isLate ? `${Math.abs(diffD)} gün gecikmiş!` : diffD === 0 ? 'Bugün son gün!' : `${diffD} gün kaldı`;
                        return `<span class="${cls} px-2 py-0.5 rounded-full font-medium"><i class="fas fa-flag mr-1"></i>${new Date(t.deadline).toLocaleDateString('tr-TR')} — ${label}</span>`;
                      })() : ''}
                      ${depTask ? `<span class="text-purple-600"><i class="fas fa-link mr-1"></i>${depTask.title}</span>` : ''}
                    </div>
                    ${t.status === 'blocked' && t.blocked_reason ? `<div class="mt-1 text-xs text-orange-600"><i class="fas fa-ban mr-1"></i>${t.blocked_reason}</div>` : ''}
                    ${t.notes ? `<div class="mt-1 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1"><i class="fas fa-sticky-note mr-1 text-yellow-500"></i>${t.notes}</div>` : ''}
                  </div>

                  <!-- Sağ: İlerleme & Aksiyonlar -->
                  <div class="flex items-center gap-3 flex-shrink-0">
                    <!-- İlerleme -->
                    <div class="w-32">
                      <div class="flex justify-between text-xs text-gray-500 mb-1">
                        <span>İlerleme</span>
                        <span class="font-bold">%${t.progress_percent}</span>
                      </div>
                      <input type="range" min="0" max="100" step="5" value="${t.progress_percent}" 
                        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        onchange="ProjectsPage.quickUpdateProgress(${t.id}, this.value)">
                    </div>

                    <!-- Durum Dropdown -->
                    <select onchange="ProjectsPage.quickUpdateStatus(${t.id}, this.value)" 
                      class="text-xs border rounded-lg px-2 py-1.5 bg-white">
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

    // Tarih aralığı hesapla
    const allDates = tasks.flatMap(t => [t.calculated_start_date, t.calculated_end_date]).filter(Boolean);
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
          monthHeaders += `<div class="absolute top-0 text-xs font-bold text-gray-600 border-l border-gray-200 px-1" style="left:${monthStartX}px;width:${(i * dayWidth) - monthStartX}px">${monthNames[parseInt(m) - 1]} ${y}</div>`;
        }
        currentMonth = monthKey;
        monthStartX = i * dayWidth;
      }

      headerHtml += `
        <div class="absolute top-0 text-center text-xs select-none ${isWeekend ? 'bg-gray-100 text-gray-400' : 'text-gray-500'} ${isToday ? 'bg-purple-100 font-bold text-purple-700' : ''}" 
          style="left:${i * dayWidth}px;width:${dayWidth}px;height:100%">
          ${dayNum}
        </div>
      `;
    }

    // Son ay
    if (currentMonth) {
      const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      const [y, m] = currentMonth.split('-');
      monthHeaders += `<div class="absolute top-0 text-xs font-bold text-gray-600 border-l border-gray-200 px-1" style="left:${monthStartX}px;width:${chartWidth - monthStartX}px">${monthNames[parseInt(m) - 1]} ${y}</div>`;
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

      return {
        html: `
          <div class="absolute rounded-md ${colors[t.status]} ${isOverdue ? 'ring-2 ring-red-400' : ''} ${isCritical ? 'ring-2 ring-purple-400' : ''} flex items-center px-2 text-white text-xs font-medium overflow-hidden cursor-pointer group shadow-sm"
            style="left:${x}px;top:${y}px;width:${w}px;height:${barH}px" title="${t.title} (${t.owner_text || '—'})">
            <span class="truncate">${t.title}</span>
            <!-- İlerleme overlay -->
            <div class="absolute left-0 top-0 h-full bg-black bg-opacity-15 rounded-md" style="width:${t.progress_percent}%"></div>
          </div>
        `,
        arrow
      };
    });

    const chartHeight = tasks.length * rowHeight + 10;

    container.innerHTML = `
      <div class="glass-card rounded-xl overflow-hidden">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="font-bold text-gray-800"><i class="fas fa-chart-gantt mr-2"></i>Gantt Şeması</h3>
          <div class="flex items-center gap-3 text-xs text-gray-500">
            <span><span class="inline-block w-3 h-3 rounded bg-green-500 mr-1"></span>Tamamlandı</span>
            <span><span class="inline-block w-3 h-3 rounded bg-blue-500 mr-1"></span>Yapılıyor</span>
            <span><span class="inline-block w-3 h-3 rounded bg-orange-500 mr-1"></span>Bloke</span>
            <span><span class="inline-block w-3 h-3 rounded bg-gray-400 mr-1"></span>Bekliyor</span>
          </div>
        </div>

        <div class="flex">
          <!-- Sol: Görev isimleri -->
          <div class="flex-shrink-0 bg-gray-50 border-r" style="width:200px">
            <div class="h-10 border-b flex items-center px-3 text-xs font-bold text-gray-500">Görev</div>
            <div class="h-5 border-b flex items-center px-3 text-xs text-gray-400">Ay</div>
            ${tasks.map(t => `
              <div class="flex items-center px-3 text-sm truncate border-b border-gray-100" style="height:${rowHeight}px">
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
            <div class="relative border-b bg-white" style="width:${chartWidth}px;height:20px">
              ${headerHtml}
            </div>

            <!-- Görev barları -->
            <div class="relative" style="width:${chartWidth}px;height:${chartHeight}px">
              <!-- Satır çizgileri -->
              ${tasks.map((_, i) => `<div class="absolute w-full border-b border-gray-50" style="top:${(i + 1) * rowHeight}px"></div>`).join('')}
              
              <!-- Bugün çizgisi -->
              ${todayLineX > 0 && todayLineX < chartWidth ? `
                <div class="absolute top-0 bottom-0 border-l-2 border-red-400 z-10" style="left:${todayLineX}px">
                  <div class="absolute -top-1 -left-3 text-xs text-red-500 font-bold bg-white px-1 rounded">Bugün</div>
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

  // ─── GÖREV FORM ────────────────────────────────────────────────────────

  showTaskForm(editId = null) {
    const p = this.currentProject;
    const tasks = p.tasks || [];
    const task = editId ? tasks.find(t => t.id === editId) : null;

    const formArea = document.getElementById('taskFormArea');
    formArea.innerHTML = `
      <div class="glass-card rounded-xl p-6 mb-4 border-2 border-purple-200">
        <h4 class="font-bold text-gray-800 mb-4">${task ? 'Görevi Düzenle' : 'Yeni Görev'}</h4>
        <form id="taskForm" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Görev Adı *</label>
              <input type="text" id="tf_title" value="${task?.title || ''}" required
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Görev adı">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Sorumlu Kişi</label>
              <input type="text" id="tf_owner" value="${task?.owner_text || ''}" 
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Kimin üzerinde?">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Süre (İş Günü)</label>
              <input type="number" id="tf_duration" value="${task?.duration_workdays || 1}" min="1"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Durum</label>
              <select id="tf_status" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
                <option value="backlog" ${task?.status === 'backlog' ? 'selected' : ''}>Bekliyor</option>
                <option value="doing" ${task?.status === 'doing' ? 'selected' : ''}>Yapılıyor</option>
                <option value="blocked" ${task?.status === 'blocked' ? 'selected' : ''}>Bloke</option>
                <option value="done" ${task?.status === 'done' ? 'selected' : ''}>Tamamlandı</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">İlerleme (%)</label>
              <div class="flex items-center gap-3">
                <input type="range" id="tf_progress" min="0" max="100" step="5" value="${task?.progress_percent || 0}"
                  class="flex-1 accent-purple-600" oninput="document.getElementById('tf_progressLabel').textContent = this.value + '%'">
                <span id="tf_progressLabel" class="text-sm font-bold text-purple-600 w-12">${task?.progress_percent || 0}%</span>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Manuel Başlangıç (opsiyonel)</label>
              <input type="date" id="tf_manual_start" value="${task?.manual_start_date || ''}"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
            </div>
            <div>
              <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
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
            <label class="block text-sm font-medium text-gray-700 mb-1">Bloke Sebebi</label>
            <input type="text" id="tf_blocked_reason" value="${task?.blocked_reason || ''}" 
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500" placeholder="Neden bloke?">
          </div>

          <!-- Notlar -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"><i class="fas fa-sticky-note text-yellow-500 mr-1"></i>Notlar</label>
            <textarea id="tf_notes" rows="2" 
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Görevle ilgili kısa notlar...">${task?.notes || ''}</textarea>
          </div>

          <!-- Son Tarih (Deadline) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"><i class="fas fa-calendar-times text-red-400 mr-1"></i>Son Tarih (Deadline)</label>
            <input type="date" id="tf_deadline" value="${task?.deadline || ''}"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500">
            <p class="text-xs text-gray-400 mt-1">Opsiyonel — belirlenirse otomatik hesaplanan bitiş yerine bu tarih kullanılır</p>
          </div>

          <div class="flex gap-3">
            <button type="submit" class="gradient-btn text-white px-6 py-2 rounded-lg font-semibold">
              <i class="fas fa-save mr-1"></i>${task ? 'Güncelle' : 'Ekle'}
            </button>
            <button type="button" onclick="document.getElementById('taskFormArea').innerHTML=''" 
              class="px-6 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">İptal</button>
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

  showCreateProject() {
    const name = prompt('Proje adı:');
    if (!name) return;
    const start_date = prompt('Başlangıç tarihi (YYYY-AA-GG):', new Date().toISOString().split('T')[0]);
    if (!start_date) return;
    this.createProject(name, start_date);
  },

  async createProject(name, start_date) {
    try {
      showLoading(true);
      const project = await api.request('/projects', { method: 'POST', body: JSON.stringify({ name, start_date }) });
      this.currentProject = project;
      await this.render();
      await this.selectProject(project.id);
    } catch (e) {
      alert('Hata: ' + e.message);
    } finally {
      showLoading(false);
    }
  },

  showEditProject(id) {
    const p = this.projects.find(x => x.id === id);
    if (!p) return;
    const name = prompt('Proje adı:', p.name);
    if (!name) return;
    const start_date = prompt('Başlangıç tarihi:', p.start_date);
    if (!start_date) return;
    this.updateProject(id, name, start_date);
  },

  async updateProject(id, name, start_date) {
    try {
      showLoading(true);
      await api.request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify({ name, start_date }) });
      await this.render();
    } catch (e) {
      alert('Hata: ' + e.message);
    } finally {
      showLoading(false);
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
      const data = await api.request(`/projects/${this.currentProject.id}/export`);
      
      // CSV olarak üret (Excel uyumlu)
      const BOM = '\uFEFF';
      let csv = BOM;
      csv += `"PROJE RAPORU"\n`;
      csv += `"Proje","${data.project.name}"\n`;
      csv += `"Başlangıç","${data.project.start_date}"\n`;
      csv += `"Tahmini Bitiş","${data.project.estimated_end_date || '-'}"\n`;
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
      csv += `"Görev","Sorumlu","Durum","Süre (gün)","İlerleme (%)","Başlangıç","Bitiş","Bağımlılık","Bloke Sebebi","Gecikme"\n`;
      
      const statusTR = { 'backlog': 'Bekliyor', 'doing': 'Yapılıyor', 'blocked': 'Bloke', 'done': 'Tamamlandı' };
      data.tasks.forEach(t => {
        csv += `"${t.title}","${t.owner}","${statusTR[t.status] || t.status}","${t.duration}","${t.progress}","${t.start_date}","${t.end_date}","${t.dependency}","${t.blocked_reason}","${t.is_overdue ? 'EVET' : 'Hayır'}"\n`;
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
      const data = await api.request(`/projects/${this.currentProject.id}/export`);
      
      const statusTR = { 'backlog': 'Bekliyor', 'doing': 'Yapılıyor', 'blocked': 'Bloke', 'done': 'Tamamlandı' };
      const statusColor = { 'done': '#16a34a', 'doing': '#2563eb', 'blocked': '#ea580c', 'backlog': '#6b7280' };
      
      // Profesyonel Word raporu — doğru sayfa düzeni
      let html = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
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
        <td class="info-label">Tahmini Bitiş:</td>
        <td class="info-value"><strong>${data.project.estimated_end_date || '—'}</strong></td>
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
        <th>Bitiş Tarihi</th>
        <th>Gecikme</th>
      </tr>
    </thead>
    <tbody>
      ${data.tasks.filter(t => t.is_overdue).map(t => {
        const daysLate = Math.ceil((new Date() - new Date(t.end_date)) / (1000*60*60*24));
        return `<tr><td><strong>${t.title}</strong></td><td>${t.owner}</td><td>${t.end_date}</td><td style="color:#dc2626;font-weight:bold;">${daysLate} gün</td></tr>`;
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
