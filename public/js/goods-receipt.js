// Goods Receipt Page (Malzeme Girişi)
const goodsReceiptPage = {
  selectedOtpaId: null,
  bomItems: [],

  async render() {
    const content = document.getElementById('content');
    
    try {
      showLoading(true);
      const otpaList = await api.otpa.list();

      content.innerHTML = `
        <div class="space-y-6">
          <!-- Page Header -->
          <div class="flex justify-between items-center">
            <h1 class="text-3xl font-bold text-gray-900">
              <i class="fas fa-box text-blue-600 mr-2"></i> Malzeme Girişi
            </h1>
          </div>

          <!-- OTPA Selection -->
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">
              <i class="fas fa-folder-open mr-2"></i> OTPA Seç
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              ${otpaList.filter(o => o.status !== 'kapali').map(otpa => `
                <button onclick="goodsReceiptPage.selectOtpa(${otpa.id})" 
                  class="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left ${this.selectedOtpaId === otpa.id ? 'border-blue-500 bg-blue-50' : ''}">
                  <div class="font-bold text-lg text-gray-900">${otpa.otpa_number}</div>
                  <div class="text-sm text-gray-600 mt-1">${otpa.project_name}</div>
                  <div class="mt-2 text-xs text-gray-500">
                    <i class="fas fa-clipboard-list mr-1"></i> ${otpa.total_items || 0} malzeme
                  </div>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- BOM Display & Entry Form -->
          <div id="entrySection" class="hidden space-y-6">
            <!-- BOM Summary -->
            <div class="bg-white rounded-lg shadow">
              <div class="px-6 py-4 border-b border-gray-200">
                <h2 class="text-xl font-semibold text-gray-900">
                  <i class="fas fa-clipboard-list mr-2"></i> Malzeme Listesi
                </h2>
              </div>
              <div id="bomSummary" class="p-6"></div>
            </div>

            <!-- Entry Form -->
            <div class="bg-white rounded-lg shadow p-6">
              <h2 class="text-xl font-semibold text-gray-900 mb-4">
                <i class="fas fa-plus-circle mr-2"></i> Giriş Kaydı Oluştur
              </h2>
              <form id="receiptForm" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Komponent *</label>
                  <select id="componentType" required 
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg bg-blue-50">
                    <option value="">Komponent seçin...</option>
                    <option value="batarya">🔋 Batarya</option>
                    <option value="vccu">⚡ VCCU</option>
                    <option value="junction_box">📦 Junction Box</option>
                    <option value="pdu">🔌 PDU</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Malzeme Kodu</label>
                  <select id="materialCode" required 
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg">
                    <option value="">Önce komponent seçin...</option>
                  </select>
                </div>

                <div id="materialInfo" class="hidden bg-blue-50 p-4 rounded-lg">
                  <h3 class="font-semibold text-gray-900 mb-2">Malzeme Bilgisi</h3>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span class="text-gray-600">Malzeme Adı:</span>
                      <div id="infoName" class="font-medium"></div>
                    </div>
                    <div>
                      <span class="text-gray-600">Gereken:</span>
                      <div id="infoRequired" class="font-medium"></div>
                    </div>
                    <div>
                      <span class="text-gray-600">Kalan:</span>
                      <div id="infoMissing" class="font-medium text-red-600"></div>
                    </div>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Gelen Miktar</label>
                  <input type="number" id="quantity" step="0.01" required 
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    placeholder="Örn: 100">
                </div>

                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <label class="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" id="returnOfRejected" 
                      class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                    <div>
                      <span class="font-medium text-gray-900">İade Dönüşü</span>
                      <p class="text-xs text-gray-600 mt-1">Bu malzeme daha önce iade edilmiş ve şimdi geri geliyor</p>
                    </div>
                  </label>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Not (Opsiyonel)</label>
                  <textarea id="notes" rows="3"
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Varsa not ekleyin..."></textarea>
                </div>

                <button type="submit" 
                  class="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition text-lg">
                  <i class="fas fa-save mr-2"></i> Girişi Kaydet
                </button>
              </form>
            </div>

            <!-- Recent Entries -->
            <div class="bg-white rounded-lg shadow">
              <div class="px-6 py-4 border-b border-gray-200">
                <h2 class="text-xl font-semibold text-gray-900">
                  <i class="fas fa-history mr-2"></i> Son Girişler
                </h2>
              </div>
              <div id="recentEntries" class="overflow-x-auto"></div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      content.innerHTML = `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <i class="fas fa-exclamation-circle mr-2"></i> ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  async selectOtpa(otpaId) {
    this.selectedOtpaId = otpaId;
    
    try {
      showLoading(true);
      
      // Get OTPA details and BOM
      const data = await api.otpa.get(otpaId);
      this.bomItems = data.bom;

      // Show entry section
      document.getElementById('entrySection').classList.remove('hidden');

      // Display BOM summary
      this.displayBomSummary(data.bom);

      // Populate material dropdown
      this.populateMaterialDropdown(data.bom);

      // Load recent entries
      this.loadRecentEntries(otpaId);

      // Setup form handler
      this.setupFormHandler();

    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  displayBomSummary(bom) {
    const container = document.getElementById('bomSummary');
    
    // Store full bom list for filtering
    this.fullBomList = bom;
    
    const renderItems = (items) => {
      return `
        <div class="mb-4">
          <div class="relative">
            <input type="text" id="bomSearchInput" placeholder="Malzeme kodu veya adı ile ara..." 
              class="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
          </div>
        </div>
        <div id="bomItemsContainer" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${items.map(item => {
            const percentage = parseFloat(item.completion_percentage);
            const isComplete = percentage >= 100;
            const hasMissing = parseFloat(item.missing_quantity) > 0;
            
            return `
              <div class="bom-item border rounded-lg p-4 ${isComplete ? 'bg-green-50 border-green-300' : hasMissing ? 'bg-yellow-50 border-yellow-300' : 'border-gray-200'}" data-code="${item.material_code}" data-name="${item.material_name}">
                <div class="flex justify-between items-start mb-2">
                  <div class="font-bold text-gray-900">${item.material_code}</div>
                  ${isComplete ? '<i class="fas fa-check-circle text-green-600"></i>' : hasMissing ? '<i class="fas fa-exclamation-triangle text-yellow-600"></i>' : ''}
                </div>
                <div class="text-sm text-gray-600 mb-3">${item.material_name}</div>
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <span>Gereken:</span>
                    <span class="font-medium">${item.required_quantity} ${item.unit}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Kabul:</span>
                    <span class="font-medium text-green-600">${item.total_accepted || 0} ${item.unit}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Eksik:</span>
                    <span class="font-medium ${hasMissing ? 'text-red-600' : 'text-gray-900'}">${item.missing_quantity || item.required_quantity} ${item.unit}</span>
                  </div>
                </div>
                <div class="mt-3">
                  <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="h-2 rounded-full ${isComplete ? 'bg-green-600' : 'bg-blue-600'}" 
                      style="width: ${Math.min(percentage, 100)}%"></div>
                  </div>
                  <div class="text-xs text-center mt-1 ${isComplete ? 'text-green-600 font-bold' : 'text-gray-600'}">${percentage}%</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    };
    
    container.innerHTML = renderItems(bom);
    
    // Setup search functionality
    const searchInput = document.getElementById('bomSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (searchTerm === '') {
          document.getElementById('bomItemsContainer').innerHTML = renderItems(this.fullBomList).match(/<div id="bomItemsContainer"[^>]*>([\s\S]*)<\/div>/)[1];
        } else {
          const filtered = this.fullBomList.filter(item => 
            item.material_code.toLowerCase().includes(searchTerm) || 
            item.material_name.toLowerCase().includes(searchTerm)
          );
          
          if (filtered.length === 0) {
            document.getElementById('bomItemsContainer').innerHTML = `
              <div class="col-span-full text-center py-8 text-gray-500">
                <i class="fas fa-search text-4xl mb-2"></i>
                <p>Arama kriterine uygun malzeme bulunamadı</p>
              </div>
            `;
          } else {
            document.getElementById('bomItemsContainer').innerHTML = renderItems(filtered).match(/<div id="bomItemsContainer"[^>]*>([\s\S]*)<\/div>/)[1];
          }
        }
      });
    }
  },

  populateMaterialDropdown(bom) {
    const componentSelect = document.getElementById('componentType');
    const materialSelect = document.getElementById('materialCode');
    
    // Komponent değiştiğinde malzemeleri filtrele
    componentSelect.addEventListener('change', (e) => {
      const componentType = e.target.value;
      
      // Clear existing options
      materialSelect.innerHTML = '<option value="">Malzeme seçin...</option>';
      
      if (!componentType) {
        materialSelect.innerHTML = '<option value="">Önce komponent seçin...</option>';
        return;
      }
      
      // Filter BOM by component type
      const filteredBom = bom.filter(item => item.component_type === componentType);
      
      if (filteredBom.length === 0) {
        materialSelect.innerHTML = '<option value="">Bu komponent için BOM yüklenmemiş</option>';
        return;
      }
      
      // Add filtered BOM items
      filteredBom.forEach(item => {
        const option = document.createElement('option');
        option.value = item.material_code;
        option.textContent = `${item.material_code} - ${item.material_name}`;
        option.dataset.item = JSON.stringify(item);
        option.dataset.componentType = componentType;
        materialSelect.appendChild(option);
      });
    });

    // Malzeme değiştiğinde bilgileri göster
    materialSelect.addEventListener('change', (e) => {
      const selected = e.target.selectedOptions[0];
      if (selected.dataset.item) {
        const item = JSON.parse(selected.dataset.item);
        this.showMaterialInfo(item);
      } else {
        document.getElementById('materialInfo').classList.add('hidden');
      }
    });
  },

  showMaterialInfo(item) {
    document.getElementById('materialInfo').classList.remove('hidden');
    document.getElementById('infoName').textContent = item.material_name;
    document.getElementById('infoRequired').textContent = `${item.required_quantity} ${item.unit}`;
    document.getElementById('infoMissing').textContent = `${item.missing_quantity} ${item.unit}`;
  },

  setupFormHandler() {
    const form = document.getElementById('receiptForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      const componentType = document.getElementById('componentType').value;
      const materialCode = document.getElementById('materialCode').value;
      const quantity = parseFloat(document.getElementById('quantity').value);
      const notes = document.getElementById('notes').value;
      const returnOfRejected = document.getElementById('returnOfRejected').checked;

      if (!componentType || !materialCode || !quantity) {
        alert('Lütfen komponent, malzeme ve miktar seçin');
        return;
      }

      try {
        showLoading(true);
        
        await api.goodsReceipt.create({
          otpa_id: this.selectedOtpaId,
          component_type: componentType,
          material_code: materialCode,
          received_quantity: quantity,
          return_of_rejected: returnOfRejected ? 1 : 0,
          notes: notes
        });

        alert(returnOfRejected ? '✅ İade dönüşü kaydı başarıyla oluşturuldu!' : '✅ Giriş kaydı başarıyla oluşturuldu!');
        
        // Reset form
        form.reset();
        document.getElementById('materialInfo').classList.add('hidden');

        // Reload data
        await this.selectOtpa(this.selectedOtpaId);
        
      } catch (error) {
        alert('Hata: ' + error.message);
      } finally {
        showLoading(false);
      }
    };
  },

  async loadRecentEntries(otpaId) {
    try {
      const receipts = await api.goodsReceipt.getByOtpa(otpaId);
      const container = document.getElementById('recentEntries');

      if (receipts.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-gray-500">Henüz giriş kaydı yok</div>';
        return;
      }

      container.innerHTML = `
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Malzeme</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Miktar</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kalite</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kaydeden</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${receipts.map(r => `
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm">${new Date(r.receipt_date).toLocaleString('tr-TR')}</td>
                <td class="px-6 py-4">
                  <div class="text-sm font-medium">${r.material_code}</div>
                  <div class="text-xs text-gray-500">${r.material_name}</div>
                </td>
                <td class="px-6 py-4 text-right font-medium">${r.received_quantity} ${r.unit}</td>
                <td class="px-6 py-4">${this.getQualityBadge(r.quality_status)}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${r.created_by_name}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (error) {
      console.error('Recent entries error:', error);
    }
  },

  getQualityBadge(status) {
    const statusMap = {
      'kabul': { class: 'bg-green-100 text-green-800', text: 'Kabul', icon: 'fa-check' },
      'iade': { class: 'bg-amber-100 text-amber-800', text: 'İade', icon: 'fa-undo' },
      'bekliyor': { class: 'bg-gray-100 text-gray-800', text: 'Bekliyor', icon: 'fa-clock' }
    };
    const s = statusMap[status] || statusMap['bekliyor'];
    return `<span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${s.class}">
      <i class="fas ${s.icon} mr-1"></i> ${s.text}
    </span>`;
  }
};

window.goodsReceiptPage = goodsReceiptPage;
