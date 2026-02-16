// =====================================================
// PAKET-ANALİZ MODÜLÜ — Admin-only
// =====================================================
const PaketAnaliz = {
  packages: [],
  selectedPackageId: null,
  analysisData: null,
  currentTab: 'analysis',
  uploadedFile: null,
  previewData: null,

  async render() {
    const main = document.getElementById('content');
    main.innerHTML = `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-white"><i class="fas fa-cubes mr-2"></i>Paket-Analiz</h1>
        </div>

        <!-- TAB NAVİGASYON -->
        <div class="flex gap-2 mb-6 flex-wrap">
          <button onclick="PaketAnaliz.switchTab('analysis')" id="pa-tab-analysis"
            class="px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-blue-500 text-white">
            <i class="fas fa-chart-bar mr-1"></i>Analiz
          </button>
          <button onclick="PaketAnaliz.switchTab('import')" id="pa-tab-import"
            class="px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-white/10 text-white/70 hover:bg-white/20">
            <i class="fas fa-file-excel mr-1"></i>Excel Import
          </button>
          <button onclick="PaketAnaliz.switchTab('packages')" id="pa-tab-packages"
            class="px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-white/10 text-white/70 hover:bg-white/20">
            <i class="fas fa-box-open mr-1"></i>Paket Yönetimi
          </button>
          <button onclick="PaketAnaliz.switchTab('items')" id="pa-tab-items"
            class="px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-white/10 text-white/70 hover:bg-white/20">
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
      const res = await API.fetch('/api/paket-analiz/packages');
      this.packages = await res.json();
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
          ? 'px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-blue-500 text-white'
          : 'px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-white/10 text-white/70 hover:bg-white/20';
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
      <div class="glass-card p-6 mb-6">
        <h2 class="text-lg font-bold text-white mb-4"><i class="fas fa-calculator mr-2"></i>Paket Analizi</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label class="block text-white/70 text-sm mb-1">Paket Seç</label>
            <select id="pa-analysis-pkg" class="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20">
              <option value="">-- Paket seçin --</option>
              ${this.packages.map(p => `<option value="${p.id}" ${p.id == this.selectedPackageId ? 'selected' : ''}>${p.name} ${p.code ? '(' + p.code + ')' : ''} — ${p.item_count || 0} kalem</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Paket Adedi</label>
            <input id="pa-analysis-count" type="number" min="1" value="1"
              class="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20" placeholder="Üretilecek adet">
          </div>
          <div class="flex items-end">
            <button onclick="PaketAnaliz.runAnalysis()" 
              class="w-full p-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-all">
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

    if (!pkgId) return showToast('Lütfen bir paket seçin', 'warning');

    this.selectedPackageId = pkgId;
    const results = document.getElementById('pa-analysis-results');
    results.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-3xl text-blue-400"></i><p class="text-white/60 mt-2">Analiz hesaplanıyor...</p></div>';

    try {
      const res = await API.fetch(`/api/paket-analiz/packages/${pkgId}/analysis?count=${count}`);
      this.analysisData = await res.json();
      this.renderAnalysisResults(results);
    } catch (e) {
      results.innerHTML = `<div class="glass-card p-6 text-red-400"><i class="fas fa-exclamation-triangle mr-2"></i>Analiz hatası: ${e.message}</div>`;
    }
  },

  renderAnalysisResults(container) {
    const d = this.analysisData;
    if (!d) return;

    const s = d.summary;
    const fmt = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
    const fmtInt = (n) => new Intl.NumberFormat('tr-TR').format(n || 0);

    container.innerHTML = `
      <!-- ÖZET KARTLAR -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="glass-card p-4 text-center">
          <div class="text-3xl font-bold text-blue-400">${fmtInt(s.total_items)}</div>
          <div class="text-white/60 text-sm">Toplam Kalem</div>
        </div>
        <div class="glass-card p-4 text-center">
          <div class="text-3xl font-bold text-red-400">${fmtInt(s.missing_items)}</div>
          <div class="text-white/60 text-sm">Eksik Kalem</div>
        </div>
        <div class="glass-card p-4 text-center">
          <div class="text-3xl font-bold text-yellow-400">${d.package_count}</div>
          <div class="text-white/60 text-sm">Paket Adedi</div>
        </div>
        <div class="glass-card p-4 text-center">
          <div class="text-3xl font-bold text-emerald-400">${fmt(s.total_missing_cost)}</div>
          <div class="text-white/60 text-sm">Toplam Eksik Maliyet</div>
        </div>
      </div>

      <!-- SENARYO KARTLARI -->
      <div class="glass-card p-6 mb-6">
        <h3 class="text-lg font-bold text-white mb-3"><i class="fas fa-chart-line mr-2"></i>Senaryo Analizi</h3>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          ${d.scenarios.map(sc => `
            <div class="bg-white/5 rounded-lg p-3 text-center border ${sc.count == d.package_count ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'}">
              <div class="text-lg font-bold text-white">${sc.count} Paket</div>
              <div class="text-sm text-yellow-400 font-semibold">${fmt(sc.total_missing_cost)}</div>
              <div class="text-xs text-white/50">eksik maliyet</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- EXPORT BUTONLARI -->
      <div class="flex gap-3 mb-6 flex-wrap">
        <button onclick="PaketAnaliz.exportMissing()" class="px-4 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-sm font-semibold transition-all">
          <i class="fas fa-file-excel mr-1"></i>Eksik Kalemleri İndir
        </button>
        <button onclick="PaketAnaliz.exportCritical()" class="px-4 py-2 rounded-lg bg-orange-500/80 hover:bg-orange-500 text-white text-sm font-semibold transition-all">
          <i class="fas fa-exclamation-triangle mr-1"></i>Kritik Kalemleri İndir
        </button>
        <button onclick="PaketAnaliz.exportScenarios()" class="px-4 py-2 rounded-lg bg-purple-500/80 hover:bg-purple-500 text-white text-sm font-semibold transition-all">
          <i class="fas fa-chart-bar mr-1"></i>Senaryo Raporu İndir
        </button>
      </div>

      <!-- FİLTRE VE TABLO -->
      <div class="glass-card p-6">
        <div class="flex flex-wrap gap-3 mb-4 items-center">
          <input id="pa-filter-search" type="text" placeholder="Parça kodu veya adı ara..."
            class="flex-1 min-w-[200px] p-2 rounded-lg bg-white/10 text-white border border-white/20 text-sm"
            oninput="PaketAnaliz.filterItems()">
          <label class="flex items-center gap-2 text-white/70 text-sm">
            <input type="checkbox" id="pa-filter-missing" onchange="PaketAnaliz.filterItems()" class="rounded">
            Sadece eksik
          </label>
          <select id="pa-filter-sort" onchange="PaketAnaliz.filterItems()"
            class="p-2 rounded-lg bg-white/10 text-white border border-white/20 text-sm">
            <option value="part_code">Parça Kodu</option>
            <option value="missing_cost_desc">Eksik Maliyet ↓</option>
            <option value="lead_time_desc">Lead Time ↓</option>
            <option value="missing_qty_desc">Eksik Adet ↓</option>
          </select>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-white/60 border-b border-white/10">
                <th class="text-left p-2">Parça Kodu</th>
                <th class="text-left p-2">Parça Adı</th>
                <th class="text-right p-2">BOM</th>
                <th class="text-right p-2">İhtiyaç</th>
                <th class="text-right p-2">Stok</th>
                <th class="text-right p-2">Eksik</th>
                <th class="text-right p-2">Fiyat</th>
                <th class="text-right p-2">Eksik Maliyet</th>
                <th class="text-right p-2">Lead Time</th>
                <th class="text-left p-2">Tedarikçi</th>
              </tr>
            </thead>
            <tbody id="pa-analysis-tbody">
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

    // Filtre
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

    // Sıralama
    switch (sort) {
      case 'missing_cost_desc': items.sort((a, b) => b.missing_cost - a.missing_cost); break;
      case 'lead_time_desc': items.sort((a, b) => (b.lead_time_days || 0) - (a.lead_time_days || 0)); break;
      case 'missing_qty_desc': items.sort((a, b) => b.missing_quantity - a.missing_quantity); break;
      default: items.sort((a, b) => (a.part_code || '').localeCompare(b.part_code || ''));
    }

    const fmt = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
    const tbody = document.getElementById('pa-analysis-tbody');
    if (!tbody) return;

    tbody.innerHTML = items.map(item => {
      const rowClass = item.missing_quantity > 0 ? 'bg-red-500/5' : '';
      const missingClass = item.missing_quantity > 0 ? 'text-red-400 font-bold' : 'text-emerald-400';
      const ltClass = (item.lead_time_days || 0) >= 30 ? 'text-orange-400 font-bold' : 'text-white/80';

      return `
        <tr class="border-b border-white/5 hover:bg-white/5 ${rowClass}">
          <td class="p-2 text-white font-mono text-xs">${item.part_code || ''}</td>
          <td class="p-2 text-white/80">${item.part_name || '-'}</td>
          <td class="p-2 text-right text-white/80">${fmt(item.bom_quantity)}</td>
          <td class="p-2 text-right text-white/80">${fmt(item.total_need)}</td>
          <td class="p-2 text-right text-white/80">${fmt(item.temsa_stock)}</td>
          <td class="p-2 text-right ${missingClass}">${fmt(item.missing_quantity)}</td>
          <td class="p-2 text-right text-white/80">${fmt(item.unit_price)}</td>
          <td class="p-2 text-right ${item.missing_cost > 0 ? 'text-yellow-400 font-semibold' : 'text-white/60'}">${fmt(item.missing_cost)}</td>
          <td class="p-2 text-right ${ltClass}">${item.lead_time_days || 0} gün</td>
          <td class="p-2 text-white/60">${item.supplier || '-'}</td>
        </tr>`;
    }).join('');

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center py-6 text-white/40">Sonuç bulunamadı</td></tr>';
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXCEL IMPORT TAB
  // ═══════════════════════════════════════════════════════════════════════════════
  renderImportTab(container) {
    container.innerHTML = `
      <div class="glass-card p-6 mb-6">
        <h2 class="text-lg font-bold text-white mb-4"><i class="fas fa-file-excel mr-2"></i>Excel Import</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label class="block text-white/70 text-sm mb-1">Paket Seç</label>
            <select id="pa-import-pkg" class="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20">
              <option value="">-- Paket seçin --</option>
              ${this.packages.map(p => `<option value="${p.id}" ${p.id == this.selectedPackageId ? 'selected' : ''}>${p.name} ${p.code ? '(' + p.code + ')' : ''}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Import Türü</label>
            <select id="pa-import-type" onchange="PaketAnaliz.onImportTypeChange()" class="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20">
              <option value="bom">BOM Import (Parça Kodu + Adı + Adet)</option>
              <option value="cost">Maliyet Import (Parça Kodu + Birim Fiyat)</option>
              <option value="leadtime">Lead Time Import (Parça Kodu + Süre)</option>
              <option value="stock">Stok Import (Parça Kodu + Stok Miktarı)</option>
              <option value="full">Full Import (Tüm alanlar tek seferde)</option>
            </select>
          </div>
        </div>

        <!-- DOSYA YÜKLEME ALANI -->
        <div id="pa-dropzone" class="border-2 border-dashed border-white/20 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400/50 hover:bg-white/5 transition-all"
          onclick="document.getElementById('pa-file-input').click()"
          ondrop="PaketAnaliz.handleDrop(event)" ondragover="PaketAnaliz.handleDragOver(event)" ondragleave="PaketAnaliz.handleDragLeave(event)">
          <input type="file" id="pa-file-input" accept=".xlsx,.xls,.csv" class="hidden" onchange="PaketAnaliz.handleFileSelect(event)">
          <i class="fas fa-cloud-upload-alt text-4xl text-white/30 mb-3"></i>
          <p class="text-white/60">Excel dosyasını sürükleyin veya tıklayarak seçin</p>
          <p class="text-white/40 text-sm mt-1">.xlsx, .xls veya .csv</p>
        </div>

        <div id="pa-file-info" class="hidden mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
          <i class="fas fa-file-excel mr-2"></i><span id="pa-file-name"></span>
        </div>
      </div>

      <!-- KOLON EŞLEME VE ÖNİZLEME -->
      <div id="pa-preview-section" class="hidden">
        <div class="glass-card p-6 mb-6">
          <h3 class="text-lg font-bold text-white mb-4"><i class="fas fa-columns mr-2"></i>Kolon Eşleme</h3>
          <p class="text-white/60 text-sm mb-4">Excel dosyanızdaki kolon başlıklarını sistem alanlarıyla eşleştirin.</p>
          <div id="pa-mapping-fields" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
        </div>

        <div class="glass-card p-6 mb-6">
          <h3 class="text-lg font-bold text-white mb-4"><i class="fas fa-eye mr-2"></i>Önizleme (İlk 5 satır)</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm" id="pa-preview-table"></table>
          </div>
        </div>

        <div class="glass-card p-6 mb-6 border border-yellow-500/30 bg-yellow-500/5">
          <h3 class="text-yellow-400 font-bold mb-2"><i class="fas fa-exclamation-triangle mr-2"></i>Full Sync Uyarısı</h3>
          <p class="text-white/70 text-sm">Bu dosyadaki veriler kaynak olarak kullanılacak. Dosyada OLMAYAN parça kodlarının ilgili alanları <strong class="text-yellow-300">sıfırlanacaktır</strong>. Bu sayede Excel her zaman tek gerçek kaynak (single source of truth) olur.</p>
        </div>

        <button onclick="PaketAnaliz.executeImport()" id="pa-import-btn"
          class="w-full p-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg transition-all">
          <i class="fas fa-upload mr-2"></i>Import Et
        </button>
      </div>

      <!-- IMPORT SONUCU -->
      <div id="pa-import-result" class="hidden mt-6"></div>
    `;
  },

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('border-blue-400', 'bg-blue-500/10');
  },
  handleDragLeave(e) {
    e.currentTarget.classList.remove('border-blue-400', 'bg-blue-500/10');
  },
  handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-400', 'bg-blue-500/10');
    const file = e.dataTransfer.files[0];
    if (file) this.processFile(file);
  },
  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) this.processFile(file);
  },

  async processFile(file) {
    this.uploadedFile = file;
    document.getElementById('pa-file-info').classList.remove('hidden');
    document.getElementById('pa-file-name').textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    // Sunucuya preview için gönder
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/paket-analiz/import/preview', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${Auth.token}` },
        body: formData
      });
      this.previewData = await res.json();
      this.renderMappingAndPreview();
    } catch (e) {
      showToast('Dosya okunamadı: ' + e.message, 'error');
    }
  },

  renderMappingAndPreview() {
    if (!this.previewData) return;

    document.getElementById('pa-preview-section').classList.remove('hidden');

    const importType = document.getElementById('pa-import-type')?.value || 'bom';
    const cols = this.previewData.columns;

    // Import türüne göre eşlenecek alanlar
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
          { key: 'unit_price', label: 'Birim Fiyat', required: true }
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

    // Auto-match kolonu bul
    const autoMatch = (key) => {
      const hints = {
        part_code: ['parça kodu', 'part code', 'malzeme kodu', 'malzeme no', 'part no', 'pn', 'kod', 'code', 'material'],
        part_name: ['parça adı', 'part name', 'malzeme adı', 'açıklama', 'description', 'tanim', 'tanım', 'ad'],
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
        <label class="block text-white/70 text-sm mb-1">${f.label} ${f.required ? '<span class="text-red-400">*</span>' : ''}</label>
        <select id="pa-map-${f.key}" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20 text-sm">
          ${f.required ? '' : '<option value="">-- Eşleme yok --</option>'}
          ${cols.map(c => `<option value="${c}" ${c === autoMatch(f.key) ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
    `).join('');

    // Önizleme tablosu
    const pt = document.getElementById('pa-preview-table');
    pt.innerHTML = `
      <thead>
        <tr class="text-white/60 border-b border-white/10">
          ${cols.map(c => `<th class="text-left p-2 text-xs">${c}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${this.previewData.preview.map(row => `
          <tr class="border-b border-white/5">
            ${cols.map(c => `<td class="p-2 text-white/80 text-xs">${row[c] ?? ''}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    `;
  },

  async executeImport() {
    const pkgId = document.getElementById('pa-import-pkg')?.value;
    const importType = document.getElementById('pa-import-type')?.value || 'bom';

    if (!pkgId) return showToast('Lütfen bir paket seçin', 'warning');
    if (!this.uploadedFile) return showToast('Lütfen bir dosya seçin', 'warning');

    // Eşleme topla
    const mapping = {};
    document.querySelectorAll('[id^="pa-map-"]').forEach(el => {
      const key = el.id.replace('pa-map-', '');
      if (el.value) mapping[key] = el.value;
    });

    const btn = document.getElementById('pa-import-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>İçe aktarılıyor...';

    const formData = new FormData();
    formData.append('file', this.uploadedFile);
    formData.append('package_id', pkgId);
    formData.append('mapping', JSON.stringify(mapping));

    try {
      const res = await fetch(`/api/paket-analiz/import/${importType}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${Auth.token}` },
        body: formData
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Import hatası');

      const resultDiv = document.getElementById('pa-import-result');
      resultDiv.classList.remove('hidden');

      const r = result.report;
      resultDiv.innerHTML = `
        <div class="glass-card p-6 border border-emerald-500/30 bg-emerald-500/5">
          <h3 class="text-emerald-400 font-bold text-lg mb-3"><i class="fas fa-check-circle mr-2"></i>${result.message}</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="text-center">
              <div class="text-2xl font-bold text-white">${r.total_rows || 0}</div>
              <div class="text-white/50 text-sm">Toplam Satır</div>
            </div>
            ${r.inserted !== undefined ? `
              <div class="text-center">
                <div class="text-2xl font-bold text-emerald-400">${r.inserted}</div>
                <div class="text-white/50 text-sm">Yeni Eklenen</div>
              </div>` : ''}
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-400">${r.updated || 0}</div>
              <div class="text-white/50 text-sm">Güncellenen</div>
            </div>
            ${r.zeroed !== undefined ? `
              <div class="text-center">
                <div class="text-2xl font-bold text-yellow-400">${r.zeroed}</div>
                <div class="text-white/50 text-sm">Sıfırlanan</div>
              </div>` : ''}
            ${r.skipped !== undefined ? `
              <div class="text-center">
                <div class="text-2xl font-bold text-white/40">${r.skipped}</div>
                <div class="text-white/50 text-sm">Atlanan</div>
              </div>` : ''}
          </div>
          ${r.unmatched_count > 0 ? `
            <div class="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p class="text-yellow-400 text-sm font-semibold mb-1"><i class="fas fa-exclamation-triangle mr-1"></i>Eşleşmeyen kodlar (${r.unmatched_count}):</p>
              <p class="text-white/60 text-xs">${(r.unmatched_codes || []).join(', ')}</p>
            </div>
          ` : ''}
        </div>
      `;

      showToast(result.message, 'success');
      await this.loadPackages();
    } catch (e) {
      showToast('Import hatası: ' + e.message, 'error');
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
      <div class="glass-card p-6 mb-6">
        <h2 class="text-lg font-bold text-white mb-4"><i class="fas fa-plus-circle mr-2"></i>Yeni Paket Ekle</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-white/70 text-sm mb-1">Paket Adı *</label>
            <input id="pa-pkg-name" type="text" class="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20" placeholder="ör: Paket A">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Paket Kodu</label>
            <input id="pa-pkg-code" type="text" class="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20" placeholder="ör: PKT-001">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Açıklama</label>
            <input id="pa-pkg-desc" type="text" class="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20" placeholder="Opsiyonel">
          </div>
        </div>
        <button onclick="PaketAnaliz.createPackage()" class="mt-4 px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-all">
          <i class="fas fa-plus mr-1"></i>Oluştur
        </button>
      </div>

      <div class="glass-card p-6">
        <h2 class="text-lg font-bold text-white mb-4"><i class="fas fa-boxes mr-2"></i>Mevcut Paketler</h2>
        <div id="pa-packages-list" class="space-y-3">
          ${this.packages.length === 0 ? '<p class="text-white/40 text-center py-6">Henüz paket oluşturulmadı</p>' : ''}
          ${this.packages.map(p => `
            <div class="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
              <div>
                <span class="text-white font-semibold">${p.name}</span>
                ${p.code ? `<span class="text-white/50 ml-2">(${p.code})</span>` : ''}
                <span class="ml-3 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300">${p.item_count || 0} kalem</span>
                ${p.description ? `<p class="text-white/40 text-sm mt-1">${p.description}</p>` : ''}
              </div>
              <div class="flex gap-2">
                <button onclick="PaketAnaliz.editPackage(${p.id}, '${(p.name || '').replace(/'/g, "\\'")}', '${(p.code || '').replace(/'/g, "\\'")}', '${(p.description || '').replace(/'/g, "\\'")}')" 
                  class="px-3 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-sm"><i class="fas fa-edit"></i></button>
                <button onclick="PaketAnaliz.deletePackage(${p.id}, '${(p.name || '').replace(/'/g, "\\'")}')" 
                  class="px-3 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 text-sm"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  async createPackage() {
    const name = document.getElementById('pa-pkg-name')?.value?.trim();
    const code = document.getElementById('pa-pkg-code')?.value?.trim();
    const desc = document.getElementById('pa-pkg-desc')?.value?.trim();

    if (!name) return showToast('Paket adı gereklidir', 'warning');

    try {
      await API.fetch('/api/paket-analiz/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, description: desc })
      });
      showToast('Paket oluşturuldu', 'success');
      await this.loadPackages();
      this.renderPackagesTab(document.getElementById('pa-content'));
    } catch (e) {
      showToast('Paket oluşturulamadı: ' + e.message, 'error');
    }
  },

  async editPackage(id, name, code, desc) {
    // Modal
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
    overlay.innerHTML = `
      <div class="glass-card p-6 w-full max-w-md">
        <h3 class="text-lg font-bold text-white mb-4"><i class="fas fa-edit mr-2"></i>Paket Düzenle</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-white/70 text-sm mb-1">Paket Adı</label>
            <input id="pa-edit-name" type="text" value="${name}" class="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Paket Kodu</label>
            <input id="pa-edit-code" type="text" value="${code}" class="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Açıklama</label>
            <input id="pa-edit-desc" type="text" value="${desc}" class="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="PaketAnaliz.saveEditPackage(${id})" class="flex-1 p-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-all">Kaydet</button>
          <button onclick="this.closest('.fixed').remove()" class="flex-1 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">İptal</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async saveEditPackage(id) {
    const name = document.getElementById('pa-edit-name')?.value?.trim();
    const code = document.getElementById('pa-edit-code')?.value?.trim();
    const desc = document.getElementById('pa-edit-desc')?.value?.trim();

    if (!name) return showToast('Paket adı gereklidir', 'warning');

    try {
      await API.fetch(`/api/paket-analiz/packages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, description: desc })
      });
      document.querySelector('.fixed.inset-0')?.remove();
      showToast('Paket güncellendi', 'success');
      await this.loadPackages();
      this.renderPackagesTab(document.getElementById('pa-content'));
    } catch (e) {
      showToast('Güncelleme hatası: ' + e.message, 'error');
    }
  },

  async deletePackage(id, name) {
    if (!confirm(`"${name}" paketini ve tüm kalemlerini silmek istediğinize emin misiniz?`)) return;

    try {
      await API.fetch(`/api/paket-analiz/packages/${id}`, { method: 'DELETE' });
      showToast('Paket silindi', 'success');
      await this.loadPackages();
      this.renderPackagesTab(document.getElementById('pa-content'));
    } catch (e) {
      showToast('Silme hatası: ' + e.message, 'error');
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // KALEM LİSTESİ TAB
  // ═══════════════════════════════════════════════════════════════════════════════
  renderItemsTab(container) {
    container.innerHTML = `
      <div class="glass-card p-6 mb-6">
        <div class="flex flex-wrap items-center gap-4 mb-4">
          <div class="flex-1 min-w-[200px]">
            <label class="block text-white/70 text-sm mb-1">Paket Seç</label>
            <select id="pa-items-pkg" onchange="PaketAnaliz.loadItemsList()" class="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20">
              <option value="">-- Paket seçin --</option>
              ${this.packages.map(p => `<option value="${p.id}" ${p.id == this.selectedPackageId ? 'selected' : ''}>${p.name} ${p.code ? '(' + p.code + ')' : ''}</option>`).join('')}
            </select>
          </div>
          <div class="flex items-end">
            <button onclick="PaketAnaliz.showAddItemModal()" class="p-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-all">
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
      listDiv.innerHTML = '<div class="glass-card p-6 text-center text-white/40">Paket seçin</div>';
      return;
    }

    this.selectedPackageId = pkgId;
    listDiv.innerHTML = '<div class="text-center py-6"><i class="fas fa-spinner fa-spin text-2xl text-blue-400"></i></div>';

    try {
      const res = await API.fetch(`/api/paket-analiz/packages/${pkgId}/items`);
      const items = await res.json();

      if (items.length === 0) {
        listDiv.innerHTML = '<div class="glass-card p-6 text-center text-white/40">Bu pakette henüz kalem yok. Excel ile import yapabilir veya manuel ekleyebilirsiniz.</div>';
        return;
      }

      const fmt = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

      listDiv.innerHTML = `
        <div class="glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-white font-bold">${items.length} Kalem</h3>
            <input id="pa-items-search" type="text" placeholder="Ara..." oninput="PaketAnaliz.filterItemsList()"
              class="p-2 rounded-lg bg-white/10 text-white border border-white/20 text-sm w-48">
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-white/60 border-b border-white/10">
                  <th class="text-left p-2">Parça Kodu</th>
                  <th class="text-left p-2">Parça Adı</th>
                  <th class="text-right p-2">BOM</th>
                  <th class="text-right p-2">Fiyat</th>
                  <th class="text-right p-2">Lead Time</th>
                  <th class="text-right p-2">Stok</th>
                  <th class="text-left p-2">Tedarikçi</th>
                  <th class="text-center p-2">İşlem</th>
                </tr>
              </thead>
              <tbody id="pa-items-tbody">
                ${items.map(item => `
                  <tr class="border-b border-white/5 hover:bg-white/5 pa-item-row" 
                    data-code="${(item.part_code || '').toLowerCase()}" data-name="${(item.part_name || '').toLowerCase()}">
                    <td class="p-2 text-white font-mono text-xs">${item.part_code}</td>
                    <td class="p-2 text-white/80">${item.part_name || '-'}</td>
                    <td class="p-2 text-right text-white/80">${fmt(item.bom_quantity)}</td>
                    <td class="p-2 text-right text-white/80">${fmt(item.unit_price)}</td>
                    <td class="p-2 text-right text-white/80">${item.lead_time_days || 0} gün</td>
                    <td class="p-2 text-right text-white/80">${fmt(item.temsa_stock)}</td>
                    <td class="p-2 text-white/60">${item.supplier || '-'}</td>
                    <td class="p-2 text-center">
                      <button onclick="PaketAnaliz.showEditItemModal(${item.id}, ${JSON.stringify(item).replace(/"/g, '&quot;')})" 
                        class="px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs mr-1"><i class="fas fa-edit"></i></button>
                      <button onclick="PaketAnaliz.deleteItem(${item.id})" 
                        class="px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs"><i class="fas fa-trash"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (e) {
      listDiv.innerHTML = `<div class="glass-card p-6 text-red-400">Kalemler yüklenemedi: ${e.message}</div>`;
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
    if (!pkgId) return showToast('Önce bir paket seçin', 'warning');

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
    overlay.innerHTML = `
      <div class="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold text-white mb-4"><i class="fas fa-plus-circle mr-2"></i>Yeni Kalem Ekle</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="block text-white/70 text-sm mb-1">Parça Kodu *</label>
            <input id="pa-add-code" type="text" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div class="col-span-2">
            <label class="block text-white/70 text-sm mb-1">Parça Adı</label>
            <input id="pa-add-name" type="text" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">BOM Adedi</label>
            <input id="pa-add-bom" type="number" step="0.01" value="0" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Birim Fiyat</label>
            <input id="pa-add-price" type="number" step="0.01" value="0" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Lead Time (gün)</label>
            <input id="pa-add-lt" type="number" value="0" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Stok</label>
            <input id="pa-add-stock" type="number" step="0.01" value="0" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div class="col-span-2">
            <label class="block text-white/70 text-sm mb-1">Tedarikçi</label>
            <input id="pa-add-supplier" type="text" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="PaketAnaliz.saveNewItem()" class="flex-1 p-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-all">Ekle</button>
          <button onclick="this.closest('.fixed').remove()" class="flex-1 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">İptal</button>
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

    if (!data.part_code) return showToast('Parça kodu gereklidir', 'warning');

    try {
      await API.fetch(`/api/paket-analiz/packages/${pkgId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      document.querySelector('.fixed.inset-0')?.remove();
      showToast('Kalem eklendi', 'success');
      this.loadItemsList();
    } catch (e) {
      showToast('Ekleme hatası: ' + e.message, 'error');
    }
  },

  showEditItemModal(id, item) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4';
    overlay.innerHTML = `
      <div class="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold text-white mb-4"><i class="fas fa-edit mr-2"></i>Kalem Düzenle</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="block text-white/70 text-sm mb-1">Parça Kodu *</label>
            <input id="pa-edit-code" type="text" value="${item.part_code || ''}" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div class="col-span-2">
            <label class="block text-white/70 text-sm mb-1">Parça Adı</label>
            <input id="pa-edit-name" type="text" value="${item.part_name || ''}" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">BOM Adedi</label>
            <input id="pa-edit-bom" type="number" step="0.01" value="${item.bom_quantity || 0}" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Birim Fiyat</label>
            <input id="pa-edit-price" type="number" step="0.01" value="${item.unit_price || 0}" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Lead Time (gün)</label>
            <input id="pa-edit-lt" type="number" value="${item.lead_time_days || 0}" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Stok</label>
            <input id="pa-edit-stock" type="number" step="0.01" value="${item.temsa_stock || 0}" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Teslimat Tarihi</label>
            <input id="pa-edit-delivery" type="text" value="${item.delivery_date || ''}" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20" placeholder="ör: 2025-03-15">
          </div>
          <div>
            <label class="block text-white/70 text-sm mb-1">Tedarikçi</label>
            <input id="pa-edit-supplier" type="text" value="${item.supplier || ''}" class="w-full p-2 rounded-lg bg-white/10 text-white border border-white/20">
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="PaketAnaliz.saveEditItem(${id})" class="flex-1 p-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-all">Kaydet</button>
          <button onclick="this.closest('.fixed').remove()" class="flex-1 p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">İptal</button>
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

    if (!data.part_code) return showToast('Parça kodu gereklidir', 'warning');

    try {
      await API.fetch(`/api/paket-analiz/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      document.querySelector('.fixed.inset-0')?.remove();
      showToast('Kalem güncellendi', 'success');
      this.loadItemsList();
    } catch (e) {
      showToast('Güncelleme hatası: ' + e.message, 'error');
    }
  },

  async deleteItem(id) {
    if (!confirm('Bu kalemi silmek istediğinize emin misiniz?')) return;
    try {
      await API.fetch(`/api/paket-analiz/items/${id}`, { method: 'DELETE' });
      showToast('Kalem silindi', 'success');
      this.loadItemsList();
    } catch (e) {
      showToast('Silme hatası: ' + e.message, 'error');
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

  onImportTypeChange() {
    if (this.previewData) this.renderMappingAndPreview();
  }
};
