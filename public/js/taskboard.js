// ─── ORTAK GÖREV PANOSU (Paylaşımlı Ekran) ────────────────────────────────────
const TaskBoard = {
  assignments: [],
  autoRefreshTimer: null,

  async render() {
    showLoading(true);
    const container = document.getElementById('content');

    try {
      this.assignments = await api.request('/technicians/assignments');
    } catch(e) {
      this.assignments = [];
    }

    // Kişiye göre grupla
    const grouped = {};
    this.assignments.forEach(a => {
      const name = a.assigned_to_name || 'Atanmamış';
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(a);
    });

    // Aktif görevler önce gelen sırala
    const sortOrder = { active: 0, pending: 1, paused: 2, blocked: 3, completed: 4 };
    Object.values(grouped).forEach(arr => {
      arr.sort((a, b) => (sortOrder[a.status] ?? 9) - (sortOrder[b.status] ?? 9));
    });

    // İstatistikler
    const totalPending = this.assignments.filter(a => a.status === 'pending').length;
    const totalActive = this.assignments.filter(a => a.status === 'active').length;
    const totalPaused = this.assignments.filter(a => a.status === 'paused').length;
    const totalBlocked = this.assignments.filter(a => a.status === 'blocked').length;
    const totalDone = this.assignments.filter(a => a.status === 'completed').length;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    container.innerHTML = `
      <div class="max-w-7xl mx-auto">
        <!-- Üst Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center">
              <i class="fas fa-tv mr-3 text-emerald-600"></i>Görev Ekranı
            </h1>
            <p class="text-gray-500 text-sm mt-1">
              <i class="fas fa-sync-alt mr-1"></i>Son güncelleme: <span id="tb_lastUpdate">${timeStr}</span>
              <button onclick="TaskBoard.refresh()" class="ml-3 text-emerald-600 hover:text-emerald-800 font-semibold text-sm">
                <i class="fas fa-redo mr-1"></i>Yenile
              </button>
            </p>
          </div>
          <!-- Mini Özet -->
          <div class="flex gap-2 flex-wrap">
            <div class="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-center min-w-[80px]">
              <div class="text-xl font-bold text-yellow-600">${totalPending}</div>
              <div class="text-[10px] text-yellow-700 font-medium uppercase">Bekliyor</div>
            </div>
            <div class="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-center min-w-[80px]">
              <div class="text-xl font-bold text-blue-600">${totalActive}</div>
              <div class="text-[10px] text-blue-700 font-medium uppercase">Aktif</div>
            </div>
            <div class="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-center min-w-[80px]">
              <div class="text-xl font-bold text-orange-600">${totalBlocked}</div>
              <div class="text-[10px] text-orange-700 font-medium uppercase">Bloke</div>
            </div>
            <div class="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-center min-w-[80px]">
              <div class="text-xl font-bold text-purple-600">${totalPaused}</div>
              <div class="text-[10px] text-purple-700 font-medium uppercase">Pause</div>
            </div>
            <div class="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-center min-w-[80px]">
              <div class="text-xl font-bold text-green-600">${totalDone}</div>
              <div class="text-[10px] text-green-700 font-medium uppercase">Bitti</div>
            </div>
          </div>
        </div>

        <!-- Kişi Kartları -->
        <div class="space-y-4" id="tb_people">
          ${Object.keys(grouped).length === 0 ? `
            <div class="text-center py-16 text-gray-400">
              <i class="fas fa-clipboard-list text-6xl mb-4"></i>
              <p class="text-xl">Henüz atanmış görev yok</p>
            </div>
          ` : Object.entries(grouped).map(([name, tasks]) => {
            const activeTasks = tasks.filter(t => t.status === 'active');
            const pendingTasks = tasks.filter(t => t.status === 'pending');
            const pausedTasks = tasks.filter(t => t.status === 'paused');
            const blockedTasks = tasks.filter(t => t.status === 'blocked');
            const doneTasks = tasks.filter(t => t.status === 'completed');
            const visibleTasks = tasks.filter(t => t.status !== 'completed');
            const initial = name.charAt(0).toUpperCase();

            // Kişi durumu
            let personStatus = 'free';
            let personBg = 'from-gray-500 to-gray-600';
            let personTag = 'Boşta';
            if (activeTasks.length > 0) {
              personStatus = 'busy';
              personBg = 'from-blue-500 to-blue-700';
              personTag = 'Çalışıyor';
            }
            if (activeTasks.length + pendingTasks.length >= 3) {
              personStatus = 'overloaded';
              personBg = 'from-red-500 to-red-700';
              personTag = 'Yoğun';
            }
            if (activeTasks.length === 0 && pendingTasks.length === 0 && blockedTasks.length === 0 && pausedTasks.length === 0) {
              personBg = 'from-green-500 to-green-600';
              personTag = 'Tamamladı ✓';
            }

            return `
              <div class="glass-card rounded-2xl overflow-hidden">
                <!-- Kişi Başlığı -->
                <div class="bg-gradient-to-r ${personBg} px-5 py-3 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-11 h-11 bg-white bg-opacity-25 rounded-full flex items-center justify-center text-white text-lg font-bold">${initial}</div>
                    <div>
                      <h3 class="text-white font-bold text-lg">${name}</h3>
                      <p class="text-white text-opacity-80 text-xs">${personTag} — ${activeTasks.length} aktif, ${pendingTasks.length} bekliyor${pausedTasks.length > 0 ? `, ${pausedTasks.length} pause` : ''}${doneTasks.length > 0 ? `, ${doneTasks.length} bitti` : ''}</p>
                    </div>
                  </div>
                </div>

                <!-- Görevler -->
                <div class="p-4 space-y-3">
                  ${visibleTasks.length === 0 ? `
                    <p class="text-center text-gray-400 py-3 text-sm">Bekleyen görev yok</p>
                  ` : visibleTasks.map(a => this.renderTask(a)).join('')}

                  ${doneTasks.length > 0 ? `
                    <details class="group">
                      <summary class="cursor-pointer text-xs text-gray-400 hover:text-gray-600 font-medium py-1">
                        <i class="fas fa-check-double mr-1 text-green-400"></i>Tamamlananları göster (${doneTasks.length})
                      </summary>
                      <div class="space-y-2 mt-2 opacity-60">
                        ${doneTasks.map(a => this.renderTask(a)).join('')}
                      </div>
                    </details>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    showLoading(false);
    this.startAutoRefresh();
  },

  renderTask(a) {
    const diffStars = '★'.repeat(a.difficulty || 3) + '☆'.repeat(5 - (a.difficulty || 3));
    const diffColors = ['', '#22c55e', '#16a34a', '#eab308', '#f97316', '#ef4444'];

    // Süre hesabı
    let durationText = '';
    if (a.status === 'active' && a.started_at) {
      const mins = Math.round((new Date() - new Date(a.started_at)) / 60000);
      if (mins < 60) durationText = `${mins} dk`;
      else durationText = `${Math.floor(mins / 60)}s ${mins % 60}dk`;
    } else if (a.status === 'completed' && a.actual_duration_minutes) {
      const m = a.actual_duration_minutes;
      durationText = m < 60 ? `${m} dk` : `${Math.floor(m / 60)}s ${m % 60}dk`;
    }

    // Deadline
    let deadlineHtml = '';
    if (a.deadline && a.status !== 'completed') {
      const dl = new Date(a.deadline + 'T23:59:59');
      const diff = Math.ceil((dl - new Date()) / (1000 * 60 * 60 * 24));
      const isLate = diff < 0;
      const isClose = diff >= 0 && diff <= 2;
      const cls = isLate ? 'bg-red-100 text-red-700' : isClose ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600';
      const label = isLate ? `${Math.abs(diff)} gün gecikmiş!` : diff === 0 ? 'Bugün son gün!' : `${diff} gün kaldı`;
      deadlineHtml = `<span class="text-xs ${cls} px-2 py-0.5 rounded-full font-medium"><i class="fas fa-flag mr-1"></i>${label}</span>`;
    }

    // Durum renkleri
    const statusCfg = {
      pending:   { bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-400', label: 'Bekliyor' },
      active:    { bg: 'bg-blue-50 border-blue-300 ring-2 ring-blue-200', dot: 'bg-blue-500 animate-pulse', label: 'Çalışılıyor' },
      paused:    { bg: 'bg-purple-50 border-purple-300', dot: 'bg-purple-500', label: 'Pause' },
      blocked:   { bg: 'bg-orange-50 border-orange-300', dot: 'bg-orange-500', label: 'Bloke' },
      completed: { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', label: 'Tamamlandı' }
    };
    const st = statusCfg[a.status] || statusCfg.pending;

    // Butonlar — büyük, dokunmatik dostu
    let buttons = '';
    if (a.status === 'pending') {
      buttons = `
        <button onclick="TaskBoard.startTask(${a.id})" 
          class="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl text-base transition-all shadow-md hover:shadow-lg flex items-center gap-2">
          <i class="fas fa-play"></i>Başlat
        </button>
      `;
    } else if (a.status === 'active') {
      buttons = `
        <div class="flex gap-2">
          <button onclick="TaskBoard.completeTask(${a.id})" 
            class="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-3 px-6 rounded-xl text-base transition-all shadow-md hover:shadow-lg flex items-center gap-2">
            <i class="fas fa-check"></i>Tamamla
          </button>
          <button onclick="TaskBoard.pauseTask(${a.id})" 
            class="bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl text-base transition-all shadow-md" title="Pause">
            <i class="fas fa-pause"></i>
          </button>
          <button onclick="TaskBoard.blockTask(${a.id})" 
            class="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold py-3 px-4 rounded-xl text-base transition-all shadow-md">
            <i class="fas fa-ban"></i>
          </button>
        </div>
      `;
    } else if (a.status === 'paused') {
      buttons = `
        <button onclick="TaskBoard.startTask(${a.id})" 
          class="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl text-base transition-all shadow-md hover:shadow-lg flex items-center gap-2">
          <i class="fas fa-play"></i>Devam Et
        </button>
      `;
    } else if (a.status === 'blocked') {
      buttons = `
        <button onclick="TaskBoard.startTask(${a.id})" 
          class="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl text-base transition-all shadow-md hover:shadow-lg flex items-center gap-2">
          <i class="fas fa-play"></i>Devam Et
        </button>
      `;
    } else if (a.status === 'completed' && a.performance_score) {
      buttons = `
        <span class="bg-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-xl text-sm">
          <i class="fas fa-star mr-1 text-yellow-500"></i>Puan: ${a.performance_score}
        </span>
      `;
    }

    return `
      <div class="border rounded-xl p-4 ${st.bg} flex flex-col sm:flex-row sm:items-center gap-3 transition-all">
        <!-- Sol: Bilgi -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2.5 h-2.5 rounded-full ${st.dot} flex-shrink-0"></span>
            <h4 class="font-bold text-gray-800 text-base truncate">${a.title}</h4>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-white bg-opacity-80 text-gray-500 font-medium flex-shrink-0">${st.label}</span>
          </div>
          ${a.description ? `<p class="text-sm text-gray-500 ml-5 mb-1 line-clamp-1">${a.description}</p>` : ''}
          <div class="flex flex-wrap items-center gap-2 ml-5 text-xs">
            <span style="color:${diffColors[a.difficulty || 3]}" class="font-medium" title="Zorluk ${a.difficulty}/5">${diffStars}</span>
            ${durationText ? `<span class="text-gray-500"><i class="fas fa-stopwatch mr-1 text-indigo-400"></i>${durationText}</span>` : ''}
            ${deadlineHtml}
            ${a.blocked_reason && a.status === 'blocked' ? `<span class="text-orange-600"><i class="fas fa-exclamation-triangle mr-1"></i>${a.blocked_reason}</span>` : ''}
          </div>
          ${a.notes ? `<div class="text-xs text-gray-500 ml-5 mt-1 bg-white bg-opacity-60 rounded px-2 py-1"><i class="fas fa-sticky-note mr-1 text-yellow-500"></i>${a.notes}</div>` : ''}
        </div>

        <!-- Sağ: Butonlar -->
        <div class="flex-shrink-0 flex justify-end">
          ${buttons}
        </div>
      </div>
    `;
  },

  // ─── AKSİYONLAR ─────────────────────────────────────────────────────

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
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-check-circle text-green-500 mr-2"></i>Görevi Tamamla</h3>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Tamamlama Notu (opsiyonel)</label>
          <textarea id="tb_completeNote" rows="3" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-base" placeholder="Not ekleyin..."></textarea>
        </div>
        <div class="flex gap-3">
          <button id="tb_confirmComplete" class="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl text-base transition-all shadow-md">
            <i class="fas fa-check mr-2"></i>Tamamla
          </button>
          <button onclick="this.closest('.fixed').remove()" class="px-6 py-3 border-2 rounded-xl text-gray-600 hover:bg-gray-50 font-semibold">İptal</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Focus textarea
    setTimeout(() => document.getElementById('tb_completeNote')?.focus(), 100);
    
    document.getElementById('tb_confirmComplete').addEventListener('click', async () => {
      const note = document.getElementById('tb_completeNote').value.trim();
      modal.remove();
      try {
        showLoading(true);
        await api.request(`/technicians/assignments/${id}/complete`, { 
          method: 'POST', body: JSON.stringify({ note: note || undefined }) 
        });
        await this.render();
      } catch (e) {
        alert('Hata: ' + e.message);
      } finally { showLoading(false); }
    });
  },

  blockTask(id) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-ban text-orange-500 mr-2"></i>Görevi Bloke Et</h3>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Bloke Sebebi *</label>
          <textarea id="tb_blockReason" rows="3" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-base" placeholder="Neden bloke edildi?"></textarea>
        </div>
        <div class="flex gap-3">
          <button id="tb_confirmBlock" class="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl text-base transition-all shadow-md">
            <i class="fas fa-ban mr-2"></i>Bloke Et
          </button>
          <button onclick="this.closest('.fixed').remove()" class="px-6 py-3 border-2 rounded-xl text-gray-600 hover:bg-gray-50 font-semibold">İptal</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    setTimeout(() => document.getElementById('tb_blockReason')?.focus(), 100);
    
    document.getElementById('tb_confirmBlock').addEventListener('click', async () => {
      const reason = document.getElementById('tb_blockReason').value.trim();
      if (!reason) { alert('Bloke sebebi yazmalısınız'); return; }
      modal.remove();
      try {
        showLoading(true);
        await api.request(`/technicians/assignments/${id}/block`, { 
          method: 'POST', body: JSON.stringify({ reason }) 
        });
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

  async refresh() {
    await this.render();
  },

  // 60 saniyede bir otomatik yenile
  startAutoRefresh() {
    this.stopAutoRefresh();
    this.autoRefreshTimer = setInterval(async () => {
      if (app.currentPage === 'taskboard') {
        try {
          this.assignments = await api.request('/technicians/assignments');
          // Sadece içeriği güncelle, tam render yapmadan
          const el = document.getElementById('tb_lastUpdate');
          if (el) {
            el.textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          }
          // Tam render
          await this.render();
        } catch(e) { /* sessiz */ }
      }
    }, 60000);
  },

  stopAutoRefresh() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }
};
