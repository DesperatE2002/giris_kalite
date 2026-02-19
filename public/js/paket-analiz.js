// ═══════════════════════════════════════════════════════════════════════════════
// PAKET-ANALİZ MODÜLÜ — FRONTEND (Tamamen İzole)
// Tabs: Analiz | Ana Veri | BOM Yönetimi | Raporlar
// ═══════════════════════════════════════════════════════════════════════════════

const MASTER_HINTS = {
  malzeme_no: ['malzeme', 'material', 'parça no', 'part', 'no', 'numara', 'code', 'kod', 'stok kodu'],
  parca_tanimi: ['tanım', 'tanımlama', 'description', 'açıklama', 'parça', 'isim', 'name', 'desc'],
  birim_adet: ['birim adet', 'birim', 'unit'],
  stok: ['stok', 'stock', 'envanter', 'inventory', 'mevcut', 'eldeki'],
  lead_time_gun: ['lead', 'termin', 'süre', 'gün', 'day', 'lt', 'teslim'],
  birim_maliyet: ['maliyet', 'fiyat', 'cost', 'price', 'tutar'],
  tedarikci: ['tedarik', 'supplier', 'vendor', 'firma', 'kaynak']
};

const BOM_HINTS = {
  malzeme_no: ['malzeme', 'material', 'parça no', 'part', 'no', 'numara', 'code', 'kod', 'stok kodu'],
  miktar: ['adet', 'miktar', 'quantity', 'qty', 'amount', 'sayı', 'pcs', 'kullanım', 'kullanim', 'usage', 'birim adet', 'birim miktar', 'bom qty', 'bom adet', 'per', 'piece', 'toplam', 'gerekli', 'ihtiyac', 'ihtiyaç']
};

const PaketAnaliz = {
  // ─── State ────────────────────────────────────────────────────────
  currentTab: 'analysis',
  materials: [],
  packages: [],
  stats: null,
  analysisResult: null,
  selectedPkgId: null,
  pkgItems: [],
  masterParsed: null,
  bomParsed: null,
  analysisFilter: 'all',
  analysisSearch: '',

  // ─── Formatters ───────────────────────────────────────────────────
  fmtCur(n) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(n || 0);
  },
  fmtNum(n, d = 0) {
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: d }).format(n || 0);
  },

  // ─── Paste Parser ─────────────────────────────────────────────────
  parsePaste(text, forceDelimiter) {
    if (!text?.trim()) return null;
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;

    let bestDel;
    if (forceDelimiter) {
      bestDel = forceDelimiter;
    } else {
      // Tab her zaman Excel'den gelir — tab varsa tab kullan
      const tabCols = lines[0].split('\t').length;
      if (tabCols > 1) {
        bestDel = '\t';
      } else {
        // Tab yoksa ; dene, sonra , (virgül Türkçe ondalıkla karışır)
        const semiCols = lines[0].split(';').length;
        if (semiCols > 1) {
          bestDel = ';';
        } else {
          bestDel = ',';
        }
      }
    }

    const headers = lines[0].split(bestDel).map(h => h.trim());
    const rows = lines.slice(1).filter(l => l.trim()).map(l => {
      const cells = l.split(bestDel).map(c => c.trim());
      // Eksik hücreleri boşla doldur
      while (cells.length < headers.length) cells.push('');
      return cells;
    });

    const delimName = bestDel === '\t' ? 'Tab' : bestDel === ';' ? 'Noktalı virgül' : 'Virgül';
    return { headers, rows, delimiter: bestDel, delimiterName: delimName };
  },

  autoMap(headers, hints) {
    const mapping = {};
    for (const [field, keywords] of Object.entries(hints)) {
      let bestIdx = -1, bestScore = 0;
      headers.forEach((h, idx) => {
        const hl = h.toLowerCase();
        for (const kw of keywords) {
          if (hl.includes(kw) && kw.length > bestScore) { bestIdx = idx; bestScore = kw.length; }
        }
      });
      if (bestIdx >= 0) mapping[field] = bestIdx;
    }
    return mapping;
  },

  statusBadge(durum) {
    if (durum === 'yeterli') return '<span class="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs font-medium">Yeterli</span>';
    if (durum === 'eksik') return '<span class="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs font-medium">Eksik</span>';
    return '<span class="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-xs font-medium">Bulunamadı</span>';
  },

  // ═══════════════════════════════════════════════════════════════════
  // ANA RENDER
  // ═══════════════════════════════════════════════════════════════════
  async render() {
    const mc = document.getElementById('content');
    if (!mc) return;

    mc.innerHTML = `
      <div class="max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl font-bold text-white flex items-center gap-3">
              <i class="fas fa-box-open text-purple-400"></i> Paket-Analiz
            </h1>
            <p class="text-white/50 text-sm mt-1">Üretim Planlama & Maliyet Analiz Sistemi</p>
          </div>
          <div id="pa-stats-header" class="flex gap-3"></div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-2 mb-6" id="pa-tabs">
          <button onclick="PaketAnaliz.switchTab('analysis')" data-tab="analysis"
            class="px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <i class="fas fa-chart-bar"></i> Analiz
          </button>
          <button onclick="PaketAnaliz.switchTab('master')" data-tab="master"
            class="px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <i class="fas fa-database"></i> Ana Veri
          </button>
          <button onclick="PaketAnaliz.switchTab('bom')" data-tab="bom"
            class="px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <i class="fas fa-sitemap"></i> BOM Yönetimi
          </button>
          <button onclick="PaketAnaliz.switchTab('reports')" data-tab="reports"
            class="px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <i class="fas fa-file-export"></i> Raporlar
          </button>
        </div>

        <div id="pa-tab-content"></div>
      </div>
    `;

    this.switchTab(this.currentTab);
    this.loadStatsHeader();
  },

  async loadStatsHeader() {
    try {
      const stats = await api.request('/paket-analiz/stats');
      this.stats = stats;
      const el = document.getElementById('pa-stats-header');
      if (el) {
        el.innerHTML = `
          <div class="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-white/70 flex items-center gap-2">
            <i class="fas fa-cubes text-blue-400"></i> ${stats.material_count} Malzeme
          </div>
          <div class="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-white/70 flex items-center gap-2">
            <i class="fas fa-box text-green-400"></i> ${stats.package_count} Paket
          </div>
        `;
      }
    } catch (e) { /* ignore */ }
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('#pa-tabs button').forEach(b => {
      const isActive = b.dataset.tab === tab;
      b.className = `px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/10 text-white/60 hover:bg-white/20'}`;
    });
    const ct = document.getElementById('pa-tab-content');
    if (!ct) return;
    switch (tab) {
      case 'analysis': this.renderAnalysisTab(ct); break;
      case 'master': this.renderMasterTab(ct); break;
      case 'bom': this.renderBomTab(ct); break;
      case 'reports': this.renderReportsTab(ct); break;
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // ANALİZ TAB
  // ═══════════════════════════════════════════════════════════════════
  async renderAnalysisTab(ct) {
    await this.ensurePackages();
    ct.innerHTML = `
      <div class="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
        <h2 class="text-lg font-semibold text-white mb-4"><i class="fas fa-cogs text-blue-400 mr-2"></i>Analiz Konfigürasyonu</h2>
        ${this.packages.length === 0 ? `
          <div class="text-center py-8 text-white/50">
            <i class="fas fa-info-circle text-4xl mb-3 block text-blue-400/50"></i>
            <p>Henüz BOM paketi tanımlanmamış.</p>
            <p class="text-sm mt-2">Önce <b>"Ana Veri"</b> sekmesinden malzeme verilerinizi yükleyin, sonra <b>"BOM Yönetimi"</b> sekmesinden paketlerinizi oluşturun.</p>
          </div>
        ` : `
          <div class="space-y-3" id="pa-pkg-selections">
            ${this.packages.map(p => `
              <div class="flex items-center gap-4 bg-white/5 rounded-lg p-3 border border-white/10">
                <label class="flex items-center gap-2 flex-1 cursor-pointer">
                  <input type="checkbox" class="pa-pkg-check rounded" value="${p.id}" data-name="${p.paket_adi}">
                  <span class="text-white font-medium">${p.paket_adi}</span>
                  <span class="text-white/40 text-xs">(${p.item_count} kalem)</span>
                </label>
                <div class="flex items-center gap-2">
                  <label class="text-white/50 text-sm">Adet:</label>
                  <input type="number" min="1" value="1" class="pa-pkg-adet bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-center w-24" data-pkg="${p.id}">
                </div>
              </div>
            `).join('')}
          </div>
          <div class="mt-4 flex gap-3">
            <button onclick="PaketAnaliz.runAnalysis()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition font-medium flex items-center gap-2 shadow-lg">
              <i class="fas fa-play"></i> Analiz Yap
            </button>
          </div>
        `}
      </div>
      <div id="pa-analysis-results"></div>
    `;
  },

  async ensurePackages() {
    if (!this.packages.length) {
      try { this.packages = await api.request('/paket-analiz/bom-packages'); } catch (e) { this.packages = []; }
    }
  },

  async runAnalysis() {
    const checks = document.querySelectorAll('.pa-pkg-check:checked');
    if (!checks.length) { alert('En az bir paket seçin'); return; }

    const selections = [];
    checks.forEach(ch => {
      const adetInput = document.querySelector(`.pa-pkg-adet[data-pkg="${ch.value}"]`);
      selections.push({ package_id: parseInt(ch.value), adet: parseInt(adetInput?.value) || 1 });
    });

    const btn = document.querySelector('[onclick="PaketAnaliz.runAnalysis()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Hesaplanıyor...'; }

    try {
      const data = await api.request('/paket-analiz/analyze', { method: 'POST', body: JSON.stringify({ selections }) });
      this.analysisResult = data;
      this.renderAnalysisResults(data);
    } catch (error) {
      alert('Analiz hatası: ' + (error.message || error));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Analiz Yap'; }
    }
  },

  renderAnalysisResults(data) {
    const ct = document.getElementById('pa-analysis-results');
    if (!ct || !data?.packages?.length) return;
    const c = data.combined;

    // For each package result
    let html = '';
    for (const pkg of data.packages) {
      html += `
        <div class="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-white">
              <i class="fas fa-box text-purple-400 mr-2"></i>${pkg.paket_adi}
              <span class="text-white/40 text-sm font-normal ml-2">× ${this.fmtNum(pkg.adet)} adet</span>
            </h3>
            ${pkg.warnings?.length ? `<span class="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs">${pkg.warnings.length} uyarı</span>` : ''}
          </div>

          <!-- Summary Cards -->
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <div class="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20 text-center">
              <div class="text-blue-400 text-xs mb-1">Birim Maliyet</div>
              <div class="text-white font-bold text-sm">${this.fmtCur(pkg.birim_maliyet)}</div>
            </div>
            <div class="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20 text-center">
              <div class="text-purple-400 text-xs mb-1">Toplam Maliyet</div>
              <div class="text-white font-bold text-sm">${this.fmtCur(pkg.toplam_maliyet)}</div>
            </div>
            <div class="bg-red-500/10 rounded-lg p-3 border border-red-500/20 text-center">
              <div class="text-red-400 text-xs mb-1">Eksik Kalem</div>
              <div class="text-white font-bold text-lg">${pkg.eksik_kalem_sayisi}</div>
            </div>
            <div class="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20 text-center">
              <div class="text-orange-400 text-xs mb-1">Max Lead Time</div>
              <div class="text-white font-bold text-lg">${pkg.max_lead_time} <span class="text-xs font-normal">gün</span></div>
            </div>
            <div class="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20 text-center">
              <div class="text-yellow-400 text-xs mb-1">Satın Alma Maliyeti</div>
              <div class="text-white font-bold text-sm">${this.fmtCur(pkg.toplam_eksik_maliyet)}</div>
            </div>
            <div class="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20 text-center">
              <div class="text-cyan-400 text-xs mb-1">Bulunamadı</div>
              <div class="text-white font-bold text-lg">${pkg.bulunamadi_sayisi}</div>
            </div>
          </div>

          ${pkg.kritik_parca ? `
            <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-3">
              <i class="fas fa-exclamation-triangle text-red-400 text-lg"></i>
              <div>
                <span class="text-red-400 font-medium">Kritik Parça:</span>
                <span class="text-white ml-2">${pkg.kritik_parca.malzeme_no} — ${pkg.kritik_parca.tanimi}</span>
                <span class="text-red-300 ml-2">(${pkg.kritik_parca.lead_time} gün)</span>
              </div>
            </div>
          ` : ''}

          ${pkg.warnings?.length ? `
            <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <div class="text-yellow-400 text-sm font-medium mb-1"><i class="fas fa-exclamation-circle mr-1"></i> Uyarılar</div>
              ${pkg.warnings.map(w => `<div class="text-yellow-300/70 text-xs">• ${w}</div>`).join('')}
            </div>
          ` : ''}

          <!-- Detail Table -->
          <div class="mb-2 flex flex-wrap gap-2 items-center">
            <input type="text" placeholder="Ara..." class="bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/30 w-48"
              oninput="PaketAnaliz.filterItems(this.value, ${pkg.package_id})">
            <select class="bg-gray-800 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm" style="color-scheme:dark"
              onchange="PaketAnaliz.filterItemsByStatus(this.value, ${pkg.package_id})">
              <option value="all">Tümü</option>
              <option value="eksik">Sadece Eksik</option>
              <option value="yeterli">Sadece Yeterli</option>
              <option value="bulunamadi">Bulunamadı</option>
            </select>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm" id="pa-items-table-${pkg.package_id}">
              <thead>
                <tr class="text-white/60 text-xs uppercase border-b border-white/10">
                  <th class="text-left py-2 px-2">Malzeme No</th>
                  <th class="text-left py-2 px-2">Parça Tanımı</th>
                  <th class="text-right py-2 px-2">BOM</th>
                  <th class="text-right py-2 px-2">Toplam İhtiyaç</th>
                  <th class="text-right py-2 px-2">Stok</th>
                  <th class="text-right py-2 px-2">Eksik</th>
                  <th class="text-right py-2 px-2">Lead Time</th>
                  <th class="text-right py-2 px-2">Birim ₺</th>
                  <th class="text-right py-2 px-2">Eksik ₺</th>
                  <th class="text-left py-2 px-2">Tedarikçi</th>
                  <th class="text-center py-2 px-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                ${pkg.items.map(it => `
                  <tr class="border-b border-white/5 hover:bg-white/5 transition pa-item-row" data-pkg="${pkg.package_id}" data-status="${it.durum}" data-search="${(it.malzeme_no + ' ' + it.parca_tanimi + ' ' + it.tedarikci).toLowerCase()}">
                    <td class="py-2 px-2 text-white font-mono text-xs">${it.malzeme_no}</td>
                    <td class="py-2 px-2 text-white/80 text-xs max-w-[200px] truncate" title="${it.parca_tanimi}">${it.parca_tanimi}</td>
                    <td class="py-2 px-2 text-white/70 text-right">${this.fmtNum(it.bom_miktar, 2)}</td>
                    <td class="py-2 px-2 text-white text-right font-medium">${this.fmtNum(it.toplam_ihtiyac)}</td>
                    <td class="py-2 px-2 text-right ${it.stok > 0 ? 'text-green-400' : 'text-red-400'}">${this.fmtNum(it.stok)}</td>
                    <td class="py-2 px-2 text-right ${it.eksik > 0 ? 'text-red-400 font-bold' : 'text-green-400'}">${it.eksik > 0 ? this.fmtNum(it.eksik) : '-'}</td>
                    <td class="py-2 px-2 text-right ${it.lead_time >= 30 ? 'text-red-400' : it.lead_time > 0 ? 'text-orange-400' : 'text-white/40'}">${it.lead_time > 0 ? it.lead_time + 'g' : '-'}</td>
                    <td class="py-2 px-2 text-right text-white/70">${this.fmtCur(it.birim_maliyet)}</td>
                    <td class="py-2 px-2 text-right ${it.eksik_maliyet > 0 ? 'text-red-400' : 'text-white/40'}">${it.eksik_maliyet > 0 ? this.fmtCur(it.eksik_maliyet) : '-'}</td>
                    <td class="py-2 px-2 text-white/60 text-xs">${it.tedarikci}</td>
                    <td class="py-2 px-2 text-center">${this.statusBadge(it.durum)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Risk analysis section
    if (c.risk_analysis) {
      const ra = c.risk_analysis;
      html += `
        <div class="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
          <h3 class="text-lg font-semibold text-white mb-4"><i class="fas fa-shield-alt text-red-400 mr-2"></i>Risk Analizi</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${ra.critical_lead_time?.length ? `
              <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div class="text-red-400 font-medium text-sm mb-2"><i class="fas fa-clock mr-1"></i> Kritik Termin (≥30 gün) — ${ra.critical_lead_time.length} parça</div>
                ${ra.critical_lead_time.slice(0, 5).map(i => `
                  <div class="text-white/70 text-xs flex justify-between py-1 border-b border-white/5">
                    <span class="font-mono">${i.malzeme_no}</span>
                    <span class="text-red-400 font-bold">${i.lead_time} gün</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${ra.zero_stock?.length ? `
              <div class="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                <div class="text-orange-400 font-medium text-sm mb-2"><i class="fas fa-box-open mr-1"></i> Stokta Yok — ${ra.zero_stock.length} parça</div>
                ${ra.zero_stock.slice(0, 5).map(i => `
                  <div class="text-white/70 text-xs flex justify-between py-1 border-b border-white/5">
                    <span class="font-mono">${i.malzeme_no}</span>
                    <span class="text-orange-400">${this.fmtNum(i.eksik)} adet gerekli</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${ra.high_cost?.length ? `
              <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div class="text-yellow-400 font-medium text-sm mb-2"><i class="fas fa-coins mr-1"></i> Yüksek Maliyet — Top ${Math.min(5, ra.high_cost.length)}</div>
                ${ra.high_cost.slice(0, 5).map(i => `
                  <div class="text-white/70 text-xs flex justify-between py-1 border-b border-white/5">
                    <span class="font-mono">${i.malzeme_no}</span>
                    <span class="text-yellow-400">${this.fmtCur(i.eksik_maliyet)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${ra.single_supplier?.length ? `
              <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div class="text-blue-400 font-medium text-sm mb-2"><i class="fas fa-building mr-1"></i> Tek Tedarikçi Riski — ${ra.single_supplier.length} parça</div>
                ${ra.single_supplier.slice(0, 5).map(i => `
                  <div class="text-white/70 text-xs flex justify-between py-1 border-b border-white/5">
                    <span class="font-mono">${i.malzeme_no}</span>
                    <span class="text-blue-400">${i.tedarikci}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    // Supplier distribution
    if (c.supplier_distribution && Object.keys(c.supplier_distribution).length) {
      const entries = Object.entries(c.supplier_distribution).sort((a, b) => b[1] - a[1]);
      const maxVal = entries[0]?.[1] || 1;
      html += `
        <div class="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
          <h3 class="text-lg font-semibold text-white mb-4"><i class="fas fa-industry text-cyan-400 mr-2"></i>Tedarikçi Dağılımı</h3>
          <div class="space-y-2">
            ${entries.map(([sup, val]) => `
              <div class="flex items-center gap-3">
                <span class="text-white/70 text-sm w-40 truncate" title="${sup}">${sup}</span>
                <div class="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
                  <div class="bg-cyan-500/60 h-full rounded-full transition-all" style="width:${Math.round(val / maxVal * 100)}%"></div>
                </div>
                <span class="text-white/80 text-sm w-28 text-right">${this.fmtCur(val)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Scenario simulation
    if (c.scenarios?.length) {
      html += `
        <div class="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
          <h3 class="text-lg font-semibold text-white mb-4"><i class="fas fa-chart-line text-green-400 mr-2"></i>Senaryo Simülasyonu</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-white/60 text-xs uppercase border-b border-white/10">
                  <th class="text-left py-2 px-3">Üretim Adedi</th>
                  <th class="text-right py-2 px-3">Toplam Maliyet</th>
                  <th class="text-right py-2 px-3">Satın Alma (Eksik) Maliyeti</th>
                </tr>
              </thead>
              <tbody>
                ${c.scenarios.map(s => `
                  <tr class="border-b border-white/5 hover:bg-white/5">
                    <td class="py-2 px-3 text-white font-medium">${this.fmtNum(s.adet)} adet</td>
                    <td class="py-2 px-3 text-white/80 text-right">${this.fmtCur(s.toplam_maliyet)}</td>
                    <td class="py-2 px-3 text-red-400 text-right">${this.fmtCur(s.eksik_maliyet)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Pareto analysis (top 20)
    if (c.pareto?.length) {
      html += `
        <div class="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
          <h3 class="text-lg font-semibold text-white mb-4"><i class="fas fa-sort-amount-down text-amber-400 mr-2"></i>Pareto Analizi (Maliyet Yoğunluğu)</h3>
          <div class="space-y-1">
            ${c.pareto.slice(0, 20).map((p, i) => `
              <div class="flex items-center gap-3 py-1">
                <span class="text-white/40 text-xs w-6 text-right">${i + 1}.</span>
                <span class="text-white/80 text-xs w-28 font-mono truncate">${p.malzeme_no}</span>
                <div class="flex-1 bg-white/5 rounded-full h-4 overflow-hidden">
                  <div class="h-full rounded-full transition-all ${p.cumulative_percent <= 80 ? 'bg-amber-500/60' : 'bg-white/20'}" style="width:${p.cumulative_percent}%"></div>
                </div>
                <span class="text-white/60 text-xs w-20 text-right">${this.fmtCur(p.kalem_maliyet)}</span>
                <span class="text-amber-400 text-xs w-14 text-right font-medium">${p.cumulative_percent}%</span>
              </div>
            `).join('')}
          </div>
          <p class="text-white/30 text-xs mt-3">İlk %80'lik maliyet dilimi sarı ile gösterilir (80-20 kuralı).</p>
        </div>
      `;
    }

    // Export buttons
    html += `
      <div class="flex flex-wrap gap-3 mb-6">
        <button onclick="PaketAnaliz.exportExcel()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
          <i class="fas fa-file-excel"></i> Excel İndir
        </button>
        <button onclick="PaketAnaliz.exportWord()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
          <i class="fas fa-file-word"></i> Word İndir
        </button>
      </div>
    `;

    ct.innerHTML = html;
  },

  filterItems(search, pkgId) {
    const rows = document.querySelectorAll(`.pa-item-row[data-pkg="${pkgId}"]`);
    const s = search.toLowerCase();
    rows.forEach(r => { r.style.display = r.dataset.search.includes(s) ? '' : 'none'; });
  },

  filterItemsByStatus(status, pkgId) {
    const rows = document.querySelectorAll(`.pa-item-row[data-pkg="${pkgId}"]`);
    rows.forEach(r => { r.style.display = (status === 'all' || r.dataset.status === status) ? '' : 'none'; });
  },

  // ═══════════════════════════════════════════════════════════════════
  // ANA VERİ (Master Data) TAB
  // ═══════════════════════════════════════════════════════════════════
  async renderMasterTab(ct) {
    ct.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6" id="pa-master-stats"></div>

      <!-- Import Section -->
      <div class="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
        <h2 class="text-lg font-semibold text-white mb-3"><i class="fas fa-file-import text-green-400 mr-2"></i>Excel'den Veri Aktarımı</h2>
        <p class="text-white/50 text-xs mb-3">Excel'den kopyaladığınız veriyi aşağıya yapıştırın. İlk satır başlık olmalıdır. Kolonlar otomatik eşleştirilir.</p>
        <textarea id="pa-master-paste" rows="6" class="w-full bg-white/5 border border-white/20 rounded-lg p-3 text-white text-sm font-mono placeholder-white/30 resize-y"
          placeholder="Malzeme No&#9;Parça Tanımı&#9;Adet&#9;Stok&#9;Lead Time&#9;Maliyet&#9;Tedarikçi&#10;ABC-001&#9;Sensör XY&#9;2&#9;150&#9;14&#9;25.50&#9;Firma A"></textarea>
        <div id="pa-master-mapping" class="mt-3 hidden"></div>
        <div id="pa-master-preview" class="mt-3 hidden"></div>
        <div class="mt-3 flex gap-3">
          <button onclick="PaketAnaliz.parseMasterPaste()" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
            <i class="fas fa-search"></i> Önizle & Eşleştir
          </button>
          <button id="pa-master-import-btn" onclick="PaketAnaliz.executeMasterImport()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm flex items-center gap-2 hidden">
            <i class="fas fa-upload"></i> İçe Aktar
          </button>
        </div>
      </div>

      <!-- Material Table -->
      <div class="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-white"><i class="fas fa-list text-blue-400 mr-2"></i>Malzeme Listesi</h2>
          <div class="flex items-center gap-3">
            <input type="text" id="pa-master-search" placeholder="Ara..." class="bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/30 w-48"
              oninput="PaketAnaliz.searchMaterials()">
            <button onclick="PaketAnaliz.resetAllMaterials()" class="bg-red-600/30 hover:bg-red-600/50 text-red-400 px-3 py-1.5 rounded-lg text-xs transition" title="Tüm verileri sil">
              <i class="fas fa-trash"></i> Tümünü Sil
            </button>
          </div>
        </div>
        <div id="pa-material-table" class="overflow-x-auto"></div>
      </div>
    `;
    await this.loadMaterials();
    this.loadMasterStats();
  },

  async loadMasterStats() {
    try {
      const stats = await api.request('/paket-analiz/stats');
      this.stats = stats;
      const el = document.getElementById('pa-master-stats');
      if (el) {
        el.innerHTML = `
          <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center"><i class="fas fa-cubes text-blue-400"></i></div>
            <div><div class="text-white/50 text-xs">Toplam Malzeme</div><div class="text-white font-bold text-lg">${this.fmtNum(stats.material_count)}</div></div>
          </div>
          <div class="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-center gap-3">
            <div class="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center"><i class="fas fa-clock text-orange-400"></i></div>
            <div><div class="text-white/50 text-xs">Ort. Lead Time</div><div class="text-white font-bold text-lg">${stats.avg_lead_time} gün</div></div>
          </div>
          <div class="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
            <div class="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center"><i class="fas fa-coins text-green-400"></i></div>
            <div><div class="text-white/50 text-xs">Toplam Stok Değeri</div><div class="text-white font-bold text-lg">${this.fmtCur(stats.total_stock_value)}</div></div>
          </div>
        `;
      }
    } catch (e) {/* ignore */}
  },

  async loadMaterials(search) {
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      this.materials = await api.request('/paket-analiz/materials' + q);
      this.renderMaterialTable();
    } catch (e) { this.materials = []; }
  },

  searchMaterials() {
    const s = document.getElementById('pa-master-search')?.value || '';
    this.loadMaterials(s);
  },

  renderMaterialTable() {
    const el = document.getElementById('pa-material-table');
    if (!el) return;
    if (!this.materials.length) {
      el.innerHTML = '<div class="text-center py-8 text-white/40"><i class="fas fa-inbox text-3xl mb-2 block"></i>Henüz malzeme yok</div>';
      return;
    }
    el.innerHTML = `
      <table class="w-full text-sm">
        <thead>
          <tr class="text-white/60 text-xs uppercase border-b border-white/10">
            <th class="text-left py-2 px-2">Malzeme No</th>
            <th class="text-left py-2 px-2">Parça Tanımı</th>
            <th class="text-right py-2 px-2">B.Adet</th>
            <th class="text-right py-2 px-2">Stok</th>
            <th class="text-right py-2 px-2">Lead Time</th>
            <th class="text-right py-2 px-2">Birim ₺</th>
            <th class="text-left py-2 px-2">Tedarikçi</th>
            <th class="text-center py-2 px-2">İşlem</th>
          </tr>
        </thead>
        <tbody>
          ${this.materials.map(m => `
            <tr class="border-b border-white/5 hover:bg-white/5 transition" id="pa-mat-row-${m.id}">
              <td class="py-2 px-2 text-white font-mono text-xs">${m.malzeme_no}</td>
              <td class="py-2 px-2 text-white/80 text-xs">${m.parca_tanimi || '-'}</td>
              <td class="py-2 px-2 text-white/70 text-right">${this.fmtNum(m.birim_adet, 1)}</td>
              <td class="py-2 px-2 text-right ${parseFloat(m.stok) > 0 ? 'text-green-400' : 'text-red-400'}">${this.fmtNum(m.stok)}</td>
              <td class="py-2 px-2 text-right ${parseInt(m.lead_time_gun) >= 30 ? 'text-red-400' : 'text-orange-400'}">${m.lead_time_gun}g</td>
              <td class="py-2 px-2 text-white/70 text-right">${this.fmtCur(m.birim_maliyet)}</td>
              <td class="py-2 px-2 text-white/60 text-xs">${m.tedarikci || '-'}</td>
              <td class="py-2 px-2 text-center">
                <button onclick="PaketAnaliz.editMaterial(${m.id})" class="text-blue-400 hover:text-blue-300 mr-2" title="Düzenle"><i class="fas fa-edit"></i></button>
                <button onclick="PaketAnaliz.deleteMaterial(${m.id})" class="text-red-400 hover:text-red-300" title="Sil"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="text-white/40 text-xs mt-2">${this.materials.length} malzeme</div>
    `;
  },

  parseMasterPaste() {
    const text = document.getElementById('pa-master-paste')?.value;
    const parsed = this.parsePaste(text);
    if (!parsed) { alert('Yapıştırılan veri geçersiz. En az 2 satır (başlık + veri) olmalı.'); return; }

    this.masterParsed = parsed;
    const mapping = this.autoMap(parsed.headers, MASTER_HINTS);

    const mapEl = document.getElementById('pa-master-mapping');
    if (mapEl) {
      const fields = [
        { key: 'malzeme_no', label: 'Malzeme No *' },
        { key: 'parca_tanimi', label: 'Parça Tanımı' },
        { key: 'birim_adet', label: 'Birim Adet' },
        { key: 'stok', label: 'Stok' },
        { key: 'lead_time_gun', label: 'Lead Time (gün)' },
        { key: 'birim_maliyet', label: 'Birim Maliyet' },
        { key: 'tedarikci', label: 'Tedarikçi' }
      ];
      mapEl.innerHTML = `
        <div class="text-white/70 text-sm font-medium mb-2">Kolon Eşleştirme:</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          ${fields.map(f => `
            <div>
              <label class="text-white/50 text-xs">${f.label}</label>
              <select id="pa-map-${f.key}" class="w-full bg-gray-800 border border-white/20 rounded px-2 py-1 text-white text-xs mt-1" style="color-scheme:dark">
                <option value="">— Seçilmedi —</option>
                ${parsed.headers.map((h, i) => `<option value="${i}" ${mapping[f.key] === i ? 'selected' : ''}>${h}</option>`).join('')}
              </select>
            </div>
          `).join('')}
        </div>
      `;
      mapEl.classList.remove('hidden');
    }

    // Preview first 5 rows + delimiter info
    const prevEl = document.getElementById('pa-master-preview');
    if (prevEl) {
      const colMismatch = parsed.rows.some(r => r.length !== parsed.headers.length);
      prevEl.innerHTML = `
        <div class="flex items-center gap-3 mb-2">
          <span class="text-white/70 text-sm font-medium">Önizleme (ilk 5 satır, toplam ${parsed.rows.length}):</span>
          <span class="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">Ayırıcı: ${parsed.delimiterName}</span>
          <span class="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs">${parsed.headers.length} sütun</span>
          ${colMismatch ? '<span class="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs"><i class="fas fa-exclamation-triangle mr-1"></i>Bazı satırlarda sütun sayısı uyuşmuyor!</span>' : '<span class="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs"><i class="fas fa-check mr-1"></i>OK</span>'}
        </div>
        ${colMismatch ? `
          <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 mb-2 text-yellow-300 text-xs">
            <i class="fas fa-exclamation-circle mr-1"></i> Sütunlar düzgün ayrılmamış olabilir. Farklı bir ayırıcı deneyin:
            <button onclick="PaketAnaliz.reParseMaster('\\t')" class="ml-2 underline hover:text-yellow-200">Tab</button> |
            <button onclick="PaketAnaliz.reParseMaster(';')" class="underline hover:text-yellow-200">Noktalı virgül</button> |
            <button onclick="PaketAnaliz.reParseMaster(',')" class="underline hover:text-yellow-200">Virgül</button>
          </div>
        ` : ''}
        <div class="overflow-x-auto">
          <table class="w-full text-xs border border-white/10">
            <thead><tr class="bg-white/5">${parsed.headers.map((h, i) => `<th class="py-1.5 px-2 text-left text-blue-400 border border-white/10"><span class="text-white/30 mr-1">[${i}]</span>${h}</th>`).join('')}</tr></thead>
            <tbody>${parsed.rows.slice(0, 5).map(r => `<tr class="border-b border-white/5">${r.map(c => `<td class="py-1 px-2 text-white/70 border border-white/5 font-mono">${c}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      `;
      prevEl.classList.remove('hidden');
    }

    document.getElementById('pa-master-import-btn')?.classList.remove('hidden');
  },

  reParseMaster(delimiter) {
    const text = document.getElementById('pa-master-paste')?.value;
    const parsed = this.parsePaste(text, delimiter);
    if (!parsed) return;
    this.masterParsed = parsed;
    const mapping = this.autoMap(parsed.headers, MASTER_HINTS);
    // Re-render mapping selects
    const fields = [
      { key: 'malzeme_no', label: 'Malzeme No *' },
      { key: 'parca_tanimi', label: 'Parça Tanımı' },
      { key: 'birim_adet', label: 'Birim Adet' },
      { key: 'stok', label: 'Stok' },
      { key: 'lead_time_gun', label: 'Lead Time (gün)' },
      { key: 'birim_maliyet', label: 'Birim Maliyet' },
      { key: 'tedarikci', label: 'Tedarikçi' }
    ];
    const mapEl = document.getElementById('pa-master-mapping');
    if (mapEl) {
      mapEl.innerHTML = `
        <div class="text-white/70 text-sm font-medium mb-2">Kolon Eşleştirme:</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          ${fields.map(f => `
            <div>
              <label class="text-white/50 text-xs">${f.label}</label>
              <select id="pa-map-${f.key}" class="w-full bg-gray-800 border border-white/20 rounded px-2 py-1 text-white text-xs mt-1" style="color-scheme:dark">
                <option value="">— Seçilmedi —</option>
                ${parsed.headers.map((h, i) => `<option value="${i}" ${mapping[f.key] === i ? 'selected' : ''}>${h}</option>`).join('')}
              </select>
            </div>
          `).join('')}
        </div>
      `;
    }
    // Re-render preview
    const colMismatch = parsed.rows.some(r => r.length !== parsed.headers.length);
    const prevEl = document.getElementById('pa-master-preview');
    if (prevEl) {
      prevEl.innerHTML = `
        <div class="flex items-center gap-3 mb-2">
          <span class="text-white/70 text-sm font-medium">Önizleme (ilk 5 satır, toplam ${parsed.rows.length}):</span>
          <span class="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">Ayırıcı: ${parsed.delimiterName}</span>
          <span class="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs">${parsed.headers.length} sütun</span>
          ${colMismatch ? '<span class="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs"><i class="fas fa-exclamation-triangle mr-1"></i>Sütun uyuşmazlığı!</span>' : '<span class="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs"><i class="fas fa-check mr-1"></i>OK</span>'}
        </div>
        ${colMismatch ? `
          <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 mb-2 text-yellow-300 text-xs">
            <i class="fas fa-exclamation-circle mr-1"></i> Farklı ayırıcı deneyin:
            <button onclick="PaketAnaliz.reParseMaster('\\t')" class="ml-2 underline hover:text-yellow-200">Tab</button> |
            <button onclick="PaketAnaliz.reParseMaster(';')" class="underline hover:text-yellow-200">Noktalı virgül</button> |
            <button onclick="PaketAnaliz.reParseMaster(',')" class="underline hover:text-yellow-200">Virgül</button>
          </div>
        ` : ''}
        <div class="overflow-x-auto">
          <table class="w-full text-xs border border-white/10">
            <thead><tr class="bg-white/5">${parsed.headers.map((h, i) => `<th class="py-1.5 px-2 text-left text-blue-400 border border-white/10"><span class="text-white/30 mr-1">[${i}]</span>${h}</th>`).join('')}</tr></thead>
            <tbody>${parsed.rows.slice(0, 5).map(r => `<tr class="border-b border-white/5">${r.map(c => `<td class="py-1 px-2 text-white/70 border border-white/5 font-mono">${c}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      `;
    }
  },

  async executeMasterImport() {
    if (!this.masterParsed) return;

    const mapping = {};
    ['malzeme_no', 'parca_tanimi', 'birim_adet', 'stok', 'lead_time_gun', 'birim_maliyet', 'tedarikci'].forEach(key => {
      const val = document.getElementById(`pa-map-${key}`)?.value;
      if (val !== '' && val !== undefined) mapping[key] = parseInt(val);
    });

    if (mapping.malzeme_no === undefined) { alert('Malzeme No kolonu seçilmeli!'); return; }

    const btn = document.getElementById('pa-master-import-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aktarılıyor...'; }

    try {
      const result = await api.request('/paket-analiz/materials/import-paste', {
        method: 'POST',
        body: JSON.stringify({ rows: this.masterParsed.rows, mapping })
      });
      alert(`Tamamlandı! ${result.inserted || 0} eklendi, ${result.updated || 0} güncellendi.${result.errors?.length ? '\nHatalar: ' + result.errors.join(', ') : ''}`);
      this.masterParsed = null;
      document.getElementById('pa-master-paste').value = '';
      document.getElementById('pa-master-mapping')?.classList.add('hidden');
      document.getElementById('pa-master-preview')?.classList.add('hidden');
      btn?.classList.add('hidden');
      this.loadMaterials();
      this.loadMasterStats();
      this.loadStatsHeader();
    } catch (error) {
      alert('Hata: ' + (error.message || error));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload"></i> İçe Aktar'; }
    }
  },

  editMaterial(id) {
    const m = this.materials.find(x => x.id === id);
    if (!m) return;
    const row = document.getElementById(`pa-mat-row-${id}`);
    if (!row) return;
    row.innerHTML = `
      <td class="py-1 px-2 text-white font-mono text-xs">${m.malzeme_no}</td>
      <td class="py-1 px-1"><input type="text" value="${m.parca_tanimi || ''}" class="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs w-full" id="pa-edit-tanim-${id}"></td>
      <td class="py-1 px-1"><input type="number" value="${m.birim_adet}" class="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs w-16 text-right" id="pa-edit-badet-${id}"></td>
      <td class="py-1 px-1"><input type="number" value="${m.stok}" class="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs w-20 text-right" id="pa-edit-stok-${id}"></td>
      <td class="py-1 px-1"><input type="number" value="${m.lead_time_gun}" class="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs w-16 text-right" id="pa-edit-lt-${id}"></td>
      <td class="py-1 px-1"><input type="number" step="0.01" value="${m.birim_maliyet}" class="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs w-20 text-right" id="pa-edit-mal-${id}"></td>
      <td class="py-1 px-1"><input type="text" value="${m.tedarikci || ''}" class="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs w-full" id="pa-edit-ted-${id}"></td>
      <td class="py-1 px-2 text-center">
        <button onclick="PaketAnaliz.saveMaterial(${id})" class="text-green-400 hover:text-green-300 mr-2"><i class="fas fa-check"></i></button>
        <button onclick="PaketAnaliz.renderMaterialTable()" class="text-white/40 hover:text-white/60"><i class="fas fa-times"></i></button>
      </td>
    `;
  },

  async saveMaterial(id) {
    try {
      await api.request(`/paket-analiz/materials/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          parca_tanimi: document.getElementById(`pa-edit-tanim-${id}`)?.value || '',
          birim_adet: parseFloat(document.getElementById(`pa-edit-badet-${id}`)?.value) || 1,
          stok: parseFloat(document.getElementById(`pa-edit-stok-${id}`)?.value) || 0,
          lead_time_gun: parseInt(document.getElementById(`pa-edit-lt-${id}`)?.value) || 0,
          birim_maliyet: parseFloat(document.getElementById(`pa-edit-mal-${id}`)?.value) || 0,
          tedarikci: document.getElementById(`pa-edit-ted-${id}`)?.value || ''
        })
      });
      this.loadMaterials();
    } catch (e) { alert('Güncelleme hatası'); }
  },

  async deleteMaterial(id) {
    if (!confirm('Bu malzemeyi silmek istediğinize emin misiniz?')) return;
    try {
      await api.request(`/paket-analiz/materials/${id}`, { method: 'DELETE' });
      this.loadMaterials();
      this.loadMasterStats();
    } catch (e) { alert('Silme hatası'); }
  },

  async resetAllMaterials() {
    if (!confirm('TÜM malzeme verilerini silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
    try {
      await api.request('/paket-analiz/materials', { method: 'DELETE' });
      this.loadMaterials();
      this.loadMasterStats();
      this.loadStatsHeader();
    } catch (e) { alert('Silme hatası'); }
  },

  // ═══════════════════════════════════════════════════════════════════
  // BOM YÖNETİMİ TAB
  // ═══════════════════════════════════════════════════════════════════
  async renderBomTab(ct) {
    await this.ensurePackages();
    ct.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Sol: Paket Listesi -->
        <div class="lg:col-span-1">
          <div class="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-white"><i class="fas fa-box text-purple-400 mr-2"></i>Paketler</h2>
              <button onclick="PaketAnaliz.showCreatePackage()" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs transition">
                <i class="fas fa-plus"></i> Yeni
              </button>
            </div>
            <div id="pa-package-list">
              ${this.packages.length === 0 ? '<div class="text-center py-6 text-white/40 text-sm">Henüz paket yok</div>' :
                this.packages.map(p => `
                  <div class="p-3 rounded-lg mb-2 cursor-pointer transition border ${this.selectedPkgId === p.id ? 'bg-purple-500/20 border-purple-500/40' : 'bg-white/5 border-white/10 hover:bg-white/10'}"
                    onclick="PaketAnaliz.selectPackage(${p.id})">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="text-white font-medium text-sm">${p.paket_adi}</div>
                        <div class="text-white/40 text-xs">${p.item_count} kalem${p.aciklama ? ' • ' + p.aciklama : ''}</div>
                      </div>
                      <div class="flex gap-1">
                        <button onclick="event.stopPropagation(); PaketAnaliz.editPackage(${p.id})" class="text-blue-400 hover:text-blue-300 text-xs p-1"><i class="fas fa-edit"></i></button>
                        <button onclick="event.stopPropagation(); PaketAnaliz.deletePackage(${p.id})" class="text-red-400 hover:text-red-300 text-xs p-1"><i class="fas fa-trash"></i></button>
                      </div>
                    </div>
                  </div>
                `).join('')
              }
            </div>
            <div id="pa-create-pkg-form" class="hidden mt-3"></div>
          </div>
        </div>

        <!-- Sağ: Seçili Paket Detay -->
        <div class="lg:col-span-2">
          <div class="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6" id="pa-pkg-detail">
            ${this.selectedPkgId ? '<div class="text-center text-white/40 py-8"><i class="fas fa-spinner fa-spin text-2xl"></i></div>' :
              '<div class="text-center py-12 text-white/40"><i class="fas fa-hand-pointer text-4xl mb-3 block text-purple-400/30"></i><p>Bir paket seçin veya yeni paket oluşturun.</p></div>'}
          </div>
        </div>
      </div>
    `;
    if (this.selectedPkgId) this.loadPackageItems(this.selectedPkgId);
  },

  showCreatePackage() {
    const el = document.getElementById('pa-create-pkg-form');
    if (!el) return;
    el.classList.remove('hidden');
    el.innerHTML = `
      <div class="bg-white/5 rounded-lg p-3 border border-white/10">
        <input type="text" id="pa-new-pkg-name" placeholder="Paket adı" class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 mb-2">
        <input type="text" id="pa-new-pkg-desc" placeholder="Açıklama (opsiyonel)" class="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 mb-2">
        <div class="flex gap-2">
          <button onclick="PaketAnaliz.createPackage()" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs transition flex-1">Oluştur</button>
          <button onclick="document.getElementById('pa-create-pkg-form').classList.add('hidden')" class="bg-white/10 hover:bg-white/20 text-white/60 px-3 py-1.5 rounded-lg text-xs transition">İptal</button>
        </div>
      </div>
    `;
    document.getElementById('pa-new-pkg-name')?.focus();
  },

  async createPackage() {
    const name = document.getElementById('pa-new-pkg-name')?.value?.trim();
    const desc = document.getElementById('pa-new-pkg-desc')?.value?.trim();
    if (!name) { alert('Paket adı zorunlu'); return; }
    try {
      const pkg = await api.request('/paket-analiz/bom-packages', { method: 'POST', body: JSON.stringify({ paket_adi: name, aciklama: desc }) });
      this.packages = await api.request('/paket-analiz/bom-packages');
      this.selectedPkgId = pkg.id;
      this.renderBomTab(document.getElementById('pa-tab-content'));
    } catch (e) { alert('Hata: ' + (e.message || e)); }
  },

  async editPackage(id) {
    const pkg = this.packages.find(p => p.id === id);
    if (!pkg) return;
    const name = prompt('Paket adı:', pkg.paket_adi);
    if (!name?.trim()) return;
    const desc = prompt('Açıklama:', pkg.aciklama || '');
    try {
      await api.request(`/paket-analiz/bom-packages/${id}`, { method: 'PUT', body: JSON.stringify({ paket_adi: name.trim(), aciklama: desc || '' }) });
      this.packages = await api.request('/paket-analiz/bom-packages');
      this.renderBomTab(document.getElementById('pa-tab-content'));
    } catch (e) { alert('Hata'); }
  },

  async deletePackage(id) {
    if (!confirm('Bu paketi ve tüm BOM kalemlerini silmek istediğinize emin misiniz?')) return;
    try {
      await api.request(`/paket-analiz/bom-packages/${id}`, { method: 'DELETE' });
      if (this.selectedPkgId === id) this.selectedPkgId = null;
      this.packages = await api.request('/paket-analiz/bom-packages');
      this.renderBomTab(document.getElementById('pa-tab-content'));
      this.loadStatsHeader();
    } catch (e) { alert('Hata'); }
  },

  async selectPackage(id) {
    this.selectedPkgId = id;
    // Highlight
    document.querySelectorAll('#pa-package-list > div').forEach(d => {
      d.className = d.className.replace(/bg-purple-500\/20 border-purple-500\/40|bg-white\/5 border-white\/10/g, '');
    });
    this.renderBomTab(document.getElementById('pa-tab-content'));
    await this.loadPackageItems(id);
  },

  async loadPackageItems(pkgId) {
    const detail = document.getElementById('pa-pkg-detail');
    if (!detail) return;
    const pkg = this.packages.find(p => p.id === pkgId);
    if (!pkg) return;

    try {
      this.pkgItems = await api.request(`/paket-analiz/bom-packages/${pkgId}/items`);
    } catch (e) { this.pkgItems = []; }

    detail.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-white"><i class="fas fa-list-ol text-green-400 mr-2"></i>${pkg.paket_adi} — BOM Kalemleri</h2>
        <span class="text-white/40 text-sm">${this.pkgItems.length} kalem</span>
      </div>

      <!-- BOM Import -->
      <div class="bg-white/5 rounded-lg p-4 border border-white/10 mb-4">
        <div class="text-white/70 text-sm mb-2"><i class="fas fa-paste text-blue-400 mr-1"></i> BOM Verisi Yapıştır (Malzeme No + Miktar)</div>
        <textarea id="pa-bom-paste" rows="4" class="w-full bg-white/5 border border-white/20 rounded-lg p-2 text-white text-xs font-mono placeholder-white/30 resize-y"
          placeholder="Malzeme No&#9;Miktar&#10;ABC-001&#9;2&#10;ABC-002&#9;5"></textarea>
        <div id="pa-bom-mapping" class="mt-2 hidden"></div>
        <div class="mt-2 flex gap-2">
          <button onclick="PaketAnaliz.parseBomPaste()" class="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs transition">
            <i class="fas fa-search"></i> Önizle
          </button>
          <button id="pa-bom-import-btn" onclick="PaketAnaliz.executeBomImport()" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs transition hidden">
            <i class="fas fa-upload"></i> İçe Aktar (Mevcut kalemleri siler)
          </button>
        </div>
      </div>

      <!-- Add single item -->
      <div class="flex gap-2 mb-4">
        <input type="text" id="pa-bom-new-malz" placeholder="Malzeme No" class="bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/30 flex-1">
        <input type="number" id="pa-bom-new-qty" placeholder="Miktar" value="1" min="0.01" step="0.01" class="bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/30 w-24">
        <button onclick="PaketAnaliz.addBomItem()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition"><i class="fas fa-plus"></i></button>
      </div>

      <!-- Items table -->
      <div class="overflow-x-auto">
        ${this.pkgItems.length === 0 ? '<div class="text-center py-6 text-white/40 text-sm">Bu pakette henüz BOM kalemi yok</div>' : `
          <table class="w-full text-sm">
            <thead>
              <tr class="text-white/60 text-xs uppercase border-b border-white/10">
                <th class="text-left py-2 px-2">Malzeme No</th>
                <th class="text-left py-2 px-2">Parça Tanımı</th>
                <th class="text-right py-2 px-2">Miktar</th>
                <th class="text-right py-2 px-2">Stok</th>
                <th class="text-right py-2 px-2">Lead Time</th>
                <th class="text-right py-2 px-2">Birim ₺</th>
                <th class="text-left py-2 px-2">Tedarikçi</th>
                <th class="text-center py-2 px-2">Durum</th>
                <th class="text-center py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              ${this.pkgItems.map(it => {
                const hasMaster = it.parca_tanimi !== null && it.parca_tanimi !== undefined;
                return `
                  <tr class="border-b border-white/5 hover:bg-white/5 transition">
                    <td class="py-2 px-2 text-white font-mono text-xs">${it.malzeme_no}</td>
                    <td class="py-2 px-2 text-xs ${hasMaster ? 'text-white/80' : 'text-yellow-400'}">${hasMaster ? it.parca_tanimi : '⚠️ Master\'da yok'}</td>
                    <td class="py-2 px-2 text-white text-right font-medium">${this.fmtNum(it.miktar, 2)}</td>
                    <td class="py-2 px-2 text-right ${hasMaster ? (parseFloat(it.stok) > 0 ? 'text-green-400' : 'text-red-400') : 'text-white/30'}">${hasMaster ? this.fmtNum(it.stok) : '-'}</td>
                    <td class="py-2 px-2 text-right text-orange-400">${hasMaster ? (it.lead_time_gun || 0) + 'g' : '-'}</td>
                    <td class="py-2 px-2 text-right text-white/70">${hasMaster ? this.fmtCur(it.birim_maliyet) : '-'}</td>
                    <td class="py-2 px-2 text-white/60 text-xs">${hasMaster ? (it.tedarikci || '-') : '-'}</td>
                    <td class="py-2 px-2 text-center">${hasMaster ? '<span class="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs">OK</span>' : '<span class="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-xs">?</span>'}</td>
                    <td class="py-2 px-2 text-center">
                      <button onclick="PaketAnaliz.deleteBomItem(${it.id})" class="text-red-400 hover:text-red-300 text-xs"><i class="fas fa-trash"></i></button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  parseBomPaste() {
    const text = document.getElementById('pa-bom-paste')?.value;
    const parsed = this.parsePaste(text);
    if (!parsed) { alert('Geçersiz veri. En az 2 satır olmalı.'); return; }

    this.bomParsed = parsed;
    const mapping = this.autoMap(parsed.headers, BOM_HINTS);

    const mapEl = document.getElementById('pa-bom-mapping');
    if (mapEl) {
      const noMiktar = mapping.miktar === undefined;
      const fields = [{ key: 'malzeme_no', label: 'Malzeme No *' }, { key: 'miktar', label: 'Miktar *' }];
      mapEl.innerHTML = `
        ${noMiktar ? `
          <div class="bg-red-500/20 border border-red-500/40 rounded-lg p-3 mb-3 text-red-300 text-sm">
            <i class="fas fa-exclamation-triangle mr-2"></i><b>DİKKAT:</b> Miktar kolonu otomatik algılanamadı!
            <span class="text-red-300/70 text-xs block mt-1">Miktar kolonunu aşağıdan seçmezseniz tüm kalemler <b>1 adet</b> olarak aktarılır. Lütfen doğru kolonu seçin.</span>
          </div>
        ` : ''}
        <div class="grid grid-cols-2 gap-2">
          ${fields.map(f => `
            <div>
              <label class="text-white/50 text-xs">${f.label}</label>
              <select id="pa-bom-map-${f.key}" class="w-full bg-gray-800 border ${f.key === 'miktar' && noMiktar ? 'border-red-500' : 'border-white/20'} rounded px-2 py-1 text-white text-xs mt-1" style="color-scheme:dark"
                onchange="PaketAnaliz.updateBomPreview()">
                <option value="">— Seçilmedi —</option>
                ${parsed.headers.map((h, i) => `<option value="${i}" ${mapping[f.key] === i ? 'selected' : ''}>${h}</option>`).join('')}
              </select>
            </div>
          `).join('')}
        </div>
        <div class="flex items-center gap-2 mt-2">
          <span class="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">Ayırıcı: ${parsed.delimiterName}</span>
          <span class="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs">${parsed.headers.length} sütun / ${parsed.rows.length} satır</span>
        </div>
      `;
      mapEl.classList.remove('hidden');
    }
    this.updateBomPreview();
    document.getElementById('pa-bom-import-btn')?.classList.remove('hidden');
  },

  updateBomPreview() {
    if (!this.bomParsed) return;
    const malzIdx = parseInt(document.getElementById('pa-bom-map-malzeme_no')?.value);
    const miktIdx = parseInt(document.getElementById('pa-bom-map-miktar')?.value);
    const parsed = this.bomParsed;

    // Show preview with mapped values
    let prevContainer = document.getElementById('pa-bom-preview');
    if (!prevContainer) {
      const mapEl = document.getElementById('pa-bom-mapping');
      if (mapEl) {
        const div = document.createElement('div');
        div.id = 'pa-bom-preview';
        div.className = 'mt-3';
        mapEl.after(div);
        prevContainer = div;
      }
    }
    if (!prevContainer) return;

    const hasM = !isNaN(malzIdx);
    const hasQ = !isNaN(miktIdx);

    prevContainer.innerHTML = `
      <div class="text-white/70 text-xs font-medium mb-1">Önizleme — Aktarılacak değerler (ilk 10):</div>
      ${!hasQ ? '<div class="bg-yellow-500/20 border border-yellow-500/40 rounded p-2 mb-2 text-yellow-300 text-xs"><i class="fas fa-exclamation-circle mr-1"></i> Miktar kolonu seçilmedi — tüm satırlar <b>1</b> olarak aktarılacak!</div>' : ''}
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-white/10">
          <thead><tr class="bg-white/5">
            <th class="py-1.5 px-2 text-left text-blue-400 border border-white/10 w-8">#</th>
            <th class="py-1.5 px-2 text-left text-blue-400 border border-white/10">Malzeme No</th>
            <th class="py-1.5 px-2 text-right text-blue-400 border border-white/10">Miktar</th>
          </tr></thead>
          <tbody>${parsed.rows.slice(0, 10).map((r, idx) => {
            const malz = hasM ? r[malzIdx] || '—' : '?';
            const qty = hasQ ? r[miktIdx] || '1' : '1';
            const qtyNum = parseFloat(String(qty).replace(',', '.')) || 1;
            return `<tr class="border-b border-white/5">
              <td class="py-1 px-2 text-white/30 border border-white/5">${idx + 1}</td>
              <td class="py-1 px-2 text-white font-mono border border-white/5">${malz}</td>
              <td class="py-1 px-2 text-right font-mono border border-white/5 ${!hasQ ? 'text-yellow-400' : qtyNum > 1 ? 'text-green-400 font-bold' : 'text-white/70'}">${qtyNum}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      ${parsed.rows.length > 10 ? `<div class="text-white/30 text-xs mt-1">... ve ${parsed.rows.length - 10} satır daha</div>` : ''}
    `;
  },

  async executeBomImport() {
    if (!this.bomParsed || !this.selectedPkgId) return;

    const mapping = {};
    ['malzeme_no', 'miktar'].forEach(key => {
      const val = document.getElementById(`pa-bom-map-${key}`)?.value;
      if (val !== '' && val !== undefined) mapping[key] = parseInt(val);
    });
    if (mapping.malzeme_no === undefined) { alert('Malzeme No kolonu seçilmeli!'); return; }

    // Miktar kolonu seçilmediyse uyar
    if (mapping.miktar === undefined) {
      if (!confirm('⚠️ Miktar kolonu seçilmedi!\n\nTüm kalemler 1 adet olarak aktarılacak.\nDevam etmek istiyor musunuz?')) return;
    }

    const btn = document.getElementById('pa-bom-import-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aktarılıyor...'; }

    try {
      const result = await api.request(`/paket-analiz/bom-packages/${this.selectedPkgId}/items/import-paste`, {
        method: 'POST',
        body: JSON.stringify({ rows: this.bomParsed.rows, mapping })
      });
      alert(`${result.imported} kalem aktarıldı.${result.warnings?.length ? '\nUyarılar: ' + result.warnings.join(', ') : ''}`);
      this.bomParsed = null;
      document.getElementById('pa-bom-paste').value = '';
      document.getElementById('pa-bom-mapping')?.classList.add('hidden');
      btn?.classList.add('hidden');
      this.packages = await api.request('/paket-analiz/bom-packages');
      this.loadPackageItems(this.selectedPkgId);
      this.loadStatsHeader();
    } catch (error) {
      alert('Hata: ' + (error.message || error));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload"></i> İçe Aktar (Mevcut kalemleri siler)'; }
    }
  },

  async addBomItem() {
    if (!this.selectedPkgId) return;
    const malz = document.getElementById('pa-bom-new-malz')?.value?.trim();
    const qty = parseFloat(document.getElementById('pa-bom-new-qty')?.value) || 1;
    if (!malz) { alert('Malzeme No girin'); return; }
    try {
      await api.request(`/paket-analiz/bom-packages/${this.selectedPkgId}/items`, {
        method: 'POST',
        body: JSON.stringify({ malzeme_no: malz, miktar: qty })
      });
      document.getElementById('pa-bom-new-malz').value = '';
      document.getElementById('pa-bom-new-qty').value = '1';
      this.packages = await api.request('/paket-analiz/bom-packages');
      this.loadPackageItems(this.selectedPkgId);
    } catch (e) { alert('Hata'); }
  },

  async deleteBomItem(id) {
    if (!confirm('Bu kalemi silmek istiyor musunuz?')) return;
    try {
      await api.request(`/paket-analiz/bom-items/${id}`, { method: 'DELETE' });
      this.packages = await api.request('/paket-analiz/bom-packages');
      this.loadPackageItems(this.selectedPkgId);
    } catch (e) { alert('Silme hatası'); }
  },

  // ═══════════════════════════════════════════════════════════════════
  // RAPORLAR TAB
  // ═══════════════════════════════════════════════════════════════════
  renderReportsTab(ct) {
    const hasResult = !!this.analysisResult;
    ct.innerHTML = `
      <div class="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
        <h2 class="text-lg font-semibold text-white mb-4"><i class="fas fa-file-export text-blue-400 mr-2"></i>Rapor & Dışa Aktarım</h2>
        ${!hasResult ? `
          <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-300 text-sm">
            <i class="fas fa-info-circle mr-2"></i> Rapor oluşturmak için önce <b>"Analiz"</b> sekmesinden bir analiz çalıştırın.
          </div>
        ` : `
          <p class="text-white/50 text-sm mb-4">Son analiz sonuçlarını farklı formatlarda dışa aktarabilirsiniz.</p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onclick="PaketAnaliz.exportExcel()" class="bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl p-6 text-center transition group">
              <i class="fas fa-file-excel text-green-400 text-3xl mb-3 block group-hover:scale-110 transition"></i>
              <div class="text-white font-medium">Excel İndir</div>
              <div class="text-white/40 text-xs mt-1">Detaylı tablo formatında</div>
            </button>
            <button onclick="PaketAnaliz.exportWord()" class="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl p-6 text-center transition group">
              <i class="fas fa-file-word text-blue-400 text-3xl mb-3 block group-hover:scale-110 transition"></i>
              <div class="text-white font-medium">Word İndir</div>
              <div class="text-white/40 text-xs mt-1">Yönetici özet raporu</div>
            </button>
            <button onclick="PaketAnaliz.exportSummaryText()" class="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl p-6 text-center transition group">
              <i class="fas fa-clipboard-list text-purple-400 text-3xl mb-3 block group-hover:scale-110 transition"></i>
              <div class="text-white font-medium">Özet Kopyala</div>
              <div class="text-white/40 text-xs mt-1">Panoya kopyala</div>
            </button>
          </div>

          <!-- Quick summary -->
          <div class="mt-6 bg-white/5 rounded-lg p-4 border border-white/10">
            <h3 class="text-white font-medium text-sm mb-3">Analiz Özeti</h3>
            ${this.analysisResult.packages.map(pkg => `
              <div class="mb-3 p-3 bg-white/5 rounded-lg">
                <div class="text-white font-medium text-sm">${pkg.paket_adi} × ${this.fmtNum(pkg.adet)}</div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                  <div><span class="text-white/40">Birim Maliyet:</span> <span class="text-white">${this.fmtCur(pkg.birim_maliyet)}</span></div>
                  <div><span class="text-white/40">Toplam:</span> <span class="text-white">${this.fmtCur(pkg.toplam_maliyet)}</span></div>
                  <div><span class="text-white/40">Eksik:</span> <span class="text-red-400">${pkg.eksik_kalem_sayisi} kalem</span></div>
                  <div><span class="text-white/40">Max Lead:</span> <span class="text-orange-400">${pkg.max_lead_time} gün</span></div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  // ─── Export Functions ─────────────────────────────────────────────
  exportExcel() {
    if (!this.analysisResult) return;
    const data = this.analysisResult;
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>td,th{border:1px solid #ccc;padding:4px 8px;font-size:11px;font-family:Arial}th{background:#4472C4;color:white;font-weight:bold}.right{text-align:right}.red{color:#c00}.green{color:#0a0}.header{background:#D9E2F3;font-weight:bold;font-size:13px}</style></head><body>';

    for (const pkg of data.packages) {
      html += `<table><tr><td colspan="11" class="header">${pkg.paket_adi} — ${this.fmtNum(pkg.adet)} Adet Üretim Analizi</td></tr>`;
      html += `<tr><td colspan="5">Birim Maliyet: ${this.fmtCur(pkg.birim_maliyet)}</td><td colspan="3">Toplam Maliyet: ${this.fmtCur(pkg.toplam_maliyet)}</td><td colspan="3">Eksik Kalem: ${pkg.eksik_kalem_sayisi} | Max Lead: ${pkg.max_lead_time}g</td></tr>`;
      html += '<tr><th>Malzeme No</th><th>Parça Tanımı</th><th>BOM Miktar</th><th>Toplam İhtiyaç</th><th>Stok</th><th>Eksik</th><th>Lead Time</th><th>Birim ₺</th><th>Eksik ₺</th><th>Tedarikçi</th><th>Durum</th></tr>';
      for (const it of pkg.items) {
        html += `<tr>
          <td>${it.malzeme_no}</td>
          <td>${it.parca_tanimi}</td>
          <td class="right">${it.bom_miktar}</td>
          <td class="right">${it.toplam_ihtiyac}</td>
          <td class="right ${it.stok > 0 ? 'green' : 'red'}">${it.stok}</td>
          <td class="right ${it.eksik > 0 ? 'red' : ''}">${it.eksik || '-'}</td>
          <td class="right">${it.lead_time > 0 ? it.lead_time + 'g' : '-'}</td>
          <td class="right">${it.birim_maliyet.toFixed(2)}</td>
          <td class="right ${it.eksik_maliyet > 0 ? 'red' : ''}">${it.eksik_maliyet > 0 ? it.eksik_maliyet.toFixed(2) : '-'}</td>
          <td>${it.tedarikci}</td>
          <td>${it.durum === 'yeterli' ? 'Yeterli' : it.durum === 'eksik' ? 'EKSİK' : 'BULUNAMADI'}</td>
        </tr>`;
      }
      html += '</table><br>';
    }
    html += '</body></html>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Paket_Analiz_${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  exportWord() {
    if (!this.analysisResult) return;
    const data = this.analysisResult;
    const now = new Date().toLocaleDateString('tr-TR');
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Calibri,Arial;font-size:11pt;color:#333}h1{color:#1F4E79;font-size:18pt;border-bottom:2px solid #1F4E79;padding-bottom:4px}h2{color:#2E75B6;font-size:14pt;margin-top:20px}table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #BDD7EE;padding:4px 6px;font-size:9pt}th{background:#2E75B6;color:white}.metric{font-size:14pt;font-weight:bold;color:#1F4E79}.warn{color:#c00;font-weight:bold}</style></head><body>`;
    html += `<h1>Paket-Analiz Raporu</h1><p>Tarih: ${now} | Oluşturan: ${authManager?.currentUser?.fullname || '-'}</p>`;

    for (const pkg of data.packages) {
      html += `<h2>${pkg.paket_adi} — ${this.fmtNum(pkg.adet)} Adet</h2>`;
      html += `<table><tr><td><b>Birim Maliyet</b><br><span class="metric">${this.fmtCur(pkg.birim_maliyet)}</span></td><td><b>Toplam Maliyet</b><br><span class="metric">${this.fmtCur(pkg.toplam_maliyet)}</span></td><td><b>Eksik Kalem</b><br><span class="metric warn">${pkg.eksik_kalem_sayisi}</span></td><td><b>Max Lead Time</b><br><span class="metric">${pkg.max_lead_time} gün</span></td></tr></table>`;

      if (pkg.kritik_parca) {
        html += `<p class="warn">⚠ Kritik Parça: ${pkg.kritik_parca.malzeme_no} — ${pkg.kritik_parca.tanimi} (${pkg.kritik_parca.lead_time} gün)</p>`;
      }

      html += '<table><tr><th>Malzeme No</th><th>Parça Tanımı</th><th>BOM</th><th>İhtiyaç</th><th>Stok</th><th>Eksik</th><th>Lead</th><th>Birim ₺</th><th>Eksik ₺</th><th>Tedarikçi</th><th>Durum</th></tr>';
      for (const it of pkg.items) {
        html += `<tr><td>${it.malzeme_no}</td><td>${it.parca_tanimi}</td><td style="text-align:right">${it.bom_miktar}</td><td style="text-align:right">${it.toplam_ihtiyac}</td><td style="text-align:right">${it.stok}</td><td style="text-align:right;${it.eksik > 0 ? 'color:red;font-weight:bold' : ''}">${it.eksik || '-'}</td><td style="text-align:right">${it.lead_time > 0 ? it.lead_time + 'g' : '-'}</td><td style="text-align:right">${it.birim_maliyet.toFixed(2)}</td><td style="text-align:right;${it.eksik_maliyet > 0 ? 'color:red' : ''}">${it.eksik_maliyet > 0 ? it.eksik_maliyet.toFixed(2) : '-'}</td><td>${it.tedarikci}</td><td>${it.durum === 'yeterli' ? 'Yeterli' : it.durum === 'eksik' ? 'EKSİK' : 'YOK'}</td></tr>`;
      }
      html += '</table>';
    }

    // Risk section
    const ra = data.combined?.risk_analysis;
    if (ra) {
      html += '<h2>Risk Analizi</h2>';
      if (ra.critical_lead_time?.length) {
        html += `<p><b>Kritik Termin (≥30 gün):</b> ${ra.critical_lead_time.length} parça</p><ul>`;
        ra.critical_lead_time.slice(0, 10).forEach(i => { html += `<li>${i.malzeme_no} — ${i.parca_tanimi}: <b>${i.lead_time} gün</b></li>`; });
        html += '</ul>';
      }
      if (ra.zero_stock?.length) {
        html += `<p><b>Stokta Yok:</b> ${ra.zero_stock.length} parça</p>`;
      }
    }

    html += '</body></html>';
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Paket_Analiz_Rapor_${new Date().toISOString().slice(0, 10)}.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  exportSummaryText() {
    if (!this.analysisResult) return;
    const data = this.analysisResult;
    let text = `PAKET-ANALİZ ÖZET — ${new Date().toLocaleDateString('tr-TR')}\n${'═'.repeat(50)}\n\n`;
    for (const pkg of data.packages) {
      text += `📦 ${pkg.paket_adi} × ${pkg.adet} adet\n`;
      text += `   Birim Maliyet: ${this.fmtCur(pkg.birim_maliyet)}\n`;
      text += `   Toplam Maliyet: ${this.fmtCur(pkg.toplam_maliyet)}\n`;
      text += `   Eksik Kalem: ${pkg.eksik_kalem_sayisi} | Max Lead Time: ${pkg.max_lead_time} gün\n`;
      text += `   Satın Alma Maliyeti: ${this.fmtCur(pkg.toplam_eksik_maliyet)}\n`;
      if (pkg.kritik_parca) text += `   ⚠ Kritik: ${pkg.kritik_parca.malzeme_no} (${pkg.kritik_parca.lead_time}g)\n`;
      text += '\n';
    }
    navigator.clipboard.writeText(text).then(() => alert('Özet panoya kopyalandı!')).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      alert('Özet panoya kopyalandı!');
    });
  }
};
