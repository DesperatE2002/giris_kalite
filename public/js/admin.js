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
      <div class="space-y-6 fade-in">
        <!-- Page Header -->
        <div>
          <h1 class="text-4xl font-bold gradient-text">
            <i class="fas fa-cog mr-3"></i> Yönetim Paneli
          </h1>
        </div>

        <!-- Tabs -->
        <div class="glass-card rounded-2xl p-2">
          <nav class="flex space-x-2">
            <button onclick="adminPage.switchTab('otpa')" data-tab="otpa"
              class="admin-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
              <i class="fas fa-folder mr-2"></i> OTPA Yönetimi
            </button>
            <button onclick="adminPage.switchTab('bom-templates')" data-tab="bom-templates"
              class="admin-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
              <i class="fas fa-copy mr-2"></i> BOM Şablonları
            </button>
            <button onclick="adminPage.switchTab('returns')" data-tab="returns"
              class="admin-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
              <i class="fas fa-undo mr-2"></i> İade Yönetimi
            </button>
            <button onclick="adminPage.switchTab('reports')" data-tab="reports"
              class="admin-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
              <i class="fas fa-chart-bar mr-2"></i> Raporlar
            </button>
            <button onclick="adminPage.switchTab('users')" data-tab="users"
              class="admin-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
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
    
    // Show instant loading feedback
    const tabContent = document.getElementById('tabContent');
    tabContent.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="text-center glass-card rounded-2xl p-8">
          <i class="fas fa-spinner fa-spin text-5xl gradient-text mb-4"></i>
          <p class="text-gray-700 font-medium">Yükleniyor...</p>
        </div>
      </div>
    `;
    
    // Update tab styling
    document.querySelectorAll('.admin-tab').forEach(btn => {
      if (btn.dataset.tab === tab) {
        btn.classList.add('gradient-btn', 'shadow-lg');
        btn.classList.remove('text-gray-600', 'hover:text-gray-900');
      } else {
        btn.classList.remove('gradient-btn', 'shadow-lg');
        btn.classList.add('text-gray-600', 'hover:text-gray-900');
      }
    });

    // Render tab content
    switch (tab) {
      case 'otpa':
        this.renderOtpaTab();
        break;
      case 'bom-templates':
        this.renderBomTemplatesTab();
        break;
      case 'returns':
        this.renderReturnsTab();
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
        <div class="space-y-6 fade-in">
          <!-- Create OTPA Button -->
          <div>
            <button onclick="adminPage.showCreateOtpaModal()" 
              class="gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 hover-lift">
              <i class="fas fa-plus mr-2"></i> Yeni OTPA Oluştur
            </button>
          </div>

          <!-- OTPA List -->
          <div class="glass-card rounded-2xl shadow-xl overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gradient-to-r from-purple-50 to-blue-50">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">OTPA</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Proje</th>
                  <th class="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Paket</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Durum</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">BOM</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">İşlemler</th>
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
                      <button onclick="adminPage.showBomUploadModal(${otpa.id}, '${otpa.otpa_number}')" 
                        class="text-blue-600 hover:text-blue-900">
                        <i class="fas fa-upload mr-1"></i> BOM Yükle
                      </button>
                      <button onclick="this.innerHTML='<i class=\\'fas fa-spinner fa-spin\\'></i> Yükleniyor...'; this.disabled=true; adminPage.editOtpa(${otpa.id})" 
                        class="text-green-600 hover:text-green-900 disabled:opacity-50">
                        <i class="fas fa-edit mr-1"></i> Düzenle
                      </button>
                      <button onclick="adminPage.deleteOtpa(${otpa.id}, '${otpa.otpa_number}')" 
                        class="text-red-600 hover:text-red-900">
                        <i class="fas fa-trash mr-1"></i> Sil
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

  async showCreateOtpaModal() {
    let templates = [];
    try {
      templates = await api.bomTemplates.list();
    } catch (error) {
      console.warn('Templates not available:', error);
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="glass-card rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-bold gradient-text">
              <i class="fas fa-plus-circle mr-2"></i> Yeni OTPA Oluştur
            </h2>
            <button onclick="this.closest('.fixed').remove()" 
              class="text-gray-500 hover:text-red-600 transition-colors duration-200 p-2 hover:bg-red-50 rounded-xl">
              <i class="fas fa-times text-3xl"></i>
            </button>
          </div>
          <form id="createOtpaForm" class="space-y-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">OTPA Numarası *</label>
              <input type="text" id="otpaNumber" required 
                class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                placeholder="Örn: OA20489">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Proje Adı *</label>
              <input type="text" id="projectName" required 
                class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                placeholder="Örn: FRANSA-LİTVANYA">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Müşteri Bilgisi</label>
              <input type="text" id="customerInfo" 
                class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                placeholder="Örn: LİTVANYA MD9">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Batarya Paket Sayısı *</label>
              <input type="number" id="batteryPackCount" required min="1" value="8"
                class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium text-lg">
              <p class="text-xs text-gray-600 mt-1">
                <i class="fas fa-info-circle text-blue-500 mr-1"></i> Batarya BOM'daki miktarlar bu sayı ile çarpılır
              </p>
            </div>
            ${templates.length > 0 ? `
              <div class="glass-card rounded-xl p-4 border-2 border-purple-300">
                <label class="block text-sm font-bold text-gray-900 mb-2">
                  <i class="fas fa-rocket text-purple-600 mr-2"></i> BOM Şablonu Seç (Opsiyonel)
                </label>
                <select id="templateSelect" 
                  class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium">
                  <option value="">Şablon seçme (sonra manuel yükle)</option>
                  ${templates.map(t => `
                    <option value="${t.id}">${t.template_name} (${t.item_count} malzeme)</option>
                  `).join('')}
                </select>
                <p class="text-xs text-gray-600 mt-2">
                  <i class="fas fa-lightbulb text-yellow-500 mr-1"></i> 
                  Şablon seçerseniz OTPA oluşturulurken otomatik BOM yüklenecek
                </p>
              </div>
            ` : ''}
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Durum</label>
              <select id="status" 
                class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium">
                <option value="acik">Açık</option>
                <option value="uretimde">Üretimde</option>
                <option value="kapali">Kapalı</option>
              </select>
            </div>
            <div class="flex gap-3 pt-4">
              <button type="submit" class="flex-1 gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg">
                <i class="fas fa-save mr-2"></i> OTPA Oluştur
              </button>
              <button type="button" onclick="this.closest('.fixed').remove()" 
                class="px-6 py-3 bg-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-400 transition">
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
        
        const otpaData = {
          otpa_number: modal.querySelector('#otpaNumber').value,
          project_name: modal.querySelector('#projectName').value,
          customer_info: modal.querySelector('#customerInfo').value,
          battery_pack_count: parseInt(modal.querySelector('#batteryPackCount').value) || 1,
          status: modal.querySelector('#status').value
        };

        const result = await api.otpa.create(otpaData);
        const otpaId = result.otpa?.id || result.id;

        // If template selected, apply it with component type selection
        const templateSelect = modal.querySelector('#templateSelect');
        if (templateSelect && templateSelect.value) {
          const templateId = templateSelect.value;
          const templateName = templateSelect.options[templateSelect.selectedIndex].text;
          
          modal.remove();
          this.showComponentSelectionModal(otpaId, templateId, templateName, true);
        } else {
          alert('✅ OTPA başarıyla oluşturuldu! BOM yüklemek için "BOM Yükle" butonuna tıklayın.');
          modal.remove();
          this.renderOtpaTab();
        }
      } catch (error) {
        alert('Hata: ' + error.message);
      } finally {
        showLoading(false);
      }
    };
  },

  async showBomUploadModal(otpaId, otpaNumber) {
    let templates = [];
    
    // Try to get templates, but continue if it fails
    try {
      templates = await api.bomTemplates.list();
    } catch (error) {
      console.warn('BOM templates not available:', error);
      // Continue without templates
    }
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="glass-card rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold gradient-text">
              <i class="fas fa-upload mr-2"></i> BOM Yükle - ${otpaNumber}
            </h2>
            <button onclick="this.closest('.fixed').remove()" 
              class="text-gray-500 hover:text-red-600 transition-colors duration-200 p-2 hover:bg-red-50 rounded-xl">
              <i class="fas fa-times text-3xl"></i>
            </button>
          </div>

          <!-- Template Selection -->
          ${templates.length > 0 ? `
            <div class="glass-card rounded-xl p-4 mb-6 border-2 border-purple-300">
              <h3 class="font-bold text-gray-900 mb-3">
                <i class="fas fa-rocket text-purple-600 mr-2"></i> Hızlı Yükleme: Şablondan Seç
              </h3>
              <div class="flex gap-3 items-end">
                <div class="flex-1">
                  <select id="templateSelect" 
                    class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium">
                    <option value="">Şablon seçin...</option>
                    ${templates.map(t => `
                      <option value="${t.id}">${t.template_name} (${t.item_count} malzeme)</option>
                    `).join('')}
                  </select>
                </div>
                <button type="button" onclick="adminPage.applyTemplate(${otpaId}, '${otpaNumber}')" 
                  class="gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg whitespace-nowrap">
                  <i class="fas fa-bolt mr-2"></i> Şablonu Uygula
                </button>
              </div>
              <p class="text-xs text-gray-600 mt-2">
                <i class="fas fa-info-circle mr-1"></i> Şablon uygulandığında mevcut BOM silinip yerine şablon malzemeleri eklenecektir
              </p>
            </div>
            <div class="relative my-6">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-4 bg-white text-gray-500 font-medium">veya Excel'den yapıştır</span>
              </div>
            </div>
          ` : ''}
          
          <div class="glass-card rounded-xl p-4 mb-6">
            <h3 class="font-semibold mb-2"><i class="fas fa-info-circle text-blue-600 mr-2"></i>4 Komponent İçin Ayrı Ayrı BOM Yükleyin</h3>
            <p class="text-sm text-gray-700"><strong>Batarya:</strong> Paket sayısıyla çarpılır (örn: 8x veya 10x)</p>
            <p class="text-sm text-gray-700"><strong>VCCU, Junction Box, PDU:</strong> Her zaman 1x (araçta 1'er adet)</p>
          </div>

          <!-- Komponent Sekmeleri -->
          <div class="glass-card rounded-xl p-2 mb-4">
            <nav class="flex space-x-2">
              <button onclick="adminPage.switchBomTab('batarya')" data-tab="batarya"
                class="bom-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
                🔋 Batarya BOM
              </button>
              <button onclick="adminPage.switchBomTab('vccu')" data-tab="vccu"
                class="bom-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
                ⚡ VCCU BOM
              </button>
              <button onclick="adminPage.switchBomTab('junction_box')" data-tab="junction_box"
                class="bom-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
                📦 Junction Box BOM
              </button>
              <button onclick="adminPage.switchBomTab('pdu')" data-tab="pdu"
                class="bom-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
                🔌 PDU BOM
              </button>
            </nav>
          </div>

          <!-- BOM Yükleme Formu -->
          <form id="bomUploadForm" class="space-y-4">
            <input type="hidden" id="currentComponent" value="batarya">
            
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">BOM Verileri (Ctrl+V ile yapıştırın) *</label>
              <textarea id="bomData" rows="10" required placeholder="Excel'den kopyalanan verileri buraya yapıştırın...
Örnek (TAB ile ayrılmış):
MAT-001	Lityum Hücre 18650	100	adet
MAT-002	BMS Kartı	10	adet
MAT-003	Nikel Şerit	500	gr"
                class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm transition-all duration-200"></textarea>
              <p class="text-xs text-gray-600 mt-2">
                <i class="fas fa-lightbulb text-yellow-500 mr-1"></i> 
                4 sütun: Malzeme Kodu | Malzeme Adı | Miktar | Birim
              </p>
            </div>
            
            <div id="previewContainer" class="hidden">
              <h4 class="font-semibold mb-2 text-gray-900">Önizleme:</h4>
              <div class="glass-card rounded-xl overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                  <thead class="bg-gradient-to-r from-purple-50 to-blue-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Malzeme Kodu</th>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Malzeme Adı</th>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Miktar</th>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Birim</th>
                    </tr>
                  </thead>
                  <tbody id="previewBody" class="bg-white divide-y divide-gray-200">
                  </tbody>
                </table>
              </div>
            </div>

            <div class="flex gap-3 pt-4">
              <button type="button" id="previewBtn" class="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 shadow-lg transition">
                <i class="fas fa-eye mr-2"></i> Önizle
              </button>
              <button type="submit" class="flex-1 gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg">
                <i class="fas fa-upload mr-2"></i> <span id="uploadBtnText">Batarya BOM'u</span> Yükle
              </button>
              <button type="button" onclick="this.closest('.fixed').remove()" 
                class="px-6 py-3 bg-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-400 transition">
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
      
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      
      const data = modal.querySelector('#bomData').value.trim();
      const componentType = modal.querySelector('#currentComponent').value;
      
      if (!data) {
        alert('Lütfen BOM verilerini girin');
        return;
      }

      try {
        // Show loading on button
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Yükleniyor...';
        submitBtn.disabled = true;
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
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
          alert('Hatalar:\n' + errors.join('\n'));
          return;
        }
        
        if (bomItems.length === 0) {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
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
        modal.querySelector('#previewContainer').classList.add('hidden');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        // Refresh OTPA tab to restore buttons
        this.renderOtpaTab();
        
      } catch (error) {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
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
        btn.classList.add('gradient-btn', 'shadow-lg');
        btn.classList.remove('text-gray-600', 'hover:text-gray-900');
      } else {
        btn.classList.remove('gradient-btn', 'shadow-lg');
        btn.classList.add('text-gray-600', 'hover:text-gray-900');
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

  async applyTemplate(otpaId, otpaNumber) {
    const templateSelect = document.getElementById('templateSelect');
    const templateId = templateSelect.value;
    
    if (!templateId) {
      alert('Lütfen bir şablon seçin');
      return;
    }

    const templateName = templateSelect.options[templateSelect.selectedIndex].text;
    this.showComponentSelectionModal(otpaId, templateId, templateName, false, otpaNumber);
  },

  showComponentSelectionModal(otpaId, templateId, templateName, isNewOtpa, otpaNumber = '') {
    const componentModal = document.createElement('div');
    componentModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'glass-card rounded-2xl p-6 max-w-md w-full';
    modalContent.innerHTML = `
      <h3 class="text-xl font-bold gradient-text mb-4">
        <i class="fas fa-cog mr-2"></i> Component Seçin
      </h3>
      <p class="text-gray-700 mb-4">
        BOM şablonu hangi component için yüklensin?
      </p>
      <div class="space-y-3">
        <button data-component="batarya" class="component-btn w-full px-6 py-4 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-xl hover:shadow-xl transition-all duration-200">
          🔋 Batarya BOM
        </button>
        <button data-component="vccu" class="component-btn w-full px-6 py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 text-white font-bold rounded-xl hover:shadow-xl transition-all duration-200">
          ⚡ VCCU BOM
        </button>
        <button data-component="junction_box" class="component-btn w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-xl hover:shadow-xl transition-all duration-200">
          📦 Junction Box BOM
        </button>
        <button data-component="pdu" class="component-btn w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold rounded-xl hover:shadow-xl transition-all duration-200">
          🔌 PDU BOM
        </button>
        <button class="cancel-btn w-full px-6 py-3 bg-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-400 transition">
          ${isNewOtpa ? 'Manuel Yükle' : 'İptal'}
        </button>
      </div>
    `;
    
    componentModal.appendChild(modalContent);
    document.body.appendChild(componentModal);
    
    // Event delegation kullan
    modalContent.addEventListener('click', async (e) => {
      const btn = e.target.closest('.component-btn');
      if (btn) {
        const component = btn.dataset.component;
        componentModal.remove();
        
        try {
          showLoading(true);
          await api.bomTemplates.applyToOtpa(templateId, otpaId, component);
          
          const componentLabels = {
            'batarya': '🔋 Batarya',
            'vccu': '⚡ VCCU',
            'junction_box': '📦 Junction Box',
            'pdu': '🔌 PDU'
          };
          
          if (isNewOtpa) {
            alert(`✅ OTPA oluşturuldu ve "${templateName}" ${componentLabels[component]} için başarıyla uygulandı!`);
          } else {
            alert(`✅ "${templateName}" ${componentLabels[component]} için başarıyla uygulandı!`);
          }
          
          adminPage.renderOtpaTab();
        } catch (error) {
          alert('Hata: ' + error.message);
          adminPage.renderOtpaTab();
        } finally {
          showLoading(false);
        }
      }
      
      if (e.target.closest('.cancel-btn')) {
        componentModal.remove();
        if (isNewOtpa) {
          adminPage.renderOtpaTab();
        }
      }
    });
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
            
            <!-- Filtreleme ve Toplu İşlemler -->
            <div class="px-6 py-4 bg-gray-50 border-b">
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">OTPA Filtrele</label>
                  <input type="text" id="filterMissingOtpa" placeholder="OTPA ara..." 
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Proje Filtrele</label>
                  <input type="text" id="filterMissingProject" placeholder="Proje ara..." 
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Component Filtrele</label>
                  <select id="filterMissingComponent" 
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-medium">
                    <option value="">Tümü</option>
                    <option value="batarya">🔋 Batarya</option>
                    <option value="vccu">⚡ VCCU</option>
                    <option value="junction_box">📦 Junction Box</option>
                    <option value="pdu">🔌 PDU</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Malzeme Filtrele</label>
                  <input type="text" id="filterMissingMaterial" placeholder="Malzeme kodu/adı ara..." 
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                </div>
              </div>
              
              <!-- Toplu İşlem Butonları -->
              <div class="flex items-center gap-3 pt-3 border-t">
                <button onclick="adminPage.toggleSelectAll()" 
                  class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors">
                  <i class="fas fa-check-square mr-2"></i> Tümünü Seç
                </button>
                <button onclick="adminPage.bulkReceiveSelected()" id="bulkReceiveBtn"
                  class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled>
                  <i class="fas fa-box-open mr-2"></i> Seçilenleri Giriş Yap (<span id="selectedCount">0</span>)
                </button>
                <span class="text-sm text-gray-600 ml-2">
                  Seçilen malzemeler tam miktarıyla girilecek
                </span>
              </div>
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
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        <input type="checkbox" id="selectAllCheckbox" onclick="adminPage.toggleSelectAll()"
                          class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500">
                      </th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">OTPA</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proje</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Malzeme</th>
                      <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gereken</th>
                      <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gelen</th>
                      <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Eksik</th>
                      <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Durum</th>
                    </tr>
                  </thead>
                  <tbody id="missingMaterialsTable" class="divide-y divide-gray-200">
                    ${missing.map(item => {
                      const componentIcons = {
                        'batarya': '🔋',
                        'vccu': '⚡',
                        'junction_box': '📦',
                        'pdu': '🔌'
                      };
                      const componentLabels = {
                        'batarya': 'Batarya',
                        'vccu': 'VCCU',
                        'junction_box': 'Junction Box',
                        'pdu': 'PDU'
                      };
                      return `
                      <tr class="hover:bg-gray-50" data-otpa="${item.otpa_number}" data-project="${item.project_name || ''}" data-component="${item.component_type || ''}" data-material="${item.material_code} ${item.material_name}"
                          data-otpa-id="${item.otpa_id}" data-material-code="${item.material_code}" data-component-type="${item.component_type}" data-required-quantity="${item.required_quantity}">
                        <td class="px-6 py-4">
                          <input type="checkbox" class="material-checkbox w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            onchange="adminPage.updateSelectedCount()">
                        </td>
                        <td class="px-6 py-4 font-medium">${item.otpa_number}</td>
                        <td class="px-6 py-4 text-sm">${item.project_name || ''}</td>
                        <td class="px-6 py-4">
                          <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                            item.component_type === 'batarya' ? 'bg-green-100 text-green-800' :
                            item.component_type === 'vccu' ? 'bg-yellow-100 text-yellow-800' :
                            item.component_type === 'junction_box' ? 'bg-blue-100 text-blue-800' :
                            item.component_type === 'pdu' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                          }">
                            ${componentIcons[item.component_type] || '❓'} ${componentLabels[item.component_type] || item.component_type}
                          </span>
                        </td>
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
                    `}).join('')}
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
    
    // Filtreleme event listener'larını ekle
    setTimeout(() => {
      const filterOtpa = document.getElementById('filterMissingOtpa');
      const filterProject = document.getElementById('filterMissingProject');
      const filterComponent = document.getElementById('filterMissingComponent');
      const filterMaterial = document.getElementById('filterMissingMaterial');
      const table = document.getElementById('missingMaterialsTable');
      
      if (filterOtpa && filterProject && filterComponent && filterMaterial && table) {
        const filterTable = () => {
          const otpaValue = filterOtpa.value.toLowerCase().trim();
          const projectValue = filterProject.value.toLowerCase().trim();
          const componentValue = filterComponent.value.toLowerCase().trim();
          const materialValue = filterMaterial.value.toLowerCase().trim();
          
          const rows = table.querySelectorAll('tr');
          let visibleCount = 0;
          
          rows.forEach(row => {
            const otpa = (row.dataset.otpa || '').toLowerCase();
            const project = (row.dataset.project || '').toLowerCase();
            const component = (row.dataset.component || '').toLowerCase();
            const material = (row.dataset.material || '').toLowerCase();
            
            const otpaMatch = !otpaValue || otpa.includes(otpaValue);
            const projectMatch = !projectValue || project.includes(projectValue);
            const componentMatch = !componentValue || component === componentValue;
            const materialMatch = !materialValue || material.includes(materialValue);
            
            if (otpaMatch && projectMatch && componentMatch && materialMatch) {
              row.style.display = '';
              visibleCount++;
            } else {
              row.style.display = 'none';
            }
          });
        };
        
        filterOtpa.addEventListener('input', filterTable);
        filterProject.addEventListener('input', filterTable);
        filterComponent.addEventListener('change', filterTable);
        filterMaterial.addEventListener('input', filterTable);
      }
    }, 100);
  },

  toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.material-checkbox');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const isChecked = selectAllCheckbox.checked;
    
    checkboxes.forEach(cb => {
      // Sadece görünür satırları seç
      const row = cb.closest('tr');
      if (row.style.display !== 'none') {
        cb.checked = isChecked;
      }
    });
    
    this.updateSelectedCount();
  },

  updateSelectedCount() {
    const checked = document.querySelectorAll('.material-checkbox:checked').length;
    const countSpan = document.getElementById('selectedCount');
    const bulkBtn = document.getElementById('bulkReceiveBtn');
    
    if (countSpan) countSpan.textContent = checked;
    if (bulkBtn) bulkBtn.disabled = checked === 0;
  },

  async bulkReceiveSelected() {
    const checkboxes = document.querySelectorAll('.material-checkbox:checked');
    
    if (checkboxes.length === 0) {
      alert('Lütfen en az bir malzeme seçin');
      return;
    }

    const items = [];
    checkboxes.forEach(cb => {
      const row = cb.closest('tr');
      items.push({
        otpa_id: parseInt(row.dataset.otpaId),
        component_type: row.dataset.componentType,
        material_code: row.dataset.materialCode,
        required_quantity: parseFloat(row.dataset.requiredQuantity)
      });
    });

    const confirmed = confirm(
      `${items.length} malzeme için tam miktarda (gereken miktar kadar) giriş yapılacak.\n\n` +
      `Devam etmek istiyor musunuz?`
    );

    if (!confirmed) return;

    try {
      showLoading(true);
      
      const response = await api.request('/goods-receipt/bulk', {
        method: 'POST',
        body: JSON.stringify({ items })
      });

      alert(`✅ ${response.receipts.length} malzeme başarıyla giriş yapıldı!`);
      
      // Sayfayı yenile
      this.renderReportsTab();
    } catch (error) {
      alert('Hata: ' + error.message);
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
  },

  async deleteOtpa(otpaId, otpaNumber) {
    if (!confirm(`"${otpaNumber}" OTPA'sını silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz ve tüm BOM verileri silinecektir.`)) {
      return;
    }

    try {
      showLoading(true);
      await api.otpa.delete(otpaId);
      alert(`${otpaNumber} başarıyla silindi!`);
      this.renderOtpaTab();
    } catch (error) {
      alert('Silme işlemi başarısız: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  // BOM Templates Tab
  async renderBomTemplatesTab() {
    const container = document.getElementById('tabContent');
    
    try {
      showLoading(true);
      const templates = await api.bomTemplates.list();

      container.innerHTML = `
        <div class="space-y-6 fade-in">
          <!-- Create Template Button -->
          <div>
            <button onclick="adminPage.showCreateTemplateModal()" 
              class="gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 hover-lift">
              <i class="fas fa-plus mr-2"></i> Yeni BOM Şablonu Oluştur
            </button>
          </div>

          <!-- Templates List -->
          <div class="glass-card rounded-2xl shadow-xl overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200">
              <h3 class="text-2xl font-bold gradient-text">
                <i class="fas fa-copy mr-2"></i> Kayıtlı BOM Şablonları
              </h3>
              <p class="text-sm text-gray-600 mt-1">Tekrar kullanılabilir malzeme listeleri</p>
            </div>
            <div class="p-6">
              ${templates.length === 0 ? `
                <div class="text-center py-12">
                  <i class="fas fa-copy text-gray-300 text-6xl mb-4"></i>
                  <h3 class="text-xl font-semibold text-gray-900 mb-2">Henüz şablon yok</h3>
                  <p class="text-gray-600">BOM yükledikten sonra şablon olarak kaydedebilirsiniz</p>
                </div>
              ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  ${templates.map(template => `
                    <div class="glass-card rounded-xl p-5 hover-lift border-2 border-gray-200 hover:border-purple-400 transition-all duration-200">
                      <div class="flex items-start justify-between mb-3">
                        <div class="flex-1">
                          <h4 class="text-lg font-bold text-gray-900 mb-1">${template.template_name}</h4>
                          ${template.description ? `<p class="text-sm text-gray-600">${template.description}</p>` : ''}
                        </div>
                        <span class="ml-2 px-3 py-1 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 rounded-full text-xs font-semibold">
                          ${template.item_count} malzeme
                        </span>
                      </div>
                      <div class="text-xs text-gray-500 mb-4">
                        <i class="fas fa-user mr-1"></i> ${template.created_by_name || 'Sistem'}
                        <span class="mx-2">•</span>
                        <i class="fas fa-clock mr-1"></i> ${new Date(template.created_at).toLocaleDateString('tr-TR')}
                      </div>
                      <div class="flex gap-2">
                        <button onclick="adminPage.viewTemplateDetail(${template.id}, '${template.template_name}')" 
                          class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
                          <i class="fas fa-eye mr-1"></i> Görüntüle
                        </button>
                        <button onclick="adminPage.deleteTemplate(${template.id}, '${template.template_name}')" 
                          class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition">
                          <i class="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="glass-card rounded-2xl border-2 border-red-400 text-red-700 px-6 py-5">
          <i class="fas fa-exclamation-circle mr-2"></i> ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  async showCreateTemplateModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
    modal.innerHTML = `
      <div class="glass-card rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold gradient-text">
            <i class="fas fa-copy mr-2"></i> Yeni BOM Şablonu Oluştur
          </h2>
          <button onclick="this.closest('.fixed').remove()" 
            class="text-gray-500 hover:text-red-600 transition-colors duration-200 p-2 hover:bg-red-50 rounded-xl">
            <i class="fas fa-times text-3xl"></i>
          </button>
        </div>

        <form id="createTemplateForm" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Şablon Adı *</label>
            <input type="text" id="templateName" required
              placeholder="Örn: MD9 Amphenol Batarya BOM"
              class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium">
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Açıklama</label>
            <textarea id="templateDescription" rows="2"
              placeholder="Şablon hakkında not (opsiyonel)"
              class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"></textarea>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">BOM Verileri (Excel'den Ctrl+V ile yapıştırın) *</label>
            <textarea id="templateBomData" rows="12" required 
              placeholder="Excel'den kopyalanan verileri buraya yapıştırın...
Örnek (TAB ile ayrılmış):
MAT-001	Lityum Hücre 18650	100	adet
MAT-002	BMS Kartı	10	adet
MAT-003	Nikel Şerit	500	gr"
              class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm transition-all duration-200"></textarea>
            <p class="text-xs text-gray-600 mt-2">
              <i class="fas fa-lightbulb text-yellow-500 mr-1"></i> 
              4 sütun: Malzeme Kodu | Malzeme Adı | Miktar | Birim
            </p>
          </div>

          <div id="templatePreviewContainer" class="hidden">
            <h4 class="font-semibold mb-2 text-gray-900">Önizleme:</h4>
            <div class="glass-card rounded-xl overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gradient-to-r from-purple-50 to-blue-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Malzeme Kodu</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Malzeme Adı</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Miktar</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Birim</th>
                  </tr>
                </thead>
                <tbody id="templatePreviewBody" class="bg-white divide-y divide-gray-200">
                </tbody>
              </table>
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button type="button" id="templatePreviewBtn" 
              class="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 shadow-lg transition">
              <i class="fas fa-eye mr-2"></i> Önizle
            </button>
            <button type="submit" 
              class="flex-1 gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg">
              <i class="fas fa-save mr-2"></i> Şablonu Kaydet
            </button>
            <button type="button" onclick="this.closest('.fixed').remove()" 
              class="px-6 py-3 bg-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-400 transition">
              İptal
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Preview button
    document.getElementById('templatePreviewBtn').onclick = () => {
      const bomData = document.getElementById('templateBomData').value.trim();
      
      if (!bomData) {
        alert('Lütfen BOM verilerini yapıştırın');
        return;
      }

      const lines = bomData.split('\n').filter(line => line.trim());
      const items = [];
      
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 4) {
          items.push({
            material_code: parts[0].trim(),
            material_name: parts[1].trim(),
            quantity: parseFloat(parts[2].trim()),
            unit: parts[3].trim()
          });
        }
      }

      if (items.length === 0) {
        alert('Geçerli BOM verisi bulunamadı. Format: Malzeme Kodu [TAB] Malzeme Adı [TAB] Miktar [TAB] Birim');
        return;
      }

      const previewBody = document.getElementById('templatePreviewBody');
      previewBody.innerHTML = items.map(item => `
        <tr class="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200">
          <td class="px-4 py-3 font-semibold text-gray-900">${item.material_code}</td>
          <td class="px-4 py-3 text-gray-700">${item.material_name}</td>
          <td class="px-4 py-3 font-semibold text-gray-900">${item.quantity}</td>
          <td class="px-4 py-3 text-gray-600">${item.unit}</td>
        </tr>
      `).join('');

      document.getElementById('templatePreviewContainer').classList.remove('hidden');
    };

    // Form submit
    document.getElementById('createTemplateForm').onsubmit = async (e) => {
      e.preventDefault();
      
      const templateName = document.getElementById('templateName').value.trim();
      const description = document.getElementById('templateDescription').value.trim();
      const bomData = document.getElementById('templateBomData').value.trim();

      if (!bomData) {
        alert('Lütfen BOM verilerini yapıştırın');
        return;
      }

      const lines = bomData.split('\n').filter(line => line.trim());
      const items = [];
      
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 4) {
          items.push({
            material_code: parts[0].trim(),
            material_name: parts[1].trim(),
            quantity: parseFloat(parts[2].trim()),
            unit: parts[3].trim()
          });
        }
      }

      if (items.length === 0) {
        alert('Geçerli BOM verisi bulunamadı');
        return;
      }

      try {
        showLoading(true);
        
        await api.bomTemplates.create({
          template_name: templateName,
          description: description || null,
          items: items
        });

        modal.remove();
        alert(`✅ "${templateName}" şablonu başarıyla oluşturuldu! (${items.length} malzeme)`);
        this.renderBomTemplatesTab();
        
      } catch (error) {
        alert('Hata: ' + error.message);
      } finally {
        showLoading(false);
      }
    };
  },

  async viewTemplateDetail(templateId, templateName) {
    try {
      showLoading(true);
      const data = await api.bomTemplates.get(templateId);
      
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
      modal.innerHTML = `
        <div class="glass-card rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-6">
            <div>
              <h2 class="text-2xl font-bold gradient-text">
                <i class="fas fa-copy mr-2"></i> ${data.template.template_name}
              </h2>
              ${data.template.description ? `<p class="text-sm text-gray-600 mt-1">${data.template.description}</p>` : ''}
            </div>
            <button onclick="this.closest('.fixed').remove()" 
              class="text-gray-500 hover:text-red-600 transition-colors duration-200 p-2 hover:bg-red-50 rounded-xl">
              <i class="fas fa-times text-3xl"></i>
            </button>
          </div>

          <div class="glass-card rounded-xl p-4 mb-6">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gradient-to-r from-purple-50 to-blue-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Malzeme Kodu</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Malzeme Adı</th>
                  <th class="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Miktar</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Birim</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                ${data.items.map(item => `
                  <tr class="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200">
                    <td class="px-4 py-3 font-semibold text-gray-900">${item.material_code}</td>
                    <td class="px-4 py-3 text-gray-700">${item.material_name}</td>
                    <td class="px-4 py-3 text-right font-semibold text-gray-900">${item.quantity}</td>
                    <td class="px-4 py-3 text-gray-600">${item.unit}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <button onclick="this.closest('.fixed').remove()" 
            class="w-full gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg">
            <i class="fas fa-check mr-2"></i> Kapat
          </button>
        </div>
      `;
      
      document.body.appendChild(modal);
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  async deleteTemplate(templateId, templateName) {
    if (!confirm(`"${templateName}" şablonunu silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      showLoading(true);
      await api.bomTemplates.delete(templateId);
      alert('✅ Şablon başarıyla silindi!');
      this.renderBomTemplatesTab();
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  // İade Yönetimi Tab
  async renderReturnsTab() {
    const container = document.getElementById('tabContent');
    
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-8 fade-in">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold gradient-text">
            <i class="fas fa-undo mr-3"></i> İade Oluştur
          </h2>
        </div>

        <form id="returnForm" class="space-y-6">
          <!-- OTPA Seçimi -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-folder mr-2"></i> OTPA Seçin
            </label>
            <select id="returnOtpaId" required 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg">
              <option value="">OTPA seçin...</option>
            </select>
          </div>

          <!-- Component Seçimi -->
          <div id="componentSection" style="display: none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-puzzle-piece mr-2"></i> Komponent Seçin
            </label>
            <select id="returnComponentType" required 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg">
              <option value="">Komponent seçin...</option>
              <option value="batarya">🔋 Batarya</option>
              <option value="vccu">🖥️ VCCU</option>
              <option value="junction_box">📦 Junction Box</option>
              <option value="pdu">⚡ PDU</option>
            </select>
          </div>

          <!-- Malzeme Seçimi -->
          <div id="materialSection" style="display: none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-box mr-2"></i> İade Edilecek Malzeme
            </label>
            <select id="returnMaterialCode" required 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg">
              <option value="">Malzeme seçin...</option>
            </select>
            <div id="materialInfo" class="mt-2 p-3 bg-blue-50 rounded-lg text-sm" style="display: none;">
              <div class="font-medium text-blue-900 mb-1">Mevcut Stok</div>
              <div id="stockQuantity" class="text-blue-700"></div>
            </div>
          </div>

          <!-- İade Miktarı -->
          <div id="quantitySection" style="display: none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-sort-numeric-up mr-2"></i> İade Miktarı
            </label>
            <input type="number" id="returnQuantity" step="0.01" min="0.01" required 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
              placeholder="İade edilecek miktarı girin">
          </div>

          <!-- İade Sebebi -->
          <div id="reasonSection" style="display: none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-comment mr-2"></i> İade Sebebi *
            </label>
            <textarea id="returnReason" required rows="3"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="İade sebebini detaylı açıklayın..."></textarea>
          </div>

          <!-- Submit Button -->
          <button type="submit" id="submitReturnBtn" style="display: none;"
            class="w-full gradient-btn px-6 py-4 rounded-xl font-semibold text-lg shadow-lg">
            <i class="fas fa-undo mr-2"></i> İade Oluştur
          </button>
        </form>

        <div id="returnResult" class="mt-6"></div>
      </div>
    `;

    // OTPA listesini yükle
    try {
      const otpas = await api.otpa.list();
      const otpaSelect = document.getElementById('returnOtpaId');
      
      otpas.forEach(otpa => {
        const option = document.createElement('option');
        option.value = otpa.id;
        option.textContent = `${otpa.otpa_number} - ${otpa.project_name}`;
        otpaSelect.appendChild(option);
      });

      // Event listeners
      otpaSelect.addEventListener('change', (e) => this.onReturnOtpaChange(e.target.value));
      document.getElementById('returnComponentType').addEventListener('change', (e) => 
        this.onReturnComponentChange(e.target.value)
      );
      document.getElementById('returnMaterialCode').addEventListener('change', (e) => 
        this.onReturnMaterialChange(e.target.value)
      );
      document.getElementById('returnForm').addEventListener('submit', (e) => 
        this.handleReturnSubmit(e)
      );

    } catch (error) {
      console.error('OTPA listesi yükleme hatası:', error);
      container.innerHTML += `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <i class="fas fa-exclamation-triangle mr-2"></i> OTPA listesi yüklenemedi: ${error.message}
        </div>
      `;
    }
  },

  async onReturnOtpaChange(otpaId) {
    if (!otpaId) {
      document.getElementById('componentSection').style.display = 'none';
      document.getElementById('materialSection').style.display = 'none';
      document.getElementById('quantitySection').style.display = 'none';
      document.getElementById('reasonSection').style.display = 'none';
      document.getElementById('submitReturnBtn').style.display = 'none';
      return;
    }

    document.getElementById('componentSection').style.display = 'block';
    document.getElementById('returnComponentType').value = '';
    document.getElementById('materialSection').style.display = 'none';
    document.getElementById('quantitySection').style.display = 'none';
    document.getElementById('reasonSection').style.display = 'none';
    document.getElementById('submitReturnBtn').style.display = 'none';
  },

  async onReturnComponentChange(componentType) {
    if (!componentType) {
      document.getElementById('materialSection').style.display = 'none';
      document.getElementById('quantitySection').style.display = 'none';
      document.getElementById('reasonSection').style.display = 'none';
      document.getElementById('submitReturnBtn').style.display = 'none';
      return;
    }

    const otpaId = document.getElementById('returnOtpaId').value;
    
    try {
      showLoading(true);
      const materials = await api.quality.acceptedMaterials(otpaId, componentType);
      
      const materialSelect = document.getElementById('returnMaterialCode');
      materialSelect.innerHTML = '<option value="">Malzeme seçin...</option>';
      
      if (materials.length === 0) {
        materialSelect.innerHTML = '<option value="">Bu komponentte iade edilebilir malzeme yok</option>';
        document.getElementById('materialSection').style.display = 'block';
        return;
      }

      materials.forEach(material => {
        const option = document.createElement('option');
        option.value = material.material_code;
        option.dataset.acceptedQty = material.accepted_quantity;
        option.dataset.unit = material.unit;
        option.textContent = `${material.material_code} - ${material.material_name} (Stok: ${material.accepted_quantity} ${material.unit})`;
        materialSelect.appendChild(option);
      });

      document.getElementById('materialSection').style.display = 'block';
    } catch (error) {
      alert('Malzeme listesi yüklenemedi: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  onReturnMaterialChange(materialCode) {
    if (!materialCode) {
      document.getElementById('materialInfo').style.display = 'none';
      document.getElementById('quantitySection').style.display = 'none';
      document.getElementById('reasonSection').style.display = 'none';
      document.getElementById('submitReturnBtn').style.display = 'none';
      return;
    }

    const materialSelect = document.getElementById('returnMaterialCode');
    const selectedOption = materialSelect.options[materialSelect.selectedIndex];
    const acceptedQty = selectedOption.dataset.acceptedQty;
    const unit = selectedOption.dataset.unit;

    document.getElementById('stockQuantity').textContent = `${acceptedQty} ${unit}`;
    document.getElementById('materialInfo').style.display = 'block';
    document.getElementById('quantitySection').style.display = 'block';
    document.getElementById('reasonSection').style.display = 'block';
    document.getElementById('submitReturnBtn').style.display = 'block';

    // Miktar max değeri ayarla
    document.getElementById('returnQuantity').max = acceptedQty;
  },

  async handleReturnSubmit(e) {
    e.preventDefault();

    const otpaId = document.getElementById('returnOtpaId').value;
    const componentType = document.getElementById('returnComponentType').value;
    const materialCode = document.getElementById('returnMaterialCode').value;
    const returnQuantity = parseFloat(document.getElementById('returnQuantity').value);
    const reason = document.getElementById('returnReason').value;

    if (!otpaId || !componentType || !materialCode || !returnQuantity || !reason) {
      alert('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      showLoading(true);
      
      const response = await api.quality.createReturn({
        otpa_id: parseInt(otpaId),
        component_type: componentType,
        material_code: materialCode,
        return_quantity: returnQuantity,
        reason: reason
      });

      document.getElementById('returnResult').innerHTML = `
        <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
          <i class="fas fa-check-circle mr-2"></i>
          <strong>Başarılı!</strong> ${response.message}
          <div class="mt-2 text-sm">
            İade Miktarı: ${response.returned_quantity}<br>
            Kalan Stok: ${response.remaining_accepted}
          </div>
        </div>
      `;

      // Formu resetle
      document.getElementById('returnForm').reset();
      document.getElementById('componentSection').style.display = 'none';
      document.getElementById('materialSection').style.display = 'none';
      document.getElementById('quantitySection').style.display = 'none';
      document.getElementById('reasonSection').style.display = 'none';
      document.getElementById('submitReturnBtn').style.display = 'none';

    } catch (error) {
      document.getElementById('returnResult').innerHTML = `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <strong>Hata!</strong> ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  }
};

window.adminPage = adminPage;
