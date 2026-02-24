// Quality Control Page
const qualityPage = {
  currentTab: 'pending',

  async render() {
    if (!authManager.isKalite()) {
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
        btn.classList.remove('text-gray-400', 'hover:text-white');
      } else {
        btn.classList.remove('gradient-btn', 'shadow-lg');
        btn.classList.add('text-gray-400', 'hover:text-white');
      }
    });

    // Render tab content
    switch (tab) {
      case 'pending':
        this.renderPendingTab();
        break;
    }
  },

  async renderPendingTab() {
    const container = document.getElementById('qualityTabContent');
    
    try {
      showLoading(true);
      const pending = await api.quality.pending();

      container.innerHTML = `
        <div class="glass-card rounded-2xl">
          <div class="px-6 py-4 border-b border-white/5">
            <div class="flex justify-between items-center">
              <h2 class="text-xl font-semibold text-white">
                <i class="fas fa-list-check mr-2"></i> Kalite Bekleyen Kayıtlar
              </h2>
              <div class="flex items-center gap-3">
                <div class="text-sm text-gray-400">
                  <i class="fas fa-clock mr-1"></i> ${pending.length} kayıt bekliyor
                </div>
                ${pending.length > 0 ? `
                  <button onclick="qualityPage.bulkApproveAll()" class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors duration-200">
                    <i class="fas fa-check-double mr-2"></i> Tümünü Onayla
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
          <div class="p-6">
            ${pending.length === 0 ? `
              <div class="text-center py-12">
                <i class="fas fa-check-circle text-green-500 text-6xl mb-4"></i>
                <h3 class="text-xl font-semibold text-white mb-2">Tüm kayıtlar işlendi!</h3>
                <p class="text-gray-400">Şu anda kalite bekleyen giriş kaydı bulunmuyor.</p>
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
        <div class="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded">
          <i class="fas fa-exclamation-circle mr-2"></i> ${error.message}
        </div>
      `;
    } finally {
      showLoading(false);
    }
  },

  renderPendingItem(item) {
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
    const componentColors = {
      'batarya': 'bg-emerald-500/15 text-emerald-400',
      'vccu': 'bg-amber-500/15 text-amber-400',
      'junction_box': 'bg-blue-500/15 text-blue-400',
      'pdu': 'bg-purple-500/15 text-purple-400'
    };
    
    return `
      <div class="border-2 rounded-xl p-6 hover:shadow-lg transition-all duration-200 ${
        item.component_type === 'batarya' ? 'border-green-500/30 bg-green-500/10' :
        item.component_type === 'vccu' ? 'border-yellow-500/30 bg-yellow-500/10' :
        item.component_type === 'junction_box' ? 'border-blue-500/30 bg-blue-500/10' :
        item.component_type === 'pdu' ? 'border-purple-500/30 bg-purple-500/10' : 'border-white/10'
      }">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <!-- Item Info -->
          <div class="flex-1">
            <div class="flex items-center mb-3 flex-wrap gap-2">
              <span class="px-3 py-1 bg-blue-500/15 text-blue-400 rounded-full text-sm font-bold">
                ${item.otpa_number}
              </span>
              <span class="px-3 py-1 ${componentColors[item.component_type] || 'bg-gray-500/15 text-gray-400'} rounded-full text-sm font-bold">
                ${componentIcons[item.component_type] || '❓'} ${componentLabels[item.component_type] || item.component_type}
              </span>
              <span class="text-gray-400 text-sm">${item.project_name}</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div>
                <div class="text-sm text-gray-400">Malzeme</div>
                <div class="font-bold text-white">${item.material_code}</div>
                <div class="text-xs text-gray-400">${item.material_name}</div>
              </div>
              <div>
                <div class="text-sm text-gray-400">Gelen Miktar</div>
                <div class="font-bold text-2xl gradient-text">${item.received_quantity} ${item.unit}</div>
              </div>
              <div>
                <div class="text-sm text-gray-400">Giriş Tarihi</div>
                <div class="text-sm text-white">${new Date(item.receipt_date).toLocaleString('tr-TR')}</div>
              </div>
              <div>
                <div class="text-sm text-gray-400">Kaydeden</div>
                <div class="text-sm text-white">${item.created_by_name}</div>
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
      <div class="glass-card rounded-2xl shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold gradient-text">
              <i class="fas fa-clipboard-check mr-2"></i> Kalite Kararı
            </h2>
            <button onclick="this.closest('.fixed').remove()" 
              class="text-gray-400 hover:text-red-400 transition-colors duration-200 p-2 hover:bg-red-500/10 rounded-xl">
              <i class="fas fa-times text-3xl"></i>
            </button>
          </div>

          <div class="mb-6 p-4 bg-gray-800/50 rounded-lg">
            <div class="font-medium text-white mb-1">${materialCode}</div>
            <div class="text-sm text-gray-400 mb-2">${materialName}</div>
            <div class="text-lg font-bold text-blue-600">Gelen Miktar: ${receivedQty}</div>
          </div>

          <form id="qualityDecisionForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Kalite Durumu *</label>
              <select id="qualityStatus" required 
                class="w-full px-4 py-3 border border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 text-lg bg-gray-800/50 text-white">
                <option value="">Durum seçin...</option>
                <option value="kabul">✅ Kabul</option>
                <option value="iade">↩️ İade</option>
              </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Kabul Miktarı</label>
                <input type="number" id="acceptedQty" step="0.01" value="${receivedQty}" min="0" max="${receivedQty}"
                  class="w-full px-4 py-3 border border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 text-lg bg-gray-800/50 text-white">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">İade Miktarı</label>
                <input type="number" id="rejectedQty" step="0.01" value="0" min="0" max="${receivedQty}"
                  class="w-full px-4 py-3 border border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 text-lg bg-gray-800/50 text-white">
              </div>
            </div>

            <div id="reasonSection" class="hidden">
              <label class="block text-sm font-medium text-gray-300 mb-2">Açıklama / Red Nedeni *</label>
              <textarea id="reason" rows="4" required
                class="w-full px-4 py-3 border border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-800/50 text-white"
                placeholder="Detaylı açıklama girin..."></textarea>
            </div>

            <div class="flex gap-3 pt-4">
              <button type="submit" 
                class="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition text-lg">
                <i class="fas fa-check mr-2"></i> Kararı Kaydet
              </button>
              <button type="button" onclick="this.closest('.fixed').remove()" 
                class="px-6 py-3 bg-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-600 transition">
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
      const returns = await api.quality.returns();
      
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
                <table class="min-w-full divide-y divide-white/5">
                  <thead>
                    <tr>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Tarih</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">OTPA</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Proje</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Malzeme</th>
                      <th class="px-6 py-4 text-right text-xs font-bold text-gray-300 uppercase tracking-wider">İade Miktarı</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Sebep</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">İade Eden</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    ${returns.map(item => `
                      <tr class="hover:bg-white/[0.03] transition-all duration-200">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">${new Date(item.decision_date || item.created_at).toLocaleString('tr-TR')}</td>
                        <td class="px-6 py-4 font-semibold text-white">${item.otpa_number}</td>
                        <td class="px-6 py-4 text-sm font-medium text-gray-300">${item.project_name || ''}</td>
                        <td class="px-6 py-4">
                          <div class="font-semibold text-white">${item.material_code}</div>
                          <div class="text-xs text-gray-400">${item.material_name || ''}</div>
                        </td>
                        <td class="px-6 py-4 text-right">
                          <span class="font-bold text-red-400 text-lg">${item.rejected_quantity} ${item.unit || ''}</span>
                        </td>
                        <td class="px-6 py-4 text-sm max-w-xs truncate font-medium text-gray-300" title="${item.reason || ''}">${item.reason || '-'}</td>
                        <td class="px-6 py-4 text-sm font-medium text-gray-300">${item.decision_by_name || 'Sistem'}</td>
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
        <div class="glass-card rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-2xl font-bold gradient-text">
                <i class="fas fa-undo mr-2"></i> Yeni İade Oluştur
              </h2>
              <button onclick="this.closest('.fixed').remove()" 
                class="text-gray-400 hover:text-red-400 transition-colors duration-200 p-2 hover:bg-red-500/10 rounded-xl">
                <i class="fas fa-times text-3xl"></i>
              </button>
            </div>
            <p class="text-sm text-gray-400 mb-6">Montaj veya diğer sebeplerle kabul edilmiş bir malzemeyi iade edin</p>
            
            <form id="createReturnForm" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">OTPA Seç *</label>
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
          const accepted = await api.quality.acceptedMaterials(otpaId);
          
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
          
          await api.quality.createReturn({
            receipt_id: receiptId,
            return_quantity: quantity,
            reason: reason
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
  },

  async bulkApproveAll() {
    const confirmed = confirm('Bekleyen tüm kayıtları onaylamak istediğinizden emin misiniz?');
    if (!confirmed) return;

    try {
      showLoading(true);
      const response = await api.request('/quality/bulk/approve-all', {
        method: 'POST'
      });

      alert(`✅ ${response.approved_count} kayıt başarıyla onaylandı!`);
      this.renderPendingTab();
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      showLoading(false);
    }
  }
};

window.qualityPage = qualityPage;
