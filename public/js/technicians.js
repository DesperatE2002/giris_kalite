// ─── TEKNİKER İŞ TAKİP MODÜLÜ ────────────────────────────────────────────────
const TechPage = {
  assignments: [],
  workforce: [],
  technicians: [],
  currentTab: 'board',
  isAdmin: false,

  async render() {
    showLoading(true);
    const container = document.getElementById('content');
    this.isAdmin = authManager.currentUser?.role === 'admin';

    try {
      const [assignments, workforce] = await Promise.all([
        api.request('/technicians/assignments'),
        this.isAdmin ? api.request('/technicians/workforce') : Promise.resolve([])
      ]);
      this.assignments = assignments;
      this.workforce = workforce;
      if (this.isAdmin) {
        this.technicians = await api.request('/technicians/users');
      }
    } catch(e) {
      this.assignments = []; this.workforce = []; this.technicians = [];
    }

    const tabs = this.isAdmin ? [
      { id: 'board', icon: 'fas fa-columns', label: 'Görev Panosu' },
      { id: 'workforce', icon: 'fas fa-users', label: 'İş Gücü' },
      { id: 'daily', icon: 'fas fa-calendar-day', label: 'Günlük Rapor' },
      { id: 'leaderboard', icon: 'fas fa-trophy', label: 'Liderlik' }
    ] : [
      { id: 'board', icon: 'fas fa-columns', label: 'Görevlerim' }
    ];

    container.innerHTML = `
      <div class="max-w-7xl mx-auto">
        <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-800 flex items-center">
              <i class="fas fa-hard-hat mr-3 text-indigo-600"></i>
              ${this.isAdmin ? 'İş Takip & Performans' : 'Görevlerim'}
            </h1>
            <p class="text-gray-600 mt-1">${this.isAdmin ? 'Tekniker atama, süre takibi ve performans yönetimi' : 'Atanmış görevlerinizi takip edin'}</p>
          </div>
          ${this.isAdmin ? `
            <button onclick="TechPage.showAssignmentForm()" 
              class="gradient-btn text-white px-6 py-3 rounded-xl font-semibold hover-lift flex items-center">
              <i class="fas fa-plus mr-2"></i>Görev Ata
            </button>
          ` : ''}
        </div>

        <!-- Tabs -->
        <div class="flex gap-2 mb-6 overflow-x-auto pb-1">
          ${tabs.map(t => `
            <button onclick="TechPage.switchTab('${t.id}')" 
              class="tech-tab flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
                ${this.currentTab === t.id ? 'gradient-btn text-white shadow-lg' : 'glass-card text-gray-600 hover:bg-gray-100'}">
              <i class="${t.icon}"></i>${t.label}
            </button>
          `).join('')}
        </div>

        <div id="techContent"></div>
        <div id="techFormArea"></div>
      </div>
    `;

    this.renderTab();
    showLoading(false);
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tech-tab').forEach(btn => {
      const id = btn.textContent.trim();
      if (btn.onclick.toString().includes(tab)) {
        btn.className = btn.className.replace('glass-card text-gray-600 hover:bg-gray-100', 'gradient-btn text-white shadow-lg');
      } else {
        btn.className = btn.className.replace('gradient-btn text-white shadow-lg', 'glass-card text-gray-600 hover:bg-gray-100');
      }
    });
    this.renderTab();
  },

  async renderTab() {
    const container = document.getElementById('techContent');
    switch(this.currentTab) {
      case 'board': this.renderBoard(container); break;
      case 'workforce': this.renderWorkforce(container); break;
      case 'daily': await this.renderDailyReport(container); break;
      case 'leaderboard': await this.renderLeaderboard(container); break;
    }
  },

  // ─── GÖREV PANOSU (KANBAN TARZINDA) ────────────────────────────────────

  renderBoard(container) {
    const statuses = [
      { id: 'pending', label: 'Bekliyor', icon: 'fas fa-clock', color: 'gray', bgColor: 'bg-gray-50' },
      { id: 'active', label: 'Çalışılıyor', icon: 'fas fa-play', color: 'blue', bgColor: 'bg-blue-50' },
      { id: 'paused', label: 'Pause', icon: 'fas fa-pause-circle', color: 'purple', bgColor: 'bg-purple-50' },
      { id: 'blocked', label: 'Bloke', icon: 'fas fa-ban', color: 'orange', bgColor: 'bg-orange-50' },
      { id: 'completed', label: 'Tamamlandı', icon: 'fas fa-check', color: 'green', bgColor: 'bg-green-50' }
    ];

    container.innerHTML = `
      <!-- Özet Kartlar -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        ${statuses.map(s => {
          const count = this.assignments.filter(a => a.status === s.id).length;
          return `
            <div class="glass-card rounded-xl p-4 border-l-4 border-${s.color}-500">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-gray-500 font-medium">${s.label}</p>
                  <p class="text-2xl font-bold text-${s.color}-600">${count}</p>
                </div>
                <i class="${s.icon} text-2xl text-${s.color}-300"></i>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Kanban Board -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        ${statuses.map(s => `
          <div class="rounded-xl ${s.bgColor} p-3">
            <h3 class="font-bold text-${s.color}-700 mb-3 flex items-center gap-2 text-sm">
              <i class="${s.icon}"></i>${s.label}
              <span class="bg-${s.color}-200 text-${s.color}-800 text-xs px-2 py-0.5 rounded-full">
                ${this.assignments.filter(a => a.status === s.id).length}
              </span>
            </h3>
            <div class="space-y-2">
              ${this.assignments.filter(a => a.status === s.id).map(a => this.renderTaskCard(a)).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderTaskCard(a) {
    const difficultyStars = '★'.repeat(a.difficulty || 3) + '☆'.repeat(5 - (a.difficulty || 3));
    const difficultyColors = ['', 'text-green-500', 'text-green-600', 'text-yellow-500', 'text-orange-500', 'text-red-500'];
    
    let durationText = '';
    if (a.status === 'active' && a.started_at) {
      const mins = Math.round((new Date() - new Date(a.started_at)) / 60000);
      durationText = mins < 60 ? `${mins} dk` : `${Math.floor(mins/60)}s ${mins%60}dk`;
    } else if (a.status === 'completed' && a.actual_duration_minutes) {
      const mins = a.actual_duration_minutes;
      durationText = mins < 60 ? `${mins} dk` : `${Math.floor(mins/60)}s ${mins%60}dk`;
    }

    let actions = '';
    if (a.status === 'pending') {
      actions = `<button onclick="TechPage.startTask(${a.id})" class="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1.5 rounded-lg transition-all"><i class="fas fa-play mr-1"></i>Başlat</button>`;
    } else if (a.status === 'active') {
      actions = `
        <div class="flex gap-1">
          <button onclick="TechPage.completeTask(${a.id})" class="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1.5 rounded-lg transition-all"><i class="fas fa-check mr-1"></i>Tamamla</button>
          <button onclick="TechPage.pauseTask(${a.id})" class="bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold py-1.5 px-2 rounded-lg transition-all" title="Pause"><i class="fas fa-pause"></i></button>
          <button onclick="TechPage.blockTask(${a.id})" class="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-1.5 px-2 rounded-lg transition-all"><i class="fas fa-ban"></i></button>
        </div>
      `;
    } else if (a.status === 'paused') {
      actions = `<button onclick="TechPage.startTask(${a.id})" class="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1.5 rounded-lg transition-all"><i class="fas fa-play mr-1"></i>Devam Et</button>`;
    } else if (a.status === 'blocked') {
      actions = `<button onclick="TechPage.startTask(${a.id})" class="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1.5 rounded-lg transition-all"><i class="fas fa-play mr-1"></i>Devam Et</button>`;
    }

    return `
      <div class="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-all border border-gray-100">
        <div class="flex items-start justify-between mb-2">
          <h4 class="font-bold text-gray-800 text-sm leading-tight flex-1">${a.title}</h4>
          ${this.isAdmin ? `
            <div class="flex gap-0.5 ml-1 flex-shrink-0">
              <button onclick="TechPage.showAssignmentForm(${a.id})" class="text-gray-300 hover:text-blue-500 p-0.5"><i class="fas fa-edit text-xs"></i></button>
              <button onclick="TechPage.deleteAssignment(${a.id})" class="text-gray-300 hover:text-red-500 p-0.5"><i class="fas fa-trash text-xs"></i></button>
            </div>
          ` : ''}
        </div>
        
        ${a.description ? `<p class="text-xs text-gray-500 mb-2 line-clamp-2">${a.description}</p>` : ''}
        
        <div class="flex flex-wrap gap-1.5 mb-2 text-xs">
          <span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"><i class="fas fa-user mr-1"></i>${a.assigned_to_name || '—'}</span>
          <span class="${difficultyColors[a.difficulty || 3]} font-medium" title="Zorluk: ${a.difficulty}/5">${difficultyStars}</span>
        </div>

        ${durationText ? `<div class="text-xs text-gray-500 mb-2"><i class="fas fa-stopwatch mr-1 text-indigo-400"></i>${durationText}</div>` : ''}
        
        ${a.performance_score ? `<div class="text-xs mb-2"><span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Puan: ${a.performance_score}</span></div>` : ''}
        
        ${a.blocked_reason && a.status === 'blocked' ? `<div class="text-xs text-orange-600 mb-2 bg-orange-50 rounded px-2 py-1"><i class="fas fa-exclamation-triangle mr-1"></i>${a.blocked_reason}</div>` : ''}
        
        ${a.notes ? `<div class="text-xs text-gray-500 mb-2 bg-gray-50 rounded px-2 py-1"><i class="fas fa-sticky-note mr-1 text-yellow-500"></i>${a.notes}</div>` : ''}

        ${a.deadline && a.status !== 'completed' ? (() => {
          const deadlineDate = new Date(a.deadline + 'T23:59:59');
          const now = new Date();
          const diffDays = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
          const isOverdue = diffDays < 0;
          const isUrgent = diffDays >= 0 && diffDays <= 2;
          const cls = isOverdue ? 'bg-red-100 text-red-700' : isUrgent ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600';
          const icon = isOverdue ? 'fa-exclamation-circle' : isUrgent ? 'fa-clock' : 'fa-calendar-alt';
          const label = isOverdue ? `${Math.abs(diffDays)} gün gecikmiş!` : diffDays === 0 ? 'Bugün son gün!' : `${diffDays} gün kaldı`;
          return `<div class="text-xs mb-2 ${cls} rounded px-2 py-1 font-medium"><i class="fas ${icon} mr-1"></i>${new Date(a.deadline).toLocaleDateString('tr-TR')} — ${label}</div>`;
        })() : ''}
        ${a.deadline && a.status === 'completed' ? `<div class="text-xs mb-2 bg-gray-50 text-gray-400 rounded px-2 py-1"><i class="fas fa-calendar-check mr-1"></i>Deadline: ${new Date(a.deadline).toLocaleDateString('tr-TR')}</div>` : ''}

        ${actions ? `<div class="mt-2">${actions}</div>` : ''}
      </div>
    `;
  },

  // ─── İŞ GÜCÜ GÖRÜNÜRLÜĞÜ ──────────────────────────────────────────────

  renderWorkforce(container) {
    const free = this.workforce.filter(w => w.availability === 'free');
    const busy = this.workforce.filter(w => w.availability === 'busy');
    const overloaded = this.workforce.filter(w => w.availability === 'overloaded');

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Boşta -->
        <div class="glass-card rounded-xl p-5">
          <h3 class="font-bold text-green-700 mb-4 flex items-center gap-2">
            <i class="fas fa-coffee text-xl"></i>Boşta
            <span class="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">${free.length}</span>
          </h3>
          <div class="space-y-3">
            ${free.length === 0 ? '<p class="text-sm text-gray-400">Herkes meşgul</p>' :
              free.map(w => `
                <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center font-bold text-green-700">${w.full_name.charAt(0)}</div>
                    <div>
                      <p class="font-semibold text-gray-800 text-sm">${w.full_name}</p>
                      <p class="text-xs text-gray-500">Bugün ${w.completed_today} görev tamamladı</p>
                    </div>
                  </div>
                  <button onclick="TechPage.showAssignmentForm(null, ${w.id})" class="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"><i class="fas fa-plus mr-1"></i>Ata</button>
                </div>
              `).join('')}
          </div>
        </div>

        <!-- Çalışıyor -->
        <div class="glass-card rounded-xl p-5">
          <h3 class="font-bold text-blue-700 mb-4 flex items-center gap-2">
            <i class="fas fa-cogs text-xl"></i>Çalışıyor
            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">${busy.length}</span>
          </h3>
          <div class="space-y-3">
            ${busy.length === 0 ? '<p class="text-sm text-gray-400">Aktif çalışan yok</p>' :
              busy.map(w => `
                <div class="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center font-bold text-blue-700">${w.full_name.charAt(0)}</div>
                    <div>
                      <p class="font-semibold text-gray-800 text-sm">${w.full_name}</p>
                      <p class="text-xs text-gray-500">${w.active_tasks} aktif, ${w.pending_tasks} bekliyor</p>
                    </div>
                  </div>
                  <span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full"><i class="fas fa-spinner fa-spin mr-1"></i>Meşgul</span>
                </div>
              `).join('')}
          </div>
        </div>

        <!-- Yoğun -->
        <div class="glass-card rounded-xl p-5">
          <h3 class="font-bold text-red-700 mb-4 flex items-center gap-2">
            <i class="fas fa-fire text-xl"></i>Yoğun
            <span class="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">${overloaded.length}</span>
          </h3>
          <div class="space-y-3">
            ${overloaded.length === 0 ? '<p class="text-sm text-gray-400">Aşırı yoğun yok</p>' :
              overloaded.map(w => `
                <div class="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-red-200 rounded-full flex items-center justify-center font-bold text-red-700">${w.full_name.charAt(0)}</div>
                    <div>
                      <p class="font-semibold text-gray-800 text-sm">${w.full_name}</p>
                      <p class="text-xs text-gray-500">${w.active_tasks} aktif, ${w.pending_tasks} bekliyor</p>
                    </div>
                  </div>
                  <span class="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full"><i class="fas fa-exclamation mr-1"></i>Yoğun</span>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  // ─── GÜNLÜK RAPOR ──────────────────────────────────────────────────────

  async renderDailyReport(container) {
    const date = document.getElementById('dailyDatePicker')?.value || new Date().toISOString().split('T')[0];
    let report;
    try {
      report = await api.request(`/technicians/daily-report?date=${date}`);
    } catch(e) {
      report = { completed: [], active: [], blocked: [], paused: [], task_grouped: [], person_summary: [], activity_logs: [], summary: {} };
    }

    const s = report.summary;
    const totalHours = Math.floor((s.total_minutes || 0) / 60);
    const totalMins = (s.total_minutes || 0) % 60;

    container.innerHTML = `
      <div class="glass-card rounded-xl p-5 mb-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h3 class="font-bold text-gray-800 text-lg"><i class="fas fa-calendar-day mr-2 text-indigo-600"></i>Günlük Faaliyet Raporu</h3>
          <div class="flex items-center gap-3">
            <input type="date" id="dailyDatePicker" value="${date}" onchange="TechPage.renderTab()" 
              class="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
            <button onclick="TechPage.generateDailyWordReport()" 
              class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 whitespace-nowrap">
              <i class="fas fa-file-word"></i>Rapor Oluştur
            </button>
          </div>
        </div>

        <!-- Özet -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div class="bg-green-50 rounded-xl p-4 text-center">
            <p class="text-3xl font-bold text-green-600">${s.total_completed || 0}</p>
            <p class="text-xs text-gray-500 mt-1">Tamamlanan</p>
          </div>
          <div class="bg-blue-50 rounded-xl p-4 text-center">
            <p class="text-3xl font-bold text-blue-600">${s.total_active || 0}</p>
            <p class="text-xs text-gray-500 mt-1">Aktif</p>
          </div>
          <div class="bg-purple-50 rounded-xl p-4 text-center">
            <p class="text-3xl font-bold text-purple-600">${s.total_paused || 0}</p>
            <p class="text-xs text-gray-500 mt-1">Pause</p>
          </div>
          <div class="bg-orange-50 rounded-xl p-4 text-center">
            <p class="text-3xl font-bold text-orange-600">${s.total_blocked || 0}</p>
            <p class="text-xs text-gray-500 mt-1">Bloke</p>
          </div>
          <div class="bg-indigo-50 rounded-xl p-4 text-center">
            <p class="text-3xl font-bold text-indigo-600">${totalHours}s ${totalMins}dk</p>
            <p class="text-xs text-gray-500 mt-1">Toplam Çalışma</p>
          </div>
        </div>

        <!-- İş Bazlı Özet -->
        ${(report.task_grouped || []).length > 0 ? `
          <h4 class="font-bold text-gray-700 mb-3"><i class="fas fa-tasks mr-2 text-indigo-500"></i>İş Bazlı Özet</h4>
          <div class="space-y-2 mb-6">
            ${report.task_grouped.map(g => {
              const durText = g.total_minutes < 60 ? `${g.total_minutes} dk` : `${Math.floor(g.total_minutes/60)}s ${g.total_minutes%60}dk`;
              const names = g.people.map(p => p.name).join(', ');
              const statusIcons = { completed: 'fa-check-circle text-green-500', active: 'fa-play-circle text-blue-500', paused: 'fa-pause-circle text-purple-500', blocked: 'fa-ban text-orange-500', pending: 'fa-clock text-gray-400' };
              const mainStatus = g.people.some(p => p.status === 'active') ? 'active' : g.people.some(p => p.status === 'paused') ? 'paused' : g.people.every(p => p.status === 'completed') ? 'completed' : g.status;
              return `
                <div class="flex items-center justify-between p-3 bg-indigo-50 rounded-lg text-sm">
                  <div class="flex items-center gap-2">
                    <i class="fas ${statusIcons[mainStatus] || 'fa-circle text-gray-400'}"></i>
                    <span class="font-semibold">${g.title}</span>
                    <span class="text-gray-500">— ${durText}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full text-xs font-bold">${g.people.length} kişi</span>
                    <span class="text-gray-600 text-xs">(${names})</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <!-- Kişi Bazlı Özet -->
        ${report.person_summary.length > 0 ? `
          <h4 class="font-bold text-gray-700 mb-3"><i class="fas fa-users mr-2"></i>Kişi Bazlı</h4>
          <div class="overflow-x-auto mb-6">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-gray-500">
                  <th class="pb-2">Tekniker</th>
                  <th class="pb-2 text-center">Görev</th>
                  <th class="pb-2 text-center">Süre</th>
                  <th class="pb-2 text-center">Ort. Puan</th>
                </tr>
              </thead>
              <tbody>
                ${report.person_summary.map(p => {
                  const hrs = Math.floor(p.total_minutes / 60);
                  const mins = p.total_minutes % 60;
                  return `
                    <tr class="border-b border-gray-50 hover:bg-gray-50">
                      <td class="py-2 font-medium">${p.full_name}</td>
                      <td class="py-2 text-center font-bold">${p.task_count}</td>
                      <td class="py-2 text-center">${hrs}s ${mins}dk</td>
                      <td class="py-2 text-center"><span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold text-xs">${parseFloat(p.avg_score).toFixed(1)}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <!-- Tamamlanan İşler -->
        ${report.completed.length > 0 ? `
          <h4 class="font-bold text-gray-700 mb-3"><i class="fas fa-check-circle text-green-500 mr-2"></i>Tamamlanan İşler</h4>
          <div class="space-y-2 mb-6">
            ${report.completed.map(a => {
              const mins = a.actual_duration_minutes || 0;
              const durText = mins < 60 ? `${mins} dk` : `${Math.floor(mins/60)}s ${mins%60}dk`;
              return `
                <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg text-sm">
                  <div>
                    <span class="font-semibold">${a.title}</span>
                    <span class="text-gray-500 ml-2">— ${a.assigned_to_name}</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-gray-500"><i class="fas fa-stopwatch mr-1"></i>${durText}</span>
                    ${a.performance_score ? `<span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold text-xs">+${a.performance_score}</span>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <!-- Yarına Kalan İşler -->
        ${(report.paused || []).length > 0 ? `
          <h4 class="font-bold text-gray-700 mb-3"><i class="fas fa-pause-circle text-purple-500 mr-2"></i>Pause Edilen İşler</h4>
          <div class="space-y-2 mb-6">
            ${report.paused.map(a => `
              <div class="flex items-center justify-between p-3 bg-purple-50 rounded-lg text-sm">
                <div>
                  <span class="font-semibold">${a.title}</span>
                  <span class="text-gray-500 ml-2">— ${a.assigned_to_name}</span>
                </div>
                <span class="text-purple-600 text-xs"><i class="fas fa-pause mr-1"></i>Pause</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Blokajlar -->
        ${report.blocked.length > 0 ? `
          <h4 class="font-bold text-gray-700 mb-3"><i class="fas fa-exclamation-triangle text-orange-500 mr-2"></i>Blokajlar</h4>
          <div class="space-y-2">
            ${report.blocked.map(a => `
              <div class="flex items-center justify-between p-3 bg-orange-50 rounded-lg text-sm">
                <div>
                  <span class="font-semibold">${a.title}</span>
                  <span class="text-gray-500 ml-2">— ${a.assigned_to_name}</span>
                </div>
                <span class="text-orange-600 text-xs">${a.blocked_reason || 'Sebep belirtilmedi'}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  // ─── LİDERLİK TABLOSU ─────────────────────────────────────────────────

  async renderLeaderboard(container) {
    const period = document.getElementById('lbPeriod')?.value || 'all';
    let data;
    try {
      data = await api.request(`/technicians/leaderboard?period=${period}`);
    } catch(e) { data = []; }

    const medals = ['🥇', '🥈', '🥉'];

    container.innerHTML = `
      <div class="glass-card rounded-xl p-5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h3 class="font-bold text-gray-800 text-lg"><i class="fas fa-trophy mr-2 text-yellow-500"></i>Liderlik Tablosu</h3>
          <select id="lbPeriod" onchange="TechPage.renderTab()" 
            class="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 text-sm">
            <option value="week" ${period === 'week' ? 'selected' : ''}>Bu Hafta</option>
            <option value="month" ${period === 'month' ? 'selected' : ''}>Bu Ay</option>
            <option value="all" ${period === 'all' ? 'selected' : ''}>Tüm Zamanlar</option>
          </select>
        </div>

        ${data.length === 0 ? `
          <div class="text-center py-8 text-gray-400">
            <i class="fas fa-trophy text-4xl mb-3"></i>
            <p>Henüz tamamlanmış görev yok</p>
          </div>
        ` : `
          <!-- Podium -->
          ${data.length >= 3 ? `
            <div class="flex items-end justify-center gap-4 mb-8 pt-4">
              ${[1, 0, 2].map(idx => {
                const d = data[idx];
                if (!d) return '';
                const heights = ['h-32', 'h-24', 'h-20'];
                const sizes = ['text-4xl', 'text-3xl', 'text-2xl'];
                const orderH = [0, 1, 2];
                return `
                  <div class="text-center flex-1 max-w-[140px]">
                    <div class="${sizes[idx]} mb-2">${medals[idx]}</div>
                    <div class="w-14 h-14 mx-auto bg-gradient-to-br from-indigo-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg mb-2">${d.full_name.charAt(0)}</div>
                    <p class="font-bold text-gray-800 text-sm truncate">${d.full_name}</p>
                    <p class="text-indigo-600 font-bold text-lg">${parseFloat(d.total_score).toFixed(1)}</p>
                    <p class="text-xs text-gray-500">${d.total_tasks} görev</p>
                    <div class="bg-gradient-to-t from-indigo-200 to-indigo-100 rounded-t-lg mt-2 ${heights[idx]}"></div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- Full Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-gray-500">
                  <th class="pb-2 w-12">#</th>
                  <th class="pb-2">Tekniker</th>
                  <th class="pb-2 text-center">Görev</th>
                  <th class="pb-2 text-center">Toplam Süre</th>
                  <th class="pb-2 text-center">Ort. Zorluk</th>
                  <th class="pb-2 text-center">Ort. Puan</th>
                  <th class="pb-2 text-center">En İyi</th>
                  <th class="pb-2 text-center font-bold text-indigo-600">Toplam Puan</th>
                </tr>
              </thead>
              <tbody>
                ${data.map((d, i) => {
                  const hrs = Math.floor(d.total_minutes / 60);
                  const mins = d.total_minutes % 60;
                  return `
                    <tr class="border-b border-gray-50 hover:bg-gray-50 ${i < 3 ? 'font-medium' : ''}">
                      <td class="py-3">${i < 3 ? medals[i] : i + 1}</td>
                      <td class="py-3">
                        <div class="flex items-center gap-2">
                          <div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-600 text-xs">${d.full_name.charAt(0)}</div>
                          ${d.full_name}
                        </div>
                      </td>
                      <td class="py-3 text-center">${d.total_tasks}</td>
                      <td class="py-3 text-center">${hrs}s ${mins}dk</td>
                      <td class="py-3 text-center">${'★'.repeat(Math.round(d.avg_difficulty))}${'☆'.repeat(5 - Math.round(d.avg_difficulty))}</td>
                      <td class="py-3 text-center">${parseFloat(d.avg_score).toFixed(1)}</td>
                      <td class="py-3 text-center">${d.best_score || '—'}</td>
                      <td class="py-3 text-center"><span class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold">${parseFloat(d.total_score).toFixed(1)}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  },

  // ─── GÖREV FORMU ───────────────────────────────────────────────────────

  showAssignmentForm(editId = null, preselectedTech = null) {
    const task = editId ? this.assignments.find(a => a.id === editId) : null;

    const formArea = document.getElementById('techFormArea');
    formArea.innerHTML = `
      <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onclick="if(event.target===this) document.getElementById('techFormArea').innerHTML=''">
        <div class="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
          <h3 class="font-bold text-gray-800 text-lg mb-4">
            <i class="fas fa-${task ? 'edit' : 'plus'} mr-2 text-indigo-600"></i>
            ${task ? 'Görevi Düzenle' : 'Yeni Görev Ata'}
          </h3>
          <form id="assignForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Görev Adı *</label>
              <input type="text" id="af_title" value="${task?.title || ''}" required
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Ne yapılacak?">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
              <textarea id="af_desc" rows="2" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Detaylı açıklama...">${task?.description || ''}</textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">${task ? 'Tekniker *' : 'Tekniker(ler) *'}</label>
                ${task ? `
                  <select id="af_tech" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="">Seçin...</option>
                    ${this.technicians.map(t => {
                      const wf = this.workforce.find(w => w.id === t.id);
                      const badge = wf ? (wf.availability === 'free' ? ' 🟢' : wf.availability === 'busy' ? ' 🔵' : ' 🔴') : '';
                      const selected = task.assigned_to === t.id ? 'selected' : '';
                      return `<option value="${t.id}" ${selected}>${t.full_name}${badge}</option>`;
                    }).join('')}
                  </select>
                ` : `
                  <div id="af_tech_multi" class="border rounded-lg p-2 max-h-48 overflow-y-auto space-y-1">
                    ${this.technicians.map(t => {
                      const wf = this.workforce.find(w => w.id === t.id);
                      const badge = wf ? (wf.availability === 'free' ? '🟢' : wf.availability === 'busy' ? '🔵' : '🔴') : '';
                      const checked = preselectedTech === t.id ? 'checked' : '';
                      return `<label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-indigo-50 cursor-pointer transition-all">
                        <input type="checkbox" name="af_techs" value="${t.id}" ${checked} class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
                        <span class="text-sm font-medium">${t.full_name}</span>
                        <span class="text-xs">${badge}</span>
                      </label>`;
                    }).join('')}
                  </div>
                  <p class="text-xs text-gray-400 mt-1">Birden fazla kişi seçebilirsiniz</p>
                `}
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Zorluk (1-5)</label>
                <div class="flex items-center gap-1 mt-1">
                  ${[1,2,3,4,5].map(n => `
                    <button type="button" onclick="document.getElementById('af_difficulty').value=${n};document.querySelectorAll('.diff-star').forEach((s,i)=>s.classList.toggle('text-yellow-400',i<${n}))" 
                      class="diff-star text-2xl cursor-pointer transition-all ${n <= (task?.difficulty || 3) ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400">★</button>
                  `).join('')}
                  <input type="hidden" id="af_difficulty" value="${task?.difficulty || 3}">
                </div>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"><i class="fas fa-sticky-note text-yellow-500 mr-1"></i>Notlar</label>
              <textarea id="af_notes" rows="2" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Ek notlar...">${task?.notes || ''}</textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"><i class="fas fa-calendar-times text-red-400 mr-1"></i>Son Tarih (Deadline)</label>
              <input type="date" id="af_deadline" value="${task?.deadline || ''}"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500">
              <p class="text-xs text-gray-400 mt-1">Opsiyonel — belirlenirse kart üzerinde geri sayım gösterilir</p>
            </div>
            <div class="flex gap-3 pt-2">
              <button type="submit" class="gradient-btn text-white px-6 py-2.5 rounded-lg font-semibold flex-1">
                <i class="fas fa-save mr-1"></i>${task ? 'Güncelle' : 'Ata'}
              </button>
              <button type="button" onclick="document.getElementById('techFormArea').innerHTML=''" 
                class="px-6 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-50">İptal</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('assignForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveAssignment(editId);
    });
  },

  async saveAssignment(editId) {
    const title = document.getElementById('af_title').value;
    const description = document.getElementById('af_desc').value || null;
    const difficulty = parseInt(document.getElementById('af_difficulty').value) || 3;
    const notes = document.getElementById('af_notes').value || null;
    const deadline = document.getElementById('af_deadline').value || null;

    try {
      showLoading(true);
      if (editId) {
        const existing = this.assignments.find(a => a.id === editId);
        const data = { title, description, assigned_to: parseInt(document.getElementById('af_tech').value), difficulty, notes, deadline, status: existing?.status || 'pending' };
        await api.request(`/technicians/assignments/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        // Çoklu seçim kontrolü
        const checkboxes = document.querySelectorAll('input[name="af_techs"]:checked');
        const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        if (selectedIds.length === 0) {
          alert('En az bir kişi seçmelisiniz');
          showLoading(false);
          return;
        }
        
        // Her seçilen kişi için ayrı görev oluştur
        for (const techId of selectedIds) {
          const data = { title, description, assigned_to: techId, difficulty, notes, deadline };
          await api.request('/technicians/assignments', { method: 'POST', body: JSON.stringify(data) });
        }
      }
      document.getElementById('techFormArea').innerHTML = '';
      await this.render();
    } catch (e) {
      alert('Hata: ' + e.message);
    } finally {
      showLoading(false);
    }
  },

  // ─── AKSİYONLAR ───────────────────────────────────────────────────────

  async startTask(id) {
    try {
      showLoading(true);
      await api.request(`/technicians/assignments/${id}/start`, { method: 'POST', body: '{}' });
      await this.render();
    } catch (e) {
      alert('Hata: ' + e.message);
    } finally { showLoading(false); }
  },

  completeTask(id) {
    const formArea = document.getElementById('techFormArea');
    formArea.innerHTML = `
      <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onclick="if(event.target===this) document.getElementById('techFormArea').innerHTML=''">
        <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-check-circle text-green-500 mr-2"></i>Görevi Tamamla</h3>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Tamamlama Notu (opsiyonel)</label>
            <textarea id="tp_completeNote" rows="3" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none" placeholder="Not ekleyin..."></textarea>
          </div>
          <div class="flex gap-3">
            <button id="tp_confirmComplete" class="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md">
              <i class="fas fa-check mr-2"></i>Tamamla
            </button>
            <button onclick="document.getElementById('techFormArea').innerHTML=''" class="px-6 py-3 border rounded-xl text-gray-600 hover:bg-gray-50">İptal</button>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => document.getElementById('tp_completeNote')?.focus(), 100);
    document.getElementById('tp_confirmComplete').addEventListener('click', async () => {
      const note = document.getElementById('tp_completeNote').value.trim();
      document.getElementById('techFormArea').innerHTML = '';
      try {
        showLoading(true);
        await api.request(`/technicians/assignments/${id}/complete`, { method: 'POST', body: JSON.stringify({ note: note || undefined }) });
        await this.render();
      } catch (e) {
        alert('Hata: ' + e.message);
      } finally { showLoading(false); }
    });
  },

  blockTask(id) {
    const formArea = document.getElementById('techFormArea');
    formArea.innerHTML = `
      <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onclick="if(event.target===this) document.getElementById('techFormArea').innerHTML=''">
        <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-ban text-orange-500 mr-2"></i>Görevi Bloke Et</h3>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Bloke Sebebi *</label>
            <textarea id="tp_blockReason" rows="3" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none" placeholder="Neden bloke edildi?"></textarea>
          </div>
          <div class="flex gap-3">
            <button id="tp_confirmBlock" class="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md">
              <i class="fas fa-ban mr-2"></i>Bloke Et
            </button>
            <button onclick="document.getElementById('techFormArea').innerHTML=''" class="px-6 py-3 border rounded-xl text-gray-600 hover:bg-gray-50">İptal</button>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => document.getElementById('tp_blockReason')?.focus(), 100);
    document.getElementById('tp_confirmBlock').addEventListener('click', async () => {
      const reason = document.getElementById('tp_blockReason').value.trim();
      if (!reason) { alert('Bloke sebebi yazmalısınız'); return; }
      document.getElementById('techFormArea').innerHTML = '';
      try {
        showLoading(true);
        await api.request(`/technicians/assignments/${id}/block`, { method: 'POST', body: JSON.stringify({ reason }) });
        await this.render();
      } catch (e) {
        alert('Hata: ' + e.message);
      } finally { showLoading(false); }
    });
  },

  async pauseTask(id) {
    if (!confirm('Görevi duraklatmak istiyor musunuz?')) return;
    try {
      showLoading(true);
      await api.request(`/technicians/assignments/${id}/pause`, { method: 'POST', body: JSON.stringify({ note: 'Pause' }) });
      await this.render();
    } catch (e) {
      alert('Hata: ' + e.message);
    } finally { showLoading(false); }
  },

  async deleteAssignment(id) {
    if (!confirm('Bu görevi silmek istediğinize emin misiniz?')) return;
    try {
      showLoading(true);
      await api.request(`/technicians/assignments/${id}`, { method: 'DELETE' });
      await this.render();
    } catch (e) {
      alert('Hata: ' + e.message);
    } finally { showLoading(false); }
  },

  // ─── GÜNLÜK WORD RAPORU ────────────────────────────────────────────────────

  async generateDailyWordReport() {
    const date = document.getElementById('dailyDatePicker')?.value || new Date().toISOString().split('T')[0];
    let report;
    try {
      showLoading(true);
      report = await api.request(`/technicians/daily-report?date=${date}`);
    } catch(e) {
      alert('Rapor verisi alınamadı: ' + e.message);
      showLoading(false);
      return;
    }

    const s = report.summary;
    const totalHours = Math.floor((s.total_minutes || 0) / 60);
    const totalMins = (s.total_minutes || 0) % 60;
    const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const now = new Date().toLocaleString('tr-TR');

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
  @page {
    size: A4 portrait;
    margin: 2cm 2cm 2.5cm 2cm;
    mso-header-margin: .5cm;
    mso-footer-margin: .75cm;
  }
  @page Section1 {
    size: 21cm 29.7cm;
    margin: 2cm 2cm 2.5cm 2cm;
    mso-header-margin: .5cm;
    mso-footer-margin: .75cm;
  }
  div.Section1 { page: Section1; }

  body {
    font-family: Calibri, 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    color: #1f2937;
    line-height: 1.5;
    margin: 0;
    padding: 0;
  }
  .header-bar {
    border-bottom: 3pt solid #4338ca;
    padding-bottom: 10pt;
    margin-bottom: 18pt;
  }
  .header-title {
    font-size: 22pt;
    font-weight: bold;
    color: #312e81;
    margin: 0 0 2pt 0;
  }
  .header-subtitle {
    font-size: 12pt;
    color: #6366f1;
    margin: 0;
  }
  .header-date {
    font-size: 10pt;
    color: #6b7280;
    margin: 4pt 0 0 0;
  }
  .section-title {
    font-size: 14pt;
    font-weight: bold;
    color: #1e3a5f;
    border-left: 4pt solid #4338ca;
    padding-left: 8pt;
    margin: 18pt 0 10pt 0;
  }
  .summary-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16pt;
  }
  .summary-table td {
    border: 1pt solid #e5e7eb;
    padding: 10pt 14pt;
    text-align: center;
  }
  .summary-label {
    font-size: 9pt;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
  }
  .summary-value {
    font-size: 20pt;
    font-weight: bold;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 14pt;
    font-size: 10pt;
  }
  .data-table th {
    background-color: #f1f5f9;
    border: 1pt solid #d1d5db;
    padding: 6pt 10pt;
    text-align: left;
    font-weight: bold;
    color: #374151;
    font-size: 9pt;
    text-transform: uppercase;
  }
  .data-table td {
    border: 1pt solid #e5e7eb;
    padding: 6pt 10pt;
    vertical-align: top;
  }
  .data-table tr:nth-child(even) td {
    background-color: #fafbfc;
  }
  .tag {
    display: inline-block;
    padding: 2pt 8pt;
    border-radius: 3pt;
    font-size: 8pt;
    font-weight: bold;
  }
  .tag-green { background-color: #dcfce7; color: #166534; }
  .tag-blue { background-color: #dbeafe; color: #1e40af; }
  .tag-orange { background-color: #fff7ed; color: #9a3412; }
  .tag-red { background-color: #fef2f2; color: #991b1b; }
  .tag-purple { background-color: #f3e8ff; color: #6b21a8; }
  .stars { color: #eab308; font-size: 10pt; }
  .footer {
    margin-top: 24pt;
    padding-top: 10pt;
    border-top: 1pt solid #d1d5db;
    font-size: 8pt;
    color: #9ca3af;
  }
  .no-data {
    color: #9ca3af;
    font-style: italic;
    padding: 10pt 0;
  }
</style>
</head>
<body>
<div class="Section1">

  <!-- BAŞLIK -->
  <div class="header-bar">
    <p class="header-title">GÜNLÜK FAALİYET RAPORU</p>
    <p class="header-subtitle">${dateFormatted}</p>
    <p class="header-date">Oluşturulma: ${now} — E-LAB Süreç Kontrol</p>
  </div>

  <!-- ÖZET -->
  <p class="section-title">Özet Bilgiler</p>
  <table class="summary-table">
    <tr>
      <td style="background-color:#f0fdf4;">
        <p class="summary-value" style="color:#16a34a;">${s.total_completed || 0}</p>
        <p class="summary-label">Tamamlanan</p>
      </td>
      <td style="background-color:#eff6ff;">
        <p class="summary-value" style="color:#2563eb;">${s.total_active || 0}</p>
        <p class="summary-label">Aktif</p>
      </td>
      <td style="background-color:#fff7ed;">
        <p class="summary-value" style="color:#ea580c;">${s.total_blocked || 0}</p>
        <p class="summary-label">Bloke</p>
      </td>
      <td style="background-color:#faf5ff;">
        <p class="summary-value" style="color:#7c3aed;">${s.total_paused || 0}</p>
        <p class="summary-label">Pause</p>
      </td>
      <td style="background-color:#eef2ff;">
        <p class="summary-value" style="color:#4338ca;">${totalHours}s ${totalMins}dk</p>
        <p class="summary-label">Toplam Çalışma</p>
      </td>
    </tr>
  </table>`;

    // İŞ BAZLI ÖZET
    if ((report.task_grouped || []).length > 0) {
      html += `
  <p class="section-title">İş Bazlı Özet</p>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:35%;">Görev</th>
        <th style="width:15%; text-align:center;">Süre</th>
        <th style="width:15%; text-align:center;">Kişi Sayısı</th>
        <th style="width:30%;">Personel</th>
      </tr>
    </thead>
    <tbody>`;
      report.task_grouped.forEach((g, idx) => {
        const durText = g.total_minutes < 60 ? `${g.total_minutes} dk` : `${Math.floor(g.total_minutes/60)}s ${g.total_minutes%60}dk`;
        const names = g.people.map(p => p.name).join(', ');
        html += `
      <tr>
        <td style="text-align:center; color:#9ca3af;">${idx + 1}</td>
        <td><b>${g.title}</b></td>
        <td style="text-align:center;">${durText}</td>
        <td style="text-align:center;"><span class="tag tag-purple">${g.people.length} kişi</span></td>
        <td style="font-size:9pt;">${names}</td>
      </tr>`;
      });
      html += `
    </tbody>
  </table>`;
    }

    // KİŞİ BAZLI ÖZET
    if (report.person_summary.length > 0) {
      html += `
  <p class="section-title">Kişi Bazlı Performans</p>
  <table class="data-table">
    <thead>
      <tr>
        <th>Personel</th>
        <th style="text-align:center;">Görev Sayısı</th>
        <th style="text-align:center;">Çalışma Süresi</th>
        <th style="text-align:center;">Ort. Puan</th>
      </tr>
    </thead>
    <tbody>`;
      report.person_summary.forEach(p => {
        const hrs = Math.floor(p.total_minutes / 60);
        const mins = p.total_minutes % 60;
        const scoreColor = parseFloat(p.avg_score) >= 5 ? '#16a34a' : parseFloat(p.avg_score) >= 3 ? '#ca8a04' : '#dc2626';
        html += `
      <tr>
        <td style="font-weight:bold;">${p.full_name}</td>
        <td style="text-align:center; font-weight:bold; font-size:12pt;">${p.task_count}</td>
        <td style="text-align:center;">${hrs}s ${mins}dk</td>
        <td style="text-align:center;"><span class="tag" style="background-color:#eef2ff; color:${scoreColor}; font-size:10pt;">${parseFloat(p.avg_score).toFixed(1)}</span></td>
      </tr>`;
      });
      // Toplam satır
      const totalTasks = report.person_summary.reduce((s, p) => s + parseInt(p.task_count), 0);
      html += `
      <tr style="background-color:#f1f5f9; font-weight:bold;">
        <td>TOPLAM</td>
        <td style="text-align:center; font-size:12pt;">${totalTasks}</td>
        <td style="text-align:center;">${totalHours}s ${totalMins}dk</td>
        <td style="text-align:center;">-</td>
      </tr>
    </tbody>
  </table>`;
    }

    // TAMAMLANAN İŞLER
    html += `
  <p class="section-title">Tamamlanan İşler</p>`;
    if (report.completed.length > 0) {
      html += `
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:28%;">Görev</th>
        <th style="width:18%;">Personel</th>
        <th style="width:10%; text-align:center;">Zorluk</th>
        <th style="width:12%; text-align:center;">Süre</th>
        <th style="width:10%; text-align:center;">Puan</th>
        <th style="width:17%;">Not</th>
      </tr>
    </thead>
    <tbody>`;
      report.completed.forEach((a, idx) => {
        const mins = a.actual_duration_minutes || 0;
        const durText = mins < 60 ? `${mins} dk` : `${Math.floor(mins/60)}s ${mins%60}dk`;
        const stars = '\u2605'.repeat(a.difficulty || 3) + '\u2606'.repeat(5 - (a.difficulty || 3));
        const scoreVal = a.performance_score ? parseFloat(a.performance_score).toFixed(1) : '-';
        const scoreClass = a.performance_score >= 5 ? 'tag-green' : a.performance_score >= 3 ? 'tag-blue' : 'tag-orange';
        
        // Tamamlanma saati
        const completedTime = a.completed_at ? new Date(a.completed_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'}) : '';
        
        html += `
      <tr>
        <td style="text-align:center; color:#9ca3af;">${idx + 1}</td>
        <td>
          <b>${a.title}</b>
          ${a.description ? `<br><span style="font-size:9pt; color:#6b7280;">${a.description}</span>` : ''}
        </td>
        <td>${a.assigned_to_name || '-'}</td>
        <td style="text-align:center;"><span class="stars">${stars}</span></td>
        <td style="text-align:center;">${durText}${completedTime ? `<br><span style="font-size:8pt; color:#9ca3af;">${completedTime}</span>` : ''}</td>
        <td style="text-align:center;"><span class="tag ${scoreClass}">${scoreVal}</span></td>
        <td style="font-size:9pt; color:#6b7280;">${a.notes || '-'}</td>
      </tr>`;
      });
      html += `
    </tbody>
  </table>`;
    } else {
      html += `<p class="no-data">Bu tarihte tamamlanan görev bulunmamaktadır.</p>`;
    }

    // AKTİF İŞLER
    if (report.active.length > 0) {
      html += `
  <p class="section-title">Aktif / Devam Eden İşler</p>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:30%;">Görev</th>
        <th style="width:20%;">Personel</th>
        <th style="width:15%; text-align:center;">Zorluk</th>
        <th style="width:15%; text-align:center;">Başlanma</th>
        <th style="width:15%;">Not</th>
      </tr>
    </thead>
    <tbody>`;
      report.active.forEach((a, idx) => {
        const stars = '\u2605'.repeat(a.difficulty || 3) + '\u2606'.repeat(5 - (a.difficulty || 3));
        const startedTime = a.started_at ? new Date(a.started_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'}) : '-';
        html += `
      <tr>
        <td style="text-align:center; color:#9ca3af;">${idx + 1}</td>
        <td><b>${a.title}</b></td>
        <td>${a.assigned_to_name || '-'}</td>
        <td style="text-align:center;"><span class="stars">${stars}</span></td>
        <td style="text-align:center;"><span class="tag tag-blue">${startedTime}</span></td>
        <td style="font-size:9pt; color:#6b7280;">${a.notes || '-'}</td>
      </tr>`;
      });
      html += `
    </tbody>
  </table>`;
    }

    // YARINA KALAN İŞLER
    if ((report.paused || []).length > 0) {
      html += `
  <p class="section-title">Pause Edilen İşler</p>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:35%;">Görev</th>
        <th style="width:25%;">Personel</th>
        <th style="width:15%; text-align:center;">Zorluk</th>
        <th style="width:20%;">Durum</th>
      </tr>
    </thead>
    <tbody>`;
      report.paused.forEach((a, idx) => {
        const stars = '\u2605'.repeat(a.difficulty || 3) + '\u2606'.repeat(5 - (a.difficulty || 3));
        html += `
      <tr>
        <td style="text-align:center; color:#9ca3af;">${idx + 1}</td>
        <td><b>${a.title}</b></td>
        <td>${a.assigned_to_name || '-'}</td>
        <td style="text-align:center;"><span class="stars">${stars}</span></td>
        <td><span class="tag tag-purple">Pause</span></td>
      </tr>`;
      });
      html += `
    </tbody>
  </table>`;
    }

    // BLOKE İŞLER
    if (report.blocked.length > 0) {
      html += `
  <p class="section-title">Bloke Edilen İşler</p>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:30%;">Görev</th>
        <th style="width:20%;">Personel</th>
        <th style="width:45%;">Bloke Sebebi</th>
      </tr>
    </thead>
    <tbody>`;
      report.blocked.forEach((a, idx) => {
        html += `
      <tr>
        <td style="text-align:center; color:#9ca3af;">${idx + 1}</td>
        <td><b>${a.title}</b></td>
        <td>${a.assigned_to_name || '-'}</td>
        <td><span class="tag tag-orange">${a.blocked_reason || 'Belirtilmedi'}</span></td>
      </tr>`;
      });
      html += `
    </tbody>
  </table>`;
    }

    // AKTİVİTE LOGLARI
    if (report.activity_logs && report.activity_logs.length > 0) {
      html += `
  <p class="section-title">Aktivite Zaman Çizelgesi</p>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:12%;">Saat</th>
        <th style="width:18%;">Personel</th>
        <th style="width:25%;">Görev</th>
        <th style="width:12%; text-align:center;">Aksiyon</th>
        <th style="width:33%;">Not</th>
      </tr>
    </thead>
    <tbody>`;
      const actionLabels = { start: 'Başlatıldı', complete: 'Tamamlandı', block: 'Bloke Edildi', pause: 'Pause' };
      const actionClasses = { start: 'tag-blue', complete: 'tag-green', block: 'tag-orange', pause: 'tag-purple' };
      report.activity_logs.forEach(log => {
        const time = new Date(log.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
        html += `
      <tr>
        <td style="font-weight:bold;">${time}</td>
        <td>${log.full_name || '-'}</td>
        <td>${log.task_title || '-'}</td>
        <td style="text-align:center;"><span class="tag ${actionClasses[log.action] || 'tag-blue'}">${actionLabels[log.action] || log.action}</span></td>
        <td style="font-size:9pt; color:#6b7280;">${log.note || '-'}</td>
      </tr>`;
      });
      html += `
    </tbody>
  </table>`;
    }

    // FOOTER
    html += `
  <div class="footer">
    <p>Bu rapor <b>E-LAB Süreç Kontrol</b> sistemi tarafından ${now} tarihinde otomatik oluşturulmuştur.</p>
    <p style="margin-top:2pt;">Rapor Tarihi: ${dateFormatted}</p>
  </div>

</div>
</body>
</html>`;

    // İndir
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Gunluk_Rapor_${date}.doc`;
    link.click();
    URL.revokeObjectURL(link.href);

    showLoading(false);
  }
};
