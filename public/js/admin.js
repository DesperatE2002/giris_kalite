// Admin Page
const adminPage = {
  currentTab: 'otpa',

  async render() {
    if (!authManager.isAdmin()) {
      document.getElementById('content').innerHTML = `
        <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <i class="fas fa-exclamation-triangle mr-2"></i> Bu sayfaya erişim yetkiniz yok.
        </div>
      `;
      return;
    }

    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="space-y-6">
        <!-- Page Header -->
        <div>
          <h1 class="text-3xl font-bold text-gray-900">
            <i class="fas fa-cog text-blue-600 mr-2"></i> Yönetim Paneli
          </h1>
        </div>

        <!-- Tabs -->
        <div class="border-b border-gray-200">
          <nav class="flex space-x-8">
            <button onclick="adminPage.switchTab('otpa')" data-tab="otpa"
              class="admin-tab py-4 px-1 border-b-2 font-medium text-sm">
              <i class="fas fa-folder mr-2"></i> OTPA Yönetimi
            </button>
            <button onclick="adminPage.switchTab('reports')" data-tab="reports"
              class="admin-tab py-4 px-1 border-b-2 font-medium text-sm">
              <i class="fas fa-chart-bar mr-2"></i> Raporlar
            </button>
            <button onclick="adminPage.switchTab('users')" data-tab="users"
              class="admin-tab py-4 px-1 border-b-2 font-medium text-sm">
              <i class="fas fa-users mr-2"></i> Kullanıcılar
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div id="tabContent"></div>
      </div>
    `;

    this.switchTab('otpa');
  },

  switchTab(tab) {
    this.currentTab = tab;
    
    // Update tab styling
    document.querySelectorAll('.admin-tab').forEach(btn => {
      if (btn.dataset.tab === tab) {
        btn.classList.add('border-blue-500', 'text-blue-600');
        btn.classList.remove('border-transparent', 'text-gray-500');
      } else {
        btn.classList.remove('border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
      }
    });

    // Render tab content
    switch (tab) {
      case 'otpa':
        this.renderOtpaTab();
        break;
      case 'reports':
        this.renderReportsTab();
        break;
      case 'users':
        this.renderUsersTab();
        break;
    }
  },

  async renderOtpaTab() {
    const container = document.getElementById('tabContent');
    
    try {
      showLoading(true);
      const otpaList = await api.otpa.list();

      container.innerHTML = `
        <div class="space-y-6">
          <!-- Create OTPA Button -->
          <div>
            <button onclick="adminPage.showCreateOtpaModal()" 
              class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">
              <i class="fas fa-plus mr-2"></i> Yeni OTPA Oluştur
            </button>
          </div>

          <!-- OTPA List -->
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">OTPA</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proje</th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Paket</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">BOM</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${otpaList.map(otpa => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 font-medium">${otpa.otpa_number}</td>
                    <td class="px-6 py-4">
                      <div>${otpa.project_name}</div>
                      ${otpa.customer_info ? `<div class="text-xs text-gray-500">${otpa.customer_info}</div>` : ''}
                    </td>
                    <td class="px-6 py-4 text-center">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        📦 ${otpa.battery_pack_count || 1}
                      </span>
                    </td>
                    <td class="px-6 py-4">${this.getStatusBadge(otpa.status)}</td>
                    <td class="px-6 py-4">
                      <span class="text-sm text-gray-600">${otpa.total_items || 0} malzeme</span>
                    </td>
                    <td class="px-6 py-4 text-sm space-x-2">
                      <button onclick="this.innerHTML='<i class=\\'fas fa-spinner fa-spin\\'></i> Yükleniyor...'; this.disabled=true; adminPage.showBomUploadModal(${otpa.id}, '${otpa.otpa_number}')" 
                        class="text-blue-600 hover:text-blue-900 disabled:opacity-50">
                        <i class="fas fa-upload mr-1"></i> BOM Yükle
                      </button>
                      <button onclick="this.innerHTML='<i class=\\'fas fa-spinner fa-spin\\'></i> Yükleniyor...'; this.disabled=true; adminPage.editOtpa(${otpa.id})" 
                        class="text-green-600 hover:text-green-900 disabled:opacity-50">
                        <i class="fas fa-edit mr-1"></i> Düzenle
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  showCreateOtpaModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div class="p-6">
          <h2 class="text-2xl font-bold mb-4">Yeni OTPA Oluştur</h2>
          <form id="createOtpaForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">OTPA Numarası *</label>
              <input type="text" id="otpaNumber" required 
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Örn: OTPA-2025-001">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Proje Adı *</label>
              <input type="text" id="projectName" required 
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Örn: Batarya Paketi A">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Müşteri Bilgisi</label>
              <input type="text" id="customerInfo" 
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Örn: ABC Şirketi">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Batarya Paket Sayısı *</label>
              <input type="number" id="batteryPackCount" required min="1" value="1"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="BOM'daki miktarlar bu sayı ile çarpılacak">
              <p class="text-xs text-gray-500 mt-1">ℹ️ BOM'daki tüm malzeme miktarları bu sayı ile çarpılır</p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Durum</label>
              <select id="status" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="acik">Açık</option>
                <option value="uretimde">Üretimde</option>
                <option value="kapali">Kapalı</option>
              </select>
            </div>
            <div class="flex gap-3 pt-4">
              <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <i class="fas fa-save mr-2"></i> Oluştur
              </button>
              <button type="button" onclick="this.closest('.fixed').remove()" 
                class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#createOtpaForm').onsubmit = async (e) => {
      e.preventDefault();
      
      try {
        showLoading(true);
        
        await api.otpa.create({
          otpa_number: modal.querySelector('#otpaNumber').value,
          project_name: modal.querySelector('#projectName').value,
          customer_info: modal.querySelector('#customerInfo').value,
          battery_pack_count: parseInt(modal.querySelector('#batteryPackCount').value) || 1,
          status: modal.querySelector('#status').value
        });

        modal.remove();
        alert('✅ OTPA başarıyla oluşturuldu!');
        this.renderOtpaTab();
      } catch (error) {
        alert('Hata: ' + error.message);
      } finally {
        showLoading(false);
      }
    };
  },

  showBomUploadModal(otpaId, otpaNumber) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <h2 class="text-2xl font-bold mb-4">BOM Yükle - ${otpaNumber}</h2>
          
          <div class="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 class="font-semibold mb-2"><i class="fas fa-info-circle mr-2"></i>4 Komponent İçin Ayrı Ayrı BOM Yükleyin</h3>
            <p class="text-sm text-gray-700"><strong>Batarya:</strong> Paket sayısıyla çarpılır (örn: 8x veya 10x)</p>
            <p class="text-sm text-gray-700"><strong>VCCU, Junction Box, PDU:</strong> Her zaman 1x (araçta 1'er adet)</p>
          </div>

          <!-- Komponent Sekmeleri -->
          <div class="border-b border-gray-200 mb-4">
            <nav class="flex space-x-4">
              <button onclick="adminPage.switchBomTab('batarya')" data-tab="batarya"
                class="bom-tab py-3 px-4 border-b-2 font-medium text-sm">
                🔋 Batarya BOM
              </button>
              <button onclick="adminPage.switchBomTab('vccu')" data-tab="vccu"
                class="bom-tab py-3 px-4 border-b-2 font-medium text-sm">
                ⚡ VCCU BOM
              </button>
              <button onclick="adminPage.switchBomTab('junction_box')" data-tab="junction_box"
                class="bom-tab py-3 px-4 border-b-2 font-medium text-sm">
                📦 Junction Box BOM
              </button>
              <button onclick="adminPage.switchBomTab('pdu')" data-tab="pdu"
                class="bom-tab py-3 px-4 border-b-2 font-medium text-sm">
                🔌 PDU BOM
              </button>
            </nav>
          </div>

          <!-- BOM Yükleme Formu -->
          <form id="bomUploadForm" class="space-y-4">
            <input type="hidden" id="currentComponent" value="batarya">
            
            <div>
              <label class="block text-sm font-medium mb-2">BOM Verileri (Ctrl+V ile yapıştırın) *</label>
              <textarea id="bomData" rows="10" required placeholder="Excel'den kopyalanan verileri buraya yapıştırın...
Örnek (TAB ile ayrılmış):
MAT-001	Lityum Hücre 18650	100	adet
MAT-002	BMS Kartı	10	adet
MAT-003	Nikel Şerit	500	gr"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"></textarea>
              <p class="text-xs text-gray-500 mt-1">
                <i class="fas fa-lightbulb mr-1"></i> 
                4 sütun: Malzeme Kodu | Malzeme Adı | Miktar | Birim
              </p>
            </div>
            
            <div id="previewContainer" class="hidden">
              <h4 class="font-semibold mb-2">Önizleme:</h4>
              <div class="border rounded-lg overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Malzeme Kodu</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Malzeme Adı</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Miktar</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Birim</th>
                    </tr>
                  </thead>
                  <tbody id="previewBody" class="bg-white divide-y divide-gray-200">
                  </tbody>
                </table>
              </div>
            </div>

            <div class="flex gap-3 pt-4">
              <button type="button" id="previewBtn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <i class="fas fa-eye mr-2"></i> Önizle
              </button>
              <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <i class="fas fa-upload mr-2"></i> <span id="uploadBtnText">Batarya BOM'u</span> Yükle
              </button>
              <button type="button" onclick="this.closest('.fixed').remove()" 
                class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // İlk sekmeyi aktif yap
    this.switchBomTab('batarya');

    // Preview button handler
    modal.querySelector('#previewBtn').onclick = () => {
      const data = modal.querySelector('#bomData').value.trim();
      const previewContainer = modal.querySelector('#previewContainer');
      const previewBody = modal.querySelector('#previewBody');
      
      if (!data) {
        alert('Lütfen önce BOM verilerini girin');
        return;
      }

      const lines = data.split('\n').filter(line => line.trim());
      const rows = [];
      const errors = [];

      lines.forEach((line, index) => {
        const parts = line.split('\t').map(p => p.trim());
        
        if (parts.length < 4) {
          errors.push(`Satır ${index + 1}: 4 sütun gerekli`);
          return;
        }
        
        const [code, name, qty, unit] = parts;
        const quantity = parseFloat(qty);
        
        if (isNaN(quantity) || quantity <= 0) {
          errors.push(`Satır ${index + 1}: Geçersiz miktar "${qty}"`);
          return;
        }
        
        rows.push({ code, name, qty: quantity, unit });
      });

      if (errors.length > 0) {
        alert('Hatalar:\n' + errors.join('\n'));
        return;
      }

      if (rows.length === 0) {
        alert('Hiç geçerli malzeme bulunamadı');
        return;
      }

      previewBody.innerHTML = rows.map(row => `
        <tr>
          <td class="px-3 py-2">${row.code}</td>
          <td class="px-3 py-2">${row.name}</td>
          <td class="px-3 py-2 text-right">${row.qty}</td>
          <td class="px-3 py-2">${row.unit}</td>
        </tr>
      `).join('');

      previewContainer.classList.remove('hidden');
    };

    modal.querySelector('#bomUploadForm').onsubmit = async (e) => {
      e.preventDefault();
      
      const data = modal.querySelector('#bomData').value.trim();
      const componentType = modal.querySelector('#currentComponent').value;
      
      if (!data) {
        alert('Lütfen BOM verilerini girin');
        return;
      }

      try {
        showLoading(true);
        
        // Parse data
        const lines = data.split('\n').filter(line => line.trim());
        const bomItems = [];
        const errors = [];
        
        lines.forEach((line, index) => {
          const parts = line.split('\t').map(p => p.trim());
          
          if (parts.length < 4) {
            errors.push(`Satır ${index + 1}: 4 sütun gerekli (şu an ${parts.length} sütun var)`);
            return;
          }
          
          const [code, name, qty, unit] = parts;
          const quantity = parseFloat(qty);
          
          if (isNaN(quantity) || quantity <= 0) {
            errors.push(`Satır ${index + 1}: Geçersiz miktar "${qty}"`);
            return;
          }
          
          bomItems.push({
            material_code: code,
            material_name: name,
            required_quantity: quantity,
            unit: unit,
            component_type: componentType
          });
        });
        
        if (errors.length > 0) {
          alert('Hatalar:\n' + errors.join('\n'));
          return;
        }
        
        if (bomItems.length === 0) {
          alert('Hiç geçerli malzeme bulunamadı');
          return;
        }

        // Upload BOM
        await api.request(`/bom/upload-component`, {
          method: 'POST',
          body: JSON.stringify({
            otpa_id: otpaId,
            component_type: componentType,
            items: bomItems
          })
        });

        alert(`✅ ${componentType.toUpperCase()} BOM başarıyla yüklendi! ${bomItems.length} malzeme eklendi.`);
        
        // Clear form
        modal.querySelector('#bomData').value = '';
        
      } catch (error) {
        alert('Hata: ' + error.message);
      } finally {
        showLoading(false);
      }
    };
  },

  switchBomTab(componentType) {
    // Update tab styling
    document.querySelectorAll('.bom-tab').forEach(btn => {
      if (btn.dataset.tab === componentType) {
        btn.classList.add('border-blue-500', 'text-blue-600');
        btn.classList.remove('border-transparent', 'text-gray-500');
      } else {
        btn.classList.remove('border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
      }
    });

    // Update current component
    const currentComponent = document.getElementById('currentComponent');
    if (currentComponent) {
      currentComponent.value = componentType;
    }

    // Update button text
    const btnText = document.getElementById('uploadBtnText');
    if (btnText) {
      const labels = {
        'batarya': 'Batarya BOM',
        'vccu': 'VCCU BOM',
        'junction_box': 'Junction Box BOM',
        'pdu': 'PDU BOM'
      };
      btnText.textContent = labels[componentType] + "'u";
    }
  },

  async renderReportsTab() {
    const container = document.getElementById('tabContent');
    
    try {
      showLoading(true);
      
      const [completion, missing, rejections, allReceipts] = await Promise.all([
        api.reports.otpaCompletion(),
        api.reports.missingMaterials(),
        api.reports.rejections({}),
        api.request('/goods-receipt/all')
      ]);

      container.innerHTML = `
        <div class="space-y-6">
          
          <!-- Eksik Malzemeler (Öncelikli) -->
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b bg-red-50">
              <h3 class="text-lg font-semibold text-red-800">
                <i class="fas fa-exclamation-triangle mr-2"></i>Eksik Malzemeler
              </h3>
              <p class="text-sm text-red-600 mt-1">Acil tedarik gerektiren malzemeler</p>
            </div>
            <div class="overflow-x-auto">
              ${missing.length === 0 ? `
                <div class="px-6 py-8 text-center text-gray-500">
                  <i class="fas fa-check-circle text-4xl text-green-500 mb-2"></i>
                  <p>Tüm malzemeler tamamlandı! 🎉</p>
                </div>
              ` : `
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">OTPA</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proje</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Malzeme</th>
                      <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gereken</th>
                      <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gelen</th>
                      <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Eksik</th>
                      <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Durum</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    ${missing.map(item => `
                      <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 font-medium">${item.otpa_number}</td>
                        <td class="px-6 py-4 text-sm">${item.project_name || ''}</td>
                        <td class="px-6 py-4">
                          <div class="font-medium">${item.material_code}</div>
                          <div class="text-xs text-gray-500">${item.material_name}</div>
                        </td>
                        <td class="px-6 py-4 text-right">${item.required_quantity} ${item.unit}</td>
                        <td class="px-6 py-4 text-right text-green-600">${item.accepted_quantity || 0} ${item.unit}</td>
                        <td class="px-6 py-4 text-right font-bold text-red-600">${item.missing_quantity} ${item.unit}</td>
                        <td class="px-6 py-4 text-center">
                          <span class="px-2 py-1 text-xs rounded ${item.status === 'Hiç Gelmedi' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                            ${item.status || 'Bekliyor'}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>
          </div>

          <!-- Malzeme Giriş Geçmişi -->
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b">
              <h3 class="text-lg font-semibold">
                <i class="fas fa-history mr-2"></i>Malzeme Giriş Geçmişi
              </h3>
              <p class="text-sm text-gray-600 mt-1">Tüm malzeme girişleri ve kalite durumları</p>
            </div>
            <div class="overflow-x-auto">
              ${allReceipts.length === 0 ? `
                <div class="px-6 py-8 text-center text-gray-500">
                  Henüz malzeme girişi yapılmamış
                </div>
              ` : `
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">OTPA</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Malzeme</th>
                      <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Giren Miktar</th>
                      <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Kabul</th>
                      <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Red</th>
                      <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Kalite</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giriş Yapan</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    ${allReceipts.slice(0, 50).map(receipt => {
                      const statusColors = {
                        'kabul': 'bg-green-100 text-green-800',
                        'iade': 'bg-amber-100 text-amber-800',
                        'bekliyor': 'bg-gray-100 text-gray-800'
                      };
                      const statusLabels = {
                        'kabul': '✅ Kabul',
                        'iade': '↩️ İade',
                        'bekliyor': '⏳ Bekliyor'
                      };
                      return `
                      <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 whitespace-nowrap">${new Date(receipt.created_at).toLocaleString('tr-TR')}</td>
                        <td class="px-4 py-3 font-medium">${receipt.otpa_number || 'N/A'}</td>
                        <td class="px-4 py-3">
                          <div class="font-medium">${receipt.material_code}</div>
                          <div class="text-xs text-gray-500">${receipt.material_name || ''}</div>
                        </td>
                        <td class="px-4 py-3 text-right font-medium">${receipt.received_quantity} ${receipt.unit || ''}</td>
                        <td class="px-4 py-3 text-right text-green-600">${receipt.accepted_quantity || 0}</td>
                        <td class="px-4 py-3 text-right text-red-600">${receipt.rejected_quantity || 0}</td>
                        <td class="px-4 py-3 text-center">
                          <span class="px-2 py-1 text-xs rounded ${statusColors[receipt.quality_status] || 'bg-gray-100 text-gray-800'}">
                            ${statusLabels[receipt.quality_status] || 'Bekliyor'}
                          </span>
                        </td>
                        <td class="px-4 py-3">${receipt.created_by_name || 'Sistem'}</td>
                      </tr>
                    `}).join('')}
                  </tbody>
                </table>
              `}
            </div>
          </div>

          <!-- OTPA Tamamlama Raporu -->
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b">
              <h3 class="text-lg font-semibold">
                <i class="fas fa-chart-pie mr-2"></i>OTPA Tamamlama Raporu
              </h3>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">OTPA</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proje</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Toplam</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tamamlanan</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  ${completion.map(item => `
                    <tr>
                      <td class="px-6 py-4 font-medium">${item.otpa_number}</td>
                      <td class="px-6 py-4">${item.project_name}</td>
                      <td class="px-6 py-4 text-right">${item.total_items || 0}</td>
                      <td class="px-6 py-4 text-right">${item.completed_items || 0}</td>
                      <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                          <span class="font-bold ${(item.completion_percentage || 0) >= 100 ? 'text-green-600' : 'text-blue-600'}">
                            ${item.completion_percentage || 0}%
                          </span>
                          <div class="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div class="h-full ${(item.completion_percentage || 0) >= 100 ? 'bg-green-600' : 'bg-blue-600'}" 
                              style="width: ${item.completion_percentage || 0}%"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Red/İade Kayıtları -->
          ${rejections.length > 0 ? `
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b">
              <h3 class="text-lg font-semibold">
                <i class="fas fa-times-circle mr-2"></i>Red/İade Kayıtları
              </h3>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">OTPA</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Malzeme</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Red Miktarı</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Neden</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Karar Veren</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  ${rejections.slice(0, 20).map(item => `
                    <tr class="hover:bg-gray-50">
                      <td class="px-4 py-3 whitespace-nowrap">${new Date(item.decision_date).toLocaleString('tr-TR')}</td>
                      <td class="px-4 py-3 font-medium">${item.otpa_number}</td>
                      <td class="px-4 py-3">
                        <div class="font-medium">${item.material_code}</div>
                        <div class="text-xs text-gray-500">${item.material_name}</div>
                      </td>
                      <td class="px-4 py-3">
                        <span class="px-2 py-1 text-xs rounded ${item.status === 'red' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                          ${item.status === 'red' ? '❌ Red' : '⚠️ Şartlı Kabul'}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right font-bold text-red-600">${item.rejected_quantity}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">${item.reason || '-'}</td>
                      <td class="px-4 py-3">${item.decision_by_name || 'Bilinmiyor'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          ` : ''}
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  async renderUsersTab() {
    const container = document.getElementById('tabContent');
    
    try {
      showLoading(true);
      const users = await api.auth.getUsers();

      container.innerHTML = `
        <div class="space-y-6">
          <div>
            <button onclick="adminPage.showCreateUserModal()" 
              class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
              <i class="fas fa-user-plus mr-2"></i> Yeni Kullanıcı Ekle
            </button>
          </div>

          <div class="bg-white rounded-lg shadow overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kullanıcı Adı</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ad Soyad</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kayıt Tarihi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                ${users.map(user => `
                  <tr>
                    <td class="px-6 py-4 font-medium">${user.username}</td>
                    <td class="px-6 py-4">${user.full_name}</td>
                    <td class="px-6 py-4">${this.getRoleBadge(user.role)}</td>
                    <td class="px-6 py-4">
                      ${user.is_active 
                        ? '<span class="text-green-600">✓ Aktif</span>' 
                        : '<span class="text-red-600">✗ Pasif</span>'}
                    </td>
                    <td class="px-6 py-4 text-sm">${new Date(user.created_at).toLocaleDateString('tr-TR')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  showCreateUserModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div class="p-6">
          <h2 class="text-2xl font-bold mb-4">Yeni Kullanıcı Ekle</h2>
          <form id="createUserForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Kullanıcı Adı *</label>
              <input type="text" id="username" required 
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Ad Soyad *</label>
              <input type="text" id="fullName" required 
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Şifre *</label>
              <input type="password" id="password" required 
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Rol *</label>
              <select id="role" required 
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="tekniker">Tekniker</option>
                <option value="kalite">Kalite</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="flex gap-3 pt-4">
              <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <i class="fas fa-save mr-2"></i> Kaydet
              </button>
              <button type="button" onclick="this.closest('.fixed').remove()" 
                class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#createUserForm').onsubmit = async (e) => {
      e.preventDefault();
      
      try {
        showLoading(true);
        
        await api.auth.createUser({
          username: modal.querySelector('#username').value,
          full_name: modal.querySelector('#fullName').value,
          password: modal.querySelector('#password').value,
          role: modal.querySelector('#role').value
        });

        modal.remove();
        alert('✅ Kullanıcı başarıyla oluşturuldu!');
        this.renderUsersTab();
      } catch (error) {
        alert('Hata: ' + error.message);
      } finally {
        showLoading(false);
      }
    };
  },

  async editOtpa(otpaId) {
    try {
      showLoading(true);
      const otpa = await api.otpa.get(otpaId);
      
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
      modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-lg w-full">
          <div class="p-6">
            <h2 class="text-2xl font-bold mb-4">OTPA Düzenle</h2>
            <form id="editOtpaForm" class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-2">OTPA Numarası</label>
                <input type="text" value="${otpa.otpa.otpa_number}" disabled
                  class="w-full px-3 py-2 border rounded-lg bg-gray-100">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Proje Adı *</label>
                <input type="text" id="projectName" value="${otpa.otpa.project_name}" required 
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Müşteri Bilgisi</label>
                <input type="text" id="customerInfo" value="${otpa.otpa.customer_info || ''}"
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Batarya Paket Sayısı *</label>
                <input type="number" id="batteryPackCount" value="${otpa.otpa.battery_pack_count || 1}" required min="1"
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <p class="text-xs text-amber-600 mt-1">⚠️ Paket sayısını değiştirirseniz, BOM miktarları otomatik güncellenir</p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Durum</label>
                <select id="status" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="acik" ${otpa.otpa.status === 'acik' ? 'selected' : ''}>Açık</option>
                  <option value="uretimde" ${otpa.otpa.status === 'uretimde' ? 'selected' : ''}>Üretimde</option>
                  <option value="kapali" ${otpa.otpa.status === 'kapali' ? 'selected' : ''}>Kapalı</option>
                </select>
              </div>
              <div class="flex gap-3 pt-4">
                <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <i class="fas fa-save mr-2"></i> Kaydet
                </button>
                <button type="button" onclick="this.closest('.fixed').remove()" 
                  class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('#editOtpaForm').onsubmit = async (e) => {
        e.preventDefault();
        
        try {
          showLoading(true);
          
          await api.otpa.update(otpaId, {
            project_name: modal.querySelector('#projectName').value,
            customer_info: modal.querySelector('#customerInfo').value,
            battery_pack_count: parseInt(modal.querySelector('#batteryPackCount').value),
            status: modal.querySelector('#status').value
          });

          modal.remove();
          alert('✅ OTPA başarıyla güncellendi!');
          this.renderOtpaTab();
        } catch (error) {
          alert('Hata: ' + error.message);
        } finally {
          showLoading(false);
        }
      };
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  getStatusBadge(status) {
    const map = {
      'acik': 'bg-green-100 text-green-800',
      'uretimde': 'bg-blue-100 text-blue-800',
      'kapali': 'bg-gray-100 text-gray-800'
    };
    return `<span class="px-2 py-1 text-xs rounded-full ${map[status] || map.acik}">${status}</span>`;
  },

  getRoleBadge(role) {
    const map = {
      'tekniker': { class: 'bg-blue-100 text-blue-800', text: 'Tekniker' },
      'kalite': { class: 'bg-green-100 text-green-800', text: 'Kalite' },
      'admin': { class: 'bg-purple-100 text-purple-800', text: 'Admin' }
    };
    const r = map[role] || map.tekniker;
    return `<span class="px-2 py-1 text-xs rounded-full ${r.class}">${r.text}</span>`;
  }
};

window.adminPage = adminPage;
