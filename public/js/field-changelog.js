// ═══════════════════════════════════════════════════════════════════════════════
// SAHA DEĞİŞİKLİK GEÇMİŞİ MODÜLÜ — FRONTEND
// Tabs: Arşiv (Arama) | OTPA Timeline | Yeni Kayıt | Excel Import
// ═══════════════════════════════════════════════════════════════════════════════
const FieldChangelog = {
  // ─── State ────────────────────────────────────────────────────────
  tab: 'archive',
  stats: null,
  logs: [],
  total: 0,
  page: 0,
  pageSize: 20,
  filters: { otpa: '', category: '', checked_by: '', performed_by: '', part_no: '', date_from: '', date_to: '', has_software: '', search: '' },
  categories: [],
  // Detail / Timeline state
  viewingTimeline: null,   // { otpaNo, logs }
  viewingLog: null,        // single log detail
  editingLog: null,        // log being edited (or 'new')
  importResult: null,

  // ─── Helpers ──────────────────────────────────────────────────────
  esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; },
  fmtDate(d) { if (!d) return '-'; try { return new Date(d).toLocaleDateString('tr-TR'); } catch { return d; } },
  fmtDateTime(d) { if (!d) return '-'; try { return new Date(d).toLocaleString('tr-TR'); } catch { return d; } },
  fmtDateInput(d) { if (!d) return ''; try { return new Date(d).toISOString().slice(0, 16); } catch { return ''; } },
  isAdmin() { return authManager?.currentUser?.role === 'admin'; },
  isKalite() { const r = authManager?.currentUser?.role; return r === 'admin' || r === 'kalite'; },
  badge(t, c) { return `<span class="px-2 py-0.5 rounded-full text-xs font-bold ${c}">${t}</span>`; },

  catBadge(cat) {
    const colorMap = {
      'PDU': 'bg-purple-500/20 text-purple-300',
      'VCCU': 'bg-blue-500/20 text-blue-300',
      'BATARYA': 'bg-yellow-500/20 text-yellow-300',
      'Kart Değişimi (BCU)': 'bg-orange-500/20 text-orange-300',
      'Kart Değişimi (BMU)': 'bg-orange-500/20 text-orange-300',
      'Tesisat Değişimi': 'bg-teal-500/20 text-teal-300',
      'Akım Sensörü Değişimi': 'bg-cyan-500/20 text-cyan-300',
      'Kontaktör Değişimi': 'bg-pink-500/20 text-pink-300',
      'Hasarlı/Hatalı Cell Değişimi': 'bg-red-500/20 text-red-300',
      'Yazılım Güncelleme': 'bg-green-500/20 text-green-300',
      'LENZE': 'bg-indigo-500/20 text-indigo-300',
      'Direksiyon Pompası': 'bg-lime-500/20 text-lime-300',
      'Hava Kompresörü': 'bg-emerald-500/20 text-emerald-300',
      'Araç Üzeri 24V Kontrol': 'bg-amber-500/20 text-amber-300',
      'Sigorta': 'bg-rose-500/20 text-rose-300',
      'Soğutma Modül ve Bağlantı Kompleleri': 'bg-sky-500/20 text-sky-300',
      'Diğer': 'bg-gray-500/20 text-gray-300'
    };
    return this.badge(this.esc(cat), colorMap[cat] || 'bg-gray-500/20 text-gray-300');
  },

  // ═══════════════════════════════════════════════════════════════════
  // RENDER — Ana sayfa
  // ═══════════════════════════════════════════════════════════════════
  async render() {
    const c = document.getElementById('content');
    if (!c) return;

    // Alt görünümler
    if (this.editingLog) { this.renderLogForm(c); return; }
    if (this.viewingLog) { this.renderLogDetail(c); return; }
    if (this.viewingTimeline) { this.renderTimeline(c); return; }

    // İstatistik + Kategoriler
    try { this.stats = await api.request('/field-changelog/stats'); } catch { this.stats = { log_count: 0, unique_otpa_count: 0, part_change_count: 0, software_update_count: 0 }; }
    try { this.categories = await api.request('/field-changelog/categories'); } catch { this.categories = []; }

    c.innerHTML = `
    <div class="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <!-- Başlık -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 class="text-xl sm:text-3xl font-bold gradient-text"><i class="fas fa-history mr-2"></i>Saha Değişiklik Geçmişi</h1>
            <p class="text-gray-400 mt-1 text-xs sm:text-base">Araç/OTPA Bazlı Saha Müdahale Kayıtları • Parça Değişimleri • Yazılım Güncellemeleri</p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 px-2 sm:px-4 py-2 rounded-xl"><div class="text-lg sm:text-2xl font-bold text-blue-400">${this.stats.log_count}</div><div class="text-xs text-gray-400">Kayıt</div></div>
            <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 px-2 sm:px-4 py-2 rounded-xl"><div class="text-lg sm:text-2xl font-bold text-green-400">${this.stats.unique_otpa_count}</div><div class="text-xs text-gray-400">OTPA</div></div>
            <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 px-2 sm:px-4 py-2 rounded-xl"><div class="text-lg sm:text-2xl font-bold text-yellow-400">${this.stats.part_change_count}</div><div class="text-xs text-gray-400">Parça Değ.</div></div>
            <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 px-2 sm:px-4 py-2 rounded-xl"><div class="text-lg sm:text-2xl font-bold text-purple-400">${this.stats.software_update_count}</div><div class="text-xs text-gray-400">Yazılım Gün.</div></div>
          </div>
        </div>
      </div>

      <!-- Tablar -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 rounded-2xl overflow-hidden">
        <div class="flex border-b border-white/10 overflow-x-auto">
          ${['archive', 'timeline-search', 'new-entry', 'import'].map(t => {
            const labels = {
              'archive': '<i class="fas fa-search mr-1"></i>Arşiv',
              'timeline-search': '<i class="fas fa-stream mr-1"></i>OTPA Timeline',
              'new-entry': '<i class="fas fa-plus-circle mr-1"></i>Yeni Kayıt',
              'import': '<i class="fas fa-file-excel mr-1"></i>Excel Import'
            };
            const active = this.tab === t;
            return `<button data-tab="${t}" onclick="FieldChangelog.switchTab('${t}')" class="fcl-tab-btn flex-1 min-w-0 px-2 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${active ? 'gradient-btn text-white border-b-2 border-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}">${labels[t]}</button>`;
          }).join('')}
        </div>
        <div class="p-3 sm:p-6" id="fcl-tab-content"></div>
      </div>
    </div>`;

    this.renderTabContent();
  },

  switchTab(t) {
    this.tab = t;
    document.querySelectorAll('.fcl-tab-btn').forEach(btn => {
      const isActive = btn.dataset.tab === t;
      btn.className = `fcl-tab-btn flex-1 min-w-0 px-2 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${isActive ? 'gradient-btn text-white border-b-2 border-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`;
    });
    this.renderTabContent();
  },

  renderTabContent() {
    const el = document.getElementById('fcl-tab-content');
    if (!el) return;
    switch (this.tab) {
      case 'archive': this.renderArchiveTab(el); break;
      case 'timeline-search': this.renderTimelineSearchTab(el); break;
      case 'new-entry': this.editingLog = 'new'; history.pushState({ page: 'field-changelog', sub: 'new-entry' }, '', '#field-changelog'); this.renderLogForm(document.getElementById('content')); break;
      case 'import': this.renderImportTab(el); break;
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // TAB 1: ARŞİV — Filtrelenebilir arama
  // ═══════════════════════════════════════════════════════════════════
  async renderArchiveTab(el) {
    el.innerHTML = `
    <div class="space-y-4">
      <!-- Filtreler -->
      <div class="bg-gray-800/50 border border-white/10 p-3 sm:p-4 rounded-xl">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-400"><i class="fas fa-filter mr-1"></i>Filtreler</h3>
          <button onclick="FieldChangelog.clearFilters()" class="text-xs text-gray-500 hover:text-white"><i class="fas fa-times mr-1"></i>Temizle</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <input id="fcl-f-search" value="${this.esc(this.filters.search)}" placeholder="Genel arama..." class="px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:border-blue-400 focus:outline-none">
          <input id="fcl-f-otpa" value="${this.esc(this.filters.otpa)}" placeholder="OTPA No..." class="px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:border-blue-400 focus:outline-none">
          <select id="fcl-f-cat" class="px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm" style="color-scheme:dark;">
            <option value="" class="bg-gray-800 text-white">Tüm Kategoriler</option>
            ${this.categories.map(c => `<option value="${this.esc(c)}" class="bg-gray-800 text-white" ${this.filters.category === c ? 'selected' : ''}>${this.esc(c)}</option>`).join('')}
          </select>
          <input id="fcl-f-checked" value="${this.esc(this.filters.checked_by)}" placeholder="Kontrol eden..." class="px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:border-blue-400 focus:outline-none">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mt-2">
          <input id="fcl-f-partno" value="${this.esc(this.filters.part_no)}" placeholder="Parça No..." class="px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:border-blue-400 focus:outline-none">
          <input id="fcl-f-from" type="date" value="${this.esc(this.filters.date_from)}" class="px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm focus:border-blue-400 focus:outline-none" style="color-scheme:dark;">
          <input id="fcl-f-to" type="date" value="${this.esc(this.filters.date_to)}" class="px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm focus:border-blue-400 focus:outline-none" style="color-scheme:dark;">
          <div class="flex gap-2">
            <label class="flex items-center gap-2 text-gray-400 text-sm cursor-pointer">
              <input id="fcl-f-sw" type="checkbox" ${this.filters.has_software === 'true' ? 'checked' : ''} class="rounded"> Yazılım Güncelleme
            </label>
            <button onclick="FieldChangelog.applyFilters()" class="gradient-btn px-4 py-2 rounded-lg text-white text-sm font-semibold flex-1"><i class="fas fa-search mr-1"></i>Ara</button>
          </div>
        </div>
      </div>

      <!-- Sonuçlar -->
      <div id="fcl-archive-results">
        <div class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
      </div>
    </div>`;

    this.loadArchive();
  },

  applyFilters() {
    this.filters = {
      search: document.getElementById('fcl-f-search')?.value || '',
      otpa: document.getElementById('fcl-f-otpa')?.value || '',
      category: document.getElementById('fcl-f-cat')?.value || '',
      checked_by: document.getElementById('fcl-f-checked')?.value || '',
      part_no: document.getElementById('fcl-f-partno')?.value || '',
      date_from: document.getElementById('fcl-f-from')?.value || '',
      date_to: document.getElementById('fcl-f-to')?.value || '',
      has_software: document.getElementById('fcl-f-sw')?.checked ? 'true' : '',
      performed_by: ''
    };
    this.page = 0;
    this.loadArchive();
  },

  clearFilters() {
    this.filters = { otpa: '', category: '', checked_by: '', performed_by: '', part_no: '', date_from: '', date_to: '', has_software: '', search: '' };
    this.page = 0;
    this.renderTabContent();
  },

  async loadArchive() {
    const el = document.getElementById('fcl-archive-results');
    if (!el) return;

    const params = new URLSearchParams();
    Object.entries(this.filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.set('limit', this.pageSize);
    params.set('offset', this.page * this.pageSize);

    try {
      const data = await api.request(`/field-changelog/logs?${params}`);
      this.logs = data.logs || [];
      this.total = data.total || 0;

      if (!this.logs.length) {
        el.innerHTML = '<div class="text-center py-12 text-gray-500"><i class="fas fa-search text-4xl mb-3 block"></i><p>Kayıt bulunamadı</p></div>';
        return;
      }

      const totalPages = Math.ceil(this.total / this.pageSize);
      el.innerHTML = `
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
        <span class="text-sm text-gray-400">${this.total} kayıt bulundu (Sayfa ${this.page + 1}/${totalPages})</span>
        <div class="flex gap-2">
          ${this.page > 0 ? `<button onclick="FieldChangelog.page--;FieldChangelog.loadArchive();" class="px-3 py-1 rounded-lg bg-gray-700 text-gray-300 text-sm"><i class="fas fa-chevron-left"></i></button>` : ''}
          ${(this.page + 1) < totalPages ? `<button onclick="FieldChangelog.page++;FieldChangelog.loadArchive();" class="px-3 py-1 rounded-lg bg-gray-700 text-gray-300 text-sm"><i class="fas fa-chevron-right"></i></button>` : ''}
        </div>
      </div>

      <!-- Mobil card view -->
      <div class="space-y-3">
        ${this.logs.map(l => {
          const cats = (l.categories || '').split(', ').filter(Boolean);
          return `
          <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 sm:p-4 rounded-xl hover:border-blue-400/30 transition-all cursor-pointer" onclick="FieldChangelog.openLogDetail(${l.id})">
            <div class="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
              <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl gradient-btn flex items-center justify-center flex-shrink-0">
                  <i class="fas fa-wrench text-white text-sm sm:text-base"></i>
                </div>
                <div class="min-w-0">
                  <div class="text-base sm:text-lg font-bold text-white">${this.esc(l.otpa_no)}</div>
                  <div class="text-xs text-gray-400">${this.fmtDate(l.start_date)}${l.end_date ? ' → ' + this.fmtDate(l.end_date) : ''}</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                ${parseInt(l.part_count) > 0 ? `<span class="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300"><i class="fas fa-cog mr-1"></i>${l.part_count} parça</span>` : ''}
                ${parseInt(l.sw_count) > 0 ? `<span class="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300"><i class="fas fa-code mr-1"></i>${l.sw_count} SW</span>` : ''}
                ${parseInt(l.attachment_count) > 0 ? `<span class="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300"><i class="fas fa-paperclip mr-1"></i>${l.attachment_count}</span>` : ''}
              </div>
            </div>
            ${cats.length ? `<div class="flex flex-wrap gap-1 mb-2">${cats.map(c => this.catBadge(c)).join('')}</div>` : ''}
            ${l.fault_info ? `<div class="text-xs sm:text-sm text-gray-300 line-clamp-2"><i class="fas fa-exclamation-triangle text-red-400 mr-1"></i>${this.esc(l.fault_info)}</div>` : ''}
            <div class="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
              <span><i class="fas fa-user-check mr-1"></i>Kontrol: ${this.esc(l.checked_by)}</span>
              ${l.performed_by ? `<span><i class="fas fa-user-cog mr-1"></i>Yapan: ${this.esc(l.performed_by)}</span>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Sayfalama alt -->
      ${totalPages > 1 ? `
      <div class="flex justify-center gap-2 mt-4">
        ${Array.from({ length: Math.min(totalPages, 10) }, (_, i) => `
          <button onclick="FieldChangelog.page=${i};FieldChangelog.loadArchive();" class="w-8 h-8 rounded-lg text-sm ${this.page === i ? 'gradient-btn text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}">${i + 1}</button>
        `).join('')}
      </div>` : ''}`;
    } catch (e) {
      el.innerHTML = `<div class="text-red-400">Hata: ${e.message}</div>`;
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // TAB 2: OTPA TİMELİNE ARAMA
  // ═══════════════════════════════════════════════════════════════════
  renderTimelineSearchTab(el) {
    el.innerHTML = `
    <div class="space-y-4">
      <p class="text-gray-400 text-sm">Bir OTPA No girerek o araca ait tüm müdahale geçmişini timeline olarak görüntüleyin.</p>
      <div class="flex flex-col sm:flex-row gap-3">
        <input id="fcl-timeline-otpa" placeholder="OTPA No girin (ör: OA20498)" class="flex-1 sm:max-w-md px-4 py-2.5 bg-gray-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none" onkeyup="if(event.key==='Enter') FieldChangelog.searchTimeline();">
        <button onclick="FieldChangelog.searchTimeline()" class="gradient-btn px-6 py-2.5 rounded-lg text-white font-semibold text-sm"><i class="fas fa-stream mr-2"></i>Timeline Göster</button>
      </div>
      <div id="fcl-timeline-preview"></div>
    </div>`;
  },

  async searchTimeline() {
    const input = document.getElementById('fcl-timeline-otpa');
    const otpa = input?.value?.trim();
    if (!otpa) return alert('Lütfen OTPA No girin');

    this.viewingTimeline = { otpaNo: otpa, logs: [] };
    history.pushState({ page: 'field-changelog', sub: 'timeline' }, '', '#field-changelog');
    this.render();
  },

  // ═══════════════════════════════════════════════════════════════════
  // TİMELİNE GÖRÜNÜMÜ
  // ═══════════════════════════════════════════════════════════════════
  async renderTimeline(c) {
    const otpaNo = this.viewingTimeline.otpaNo;
    c.innerHTML = '<div class="max-w-5xl mx-auto text-center py-16"><i class="fas fa-spinner fa-spin text-3xl text-blue-400"></i></div>';

    try {
      const data = await api.request(`/field-changelog/timeline/${encodeURIComponent(otpaNo)}`);
      this.viewingTimeline.logs = data.logs || [];
    } catch (e) {
      c.innerHTML = `<div class="max-w-5xl mx-auto"><div class="text-red-400 p-4">Hata: ${e.message}</div></div>`;
      return;
    }

    const logs = this.viewingTimeline.logs;

    c.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <!-- Header -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl">
        <div class="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div class="flex items-center gap-3 sm:gap-4">
            <button onclick="FieldChangelog.viewingTimeline=null;FieldChangelog.render();" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-arrow-left"></i></button>
            <div>
              <h1 class="text-lg sm:text-2xl font-bold text-white"><i class="fas fa-car mr-2 text-blue-400"></i>${this.esc(otpaNo)}</h1>
              <p class="text-gray-400 text-sm mt-1">${logs.length} müdahale kaydı</p>
            </div>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button onclick="FieldChangelog.editingLog='new';FieldChangelog.prefillOtpa='${this.esc(otpaNo)}';FieldChangelog.render();" class="gradient-btn px-3 py-2 rounded-lg text-white text-sm font-semibold"><i class="fas fa-plus mr-1"></i>Yeni Kayıt</button>
            ${logs.length ? `<button onclick="FieldChangelog.exportTimeline('${this.esc(otpaNo)}')" class="px-3 py-2 rounded-lg bg-green-500/20 text-green-300 text-sm hover:bg-green-500/30"><i class="fas fa-download mr-1"></i>Export</button>` : ''}
          </div>
        </div>

        <!-- Özet kartlar -->
        ${logs.length ? (() => {
          const totalParts = logs.reduce((s, l) => s + (l.parts?.length || 0), 0);
          const totalSw = logs.reduce((s, l) => s + (l.software?.length || 0), 0);
          const allCats = [...new Set(logs.flatMap(l => l.categories || []))];
          return `
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <div class="bg-gray-800/70 border border-gray-600/20 p-2 sm:p-3 rounded-xl text-center">
              <div class="text-xs sm:text-sm text-gray-400">Müdahale</div>
              <div class="text-lg sm:text-2xl font-bold text-blue-400">${logs.length}</div>
            </div>
            <div class="bg-gray-800/70 border border-gray-600/20 p-2 sm:p-3 rounded-xl text-center">
              <div class="text-xs sm:text-sm text-gray-400">Parça Değ.</div>
              <div class="text-lg sm:text-2xl font-bold text-yellow-400">${totalParts}</div>
            </div>
            <div class="bg-gray-800/70 border border-gray-600/20 p-2 sm:p-3 rounded-xl text-center">
              <div class="text-xs sm:text-sm text-gray-400">Yazılım</div>
              <div class="text-lg sm:text-2xl font-bold text-green-400">${totalSw}</div>
            </div>
            <div class="bg-gray-800/70 border border-gray-600/20 p-2 sm:p-3 rounded-xl text-center">
              <div class="text-xs sm:text-sm text-gray-400">Kategori</div>
              <div class="text-lg sm:text-2xl font-bold text-purple-400">${allCats.length}</div>
            </div>
          </div>`;
        })() : ''}
      </div>

      ${!logs.length ? `
        <div class="text-center py-12 text-gray-500">
          <i class="fas fa-stream text-5xl mb-3 block"></i>
          <p>Bu OTPA için henüz kayıt yok</p>
          <button onclick="FieldChangelog.editingLog='new';FieldChangelog.prefillOtpa='${this.esc(otpaNo)}';FieldChangelog.render();" class="gradient-btn px-4 py-2 rounded-lg text-white text-sm font-semibold mt-4"><i class="fas fa-plus mr-1"></i>İlk Kaydı Oluştur</button>
        </div>
      ` : ''}

      <!-- Timeline -->
      ${logs.map((l, idx) => `
      <div class="relative">
        ${idx < logs.length - 1 ? '<div class="absolute left-5 sm:left-6 top-16 bottom-0 w-0.5 bg-gray-700"></div>' : ''}
        <div class="flex gap-3 sm:gap-4">
          <!-- Timeline dot -->
          <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${l.software?.length ? 'bg-green-500/20 text-green-400' : l.parts?.length ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}">
            <i class="fas ${l.software?.length ? 'fa-code' : l.parts?.length ? 'fa-cog' : 'fa-wrench'} text-sm sm:text-base"></i>
          </div>
          <!-- Card -->
          <div class="flex-1 bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 sm:p-5 rounded-2xl hover:border-blue-400/30 transition-all cursor-pointer" onclick="FieldChangelog.openLogDetail(${l.id})">
            <div class="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
              <div>
                <div class="text-sm sm:text-base font-bold text-white">${this.fmtDate(l.start_date)}${l.end_date ? ' — ' + this.fmtDate(l.end_date) : ''}</div>
                <div class="flex flex-wrap gap-1 mt-1">${(l.categories || []).map(c => this.catBadge(c)).join('')}</div>
              </div>
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <span><i class="fas fa-user-check mr-1"></i>${this.esc(l.checked_by)}</span>
                ${l.performed_by ? `<span><i class="fas fa-user-cog mr-1"></i>${this.esc(l.performed_by)}</span>` : ''}
              </div>
            </div>

            ${l.fault_info ? `<div class="text-sm text-red-300 mb-2"><i class="fas fa-exclamation-triangle mr-1"></i>${this.esc(l.fault_info)}</div>` : ''}
            ${l.description ? `<div class="text-sm text-gray-300 mb-2">${this.esc(l.description)}</div>` : ''}

            <!-- Parça değişimleri mini tablo -->
            ${l.parts?.length ? `
            <div class="bg-gray-800/50 border border-white/5 rounded-lg p-2 mb-2">
              <div class="text-xs font-semibold text-gray-400 mb-1"><i class="fas fa-cog mr-1"></i>Parça Değişimleri (${l.parts.length})</div>
              <div class="space-y-1">
                ${l.parts.map(p => `
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-yellow-300 font-mono">${this.esc(p.part_no || '-')}</span>
                  ${p.component_group ? `<span class="text-gray-400">• ${this.esc(p.component_group)}</span>` : ''}
                  ${p.component_detail ? `<span class="text-gray-500">/ ${this.esc(p.component_detail)}</span>` : ''}
                  <span class="text-gray-600">×${p.qty || 1}</span>
                </div>`).join('')}
              </div>
            </div>` : ''}

            <!-- Yazılım versiyonları -->
            ${l.software?.length ? `
            <div class="bg-gray-800/50 border border-white/5 rounded-lg p-2 mb-2">
              <div class="text-xs font-semibold text-gray-400 mb-1"><i class="fas fa-code mr-1"></i>Yazılım Güncellemeleri</div>
              <div class="space-y-1">
                ${l.software.map(s => `
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-green-300 font-semibold">${this.esc(s.module_name)}</span>
                  <span class="text-gray-500">${this.esc(s.version_from || '?')}</span>
                  <i class="fas fa-arrow-right text-gray-600 text-xs"></i>
                  <span class="text-green-400 font-semibold">${this.esc(s.version_to || '?')}</span>
                </div>`).join('')}
              </div>
            </div>` : ''}

            ${l.attachments?.length ? `<div class="text-xs text-gray-500"><i class="fas fa-paperclip mr-1"></i>${l.attachments.length} ek dosya</div>` : ''}
          </div>
        </div>
      </div>`).join('')}
    </div>`;
  },

  // ═══════════════════════════════════════════════════════════════════
  // KAYIT DETAY GÖRÜNÜMÜ
  // ═══════════════════════════════════════════════════════════════════
  async openLogDetail(id) {
    try {
      this.viewingLog = await api.request(`/field-changelog/logs/${id}`);
      history.pushState({ page: 'field-changelog', sub: 'log-detail' }, '', '#field-changelog');
      this.render();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  renderLogDetail(c) {
    const l = this.viewingLog;
    if (!l) { this.render(); return; }

    c.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <!-- Header -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl">
        <div class="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div class="flex items-center gap-3 sm:gap-4">
            <button onclick="FieldChangelog.viewingLog=null;FieldChangelog.render();" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-arrow-left"></i></button>
            <div>
              <h1 class="text-lg sm:text-2xl font-bold text-white"><i class="fas fa-wrench mr-2 text-blue-400"></i>${this.esc(l.otpa_no)}</h1>
              <p class="text-gray-400 text-sm">${this.fmtDate(l.start_date)}${l.end_date ? ' → ' + this.fmtDate(l.end_date) : ''} • Kayıt #${l.id}</p>
            </div>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button onclick="FieldChangelog.viewingLog=null;FieldChangelog.viewingTimeline={otpaNo:'${this.esc(l.otpa_no)}',logs:[]};FieldChangelog.render();" class="px-3 py-2 rounded-lg bg-blue-500/20 text-blue-300 text-sm hover:bg-blue-500/30"><i class="fas fa-stream mr-1"></i>Timeline</button>
            ${this.isAdmin() || (l.created_by === authManager?.currentUser?.id) ? `
            <button onclick="FieldChangelog.startEdit(${l.id})" class="px-3 py-2 rounded-lg bg-yellow-500/20 text-yellow-300 text-sm hover:bg-yellow-500/30"><i class="fas fa-edit mr-1"></i>Düzenle</button>
            ` : ''}
            ${this.isAdmin() ? `
            <button onclick="FieldChangelog.deleteLog(${l.id})" class="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-sm hover:bg-red-500/30"><i class="fas fa-trash mr-1"></i>Sil</button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Kategoriler -->
      ${l.categories?.length ? `
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 rounded-2xl">
        <h3 class="text-sm font-semibold text-gray-400 mb-2"><i class="fas fa-tags mr-1"></i>İşlem Kategorileri</h3>
        <div class="flex flex-wrap gap-2">${l.categories.map(c => this.catBadge(c)).join('')}</div>
      </div>` : ''}

      <!-- Bilgiler -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-5 rounded-2xl">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><span class="text-gray-400"><i class="fas fa-user-check mr-1"></i>Kontrol Eden:</span> <span class="text-white font-semibold">${this.esc(l.checked_by)}</span></div>
          <div><span class="text-gray-400"><i class="fas fa-user-cog mr-1"></i>Yapan:</span> <span class="text-white font-semibold">${this.esc(l.performed_by || '-')}</span></div>
          <div><span class="text-gray-400"><i class="fas fa-calendar-alt mr-1"></i>Başlangıç:</span> <span class="text-white">${this.fmtDateTime(l.start_date)}</span></div>
          <div><span class="text-gray-400"><i class="fas fa-calendar-check mr-1"></i>Bitiş:</span> <span class="text-white">${this.fmtDateTime(l.end_date)}</span></div>
          <div><span class="text-gray-400"><i class="fas fa-user-plus mr-1"></i>Oluşturan:</span> <span class="text-white">${this.esc(l.created_by_name || '-')}</span></div>
          <div><span class="text-gray-400"><i class="fas fa-clock mr-1"></i>Kayıt Tarihi:</span> <span class="text-white">${this.fmtDateTime(l.created_at)}</span></div>
        </div>
        ${l.fault_info ? `<div class="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl"><div class="text-xs text-red-400 font-semibold mb-1"><i class="fas fa-exclamation-triangle mr-1"></i>Arıza Bilgisi</div><div class="text-sm text-white">${this.esc(l.fault_info)}</div></div>` : ''}
        ${l.description ? `<div class="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl"><div class="text-xs text-blue-400 font-semibold mb-1"><i class="fas fa-info-circle mr-1"></i>Açıklama</div><div class="text-sm text-white">${this.esc(l.description)}</div></div>` : ''}
      </div>

      <!-- Parça Değişimleri -->
      ${l.parts?.length ? `
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-5 rounded-2xl">
        <h3 class="text-base sm:text-lg font-bold text-white mb-3"><i class="fas fa-cog mr-2 text-yellow-400"></i>Parça Değişimleri (${l.parts.length})</h3>
        <div class="overflow-x-auto rounded-xl border border-white/10">
          <table class="w-full text-xs sm:text-sm">
            <thead class="bg-gray-800/50 text-gray-400 text-xs uppercase">
              <tr>
                <th class="px-3 py-2">Grup</th>
                <th class="px-3 py-2">Detay</th>
                <th class="px-3 py-2">Parça No</th>
                <th class="px-3 py-2">Adet</th>
                <th class="px-3 py-2 hidden sm:table-cell">Not</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              ${l.parts.map(p => `
              <tr class="hover:bg-white/5">
                <td class="px-3 py-2 text-white font-semibold">${this.esc(p.component_group || '-')}</td>
                <td class="px-3 py-2 text-gray-300">${this.esc(p.component_detail || '-')}</td>
                <td class="px-3 py-2 text-yellow-300 font-mono">${this.esc(p.part_no || '-')}</td>
                <td class="px-3 py-2 text-gray-300">${p.qty || 1}</td>
                <td class="px-3 py-2 text-gray-400 hidden sm:table-cell">${this.esc(p.note || '-')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}

      <!-- Yazılım Versiyonları -->
      ${l.software?.length ? `
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-5 rounded-2xl">
        <h3 class="text-base sm:text-lg font-bold text-white mb-3"><i class="fas fa-code mr-2 text-green-400"></i>Yazılım Güncellemeleri (${l.software.length})</h3>
        <div class="space-y-2">
          ${l.software.map(s => `
          <div class="flex items-center gap-3 bg-gray-800/50 border border-white/5 rounded-lg p-3">
            <div class="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 flex-shrink-0"><i class="fas fa-microchip"></i></div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-green-300">${this.esc(s.module_name)}</div>
              <div class="text-xs text-gray-400 flex items-center gap-2">
                <span class="font-mono">${this.esc(s.version_from || '?')}</span>
                <i class="fas fa-arrow-right text-gray-600"></i>
                <span class="font-mono text-green-400 font-semibold">${this.esc(s.version_to || '?')}</span>
              </div>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Ekler -->
      ${l.attachments?.length ? `
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-5 rounded-2xl">
        <h3 class="text-base sm:text-lg font-bold text-white mb-3"><i class="fas fa-paperclip mr-2 text-blue-400"></i>Ek Dosyalar (${l.attachments.length})</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${l.attachments.map(a => {
            const isImg = (a.file_original_name || '').match(/\.(jpg|jpeg|png|gif|webp)$/i);
            return `
            <div class="bg-gray-800/50 border border-white/5 rounded-lg p-3 flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center ${isImg ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'} flex-shrink-0">
                <i class="fas ${isImg ? 'fa-image' : 'fa-file-alt'}"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-white truncate">${this.esc(a.file_original_name || 'dosya')}</div>
                <div class="text-xs text-gray-500">${a.file_size ? (a.file_size / 1024).toFixed(0) + ' KB' : ''}</div>
              </div>
              <button onclick="FieldChangelog.downloadAttachment(${a.id})" class="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center hover:bg-blue-500/30"><i class="fas fa-download"></i></button>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- Dosya Yükle -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 rounded-2xl">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-400"><i class="fas fa-upload mr-1"></i>Dosya Ekle</h3>
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <input type="file" id="fcl-upload-files" multiple class="flex-1 text-sm text-gray-400">
          <button onclick="FieldChangelog.uploadFiles(${l.id})" class="gradient-btn px-4 py-2 rounded-lg text-white text-sm font-semibold"><i class="fas fa-cloud-upload-alt mr-1"></i>Yükle</button>
        </div>
      </div>
    </div>`;
  },

  // ═══════════════════════════════════════════════════════════════════
  // YENİ / DÜZENLEME FORMU
  // ═══════════════════════════════════════════════════════════════════
  async startEdit(id) {
    try {
      this.editingLog = await api.request(`/field-changelog/logs/${id}`);
      history.pushState({ page: 'field-changelog', sub: 'edit' }, '', '#field-changelog');
      this.render();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  renderLogForm(c) {
    const isNew = this.editingLog === 'new';
    const d = isNew ? {} : this.editingLog;
    const cats = d.categories || [];
    const parts = d.parts || [{ component_group: '', component_detail: '', part_no: '', qty: 1, note: '' }];
    const sw = d.software || [];
    const hasSw = cats.includes('Yazılım Güncelleme') || sw.length > 0;

    // Prefill OTPA
    const prefillOtpa = this.prefillOtpa || d.otpa_no || '';
    this.prefillOtpa = null;

    c.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl">
        <div class="flex items-center gap-3 sm:gap-4 mb-4">
          <button onclick="FieldChangelog.editingLog=null;FieldChangelog.render();" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-arrow-left"></i></button>
          <h1 class="text-base sm:text-xl font-bold text-white"><i class="fas ${isNew ? 'fa-plus-circle' : 'fa-edit'} mr-2 text-blue-400"></i>${isNew ? 'Yeni Saha Değişiklik Kaydı' : 'Kaydı Düzenle'}</h1>
        </div>

        <!-- Üst bilgi -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label class="block text-xs sm:text-sm text-gray-400 mb-1">OTPA No <span class="text-red-400">*</span></label>
            <input id="fcl-e-otpa" value="${this.esc(prefillOtpa)}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" placeholder="ör: OA20498">
          </div>
          <div>
            <label class="block text-xs sm:text-sm text-gray-400 mb-1">Kontrol Eden <span class="text-red-400">*</span></label>
            <input id="fcl-e-checked" value="${this.esc(d.checked_by || '')}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" placeholder="Kontrol eden personel">
          </div>
          <div>
            <label class="block text-xs sm:text-sm text-gray-400 mb-1">Başlangıç Tarihi <span class="text-red-400">*</span></label>
            <input id="fcl-e-start" type="datetime-local" value="${this.fmtDateInput(d.start_date)}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" style="color-scheme:dark;">
          </div>
          <div>
            <label class="block text-xs sm:text-sm text-gray-400 mb-1">Bitiş Tarihi</label>
            <input id="fcl-e-end" type="datetime-local" value="${this.fmtDateInput(d.end_date)}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" style="color-scheme:dark;">
          </div>
          <div>
            <label class="block text-xs sm:text-sm text-gray-400 mb-1">Yapan Personel</label>
            <input id="fcl-e-performed" value="${this.esc(d.performed_by || '')}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" placeholder="Yapan personel">
          </div>
        </div>
      </div>

      <!-- Kategori seçimi -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-5 rounded-2xl">
        <h3 class="text-sm sm:text-base font-bold text-white mb-3"><i class="fas fa-tags mr-2 text-purple-400"></i>İşlem Kategorileri <span class="text-xs text-gray-500">(çoklu seçim)</span></h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" id="fcl-cats-grid">
          ${this.categories.map(cat => `
          <label class="flex items-center gap-2 p-2 rounded-lg border border-white/10 hover:border-blue-400/30 cursor-pointer transition-all ${cats.includes(cat) ? 'bg-blue-500/10 border-blue-400/30' : ''}">
            <input type="checkbox" class="fcl-cat-cb rounded" value="${this.esc(cat)}" ${cats.includes(cat) ? 'checked' : ''} onchange="FieldChangelog.onCatChange()">
            <span class="text-sm text-white">${this.esc(cat)}</span>
          </label>`).join('')}
        </div>
      </div>

      <!-- Arıza & Açıklama -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-5 rounded-2xl space-y-3">
        <div>
          <label class="block text-xs sm:text-sm text-gray-400 mb-1"><i class="fas fa-exclamation-triangle mr-1 text-red-400"></i>Arıza Bilgisi</label>
          <textarea id="fcl-e-fault" rows="2" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none resize-none" placeholder="Arıza / hata açıklaması...">${this.esc(d.fault_info || '')}</textarea>
        </div>
        <div>
          <label class="block text-xs sm:text-sm text-gray-400 mb-1"><i class="fas fa-info-circle mr-1 text-blue-400"></i>Açıklama</label>
          <textarea id="fcl-e-desc" rows="3" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none resize-none" placeholder="Yapılan işlemler ve açıklamalar...">${this.esc(d.description || '')}</textarea>
        </div>
      </div>

      <!-- Parça Değişimleri -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-5 rounded-2xl">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-sm sm:text-base font-bold text-white"><i class="fas fa-cog mr-2 text-yellow-400"></i>Parça Değişimleri</h3>
          <button onclick="FieldChangelog.addPartRow()" class="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs hover:bg-yellow-500/30"><i class="fas fa-plus mr-1"></i>Satır Ekle</button>
        </div>
        <div id="fcl-parts-container" class="space-y-2">
          ${parts.map((p, i) => this.partRowHtml(p, i)).join('')}
        </div>
      </div>

      <!-- Yazılım Güncellemeleri -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-5 rounded-2xl" id="fcl-sw-section" style="${hasSw ? '' : 'display:none'}">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-sm sm:text-base font-bold text-white"><i class="fas fa-code mr-2 text-green-400"></i>Yazılım Güncellemeleri</h3>
          <button onclick="FieldChangelog.addSwRow()" class="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 text-xs hover:bg-green-500/30"><i class="fas fa-plus mr-1"></i>Satır Ekle</button>
        </div>
        <div id="fcl-sw-container" class="space-y-2">
          ${sw.length ? sw.map((s, i) => this.swRowHtml(s, i)).join('') : this.swRowHtml({}, 0)}
        </div>
      </div>

      <!-- Kaydet -->
      <div class="flex gap-3 justify-end">
        <button onclick="FieldChangelog.editingLog=null;FieldChangelog.render();" class="px-5 py-2.5 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600">İptal</button>
        <button onclick="FieldChangelog.saveLog()" class="gradient-btn px-5 py-2.5 rounded-xl text-white font-semibold"><i class="fas fa-save mr-1"></i>${isNew ? 'Oluştur' : 'Güncelle'}</button>
      </div>
    </div>`;
  },

  partRowHtml(p, idx) {
    return `
    <div class="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end fcl-part-row">
      <div class="sm:col-span-1">
        <label class="block text-xs text-gray-500 mb-1">${idx === 0 ? 'Komponent Grubu' : ''}</label>
        <select class="fcl-p-group w-full px-2 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-xs" style="color-scheme:dark;">
          <option value="">Grup seç</option>
          ${['BATARYA', 'PDU', 'VCCU', 'LENZE', 'Diğer'].map(g => `<option value="${g}" ${p.component_group === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </div>
      <div class="sm:col-span-1">
        <label class="block text-xs text-gray-500 mb-1">${idx === 0 ? 'Detay' : ''}</label>
        <input class="fcl-p-detail w-full px-2 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white text-xs" value="${this.esc(p.component_detail || '')}" placeholder="Kontaktör, BCU...">
      </div>
      <div class="sm:col-span-1">
        <label class="block text-xs text-gray-500 mb-1">${idx === 0 ? 'Parça No' : ''}</label>
        <input class="fcl-p-partno w-full px-2 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white text-xs font-mono" value="${this.esc(p.part_no || '')}" placeholder="PN-12345">
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">${idx === 0 ? 'Adet' : ''}</label>
        <input class="fcl-p-qty w-full px-2 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white text-xs text-center" type="number" min="1" value="${p.qty || 1}">
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">${idx === 0 ? 'Not' : ''}</label>
        <input class="fcl-p-note w-full px-2 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white text-xs" value="${this.esc(p.note || '')}" placeholder="Not...">
      </div>
      <div class="flex justify-end">
        <button onclick="this.closest('.fcl-part-row').remove()" class="w-8 h-8 rounded-lg bg-red-500/20 text-red-300 flex items-center justify-center hover:bg-red-500/30"><i class="fas fa-times"></i></button>
      </div>
    </div>`;
  },

  addPartRow() {
    const container = document.getElementById('fcl-parts-container');
    if (!container) return;
    const idx = container.querySelectorAll('.fcl-part-row').length;
    container.insertAdjacentHTML('beforeend', this.partRowHtml({}, idx));
  },

  swRowHtml(s, idx) {
    return `
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end fcl-sw-row">
      <div>
        <label class="block text-xs text-gray-500 mb-1">${idx === 0 ? 'Modül' : ''}</label>
        <select class="fcl-sw-module w-full px-2 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-xs" style="color-scheme:dark;">
          <option value="">Modül seç</option>
          ${['VCCU', 'BMS', 'HMI', 'Inverter', 'LENZE', 'Diğer'].map(m => `<option value="${m}" ${s.module_name === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">${idx === 0 ? 'Eski Versiyon' : ''}</label>
        <input class="fcl-sw-from w-full px-2 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white text-xs font-mono" value="${this.esc(s.version_from || '')}" placeholder="1.0.0">
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">${idx === 0 ? 'Yeni Versiyon' : ''}</label>
        <input class="fcl-sw-to w-full px-2 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white text-xs font-mono" value="${this.esc(s.version_to || '')}" placeholder="1.2.3">
      </div>
      <div class="flex justify-end">
        <button onclick="this.closest('.fcl-sw-row').remove()" class="w-8 h-8 rounded-lg bg-red-500/20 text-red-300 flex items-center justify-center hover:bg-red-500/30"><i class="fas fa-times"></i></button>
      </div>
    </div>`;
  },

  addSwRow() {
    const container = document.getElementById('fcl-sw-container');
    if (!container) return;
    const idx = container.querySelectorAll('.fcl-sw-row').length;
    container.insertAdjacentHTML('beforeend', this.swRowHtml({}, idx));
  },

  onCatChange() {
    const swSection = document.getElementById('fcl-sw-section');
    const checked = [...document.querySelectorAll('.fcl-cat-cb:checked')].map(cb => cb.value);
    if (swSection) swSection.style.display = checked.includes('Yazılım Güncelleme') ? '' : 'none';
  },

  async saveLog() {
    const isNew = this.editingLog === 'new';
    const logId = isNew ? null : this.editingLog?.id;

    const otpa_no = document.getElementById('fcl-e-otpa')?.value?.trim();
    const start_date = document.getElementById('fcl-e-start')?.value;
    const end_date = document.getElementById('fcl-e-end')?.value || null;
    const performed_by = document.getElementById('fcl-e-performed')?.value?.trim() || null;
    const checked_by = document.getElementById('fcl-e-checked')?.value?.trim();
    const fault_info = document.getElementById('fcl-e-fault')?.value?.trim() || null;
    const description = document.getElementById('fcl-e-desc')?.value?.trim() || null;

    const categories = [...document.querySelectorAll('.fcl-cat-cb:checked')].map(cb => cb.value);

    // Parçalar
    const parts = [];
    document.querySelectorAll('.fcl-part-row').forEach(row => {
      const pn = row.querySelector('.fcl-p-partno')?.value?.trim();
      const g = row.querySelector('.fcl-p-group')?.value;
      const d = row.querySelector('.fcl-p-detail')?.value?.trim();
      if (pn || g || d) {
        parts.push({
          component_group: g || null,
          component_detail: d || null,
          part_no: pn || null,
          qty: parseInt(row.querySelector('.fcl-p-qty')?.value) || 1,
          note: row.querySelector('.fcl-p-note')?.value?.trim() || null
        });
      }
    });

    // Yazılım
    const software = [];
    document.querySelectorAll('.fcl-sw-row').forEach(row => {
      const mod = row.querySelector('.fcl-sw-module')?.value;
      const to = row.querySelector('.fcl-sw-to')?.value?.trim();
      if (mod && to) {
        software.push({
          module_name: mod,
          version_from: row.querySelector('.fcl-sw-from')?.value?.trim() || null,
          version_to: to
        });
      }
    });

    // Validasyon
    if (!otpa_no) return alert('OTPA No zorunludur');
    if (!start_date) return alert('Başlangıç tarihi zorunludur');
    if (!checked_by) return alert('Kontrol eden personel zorunludur');
    if (categories.includes('Diğer') && !description) return alert('"Diğer" seçildiğinde açıklama zorunludur');
    if (categories.includes('Yazılım Güncelleme') && !software.length) return alert('Yazılım güncelleme seçildiyse en az 1 yazılım bilgisi gereklidir');

    const body = { otpa_no, start_date, end_date, performed_by, checked_by, fault_info, description, categories, parts, software };

    try {
      if (isNew) {
        await api.request('/field-changelog/logs', { method: 'POST', body: JSON.stringify(body) });
      } else {
        await api.request(`/field-changelog/logs/${logId}`, { method: 'PUT', body: JSON.stringify(body) });
      }
      this.editingLog = null;
      this.viewingLog = null;
      this.render();
    } catch (e) {
      alert('Hata: ' + e.message);
    }
  },

  async deleteLog(id) {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
      await api.request(`/field-changelog/logs/${id}`, { method: 'DELETE' });
      this.viewingLog = null;
      this.render();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  // ═══════════════════════════════════════════════════════════════════
  // DOSYA İŞLEMLERİ
  // ═══════════════════════════════════════════════════════════════════
  async uploadFiles(logId) {
    const input = document.getElementById('fcl-upload-files');
    if (!input?.files?.length) return alert('Dosya seçin');

    const formData = new FormData();
    for (const file of input.files) formData.append('files', file);

    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/field-changelog/logs/${logId}/attachments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Yükleme hatası'); }
      // Refresh
      this.openLogDetail(logId);
    } catch (e) { alert('Hata: ' + e.message); }
  },

  downloadAttachment(id) {
    const token = localStorage.getItem('token');
    fetch(`/api/field-changelog/attachments/${id}/download`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(async r => {
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'İndirme hatası'); }
      const fname = (r.headers.get('content-disposition') || '').match(/filename[^;=\n]*=(['"]?)([^'"\n]*?)\1(;|$)/)?.[2] || 'file';
      return r.blob().then(blob => ({ blob, fname }));
    }).then(({ blob, fname }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = decodeURIComponent(fname);
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    }).catch(e => alert(e.message));
  },

  // ═══════════════════════════════════════════════════════════════════
  // TAB 4: EXCEL IMPORT
  // ═══════════════════════════════════════════════════════════════════
  renderImportTab(el) {
    el.innerHTML = `
    <div class="space-y-4">
      <div class="bg-gray-800/50 border border-white/10 p-4 sm:p-5 rounded-xl">
        <h3 class="text-base font-bold text-white mb-2"><i class="fas fa-file-excel mr-2 text-green-400"></i>Excel Import</h3>
        <p class="text-sm text-gray-400 mb-4">Eski kayıtları Excel dosyasından toplu olarak içeri aktarın.</p>

        <div class="bg-gray-900/60 border border-white/5 p-3 rounded-lg mb-4">
          <div class="text-xs font-semibold text-gray-400 mb-2">Beklenen Excel Kolonları:</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-gray-500">
            <div><span class="text-white font-mono">Araç OTPA</span> — OTPA No (zorunlu)</div>
            <div><span class="text-white font-mono">Başlangıç tarihi</span> — Başlangıç (zorunlu)</div>
            <div><span class="text-white font-mono">Bitiş tarihi</span> — Bitiş</div>
            <div><span class="text-white font-mono">Kontrol eden</span> — Kontrol Eden (zorunlu)</div>
            <div><span class="text-white font-mono">Yapan</span> — Yapan Personel</div>
            <div><span class="text-white font-mono">Arıza</span> — Arıza Bilgisi</div>
            <div><span class="text-white font-mono">Açıklama</span> — Açıklama</div>
            <div><span class="text-white font-mono">Parça No</span> — Parça numaraları (virgülle ayrılabilir)</div>
            <div><span class="text-white font-mono">PDU, VCCU, BATARYA...</span> — Evet/Hayır kategori kolonları</div>
            <div><span class="text-white font-mono">Yazılım Modül / SW From / SW To</span> — Yazılım bilgileri</div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <input type="file" id="fcl-import-file" accept=".xlsx,.xls" class="flex-1 text-sm text-gray-400">
          <button onclick="FieldChangelog.doImport()" class="gradient-btn px-6 py-2.5 rounded-lg text-white font-semibold text-sm"><i class="fas fa-upload mr-1"></i>Import Et</button>
        </div>
      </div>

      <div id="fcl-import-result"></div>
    </div>`;
  },

  async doImport() {
    const input = document.getElementById('fcl-import-file');
    if (!input?.files?.length) return alert('Excel dosyası seçin');

    const resultEl = document.getElementById('fcl-import-result');
    if (resultEl) resultEl.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-2xl text-blue-400"></i><p class="text-gray-400 text-sm mt-2">Import işleniyor...</p></div>';

    const formData = new FormData();
    formData.append('file', input.files[0]);

    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/field-changelog/import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Import hatası');

      if (resultEl) {
        resultEl.innerHTML = `
        <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-5 rounded-xl space-y-3">
          <h3 class="text-base font-bold text-white"><i class="fas fa-check-circle mr-2 text-green-400"></i>Import Tamamlandı</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div class="bg-green-500/10 border border-green-500/20 p-3 rounded-lg text-center">
              <div class="text-2xl font-bold text-green-400">${data.successCount}</div>
              <div class="text-xs text-gray-400">Başarılı</div>
            </div>
            <div class="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-center">
              <div class="text-2xl font-bold text-red-400">${data.errorCount}</div>
              <div class="text-xs text-gray-400">Hatalı</div>
            </div>
            <div class="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-center">
              <div class="text-2xl font-bold text-blue-400">${data.successCount + data.errorCount}</div>
              <div class="text-xs text-gray-400">Toplam Satır</div>
            </div>
          </div>
          ${data.errors?.length ? `
          <div>
            <h4 class="text-sm font-semibold text-red-400 mb-2"><i class="fas fa-exclamation-triangle mr-1"></i>Hatalar</h4>
            <div class="max-h-48 overflow-y-auto space-y-1">
              ${data.errors.map(e => `
              <div class="text-xs text-red-300 bg-red-500/10 px-3 py-1.5 rounded">Satır ${e.row}: ${this.esc(e.error)}</div>
              `).join('')}
            </div>
          </div>` : ''}
        </div>`;
      }
    } catch (e) {
      if (resultEl) resultEl.innerHTML = `<div class="text-red-400 p-4">Import hatası: ${e.message}</div>`;
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════
  async exportTimeline(otpaNo) {
    try {
      const data = await api.request(`/field-changelog/export/${encodeURIComponent(otpaNo)}`);
      const logs = data.logs || [];
      if (!logs.length) return alert('Export edilecek kayıt yok');

      // HTML rapor oluştur
      const now = new Date().toLocaleString('tr-TR');
      let html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Saha Değişiklik Geçmişi — ${this.esc(otpaNo)}</title>
      <style>
        body{font-family:'Segoe UI',sans-serif;padding:30px;color:#1a1a2e;font-size:12px}
        h1{color:#1e3a5f;border-bottom:3px solid #1e3a5f;padding-bottom:10px}
        h2{color:#2563eb;margin-top:25px}
        .card{border:1px solid #d1d9e6;border-radius:8px;padding:15px;margin:10px 0;page-break-inside:avoid}
        .card-header{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:8px}
        .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:bold;background:#e5e9f0;margin:2px}
        table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #d1d9e6;padding:6px 8px;text-align:left;font-size:11px}
        th{background:#e5e9f0;font-weight:700}
        .fault{background:#fef2f2;border-left:3px solid #f87171;padding:8px;border-radius:4px;margin:5px 0}
        .sw{background:#d1fae5;padding:3px 8px;border-radius:4px;font-family:monospace;font-size:11px}
        @media print{body{padding:15mm}}
      </style></head><body>
      <h1>Saha Değişiklik Geçmişi — ${this.esc(otpaNo)}</h1>
      <p><strong>Rapor Tarihi:</strong> ${now} | <strong>Toplam Kayıt:</strong> ${logs.length}</p>`;

      for (const l of logs) {
        html += `<div class="card">
          <div class="card-header">
            <div><strong>${this.fmtDate(l.start_date)}${l.end_date ? ' → ' + this.fmtDate(l.end_date) : ''}</strong></div>
            <div><strong>Kontrol:</strong> ${this.esc(l.checked_by)} ${l.performed_by ? '| <strong>Yapan:</strong> ' + this.esc(l.performed_by) : ''}</div>
          </div>
          <div>${(l.categories || []).map(c => `<span class="badge">${this.esc(c)}</span>`).join('')}</div>
          ${l.fault_info ? `<div class="fault"><strong>Arıza:</strong> ${this.esc(l.fault_info)}</div>` : ''}
          ${l.description ? `<p><strong>Açıklama:</strong> ${this.esc(l.description)}</p>` : ''}
          ${l.parts?.length ? `<table><thead><tr><th>Grup</th><th>Detay</th><th>Parça No</th><th>Adet</th><th>Not</th></tr></thead><tbody>
            ${l.parts.map(p => `<tr><td>${this.esc(p.component_group || '-')}</td><td>${this.esc(p.component_detail || '-')}</td><td>${this.esc(p.part_no || '-')}</td><td>${p.qty || 1}</td><td>${this.esc(p.note || '-')}</td></tr>`).join('')}
          </tbody></table>` : ''}
          ${l.software?.length ? `<div><strong>Yazılım:</strong> ${l.software.map(s => `<span class="sw">${this.esc(s.module_name)}: ${this.esc(s.version_from || '?')} → ${this.esc(s.version_to || '?')}</span>`).join(' ')}</div>` : ''}
        </div>`;
      }

      html += `<p style="text-align:center;color:#999;font-size:10px;margin-top:30px">Bu rapor E-LAB Saha Değişiklik Geçmişi sistemi tarafından otomatik oluşturulmuştur — ${now}</p></body></html>`;

      // Download
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Saha_Degisiklik_${otpaNo}_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) { alert('Export hatası: ' + e.message); }
  }
};

// Export
window.FieldChangelog = FieldChangelog;
