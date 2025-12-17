// Quality Control Page
const qualityPage = {
  async render() {
    if (!authManager.isKalite()) {
      document.getElementById('content').innerHTML = `
        <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <i class="fas fa-exclamation-triangle mr-2"></i> Bu sayfaya erişim yetkiniz yok.
        </div>
      `;
      return;
    }

    const content = document.getElementById('content');
    
    try {
      showLoading(true);
      const pending = await api.quality.pending();

      content.innerHTML = `
        <div class="space-y-6">
          <!-- Page Header -->
          <div class="flex justify-between items-center">
            <h1 class="text-3xl font-bold text-gray-900">
              <i class="fas fa-check-circle text-green-600 mr-2"></i> Kalite Kontrol
            </h1>
            <div class="text-sm text-gray-600">
              <i class="fas fa-clock mr-1"></i> ${pending.length} kayıt bekliyor
            </div>
          </div>

          <!-- Pending Quality Checks -->
          <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
              <h2 class="text-xl font-semibold text-gray-900">
                <i class="fas fa-list-check mr-2"></i> Kalite Bekleyen Kayıtlar
              </h2>
            </div>
            <div class="p-6">
              ${pending.length === 0 ? `
                <div class="text-center py-12">
                  <i class="fas fa-check-circle text-green-500 text-6xl mb-4"></i>
                  <h3 class="text-xl font-semibold text-gray-900 mb-2">Tüm kayıtlar işlendi!</h3>
                  <p class="text-gray-600">Şu anda kalite bekleyen giriş kaydı bulunmuyor.</p>
                </div>
              ` : `
                <div class="space-y-4">
                  ${pending.map(item => this.renderPendingItem(item)).join('')}
                </div>
              `}
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

  renderPendingItem(item) {
    return `
      <div class="border rounded-lg p-6 hover:bg-gray-50 transition">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <!-- Item Info -->
          <div class="flex-1">
            <div class="flex items-center mb-2">
              <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mr-3">
                ${item.otpa_number}
              </span>
              <span class="text-gray-600 text-sm">${item.project_name}</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div>
                <div class="text-sm text-gray-500">Malzeme</div>
                <div class="font-medium text-gray-900">${item.material_code}</div>
                <div class="text-xs text-gray-600">${item.material_name}</div>
              </div>
              <div>
                <div class="text-sm text-gray-500">Gelen Miktar</div>
                <div class="font-bold text-lg text-gray-900">${item.received_quantity} ${item.unit}</div>
              </div>
              <div>
                <div class="text-sm text-gray-500">Giriş Tarihi</div>
                <div class="text-sm text-gray-900">${new Date(item.receipt_date).toLocaleString('tr-TR')}</div>
              </div>
              <div>
                <div class="text-sm text-gray-500">Kaydeden</div>
                <div class="text-sm text-gray-900">${item.created_by_name}</div>
              </div>
            </div>
          </div>

          <!-- Action Button -->
          <div class="flex-shrink-0">
            <button onclick="qualityPage.showDecisionModal(${item.id}, ${item.received_quantity}, '${item.material_code}', '${item.material_name}')" 
              class="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition whitespace-nowrap">
              <i class="fas fa-clipboard-check mr-2"></i> Kalite Kararı Ver
            </button>
          </div>
        </div>
      </div>
    `;
  },

  showDecisionModal(receiptId, receivedQty, materialCode, materialName) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">
              <i class="fas fa-clipboard-check mr-2 text-green-600"></i> Kalite Kararı
            </h2>
            <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
              <i class="fas fa-times text-2xl"></i>
            </button>
          </div>

          <div class="mb-6 p-4 bg-gray-50 rounded-lg">
            <div class="font-medium text-gray-900 mb-1">${materialCode}</div>
            <div class="text-sm text-gray-600 mb-2">${materialName}</div>
            <div class="text-lg font-bold text-blue-600">Gelen Miktar: ${receivedQty}</div>
          </div>

          <form id="qualityDecisionForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Kalite Durumu *</label>
              <select id="qualityStatus" required 
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-lg">
                <option value="">Durum seçin...</option>
                <option value="kabul">✅ Kabul</option>
                <option value="iade">↩️ İade</option>
              </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Kabul Miktarı</label>
                <input type="number" id="acceptedQty" step="0.01" value="${receivedQty}" min="0" max="${receivedQty}"
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-lg">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">İade Miktarı</label>
                <input type="number" id="rejectedQty" step="0.01" value="0" min="0" max="${receivedQty}"
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-lg">
              </div>
            </div>

            <div id="reasonSection" class="hidden">
              <label class="block text-sm font-medium text-gray-700 mb-2">Açıklama / Red Nedeni *</label>
              <textarea id="reason" rows="4" required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Detaylı açıklama girin..."></textarea>
            </div>

            <div class="flex gap-3 pt-4">
              <button type="submit" 
                class="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition text-lg">
                <i class="fas fa-check mr-2"></i> Kararı Kaydet
              </button>
              <button type="button" onclick="this.closest('.fixed').remove()" 
                class="px-6 py-3 bg-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-400 transition">
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Setup form logic
    const statusSelect = modal.querySelector('#qualityStatus');
    const reasonSection = modal.querySelector('#reasonSection');
    const acceptedInput = modal.querySelector('#acceptedQty');
    const rejectedInput = modal.querySelector('#rejectedQty');

    statusSelect.addEventListener('change', (e) => {
      const status = e.target.value;
      
      if (status === 'iade') {
        reasonSection.classList.remove('hidden');
        reasonSection.querySelector('textarea').required = true;
      } else {
        reasonSection.classList.add('hidden');
        reasonSection.querySelector('textarea').required = false;
      }

      // Auto-adjust quantities
      if (status === 'kabul') {
        acceptedInput.value = receivedQty;
        rejectedInput.value = 0;
      } else if (status === 'iade') {
        acceptedInput.value = 0;
        rejectedInput.value = receivedQty;
      }
    });

    // Auto-calculate when quantities change
    acceptedInput.addEventListener('input', () => {
      const accepted = parseFloat(acceptedInput.value) || 0;
      rejectedInput.value = Math.max(0, receivedQty - accepted);
    });

    rejectedInput.addEventListener('input', () => {
      const rejected = parseFloat(rejectedInput.value) || 0;
      acceptedInput.value = Math.max(0, receivedQty - rejected);
    });

    // Form submit
    modal.querySelector('#qualityDecisionForm').onsubmit = async (e) => {
      e.preventDefault();
      
      const status = statusSelect.value;
      const acceptedQty = parseFloat(acceptedInput.value) || 0;
      const rejectedQty = parseFloat(rejectedInput.value) || 0;
      const reason = modal.querySelector('#reason').value;

      if (!status) {
        alert('Lütfen kalite durumu seçin');
        return;
      }

      if (acceptedQty + rejectedQty > receivedQty) {
        alert('Kabul + Red miktarı gelen miktardan fazla olamaz');
        return;
      }

      try {
        showLoading(true);
        
        await api.quality.decision(receiptId, {
          status,
          accepted_quantity: acceptedQty,
          rejected_quantity: rejectedQty,
          reason
        });

        modal.remove();
        alert('✅ Kalite kararı başarıyla kaydedildi!');
        this.render();
        
      } catch (error) {
        alert('Hata: ' + error.message);
      } finally {
        showLoading(false);
      }
    };
  }
};

window.qualityPage = qualityPage;
