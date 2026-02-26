// Admin Page
const adminPage = {
  currentTab: 'otpa',

  async render() {
    if (!authManager.isAdmin()) {
      document.getElementById('content').innerHTML = `
        <div class="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-4 py-3 rounded">
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
            <button onclick="adminPage.switchTab('reports')" data-tab="reports"
              class="admin-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
              <i class="fas fa-chart-bar mr-2"></i> Raporlar
            </button>
            <button onclick="adminPage.switchTab('users')" data-tab="users"
              class="admin-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
              <i class="fas fa-users mr-2"></i> Kullanıcılar
            </button>
            <button onclick="adminPage.switchTab('roles')" data-tab="roles"
              class="admin-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
              <i class="fas fa-shield-alt mr-2"></i> Roller & İzinler
            </button>
            <button onclick="adminPage.switchTab('settings')" data-tab="settings"
              class="admin-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
              <i class="fas fa-sliders-h mr-2"></i> Ayarlar
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
          <p class="text-gray-300 font-medium">Yükleniyor...</p>
        </div>
      </div>
    `;
    
    // Update tab styling
    document.querySelectorAll('.admin-tab').forEach(btn => {
      if (btn.dataset.tab === tab) {
        btn.classList.add('gradient-btn', 'shadow-lg');
        btn.classList.remove('text-gray-400', 'hover:text-white');
      } else {
        btn.classList.remove('gradient-btn', 'shadow-lg');
        btn.classList.add('text-gray-400', 'hover:text-white');
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
      case 'reports':
        this.renderReportsTab();
        break;
      case 'users':
        this.renderUsersTab();
        break;
      case 'roles':
        this.renderRolesTab();
        break;
      case 'settings':
        this.renderSettingsTab();
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
            <table class="min-w-full divide-y divide-white/5">
              <thead class="bg-gradient-to-r from-purple-900/30 to-blue-900/30">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">OTPA</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Proje</th>
                  <th class="px-6 py-4 text-center text-xs font-bold text-gray-300 uppercase tracking-wider">Paket</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Durum</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">BOM</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                ${otpaList.map(otpa => `
                  <tr class="hover:bg-white/[0.03]">
                    <td class="px-6 py-4 font-medium">${otpa.otpa_number}</td>
                    <td class="px-6 py-4">
                      <div>${otpa.project_name}</div>
                      ${otpa.customer_info ? `<div class="text-xs text-gray-400">${otpa.customer_info}</div>` : ''}
                    </td>
                    <td class="px-6 py-4 text-center">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400">
                        📦 ${otpa.battery_pack_count || 1}
                      </span>
                    </td>
                    <td class="px-6 py-4">${this.getStatusBadge(otpa.status)}</td>
                    <td class="px-6 py-4">
                      <span class="text-sm text-gray-400">${otpa.total_items || 0} malzeme</span>
                    </td>
                    <td class="px-6 py-4 text-sm space-x-2">
                      <button onclick="adminPage.showBomUploadModal(${otpa.id}, '${otpa.otpa_number}')" 
                        class="text-blue-400 hover:text-blue-300">
                        <i class="fas fa-upload mr-1"></i> BOM Yükle
                      </button>
                      <button onclick="this.innerHTML='<i class=\\'fas fa-spinner fa-spin\\'></i> Yükleniyor...'; this.disabled=true; adminPage.editOtpa(${otpa.id})" 
                        class="text-green-400 hover:text-green-300 disabled:opacity-50">
                        <i class="fas fa-edit mr-1"></i> Düzenle
                      </button>
                      <button onclick="adminPage.deleteOtpa(${otpa.id}, '${otpa.otpa_number}')" 
                        class="text-red-400 hover:text-red-300">
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
        <div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded">
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
              class="text-gray-400 hover:text-red-400 transition-colors duration-200 p-2 hover:bg-red-500/10 rounded-xl">
              <i class="fas fa-times text-3xl"></i>
            </button>
          </div>
          <form id="createOtpaForm" class="space-y-4">
            <div>
              <label class="block text-sm font-semibold text-gray-300 mb-2">OTPA Numarası *</label>
              <input type="text" id="otpaNumber" required 
                class="w-full px-4 py-3 border-2 border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium bg-gray-800/50 text-white"
                placeholder="Örn: OA20489">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-300 mb-2">Proje Adı *</label>
              <input type="text" id="projectName" required 
                class="w-full px-4 py-3 border-2 border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-800/50 text-white"
                placeholder="Örn: FRANSA-LİTVANYA">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-300 mb-2">Müşteri Bilgisi</label>
              <input type="text" id="customerInfo" 
                class="w-full px-4 py-3 border-2 border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-800/50 text-white"
                placeholder="Örn: LİTVANYA MD9">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-300 mb-2">Batarya Paket Sayısı *</label>
              <input type="number" id="batteryPackCount" required min="1" value="8"
                class="w-full px-4 py-3 border-2 border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium text-lg bg-gray-800/50 text-white">
              <p class="text-xs text-gray-400 mt-1">
                <i class="fas fa-info-circle text-blue-500 mr-1"></i> Batarya BOM'daki miktarlar bu sayı ile çarpılır
              </p>
            </div>
            ${templates.length > 0 ? `
              <div class="glass-card rounded-xl p-4 border-2 border-purple-300">
                <label class="block text-sm font-bold text-white mb-2">
                  <i class="fas fa-rocket text-purple-400 mr-2"></i> BOM Şablonu Seç (Opsiyonel)
                </label>
                <select id="templateSelect" 
                  class="w-full px-4 py-3 border-2 border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium bg-gray-800/50 text-white">
                  <option value="">Şablon seçme (sonra manuel yükle)</option>
                  ${templates.map(t => `
                    <option value="${t.id}">${t.template_name} (${t.item_count} malzeme)</option>
                  `).join('')}
                </select>
                <p class="text-xs text-gray-400 mt-2">
                  <i class="fas fa-lightbulb text-yellow-500 mr-1"></i> 
                  Şablon seçerseniz OTPA oluşturulurken otomatik BOM yüklenecek
                </p>
              </div>
            ` : ''}
            <div>
              <label class="block text-sm font-semibold text-gray-300 mb-2">Durum</label>
              <select id="status" 
                class="w-full px-4 py-3 border-2 border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium bg-gray-800/50 text-white">
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
                class="px-6 py-3 bg-gray-700 text-gray-300 font-semibold rounded-xl hover:bg-gray-600 transition">
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
              class="text-gray-400 hover:text-red-400 transition-colors duration-200 p-2 hover:bg-red-500/10 rounded-xl">
              <i class="fas fa-times text-3xl"></i>
            </button>
          </div>

          <!-- Template Selection -->
          ${templates.length > 0 ? `
            <div class="glass-card rounded-xl p-4 mb-6 border-2 border-purple-300">
              <h3 class="font-bold text-white mb-3">
                <i class="fas fa-rocket text-purple-400 mr-2"></i> Hızlı Yükleme: Şablondan Seç
              </h3>
              <div class="flex gap-3 items-end">
                <div class="flex-1">
                  <select id="templateSelect" 
                    class="w-full px-4 py-3 border-2 border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 font-medium bg-gray-800/50 text-white">
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
              <p class="text-xs text-gray-400 mt-2">
                <i class="fas fa-info-circle mr-1"></i> Şablon uygulandığında mevcut BOM silinip yerine şablon malzemeleri eklenecektir
              </p>
            </div>
            <div class="relative my-6">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-white/10"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-4 text-gray-400 font-medium">veya Excel'den yapıştır</span>
              </div>
            </div>
          ` : ''}
          
          <div class="glass-card rounded-xl p-4 mb-6">
            <h3 class="font-semibold mb-2"><i class="fas fa-info-circle text-blue-400 mr-2"></i>4 Komponent İçin Ayrı Ayrı BOM Yükleyin</h3>
            <p class="text-sm text-gray-300"><strong>Batarya:</strong> Paket sayısıyla çarpılır (örn: 8x veya 10x)</p>
            <p class="text-sm text-gray-300"><strong>VCCU, Junction Box, PDU:</strong> Her zaman 1x (araçta 1'er adet)</p>
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
              <label class="block text-sm font-semibold text-gray-300 mb-2">BOM Verileri (Ctrl+V ile yapıştırın) *</label>
              <textarea id="bomData" rows="10" required placeholder="Excel'den kopyalanan verileri buraya yapıştırın...
Örnek (TAB ile ayrılmış):
MAT-001	Lityum Hücre 18650	100	adet
MAT-002	BMS Kartı	10	adet
MAT-003	Nikel Şerit	500	gr"
                class="w-full px-4 py-3 border-2 border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm transition-all duration-200 bg-gray-800/50 text-white"></textarea>
              <p class="text-xs text-gray-400 mt-2">
                <i class="fas fa-lightbulb text-yellow-500 mr-1"></i> 
                4 sütun: Malzeme Kodu | Malzeme Adı | Miktar | Birim
              </p>
            </div>
            
            <div id="previewContainer" class="hidden">
              <h4 class="font-semibold mb-2 text-white">Önizleme:</h4>
              <div class="glass-card rounded-xl overflow-hidden">
                <table class="min-w-full divide-y divide-white/5 text-sm">
                  <thead class="bg-gradient-to-r from-purple-900/30 to-blue-900/30">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase">Malzeme Kodu</th>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase">Malzeme Adı</th>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase">Miktar</th>
                      <th class="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase">Birim</th>
                    </tr>
                  </thead>
                  <tbody id="previewBody" class="divide-y divide-white/5">
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
                class="px-6 py-3 bg-gray-700 text-gray-300 font-semibold rounded-xl hover:bg-gray-600 transition">
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
        btn.classList.remove('text-gray-400', 'hover:text-white');
      } else {
        btn.classList.remove('gradient-btn', 'shadow-lg');
        btn.classList.add('text-gray-400', 'hover:text-white');
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
      <p class="text-gray-300 mb-4">
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
        <button class="cancel-btn w-full px-6 py-3 bg-gray-700 text-gray-300 font-semibold rounded-xl hover:bg-gray-600 transition">
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
          <div class="glass-card rounded-2xl">
            <div class="px-6 py-4 border-b bg-red-500/10">
              <h3 class="text-lg font-semibold text-red-400">
                <i class="fas fa-exclamation-triangle mr-2"></i>Eksik Malzemeler
              </h3>
              <p class="text-sm text-red-400/80 mt-1">Acil tedarik gerektiren malzemeler</p>
            </div>
            
            <!-- Filtreleme ve Toplu İşlemler -->
            <div class="px-6 py-4 border-b">
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label class="block text-xs font-medium text-gray-400 mb-1">OTPA Filtrele</label>
                  <input type="text" id="filterMissingOtpa" placeholder="OTPA ara..." 
                    class="w-full px-3 py-2 border border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-gray-800/50 text-white">
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-400 mb-1">Proje Filtrele</label>
                  <input type="text" id="filterMissingProject" placeholder="Proje ara..." 
                    class="w-full px-3 py-2 border border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-gray-800/50 text-white">
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-400 mb-1">Component Filtrele</label>
                  <select id="filterMissingComponent" 
                    class="w-full px-3 py-2 border border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-medium bg-gray-800/50 text-white">
                    <option value="">Tümü</option>
                    <option value="batarya">🔋 Batarya</option>
                    <option value="vccu">⚡ VCCU</option>
                    <option value="junction_box">📦 Junction Box</option>
                    <option value="pdu">🔌 PDU</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-400 mb-1">Malzeme Filtrele</label>
                  <input type="text" id="filterMissingMaterial" placeholder="Malzeme kodu/adı ara..." 
                    class="w-full px-3 py-2 border border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-gray-800/50 text-white">
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
                <span class="text-sm text-gray-400 ml-2">
                  Seçilen malzemeler tam miktarıyla girilecek
                </span>
              </div>
            </div>
            
            <div class="overflow-x-auto">
              ${missing.length === 0 ? `
                <div class="px-6 py-8 text-center text-gray-400">
                  <i class="fas fa-check-circle text-4xl text-green-500 mb-2"></i>
                  <p>Tüm malzemeler tamamlandı! 🎉</p>
                </div>
              ` : `
                <table class="min-w-full divide-y divide-white/5">
                  <thead>
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        <input type="checkbox" id="selectAllCheckbox" onclick="adminPage.toggleSelectAll()"
                          class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500">
                      </th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">OTPA</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Proje</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Component</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Malzeme</th>
                      <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Gereken</th>
                      <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Gelen</th>
                      <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Eksik</th>
                      <th class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">Durum</th>
                    </tr>
                  </thead>
                  <tbody id="missingMaterialsTable" class="divide-y divide-white/5">
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
                      <tr class="hover:bg-white/[0.03]" data-otpa="${item.otpa_number}" data-project="${item.project_name || ''}" data-component="${item.component_type || ''}" data-material="${item.material_code} ${item.material_name}"
                          data-otpa-id="${item.otpa_id}" data-material-code="${item.material_code}" data-component-type="${item.component_type}" data-required-quantity="${item.required_quantity}">
                        <td class="px-6 py-4">
                          <input type="checkbox" class="material-checkbox w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            onchange="adminPage.updateSelectedCount()">
                        </td>
                        <td class="px-6 py-4 font-medium">${item.otpa_number}</td>
                        <td class="px-6 py-4 text-sm">${item.project_name || ''}</td>
                        <td class="px-6 py-4">
                          <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                            item.component_type === 'batarya' ? 'bg-emerald-500/15 text-emerald-400' :
                            item.component_type === 'vccu' ? 'bg-amber-500/15 text-amber-400' :
                            item.component_type === 'junction_box' ? 'bg-blue-500/15 text-blue-400' :
                            item.component_type === 'pdu' ? 'bg-purple-500/15 text-purple-400' : 'bg-gray-500/15 text-gray-400'
                          }">
                            ${componentIcons[item.component_type] || '❓'} ${componentLabels[item.component_type] || item.component_type}
                          </span>
                        </td>
                        <td class="px-6 py-4">
                          <div class="font-medium">${item.material_code}</div>
                          <div class="text-xs text-gray-400">${item.material_name}</div>
                        </td>
                        <td class="px-6 py-4 text-right">${item.required_quantity} ${item.unit}</td>
                        <td class="px-6 py-4 text-right text-green-400">${item.accepted_quantity || 0} ${item.unit}</td>
                        <td class="px-6 py-4 text-right font-bold text-red-400">${item.missing_quantity} ${item.unit}</td>
                        <td class="px-6 py-4 text-center">
                          <span class="px-2 py-1 text-xs rounded ${item.status === 'Hiç Gelmedi' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}">
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
          <div class="glass-card rounded-2xl">
            <div class="px-6 py-4 border-b border-white/5">
              <h3 class="text-lg font-semibold">
                <i class="fas fa-history mr-2"></i>Malzeme Giriş Geçmişi
              </h3>
              <p class="text-sm text-gray-400 mt-1">Tüm malzeme girişleri ve kalite durumları</p>
            </div>
            <div class="overflow-x-auto">
              ${allReceipts.length === 0 ? `
                <div class="px-6 py-8 text-center text-gray-400">
                  Henüz malzeme girişi yapılmamış
                </div>
              ` : `
                <table class="min-w-full divide-y divide-white/5 text-sm">
                  <thead>
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tarih</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">OTPA</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Malzeme</th>
                      <th class="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Giren Miktar</th>
                      <th class="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Kabul</th>
                      <th class="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Red</th>
                      <th class="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Kalite</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Giriş Yapan</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    ${allReceipts.slice(0, 50).map(receipt => {
                      const statusColors = {
                        'kabul': 'bg-emerald-500/15 text-emerald-400',
                        'iade': 'bg-amber-500/15 text-amber-400',
                        'bekliyor': 'bg-gray-500/15 text-gray-400'
                      };
                      const statusLabels = {
                        'kabul': '✅ Kabul',
                        'iade': '↩️ İade',
                        'bekliyor': '⏳ Bekliyor'
                      };
                      return `
                      <tr class="hover:bg-white/[0.03]">
                        <td class="px-4 py-3 whitespace-nowrap">${new Date(receipt.created_at).toLocaleString('tr-TR')}</td>
                        <td class="px-4 py-3 font-medium">${receipt.otpa_number || 'N/A'}</td>
                        <td class="px-4 py-3">
                          <div class="font-medium">${receipt.material_code}</div>
                          <div class="text-xs text-gray-400">${receipt.material_name || ''}</div>
                        </td>
                        <td class="px-4 py-3 text-right font-medium">${receipt.received_quantity} ${receipt.unit || ''}</td>
                        <td class="px-4 py-3 text-right text-green-400">${receipt.accepted_quantity || 0}</td>
                        <td class="px-4 py-3 text-right text-red-400">${receipt.rejected_quantity || 0}</td>
                        <td class="px-4 py-3 text-center">
                          <span class="px-2 py-1 text-xs rounded ${statusColors[receipt.quality_status] || 'bg-gray-500/15 text-gray-400'}">
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
          <div class="glass-card rounded-2xl">
            <div class="px-6 py-4 border-b border-white/5">
              <h3 class="text-lg font-semibold">
                <i class="fas fa-chart-pie mr-2"></i>OTPA Tamamlama Raporu
              </h3>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-white/5">
                <thead>
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">OTPA</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Proje</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Toplam</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Tamamlanan</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">%</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  ${completion.map(item => `
                    <tr>
                      <td class="px-6 py-4 font-medium">${item.otpa_number}</td>
                      <td class="px-6 py-4">${item.project_name}</td>
                      <td class="px-6 py-4 text-right">${item.total_items || 0}</td>
                      <td class="px-6 py-4 text-right">${item.completed_items || 0}</td>
                      <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                          <span class="font-bold ${(item.completion_percentage || 0) >= 100 ? 'text-green-400' : 'text-blue-400'}">
                            ${item.completion_percentage || 0}%
                          </span>
                          <div class="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
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
          <div class="glass-card rounded-2xl">
            <div class="px-6 py-4 border-b border-white/5">
              <h3 class="text-lg font-semibold">
                <i class="fas fa-times-circle mr-2"></i>Red/İade Kayıtları
              </h3>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-white/5 text-sm">
                <thead>
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tarih</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">OTPA</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Malzeme</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Durum</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Red Miktarı</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Neden</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Karar Veren</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  ${rejections.slice(0, 20).map(item => `
                    <tr class="hover:bg-white/[0.03]">
                      <td class="px-4 py-3 whitespace-nowrap">${new Date(item.decision_date).toLocaleString('tr-TR')}</td>
                      <td class="px-4 py-3 font-medium">${item.otpa_number}</td>
                      <td class="px-4 py-3">
                        <div class="font-medium">${item.material_code}</div>
                        <div class="text-xs text-gray-400">${item.material_name}</div>
                      </td>
                      <td class="px-4 py-3">
                        <span class="px-2 py-1 text-xs rounded ${item.status === 'red' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}">
                          ${item.status === 'red' ? '❌ Red' : '⚠️ Şartlı Kabul'}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right font-bold text-red-400">${item.rejected_quantity}</td>
                      <td class="px-4 py-3 text-sm text-gray-400">${item.reason || '-'}</td>
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
        <div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded">
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
      const [users, roles] = await Promise.all([
        api.auth.getUsers(),
        api.roles.list().catch(() => [])
      ]);

      // Rol display name haritası oluştur
      this._roleDisplayMap = {};
      roles.forEach(r => {
        this._roleDisplayMap[r.name] = r.display_name;
      });

      container.innerHTML = `
        <div class="space-y-6">
          <div>
            <button onclick="adminPage.showCreateUserModal()" 
              class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
              <i class="fas fa-user-plus mr-2"></i> Yeni Kullanıcı Ekle
            </button>
          </div>

          <div class="glass-card rounded-2xl overflow-hidden">
            <table class="min-w-full divide-y divide-white/5">
              <thead>
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Kullanıcı Adı</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ad Soyad</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rol</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Durum</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Kayıt Tarihi</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">İşlem</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                ${users.map(user => `
                  <tr>
                    <td class="px-6 py-4 font-medium">${user.username}</td>
                    <td class="px-6 py-4">${user.full_name}</td>
                    <td class="px-6 py-4">${this.getRoleBadge(user.role)}</td>
                    <td class="px-6 py-4">
                      ${user.is_active 
                        ? '<span class="text-green-400">✓ Aktif</span>' 
                        : '<span class="text-red-400">✗ Pasif</span>'}
                    </td>
                    <td class="px-6 py-4 text-sm">${new Date(user.created_at).toLocaleDateString('tr-TR')}</td>
                    <td class="px-6 py-4">
                      <button onclick="adminPage.showEditUserModal(${user.id}, '${user.username}', '${user.full_name.replace(/'/g, "\\'")}', '${user.role}', ${user.is_active ? 'true' : 'false'})" 
                        class="text-blue-400 hover:text-blue-300 font-medium text-sm">
                        <i class="fas fa-edit mr-1"></i>Düzenle
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
        <div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded">
          ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  async showCreateUserModal() {
    // Rolleri API'den çek
    let roles = [];
    try {
      roles = await api.roles.list();
    } catch (e) {
      console.warn('Roller yüklenemedi, varsayılanlar kullanılacak');
    }

    const roleOptions = roles.length > 0 
      ? roles.map(r => `<option value="${r.name}">${r.display_name}</option>`).join('')
      : `<option value="viewer">Yeni Kullanıcı (Viewer)</option>
         <option value="tekniker">Tekniker</option>
         <option value="kalite">Kalite</option>
         <option value="proje_yonetici">Proje Yöneticisi</option>
         <option value="admin">Admin</option>`;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="glass-card rounded-2xl shadow-xl max-w-lg w-full">
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
                ${roleOptions}
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

  async showEditUserModal(userId, username, fullName, role, isActive) {
    // Rolleri API'den çek
    let roles = [];
    try {
      roles = await api.roles.list();
    } catch (e) {
      console.warn('Roller yüklenemedi');
    }

    const roleOptions = roles.length > 0 
      ? roles.map(r => `<option value="${r.name}" ${role === r.name ? 'selected' : ''}>${r.display_name}</option>`).join('')
      : `<option value="viewer" ${role === 'viewer' ? 'selected' : ''}>Yeni Kullanıcı (Viewer)</option>
         <option value="tekniker" ${role === 'tekniker' ? 'selected' : ''}>Tekniker</option>
         <option value="kalite" ${role === 'kalite' ? 'selected' : ''}>Kalite</option>
         <option value="proje_yonetici" ${role === 'proje_yonetici' ? 'selected' : ''}>Proje Yöneticisi</option>
         <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>`;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="glass-card rounded-2xl shadow-xl max-w-lg w-full">
        <div class="p-6">
          <h2 class="text-2xl font-bold mb-4"><i class="fas fa-user-edit mr-2 text-blue-400"></i>Kullanıcı Düzenle</h2>
          <form id="editUserForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Kullanıcı Adı</label>
              <input type="text" value="${username}" disabled
                class="w-full px-3 py-2 border rounded-lg bg-gray-800/50 text-gray-400 border-white/10">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Ad Soyad *</label>
              <input type="text" id="editFullName" value="${fullName}" required 
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Rol *</label>
              <select id="editRole" required 
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                ${roleOptions}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Durum</label>
              <select id="editActive" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="true" ${isActive ? 'selected' : ''}>✓ Aktif</option>
                <option value="false" ${!isActive ? 'selected' : ''}>✗ Pasif</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Yeni Şifre <span class="text-gray-400 font-normal">(değiştirmek istemiyorsanız boş bırakın)</span></label>
              <input type="password" id="editPassword" placeholder="En az 6 karakter"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="flex gap-3 pt-4">
              <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <i class="fas fa-save mr-2"></i> Güncelle
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

    modal.querySelector('#editUserForm').onsubmit = async (e) => {
      e.preventDefault();
      
      const newPassword = modal.querySelector('#editPassword').value;
      if (newPassword && newPassword.length < 6) {
        alert('Şifre en az 6 karakter olmalıdır');
        return;
      }

      try {
        showLoading(true);
        
        const data = {
          full_name: modal.querySelector('#editFullName').value,
          role: modal.querySelector('#editRole').value,
          is_active: modal.querySelector('#editActive').value === 'true'
        };

        if (newPassword) {
          data.password = newPassword;
        }

        await api.auth.updateUser(userId, data);

        modal.remove();
        alert('✅ Kullanıcı başarıyla güncellendi!');
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
        <div class="glass-card rounded-2xl shadow-xl max-w-lg w-full">
          <div class="p-6">
            <h2 class="text-2xl font-bold mb-4">OTPA Düzenle</h2>
            <form id="editOtpaForm" class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-2">OTPA Numarası</label>
                <input type="text" value="${otpa.otpa.otpa_number}" disabled
                  class="w-full px-3 py-2 border border-white/10 rounded-lg bg-gray-800/50 text-gray-400">
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
      'acik': 'bg-emerald-500/15 text-emerald-400',
      'uretimde': 'bg-blue-500/15 text-blue-400',
      'kapali': 'bg-gray-500/15 text-gray-400'
    };
    return `<span class="px-2 py-1 text-xs rounded-full ${map[status] || map.acik}">${status}</span>`;
  },

  // ========================= ROLLER & İZİNLER TAB =========================

  // Modül tanımları
  getModuleDefinitions() {
    return [
      { key: 'dashboard', label: 'Ana Sayfa', icon: 'fas fa-home' },
      { key: 'goods-receipt', label: 'Malzeme Girişi', icon: 'fas fa-box' },
      { key: 'returns', label: 'İadeler', icon: 'fas fa-undo' },
      { key: 'quality', label: 'Kalite Kontrol', icon: 'fas fa-check-circle' },
      { key: 'projects', label: 'Proje Takip', icon: 'fas fa-project-diagram' },
      { key: 'technicians', label: 'Tekniker Takip', icon: 'fas fa-user-cog' },
      { key: 'taskboard', label: 'Görev Panosu', icon: 'fas fa-tasks' },
      { key: 'paket-analiz', label: 'Paket Analiz', icon: 'fas fa-battery-full' },
      { key: 'prosedur-otpa', label: 'Prosedür & OTPA', icon: 'fas fa-file-alt' },
      { key: 'field-changelog', label: 'Saha Değişiklik', icon: 'fas fa-history' },
      { key: 'admin', label: 'Yönetim Paneli', icon: 'fas fa-cog' }
    ];
  },

  async renderRolesTab() {
    const container = document.getElementById('tabContent');

    try {
      showLoading(true);
      const roles = await api.roles.list();

      container.innerHTML = `
        <div class="space-y-6 fade-in">
          <!-- Üst Bar -->
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold text-white">
                <i class="fas fa-shield-alt mr-2 text-purple-400"></i> Rol & Yetki Yönetimi
              </h2>
              <p class="text-sm text-gray-400 mt-1">Rolleri oluşturun, düzenleyin ve her rol için ekran/işlem izinlerini ayarlayın</p>
            </div>
            <button onclick="adminPage.showCreateRoleModal()" 
              class="gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 hover-lift">
              <i class="fas fa-plus mr-2"></i> Yeni Rol Oluştur
            </button>
          </div>

          <!-- Rol Kartları -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            ${roles.map(role => this.renderRoleCard(role)).join('')}
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
          <i class="fas fa-exclamation-triangle mr-2"></i> ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  renderRoleCard(role) {
    const modules = this.getModuleDefinitions();
    const permMap = {};
    (role.permissions || []).forEach(p => {
      permMap[p.module] = p;
    });

    const viewCount = Object.values(permMap).filter(p => p.can_view).length;
    const totalModules = modules.length;

    const roleColors = {
      'admin': 'purple',
      'kalite': 'emerald',
      'tekniker': 'blue',
      'proje_yonetici': 'orange',
      'viewer': 'gray'
    };
    const color = roleColors[role.name] || 'indigo';

    return `
      <div class="glass-card rounded-2xl overflow-hidden border border-${color}-500/20">
        <!-- Rol Başlık -->
        <div class="p-5 border-b border-white/5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-${color}-500/15 rounded-xl flex items-center justify-center">
                <i class="fas fa-user-shield text-${color}-400"></i>
              </div>
              <div>
                <h3 class="font-bold text-white text-lg">${role.display_name}</h3>
                <p class="text-xs text-gray-400">${role.name} ${role.is_system ? '<span class="text-yellow-400 ml-1"><i class="fas fa-lock text-[10px]"></i> Sistem</span>' : ''}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs bg-${color}-500/10 text-${color}-400 px-2 py-1 rounded-lg font-medium">
                ${viewCount}/${totalModules} modül
              </span>
              <button onclick="adminPage.showEditPermissionsModal(${role.id})" 
                class="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all" title="İzinleri Düzenle">
                <i class="fas fa-edit"></i>
              </button>
              ${!role.is_system ? `
                <button onclick="adminPage.deleteRole(${role.id}, '${role.display_name}')" 
                  class="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all" title="Rolü Sil">
                  <i class="fas fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </div>
          ${role.description ? `<p class="text-sm text-gray-400 mt-2">${role.description}</p>` : ''}
        </div>
        
        <!-- İzin Özet Tablosu -->
        <div class="p-4">
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-gray-500">
                  <th class="text-left py-1 pr-2 font-medium">Modül</th>
                  <th class="text-center py-1 px-1 font-medium">Görüntüle</th>
                  <th class="text-center py-1 px-1 font-medium">Oluştur</th>
                  <th class="text-center py-1 px-1 font-medium">Düzenle</th>
                  <th class="text-center py-1 px-1 font-medium">Sil</th>
                </tr>
              </thead>
              <tbody>
                ${modules.map(mod => {
                  const p = permMap[mod.key] || {};
                  return `
                    <tr class="border-t border-white/[0.03]">
                      <td class="py-1.5 pr-2">
                        <span class="text-gray-300"><i class="${mod.icon} text-gray-500 mr-1 w-4 text-center"></i> ${mod.label}</span>
                      </td>
                      <td class="text-center py-1.5">${p.can_view ? '<i class="fas fa-check text-green-400"></i>' : '<i class="fas fa-minus text-gray-600"></i>'}</td>
                      <td class="text-center py-1.5">${p.can_create ? '<i class="fas fa-check text-green-400"></i>' : '<i class="fas fa-minus text-gray-600"></i>'}</td>
                      <td class="text-center py-1.5">${p.can_edit ? '<i class="fas fa-check text-green-400"></i>' : '<i class="fas fa-minus text-gray-600"></i>'}</td>
                      <td class="text-center py-1.5">${p.can_delete ? '<i class="fas fa-check text-green-400"></i>' : '<i class="fas fa-minus text-gray-600"></i>'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  showCreateRoleModal() {
    const modules = this.getModuleDefinitions();

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="glass-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold gradient-text">
              <i class="fas fa-plus-circle mr-2"></i> Yeni Rol Oluştur
            </h2>
            <button onclick="this.closest('.fixed').remove()" 
              class="text-gray-400 hover:text-red-400 transition-colors p-2 hover:bg-red-500/10 rounded-xl">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>

          <form id="createRoleForm" class="space-y-5">
            <!-- Rol Bilgileri -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-gray-300 mb-1">Rol Adı (Teknik) *</label>
                <input type="text" id="roleName" required placeholder="ornek_rol"
                  class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-blue-500 focus:outline-none transition-all text-white"
                  pattern="[a-z0-9_]+" title="Sadece küçük harf, rakam ve alt çizgi kullanılabilir">
              </div>
              <div>
                <label class="block text-sm font-semibold text-gray-300 mb-1">Görünen Ad *</label>
                <input type="text" id="roleDisplayName" required placeholder="Örnek Rol"
                  class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-blue-500 focus:outline-none transition-all text-white">
              </div>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-300 mb-1">Açıklama</label>
              <input type="text" id="roleDescription" placeholder="Rol hakkında kısa bilgi..."
                class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-blue-500 focus:outline-none transition-all text-white">
            </div>

            <!-- İzin Matrisi -->
            <div>
              <h3 class="text-sm font-bold text-gray-300 mb-3">
                <i class="fas fa-key mr-1 text-yellow-400"></i> İzinler
              </h3>
              <div class="glass-card rounded-xl overflow-hidden">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="bg-white/[0.03]">
                      <th class="text-left py-3 px-4 font-semibold text-gray-300">Modül</th>
                      <th class="text-center py-3 px-2 font-semibold text-gray-300">Görüntüle</th>
                      <th class="text-center py-3 px-2 font-semibold text-gray-300">Oluştur</th>
                      <th class="text-center py-3 px-2 font-semibold text-gray-300">Düzenle</th>
                      <th class="text-center py-3 px-2 font-semibold text-gray-300">Sil</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${modules.map(mod => `
                      <tr class="border-t border-white/[0.03] hover:bg-white/[0.02]">
                        <td class="py-2.5 px-4">
                          <span class="text-gray-200"><i class="${mod.icon} text-gray-400 mr-2 w-4 text-center"></i>${mod.label}</span>
                        </td>
                        <td class="text-center py-2.5 px-2">
                          <input type="checkbox" data-module="${mod.key}" data-perm="view" 
                            class="perm-checkbox w-4 h-4 rounded accent-green-500 cursor-pointer"
                            onchange="adminPage.onPermCheckboxChange(this)">
                        </td>
                        <td class="text-center py-2.5 px-2">
                          <input type="checkbox" data-module="${mod.key}" data-perm="create" 
                            class="perm-checkbox w-4 h-4 rounded accent-blue-500 cursor-pointer">
                        </td>
                        <td class="text-center py-2.5 px-2">
                          <input type="checkbox" data-module="${mod.key}" data-perm="edit" 
                            class="perm-checkbox w-4 h-4 rounded accent-yellow-500 cursor-pointer">
                        </td>
                        <td class="text-center py-2.5 px-2">
                          <input type="checkbox" data-module="${mod.key}" data-perm="delete" 
                            class="perm-checkbox w-4 h-4 rounded accent-red-500 cursor-pointer">
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              <!-- Toplu Seçim -->
              <div class="flex gap-2 mt-3">
                <button type="button" onclick="adminPage.bulkSelectPermissions(true)" 
                  class="text-xs px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-all">
                  <i class="fas fa-check-double mr-1"></i> Tümünü Seç
                </button>
                <button type="button" onclick="adminPage.bulkSelectPermissions(false)" 
                  class="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all">
                  <i class="fas fa-times mr-1"></i> Tümünü Kaldır
                </button>
                <button type="button" onclick="adminPage.bulkSelectColumn('view', true)" 
                  class="text-xs px-3 py-1.5 bg-gray-500/10 text-gray-400 rounded-lg hover:bg-gray-500/20 transition-all">
                  Tüm Görüntüle
                </button>
              </div>
            </div>

            <!-- Submit -->
            <div class="flex gap-3 pt-4">
              <button type="submit" 
                class="flex-1 gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200">
                <i class="fas fa-save mr-2"></i> Rolü Oluştur
              </button>
              <button type="button" onclick="this.closest('.fixed').remove()" 
                class="px-6 py-3 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10 font-semibold transition-all">
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#createRoleForm').onsubmit = async (e) => {
      e.preventDefault();

      const name = modal.querySelector('#roleName').value.trim();
      const display_name = modal.querySelector('#roleDisplayName').value.trim();
      const description = modal.querySelector('#roleDescription').value.trim();

      // Permissions toplama
      const permissions = this.collectPermissionsFromForm(modal);

      try {
        showLoading(true);
        await api.roles.create({ name, display_name, description, permissions });
        modal.remove();
        alert('✅ Rol başarıyla oluşturuldu!');
        this.renderRolesTab();
      } catch (error) {
        alert('Hata: ' + error.message);
      } finally {
        showLoading(false);
      }
    };
  },

  async showEditPermissionsModal(roleId) {
    try {
      showLoading(true);
      const role = await api.roles.get(roleId);
      const modules = this.getModuleDefinitions();

      const permMap = {};
      (role.permissions || []).forEach(p => {
        permMap[p.module] = p;
      });

      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
      modal.innerHTML = `
        <div class="glass-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <div class="flex justify-between items-center mb-6">
              <div>
                <h2 class="text-2xl font-bold gradient-text">
                  <i class="fas fa-shield-alt mr-2"></i> ${role.display_name}
                </h2>
                <p class="text-sm text-gray-400 mt-1">Ekran ve işlem izinlerini düzenleyin</p>
              </div>
              <button onclick="this.closest('.fixed').remove()" 
                class="text-gray-400 hover:text-red-400 transition-colors p-2 hover:bg-red-500/10 rounded-xl">
                <i class="fas fa-times text-xl"></i>
              </button>
            </div>

            <!-- Rol Bilgileri -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <label class="block text-sm font-semibold text-gray-300 mb-1">Görünen Ad</label>
                <input type="text" id="editRoleDisplayName" value="${role.display_name}"
                  class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-blue-500 focus:outline-none transition-all text-white"
                  ${role.is_system ? '' : ''}>
              </div>
              <div>
                <label class="block text-sm font-semibold text-gray-300 mb-1">Açıklama</label>
                <input type="text" id="editRoleDescription" value="${role.description || ''}"
                  class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-blue-500 focus:outline-none transition-all text-white">
              </div>
            </div>

            <!-- İzin Matrisi -->
            <div class="glass-card rounded-xl overflow-hidden mb-4">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-white/[0.03]">
                    <th class="text-left py-3 px-4 font-semibold text-gray-300">Modül</th>
                    <th class="text-center py-3 px-2 font-semibold text-gray-300">
                      <div class="flex flex-col items-center">
                        <span>Görüntüle</span>
                        <button type="button" onclick="adminPage.bulkSelectColumn('view')" class="text-[10px] text-blue-400 hover:text-blue-300 mt-0.5">hepsi</button>
                      </div>
                    </th>
                    <th class="text-center py-3 px-2 font-semibold text-gray-300">
                      <div class="flex flex-col items-center">
                        <span>Oluştur</span>
                        <button type="button" onclick="adminPage.bulkSelectColumn('create')" class="text-[10px] text-blue-400 hover:text-blue-300 mt-0.5">hepsi</button>
                      </div>
                    </th>
                    <th class="text-center py-3 px-2 font-semibold text-gray-300">
                      <div class="flex flex-col items-center">
                        <span>Düzenle</span>
                        <button type="button" onclick="adminPage.bulkSelectColumn('edit')" class="text-[10px] text-blue-400 hover:text-blue-300 mt-0.5">hepsi</button>
                      </div>
                    </th>
                    <th class="text-center py-3 px-2 font-semibold text-gray-300">
                      <div class="flex flex-col items-center">
                        <span>Sil</span>
                        <button type="button" onclick="adminPage.bulkSelectColumn('delete')" class="text-[10px] text-blue-400 hover:text-blue-300 mt-0.5">hepsi</button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${modules.map(mod => {
                    const p = permMap[mod.key] || {};
                    return `
                      <tr class="border-t border-white/[0.03] hover:bg-white/[0.02]">
                        <td class="py-2.5 px-4">
                          <span class="text-gray-200"><i class="${mod.icon} text-gray-400 mr-2 w-4 text-center"></i>${mod.label}</span>
                        </td>
                        <td class="text-center py-2.5 px-2">
                          <input type="checkbox" data-module="${mod.key}" data-perm="view" 
                            class="perm-checkbox w-4 h-4 rounded accent-green-500 cursor-pointer"
                            ${p.can_view ? 'checked' : ''}
                            onchange="adminPage.onPermCheckboxChange(this)">
                        </td>
                        <td class="text-center py-2.5 px-2">
                          <input type="checkbox" data-module="${mod.key}" data-perm="create" 
                            class="perm-checkbox w-4 h-4 rounded accent-blue-500 cursor-pointer"
                            ${p.can_create ? 'checked' : ''}>
                        </td>
                        <td class="text-center py-2.5 px-2">
                          <input type="checkbox" data-module="${mod.key}" data-perm="edit" 
                            class="perm-checkbox w-4 h-4 rounded accent-yellow-500 cursor-pointer"
                            ${p.can_edit ? 'checked' : ''}>
                        </td>
                        <td class="text-center py-2.5 px-2">
                          <input type="checkbox" data-module="${mod.key}" data-perm="delete" 
                            class="perm-checkbox w-4 h-4 rounded accent-red-500 cursor-pointer"
                            ${p.can_delete ? 'checked' : ''}>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Toplu Seçim -->
            <div class="flex gap-2 mb-5">
              <button type="button" onclick="adminPage.bulkSelectPermissions(true)" 
                class="text-xs px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-all">
                <i class="fas fa-check-double mr-1"></i> Tümünü Seç
              </button>
              <button type="button" onclick="adminPage.bulkSelectPermissions(false)" 
                class="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all">
                <i class="fas fa-times mr-1"></i> Tümünü Kaldır
              </button>
            </div>

            <!-- Submit -->
            <div class="flex gap-3">
              <button onclick="adminPage.saveRolePermissions(${role.id})" 
                class="flex-1 gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200">
                <i class="fas fa-save mr-2"></i> Kaydet
              </button>
              <button onclick="this.closest('.fixed').remove()" 
                class="px-6 py-3 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10 font-semibold transition-all">
                İptal
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  // Görüntüle checkbox kapatıldığında diğerlerini de kapat
  onPermCheckboxChange(checkbox) {
    const module = checkbox.dataset.module;
    const perm = checkbox.dataset.perm;
    
    if (perm === 'view' && !checkbox.checked) {
      // View kapatılınca diğer tüm izinler de kapatılsın
      const row = checkbox.closest('tr');
      row.querySelectorAll('.perm-checkbox').forEach(cb => {
        if (cb !== checkbox) cb.checked = false;
      });
    } else if (perm !== 'view' && checkbox.checked) {
      // Herhangi bir izin açılınca view da otomatik açılsın
      const row = checkbox.closest('tr');
      const viewCb = row.querySelector('[data-perm="view"]');
      if (viewCb && !viewCb.checked) viewCb.checked = true;
    }
  },

  bulkSelectPermissions(checked) {
    document.querySelectorAll('.perm-checkbox').forEach(cb => cb.checked = checked);
  },

  bulkSelectColumn(perm, toggle) {
    const checkboxes = document.querySelectorAll(`[data-perm="${perm}"]`);
    // toggle: tümü açıksa kapat, değilse aç
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const newState = toggle !== undefined ? toggle : !allChecked;
    checkboxes.forEach(cb => {
      cb.checked = newState;
      if (perm !== 'view' && newState) {
        // view de açılmalı
        const row = cb.closest('tr');
        const viewCb = row.querySelector('[data-perm="view"]');
        if (viewCb) viewCb.checked = true;
      }
    });
  },

  collectPermissionsFromForm(container) {
    const modules = this.getModuleDefinitions();
    const permissions = [];

    for (const mod of modules) {
      const viewCb = container.querySelector(`[data-module="${mod.key}"][data-perm="view"]`);
      const createCb = container.querySelector(`[data-module="${mod.key}"][data-perm="create"]`);
      const editCb = container.querySelector(`[data-module="${mod.key}"][data-perm="edit"]`);
      const deleteCb = container.querySelector(`[data-module="${mod.key}"][data-perm="delete"]`);

      permissions.push({
        module: mod.key,
        can_view: viewCb ? viewCb.checked : false,
        can_create: createCb ? createCb.checked : false,
        can_edit: editCb ? editCb.checked : false,
        can_delete: deleteCb ? deleteCb.checked : false
      });
    }

    return permissions;
  },

  async saveRolePermissions(roleId) {
    const modal = document.querySelector('.fixed');
    if (!modal) return;

    const permissions = this.collectPermissionsFromForm(modal);
    const display_name = modal.querySelector('#editRoleDisplayName')?.value?.trim();
    const description = modal.querySelector('#editRoleDescription')?.value?.trim();

    try {
      showLoading(true);

      // Rol bilgilerini güncelle
      if (display_name) {
        await api.roles.update(roleId, { display_name, description: description || '' });
      }

      // İzinleri güncelle
      await api.roles.updatePermissions(roleId, permissions);

      modal.remove();
      alert('✅ Rol izinleri başarıyla güncellendi!');
      this.renderRolesTab();
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  async deleteRole(roleId, roleName) {
    if (!confirm(`"${roleName}" rolünü silmek istediğinize emin misiniz?\n\nBu role atanmış kullanıcılar varsa silme işlemi başarısız olacaktır.`)) {
      return;
    }

    try {
      showLoading(true);
      await api.roles.delete(roleId);
      alert('✅ Rol başarıyla silindi!');
      this.renderRolesTab();
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  getRoleBadge(role) {
    const map = {
      'viewer': { class: 'bg-gray-500/15 text-gray-400', text: 'Yeni Kullanıcı' },
      'tekniker': { class: 'bg-blue-500/15 text-blue-400', text: 'Tekniker' },
      'kalite': { class: 'bg-emerald-500/15 text-emerald-400', text: 'Kalite' },
      'proje_yonetici': { class: 'bg-orange-500/15 text-orange-400', text: 'Proje Yöneticisi' },
      'admin': { class: 'bg-purple-500/15 text-purple-400', text: 'Admin' }
    };
    // Dinamik roller: display name'i cache'den al
    const displayName = (this._roleDisplayMap && this._roleDisplayMap[role]) || role;
    const r = map[role] || { class: 'bg-indigo-500/15 text-indigo-400', text: displayName };
    // Sistem rollerinde de display name göster
    if (map[role] && this._roleDisplayMap && this._roleDisplayMap[role]) {
      r.text = this._roleDisplayMap[role];
    }
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
            <div class="px-6 py-4 border-b border-white/5">
              <h3 class="text-2xl font-bold gradient-text">
                <i class="fas fa-copy mr-2"></i> Kayıtlı BOM Şablonları
              </h3>
              <p class="text-sm text-gray-400 mt-1">Tekrar kullanılabilir malzeme listeleri</p>
            </div>
            <div class="p-6">
              ${templates.length === 0 ? `
                <div class="text-center py-12">
                  <i class="fas fa-copy text-gray-300 text-6xl mb-4"></i>
                  <h3 class="text-xl font-semibold text-white mb-2">Henüz şablon yok</h3>
                  <p class="text-gray-400">BOM yükledikten sonra şablon olarak kaydedebilirsiniz</p>
                </div>
              ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  ${templates.map(template => `
                    <div class="glass-card rounded-xl p-5 hover-lift border-2 border-white/10 hover:border-purple-400 transition-all duration-200">
                      <div class="flex items-start justify-between mb-3">
                        <div class="flex-1">
                          <h4 class="text-lg font-bold text-white mb-1">${template.template_name}</h4>
                          ${template.description ? `<p class="text-sm text-gray-400">${template.description}</p>` : ''}
                        </div>
                        <span class="ml-2 px-3 py-1 bg-purple-500/15 text-purple-400 rounded-full text-xs font-semibold">
                          ${template.item_count} malzeme
                        </span>
                      </div>
                      <div class="text-xs text-gray-400 mb-4">
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
            class="text-gray-400 hover:text-red-400 transition-colors duration-200 p-2 hover:bg-red-500/10 rounded-xl">
            <i class="fas fa-times text-3xl"></i>
          </button>
        </div>

        <form id="createTemplateForm" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-2">Şablon Adı *</label>
            <input type="text" id="templateName" required
              placeholder="Örn: MD9 Amphenol Batarya BOM"
              class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium text-white">
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-2">Açıklama</label>
            <textarea id="templateDescription" rows="2"
              placeholder="Şablon hakkında not (opsiyonel)"
              class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-white"></textarea>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-2">BOM Verileri (Excel'den Ctrl+V ile yapıştırın) *</label>
            <textarea id="templateBomData" rows="12" required 
              placeholder="Excel'den kopyalanan verileri buraya yapıştırın...
Örnek (TAB ile ayrılmış):
MAT-001	Lityum Hücre 18650	100	adet
MAT-002	BMS Kartı	10	adet
MAT-003	Nikel Şerit	500	gr"
              class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm transition-all duration-200 text-white"></textarea>
            <p class="text-xs text-gray-400 mt-2">
              <i class="fas fa-lightbulb text-yellow-500 mr-1"></i> 
              4 sütun: Malzeme Kodu | Malzeme Adı | Miktar | Birim
            </p>
          </div>

          <div id="templatePreviewContainer" class="hidden">
            <h4 class="font-semibold mb-2 text-white">Önizleme:</h4>
            <div class="glass-card rounded-xl overflow-hidden">
              <table class="min-w-full divide-y divide-white/5 text-sm">
                <thead>
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase">Malzeme Kodu</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase">Malzeme Adı</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase">Miktar</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase">Birim</th>
                  </tr>
                </thead>
                <tbody id="templatePreviewBody" class="divide-y divide-white/5">
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
              class="px-6 py-3 bg-gray-700 text-gray-300 font-semibold rounded-xl hover:bg-gray-600 transition">
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
        <tr class="hover:bg-white/[0.03] transition-all duration-200">
          <td class="px-4 py-3 font-semibold text-white">${item.material_code}</td>
          <td class="px-4 py-3 text-gray-300">${item.material_name}</td>
          <td class="px-4 py-3 font-semibold text-white">${item.quantity}</td>
          <td class="px-4 py-3 text-gray-400">${item.unit}</td>
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
              ${data.template.description ? `<p class="text-sm text-gray-400 mt-1">${data.template.description}</p>` : ''}
            </div>
            <button onclick="this.closest('.fixed').remove()" 
              class="text-gray-400 hover:text-red-400 transition-colors duration-200 p-2 hover:bg-red-500/10 rounded-xl">
              <i class="fas fa-times text-3xl"></i>
            </button>
          </div>

          <div class="glass-card rounded-xl p-4 mb-6">
            <table class="min-w-full divide-y divide-white/5">
              <thead>
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase">Malzeme Kodu</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase">Malzeme Adı</th>
                  <th class="px-4 py-3 text-right text-xs font-bold text-gray-300 uppercase">Miktar</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase">Birim</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                ${data.items.map(item => `
                  <tr class="hover:bg-white/[0.03] transition-all duration-200">
                    <td class="px-4 py-3 font-semibold text-white">${item.material_code}</td>
                    <td class="px-4 py-3 text-gray-300">${item.material_name}</td>
                    <td class="px-4 py-3 text-right font-semibold text-white">${item.quantity}</td>
                    <td class="px-4 py-3 text-gray-400">${item.unit}</td>
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

  renderSettingsTab() {
    const container = document.getElementById('tabContent');
    const user = authManager.currentUser;

    container.innerHTML = `
      <div class="space-y-6 fade-in">
        <!-- Şifre Değiştirme -->
        <div class="glass-card rounded-2xl shadow-xl p-6">
          <h2 class="text-2xl font-bold gradient-text mb-6">
            <i class="fas fa-key mr-2"></i> Şifre Değiştir
          </h2>
          <div class="max-w-md space-y-4">
            <div>
              <label class="block text-sm font-semibold text-gray-300 mb-1">Mevcut Şifre</label>
              <input type="password" id="currentPassword" 
                class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-blue-500 focus:outline-none transition-all text-white"
                placeholder="Mevcut şifrenizi girin">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-300 mb-1">Yeni Şifre</label>
              <input type="password" id="newPassword" 
                class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-blue-500 focus:outline-none transition-all text-white"
                placeholder="Yeni şifre (en az 6 karakter)">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-300 mb-1">Yeni Şifre (Tekrar)</label>
              <input type="password" id="confirmPassword" 
                class="w-full px-4 py-3 border-2 border-white/10 bg-white/5 rounded-xl focus:border-blue-500 focus:outline-none transition-all text-white"
                placeholder="Yeni şifreyi tekrar girin">
            </div>
            <button onclick="adminPage.changePassword()" 
              class="gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 hover-lift">
              <i class="fas fa-save mr-2"></i> Şifreyi Değiştir
            </button>
          </div>
        </div>

        <!-- Hesap Bilgileri -->
        <div class="glass-card rounded-2xl shadow-xl p-6">
          <h2 class="text-2xl font-bold gradient-text mb-6">
            <i class="fas fa-user-circle mr-2"></i> Hesap Bilgileri
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-gray-800/50 rounded-xl p-4">
              <p class="text-sm text-gray-400">Kullanıcı Adı</p>
              <p class="text-lg font-bold text-gray-200">${user?.username || '-'}</p>
            </div>
            <div class="bg-gray-800/50 rounded-xl p-4">
              <p class="text-sm text-gray-400">Ad Soyad</p>
              <p class="text-lg font-bold text-gray-200">${user?.full_name || '-'}</p>
            </div>
            <div class="bg-gray-800/50 rounded-xl p-4">
              <p class="text-sm text-gray-400">Rol</p>
              <p class="text-lg font-bold text-gray-200">${{'admin':'Yönetici','kalite':'Kalite','tekniker':'Tekniker'}[user?.role] || user?.role || '-'}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Tüm alanları doldurun');
      return;
    }

    if (newPassword.length < 6) {
      alert('Yeni şifre en az 6 karakter olmalıdır');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Yeni şifreler eşleşmiyor');
      return;
    }

    try {
      showLoading(true);
      await api.request('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      alert('✅ Şifre başarıyla değiştirildi!');
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      showLoading(false);
    }
  }
};

window.adminPage = adminPage;
