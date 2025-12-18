// Quality Control Page
const qualityPage = {
  currentTab: 'pending',

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
    content.innerHTML = `
      <div class="space-y-6 fade-in">
        <!-- Page Header -->
        <div>
          <h1 class="text-4xl font-bold gradient-text">
            <i class="fas fa-check-circle mr-3"></i> Kalite Kontrol
          </h1>
        </div>

        <!-- Tabs -->
        <div class="glass-card rounded-2xl p-2">
          <nav class="flex space-x-2">
            <button onclick="qualityPage.switchTab('pending')" data-tab="pending"
              class="quality-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
              <i class="fas fa-clock mr-2"></i> Bekleyen Kontroller
            </button>
            <button onclick="qualityPage.switchTab('returns')" data-tab="returns"
              class="quality-tab py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200">
              <i class="fas fa-undo mr-2"></i> İade Yönetimi
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div id="qualityTabContent"></div>
      </div>
    `;

    this.switchTab('pending');
  },

  switchTab(tab) {
    this.currentTab = tab;
    
    // Update tab styling
    document.querySelectorAll('.quality-tab').forEach(btn => {
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
      case 'pending':
        this.renderPendingTab();
        break;
      case 'returns':
        this.renderReturnsTab();
        break;
    }
  },

  async renderPendingTab() {
    const container = document.getElementById('qualityTabContent');
    
    try {
      showLoading(true);
      const pending = await api.quality.pending();

      container.innerHTML = `
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h2 class="text-xl font-semibold text-gray-900">
                <i class="fas fa-list-check mr-2"></i> Kalite Bekleyen Kayıtlar
              </h2>
              <div class="text-sm text-gray-600">
                <i class="fas fa-clock mr-1"></i> ${pending.length} kayıt bekliyor
              </div>
            </div>
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
      `;
    } catch (error) {
      container.innerHTML = `
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
  },

  async renderReturnsTab() {
    const container = document.getElementById('qualityTabContent');
    
    try {
      showLoading(true);
      
      // Get all returns
      const returns = await api.request('/quality/returns');
      
      container.innerHTML = `
        <div class="space-y-6 fade-in">
          <!-- Create Return Button -->
          <div>
            <button onclick="qualityPage.showCreateReturnModal()" 
              class="gradient-btn px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-200 hover-lift">
              <i class="fas fa-plus mr-2"></i> Yeni İade Oluştur
            </button>
          </div>

          <!-- Returns List -->
          <div class="glass-card rounded-2xl shadow-xl">
            <div class="px-6 py-4 border-b border-red-200 bg-gradient-to-r from-red-50 to-pink-50">
              <h3 class="text-xl font-bold text-red-800">
                <i class="fas fa-undo mr-2"></i> İade Edilmiş Malzemeler
              </h3>
              <p class="text-sm text-red-600 mt-1 font-medium">Montaj veya başka sebeplerle iade edilen malzemeler</p>
            </div>
            <div class="overflow-x-auto">
              ${returns.length === 0 ? `
                <div class="px-6 py-12 text-center text-gray-500">
                  <i class="fas fa-box-open text-4xl mb-4"></i>
                  <p>Henüz iade kaydı bulunmuyor</p>
                </div>
              ` : `
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gradient-to-r from-red-50 to-pink-50">
                    <tr>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Tarih</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">OTPA</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Proje</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Malzeme</th>
                      <th class="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">İade Miktarı</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Sebep</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">İade Eden</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    ${returns.map(item => `
                      <tr class="hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all duration-200">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${new Date(item.decision_date || item.created_at).toLocaleString('tr-TR')}</td>
                        <td class="px-6 py-4 font-semibold text-gray-900">${item.otpa_number}</td>
                        <td class="px-6 py-4 text-sm font-medium text-gray-700">${item.project_name || ''}</td>
                        <td class="px-6 py-4">
                          <div class="font-semibold text-gray-900">${item.material_code}</div>
                          <div class="text-xs text-gray-600">${item.material_name || ''}</div>
                        </td>
                        <td class="px-6 py-4 text-right">
                          <span class="font-bold text-red-600 text-lg">${item.rejected_quantity} ${item.unit || ''}</span>
                        </td>
                        <td class="px-6 py-4 text-sm max-w-xs truncate font-medium text-gray-700" title="${item.reason || ''}">${item.reason || '-'}</td>
                        <td class="px-6 py-4 text-sm font-medium text-gray-700">${item.decision_by_name || 'Sistem'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Returns tab error:', error);
      container.innerHTML = `
        <div class="glass-card rounded-2xl border-2 border-red-400 text-red-700 px-6 py-5">
          <div class="flex items-start">
            <i class="fas fa-exclamation-circle text-3xl mr-4 mt-1"></i>
            <div>
              <h3 class="font-bold text-lg mb-2">Hata Oluştu</h3>
              <p class="text-red-600 font-medium">${error.message}</p>
              <p class="text-sm mt-2 text-red-500">Lütfen sayfayı yenileyin veya detay için tarayıcı konsolunu kontrol edin.</p>
            </div>
          </div>
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  async showCreateReturnModal() {
    try {
      showLoading(true);
      
      // Get all OTPAs and their accepted materials
      const otpas = await api.otpa.list();
      
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
      modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <h2 class="text-2xl font-bold mb-4">
              <i class="fas fa-undo mr-2 text-red-600"></i> Yeni İade Oluştur
            </h2>
            <p class="text-sm text-gray-600 mb-6">Montaj veya diğer sebeplerle kabul edilmiş bir malzemeyi iade edin</p>
            
            <form id="createReturnForm" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">OTPA Seç *</label>
                <select id="returnOtpaId" required 
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500">
                  <option value="">-- OTPA Seçin --</option>
                  ${otpas.map(otpa => `
                    <option value="${otpa.id}">${otpa.otpa_number} - ${otpa.project_name}</option>
                  `).join('')}
                </select>
              </div>

              <div id="materialsSection" class="hidden">
                <label class="block text-sm font-medium text-gray-700 mb-2">Malzeme Seç *</label>
                <select id="returnReceiptId" required 
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500">
                  <option value="">-- Önce OTPA seçin --</option>
                </select>
                <p class="text-xs text-gray-500 mt-1">Sadece kabul edilmiş malzemeler listelenir</p>
              </div>

              <div id="quantitySection" class="hidden">
                <label class="block text-sm font-medium text-gray-700 mb-2">İade Miktarı *</label>
                <input type="number" id="returnQuantity" step="0.01" min="0.01" required
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500">
                <p id="maxQuantityHint" class="text-xs text-gray-500 mt-1"></p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">İade Sebebi *</label>
                <textarea id="returnReason" rows="3" required
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Örn: Montajda uyumsuzluk tespit edildi"></textarea>
              </div>

              <div class="flex gap-3 pt-4">
                <button type="submit" 
                  class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                  <i class="fas fa-undo mr-2"></i> İade Oluştur
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
      showLoading(false);

      // Setup form logic
      const otpaSelect = modal.querySelector('#returnOtpaId');
      const materialsSection = modal.querySelector('#materialsSection');
      const receiptSelect = modal.querySelector('#returnReceiptId');
      const quantitySection = modal.querySelector('#quantitySection');
      const quantityInput = modal.querySelector('#returnQuantity');
      const maxQuantityHint = modal.querySelector('#maxQuantityHint');

      otpaSelect.addEventListener('change', async (e) => {
        const otpaId = e.target.value;
        
        if (!otpaId) {
          materialsSection.classList.add('hidden');
          quantitySection.classList.add('hidden');
          return;
        }

        try {
          showLoading(true);
          
          // Get accepted materials for this OTPA
          const accepted = await api.request(`/quality/accepted-materials/${otpaId}`);
          
          receiptSelect.innerHTML = `
            <option value="">-- Malzeme Seçin --</option>
            ${accepted.map(item => `
              <option value="${item.receipt_id}" 
                data-accepted="${item.accepted_quantity}" 
                data-unit="${item.unit || ''}">
                ${item.material_code} - ${item.material_name} (Kabul: ${item.accepted_quantity} ${item.unit || ''})
              </option>
            `).join('')}
          `;
          
          materialsSection.classList.remove('hidden');
          
          if (accepted.length === 0) {
            receiptSelect.innerHTML = '<option value="">Bu OTPA için kabul edilmiş malzeme yok</option>';
          }
          
        } catch (error) {
          alert('Hata: ' + error.message);
        } finally {
          showLoading(false);
        }
      });

      receiptSelect.addEventListener('change', (e) => {
        const selected = e.target.selectedOptions[0];
        if (!selected || !selected.value) {
          quantitySection.classList.add('hidden');
          return;
        }

        const maxQty = parseFloat(selected.dataset.accepted);
        const unit = selected.dataset.unit;
        
        quantityInput.max = maxQty;
        quantityInput.value = maxQty;
        maxQuantityHint.textContent = `Maksimum: ${maxQty} ${unit}`;
        
        quantitySection.classList.remove('hidden');
      });

      // Form submit
      modal.querySelector('#createReturnForm').onsubmit = async (e) => {
        e.preventDefault();
        
        const receiptId = receiptSelect.value;
        const quantity = parseFloat(quantityInput.value);
        const reason = modal.querySelector('#returnReason').value;
        
        if (!receiptId || !quantity || !reason) {
          alert('Lütfen tüm alanları doldurun');
          return;
        }

        try {
          showLoading(true);
          
          await api.request('/quality/manual-return', {
            method: 'POST',
            body: JSON.stringify({
              receipt_id: receiptId,
              return_quantity: quantity,
              reason: reason
            })
          });

          modal.remove();
          alert('✅ İade başarıyla oluşturuldu!');
          this.renderReturnsTab();
          
        } catch (error) {
          alert('Hata: ' + error.message);
        } finally {
          showLoading(false);
        }
      };
      
    } catch (error) {
      alert('Hata: ' + error.message);
      showLoading(false);
    }
  }
};

window.qualityPage = qualityPage;
