// ═══════════════════════════════════════════════════════════════════════════════
// PROSEDÜR & OTPA RAPOR MODÜLÜ — FRONTEND
// Tabs: Prosedürler | OTPA Kayıtları | Form Şablonları | Raporlar
// ═══════════════════════════════════════════════════════════════════════════════
const ProsedurOtpa = {
  // ─── State ────────────────────────────────────────────────────────
  tab: 'otpa',           // aktif tab
  docs: [],              // prosedürler listesi
  otpas: [],             // OTPA kayıtları
  templates: [],         // form şablonları
  stats: null,           // dashboard istatistik
  // Detay state
  viewingOtpa: null,     // seçili OTPA detay verisi
  viewingDoc: null,      // doküman düzenleme
  viewingTemplate: null, // şablon düzenleme
  fillingForm: null,     // aktif doldurma
  viewingBatteryReport: null, // batarya rapor görüntüleme { otpa, batteryNo, forms }
  searchTerm: '',

  // ─── Helpers ──────────────────────────────────────────────────────
  esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; },
  fmtDate(d) { if (!d) return '-'; try { return new Date(d).toLocaleDateString('tr-TR'); } catch { return d; } },
  fmtDateTime(d) { if (!d) return '-'; try { return new Date(d).toLocaleString('tr-TR'); } catch { return d; } },
  isAdmin() { return authManager?.currentUser?.role === 'admin'; },
  isKalite() { const r = authManager?.currentUser?.role; return r === 'admin' || r === 'kalite'; },
  badge(t, c) { return `<span class="px-2 py-0.5 rounded-full text-xs font-bold ${c}">${t}</span>`; },

  formTypeBadge(t) {
    const m = { giris: ['Giriş', 'bg-blue-500/20 text-blue-300'], proses: ['Proses', 'bg-yellow-500/20 text-yellow-300'], final: ['Final', 'bg-green-500/20 text-green-300'] };
    const v = m[t] || [t, 'bg-gray-500/20 text-gray-300'];
    return this.badge(v[0], v[1]);
  },

  statusBadge(s) {
    const m = { open: ['Açık', 'bg-blue-500/20 text-blue-300'], closed: ['Kapalı', 'bg-gray-500/20 text-gray-300'], draft: ['Taslak', 'bg-yellow-500/20 text-yellow-300'], completed: ['Tamamlandı', 'bg-green-500/20 text-green-300'] };
    const v = m[s] || [s, 'bg-gray-500/20 text-gray-300'];
    return this.badge(v[0], v[1]);
  },

  docTypeBadge(t) {
    const m = { prosedur: ['Prosedür', 'bg-indigo-500/20 text-indigo-300'], talimat: ['Talimat', 'bg-teal-500/20 text-teal-300'], form: ['Form', 'bg-orange-500/20 text-orange-300'], rapor: ['Rapor', 'bg-pink-500/20 text-pink-300'] };
    const v = m[t] || [t, 'bg-gray-500/20 text-gray-300'];
    return this.badge(v[0], v[1]);
  },

  // ═══════════════════════════════════════════════════════════════════
  // RENDER — Ana sayfa
  // ═══════════════════════════════════════════════════════════════════
  async render() {
    const c = document.getElementById('content');
    if (!c) return;

    // Eğer form doldurma modundaysa
    if (this.fillingForm) { this.renderFormFiller(c); return; }
    // Eğer batarya rapor görüntüleme modundaysa
    if (this.viewingBatteryReport) { this.renderBatteryReport(c); return; }
    // Eğer OTPA detay modundaysa
    if (this.viewingOtpa) { this.renderOtpaDetail(c); return; }
    // Eğer şablon düzenleme modundaysa
    if (this.viewingTemplate) { this.renderTemplateEditor(c); return; }

    // İstatistik çek
    try { this.stats = await api.request('/prosedur-otpa/stats'); } catch { this.stats = { document_count: 0, otpa_count: 0, completed_form_count: 0, template_count: 0 }; }

    c.innerHTML = `
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Başlık -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 class="text-xl sm:text-3xl font-bold gradient-text"><i class="fas fa-file-alt mr-2"></i>Prosedür & OTPA Rapor</h1>
            <p class="text-gray-400 mt-1 text-xs sm:text-base">Doküman Yönetimi • Kalite Kontrol Formları • OTPA Arşivi</p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 px-2 sm:px-4 py-2 rounded-xl"><div class="text-lg sm:text-2xl font-bold text-blue-400">${this.stats.document_count}</div><div class="text-xs text-gray-400">Doküman</div></div>
            <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 px-2 sm:px-4 py-2 rounded-xl"><div class="text-lg sm:text-2xl font-bold text-green-400">${this.stats.otpa_count}</div><div class="text-xs text-gray-400">OTPA</div></div>
            <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 px-2 sm:px-4 py-2 rounded-xl"><div class="text-lg sm:text-2xl font-bold text-yellow-400">${this.stats.completed_form_count}</div><div class="text-xs text-gray-400">Form</div></div>
            <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 px-2 sm:px-4 py-2 rounded-xl"><div class="text-lg sm:text-2xl font-bold text-purple-400">${this.stats.template_count}</div><div class="text-xs text-gray-400">Şablon</div></div>
          </div>
        </div>
      </div>

      <!-- Tablar -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 rounded-2xl overflow-hidden">
        <div class="flex border-b border-white/10 overflow-x-auto">
          ${['otpa', 'prosedurler', 'sablonlar', 'raporlar'].map(t => {
            const labels = { otpa: '<i class="fas fa-folder-open mr-1"></i>OTPA Kayıtları', prosedurler: '<i class="fas fa-book mr-1"></i>Prosedürler', sablonlar: '<i class="fas fa-clipboard-list mr-1"></i>Form Şablonları', raporlar: '<i class="fas fa-chart-bar mr-1"></i>Raporlar' };
            const active = this.tab === t;
            return `<button data-tab="${t}" onclick="ProsedurOtpa.switchTab('${t}')" class="po-tab-btn flex-1 min-w-0 px-2 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${active ? 'gradient-btn text-white border-b-2 border-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}">${labels[t]}</button>`;
          }).join('')}
        </div>
        <div class="p-3 sm:p-6" id="po-tab-content">
          <!-- Tab içeriği buraya render edilecek -->
        </div>
      </div>
    </div>`;

    this.renderTabContent();
  },

  switchTab(t) {
    this.tab = t;
    // Tab butonlarının aktif stilini güncelle
    document.querySelectorAll('.po-tab-btn').forEach(btn => {
      const isActive = btn.dataset.tab === t;
      btn.className = `po-tab-btn flex-1 min-w-0 px-2 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${isActive ? 'gradient-btn text-white border-b-2 border-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`;
    });
    this.renderTabContent();
  },

  async renderTabContent() {
    const el = document.getElementById('po-tab-content');
    if (!el) return;
    el.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-3xl text-blue-400"></i></div>';
    switch (this.tab) {
      case 'otpa': await this.renderOtpaTab(el); break;
      case 'prosedurler': await this.renderDocsTab(el); break;
      case 'sablonlar': await this.renderTemplatesTab(el); break;
      case 'raporlar': await this.renderReportsTab(el); break;
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // TAB 1: OTPA KAYITLARI
  // ═══════════════════════════════════════════════════════════════════
  async renderOtpaTab(el) {
    try {
      const search = this.searchTerm ? `?search=${encodeURIComponent(this.searchTerm)}` : '';
      this.otpas = await api.request(`/prosedur-otpa/otpa${search}`);
    } catch (e) { el.innerHTML = `<div class="text-red-400">Hata: ${e.message}</div>`; return; }

    el.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div class="flex gap-2 items-center flex-1 w-full sm:w-auto">
          <div class="relative flex-1 max-w-md">
            <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
            <input id="po-otpa-search" value="${this.esc(this.searchTerm)}" placeholder="OTPA No, Proje veya Sorumlu ara..." class="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none" onkeyup="if(event.key==='Enter'){ProsedurOtpa.searchTerm=this.value;ProsedurOtpa.renderTabContent();}">
          </div>
        </div>
        ${this.isKalite() ? `<button onclick="ProsedurOtpa.showOtpaForm()" class="gradient-btn px-4 py-2.5 rounded-xl text-white text-sm font-semibold whitespace-nowrap"><i class="fas fa-plus mr-1"></i>Yeni OTPA</button>` : ''}
      </div>

      ${!this.otpas.length
        ? '<div class="text-center py-16 text-gray-500"><i class="fas fa-folder-open text-5xl mb-3 block"></i><p>Henüz OTPA kaydı yok</p></div>'
        : `<div class="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          ${this.otpas.map(o => `
            <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 sm:p-4 rounded-xl hover:border-blue-400/30 transition-all cursor-pointer group" onclick="ProsedurOtpa.openOtpaDetail(${o.id})">
              <div class="flex items-start justify-between mb-2 sm:mb-3">
                <div class="min-w-0 flex-1 mr-2">
                  <div class="text-base sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors truncate">${this.esc(o.otpa_no)}</div>
                  <div class="text-xs sm:text-sm text-gray-400 truncate">${this.esc(o.project_name || '-')}</div>
                </div>
                ${this.statusBadge(o.status)}
              </div>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div class="text-gray-400"><i class="fas fa-user mr-1"></i>${this.esc(o.responsible_tech || '-')}</div>
                <div class="text-gray-400"><i class="fas fa-battery-full mr-1"></i>${o.battery_count || 0} Batarya</div>
                <div class="text-gray-400"><i class="fas fa-calendar mr-1"></i>${this.fmtDate(o.production_date)}</div>
                <div class="text-gray-400"><i class="fas fa-file-alt mr-1"></i>${o.form_count || 0} Form</div>
              </div>
              <div class="mt-3 flex gap-2">
                <div class="flex-1 bg-gray-700 rounded-full h-2">
                  <div class="h-2 rounded-full ${o.completed_form_count > 0 ? 'bg-green-500' : 'bg-gray-600'}" style="width: ${o.form_count ? Math.round((o.completed_form_count / o.form_count) * 100) : 0}%"></div>
                </div>
                <span class="text-xs text-gray-400">${o.completed_form_count || 0}/${o.form_count || 0}</span>
              </div>
            </div>
          `).join('')}
        </div>`
      }
    </div>`;
  },

  // OTPA oluştur/düzenle
  showOtpaForm(data = null) {
    const isEdit = !!data;
    const el = document.getElementById('po-tab-content');
    if (!el) return;
    el.innerHTML = `
    <div class="max-w-2xl mx-auto space-y-4">
      <div class="flex items-center gap-3 mb-4">
        <button onclick="ProsedurOtpa.renderTabContent()" class="text-gray-400 hover:text-white"><i class="fas fa-arrow-left text-lg"></i></button>
        <h2 class="text-xl font-bold text-white">${isEdit ? 'OTPA Düzenle' : 'Yeni OTPA Oluştur'}</h2>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">OTPA No <span class="text-red-400">*</span></label>
          <input id="po-f-otpano" value="${this.esc(data?.otpa_no || '')}" ${isEdit ? 'readonly class="w-full px-3 py-2 bg-gray-700 text-gray-400 border border-white/10 rounded-lg"' : 'class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none"'} placeholder="Ör: OTPA-2025-001">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Proje / Paket Adı</label>
          <input id="po-f-project" value="${this.esc(data?.project_name || '')}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" placeholder="Proje adı">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Üretim Tarihi</label>
          <input type="date" id="po-f-date" value="${data?.production_date ? data.production_date.substring(0,10) : ''}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" style="color-scheme:dark;">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Sorumlu Tekniker</label>
          <input id="po-f-tech" value="${this.esc(data?.responsible_tech || '')}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" placeholder="Tekniker adı">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Batarya Adedi</label>
          <div class="flex gap-2">
            ${[8, 10].map(n => `<button onclick="document.getElementById('po-f-bcount').value=${n};document.querySelectorAll('.po-bsel').forEach(b=>b.classList.remove('ring-2','ring-blue-400'));this.classList.add('ring-2','ring-blue-400');" class="po-bsel flex-1 px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white hover:bg-gray-700 transition-all ${data?.battery_count===n ? 'ring-2 ring-blue-400' : ''}">${n} Batarya</button>`).join('')}
            <input id="po-f-bcount" type="number" min="1" max="99" value="${data?.battery_count || 8}" class="w-20 px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white text-center focus:border-blue-400 focus:outline-none">
          </div>
        </div>
        ${isEdit ? `
        <div>
          <label class="block text-sm text-gray-400 mb-1">Durum</label>
          <select id="po-f-status" class="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" style="color-scheme:dark;">
            <option value="open" class="bg-gray-800 text-white" ${data?.status==='open'?'selected':''}>Açık</option>
            <option value="closed" class="bg-gray-800 text-white" ${data?.status==='closed'?'selected':''}>Kapalı</option>
          </select>
        </div>` : ''}
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Notlar</label>
        <textarea id="po-f-notes" rows="3" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none resize-none" placeholder="Ek notlar...">${this.esc(data?.notes || '')}</textarea>
      </div>
      <div class="flex gap-3 justify-end">
        <button onclick="ProsedurOtpa.renderTabContent()" class="px-5 py-2.5 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600">İptal</button>
        <button onclick="ProsedurOtpa.saveOtpa(${data?.id || 'null'})" class="gradient-btn px-5 py-2.5 rounded-xl text-white font-semibold"><i class="fas fa-save mr-1"></i>${isEdit ? 'Güncelle' : 'Oluştur'}</button>
      </div>
    </div>`;
  },

  async saveOtpa(id) {
    const body = {
      otpa_no: document.getElementById('po-f-otpano').value.trim(),
      project_name: document.getElementById('po-f-project').value.trim(),
      production_date: document.getElementById('po-f-date').value || null,
      responsible_tech: document.getElementById('po-f-tech').value.trim(),
      battery_count: parseInt(document.getElementById('po-f-bcount').value) || 8,
      notes: document.getElementById('po-f-notes').value.trim()
    };
    const statusEl = document.getElementById('po-f-status');
    if (statusEl) body.status = statusEl.value;
    if (!body.otpa_no) return alert('OTPA No zorunlu!');
    try {
      if (id) {
        await api.request(`/prosedur-otpa/otpa/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api.request('/prosedur-otpa/otpa', { method: 'POST', body: JSON.stringify(body) });
      }
      this.renderTabContent();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  async deleteOtpa(id) {
    if (!confirm('Bu OTPA ve tüm formları/dosyaları silinecek. Emin misiniz?')) return;
    try {
      await api.request(`/prosedur-otpa/otpa/${id}`, { method: 'DELETE' });
      this.viewingOtpa = null;
      this.render();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  // ═══════════════════════════════════════════════════════════════════
  // OTPA DETAY SAYFASI
  // ═══════════════════════════════════════════════════════════════════
  async openOtpaDetail(id) {
    try {
      this.viewingOtpa = await api.request(`/prosedur-otpa/otpa/${id}`);
      history.pushState({ page: 'prosedur-otpa', sub: 'otpa-detail' }, '', '#prosedur-otpa');
      this.render();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  async renderOtpaDetail(c) {
    const d = this.viewingOtpa;
    if (!d) { this.render(); return; }
    const otpa = d.otpa;
    const forms = d.forms || [];
    const files = d.files || [];

    let templates = [];
    try { templates = await api.request('/prosedur-otpa/form-templates'); } catch {}

    // Group forms by type
    const formsByType = {};
    forms.forEach(f => {
      const key = f.form_type || 'genel';
      if (!formsByType[key]) formsByType[key] = [];
      formsByType[key].push(f);
    });

    // Group files by category
    const filesByCat = {};
    files.forEach(f => {
      const key = f.file_category || 'genel';
      if (!filesByCat[key]) filesByCat[key] = [];
      filesByCat[key].push(f);
    });

    c.innerHTML = `
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Header -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl">
        <div class="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
          <div class="flex items-center gap-3 sm:gap-4">
            <button onclick="ProsedurOtpa.viewingOtpa=null;ProsedurOtpa.render();" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-arrow-left"></i></button>
            <div>
              <h1 class="text-lg sm:text-2xl font-bold text-white"><i class="fas fa-folder-open mr-2 text-blue-400"></i>${this.esc(otpa.otpa_no)}</h1>
              <p class="text-gray-400 mt-1">${this.esc(otpa.project_name || '')} ${this.statusBadge(otpa.status)}</p>
            </div>
          </div>
          <div class="flex gap-2 flex-wrap">
            ${this.isKalite() ? `<button onclick="ProsedurOtpa.showOtpaForm(ProsedurOtpa.viewingOtpa.otpa)" class="px-3 py-2 rounded-lg bg-yellow-500/20 text-yellow-300 text-sm hover:bg-yellow-500/30"><i class="fas fa-edit mr-1"></i>Düzenle</button>` : ''}
            ${this.isAdmin() ? `<button onclick="ProsedurOtpa.deleteOtpa(${otpa.id})" class="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-sm hover:bg-red-500/30"><i class="fas fa-trash mr-1"></i>Sil</button>` : ''}
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-4">
          <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-2 sm:p-3 rounded-xl text-center"><div class="text-xs sm:text-sm text-gray-400">Sorumlu</div><div class="font-semibold text-white text-sm sm:text-base truncate">${this.esc(otpa.responsible_tech || '-')}</div></div>
          <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-2 sm:p-3 rounded-xl text-center"><div class="text-xs sm:text-sm text-gray-400">Batarya</div><div class="font-semibold text-white text-sm sm:text-base">${otpa.battery_count || 0} adet</div></div>
          <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-2 sm:p-3 rounded-xl text-center"><div class="text-xs sm:text-sm text-gray-400">Üretim Tarihi</div><div class="font-semibold text-white text-sm sm:text-base">${this.fmtDate(otpa.production_date)}</div></div>
          <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-2 sm:p-3 rounded-xl text-center"><div class="text-xs sm:text-sm text-gray-400">Oluşturulma</div><div class="font-semibold text-white text-sm sm:text-base">${this.fmtDate(otpa.created_at)}</div></div>
        </div>
      </div>

      <!-- Batarya Bazlı Görünüm -->
      ${otpa.battery_count > 0 && forms.length > 0 ? (() => {
        // Group forms by battery number
        const formsByBattery = {};
        forms.forEach(f => {
          if (!f.battery_no) return;
          if (!formsByBattery[f.battery_no]) formsByBattery[f.battery_no] = [];
          formsByBattery[f.battery_no].push(f);
        });
        const batteryNos = Object.keys(formsByBattery).map(Number).sort((a, b) => a - b);
        if (!batteryNos.length) return '';
        return `
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 sm:p-6 rounded-2xl">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <h2 class="text-base sm:text-lg font-bold text-white"><i class="fas fa-battery-full mr-2 text-blue-400"></i>Batarya Bazlı Görünüm</h2>
          <span class="text-xs sm:text-sm text-gray-400">${batteryNos.length} batarya • Rapor görüntülemek için tıklayın</span>
        </div>
        <div class="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          ${batteryNos.map(bno => {
            const bForms = formsByBattery[bno];
            const total = bForms.length;
            const completed = bForms.filter(f => f.status === 'completed').length;
            const hasNok = bForms.some(f => f.filled_by_name);
            const pct = total ? Math.round((completed / total) * 100) : 0;
            const allDone = completed === total && total > 0;
            return `
          <div class="bg-gray-800/70 border ${allDone ? 'border-green-500/40' : 'border-gray-600/20'} p-3 sm:p-4 rounded-xl hover:border-blue-400/50 transition-all cursor-pointer group text-center" onclick="ProsedurOtpa.openBatteryReport(${otpa.id}, ${bno})">
            <div class="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-xl flex items-center justify-center text-lg sm:text-xl font-bold mb-2 ${allDone ? 'bg-green-500/20 text-green-400' : completed > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-500'}">
              B${bno}
            </div>
            <div class="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">Batarya ${bno}</div>
            <div class="flex gap-1 mt-2 justify-center">
              ${bForms.map(f => `<span class="w-3 h-3 rounded-full ${f.status === 'completed' ? 'bg-green-500' : 'bg-gray-600'}" title="${this.esc(f.form_name || f.form_type)}"></span>`).join('')}
            </div>
            <div class="text-xs text-gray-400 mt-1">${completed}/${total} form</div>
            <div class="w-full bg-gray-700 rounded-full h-1.5 mt-2">
              <div class="h-1.5 rounded-full ${allDone ? 'bg-green-500' : 'bg-blue-500'}" style="width: ${pct}%"></div>
            </div>
            ${bForms.filter(f => f.filled_by_name).length ? `<div class="text-xs text-gray-500 mt-1 truncate"><i class="fas fa-user mr-1"></i>${this.esc(bForms.find(f => f.filled_by_name)?.filled_by_name)}</div>` : ''}
          </div>`;
          }).join('')}
        </div>
      </div>`;
      })() : ''}

      <!-- Form Doldurma Bölümü -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h2 class="text-lg font-bold text-white"><i class="fas fa-clipboard-check mr-2 text-green-400"></i>Kalite Formları</h2>
          <div class="flex flex-col sm:flex-row gap-2">
            ${templates.filter(t => t.is_active).length ? `
            <select id="po-detail-template" class="px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm" style="color-scheme:dark;">
              <option value="" class="bg-gray-800 text-white">-- Form Şablonu Seç --</option>
              ${templates.filter(t => t.is_active).map(t => `<option value="${t.id}" class="bg-gray-800 text-white">${this.esc(t.form_name)} (${t.form_type})</option>`).join('')}
            </select>
            <button onclick="ProsedurOtpa.createBulkForms(${otpa.id})" class="gradient-btn px-3 py-2 rounded-lg text-white text-sm font-semibold"><i class="fas fa-plus mr-1"></i>Tüm Bataryalar İçin Oluştur</button>
            ` : '<span class="text-gray-500 text-sm">Henüz aktif form şablonu yok. Form Şablonları tabından ekleyin.</span>'}
          </div>
        </div>

        ${!forms.length
          ? '<div class="text-center py-8 text-gray-500"><i class="fas fa-clipboard text-3xl mb-2 block"></i><p>Henüz form oluşturulmamış</p></div>'
          : Object.entries(formsByType).map(([type, flist]) => `
            <div class="mb-4">
              <h3 class="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">${this.formTypeBadge(type)} ${flist[0]?.form_name || type} (${flist.length})</h3>
              <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                ${flist.map(f => `
                  <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 rounded-lg hover:border-blue-400/30 transition-all cursor-pointer flex items-center gap-3" onclick="ProsedurOtpa.openFormFiller(${f.id})">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${f.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}">
                      ${f.battery_no ? 'B' + f.battery_no : '<i class="fas fa-file-alt"></i>'}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-semibold text-white truncate">${f.battery_no ? 'Batarya ' + f.battery_no : 'Genel'}</div>
                      <div class="text-xs text-gray-400">${this.statusBadge(f.status)} ${f.filled_by_name ? '• ' + this.esc(f.filled_by_name) : ''}</div>
                    </div>
                    <i class="fas fa-chevron-right text-gray-500"></i>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')
        }
      </div>

      <!-- Dosyalar -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h2 class="text-lg font-bold text-white"><i class="fas fa-paperclip mr-2 text-yellow-400"></i>Dosyalar & Görseller</h2>
          <button onclick="ProsedurOtpa.showFileUpload(${otpa.id})" class="gradient-btn px-3 py-2 rounded-lg text-white text-sm font-semibold"><i class="fas fa-upload mr-1"></i>Dosya Yükle</button>
        </div>
        <div id="po-file-upload-area" class="hidden mb-4"></div>

        ${!files.length
          ? '<div class="text-center py-8 text-gray-500"><i class="fas fa-cloud-upload-alt text-3xl mb-2 block"></i><p>Henüz dosya yüklenmemiş</p></div>'
          : Object.entries(filesByCat).map(([cat, flist]) => `
            <div class="mb-4">
              <h3 class="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider"><i class="fas fa-folder mr-1"></i>${this.esc(cat)} (${flist.length})</h3>
              <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                ${flist.map(f => {
                  const isImage = (f.file_original_name || '').match(/\.(jpg|jpeg|png|gif|webp)$/i);
                  return `
                  <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 rounded-lg flex items-center gap-3 group">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center ${isImage ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}">
                      <i class="fas ${isImage ? 'fa-image' : 'fa-file-alt'}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-semibold text-white truncate">${this.esc(f.file_original_name || 'Dosya')}</div>
                      <div class="text-xs text-gray-400">${this.fmtDateTime(f.created_at)} • ${f.file_size ? (f.file_size / 1024).toFixed(0) + ' KB' : ''}</div>
                    </div>
                    <button onclick="ProsedurOtpa.deleteFile(${f.id}, ${otpa.id})" class="text-red-400 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>
                  </div>`;
                }).join('')}
              </div>
            </div>
          `).join('')
        }
      </div>

      ${otpa.notes ? `<div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 rounded-2xl"><div class="text-sm text-gray-400 mb-1"><i class="fas fa-sticky-note mr-1"></i>Notlar</div><div class="text-white">${this.esc(otpa.notes)}</div></div>` : ''}
    </div>`;
  },

  // ─── OTPA dosya yükleme alanı ─────────────────────────────────────
  showFileUpload(otpaId) {
    const area = document.getElementById('po-file-upload-area');
    if (!area) return;
    area.classList.toggle('hidden');
    if (!area.classList.contains('hidden')) {
      area.innerHTML = `
      <div class="bg-white/10 backdrop-blur-md border border-dashed border-blue-400/30 p-4 rounded-xl space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Dosya Kategorisi</label>
            <select id="po-up-cat" class="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm" style="color-scheme:dark;">
              <option value="genel" class="bg-gray-800 text-white">Genel</option>
              <option value="kalite-foto" class="bg-gray-800 text-white">Kalite Fotoğrafı</option>
              <option value="hata-foto" class="bg-gray-800 text-white">Hata Fotoğrafı</option>
              <option value="etiket" class="bg-gray-800 text-white">Etiket</option>
              <option value="test-raporu" class="bg-gray-800 text-white">Test Raporu</option>
              <option value="cycle-raporu" class="bg-gray-800 text-white">Cycle Raporu</option>
              <option value="diger" class="bg-gray-800 text-white">Diğer</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Dosya Türü</label>
            <select id="po-up-type" class="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm" style="color-scheme:dark;">
              <option value="image" class="bg-gray-800 text-white">Görsel</option>
              <option value="document" class="bg-gray-800 text-white">Doküman</option>
              <option value="report" class="bg-gray-800 text-white">Rapor</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Açıklama</label>
            <input id="po-up-desc" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white text-sm focus:border-blue-400 focus:outline-none" placeholder="İsteğe bağlı...">
          </div>
        </div>
        <div class="flex gap-3 items-center">
          <input type="file" id="po-up-files" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp" class="text-sm text-gray-400 file:bg-blue-500/20 file:text-blue-300 file:border-0 file:rounded-lg file:px-3 file:py-2 file:mr-3 file:cursor-pointer">
          <button onclick="ProsedurOtpa.uploadFiles(${otpaId})" class="gradient-btn px-4 py-2 rounded-lg text-white text-sm font-semibold"><i class="fas fa-cloud-upload-alt mr-1"></i>Yükle</button>
        </div>
      </div>`;
    }
  },

  async uploadFiles(otpaId) {
    const fileInput = document.getElementById('po-up-files');
    const files = fileInput?.files;
    if (!files?.length) return alert('Dosya seçin!');

    const formData = new FormData();
    for (const f of files) formData.append('files', f);
    formData.append('file_category', document.getElementById('po-up-cat').value);
    formData.append('file_type', document.getElementById('po-up-type').value);
    formData.append('description', document.getElementById('po-up-desc').value);

    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`/api/prosedur-otpa/otpa/${otpaId}/files`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Yükleme hatası');
      alert(`${data.uploaded?.length || 0} dosya yüklendi!`);
      this.openOtpaDetail(otpaId);
    } catch (e) { alert('Hata: ' + e.message); }
  },

  async deleteFile(fileId, otpaId) {
    if (!confirm('Dosyayı silmek istediğinizden emin misiniz?')) return;
    try {
      await api.request(`/prosedur-otpa/otpa-files/${fileId}`, { method: 'DELETE' });
      this.openOtpaDetail(otpaId);
    } catch (e) { alert('Hata: ' + e.message); }
  },

  // ─── Toplu form oluştur ──────────────────────────────────────────
  async createBulkForms(otpaId) {
    const sel = document.getElementById('po-detail-template');
    if (!sel?.value) return alert('Lütfen bir form şablonu seçin!');
    const batteryCount = this.viewingOtpa?.otpa?.battery_count || 8;
    if (!confirm(`Bu şablon ${batteryCount} batarya için ayrı ayrı form oluşturacak. Devam?`)) return;
    try {
      await api.request(`/prosedur-otpa/otpa/${otpaId}/forms/bulk`, {
        method: 'POST',
        body: JSON.stringify({ template_id: parseInt(sel.value), battery_count: batteryCount })
      });
      this.openOtpaDetail(otpaId);
    } catch (e) { alert('Hata: ' + e.message); }
  },

  // ═══════════════════════════════════════════════════════════════════
  // FORM DOLDURMA SAYFASI
  // ═══════════════════════════════════════════════════════════════════
  async openFormFiller(formId) {
    try {
      this.fillingForm = await api.request(`/prosedur-otpa/otpa-forms/${formId}`);
      history.pushState({ page: 'prosedur-otpa', sub: 'form-filler' }, '', '#prosedur-otpa');
      this.render();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  renderFormFiller(c) {
    const d = this.fillingForm;
    if (!d) return;
    const form = d.form;
    const items = d.items || [];

    c.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl">
        <div class="flex items-center gap-3 sm:gap-4 mb-4">
          <button onclick="ProsedurOtpa.fillingForm=null;ProsedurOtpa.render();" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-arrow-left"></i></button>
          <div class="flex-1 min-w-0">
            <h1 class="text-base sm:text-xl font-bold text-white">
              ${this.esc(form.form_name)} ${this.formTypeBadge(form.form_type)}
              ${form.battery_no ? `<span class="ml-2 text-blue-400">— Batarya ${form.battery_no}</span>` : ''}
            </h1>
            <p class="text-gray-400 text-sm mt-1">${this.statusBadge(form.status)} ${form.filled_by_name ? '• Son dolduran: ' + this.esc(form.filled_by_name) : ''} ${form.filled_at ? '• ' + this.fmtDateTime(form.filled_at) : ''}</p>
          </div>
        </div>
      </div>

      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl space-y-3 sm:space-y-4">
        <h2 class="text-base sm:text-lg font-bold text-white mb-3"><i class="fas fa-list-check mr-2 text-green-400"></i>Kontrol Maddeleri (${items.length})</h2>
        ${items.map((item, i) => `
          <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 rounded-xl" data-item-id="${item.id}">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">${item.item_no || i + 1}</div>
              <div class="flex-1 space-y-2">
                <div class="text-white font-medium">${this.esc(item.item_text)} ${item.is_required ? '<span class="text-red-400 text-xs">*</span>' : ''}</div>
                ${this.renderFormControl(item, i)}
                <div>
                  <input class="po-comment w-full px-3 py-1.5 bg-gray-800/30 border border-white/5 rounded-lg text-gray-300 text-sm placeholder-gray-600 focus:border-blue-400 focus:outline-none" data-item="${item.id}" placeholder="Yorum (isteğe bağlı)" value="${this.esc(item.comment || '')}">
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 rounded-2xl">
        <label class="block text-sm text-gray-400 mb-1">Form Notu</label>
        <textarea id="po-form-note" rows="2" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none resize-none" placeholder="Genel not...">${this.esc(form.notes || '')}</textarea>
      </div>

      <div class="flex gap-3 justify-end">
        <button onclick="ProsedurOtpa.fillingForm=null;ProsedurOtpa.render();" class="px-5 py-2.5 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600">İptal</button>
        <button onclick="ProsedurOtpa.saveFormAnswers()" class="gradient-btn px-5 py-2.5 rounded-xl text-white font-semibold"><i class="fas fa-save mr-1"></i>Kaydet & Tamamla</button>
      </div>
    </div>`;
  },

  renderFormControl(item, idx) {
    const ct = item.control_type;
    if (ct === 'evet_hayir') {
      return `
      <div class="flex gap-2">
        <button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('ring-2'));this.classList.add('ring-2','ring-green-400');this.parentElement.dataset.value='evet'" class="po-answer flex-1 px-3 py-2 rounded-lg text-sm transition-all ${item.answer_value === 'evet' ? 'bg-green-500/30 text-green-300 ring-2 ring-green-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}" data-item="${item.id}" data-val="evet">
          <i class="fas fa-check mr-1"></i>Evet / OK
        </button>
        <button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('ring-2'));this.classList.add('ring-2','ring-red-400');this.parentElement.dataset.value='hayir'" class="po-answer flex-1 px-3 py-2 rounded-lg text-sm transition-all ${item.answer_value === 'hayir' ? 'bg-red-500/30 text-red-300 ring-2 ring-red-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}" data-item="${item.id}" data-val="hayir">
          <i class="fas fa-times mr-1"></i>Hayır / NOK
        </button>
      </div>`;
    }
    if (ct === 'sayisal') {
      return `<input type="number" step="any" class="po-numeric w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" data-item="${item.id}" value="${item.numeric_value ?? ''}" placeholder="Sayısal değer girin">`;
    }
    // açıklama (text)
    return `<textarea class="po-text w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none resize-none" rows="2" data-item="${item.id}" placeholder="Açıklama yazın...">${this.esc(item.answer_value || '')}</textarea>`;
  },

  async saveFormAnswers() {
    const d = this.fillingForm;
    if (!d) return;
    const items = d.items || [];
    const answers = items.map(item => {
      const id = item.id;
      let answer_value = null, numeric_value = null, comment = null;

      // Evet/Hayır
      const btnGroup = document.querySelector(`[data-item-id="${id}"] .flex[data-value]`);
      if (btnGroup) { answer_value = btnGroup.dataset.value; }
      // Evet/hayır fallback from ring class
      if (!answer_value) {
        const greenBtn = document.querySelector(`button.po-answer[data-item="${id}"][data-val="evet"].ring-2`);
        const redBtn = document.querySelector(`button.po-answer[data-item="${id}"][data-val="hayir"].ring-2`);
        if (greenBtn) answer_value = 'evet';
        else if (redBtn) answer_value = 'hayir';
      }

      // Sayısal
      const numEl = document.querySelector(`input.po-numeric[data-item="${id}"]`);
      if (numEl) { numeric_value = parseFloat(numEl.value) || null; answer_value = numEl.value || null; }

      // Açıklama
      const textEl = document.querySelector(`textarea.po-text[data-item="${id}"]`);
      if (textEl) { answer_value = textEl.value || null; }

      // Comment
      const commentEl = document.querySelector(`input.po-comment[data-item="${id}"]`);
      if (commentEl) comment = commentEl.value || null;

      return { form_item_id: id, answer_value, numeric_value, comment };
    });

    const notes = document.getElementById('po-form-note')?.value || null;

    try {
      await api.request(`/prosedur-otpa/otpa-forms/${d.form.id}/answers`, {
        method: 'POST',
        body: JSON.stringify({ answers, notes })
      });
      alert('Form başarıyla kaydedildi!');
      this.fillingForm = null;
      // OTPA detayına geri dön
      if (d.form.otpa_id) this.openOtpaDetail(d.form.otpa_id);
      else this.render();
    } catch (e) { alert('Kayıt hatası: ' + e.message); }
  },

  // ═══════════════════════════════════════════════════════════════════
  // TAB 2: PROSEDÜRLER / DOKÜMANLAR
  // ═══════════════════════════════════════════════════════════════════
  async renderDocsTab(el) {
    try {
      this.docs = await api.request('/prosedur-otpa/documents');
    } catch (e) { el.innerHTML = `<div class="text-red-400">Hata: ${e.message}</div>`; return; }

    el.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div class="flex gap-2 flex-wrap">
          <input id="po-doc-search" placeholder="Doküman ara..." class="px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:border-blue-400 focus:outline-none" onkeyup="ProsedurOtpa.filterDocs()">
          <select id="po-doc-filter" class="px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm" style="color-scheme:dark;" onchange="ProsedurOtpa.filterDocs()">
            <option value="" class="bg-gray-800 text-white">Tüm Türler</option>
            <option value="prosedur" class="bg-gray-800 text-white">Prosedür</option>
            <option value="talimat" class="bg-gray-800 text-white">Talimat</option>
            <option value="form" class="bg-gray-800 text-white">Form</option>
            <option value="rapor" class="bg-gray-800 text-white">Rapor</option>
          </select>
        </div>
        ${this.isAdmin() ? `<button onclick="ProsedurOtpa.showDocForm()" class="gradient-btn px-4 py-2.5 rounded-xl text-white text-sm font-semibold whitespace-nowrap"><i class="fas fa-plus mr-1"></i>Yeni Doküman</button>` : ''}
      </div>

      <div id="po-docs-list">
        ${this.renderDocsList(this.docs)}
      </div>
    </div>`;
  },

  renderDocsList(docs) {
    if (!docs.length) return '<div class="text-center py-16 text-gray-500"><i class="fas fa-book text-5xl mb-3 block"></i><p>Henüz doküman yok</p></div>';
    return `
    <!-- Mobile card view -->
    <div class="sm:hidden space-y-2">
      ${docs.map(d => `
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 rounded-xl">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-white text-sm truncate">${this.esc(d.doc_name)}</div>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              ${this.docTypeBadge(d.doc_type)}
              ${d.doc_code ? `<span class="text-gray-400 font-mono text-xs">${this.esc(d.doc_code)}</span>` : ''}
              ${d.revision_no ? `<span class="text-gray-500 text-xs">Rev.${this.esc(d.revision_no)}</span>` : ''}
            </div>
          </div>
        </div>
        ${d.description ? `<div class="text-xs text-gray-400 mb-2 line-clamp-2">${this.esc(d.description)}</div>` : ''}
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-500">${this.fmtDate(d.publish_date)} ${d.department ? '• ' + this.esc(d.department) : ''}</span>
          <div class="flex gap-1.5">
            ${d.file_path ? `<button onclick="ProsedurOtpa.previewDoc(${d.id}, '${(d.file_original_name || '').replace(/'/g, '\\\'')}')" class="w-8 h-8 rounded-lg bg-green-500/20 text-green-300 text-xs flex items-center justify-center active:bg-green-500/40" title="Görüntüle"><i class="fas fa-eye"></i></button>` : ''}
            ${d.file_path ? `<button onclick="ProsedurOtpa.downloadDoc(${d.id})" class="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 text-xs flex items-center justify-center active:bg-blue-500/40" title="İndir"><i class="fas fa-download"></i></button>` : ''}
            <button onclick="ProsedurOtpa.showRevisions(${d.id})" class="w-8 h-8 rounded-lg bg-gray-600/50 text-gray-300 text-xs flex items-center justify-center active:bg-gray-500/50" title="Revizyon"><i class="fas fa-history"></i></button>
            ${this.isAdmin() ? `
            <button onclick="ProsedurOtpa.showDocForm(${JSON.stringify(d).replace(/"/g, '&quot;')})" class="w-8 h-8 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs flex items-center justify-center active:bg-yellow-500/40" title="Düzenle"><i class="fas fa-edit"></i></button>
            <button onclick="ProsedurOtpa.deleteDoc(${d.id})" class="w-8 h-8 rounded-lg bg-red-500/20 text-red-300 text-xs flex items-center justify-center active:bg-red-500/40" title="Sil"><i class="fas fa-trash"></i></button>
            ` : ''}
          </div>
        </div>
      </div>`).join('')}
    </div>
    <!-- Desktop table view -->
    <div class="hidden sm:block overflow-x-auto rounded-xl border border-white/10">
      <table class="w-full text-sm text-left">
        <thead class="bg-gray-800/50 text-gray-400 uppercase text-xs">
          <tr>
            <th class="px-4 py-3">Doküman</th>
            <th class="px-4 py-3">Kod</th>
            <th class="px-4 py-3">Tür</th>
            <th class="px-4 py-3">Rev.</th>
            <th class="px-4 py-3 hidden md:table-cell">Departman</th>
            <th class="px-4 py-3 hidden md:table-cell">Tarih</th>
            <th class="px-4 py-3 text-center">İşlem</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          ${docs.map(d => `
          <tr class="hover:bg-white/5 transition-colors">
            <td class="px-4 py-3">
              <div class="font-semibold text-white">${this.esc(d.doc_name)}</div>
              ${d.description ? `<div class="text-xs text-gray-400 truncate max-w-[200px]">${this.esc(d.description)}</div>` : ''}
            </td>
            <td class="px-4 py-3 text-gray-300 font-mono text-xs">${this.esc(d.doc_code || '-')}</td>
            <td class="px-4 py-3">${this.docTypeBadge(d.doc_type)}</td>
            <td class="px-4 py-3 text-gray-300">${this.esc(d.revision_no || '0')}</td>
            <td class="px-4 py-3 text-gray-400 hidden md:table-cell">${this.esc(d.department || '-')}</td>
            <td class="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">${this.fmtDate(d.publish_date)}</td>
            <td class="px-4 py-3 text-center">
              <div class="flex gap-1 justify-center">
                ${d.file_path ? `<button onclick="ProsedurOtpa.previewDoc(${d.id}, '${(d.file_original_name || '').replace(/'/g, '\\\'')}')" class="px-2 py-1 rounded bg-green-500/20 text-green-300 text-xs hover:bg-green-500/30" title="Görüntüle"><i class="fas fa-eye"></i></button>` : ''}
                ${d.file_path ? `<button onclick="ProsedurOtpa.downloadDoc(${d.id})" class="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs hover:bg-blue-500/30" title="İndir"><i class="fas fa-download"></i></button>` : ''}
                <button onclick="ProsedurOtpa.showRevisions(${d.id})" class="px-2 py-1 rounded bg-gray-600/50 text-gray-300 text-xs hover:bg-gray-500/50" title="Revizyon Geçmişi"><i class="fas fa-history"></i></button>
                ${this.isAdmin() ? `
                <button onclick="ProsedurOtpa.showDocForm(${JSON.stringify(d).replace(/"/g, '&quot;')})" class="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 text-xs hover:bg-yellow-500/30" title="Düzenle"><i class="fas fa-edit"></i></button>
                <button onclick="ProsedurOtpa.deleteDoc(${d.id})" class="px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs hover:bg-red-500/30" title="Sil"><i class="fas fa-trash"></i></button>
                ` : ''}
              </div>
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  },

  filterDocs() {
    const search = (document.getElementById('po-doc-search')?.value || '').toLowerCase();
    const type = document.getElementById('po-doc-filter')?.value || '';
    const filtered = this.docs.filter(d => {
      if (type && d.doc_type !== type) return false;
      if (search && !(d.doc_name || '').toLowerCase().includes(search) && !(d.doc_code || '').toLowerCase().includes(search) && !(d.description || '').toLowerCase().includes(search)) return false;
      return true;
    });
    const el = document.getElementById('po-docs-list');
    if (el) el.innerHTML = this.renderDocsList(filtered);
  },

  downloadDoc(id) {
    const token = localStorage.getItem('token');
    fetch(`/api/prosedur-otpa/documents/${id}/download`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(async r => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'İndirme hatası');
      }
      const fname = (r.headers.get('content-disposition') || '').match(/filename[^;=\n]*=(['"]?)([^'"\n]*?)\1(;|$)/)?.[2] || 'document';
      return r.blob().then(blob => ({ blob, fname }));
    }).then(({ blob, fname }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = decodeURIComponent(fname);
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    }).catch(e => alert(e.message));
  },

  previewDoc(id, filename) {
    const token = localStorage.getItem('token');
    const ext = (filename || '').split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

    // ?preview=1 ile Content-Type doğru gönderilir
    fetch(`/api/prosedur-otpa/documents/${id}/download?preview=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(async r => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'Dosya yüklenemedi');
      }
      return r.blob();
    }).then(blob => {
      const blobUrl = URL.createObjectURL(blob);

      if (isPdf || isImage) {
        // Modal ile göster
        const modal = document.createElement('div');
        modal.id = 'po-preview-modal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
        modal.style.background = 'rgba(0,0,0,0.85)';
        modal.innerHTML = `
          <div class="relative w-full max-w-full sm:max-w-5xl h-[95vh] sm:h-[85vh] flex flex-col bg-gray-900 rounded-none sm:rounded-2xl overflow-hidden border border-gray-600/30">
            <div class="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 border-b border-gray-700">
              <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <i class="fas ${isPdf ? 'fa-file-pdf text-red-400' : 'fa-image text-green-400'} text-lg sm:text-xl"></i>
                <span class="text-white font-semibold text-xs sm:text-sm truncate">${this.esc(filename)}</span>
              </div>
              <div class="flex gap-2">
                <button onclick="ProsedurOtpa.downloadDoc(${id})" class="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-sm hover:bg-blue-500/30"><i class="fas fa-download mr-1"></i>İndir</button>
                <button onclick="document.getElementById('po-preview-modal').remove();" class="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-sm hover:bg-red-500/30"><i class="fas fa-times mr-1"></i>Kapat</button>
              </div>
            </div>
            <div class="flex-1 overflow-auto bg-gray-800 flex items-center justify-center">
              ${isPdf
                ? `<iframe src="${blobUrl}" class="w-full h-full" frameborder="0"></iframe>`
                : `<img src="${blobUrl}" class="max-w-full max-h-full object-contain p-4" alt="${this.esc(filename)}">`
              }
            </div>
          </div>`;
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
      } else {
        // Desteklenmeyen dosya: doğrudan yeni sekmede aç
        window.open(blobUrl, '_blank');
      }
    }).catch(e => alert('Önizleme hatası: ' + e.message));
  },

  async showRevisions(docId) {
    try {
      const revs = await api.request(`/prosedur-otpa/documents/${docId}/revisions`);
      if (!revs.length) { alert('Henüz revizyon geçmişi yok.'); return; }
      let html = revs.map(r => `Rev ${this.esc(r.revision_no)} — ${this.fmtDateTime(r.created_at)} — ${this.esc(r.revised_by_name || '?')} — ${this.esc(r.change_description || '')}`).join('\n');
      alert('Revizyon Geçmişi:\n\n' + html);
    } catch (e) { alert('Hata: ' + e.message); }
  },

  // Doküman oluştur/düzenle formu
  showDocForm(data = null) {
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
    const isEdit = !!data;
    const el = document.getElementById('po-tab-content');
    if (!el) return;
    el.innerHTML = `
    <div class="max-w-2xl mx-auto space-y-4">
      <div class="flex items-center gap-3 mb-4">
        <button onclick="ProsedurOtpa.renderTabContent()" class="text-gray-400 hover:text-white"><i class="fas fa-arrow-left text-lg"></i></button>
        <h2 class="text-xl font-bold text-white">${isEdit ? 'Doküman Düzenle' : 'Yeni Doküman Yükle'}</h2>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <label class="block text-sm text-gray-400 mb-1">Doküman Adı <span class="text-red-400">*</span></label>
          <input id="po-d-name" value="${this.esc(data?.doc_name || '')}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" placeholder="Prosedür / Talimat adı">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Doküman Kodu</label>
          <input id="po-d-code" value="${this.esc(data?.doc_code || '')}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" placeholder="Ör: PR-001">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Revizyon No</label>
          <input id="po-d-rev" value="${this.esc(data?.revision_no || '0')}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Doküman Türü</label>
          <select id="po-d-type" class="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white" style="color-scheme:dark;">
            ${['prosedur', 'talimat', 'form', 'rapor'].map(t => `<option value="${t}" class="bg-gray-800 text-white" ${data?.doc_type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Departman</label>
          <input id="po-d-dept" value="${this.esc(data?.department || '')}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" placeholder="Departman">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Yayın Tarihi</label>
          <input type="date" id="po-d-date" value="${data?.publish_date ? data.publish_date.substring(0,10) : ''}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" style="color-scheme:dark;">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Dosya ${isEdit ? '(değiştirmek için seçin)' : ''}</label>
          <input type="file" id="po-d-file" accept=".pdf,.doc,.docx,.xls,.xlsx" class="text-sm text-gray-400 file:bg-blue-500/20 file:text-blue-300 file:border-0 file:rounded-lg file:px-3 file:py-2 file:mr-3 file:cursor-pointer">
          ${isEdit && data?.file_original_name ? `<div class="text-xs text-gray-500 mt-1">Mevcut: ${this.esc(data.file_original_name)}</div>` : ''}
        </div>
        <div class="sm:col-span-2">
          <label class="block text-sm text-gray-400 mb-1">Açıklama</label>
          <textarea id="po-d-desc" rows="3" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none resize-none">${this.esc(data?.description || '')}</textarea>
        </div>
      </div>
      <div class="flex gap-3 justify-end">
        <button onclick="ProsedurOtpa.renderTabContent()" class="px-5 py-2.5 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600">İptal</button>
        <button onclick="ProsedurOtpa.saveDoc(${data?.id || 'null'})" class="gradient-btn px-5 py-2.5 rounded-xl text-white font-semibold"><i class="fas fa-save mr-1"></i>${isEdit ? 'Güncelle' : 'Yükle'}</button>
      </div>
    </div>`;
  },

  async saveDoc(id) {
    const name = document.getElementById('po-d-name').value.trim();
    if (!name) return alert('Doküman adı zorunlu!');

    const formData = new FormData();
    formData.append('doc_name', name);
    formData.append('doc_code', document.getElementById('po-d-code').value.trim());
    formData.append('revision_no', document.getElementById('po-d-rev').value.trim());
    formData.append('doc_type', document.getElementById('po-d-type').value);
    formData.append('department', document.getElementById('po-d-dept').value.trim());
    formData.append('publish_date', document.getElementById('po-d-date').value || '');
    formData.append('description', document.getElementById('po-d-desc').value.trim());
    const file = document.getElementById('po-d-file').files[0];
    if (file) formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const url = id ? `/api/prosedur-otpa/documents/${id}` : '/api/prosedur-otpa/documents';
      const resp = await fetch(url, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Hata');
      this.renderTabContent();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  async deleteDoc(id) {
    if (!confirm('Bu dokümanı silmek istediğinize emin misiniz?')) return;
    try {
      await api.request(`/prosedur-otpa/documents/${id}`, { method: 'DELETE' });
      this.renderTabContent();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  // ═══════════════════════════════════════════════════════════════════
  // TAB 3: FORM ŞABLONLARI
  // ═══════════════════════════════════════════════════════════════════
  async renderTemplatesTab(el) {
    try {
      this.templates = await api.request('/prosedur-otpa/form-templates');
    } catch (e) { el.innerHTML = `<div class="text-red-400">Hata: ${e.message}</div>`; return; }

    el.innerHTML = `
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <p class="text-gray-400 text-sm">Kalite kontrol formları için şablon tanımlayın. Şablonlar OTPA kayıtlarında kullanılır.</p>
        ${this.isAdmin() ? `<button onclick="ProsedurOtpa.showTemplateForm()" class="gradient-btn px-4 py-2.5 rounded-xl text-white text-sm font-semibold whitespace-nowrap"><i class="fas fa-plus mr-1"></i>Yeni Şablon</button>` : ''}
      </div>

      ${!this.templates.length
        ? '<div class="text-center py-16 text-gray-500"><i class="fas fa-clipboard-list text-5xl mb-3 block"></i><p>Henüz form şablonu yok</p></div>'
        : `<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          ${this.templates.map(t => `
            <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 rounded-xl hover:border-blue-400/30 transition-all cursor-pointer group" onclick="ProsedurOtpa.openTemplateEditor(${t.id})">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <div class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">${this.esc(t.form_name)}</div>
                  <div class="mt-1">${this.formTypeBadge(t.form_type)} ${!t.is_active ? this.badge('Pasif', 'bg-red-500/20 text-red-300') : ''}</div>
                </div>
                <div class="text-2xl font-bold text-gray-600">${t.item_count || 0}</div>
              </div>
              ${t.description ? `<p class="text-sm text-gray-500 truncate">${this.esc(t.description)}</p>` : ''}
              <div class="text-xs text-gray-500 mt-2">${t.item_count || 0} kontrol maddesi</div>
            </div>
          `).join('')}
        </div>`
      }
    </div>`;
  },

  showTemplateForm(data = null) {
    const isEdit = !!data;
    const el = document.getElementById('po-tab-content');
    if (!el) return;
    el.innerHTML = `
    <div class="max-w-lg mx-auto space-y-4">
      <div class="flex items-center gap-3 mb-4">
        <button onclick="ProsedurOtpa.renderTabContent()" class="text-gray-400 hover:text-white"><i class="fas fa-arrow-left text-lg"></i></button>
        <h2 class="text-xl font-bold text-white">${isEdit ? 'Şablon Düzenle' : 'Yeni Form Şablonu'}</h2>
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Form Adı <span class="text-red-400">*</span></label>
        <input id="po-t-name" value="${this.esc(data?.form_name || '')}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none" placeholder="Ör: Giriş Kalite Kontrol Formu">
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Form Türü</label>
        <div class="flex gap-2">
          ${['giris', 'proses', 'final'].map(ft => `
            <button onclick="document.getElementById('po-t-type').value='${ft}';document.querySelectorAll('.po-ft-btn').forEach(b=>b.classList.remove('ring-2','ring-blue-400'));this.classList.add('ring-2','ring-blue-400')" class="po-ft-btn flex-1 px-3 py-2 rounded-lg text-sm transition-all ${(!data && ft === 'giris') || data?.form_type === ft ? 'ring-2 ring-blue-400 bg-blue-500/20 text-blue-300' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}">
              ${ft === 'giris' ? 'Giriş' : ft === 'proses' ? 'Proses' : 'Final'}
            </button>
          `).join('')}
          <input type="hidden" id="po-t-type" value="${data?.form_type || 'giris'}">
        </div>
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Açıklama</label>
        <textarea id="po-t-desc" rows="2" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:border-blue-400 focus:outline-none resize-none">${this.esc(data?.description || '')}</textarea>
      </div>
      <div class="flex gap-3 justify-end">
        <button onclick="ProsedurOtpa.renderTabContent()" class="px-5 py-2.5 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600">İptal</button>
        <button onclick="ProsedurOtpa.saveTemplate(${data?.id || 'null'})" class="gradient-btn px-5 py-2.5 rounded-xl text-white font-semibold"><i class="fas fa-save mr-1"></i>${isEdit ? 'Güncelle' : 'Oluştur'}</button>
      </div>
    </div>`;
  },

  async saveTemplate(id) {
    const name = document.getElementById('po-t-name').value.trim();
    if (!name) return alert('Form adı zorunlu!');
    const body = {
      form_name: name,
      form_type: document.getElementById('po-t-type').value,
      description: document.getElementById('po-t-desc').value.trim()
    };
    try {
      if (id) {
        await api.request(`/prosedur-otpa/form-templates/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api.request('/prosedur-otpa/form-templates', { method: 'POST', body: JSON.stringify(body) });
      }
      this.renderTabContent();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  // ── Şablon madde editörü ──────────────────────────────────────────
  async openTemplateEditor(id) {
    try {
      const [template, items] = await Promise.all([
        api.request(`/prosedur-otpa/form-templates`).then(arr => arr.find(t => t.id === id)),
        api.request(`/prosedur-otpa/form-templates/${id}/items`)
      ]);
      this.viewingTemplate = { template, items };
      history.pushState({ page: 'prosedur-otpa', sub: 'template-editor' }, '', '#prosedur-otpa');
      this.render();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  async renderTemplateEditor(c) {
    const d = this.viewingTemplate;
    if (!d) { this.render(); return; }
    const t = d.template;
    const items = d.items || [];

    c.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 sm:gap-4 min-w-0">
            <button onclick="ProsedurOtpa.viewingTemplate=null;ProsedurOtpa.render();" class="text-gray-400 hover:text-white text-xl flex-shrink-0"><i class="fas fa-arrow-left"></i></button>
            <div class="min-w-0">
              <h1 class="text-base sm:text-xl font-bold text-white truncate">${this.esc(t.form_name)} ${this.formTypeBadge(t.form_type)}</h1>
              <p class="text-gray-400 text-xs sm:text-sm mt-1">${this.esc(t.description || '')} • ${items.length} madde</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="ProsedurOtpa.showTemplateForm(ProsedurOtpa.viewingTemplate.template)" class="px-3 py-2 rounded-lg bg-yellow-500/20 text-yellow-300 text-sm"><i class="fas fa-edit mr-1"></i>Düzenle</button>
            ${this.isAdmin() ? `<button onclick="ProsedurOtpa.deleteTemplate(${t.id})" class="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-sm"><i class="fas fa-trash mr-1"></i>Sil</button>` : ''}
          </div>
        </div>
      </div>

      <!-- Maddeler -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl space-y-3">
        <div class="flex justify-between items-center mb-2">
          <h2 class="text-lg font-bold text-white"><i class="fas fa-list-ol mr-2 text-green-400"></i>Kontrol Maddeleri</h2>
        </div>
        ${items.map((item, i) => `
        <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 rounded-xl flex items-center gap-3 group">
          <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">${item.item_no || i + 1}</div>
          <div class="flex-1 min-w-0">
            <div class="text-white font-medium">${this.esc(item.item_text)}</div>
            <div class="text-xs text-gray-500">${item.control_type === 'evet_hayir' ? 'Evet/Hayır' : item.control_type === 'sayisal' ? 'Sayısal' : 'Açıklama'} ${item.is_required ? '• Zorunlu' : ''}</div>
          </div>
          ${this.isAdmin() ? `
          <button onclick="ProsedurOtpa.editItem(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="text-yellow-400 hover:text-yellow-300 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><i class="fas fa-edit"></i></button>
          <button onclick="ProsedurOtpa.deleteItem(${item.id})" class="text-red-400 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>
          ` : ''}
        </div>
        `).join('')}

        ${this.isAdmin() ? `
        <div class="bg-white/10 backdrop-blur-md border border-dashed border-blue-400/30 p-4 rounded-xl mt-4" id="po-add-item-box">
          <h3 class="text-sm font-semibold text-gray-400 mb-3"><i class="fas fa-plus mr-1"></i>Yeni Madde Ekle</h3>
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Madde No</label>
              <input id="po-i-no" type="number" min="1" value="${(items.length || 0) + 1}" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white text-sm focus:border-blue-400 focus:outline-none">
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs text-gray-500 mb-1">Madde Metni <span class="text-red-400">*</span></label>
              <input id="po-i-text" class="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white text-sm focus:border-blue-400 focus:outline-none" placeholder="Kontrol maddesi yazın...">
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Kontrol Tipi</label>
              <select id="po-i-type" class="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white text-sm" style="color-scheme:dark;">
                <option value="evet_hayir" class="bg-gray-800 text-white">Evet / Hayır</option>
                <option value="sayisal" class="bg-gray-800 text-white">Sayısal</option>
                <option value="aciklama" class="bg-gray-800 text-white">Açıklama</option>
              </select>
            </div>
          </div>
          <div class="flex gap-3 items-center mt-3">
            <label class="flex items-center gap-2 text-sm text-gray-400"><input type="checkbox" id="po-i-req" checked class="rounded"> Zorunlu</label>
            <div class="flex-1"></div>
            <button onclick="ProsedurOtpa.addItem(${t.id})" class="gradient-btn px-4 py-2 rounded-lg text-white text-sm font-semibold"><i class="fas fa-plus mr-1"></i>Ekle</button>
          </div>
        </div>
        ` : ''}
      </div>
    </div>`;
  },

  async addItem(templateId) {
    const text = document.getElementById('po-i-text').value.trim();
    if (!text) return alert('Madde metni zorunlu!');
    try {
      await api.request(`/prosedur-otpa/form-templates/${templateId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          item_no: parseInt(document.getElementById('po-i-no').value) || 1,
          item_text: text,
          control_type: document.getElementById('po-i-type').value,
          is_required: document.getElementById('po-i-req').checked
        })
      });
      this.openTemplateEditor(templateId);
    } catch (e) { alert('Hata: ' + e.message); }
  },

  editItem(data) {
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
    const text = prompt('Madde metni:', data.item_text);
    if (!text) return;
    api.request(`/prosedur-otpa/form-items/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify({ item_text: text })
    }).then(() => { this.openTemplateEditor(data.template_id); }).catch(e => alert('Hata: ' + e.message));
  },

  async deleteItem(id) {
    if (!confirm('Bu maddeyi silmek istediğinize emin misiniz?')) return;
    try {
      await api.request(`/prosedur-otpa/form-items/${id}`, { method: 'DELETE' });
      this.openTemplateEditor(this.viewingTemplate?.template?.id);
    } catch (e) { alert('Hata: ' + e.message); }
  },

  async deleteTemplate(id) {
    if (!confirm('Bu şablon ve maddeleri silinecek. Emin misiniz?')) return;
    try {
      await api.request(`/prosedur-otpa/form-templates/${id}`, { method: 'DELETE' });
      this.viewingTemplate = null;
      this.render();
    } catch (e) { alert('Hata: ' + e.message); }
  },

  // ═══════════════════════════════════════════════════════════════════
  // TAB 4: RAPORLAR
  // ═══════════════════════════════════════════════════════════════════
  async renderReportsTab(el) {
    try {
      this.otpas = await api.request('/prosedur-otpa/otpa');
    } catch { this.otpas = []; }

    el.innerHTML = `
    <div class="space-y-4">
      <p class="text-gray-400 text-sm">Bir OTPA seçerek genel raporunu görüntüleyin.</p>
      <div class="flex flex-col sm:flex-row gap-3">
        <select id="po-report-otpa" class="flex-1 sm:max-w-md px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-white" style="color-scheme:dark;">
          <option value="" class="bg-gray-800 text-white">-- OTPA Seçin --</option>
          ${this.otpas.map(o => `<option value="${o.id}" class="bg-gray-800 text-white">${this.esc(o.otpa_no)} — ${this.esc(o.project_name || '')}</option>`).join('')}
        </select>
        <button onclick="ProsedurOtpa.generateReport()" class="gradient-btn px-4 py-2.5 rounded-lg text-white text-sm font-semibold"><i class="fas fa-file-alt mr-1"></i>Rapor Oluştur</button>
      </div>
      <div id="po-report-output"></div>
    </div>`;
  },

  async generateReport() {
    const sel = document.getElementById('po-report-otpa');
    if (!sel?.value) return alert('Lütfen bir OTPA seçin!');
    const out = document.getElementById('po-report-output');
    if (!out) return;
    out.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-3xl text-blue-400"></i></div>';

    try {
      const r = await api.request(`/prosedur-otpa/otpa/${sel.value}/report`);
      const otpa = r.otpa;
      const forms = r.forms || [];
      const files = r.files || [];
      const s = r.summary;

      out.innerHTML = `
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 sm:p-6 rounded-2xl space-y-4 sm:space-y-6 mt-4" id="po-report-content">
        <div class="text-center border-b border-white/10 pb-4">
          <h2 class="text-xl sm:text-2xl font-bold text-white">OTPA Genel Raporu</h2>
          <p class="text-gray-400">${this.esc(otpa.otpa_no)} — ${this.esc(otpa.project_name || '')}</p>
          <p class="text-xs text-gray-500 mt-1">Rapor tarihi: ${new Date().toLocaleString('tr-TR')}</p>
        </div>

        <!-- Özet -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 sm:p-4 rounded-xl text-center"><div class="text-xl sm:text-3xl font-bold text-blue-400">${otpa.battery_count || 0}</div><div class="text-xs text-gray-400">Batarya</div></div>
          <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 sm:p-4 rounded-xl text-center"><div class="text-xl sm:text-3xl font-bold text-green-400">${s.completedForms}/${s.totalForms}</div><div class="text-xs text-gray-400">Tamamlanan Form</div></div>
          <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 sm:p-4 rounded-xl text-center"><div class="text-xl sm:text-3xl font-bold ${s.totalNonConform > 0 ? 'text-red-400' : 'text-green-400'}">${s.totalNonConform}</div><div class="text-xs text-gray-400">Uygunsuz</div></div>
          <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 sm:p-4 rounded-xl text-center"><div class="text-xl sm:text-3xl font-bold text-yellow-400">${s.fileCount}</div><div class="text-xs text-gray-400">Dosya</div></div>
        </div>

        <!-- Genel Bilgiler -->
        <div>
          <h3 class="text-lg font-bold text-white mb-2"><i class="fas fa-info-circle mr-2 text-blue-400"></i>Genel Bilgiler</h3>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="text-gray-400">Sorumlu Tekniker:</div><div class="text-white">${this.esc(otpa.responsible_tech || '-')}</div>
            <div class="text-gray-400">Üretim Tarihi:</div><div class="text-white">${this.fmtDate(otpa.production_date)}</div>
            <div class="text-gray-400">Durum:</div><div>${this.statusBadge(otpa.status)}</div>
            <div class="text-gray-400">Oluşturan:</div><div class="text-white">${this.esc(otpa.created_by_name || '-')}</div>
          </div>
        </div>

        <!-- Formlar Tablosu -->
        ${forms.length ? `
        <div>
          <h3 class="text-lg font-bold text-white mb-2"><i class="fas fa-clipboard-check mr-2 text-green-400"></i>Form Sonuçları</h3>
          <div class="overflow-x-auto rounded-xl border border-white/10">
            <table class="w-full text-sm">
              <thead class="bg-gray-800/50 text-gray-400 text-xs uppercase"><tr>
                <th class="px-2 sm:px-3 py-2">Form</th><th class="px-2 sm:px-3 py-2">Tür</th><th class="px-2 sm:px-3 py-2 hidden sm:table-cell">Batarya</th><th class="px-2 sm:px-3 py-2">Durum</th><th class="px-2 sm:px-3 py-2 hidden sm:table-cell">Dolduran</th><th class="px-2 sm:px-3 py-2 hidden sm:table-cell">Cevap</th><th class="px-2 sm:px-3 py-2">NOK</th>
              </tr></thead>
              <tbody class="divide-y divide-white/5">
                ${forms.map(f => `
                <tr class="hover:bg-white/5">
                  <td class="px-2 sm:px-3 py-2 text-white text-xs sm:text-sm">${this.esc(f.form_name)}</td>
                  <td class="px-2 sm:px-3 py-2">${this.formTypeBadge(f.form_type)}</td>
                  <td class="px-2 sm:px-3 py-2 text-gray-300 hidden sm:table-cell">${f.battery_no ? 'B' + f.battery_no : 'Genel'}</td>
                  <td class="px-2 sm:px-3 py-2">${this.statusBadge(f.status)}</td>
                  <td class="px-2 sm:px-3 py-2 text-gray-400 hidden sm:table-cell">${this.esc(f.filled_by_name || '-')}</td>
                  <td class="px-2 sm:px-3 py-2 text-gray-300 hidden sm:table-cell">${f.total_answers || 0}</td>
                  <td class="px-2 sm:px-3 py-2 ${parseInt(f.nonconform_count) > 0 ? 'text-red-400 font-bold' : 'text-green-400'}">${f.nonconform_count || 0}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}

        <!-- Dosyalar -->
        ${files.length ? `
        <div>
          <h3 class="text-lg font-bold text-white mb-2"><i class="fas fa-paperclip mr-2 text-yellow-400"></i>Eklenen Dosyalar (${files.length})</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            ${files.map(f => `
            <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-2 rounded-lg text-center">
              <i class="fas ${(f.file_original_name || '').match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'fa-image text-green-400' : 'fa-file-alt text-blue-400'} text-2xl mb-1 block"></i>
              <div class="text-xs text-white truncate">${this.esc(f.file_original_name || 'dosya')}</div>
              <div class="text-xs text-gray-500">${this.esc(f.file_category)}</div>
            </div>`).join('')}
          </div>
        </div>` : ''}

        <div class="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button onclick="ProsedurOtpa.printReport()" class="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-300 text-sm hover:bg-blue-500/30"><i class="fas fa-print mr-1"></i>Yazdır</button>
        </div>
      </div>`;
    } catch (e) {
      out.innerHTML = `<div class="text-red-400 mt-4">Rapor hatası: ${e.message}</div>`;
    }
  },

  printReport() {
    const content = document.getElementById('po-report-content');
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>OTPA Raporu</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#333}h2,h3{margin-top:30px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}th{background:#f5f5f5}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold}</style>
      </head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  },

  // ═══════════════════════════════════════════════════════════════════
  // BATARYA DETAY RAPORU — Giriş/Proses/Final tüm formlar
  // ═══════════════════════════════════════════════════════════════════
  async openBatteryReport(otpaId, batteryNo) {
    try {
      this.viewingBatteryReport = await api.request(`/prosedur-otpa/otpa/${otpaId}/battery/${batteryNo}/report`);
      history.pushState({ page: 'prosedur-otpa', sub: 'battery-report' }, '', '#prosedur-otpa');
      this.render();
    } catch (e) { alert('Rapor hatası: ' + e.message); }
  },

  renderBatteryReport(c) {
    const d = this.viewingBatteryReport;
    if (!d) { this.render(); return; }
    const otpa = d.otpa;
    const batteryNo = d.batteryNo;
    const forms = d.forms || [];

    const totalItems = forms.reduce((s, f) => s + (f.summary?.totalItems || 0), 0);
    const totalOk = forms.reduce((s, f) => s + (f.summary?.okItems || 0), 0);
    const totalNok = forms.reduce((s, f) => s + (f.summary?.nokItems || 0), 0);
    const allCompleted = forms.length > 0 && forms.every(f => f.status === 'completed');

    c.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <!-- Header -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-4 sm:p-6 rounded-2xl">
        <div class="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
          <div class="flex items-center gap-3 sm:gap-4">
            <button onclick="ProsedurOtpa.viewingBatteryReport=null;ProsedurOtpa.render();" class="text-gray-400 hover:text-white text-xl"><i class="fas fa-arrow-left"></i></button>
            <div>
              <h1 class="text-lg sm:text-2xl font-bold text-white">
                <i class="fas fa-battery-full mr-2 text-blue-400"></i>Batarya ${batteryNo} — Detay Raporu
              </h1>
              <p class="text-gray-300 mt-1 text-sm">${this.esc(otpa.otpa_no)} • ${this.esc(otpa.project_name || '')}</p>
            </div>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button onclick="ProsedurOtpa.printBatteryReport()" class="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-300 text-sm hover:bg-blue-500/30 font-semibold"><i class="fas fa-print mr-1"></i>Yazdır</button>
            <button onclick="ProsedurOtpa.downloadBatteryReport()" class="px-4 py-2 rounded-lg bg-green-500/20 text-green-300 text-sm hover:bg-green-500/30 font-semibold"><i class="fas fa-download mr-1"></i>İndir (HTML)</button>
          </div>
        </div>
        <!-- Özet kartlar -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mt-4">
          <div class="bg-gray-800/70 border border-gray-600/20 p-2 sm:p-3 rounded-xl text-center">
            <div class="text-xs sm:text-sm text-gray-400">Batarya No</div>
            <div class="text-lg sm:text-2xl font-bold text-blue-400">B${batteryNo}</div>
          </div>
          <div class="bg-gray-800/70 border border-gray-600/20 p-2 sm:p-3 rounded-xl text-center">
            <div class="text-xs sm:text-sm text-gray-400">Form Sayısı</div>
            <div class="text-lg sm:text-2xl font-bold text-white">${forms.length}</div>
          </div>
          <div class="bg-gray-800/70 border border-gray-600/20 p-2 sm:p-3 rounded-xl text-center">
            <div class="text-xs sm:text-sm text-gray-400">Toplam Madde</div>
            <div class="text-lg sm:text-2xl font-bold text-white">${totalItems}</div>
          </div>
          <div class="bg-gray-800/70 border border-gray-600/20 p-2 sm:p-3 rounded-xl text-center">
            <div class="text-xs sm:text-sm text-gray-400">OK</div>
            <div class="text-lg sm:text-2xl font-bold text-green-400">${totalOk}</div>
          </div>
          <div class="bg-gray-800/70 border border-gray-600/20 p-2 sm:p-3 rounded-xl text-center">
            <div class="text-xs sm:text-sm text-gray-400">NOK</div>
            <div class="text-lg sm:text-2xl font-bold ${totalNok > 0 ? 'text-red-400' : 'text-green-400'}">${totalNok}</div>
          </div>
        </div>
      </div>

      <!-- Genel bilgi -->
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 p-3 sm:p-5 rounded-2xl">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm">
          <div><span class="text-gray-400">Sorumlu:</span> <span class="text-white font-semibold">${this.esc(otpa.responsible_tech || '-')}</span></div>
          <div><span class="text-gray-400">Üretim Tarihi:</span> <span class="text-white font-semibold">${this.fmtDate(otpa.production_date)}</span></div>
          <div><span class="text-gray-400">Durum:</span> ${allCompleted ? '<span class="text-green-400 font-semibold">Tamamlandı</span>' : '<span class="text-yellow-400 font-semibold">Devam Ediyor</span>'}</div>
          <div><span class="text-gray-400">Genel Sonuç:</span> ${totalNok === 0 && totalOk > 0 ? '<span class="text-green-400 font-bold"><i class="fas fa-check-circle mr-1"></i>UYGUN</span>' : totalNok > 0 ? '<span class="text-red-400 font-bold"><i class="fas fa-times-circle mr-1"></i>UYGUNSUZ (' + totalNok + ')</span>' : '<span class="text-gray-500">Bekliyor</span>'}</div>
        </div>
      </div>

      <!-- Her form türü için detay -->
      ${forms.length === 0 ? '<div class="text-center py-12 text-gray-500"><i class="fas fa-clipboard text-4xl mb-3 block"></i><p>Bu batarya için henüz form oluşturulmamış.</p></div>' : ''}
      ${forms.map((f, fi) => {
        const items = f.items || [];
        const okCount = items.filter(i => i.answer_value === 'evet').length;
        const nokCount = items.filter(i => i.answer_value === 'hayir' || i.answer_value === 'nok').length;
        const answeredCount = items.filter(i => i.answer_value != null).length;
        return `
      <div class="bg-gray-900/80 backdrop-blur-md border border-gray-600/30 rounded-2xl overflow-hidden">
        <!-- Form başlığı -->
        <div class="p-3 sm:p-5 border-b border-gray-600/20 flex flex-col gap-2">
          <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
            ${this.formTypeBadge(f.form_type)}
            <h3 class="text-base sm:text-lg font-bold text-white">${this.esc(f.form_name || 'Form')}</h3>
            ${this.statusBadge(f.status)}
          </div>
          <div class="flex flex-col sm:flex-row gap-1 sm:gap-4 text-xs sm:text-sm">
            <span class="text-gray-400"><i class="fas fa-user mr-1"></i>Dolduran: <span class="text-white font-semibold">${this.esc(f.filled_by_name || 'Henüz doldurulmadı')}</span></span>
            ${f.filled_at ? `<span class="text-gray-400"><i class="fas fa-clock mr-1"></i>${this.fmtDateTime(f.filled_at)}</span>` : ''}
          </div>
        </div>
        <!-- Sonuç özet bar -->
        <div class="px-3 sm:px-5 py-2 sm:py-3 bg-gray-800/50 flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          <span class="text-gray-400">Sonuç:</span>
          <span class="text-green-400 font-semibold"><i class="fas fa-check mr-1"></i>${okCount} OK</span>
          <span class="text-red-400 font-semibold"><i class="fas fa-times mr-1"></i>${nokCount} NOK</span>
          <span class="text-gray-400">${answeredCount}/${items.length} cevaplanmış</span>
          <div class="flex-1"></div>
          ${f.status !== 'completed' ? `<button onclick="ProsedurOtpa.openFormFiller(${f.id})" class="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs hover:bg-blue-500/30"><i class="fas fa-edit mr-1"></i>Formu Doldur</button>` : ''}
        </div>
        <!-- Madde tablosu -->
        <div class="overflow-x-auto">
          <table class="w-full text-xs sm:text-sm">
            <thead class="bg-gray-800/60 text-gray-400 text-xs uppercase">
              <tr>
                <th class="px-2 sm:px-4 py-2 sm:py-3 w-8 sm:w-12 text-center">No</th>
                <th class="px-2 sm:px-4 py-2 sm:py-3 text-left">Kontrol Maddesi</th>
                <th class="px-2 sm:px-4 py-2 sm:py-3 w-20 sm:w-32 text-center">Sonuç</th>
                <th class="px-2 sm:px-4 py-2 sm:py-3 text-left hidden sm:table-cell">Yorum</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700/30">
              ${items.map((item, i) => {
                let resultHtml = '<span class="text-gray-500">—</span>';
                if (item.answer_value === 'evet') {
                  resultHtml = '<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 text-green-300 font-bold text-xs"><i class="fas fa-check-circle"></i> OK</span>';
                } else if (item.answer_value === 'hayir' || item.answer_value === 'nok') {
                  resultHtml = '<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 text-red-300 font-bold text-xs"><i class="fas fa-times-circle"></i> NOK</span>';
                } else if (item.answer_value != null) {
                  resultHtml = '<span class="text-white">' + this.esc(item.answer_value) + '</span>';
                }
                if (item.numeric_value != null && item.numeric_value !== '') {
                  resultHtml += ' <span class="text-blue-300 text-xs">(' + item.numeric_value + ')</span>';
                }
                return `
              <tr class="hover:bg-gray-800/30 ${(item.answer_value === 'hayir' || item.answer_value === 'nok') ? 'bg-red-500/5' : ''}">
                <td class="px-2 sm:px-4 py-2 sm:py-3 text-center text-gray-400 font-mono">${item.item_no || i + 1}</td>
                <td class="px-2 sm:px-4 py-2 sm:py-3 text-white">${this.esc(item.item_text)} ${item.is_required ? '<span class="text-red-400 text-xs">*</span>' : ''}</td>
                <td class="px-2 sm:px-4 py-2 sm:py-3 text-center">${resultHtml}</td>
                <td class="px-2 sm:px-4 py-2 sm:py-3 text-gray-400 hidden sm:table-cell">${this.esc(item.comment || '-')}</td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${f.notes ? `<div class="px-3 sm:px-5 py-2 sm:py-3 border-t border-gray-600/20 text-xs sm:text-sm"><span class="text-gray-400">Form Notu:</span> <span class="text-white">${this.esc(f.notes)}</span></div>` : ''}
      </div>`;
      }).join('')}
    </div>`;
  },

  // ═══════════════════════════════════════════════════════════════════
  // TEMSA MARKALI YAZDIR / İNDİR
  // ═══════════════════════════════════════════════════════════════════
  _temsaReportHtml() {
    const d = this.viewingBatteryReport;
    if (!d) return '';
    const otpa = d.otpa;
    const batteryNo = d.batteryNo;
    const forms = d.forms || [];
    const now = new Date().toLocaleString('tr-TR');
    const totalOk = forms.reduce((s, f) => s + (f.summary?.okItems || 0), 0);
    const totalNok = forms.reduce((s, f) => s + (f.summary?.nokItems || 0), 0);
    const allCompleted = forms.length > 0 && forms.every(f => f.status === 'completed');

    const formTypeLabel = (t) => ({ giris: 'GİRİŞ KALİTE KONTROL', proses: 'PROSES KALİTE KONTROL', final: 'FİNAL KALİTE KONTROL' }[t] || (t || '').toUpperCase());

    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>TEMSA — Batarya ${batteryNo} Kalite Raporu — ${this.esc(otpa.otpa_no)}</title>
<style>
  @page { margin: 15mm 12mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; font-size: 12px; line-height: 1.4; }

  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 20px; }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .logo-placeholder { width: 80px; height: 40px; background: linear-gradient(135deg, #1e3a5f, #2563eb); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px; letter-spacing: 2px; }
  .header-title { font-size: 14px; font-weight: 700; color: #1e3a5f; }
  .header-subtitle { font-size: 10px; color: #666; }
  .header-right { text-align: right; font-size: 10px; color: #666; }
  .doc-code { background: #1e3a5f; color: white; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 12px; display: inline-block; margin-bottom: 4px; }

  /* Info Box */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px; }
  .info-item { background: #f0f4f8; border: 1px solid #d1d9e6; border-radius: 6px; padding: 8px 10px; }
  .info-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; }
  .info-value { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-top: 2px; }

  /* Result Banner */
  .result-banner { padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; text-align: center; font-weight: 700; font-size: 14px; }
  .result-ok { background: #d1fae5; color: #065f46; border: 2px solid #34d399; }
  .result-nok { background: #fee2e2; color: #991b1b; border: 2px solid #f87171; }
  .result-pending { background: #fef3c7; color: #92400e; border: 2px solid #fbbf24; }

  /* Form Section */
  .form-section { margin-bottom: 20px; page-break-inside: avoid; }
  .form-header { background: linear-gradient(135deg, #1e3a5f, #2563eb); color: white; padding: 10px 14px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; }
  .form-header h3 { font-size: 13px; font-weight: 700; }
  .form-meta { font-size: 10px; opacity: 0.85; }

  /* Table */
  table { width: 100%; border-collapse: collapse; border: 1px solid #d1d9e6; }
  th { background: #e5e9f0; color: #1e3a5f; padding: 8px 10px; font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; border: 1px solid #d1d9e6; text-align: left; }
  td { padding: 7px 10px; font-size: 11px; border: 1px solid #d1d9e6; }
  tr:nth-child(even) { background: #f8fafc; }
  tr.nok-row { background: #fef2f2; }
  .result-ok-badge { background: #d1fae5; color: #065f46; padding: 2px 10px; border-radius: 12px; font-weight: 700; font-size: 10px; display: inline-block; }
  .result-nok-badge { background: #fee2e2; color: #991b1b; padding: 2px 10px; border-radius: 12px; font-weight: 700; font-size: 10px; display: inline-block; }
  .result-na { color: #9ca3af; font-style: italic; }
  .tech-info { margin-top: 6px; padding: 8px 14px; background: #f0f4f8; border: 1px solid #d1d9e6; border-top: none; border-radius: 0 0 8px 8px; font-size: 10px; color: #6b7280; }

  /* Footer */
  .footer { margin-top: 30px; border-top: 2px solid #1e3a5f; padding-top: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .sign-box { border: 1px solid #d1d9e6; border-radius: 6px; padding: 10px; min-height: 70px; }
  .sign-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; }
  .sign-name { font-size: 12px; font-weight: 700; color: #1e3a5f; margin-top: 4px; }
  .sign-line { border-bottom: 1px solid #9ca3af; margin-top: 30px; }

  .watermark { text-align: center; font-size: 8px; color: #9ca3af; margin-top: 16px; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="logo-placeholder">TEMSA</div>
      <div>
        <div class="header-title">KALİTE KONTROL RAPORU</div>
        <div class="header-subtitle">Batarya Bazlı Kalite Değerlendirme Formu</div>
      </div>
    </div>
    <div class="header-right">
      <div class="doc-code">${this.esc(otpa.otpa_no)} / B${batteryNo}</div>
      <div>Rapor Tarihi: ${now}</div>
      <div>Sayfa: 1</div>
    </div>
  </div>

  <!-- Bilgi Kutuları -->
  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">OTPA No</div>
      <div class="info-value">${this.esc(otpa.otpa_no)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Proje / Paket</div>
      <div class="info-value">${this.esc(otpa.project_name || '-')}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Batarya No</div>
      <div class="info-value">Batarya ${batteryNo}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Sorumlu Tekniker</div>
      <div class="info-value">${this.esc(otpa.responsible_tech || '-')}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Üretim Tarihi</div>
      <div class="info-value">${this.fmtDate(otpa.production_date)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Toplam Kontrol</div>
      <div class="info-value">${totalOk + totalNok} madde</div>
    </div>
    <div class="info-item">
      <div class="info-label">Uygun (OK)</div>
      <div class="info-value" style="color:#065f46">${totalOk}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Uygunsuz (NOK)</div>
      <div class="info-value" style="color:${totalNok > 0 ? '#991b1b' : '#065f46'}">${totalNok}</div>
    </div>
  </div>

  <!-- Genel Sonuç -->
  <div class="result-banner ${totalNok === 0 && totalOk > 0 ? 'result-ok' : totalNok > 0 ? 'result-nok' : 'result-pending'}">
    ${totalNok === 0 && totalOk > 0 ? '✓ TÜM KONTROLLER UYGUN — BATARYA KABUL EDİLDİ' : totalNok > 0 ? '✗ UYGUNSUZLUK TESPİT EDİLDİ — ' + totalNok + ' MADDE NOK' : '◷ KONTROLLER HENÜZ TAMAMLANMADI'}
  </div>

  <!-- Form Detayları -->
  ${forms.map(f => {
    const items = f.items || [];
    return `
  <div class="form-section">
    <div class="form-header">
      <h3>${formTypeLabel(f.form_type)} — ${this.esc(f.form_name || '')}</h3>
      <div class="form-meta">${f.status === 'completed' ? 'Tamamlandı' : 'Taslak'} • ${f.summary?.okItems || 0} OK / ${f.summary?.nokItems || 0} NOK</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:40px;text-align:center">NO</th>
          <th>KONTROL MADDESİ</th>
          <th style="width:80px;text-align:center">SONUÇ</th>
          <th style="width:180px">YORUM</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, i) => {
          let resultHtml = '<span class="result-na">—</span>';
          if (item.answer_value === 'evet') resultHtml = '<span class="result-ok-badge">✓ OK</span>';
          else if (item.answer_value === 'hayir' || item.answer_value === 'nok') resultHtml = '<span class="result-nok-badge">✗ NOK</span>';
          else if (item.answer_value != null) resultHtml = item.answer_value;
          if (item.numeric_value != null && item.numeric_value !== '') resultHtml += ' <small>(' + item.numeric_value + ')</small>';
          const isNok = item.answer_value === 'hayir' || item.answer_value === 'nok';
          return `
        <tr class="${isNok ? 'nok-row' : ''}">
          <td style="text-align:center;font-weight:600">${item.item_no || i + 1}</td>
          <td>${this.esc(item.item_text)}${item.is_required ? ' <small style="color:#dc2626">*</small>' : ''}</td>
          <td style="text-align:center">${resultHtml}</td>
          <td style="color:#6b7280">${this.esc(item.comment || '-')}</td>
        </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="tech-info">
      <strong>Dolduran:</strong> ${this.esc(f.filled_by_name || 'Henüz doldurulmadı')}
      ${f.filled_at ? ' &nbsp;|&nbsp; <strong>Tarih:</strong> ' + this.fmtDateTime(f.filled_at) : ''}
      ${f.notes ? ' &nbsp;|&nbsp; <strong>Not:</strong> ' + this.esc(f.notes) : ''}
    </div>
  </div>`;
  }).join('')}

  <!-- İmza Alanları -->
  <div class="footer">
    <div class="sign-box">
      <div class="sign-label">Hazırlayan Tekniker</div>
      <div class="sign-name">${this.esc(forms.find(f => f.filled_by_name)?.filled_by_name || '-')}</div>
      <div class="sign-line"></div>
      <div style="font-size:9px;color:#9ca3af;margin-top:4px">İmza / Tarih</div>
    </div>
    <div class="sign-box">
      <div class="sign-label">Kalite Kontrol Onayı</div>
      <div class="sign-name">&nbsp;</div>
      <div class="sign-line"></div>
      <div style="font-size:9px;color:#9ca3af;margin-top:4px">İmza / Tarih</div>
    </div>
    <div class="sign-box">
      <div class="sign-label">Üretim Müdürü Onayı</div>
      <div class="sign-name">&nbsp;</div>
      <div class="sign-line"></div>
      <div style="font-size:9px;color:#9ca3af;margin-top:4px">İmza / Tarih</div>
    </div>
  </div>

  <div class="watermark">
    Bu rapor TEMSA Kalite Yönetim Sistemi tarafından otomatik oluşturulmuştur. — ${now}
  </div>
</body>
</html>`;
  },

  printBatteryReport() {
    const html = this._temsaReportHtml();
    if (!html) return;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 600);
  },

  downloadBatteryReport() {
    const html = this._temsaReportHtml();
    if (!html) return;
    const d = this.viewingBatteryReport;
    const filename = `TEMSA_Kalite_Raporu_${(d.otpa?.otpa_no || '').replace(/[^a-zA-Z0-9-]/g, '_')}_B${d.batteryNo}_${new Date().toISOString().slice(0, 10)}.html`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// Export
window.ProsedurOtpa = ProsedurOtpa;
