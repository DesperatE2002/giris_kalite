// =====================================================
// PAKET-ANALİZ MODÜLÜ — Admin-only
// =====================================================

// Toast helper — projede global showToast yok, burada tanımlayalım
function paToast(msg, type = 'info') {
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };
  const el = document.createElement('div');
  el.className = `fixed top-4 right-4 z-[9999] px-6 py-3 rounded-xl text-white font-semibold shadow-2xl ${colors[type] || colors.info} transition-all transform`;
  el.style.animation = 'fadeIn 0.3s';
  el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} mr-2"></i>${msg}`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

const PaketAnaliz = {
  packages: [],
  selectedPackageId: null,
  analysisData: null,
  currentTab: 'analysis',
  pasteData: null,    // parsed paste data { columns, rows }

  async render() {
    const main = document.getElementById('content');
    main.innerHTML = `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-bold text-gray-800"><i class="fas fa-cubes mr-2 text-purple-600"></i>Paket-Analiz</h1>
        </div>

        <!-- TAB NAVİGASYON -->
        <div class="flex gap-2 mb-6 flex-wrap">
          <button onclick="PaketAnaliz.switchTab('analysis')" id="pa-tab-analysis"
            class="px-4 py-2 rounded-lg font-semibold text-sm transition-all gradient-btn text-white shadow-lg">
            <i class="fas fa-chart-bar mr-1"></i>Analiz
          </button>
          <button onclick="PaketAnaliz.switchTab('import')" id="pa-tab-import"
            class="px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-gray-100 text-gray-600 hover:bg-gray-200">
            <i class="fas fa-paste mr-1"></i>Veri Aktarım
          </button>
          <button onclick="PaketAnaliz.switchTab('packages')" id="pa-tab-packages"
            class="px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-gray-100 text-gray-600 hover:bg-gray-200">
            <i class="fas fa-box-open mr-1"></i>Paket Yönetimi
          </button>
          <button onclick="PaketAnaliz.switchTab('items')" id="pa-tab-items"
            class="px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-gray-100 text-gray-600 hover:bg-gray-200">
            <i class="fas fa-list mr-1"></i>Kalem Listesi
          </button>
        </div>

        <div id="pa-content"></div>
      </div>
    `;

    await this.loadPackages();
    this.switchTab('analysis');
  },

  async loadPackages() {
    try {
      this.packages = await api.request('/paket-analiz/packages');
    } catch (e) {
      console.error('Paket yüklenemedi:', e);
      this.packages = [];
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    ['analysis', 'import', 'packages', 'items'].forEach(t => {
      const btn = document.getElementById(`pa-tab-${t}`);
      if (btn) {
        btn.className = t === tab
          ? 'px-4 py-2 rounded-lg font-semibold text-sm transition-all gradient-btn text-white shadow-lg'
          : 'px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
      }
    });

    const c = document.getElementById('pa-content');
    if (!c) return;

    switch (tab) {
      case 'analysis': this.renderAnalysisTab(c); break;
      case 'import': this.renderImportTab(c); break;
      case 'packages': this.renderPackagesTab(c); break;
      case 'items': this.renderItemsTab(c); break;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ANALİZ TAB
  // ═══════════════════════════════════════════════════════════════════════════════
  renderAnalysisTab(container) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-6 mb-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-calculator mr-2 text-blue-500"></i>Paket Analizi</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Paket Seç</label>
            <select id="pa-analysis-pkg" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
              <option value="">-- Paket seçin --</option>
              ${this.packages.map(p => `<option value="${p.id}" ${p.id == this.selectedPackageId ? 'selected' : ''}>${p.name} ${p.code ? '(' + p.code + ')' : ''} — ${p.item_count || 0} kalem</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Paket Adedi</label>
            <input id="pa-analysis-count" type="number" min="1" value="1"
              class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Üretilecek adet">
          </div>
          <div class="flex items-end">
            <button onclick="PaketAnaliz.runAnalysis()" 
              class="w-full p-3 rounded-lg gradient-btn text-white font-semibold transition-all hover-lift">
              <i class="fas fa-play mr-2"></i>Hesapla
            </button>
          </div>
        </div>
      </div>
      <div id="pa-analysis-results"></div>
    `;
  },

  async runAnalysis() {
    const pkgId = document.getElementById('pa-analysis-pkg')?.value;
    const count = document.getElementById('pa-analysis-count')?.value || 1;

    if (!pkgId) return paToast('Lütfen bir paket seçin', 'warning');

    this.selectedPackageId = pkgId;
    const results = document.getElementById('pa-analysis-results');
    results.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i><p class="text-gray-500 mt-2">Analiz hesaplanıyor...</p></div>';

    try {
      this.analysisData = await api.request(`/paket-analiz/packages/${pkgId}/analysis?count=${count}`);
      this.renderAnalysisResults(results);
    } catch (e) {
      results.innerHTML = `<div class="glass-card rounded-2xl p-6 text-red-600"><i class="fas fa-exclamation-triangle mr-2"></i>Analiz hatası: ${e.message}</div>`;
    }
  },

  renderAnalysisResults(container) {
    const d = this.analysisData;
    if (!d) return;

    const s = d.summary;
    const currency = d.package?.currency || 'EUR';
    const timeUnit = d.package?.time_unit || 'gun';
    const currSymbols = { EUR: '€', USD: '$', TL: '₺', GBP: '£' };
    const timeLabels = { gun: 'gün', hafta: 'hafta', ay: 'ay' };
    const cs = currSymbols[currency] || currency;
    const tl = timeLabels[timeUnit] || timeUnit;
    this._cs = cs;
    this._tl = tl;

    const fmt = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
    const fmtInt = (n) => new Intl.NumberFormat('tr-TR').format(n || 0);

    container.innerHTML = `
      <!-- ÖZET KARTLAR -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="glass-card rounded-2xl p-5 text-center hover-lift">
          <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 w-12 h-12 mx-auto mb-2 flex items-center justify-center shadow-lg">
            <i class="fas fa-list text-white text-lg"></i>
          </div>
          <div class="text-2xl font-bold text-gray-800">${fmtInt(s.total_items)}</div>
          <div class="text-gray-500 text-sm">Toplam Kalem</div>
        </div>
        <div class="glass-card rounded-2xl p-5 text-center hover-lift">
          <div class="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-3 w-12 h-12 mx-auto mb-2 flex items-center justify-center shadow-lg">
            <i class="fas fa-exclamation text-white text-lg"></i>
          </div>
          <div class="text-2xl font-bold text-red-600">${fmtInt(s.missing_items)}</div>
          <div class="text-gray-500 text-sm">Eksik Kalem</div>
        </div>
        <div class="glass-card rounded-2xl p-5 text-center hover-lift">
          <div class="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-3 w-12 h-12 mx-auto mb-2 flex items-center justify-center shadow-lg">
            <i class="fas fa-boxes text-white text-lg"></i>
          </div>
          <div class="text-2xl font-bold text-gray-800">${d.package_count}</div>
          <div class="text-gray-500 text-sm">Paket Adedi</div>
        </div>
        <div class="glass-card rounded-2xl p-5 text-center hover-lift">
          <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 w-12 h-12 mx-auto mb-2 flex items-center justify-center shadow-lg">
            <i class="fas fa-dollar-sign text-white text-lg"></i>
          </div>
          <div class="text-2xl font-bold text-green-600">${fmt(s.total_missing_cost)} ${cs}</div>
          <div class="text-gray-500 text-sm">Eksik Maliyet</div>
        </div>
      </div>

      <!-- SENARYO KARTLARI -->
      <div class="glass-card rounded-2xl p-6 mb-6">
        <h3 class="text-lg font-bold text-gray-800 mb-3"><i class="fas fa-chart-line mr-2 text-purple-500"></i>Senaryo Analizi</h3>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          ${d.scenarios.map(sc => `
            <div class="rounded-xl p-4 text-center border-2 transition-all ${sc.count == d.package_count ? 'border-purple-500 bg-purple-50 shadow-md' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}">
              <div class="text-lg font-bold text-gray-800">${sc.count} Paket</div>
              <div class="text-sm text-orange-600 font-semibold mt-1">${fmt(sc.total_missing_cost)} ${cs}</div>
              <div class="text-xs text-gray-400">eksik maliyet</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- EXPORT BUTONLARI -->
      <div class="flex gap-3 mb-6 flex-wrap">
        <button onclick="PaketAnaliz.exportDetailExcel()" class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all hover-lift shadow">
          <i class="fas fa-file-excel mr-1"></i>Detay Rapor (Excel)
        </button>
        <button onclick="PaketAnaliz.exportDetailWord()" class="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-all hover-lift shadow">
          <i class="fas fa-file-word mr-1"></i>Detay Rapor (Word)
        </button>
        <button onclick="PaketAnaliz.exportMissing()" class="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all hover-lift shadow">
          <i class="fas fa-file-excel mr-1"></i>Eksik Kalemleri İndir
        </button>
        <button onclick="PaketAnaliz.exportCritical()" class="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all hover-lift shadow">
          <i class="fas fa-exclamation-triangle mr-1"></i>Kritik Kalemleri İndir
        </button>
        <button onclick="PaketAnaliz.exportScenarios()" class="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-all hover-lift shadow">
          <i class="fas fa-chart-bar mr-1"></i>Senaryo Raporu İndir
        </button>
      </div>

      <!-- FİLTRE VE TABLO -->
      <div class="glass-card rounded-2xl p-6">
        <div class="flex flex-wrap gap-3 mb-4 items-center">
          <input id="pa-filter-search" type="text" placeholder="Parça kodu veya adı ara..."
            class="flex-1 min-w-[200px] p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 text-sm focus:border-blue-400"
            oninput="PaketAnaliz.filterItems()">
          <label class="flex items-center gap-2 text-gray-600 text-sm cursor-pointer">
            <input type="checkbox" id="pa-filter-missing" onchange="PaketAnaliz.filterItems()" class="rounded border-gray-300 text-blue-500">
            Sadece eksik
          </label>
          <select id="pa-filter-sort" onchange="PaketAnaliz.filterItems()"
            class="p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 text-sm">
            <option value="part_code">Parça Kodu</option>
            <option value="missing_cost_desc">Eksik Maliyet ↓</option>
            <option value="lead_time_desc">Lead Time ↓</option>
            <option value="missing_qty_desc">Eksik Adet ↓</option>
          </select>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr class="text-gray-500 border-b border-gray-200">
                <th class="text-left p-3 font-semibold">Parça Kodu</th>
                <th class="text-left p-3 font-semibold">Parça Adı</th>
                <th class="text-right p-3 font-semibold">BOM</th>
                <th class="text-right p-3 font-semibold">İhtiyaç</th>
                <th class="text-right p-3 font-semibold">Stok</th>
                <th class="text-right p-3 font-semibold">Eksik</th>
                <th class="text-right p-3 font-semibold">Fiyat (${cs})</th>
                <th class="text-right p-3 font-semibold">Eksik Maliyet (${cs})</th>
                <th class="text-right p-3 font-semibold">Lead Time (${tl})</th>
                <th class="text-left p-3 font-semibold">Tedarikçi</th>
              </tr>
            </thead>
            <tbody id="pa-analysis-tbody" class="divide-y divide-gray-100">
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.filterItems();
  },

  filterItems() {
    if (!this.analysisData) return;

    const search = (document.getElementById('pa-filter-search')?.value || '').toLowerCase();
    const onlyMissing = document.getElementById('pa-filter-missing')?.checked;
    const sort = document.getElementById('pa-filter-sort')?.value || 'part_code';

    let items = [...this.analysisData.items];

    if (search) {
      items = items.filter(i =>
        (i.part_code || '').toLowerCase().includes(search) ||
        (i.part_name || '').toLowerCase().includes(search) ||
        (i.supplier || '').toLowerCase().includes(search)
      );
    }
    if (onlyMissing) {
      items = items.filter(i => i.missing_quantity > 0);
    }

    switch (sort) {
      case 'missing_cost_desc': items.sort((a, b) => b.missing_cost - a.missing_cost); break;
      case 'lead_time_desc': items.sort((a, b) => (b.lead_time_days || 0) - (a.lead_time_days || 0)); break;
      case 'missing_qty_desc': items.sort((a, b) => b.missing_quantity - a.missing_quantity); break;
      default: items.sort((a, b) => (a.part_code || '').localeCompare(b.part_code || ''));
    }

    const fmt = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
    const tbody = document.getElementById('pa-analysis-tbody');
    if (!tbody) return;

    const cs = this._cs || '€';
    const tl = this._tl || 'gün';

    tbody.innerHTML = items.map(item => {
      const rowClass = item.missing_quantity > 0 ? 'bg-red-50' : '';
      const missingClass = item.missing_quantity > 0 ? 'text-red-600 font-bold' : 'text-green-600';
      const ltClass = (item.lead_time_days || 0) >= 30 ? 'text-orange-600 font-bold' : 'text-gray-700';

      return `
        <tr class="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all ${rowClass}">
          <td class="p-3 text-gray-800 font-mono text-xs font-semibold">${item.part_code || ''}</td>
          <td class="p-3 text-gray-600">${item.part_name || '-'}</td>
          <td class="p-3 text-right text-gray-700">${fmt(item.bom_quantity)}</td>
          <td class="p-3 text-right text-gray-700">${fmt(item.total_need)}</td>
          <td class="p-3 text-right text-gray-700">${fmt(item.temsa_stock)}</td>
          <td class="p-3 text-right ${missingClass}">${fmt(item.missing_quantity)}</td>
          <td class="p-3 text-right text-gray-700">${fmt(item.unit_price)} ${cs}</td>
          <td class="p-3 text-right ${item.missing_cost > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}">${fmt(item.missing_cost)} ${cs}</td>
          <td class="p-3 text-right ${ltClass}">${item.lead_time_days || 0} ${tl}</td>
          <td class="p-3 text-gray-500">${item.supplier || '-'}</td>
        </tr>`;
    }).join('');

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center py-6 text-gray-400">Sonuç bulunamadı</td></tr>';
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // VERİ AKTARIM TAB (Kopyala-Yapıştır)
  // ═══════════════════════════════════════════════════════════════════════════════
  renderImportTab(container) {
    this.pasteData = null;
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-6 mb-6">
        <h2 class="text-lg font-bold text-gray-800 mb-2"><i class="fas fa-paste mr-2 text-green-600"></i>Kopyala - Yapıştır ile Veri Aktarım</h2>
        <p class="text-gray-500 text-sm mb-4">Excel'den verileri seçip kopyalayın (Ctrl+C), ardından aşağıdaki alana yapıştırın (Ctrl+V). İlk satır kolon başlığı olarak kullanılır.</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Paket Seç</label>
            <select id="pa-import-pkg" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
              <option value="">-- Paket seçin --</option>
              ${this.packages.map(p => `<option value="${p.id}" ${p.id == this.selectedPackageId ? 'selected' : ''}>${p.name} ${p.code ? '(' + p.code + ')' : ''}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Import Türü</label>
            <select id="pa-import-type" onchange="PaketAnaliz.onImportTypeChange()" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
              <option value="bom">BOM Import (Parça Kodu + Adı + Adet)</option>
              <option value="cost">Maliyet Import (Parça Kodu + Birim Fiyat)</option>
              <option value="leadtime">Lead Time Import (Parça Kodu + Süre)</option>
              <option value="stock">Stok Import (Parça Kodu + Stok Miktarı)</option>
              <option value="full">Full Import (Tüm alanlar tek seferde)</option>
            </select>
          </div>
        </div>

        <!-- YAPIŞTIR ALANI -->
        <div class="mb-4">
          <label class="block text-gray-600 text-sm mb-1 font-medium">Excel Verisi (Kopyala-Yapıştır)</label>
          <textarea id="pa-paste-area" rows="8"
            class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400 font-mono text-xs"
            placeholder="Excel'den kopyaladığınız veriyi buraya yapıştırın...&#10;&#10;Örnek (Tab ile ayrılmış):&#10;Parça Kodu&#9;Parça Adı&#9;Adet&#10;ABC-001&#9;Motor Parçası&#9;5&#10;DEF-002&#9;Conta&#9;10"
            onpaste="setTimeout(() => PaketAnaliz.parsePaste(), 100)"></textarea>
        </div>

        <div class="flex gap-3">
          <button onclick="PaketAnaliz.parsePaste()" class="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-all">
            <i class="fas fa-table mr-1"></i>Veriyi Ayrıştır
          </button>
          <button onclick="document.getElementById('pa-paste-area').value=''; PaketAnaliz.pasteData=null; document.getElementById('pa-preview-section').classList.add('hidden'); document.getElementById('pa-import-result').classList.add('hidden');" 
            class="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm transition-all">
            <i class="fas fa-eraser mr-1"></i>Temizle
          </button>
        </div>
      </div>

      <!-- KOLON EŞLEME VE ÖNİZLEME -->
      <div id="pa-preview-section" class="hidden">
        <div class="glass-card rounded-2xl p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-columns mr-2 text-blue-500"></i>Kolon Eşleme</h3>
            <span id="pa-row-count" class="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold"></span>
          </div>
          <p class="text-gray-500 text-sm mb-4">Yapıştırdığınız verideki kolon başlıklarını sistem alanlarıyla eşleştirin.</p>
          <div id="pa-mapping-fields" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
        </div>

        <div class="glass-card rounded-2xl p-6 mb-6">
          <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-eye mr-2 text-blue-500"></i>Önizleme (İlk 5 satır)</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm" id="pa-preview-table"></table>
          </div>
        </div>

        <div class="rounded-2xl p-4 mb-6 border-2 border-yellow-300 bg-yellow-50">
          <p class="text-yellow-700 text-sm"><i class="fas fa-info-circle mr-1"></i><strong>Not:</strong> Veride OLMAYAN parça kodlarının ilgili alanları <strong>sıfırlanacaktır</strong> (Full Sync mantığı).</p>
        </div>

        <button onclick="PaketAnaliz.executePasteImport()" id="pa-import-btn"
          class="w-full p-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-lg transition-all hover-lift shadow-lg">
          <i class="fas fa-upload mr-2"></i>Import Et
        </button>
      </div>

      <!-- IMPORT SONUCU -->
      <div id="pa-import-result" class="hidden mt-6"></div>
    `;
  },

  parsePaste() {
    const raw = document.getElementById('pa-paste-area')?.value?.trim();
    if (!raw) return paToast('Yapıştırılacak veri bulunamadı', 'warning');

    // Satırlara ayır
    const lines = raw.split('\n').map(l => l.trimEnd());
    if (lines.length < 2) return paToast('En az 2 satır gerekli (1 başlık + 1 veri)', 'warning');

    // Tab veya ; veya , ile ayır - hangisi daha çok varsa onu kullan
    const firstLine = lines[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;

    let delimiter = '\t';
    if (semiCount > tabCount && semiCount >= commaCount) delimiter = ';';
    else if (commaCount > tabCount && commaCount > semiCount) delimiter = ',';

    const columns = lines[0].split(delimiter).map(c => c.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cells = lines[i].split(delimiter);
      const row = {};
      columns.forEach((col, j) => {
        row[col] = (cells[j] || '').trim();
      });
      rows.push(row);
    }

    if (rows.length === 0) return paToast('Veri satırları bulunamadı', 'warning');

    this.pasteData = { columns, rows };

    document.getElementById('pa-preview-section').classList.remove('hidden');
    document.getElementById('pa-row-count').textContent = `${rows.length} satır algılandı`;
    paToast(`${rows.length} satır başarıyla ayrıştırıldı`, 'success');

    this.renderPasteMapping();
  },

  renderPasteMapping() {
    if (!this.pasteData) return;

    const importType = document.getElementById('pa-import-type')?.value || 'bom';
    const cols = this.pasteData.columns;

    let fields = [];
    switch (importType) {
      case 'bom':
        fields = [
          { key: 'part_code', label: 'Parça Kodu', required: true },
          { key: 'part_name', label: 'Parça Adı' },
          { key: 'bom_quantity', label: 'BOM Adedi', required: true }
        ];
        break;
      case 'cost':
        fields = [
          { key: 'part_code', label: 'Parça Kodu', required: true },
          { key: 'unit_price', label: 'Birim Fiyat', required: true },
          { key: 'supplier', label: 'Tedarikçi' }
        ];
        break;
      case 'leadtime':
        fields = [
          { key: 'part_code', label: 'Parça Kodu', required: true },
          { key: 'lead_time_days', label: 'Lead Time (gün)', required: true }
        ];
        break;
      case 'stock':
        fields = [
          { key: 'part_code', label: 'Parça Kodu', required: true },
          { key: 'temsa_stock', label: 'Stok Miktarı', required: true }
        ];
        break;
      case 'full':
        fields = [
          { key: 'part_code', label: 'Parça Kodu', required: true },
          { key: 'part_name', label: 'Parça Adı' },
          { key: 'bom_quantity', label: 'BOM Adedi' },
          { key: 'unit_price', label: 'Birim Fiyat' },
          { key: 'lead_time_days', label: 'Lead Time (gün)' },
          { key: 'delivery_date', label: 'Teslimat Tarihi' },
          { key: 'temsa_stock', label: 'Stok Miktarı' },
          { key: 'supplier', label: 'Tedarikçi' }
        ];
        break;
    }

    const autoMatch = (key) => {
      const hints = {
        part_code: ['parça kodu', 'part code', 'malzeme kodu', 'malzeme no', 'part no', 'pn', 'kod', 'code', 'material', 'parça no'],
        part_name: ['parça adı', 'part name', 'malzeme adı', 'açıklama', 'description', 'tanim', 'tanım', 'ad', 'isim'],
        bom_quantity: ['bom', 'adet', 'miktar', 'quantity', 'qty', 'amount', 'bom adedi'],
        unit_price: ['fiyat', 'price', 'birim fiyat', 'unit price', 'maliyet', 'cost', 'tutar'],
        lead_time_days: ['lead time', 'temin süresi', 'süre', 'gün', 'days', 'lt'],
        delivery_date: ['teslimat', 'delivery', 'tarih', 'date', 'teslim'],
        temsa_stock: ['stok', 'stock', 'envanter', 'inventory', 'mevcut', 'temsa'],
        supplier: ['tedarikçi', 'supplier', 'firma', 'vendor', 'company']
      };
      const h = hints[key] || [];
      return cols.find(c => h.some(hint => c.toLowerCase().includes(hint))) || '';
    };

    const mappingDiv = document.getElementById('pa-mapping-fields');
    mappingDiv.innerHTML = fields.map(f => `
      <div>
        <label class="block text-gray-600 text-sm mb-1 font-medium">${f.label} ${f.required ? '<span class="text-red-500">*</span>' : ''}</label>
        <select id="pa-map-${f.key}" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 text-sm focus:border-blue-400">
          ${f.required ? '' : '<option value="">-- Eşleme yok --</option>'}
          ${cols.map(c => `<option value="${c}" ${c === autoMatch(f.key) ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
    `).join('');

    // Önizleme tablosu
    const pt = document.getElementById('pa-preview-table');
    const previewRows = this.pasteData.rows.slice(0, 5);
    pt.innerHTML = `
      <thead class="bg-gray-50">
        <tr class="text-gray-500 border-b border-gray-200">
          ${cols.map(c => `<th class="text-left p-2 text-xs font-semibold">${c}</th>`).join('')}
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        ${previewRows.map(row => `
          <tr class="hover:bg-gray-50">
            ${cols.map(c => `<td class="p-2 text-gray-700 text-xs">${row[c] ?? ''}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    `;
  },

  async executePasteImport() {
    const pkgId = document.getElementById('pa-import-pkg')?.value;
    const importType = document.getElementById('pa-import-type')?.value || 'bom';

    if (!pkgId) return paToast('Lütfen bir paket seçin', 'warning');
    if (!this.pasteData || this.pasteData.rows.length === 0) return paToast('Önce veri yapıştırıp ayrıştırın', 'warning');

    const mapping = {};
    document.querySelectorAll('[id^="pa-map-"]').forEach(el => {
      const key = el.id.replace('pa-map-', '');
      if (el.value) mapping[key] = el.value;
    });

    const btn = document.getElementById('pa-import-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>İçe aktarılıyor...';

    try {
      const result = await api.request(`/paket-analiz/import/paste/${importType}`, {
        method: 'POST',
        body: JSON.stringify({
          package_id: pkgId,
          mapping: mapping,
          rows: this.pasteData.rows
        })
      });

      const resultDiv = document.getElementById('pa-import-result');
      resultDiv.classList.remove('hidden');

      const r = result.report;
      resultDiv.innerHTML = `
        <div class="rounded-2xl p-6 border-2 border-green-200 bg-green-50">
          <h3 class="text-green-700 font-bold text-lg mb-3"><i class="fas fa-check-circle mr-2"></i>${result.message}</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="text-center">
              <div class="text-2xl font-bold text-gray-800">${r.total_rows || 0}</div>
              <div class="text-gray-500 text-sm">Toplam Satır</div>
            </div>
            ${r.inserted !== undefined ? `
              <div class="text-center">
                <div class="text-2xl font-bold text-green-600">${r.inserted}</div>
                <div class="text-gray-500 text-sm">Yeni Eklenen</div>
              </div>` : ''}
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-600">${r.updated || 0}</div>
              <div class="text-gray-500 text-sm">Güncellenen</div>
            </div>
            ${r.zeroed !== undefined ? `
              <div class="text-center">
                <div class="text-2xl font-bold text-yellow-600">${r.zeroed}</div>
                <div class="text-gray-500 text-sm">Sıfırlanan</div>
              </div>` : ''}
            ${r.skipped !== undefined ? `
              <div class="text-center">
                <div class="text-2xl font-bold text-gray-400">${r.skipped}</div>
                <div class="text-gray-500 text-sm">Atlanan</div>
              </div>` : ''}
          </div>
          ${r.unmatched_count > 0 ? `
            <div class="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <p class="text-yellow-700 text-sm font-semibold mb-1"><i class="fas fa-exclamation-triangle mr-1"></i>Eşleşmeyen kodlar (${r.unmatched_count}):</p>
              <p class="text-yellow-600 text-xs">${(r.unmatched_codes || []).join(', ')}</p>
            </div>
          ` : ''}
        </div>
      `;

      paToast(result.message, 'success');
      await this.loadPackages();
    } catch (e) {
      paToast('Import hatası: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-upload mr-2"></i>Import Et';
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAKET YÖNETİMİ TAB
  // ═══════════════════════════════════════════════════════════════════════════════
  renderPackagesTab(container) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-6 mb-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-plus-circle mr-2 text-green-500"></i>Yeni Paket Ekle</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Paket Adı *</label>
            <input id="pa-pkg-name" type="text" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400" placeholder="ör: Paket A">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Paket Kodu</label>
            <input id="pa-pkg-code" type="text" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400" placeholder="ör: PKT-001">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Açıklama</label>
            <input id="pa-pkg-desc" type="text" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400" placeholder="Opsiyonel">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Para Birimi</label>
            <select id="pa-pkg-currency" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
              <option value="EUR" selected>EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="TL">TL (₺)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Süre Birimi</label>
            <select id="pa-pkg-timeunit" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
              <option value="gun" selected>Gün</option>
              <option value="hafta">Hafta</option>
              <option value="ay">Ay</option>
            </select>
          </div>
        </div>
        <button onclick="PaketAnaliz.createPackage()" class="mt-4 px-6 py-2 rounded-lg gradient-btn text-white font-semibold transition-all hover-lift">
          <i class="fas fa-plus mr-1"></i>Oluştur
        </button>
      </div>

      <div class="glass-card rounded-2xl p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-boxes mr-2 text-purple-500"></i>Mevcut Paketler</h2>
        <div id="pa-packages-list" class="space-y-3">
          ${this.packages.length === 0 ? '<p class="text-gray-400 text-center py-6">Henüz paket oluşturulmadı</p>' : ''}
          ${this.packages.map(p => {
            const currSymbols = { EUR: '€', USD: '$', TL: '₺', GBP: '£' };
            const timeLabels = { gun: 'Gün', hafta: 'Hafta', ay: 'Ay' };
            const curr = p.currency || 'EUR';
            const tu = p.time_unit || 'gun';
            return `
            <div class="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200 hover:shadow-md transition-all">
              <div>
                <span class="text-gray-800 font-semibold">${p.name}</span>
                ${p.code ? `<span class="text-gray-400 ml-2">(${p.code})</span>` : ''}
                <span class="ml-3 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600 font-semibold">${p.item_count || 0} kalem</span>
                <span class="ml-2 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-600 font-semibold">${currSymbols[curr] || curr}</span>
                <span class="ml-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-600 font-semibold">${timeLabels[tu] || tu}</span>
                ${p.description ? `<p class="text-gray-400 text-sm mt-1">${p.description}</p>` : ''}
              </div>
              <div class="flex gap-2">
                <button onclick="PaketAnaliz.editPackage(${p.id})" 
                  class="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm transition-all"><i class="fas fa-edit"></i></button>
                <button onclick="PaketAnaliz.deletePackage(${p.id}, '${(p.name || '').replace(/'/g, "\\'")}')" 
                  class="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm transition-all"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `}).join('')}
        </div>
      </div>
    `;
  },

  async createPackage() {
    const name = document.getElementById('pa-pkg-name')?.value?.trim();
    const code = document.getElementById('pa-pkg-code')?.value?.trim();
    const desc = document.getElementById('pa-pkg-desc')?.value?.trim();
    const currency = document.getElementById('pa-pkg-currency')?.value || 'EUR';
    const time_unit = document.getElementById('pa-pkg-timeunit')?.value || 'gun';

    if (!name) return paToast('Paket adı gereklidir', 'warning');

    try {
      await api.request('/paket-analiz/packages', {
        method: 'POST',
        body: JSON.stringify({ name, code, description: desc, currency, time_unit })
      });
      paToast('Paket oluşturuldu', 'success');
      await this.loadPackages();
      this.renderPackagesTab(document.getElementById('pa-content'));
    } catch (e) {
      paToast('Paket oluşturulamadı: ' + e.message, 'error');
    }
  },

  async editPackage(id) {
    const pkg = this.packages.find(p => p.id === id);
    if (!pkg) return paToast('Paket bulunamadı', 'error');
    const name = pkg.name || '';
    const code = pkg.code || '';
    const desc = pkg.description || '';
    const currency = pkg.currency || 'EUR';
    const time_unit = pkg.time_unit || 'gun';

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-edit mr-2 text-blue-500"></i>Paket Düzenle</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Paket Adı</label>
            <input id="pa-edit-name" type="text" value="${name}" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Paket Kodu</label>
            <input id="pa-edit-code" type="text" value="${code}" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Açıklama</label>
            <input id="pa-edit-desc" type="text" value="${desc}" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-gray-600 text-sm mb-1 font-medium">Para Birimi</label>
              <select id="pa-edit-currency" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
                <option value="EUR" ${currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                <option value="USD" ${currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                <option value="TL" ${currency === 'TL' ? 'selected' : ''}>TL (₺)</option>
                <option value="GBP" ${currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
              </select>
            </div>
            <div>
              <label class="block text-gray-600 text-sm mb-1 font-medium">Süre Birimi</label>
              <select id="pa-edit-timeunit" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
                <option value="gun" ${time_unit === 'gun' ? 'selected' : ''}>Gün</option>
                <option value="hafta" ${time_unit === 'hafta' ? 'selected' : ''}>Hafta</option>
                <option value="ay" ${time_unit === 'ay' ? 'selected' : ''}>Ay</option>
              </select>
            </div>
          </div>
        </div>
        <div class="flex gap-3 mt-5">
          <button onclick="PaketAnaliz.saveEditPackage(${id})" class="flex-1 p-3 rounded-lg gradient-btn text-white font-semibold transition-all">Kaydet</button>
          <button onclick="this.closest('.fixed').remove()" class="flex-1 p-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-all">İptal</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async saveEditPackage(id) {
    const name = document.getElementById('pa-edit-name')?.value?.trim();
    const code = document.getElementById('pa-edit-code')?.value?.trim();
    const desc = document.getElementById('pa-edit-desc')?.value?.trim();
    const currency = document.getElementById('pa-edit-currency')?.value || 'EUR';
    const time_unit = document.getElementById('pa-edit-timeunit')?.value || 'gun';

    if (!name) return paToast('Paket adı gereklidir', 'warning');

    try {
      await api.request(`/paket-analiz/packages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, code, description: desc, currency, time_unit })
      });
      document.querySelector('.fixed.inset-0')?.remove();
      paToast('Paket güncellendi', 'success');
      await this.loadPackages();
      this.renderPackagesTab(document.getElementById('pa-content'));
    } catch (e) {
      paToast('Güncelleme hatası: ' + e.message, 'error');
    }
  },

  async deletePackage(id, name) {
    if (!confirm(`"${name}" paketini ve tüm kalemlerini silmek istediğinize emin misiniz?`)) return;

    try {
      await api.request(`/paket-analiz/packages/${id}`, { method: 'DELETE' });
      paToast('Paket silindi', 'success');
      await this.loadPackages();
      this.renderPackagesTab(document.getElementById('pa-content'));
    } catch (e) {
      paToast('Silme hatası: ' + e.message, 'error');
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // KALEM LİSTESİ TAB
  // ═══════════════════════════════════════════════════════════════════════════════
  renderItemsTab(container) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-6 mb-6">
        <div class="flex flex-wrap items-center gap-4 mb-4">
          <div class="flex-1 min-w-[200px]">
            <label class="block text-gray-600 text-sm mb-1 font-medium">Paket Seç</label>
            <select id="pa-items-pkg" onchange="PaketAnaliz.loadItemsList()" class="w-full p-3 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
              <option value="">-- Paket seçin --</option>
              ${this.packages.map(p => `<option value="${p.id}" ${p.id == this.selectedPackageId ? 'selected' : ''}>${p.name} ${p.code ? '(' + p.code + ')' : ''}</option>`).join('')}
            </select>
          </div>
          <div class="flex items-end">
            <button onclick="PaketAnaliz.showAddItemModal()" class="p-3 rounded-lg gradient-btn text-white font-semibold transition-all hover-lift">
              <i class="fas fa-plus mr-1"></i>Kalem Ekle
            </button>
          </div>
        </div>
      </div>
      <div id="pa-items-list"></div>
    `;

    if (this.selectedPackageId) {
      document.getElementById('pa-items-pkg').value = this.selectedPackageId;
      this.loadItemsList();
    }
  },

  async loadItemsList() {
    const pkgId = document.getElementById('pa-items-pkg')?.value;
    const listDiv = document.getElementById('pa-items-list');
    if (!pkgId) {
      listDiv.innerHTML = '<div class="glass-card rounded-2xl p-6 text-center text-gray-400">Paket seçin</div>';
      return;
    }

    this.selectedPackageId = pkgId;
    listDiv.innerHTML = '<div class="text-center py-6"><i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i></div>';

    try {
      const items = await api.request(`/paket-analiz/packages/${pkgId}/items`);

      if (items.length === 0) {
        listDiv.innerHTML = '<div class="glass-card rounded-2xl p-6 text-center text-gray-400">Bu pakette henüz kalem yok. Veri Aktarım sekmesinden yapıştırarak veya manuel ekleyebilirsiniz.</div>';
        return;
      }

      const fmt = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
      const selPkg = this.packages.find(p => p.id == pkgId);
      const currSymbols = { EUR: '€', USD: '$', TL: '₺', GBP: '£' };
      const timeLabelsMap = { gun: 'gün', hafta: 'hafta', ay: 'ay' };
      const cs = currSymbols[selPkg?.currency] || '€';
      const tl = timeLabelsMap[selPkg?.time_unit] || 'gün';

      listDiv.innerHTML = `
        <div class="glass-card rounded-2xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-gray-800 font-bold">${items.length} Kalem</h3>
            <input id="pa-items-search" type="text" placeholder="Ara..." oninput="PaketAnaliz.filterItemsList()"
              class="p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 text-sm w-48 focus:border-blue-400">
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr class="text-gray-500 border-b border-gray-200">
                  <th class="text-left p-3 font-semibold">Parça Kodu</th>
                  <th class="text-left p-3 font-semibold">Parça Adı</th>
                  <th class="text-right p-3 font-semibold">BOM</th>
                  <th class="text-right p-3 font-semibold">Fiyat (${cs})</th>
                  <th class="text-right p-3 font-semibold">Lead Time (${tl})</th>
                  <th class="text-right p-3 font-semibold">Stok</th>
                  <th class="text-left p-3 font-semibold">Tedarikçi</th>
                  <th class="text-center p-3 font-semibold">İşlem</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100" id="pa-items-tbody">
                ${items.map(item => `
                  <tr class="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all pa-item-row" 
                    data-code="${(item.part_code || '').toLowerCase()}" data-name="${(item.part_name || '').toLowerCase()}">
                    <td class="p-3 text-gray-800 font-mono text-xs font-semibold">${item.part_code}</td>
                    <td class="p-3 text-gray-600">${item.part_name || '-'}</td>
                    <td class="p-3 text-right text-gray-700">${fmt(item.bom_quantity)}</td>
                    <td class="p-3 text-right text-gray-700">${fmt(item.unit_price)} ${cs}</td>
                    <td class="p-3 text-right text-gray-700">${item.lead_time_days || 0} ${tl}</td>
                    <td class="p-3 text-right text-gray-700">${fmt(item.temsa_stock)}</td>
                    <td class="p-3 text-gray-500">${item.supplier || '-'}</td>
                    <td class="p-3 text-center">
                      <button onclick='PaketAnaliz.showEditItemModal(${item.id}, ${JSON.stringify(item).replace(/'/g, "&#39;")})' 
                        class="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs mr-1 transition-all"><i class="fas fa-edit"></i></button>
                      <button onclick="PaketAnaliz.deleteItem(${item.id})" 
                        class="px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs transition-all"><i class="fas fa-trash"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (e) {
      listDiv.innerHTML = `<div class="glass-card rounded-2xl p-6 text-red-600">Kalemler yüklenemedi: ${e.message}</div>`;
    }
  },

  filterItemsList() {
    const search = (document.getElementById('pa-items-search')?.value || '').toLowerCase();
    document.querySelectorAll('.pa-item-row').forEach(row => {
      const code = row.dataset.code || '';
      const name = row.dataset.name || '';
      row.style.display = (!search || code.includes(search) || name.includes(search)) ? '' : 'none';
    });
  },

  showAddItemModal() {
    const pkgId = document.getElementById('pa-items-pkg')?.value;
    if (!pkgId) return paToast('Önce bir paket seçin', 'warning');

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-plus-circle mr-2 text-green-500"></i>Yeni Kalem Ekle</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="block text-gray-600 text-sm mb-1 font-medium">Parça Kodu *</label>
            <input id="pa-add-code" type="text" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div class="col-span-2">
            <label class="block text-gray-600 text-sm mb-1 font-medium">Parça Adı</label>
            <input id="pa-add-name" type="text" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">BOM Adedi</label>
            <input id="pa-add-bom" type="number" step="0.01" value="0" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Birim Fiyat</label>
            <input id="pa-add-price" type="number" step="0.01" value="0" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Lead Time (gün)</label>
            <input id="pa-add-lt" type="number" value="0" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Stok</label>
            <input id="pa-add-stock" type="number" step="0.01" value="0" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div class="col-span-2">
            <label class="block text-gray-600 text-sm mb-1 font-medium">Tedarikçi</label>
            <input id="pa-add-supplier" type="text" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="PaketAnaliz.saveNewItem()" class="flex-1 p-3 rounded-lg gradient-btn text-white font-semibold transition-all">Ekle</button>
          <button onclick="this.closest('.fixed').remove()" class="flex-1 p-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-all">İptal</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async saveNewItem() {
    const pkgId = document.getElementById('pa-items-pkg')?.value;
    const data = {
      part_code: document.getElementById('pa-add-code')?.value?.trim(),
      part_name: document.getElementById('pa-add-name')?.value?.trim(),
      bom_quantity: parseFloat(document.getElementById('pa-add-bom')?.value) || 0,
      unit_price: parseFloat(document.getElementById('pa-add-price')?.value) || 0,
      lead_time_days: parseInt(document.getElementById('pa-add-lt')?.value) || 0,
      temsa_stock: parseFloat(document.getElementById('pa-add-stock')?.value) || 0,
      supplier: document.getElementById('pa-add-supplier')?.value?.trim()
    };

    if (!data.part_code) return paToast('Parça kodu gereklidir', 'warning');

    try {
      await api.request(`/paket-analiz/packages/${pkgId}/items`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      document.querySelector('.fixed.inset-0')?.remove();
      paToast('Kalem eklendi', 'success');
      this.loadItemsList();
    } catch (e) {
      paToast('Ekleme hatası: ' + e.message, 'error');
    }
  },

  showEditItemModal(id, item) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-edit mr-2 text-blue-500"></i>Kalem Düzenle</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="block text-gray-600 text-sm mb-1 font-medium">Parça Kodu *</label>
            <input id="pa-edit-code" type="text" value="${item.part_code || ''}" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div class="col-span-2">
            <label class="block text-gray-600 text-sm mb-1 font-medium">Parça Adı</label>
            <input id="pa-edit-name" type="text" value="${item.part_name || ''}" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">BOM Adedi</label>
            <input id="pa-edit-bom" type="number" step="0.01" value="${item.bom_quantity || 0}" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Birim Fiyat</label>
            <input id="pa-edit-price" type="number" step="0.01" value="${item.unit_price || 0}" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Lead Time (gün)</label>
            <input id="pa-edit-lt" type="number" value="${item.lead_time_days || 0}" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Stok</label>
            <input id="pa-edit-stock" type="number" step="0.01" value="${item.temsa_stock || 0}" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Teslimat Tarihi</label>
            <input id="pa-edit-delivery" type="text" value="${item.delivery_date || ''}" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400" placeholder="ör: 2025-03-15">
          </div>
          <div>
            <label class="block text-gray-600 text-sm mb-1 font-medium">Tedarikçi</label>
            <input id="pa-edit-supplier" type="text" value="${item.supplier || ''}" class="w-full p-2 rounded-lg bg-gray-50 text-gray-800 border border-gray-200 focus:border-blue-400">
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="PaketAnaliz.saveEditItem(${id})" class="flex-1 p-3 rounded-lg gradient-btn text-white font-semibold transition-all">Kaydet</button>
          <button onclick="this.closest('.fixed').remove()" class="flex-1 p-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-all">İptal</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async saveEditItem(id) {
    const data = {
      part_code: document.getElementById('pa-edit-code')?.value?.trim(),
      part_name: document.getElementById('pa-edit-name')?.value?.trim(),
      bom_quantity: parseFloat(document.getElementById('pa-edit-bom')?.value) || 0,
      unit_price: parseFloat(document.getElementById('pa-edit-price')?.value) || 0,
      lead_time_days: parseInt(document.getElementById('pa-edit-lt')?.value) || 0,
      temsa_stock: parseFloat(document.getElementById('pa-edit-stock')?.value) || 0,
      delivery_date: document.getElementById('pa-edit-delivery')?.value?.trim() || null,
      supplier: document.getElementById('pa-edit-supplier')?.value?.trim()
    };

    if (!data.part_code) return paToast('Parça kodu gereklidir', 'warning');

    try {
      await api.request(`/paket-analiz/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      document.querySelector('.fixed.inset-0')?.remove();
      paToast('Kalem güncellendi', 'success');
      this.loadItemsList();
    } catch (e) {
      paToast('Güncelleme hatası: ' + e.message, 'error');
    }
  },

  async deleteItem(id) {
    if (!confirm('Bu kalemi silmek istediğinize emin misiniz?')) return;
    try {
      await api.request(`/paket-analiz/items/${id}`, { method: 'DELETE' });
      paToast('Kalem silindi', 'success');
      this.loadItemsList();
    } catch (e) {
      paToast('Silme hatası: ' + e.message, 'error');
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPORT HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════
  exportMissing() {
    if (!this.selectedPackageId || !this.analysisData) return;
    const count = document.getElementById('pa-analysis-count')?.value || 1;
    window.open(`/api/paket-analiz/packages/${this.selectedPackageId}/export/missing?count=${count}`, '_blank');
  },
  exportCritical() {
    if (!this.selectedPackageId) return;
    const count = document.getElementById('pa-analysis-count')?.value || 1;
    window.open(`/api/paket-analiz/packages/${this.selectedPackageId}/export/critical?count=${count}`, '_blank');
  },
  exportScenarios() {
    if (!this.selectedPackageId) return;
    window.open(`/api/paket-analiz/packages/${this.selectedPackageId}/export/scenarios`, '_blank');
  },
  exportDetailExcel() {
    if (!this.selectedPackageId || !this.analysisData) return;
    const count = document.getElementById('pa-analysis-count')?.value || 1;
    window.open(`/api/paket-analiz/packages/${this.selectedPackageId}/export/detail-excel?count=${count}`, '_blank');
  },
  exportDetailWord() {
    if (!this.selectedPackageId || !this.analysisData) return;
    const count = document.getElementById('pa-analysis-count')?.value || 1;
    window.open(`/api/paket-analiz/packages/${this.selectedPackageId}/export/detail-word?count=${count}`, '_blank');
  },

  onImportTypeChange() {
    if (this.pasteData) this.renderPasteMapping();
  }
};
