// İade Yönetimi Sayfası
const ReturnsPage = {
  otpaData: [],
  selectedOtpaId: null,
  returnMaterialsData: {},

  async render() {
    showLoading(true);
    
    const container = document.getElementById('content');
    container.innerHTML = `
      <div class="max-w-7xl mx-auto">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-gray-800 flex items-center">
            <i class="fas fa-undo mr-3 text-blue-600"></i>
            İade Yönetimi
          </h1>
          <p class="text-gray-600 mt-2">Malzeme iade işlemlerini buradan yönetin</p>
        </div>

        <!-- Tab Navigation -->
        <div class="bg-white rounded-lg shadow mb-6">
          <div class="border-b border-gray-200">
            <nav class="flex -mb-px">
              <button onclick="ReturnsPage.switchTab('create')" 
                class="return-tab-btn px-6 py-4 text-sm font-medium border-b-2 border-blue-500 text-blue-600" 
                data-tab="create">
                <i class="fas fa-plus-circle mr-2"></i>İade Oluştur
              </button>
              <button onclick="ReturnsPage.switchTab('receipt')" 
                class="return-tab-btn px-6 py-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300" 
                data-tab="receipt">
                <i class="fas fa-dolly mr-2"></i>İade Girişi
              </button>
              <button onclick="ReturnsPage.switchTab('history')" 
                class="return-tab-btn px-6 py-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300" 
                data-tab="history">
                <i class="fas fa-history mr-2"></i>İade Geçmişi
              </button>
              <button onclick="ReturnsPage.switchTab('statistics')" 
                class="return-tab-btn px-6 py-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300" 
                data-tab="statistics">
                <i class="fas fa-chart-bar mr-2"></i>İstatistikler
              </button>
            </nav>
          </div>
        </div>

        <!-- Tab Contents -->
        <div id="createReturnTab" class="tab-content"></div>
        <div id="receiptReturnTab" class="tab-content hidden"></div>
        <div id="historyReturnTab" class="tab-content hidden"></div>
        <div id="statisticsReturnTab" class="tab-content hidden"></div>
      </div>
    `;

    await this.switchTab('create');
    
    showLoading(false);
  },

  async switchTab(tabName) {
    // Tab butonlarını güncelle
    document.querySelectorAll('.return-tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.remove('border-transparent', 'text-gray-500');
        btn.classList.add('border-blue-500', 'text-blue-600');
      } else {
        btn.classList.remove('border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
      }
    });

    // Tab içeriklerini göster/gizle
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    
    if (tabName === 'create') {
      document.getElementById('createReturnTab').classList.remove('hidden');
      await this.renderCreateReturn();
    } else if (tabName === 'receipt') {
      document.getElementById('receiptReturnTab').classList.remove('hidden');
      await this.renderReceiptReturn();
    } else if (tabName === 'history') {
      document.getElementById('historyReturnTab').classList.remove('hidden');
      await this.renderHistory();
    } else if (tabName === 'statistics') {
      document.getElementById('statisticsReturnTab').classList.remove('hidden');
      await this.renderStatistics();
    }
  },

  async renderCreateReturn() {
    const container = document.getElementById('createReturnTab');
    
    container.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-bold mb-6 flex items-center">
          <i class="fas fa-plus-circle mr-2 text-blue-600"></i>
          Yeni İade Oluştur
        </h2>
        
        <form id="returnForm" class="space-y-6">
          <!-- OTPA Seçimi -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-file-alt mr-2"></i>OTPA Seç
            </label>
            <input type="text" 
              id="returnOtpaId" 
              list="otpaReturnList" 
              placeholder="OTPA numarası yazarak arayın..." 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autocomplete="off">
            <datalist id="otpaReturnList"></datalist>
          </div>

          <!-- Component Seçimi -->
          <div id="componentSection" style="display:none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-microchip mr-2"></i>Komponent Seç
            </label>
            <select id="returnComponentType" 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium">
              <option value="">Seçiniz...</option>
              <option value="batarya">🔋 Batarya</option>
              <option value="vccu">⚡ VCCU</option>
              <option value="junction_box">📦 Junction Box</option>
              <option value="pdu">🔌 PDU</option>
            </select>
          </div>

          <!-- Malzeme Seçimi -->
          <div id="materialSection" style="display:none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-boxes mr-2"></i>Malzeme Seç
            </label>
            <input type="text" 
              id="returnMaterialCode" 
              list="materialReturnList" 
              placeholder="Malzeme kodu yazarak arayın..." 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              autocomplete="off">
            <datalist id="materialReturnList"></datalist>
            
            <div id="materialInfo" style="display:none;" class="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div class="font-medium text-blue-900 mb-1">Mevcut Stok</div>
              <div id="stockQuantity" class="text-2xl font-bold text-blue-600">0</div>
            </div>
          </div>

          <!-- Miktar -->
          <div id="quantitySection" style="display:none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-calculator mr-2"></i>İade Miktarı
            </label>
            <input type="number" 
              id="returnQuantity" 
              min="0" 
              step="0.01"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="İade edilecek miktar">
          </div>

          <!-- Sebep -->
          <div id="reasonSection" style="display:none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-comment-dots mr-2"></i>İade Sebebi
            </label>
            <textarea id="returnReason" 
              rows="3"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="İade sebebini açıklayın..."></textarea>
          </div>

          <!-- Submit Button -->
          <button type="submit" 
            id="submitReturnBtn"
            style="display:none;"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center">
            <i class="fas fa-check-circle mr-2"></i>İade Oluştur
          </button>
        </form>

        <div id="returnResult" class="mt-4"></div>
      </div>
    `;

    // Event listeners
    this.setupCreateReturnListeners();
    
    // OTPA listesini yükle
    await this.loadOtpaList();
  },

  async renderReceiptReturn() {
    const container = document.getElementById('receiptReturnTab');
    
    container.innerHTML = `
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-bold mb-6 flex items-center">
          <i class="fas fa-dolly mr-2 text-green-600"></i>
          İade Malzemesi Giriş Yap
        </h2>
        
        <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <div class="flex">
            <i class="fas fa-info-circle text-blue-500 mt-1 mr-3"></i>
            <div>
              <p class="text-sm text-blue-700">
                İade edilen malzemeleri tekrar stoka almak için bu formu kullanın. 
                Sistem otomatik olarak iade havuzundan düşecektir.
              </p>
            </div>
          </div>
        </div>

        <form id="receiptReturnForm" class="space-y-6">
          <!-- OTPA -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">OTPA</label>
            <select id="receiptOtpaId" 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
              <option value="">OTPA Seçiniz...</option>
            </select>
          </div>

          <!-- Component -->
          <div id="receiptComponentSection" style="display:none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">Komponent</label>
            <select id="receiptComponentType" 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
              <option value="">Seçiniz...</option>
              <option value="batarya">🔋 Batarya</option>
              <option value="vccu">⚡ VCCU</option>
              <option value="junction_box">📦 Junction Box</option>
              <option value="pdu">🔌 PDU</option>
            </select>
          </div>

          <!-- Malzeme -->
          <div id="receiptMaterialSection" style="display:none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">Malzeme</label>
            <select id="receiptMaterialCode" 
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
              <option value="">Malzeme Seçiniz...</option>
            </select>
            
            <div id="rejectedInfo" style="display:none;" class="mt-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <div class="font-medium text-red-900 mb-1">İade Havuzu</div>
              <div id="rejectedQuantity" class="text-2xl font-bold text-red-600">0</div>
            </div>
          </div>

          <!-- Gelen Miktar -->
          <div id="receiptQuantitySection" style="display:none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">Gelen Miktar</label>
            <input type="number" 
              id="receiptQuantity" 
              min="0" 
              step="0.01"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              placeholder="Gelen miktar">
          </div>

          <!-- Açıklama -->
          <div id="receiptNoteSection" style="display:none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">Açıklama (Opsiyonel)</label>
            <input type="text" 
              id="receiptNote"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              placeholder="Ek not...">
          </div>

          <!-- Submit -->
          <button type="submit" 
            id="submitReceiptBtn"
            style="display:none;"
            class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center">
            <i class="fas fa-check-circle mr-2"></i>İade Girişi Yap
          </button>
        </form>

        <div id="receiptResult" class="mt-4"></div>
      </div>
    `;

    this.setupReceiptReturnListeners();
    await this.loadOtpaForReceipt();
  },

  async renderHistory() {
    const container = document.getElementById('historyReturnTab');
    
    try {
      showLoading(true);
      const returns = await api.reports.rejections({});
      
      container.innerHTML = `
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b">
            <h3 class="text-lg font-semibold flex items-center">
              <i class="fas fa-history mr-2"></i>İade Geçmişi
            </h3>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">OTPA</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Malzeme</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İade Miktarı</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sebep</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlem Yapan</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                ${returns.length === 0 ? `
                  <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                      <i class="fas fa-inbox text-4xl mb-2"></i>
                      <p>Henüz iade kaydı bulunmuyor</p>
                    </td>
                  </tr>
                ` : returns.map(item => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${new Date(item.decision_date).toLocaleString('tr-TR')}</td>
                    <td class="px-6 py-4 font-medium">${item.otpa_number}</td>
                    <td class="px-6 py-4">
                      <div class="font-medium">${item.material_code}</div>
                      <div class="text-xs text-gray-500">${item.material_name || '-'}</div>
                    </td>
                    <td class="px-6 py-4 text-right font-bold text-red-600">${item.rejected_quantity}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">${item.reason || '-'}</td>
                    <td class="px-6 py-4 text-sm">${item.decision_by_name || '<span class="text-gray-400 italic">Kullanıcı bilgisi yok</span>'}</td>
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
          Hata: ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  setupCreateReturnListeners() {
    const otpaInput = document.getElementById('returnOtpaId');
    const componentSelect = document.getElementById('returnComponentType');
    const materialInput = document.getElementById('returnMaterialCode');
    const form = document.getElementById('returnForm');

    otpaInput.addEventListener('input', (e) => {
      const value = e.target.value;
      const option = Array.from(document.getElementById('otpaReturnList').options)
        .find(opt => opt.value === value);
      
      if (option) {
        this.selectedOtpaId = parseInt(option.dataset.id);
        document.getElementById('componentSection').style.display = 'block';
      } else {
        this.selectedOtpaId = null;
        document.getElementById('componentSection').style.display = 'none';
        document.getElementById('materialSection').style.display = 'none';
        document.getElementById('quantitySection').style.display = 'none';
        document.getElementById('reasonSection').style.display = 'none';
        document.getElementById('submitReturnBtn').style.display = 'none';
      }
    });

    componentSelect.addEventListener('change', (e) => this.onReturnComponentChange(e.target.value));
    materialInput.addEventListener('input', (e) => this.onReturnMaterialChange(e.target.value));
    form.addEventListener('submit', (e) => this.handleReturnSubmit(e));
  },

  setupReceiptReturnListeners() {
    const otpaSelect = document.getElementById('receiptOtpaId');
    const componentSelect = document.getElementById('receiptComponentType');
    const materialSelect = document.getElementById('receiptMaterialCode');
    const form = document.getElementById('receiptReturnForm');

    otpaSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        document.getElementById('receiptComponentSection').style.display = 'block';
      } else {
        document.getElementById('receiptComponentSection').style.display = 'none';
        document.getElementById('receiptMaterialSection').style.display = 'none';
        document.getElementById('receiptQuantitySection').style.display = 'none';
        document.getElementById('receiptNoteSection').style.display = 'none';
        document.getElementById('submitReceiptBtn').style.display = 'none';
      }
    });

    componentSelect.addEventListener('change', (e) => this.onReceiptComponentChange(e.target.value));
    materialSelect.addEventListener('change', (e) => this.onReceiptMaterialChange(e.target.value));
    form.addEventListener('submit', (e) => this.handleReceiptSubmit(e));
  },

  async loadOtpaList() {
    try {
      const otpaList = await api.otpa.list();
      this.otpaData = otpaList;
      
      const datalist = document.getElementById('otpaReturnList');
      datalist.innerHTML = '';
      
      otpaList.forEach(otpa => {
        const option = document.createElement('option');
        option.value = otpa.otpa_number;
        option.dataset.id = otpa.id;
        option.textContent = `${otpa.otpa_number} - ${otpa.project_name}`;
        datalist.appendChild(option);
      });
    } catch (error) {
      console.error('OTPA listesi yüklenemedi:', error);
    }
  },

  async loadOtpaForReceipt() {
    try {
      const otpaList = await api.otpa.list();
      const select = document.getElementById('receiptOtpaId');
      
      otpaList.forEach(otpa => {
        const option = document.createElement('option');
        option.value = otpa.id;
        option.textContent = `${otpa.otpa_number} - ${otpa.project_name}`;
        select.appendChild(option);
      });
    } catch (error) {
      console.error('OTPA listesi yüklenemedi:', error);
    }
  },

  async onReturnComponentChange(componentType) {
    if (!componentType || !this.selectedOtpaId) {
      document.getElementById('materialSection').style.display = 'none';
      document.getElementById('quantitySection').style.display = 'none';
      document.getElementById('reasonSection').style.display = 'none';
      document.getElementById('submitReturnBtn').style.display = 'none';
      return;
    }

    const otpaId = this.selectedOtpaId;
    
    try {
      showLoading(true);
      const materials = await api.quality.acceptedMaterials(otpaId, componentType);
      
      const materialInput = document.getElementById('returnMaterialCode');
      const materialList = document.getElementById('materialReturnList');
      materialList.innerHTML = '';
      materialInput.value = '';
      
      if (materials.length === 0) {
        materialInput.placeholder = 'Bu komponentte iade edilebilir malzeme yok';
        document.getElementById('materialSection').style.display = 'block';
        return;
      }

      this.returnMaterialsData = {};
      
      materials.forEach(material => {
        const option = document.createElement('option');
        option.value = material.material_code;
        option.textContent = `${material.material_code} - ${material.material_name} (Stok: ${material.accepted_quantity} ${material.unit})`;
        materialList.appendChild(option);
        
        this.returnMaterialsData[material.material_code] = {
          acceptedQty: material.accepted_quantity,
          unit: material.unit,
          name: material.material_name
        };
      });

      document.getElementById('materialSection').style.display = 'block';
    } catch (error) {
      alert('Malzeme listesi yüklenemedi: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  onReturnMaterialChange(materialCode) {
    if (!materialCode || !this.returnMaterialsData || !this.returnMaterialsData[materialCode]) {
      document.getElementById('materialInfo').style.display = 'none';
      document.getElementById('quantitySection').style.display = 'none';
      document.getElementById('reasonSection').style.display = 'none';
      document.getElementById('submitReturnBtn').style.display = 'none';
      return;
    }

    const materialData = this.returnMaterialsData[materialCode];
    const acceptedQty = materialData.acceptedQty;
    const unit = materialData.unit;

    document.getElementById('stockQuantity').textContent = `${acceptedQty} ${unit}`;
    document.getElementById('materialInfo').style.display = 'block';
    document.getElementById('quantitySection').style.display = 'block';
    document.getElementById('reasonSection').style.display = 'block';
    document.getElementById('submitReturnBtn').style.display = 'block';

    document.getElementById('returnQuantity').max = acceptedQty;
  },

  async handleReturnSubmit(e) {
    e.preventDefault();

    const otpaId = this.selectedOtpaId;
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
      
      const payload = {
        otpa_id: parseInt(otpaId),
        component_type: componentType,
        material_code: materialCode,
        return_quantity: returnQuantity,
        reason: reason
      };
      
      console.log('🔍 İade gönderiliyor:', payload);
      
      const response = await api.quality.createReturn(payload);

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

      document.getElementById('returnForm').reset();
      document.getElementById('componentSection').style.display = 'none';
      document.getElementById('materialSection').style.display = 'none';
      document.getElementById('quantitySection').style.display = 'none';
      document.getElementById('reasonSection').style.display = 'none';
      document.getElementById('submitReturnBtn').style.display = 'none';
      this.selectedOtpaId = null;

      setTimeout(() => {
        document.getElementById('returnResult').innerHTML = '';
      }, 5000);
    } catch (error) {
      document.getElementById('returnResult').innerHTML = `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          <i class="fas fa-exclamation-circle mr-2"></i>
          <strong>Hata!</strong> ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  async onReceiptComponentChange(componentType) {
    const otpaId = document.getElementById('receiptOtpaId').value;
    
    if (!componentType || !otpaId) {
      document.getElementById('receiptMaterialSection').style.display = 'none';
      document.getElementById('receiptQuantitySection').style.display = 'none';
      document.getElementById('receiptNoteSection').style.display = 'none';
      document.getElementById('submitReceiptBtn').style.display = 'none';
      return;
    }

    try {
      showLoading(true);
      const bom = await api.request(`/bom/${otpaId}`);
      const materials = bom.filter(item => item.component_type === componentType);

      const select = document.getElementById('receiptMaterialCode');
      select.innerHTML = '<option value="">Malzeme Seçiniz...</option>';

      materials.forEach(item => {
        const option = document.createElement('option');
        option.value = item.material_code;
        option.textContent = `${item.material_code} - ${item.material_name}`;
        select.appendChild(option);
      });

      document.getElementById('receiptMaterialSection').style.display = 'block';
    } catch (error) {
      alert('BOM yüklenemedi: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  async onReceiptMaterialChange(materialCode) {
    const otpaId = document.getElementById('receiptOtpaId').value;
    const componentType = document.getElementById('receiptComponentType').value;

    if (!materialCode) {
      document.getElementById('rejectedInfo').style.display = 'none';
      document.getElementById('receiptQuantitySection').style.display = 'none';
      document.getElementById('receiptNoteSection').style.display = 'none';
      document.getElementById('submitReceiptBtn').style.display = 'none';
      return;
    }

    try {
      showLoading(true);
      const response = await api.request(`/quality/rejected-pool/${otpaId}/${componentType}/${materialCode}`);
      
      document.getElementById('rejectedQuantity').textContent = `${response.total_rejected} adet`;
      document.getElementById('rejectedInfo').style.display = 'block';
      document.getElementById('receiptQuantitySection').style.display = 'block';
      document.getElementById('receiptNoteSection').style.display = 'block';
      document.getElementById('submitReceiptBtn').style.display = 'block';

      document.getElementById('receiptQuantity').max = response.total_rejected;
    } catch (error) {
      console.error('İade havuzu yüklenemedi:', error);
      document.getElementById('receiptQuantitySection').style.display = 'block';
      document.getElementById('receiptNoteSection').style.display = 'block';
      document.getElementById('submitReceiptBtn').style.display = 'block';
    } finally {
      showLoading(false);
    }
  },

  async handleReceiptSubmit(e) {
    e.preventDefault();

    const otpaId = parseInt(document.getElementById('receiptOtpaId').value);
    const componentType = document.getElementById('receiptComponentType').value;
    const materialCode = document.getElementById('receiptMaterialCode').value;
    const quantity = parseFloat(document.getElementById('receiptQuantity').value);
    const note = document.getElementById('receiptNote').value;

    if (!otpaId || !componentType || !materialCode || !quantity) {
      alert('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    try {
      showLoading(true);

      const response = await api.request('/goods-receipt', {
        method: 'POST',
        body: JSON.stringify({
          otpa_id: otpaId,
          component_type: componentType,
          material_code: materialCode,
          received_quantity: quantity,
          note: note || 'İade dönüşü',
          return_of_rejected: true
        })
      });

      document.getElementById('receiptResult').innerHTML = `
        <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
          <i class="fas fa-check-circle mr-2"></i>
          <strong>Başarılı!</strong> İade girişi yapıldı ve kalite kontrolüne gönderildi.
        </div>
      `;

      document.getElementById('receiptReturnForm').reset();
      document.getElementById('receiptComponentSection').style.display = 'none';
      document.getElementById('receiptMaterialSection').style.display = 'none';
      document.getElementById('receiptQuantitySection').style.display = 'none';
      document.getElementById('receiptNoteSection').style.display = 'none';
      document.getElementById('submitReceiptBtn').style.display = 'none';

      setTimeout(() => {
        document.getElementById('receiptResult').innerHTML = '';
      }, 5000);
    } catch (error) {
      document.getElementById('receiptResult').innerHTML = `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          <i class="fas fa-exclamation-circle mr-2"></i>
          <strong>Hata!</strong> ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  async renderStatistics() {
    const container = document.getElementById('statisticsReturnTab');
    
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Admin: İstatistik Sıfırlama -->
        ${authManager.currentUser?.role === 'admin' ? `
          <div class="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-yellow-900">⚠️ Test Modu</h3>
                <p class="text-sm text-yellow-700 mt-1">İade istatistiklerini sıfırlayın (tüm rejected_quantity değerleri 0 olacak)</p>
              </div>
              <button onclick="ReturnsPage.resetStatistics()" 
                class="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg transition">
                <i class="fas fa-trash mr-2"></i>Sıfırla
              </button>
            </div>
          </div>
        ` : ''}
        
        <!-- Filtre -->
        <div class="bg-white rounded-lg shadow p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Zaman Dilimi</label>
              <select id="statisticPeriod" class="w-full px-4 py-2 border rounded-lg">
                <option value="">Tüm Zamanlar</option>
                <option value="1month">Son 1 Ay</option>
                <option value="3months">Son 3 Ay</option>
                <option value="1year" selected>Son 1 Yıl</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Malzeme Ara</label>
              <div class="flex gap-2">
                <input type="text" id="materialSearch" placeholder="Malzeme kodu girin..." 
                  class="flex-1 px-4 py-2 border rounded-lg">
                <button onclick="ReturnsPage.loadStatistics()" 
                  class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                  <i class="fas fa-search mr-2"></i>Ara
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Genel İstatistikler -->
        <div id="generalStats" class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-red-100 text-sm font-medium">Toplam İade Kesilen</p>
                <p id="totalReturnQuantity" class="text-5xl font-bold mt-3">-</p>
                <p class="text-red-100 text-xs mt-2">adet</p>
              </div>
              <i class="fas fa-undo text-6xl text-red-200 opacity-30"></i>
            </div>
          </div>
          <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-orange-100 text-sm font-medium">En Çok İade Edilen</p>
                <p id="topMaterialCode" class="text-2xl font-bold mt-3">-</p>
                <p id="topMaterialCount" class="text-orange-100 text-sm mt-2">- adet</p>
              </div>
              <i class="fas fa-exclamation-triangle text-6xl text-orange-200 opacity-30"></i>
            </div>
          </div>
          <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-blue-100 text-sm font-medium">Farklı Malzeme Sayısı</p>
                <p id="uniqueMaterialCount" class="text-5xl font-bold mt-3">-</p>
                <p class="text-blue-100 text-xs mt-2">çeşit</p>
              </div>
              <i class="fas fa-boxes text-6xl text-blue-200 opacity-30"></i>
            </div>
          </div>
        </div>

        <!-- Malzeme Detayı -->
        <div id="materialDetailSection" style="display:none;" class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-bold mb-4">Malzeme Detayı</h3>
          <div id="materialDetailContent"></div>
        </div>

        <!-- En Çok İade Edilen Malzemeler -->
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b">
            <h3 class="text-lg font-semibold">En Çok İade Edilen Malzemeler (Top 10)</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Malzeme Kodu</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Malzeme Adı</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İade Kesilen Adet</th>
                </tr>
              </thead>
              <tbody id="topMaterialsTable" class="divide-y divide-gray-200">
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p>Yükleniyor...</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    document.getElementById('statisticPeriod').addEventListener('change', () => this.loadStatistics());
    
    // İlk yükleme
    await this.loadStatistics();
  },

  async loadStatistics() {
    const period = document.getElementById('statisticPeriod').value;
    const materialCode = document.getElementById('materialSearch').value.trim();

    try {
      showLoading(true);
      
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (materialCode) params.append('material_code', materialCode);
      
      const stats = await api.request(`/reports/return-statistics?${params.toString()}`);

      // Genel istatistikler
      document.getElementById('totalReturnQuantity').textContent = Math.round(stats.total.total_return_quantity || 0);
      document.getElementById('uniqueMaterialCount').textContent = stats.total.unique_materials || 0;
      
      // En çok iade edilen malzeme (turuncu kart)
      if (stats.topMaterials.length > 0) {
        const topMaterial = stats.topMaterials[0];
        document.getElementById('topMaterialCode').textContent = topMaterial.material_code;
        document.getElementById('topMaterialCount').textContent = `${Math.round(topMaterial.total_return_quantity || 0)} adet`;
      } else {
        document.getElementById('topMaterialCode').textContent = '-';
        document.getElementById('topMaterialCount').textContent = '0 adet';
      }

      // Malzeme detayı
      if (stats.materialDetail) {
        document.getElementById('materialDetailSection').style.display = 'block';
        document.getElementById('materialDetailContent').innerHTML = `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-gray-600">Malzeme Kodu</p>
              <p class="text-lg font-bold">${stats.materialDetail.material_code}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Malzeme Adı</p>
              <p class="text-lg font-bold">${stats.materialDetail.material_name || '-'}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Toplam İade Kesilen</p>
              <p class="text-3xl font-bold text-red-600">${Math.round(stats.materialDetail.total_return_quantity || 0)} adet</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">İlk İade</p>
              <p class="font-medium">${new Date(stats.materialDetail.first_return).toLocaleDateString('tr-TR')}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Son İade</p>
              <p class="font-medium">${new Date(stats.materialDetail.last_return).toLocaleDateString('tr-TR')}</p>
            </div>
          </div>
        `;
      } else {
        document.getElementById('materialDetailSection').style.display = 'none';
      }

      // En çok iade edilen malzemeler
      const tableBody = document.getElementById('topMaterialsTable');
      if (stats.topMaterials.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" class="px-6 py-8 text-center text-gray-500">
              <i class="fas fa-inbox text-4xl mb-2"></i>
              <p>Bu dönemde iade kaydı bulunmuyor</p>
            </td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = stats.topMaterials.map((item, index) => `
          <tr class="hover:bg-gray-50 cursor-pointer" onclick="document.getElementById('materialSearch').value='${item.material_code}'; ReturnsPage.loadStatistics();">
            <td class="px-6 py-4 text-sm font-bold text-gray-500">${index + 1}</td>
            <td class="px-6 py-4 font-medium text-blue-600">${item.material_code}</td>
            <td class="px-6 py-4 text-sm">${item.material_name || '-'}</td>
            <td class="px-6 py-4 text-right font-bold text-red-600 text-lg">${Math.round(item.total_return_quantity || 0)} adet</td>
          </tr>
        `).join('');
      }

    } catch (error) {
      alert('İstatistikler yüklenemedi: ' + error.message);
    } finally {
      showLoading(false);
    }
  },

  async resetStatistics() {
    if (!confirm('⚠️ DİKKAT!\n\nTüm iade istatistikleri sıfırlanacak.\nBu işlem geri alınamaz.\n\nDevam etmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      showLoading(true);
      
      const result = await api.request('/reports/reset-return-stats', {
        method: 'POST'
      });

      alert(`✅ İstatistikler sıfırlandı!\n\n${result.reset_count} kayıt güncellendi.\nEski toplam: ${result.before.total_rejected} adet`);
      
      // Sayfayı yenile
      await this.loadStatistics();
      
    } catch (error) {
      alert('❌ Hata: ' + error.message);
    } finally {
      showLoading(false);
    }
  }
};
