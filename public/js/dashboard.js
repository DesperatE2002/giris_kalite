// Dashboard Page
const dashboardPage = {
  async render() {
    const content = document.getElementById('content');
    
    try {
      showLoading(true);
      
      // Get summary stats
      const summary = await api.reports.summary();
      const otpaList = await api.otpa.list();

      content.innerHTML = `
        <div class="space-y-6 fade-in">
          <!-- Page Header -->
          <div class="flex justify-between items-center">
            <h1 class="text-4xl font-bold gradient-text">
              <i class="fas fa-home mr-3"></i> Ana Sayfa
            </h1>
          </div>

          <!-- Summary Cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="glass-card rounded-2xl p-6 hover-lift">
              <div class="flex items-center">
                <div class="flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-lg">
                  <i class="fas fa-folder-open text-white text-3xl"></i>
                </div>
                <div class="ml-5">
                  <p class="text-gray-400 text-sm font-medium">Açık OTPA</p>
                  <p class="text-3xl font-bold text-white">${summary.open_otpa || 0}</p>
                </div>
              </div>
            </div>

            <div class="glass-card rounded-2xl p-6 hover-lift">
              <div class="flex items-center">
                <div class="flex-shrink-0 bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 shadow-lg">
                  <i class="fas fa-industry text-white text-3xl"></i>
                </div>
                <div class="ml-5">
                  <p class="text-gray-400 text-sm font-medium">Üretimde</p>
                  <p class="text-3xl font-bold text-white">${summary.in_production_otpa || 0}</p>
                </div>
              </div>
            </div>

            <div class="glass-card rounded-2xl p-6 hover-lift">
              <div class="flex items-center">
                <div class="flex-shrink-0 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-4 shadow-lg">
                  <i class="fas fa-clock text-white text-3xl"></i>
                </div>
                <div class="ml-5">
                  <p class="text-gray-400 text-sm font-medium">Kalite Bekleyen</p>
                  <p class="text-3xl font-bold text-white">${summary.pending_quality || 0}</p>
                </div>
              </div>
            </div>

            <div class="glass-card rounded-2xl p-6 hover-lift">
              <div class="flex items-center">
                <div class="flex-shrink-0 bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 shadow-lg">
                  <i class="fas fa-times-circle text-white text-3xl"></i>
                </div>
                <div class="ml-5">
                  <p class="text-gray-400 text-sm font-medium">Red (30 gün)</p>
                  <p class="text-3xl font-bold text-white">${summary.rejections_last_month || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- OTPA List -->
          <div class="glass-card rounded-2xl shadow-xl">
            <div class="px-6 py-4 border-b border-white/5">
              <h2 class="text-2xl font-bold gradient-text">
                <i class="fas fa-list mr-2"></i> OTPA Listesi
              </h2>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-white/5">
                <thead>
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">OTPA</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Proje</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Durum</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">İlerleme</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">İşlem</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  ${otpaList.map(otpa => {
                    const totalItems = parseInt(otpa.total_items) || 0;
                    const completedItems = parseInt(otpa.completed_items) || 0;
                    const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
                    
                    return `
                      <tr class="hover:bg-white/[0.03] transition-all duration-200">
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="font-semibold text-white">${otpa.otpa_number}</div>
                        </td>
                        <td class="px-6 py-4">
                          <div class="text-sm font-medium text-white">${otpa.project_name}</div>
                          ${otpa.customer_info ? `<div class="text-xs text-gray-400">${otpa.customer_info}</div>` : ''}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          ${this.getStatusBadge(otpa.status)}
                        </td>
                        <td class="px-6 py-4">
                          <div class="flex items-center">
                            <div class="w-full bg-gray-700/50 rounded-full h-2.5 mr-2 shadow-inner">
                              <div class="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full shadow-lg transition-all duration-300" style="width: ${percentage}%"></div>
                            </div>
                            <span class="text-sm font-semibold text-gray-300">${percentage}%</span>
                          </div>
                          <div class="text-xs text-gray-400 mt-1 font-medium">${completedItems}/${totalItems} tamamlandı</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                          <button onclick="this.innerHTML='<i class=\\'fas fa-spinner fa-spin\\'></i> Yükleniyor...'; this.disabled=true; dashboardPage.viewOtpaDetail(${otpa.id})" 
                            class="gradient-btn px-4 py-2 rounded-lg disabled:opacity-50">
                            <i class="fas fa-eye"></i> Detay
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      content.innerHTML = `
        <div class="glass-card border-red-500/30 text-red-400 px-4 py-3 rounded">
          <i class="fas fa-exclamation-circle mr-2"></i> ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  getStatusBadge(status) {
    const statusMap = {
      'acik': { class: 'bg-emerald-500/15 text-emerald-400', text: 'Açık', icon: 'fa-folder-open' },
      'uretimde': { class: 'bg-blue-500/15 text-blue-400', text: 'Üretimde', icon: 'fa-industry' },
      'kapali': { class: 'bg-gray-500/15 text-gray-400', text: 'Kapalı', icon: 'fa-folder' }
    };
    const s = statusMap[status] || statusMap['acik'];
    return `<span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${s.class}">
      <i class="fas ${s.icon} mr-1"></i> ${s.text}
    </span>`;
  },

  async viewOtpaDetail(otpaId) {
    const content = document.getElementById('content');
    
    try {
      // Show loading immediately
      showLoading(true);
      content.innerHTML = `
        <div class="flex items-center justify-center h-64">
          <div class="text-center">
            <i class="fas fa-spinner fa-spin text-4xl text-indigo-500 mb-4"></i>
            <p class="text-gray-400">OTPA detayları yükleniyor...</p>
          </div>
        </div>
      `;
      
      const data = await api.otpa.get(otpaId);
      const receipts = await api.goodsReceipt.getByOtpa(otpaId);

      content.innerHTML = `
        <div class="space-y-6">
          <!-- Back Button -->
          <button onclick="app.navigate('dashboard')" class="text-indigo-400 hover:text-indigo-300">
            <i class="fas fa-arrow-left mr-2"></i> Geri Dön
          </button>

          <!-- OTPA Header -->
          <div class="glass-card rounded-2xl p-6">
            <h1 class="text-2xl font-bold text-white mb-4">${data.otpa.otpa_number}</h1>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p class="text-sm text-gray-400">Proje Adı</p>
                <p class="font-medium text-white">${data.otpa.project_name}</p>
              </div>
              <div>
                <p class="text-sm text-gray-400">Müşteri</p>
                <p class="font-medium text-white">${data.otpa.customer_info || '-'}</p>
              </div>
              <div>
                <p class="text-sm text-gray-400">Durum</p>
                ${this.getStatusBadge(data.otpa.status)}
              </div>
            </div>
          </div>

          <!-- BOM Table -->
          <div class="glass-card rounded-2xl">
            <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center">
              <h2 class="text-xl font-semibold text-white">
                <i class="fas fa-clipboard-list mr-2"></i> Malzeme Listesi (BOM)
              </h2>
              <div class="space-x-2">
                <button onclick="dashboardPage.filterBom('missing')" 
                  class="px-3 py-1 text-sm bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                  <i class="fas fa-exclamation-triangle mr-1"></i> Eksikleri Göster
                </button>
                <button onclick="dashboardPage.filterBom('issues')" 
                  class="px-3 py-1 text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded">
                  <i class="fas fa-times-circle mr-1"></i> Problemleri Göster
                </button>
                <button onclick="dashboardPage.filterBom('all')" 
                  class="px-3 py-1 text-sm bg-gray-500/10 text-gray-400 border border-gray-500/20 rounded">
                  <i class="fas fa-list mr-1"></i> Tümünü Göster
                </button>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-white/5" id="bomTable">
                <thead>
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Malzeme Kodu</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Malzeme Adı</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Gereken</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Kabul</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Red</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Eksik</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Tamamlanma</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  ${data.bom.map(item => `
                    <tr class="hover:bg-white/[0.03]" 
                        data-missing="${item.missing_quantity > 0 ? 'true' : 'false'}"
                        data-issues="${item.quality_issues > 0 ? 'true' : 'false'}">
                      <td class="px-6 py-4 whitespace-nowrap font-medium text-white">${item.material_code}</td>
                      <td class="px-6 py-4 text-gray-200">${item.material_name}</td>
                      <td class="px-6 py-4 text-right whitespace-nowrap text-gray-200">${item.required_quantity} ${item.unit}</td>
                      <td class="px-6 py-4 text-right whitespace-nowrap text-emerald-400 font-medium">${item.total_accepted} ${item.unit}</td>
                      <td class="px-6 py-4 text-right whitespace-nowrap text-red-400">${item.total_rejected} ${item.unit}</td>
                      <td class="px-6 py-4 text-right whitespace-nowrap">
                        <span class="${item.missing_quantity > 0 ? 'text-red-400 font-bold' : 'text-white'}">
                          ${item.missing_quantity} ${item.unit}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-right whitespace-nowrap">
                        <div class="flex items-center justify-end">
                          <div class="w-20 bg-gray-700/50 rounded-full h-2 mr-2">
                            <div class="h-2 rounded-full ${item.completion_percentage >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}" 
                              style="width: ${Math.min(item.completion_percentage, 100)}%"></div>
                          </div>
                          <span class="text-sm ${item.completion_percentage >= 100 ? 'text-emerald-400 font-bold' : 'text-gray-400'}">
                            ${item.completion_percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Recent Receipts -->
          <div class="glass-card rounded-2xl">
            <div class="px-6 py-4 border-b border-white/5">
              <h2 class="text-xl font-semibold text-white">
                <i class="fas fa-history mr-2"></i> Son Girişler
              </h2>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-white/5">
                <thead>
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tarih</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Malzeme</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Miktar</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Kalite</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Kaydeden</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  ${receipts.slice(0, 10).map(receipt => `
                    <tr class="hover:bg-white/[0.03]">
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-200">${new Date(receipt.receipt_date).toLocaleString('tr-TR')}</td>
                      <td class="px-6 py-4">
                        <div class="text-sm font-medium text-white">${receipt.material_code}</div>
                        <div class="text-xs text-gray-400">${receipt.material_name}</div>
                      </td>
                      <td class="px-6 py-4 text-right whitespace-nowrap font-medium text-gray-200">${receipt.received_quantity} ${receipt.unit}</td>
                      <td class="px-6 py-4 whitespace-nowrap">${this.getQualityBadge(receipt.quality_status)}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${receipt.created_by_name}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      content.innerHTML = `
        <div class="glass-card border-red-500/30 text-red-400 px-4 py-3 rounded">
          <i class="fas fa-exclamation-circle mr-2"></i> ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  getQualityBadge(status) {
    const statusMap = {
      'kabul': { class: 'bg-emerald-500/15 text-emerald-400', text: 'Kabul', icon: 'fa-check' },
      'iade': { class: 'bg-red-500/15 text-red-400', text: 'İade', icon: 'fa-undo' },
      'bekliyor': { class: 'bg-gray-500/15 text-gray-400', text: 'Bekliyor', icon: 'fa-clock' }
    };
    const s = statusMap[status] || statusMap['bekliyor'];
    return `<span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${s.class}">
      <i class="fas ${s.icon} mr-1"></i> ${s.text}
    </span>`;
  },

  filterBom(filter) {
    const rows = document.querySelectorAll('#bomTable tbody tr');
    rows.forEach(row => {
      if (filter === 'all') {
        row.style.display = '';
      } else if (filter === 'missing') {
        row.style.display = row.dataset.missing === 'true' ? '' : 'none';
      } else if (filter === 'issues') {
        row.style.display = row.dataset.issues === 'true' ? '' : 'none';
      }
    });
  }
};

window.dashboardPage = dashboardPage;
