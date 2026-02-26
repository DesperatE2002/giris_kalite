// Main App Controller
const app = {
  currentPage: null,

  async init() {
    // Check authentication
    const isAuthenticated = await authManager.checkAuth();

    if (isAuthenticated) {
      // Show main app
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('mainApp').classList.remove('hidden');
      
      // Setup navigation
      this.setupNavigation();
      this.setupHistoryNavigation();
      
      // Update user info
      this.updateUserInfo();
      
      // Check hash for deep-link navigation
      const hash = location.hash.replace('#', '');
      const validPages = ['dashboard','goods-receipt','returns','quality','admin','projects','technicians','taskboard','paket-analiz','prosedur-otpa','field-changelog','welcome'];
      
      if (hash && validPages.includes(hash)) {
        this.navigate(hash);
      } else {
        // İzin tabanlı varsayılan sayfa
        const defaultPage = authManager.getDefaultPage();
        this.navigate(defaultPage);
      }
    } else {
      // Show login screen
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('mainApp').classList.add('hidden');
    }
  },

  setupNavigation() {
    // Get all navigation buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const page = e.currentTarget.dataset.page;
        this.navigate(page);
      });
    });

    // Show/hide menu items based on role
    this.updateMenuVisibility();
  },

  // ─── Browser History (Back/Forward) Support ───────────────────────
  setupHistoryNavigation() {
    window.addEventListener('popstate', (e) => {
      const state = e.state;
      if (state?.page) {
        this._clearModuleStates();
        this.navigate(state.page, false);
      } else {
        const hash = location.hash.replace('#', '');
        if (hash) {
          this._clearModuleStates();
          this.navigate(hash, false);
        }
      }
    });
  },

  _clearModuleStates() {
    if (typeof FieldChangelog !== 'undefined') {
      FieldChangelog.viewingLog = null;
      FieldChangelog.viewingTimeline = null;
      FieldChangelog.editingLog = null;
    }
    if (typeof ProsedurOtpa !== 'undefined') {
      ProsedurOtpa.viewingOtpa = null;
      ProsedurOtpa.fillingForm = null;
      ProsedurOtpa.viewingBatteryReport = null;
      ProsedurOtpa.viewingTemplate = null;
    }
  },

  updateUserInfo() {
    const user = authManager.currentUser;
    if (user) {
      const roleText = {
        'viewer': 'Yeni Kullanıcı',
        'tekniker': 'Tekniker',
        'kalite': 'Kalite',
        'proje_yonetici': 'Proje Yöneticisi',
        'admin': 'Admin'
      }[user.role] || user.role;

      document.getElementById('userInfo').textContent = 
        `${user.full_name} (${roleText})`;
    }
  },

  updateMenuVisibility() {
    const user = authManager.currentUser;
    if (!user) return;

    // Admin her zaman tüm menüleri görsün
    if (user.role === 'admin') {
      document.querySelectorAll('.nav-btn').forEach(btn => btn.style.display = '');
      return;
    }

    // Dinamik izin tabanlı menü görünürlüğü
    const permissions = user.permissions || {};
    const hasAnyPerm = Object.values(permissions).some(p => p.access);

    // Eğer hiç izni yoksa tüm menüyü gizle
    if (!hasAnyPerm) {
      document.querySelectorAll('.nav-btn').forEach(btn => btn.style.display = 'none');
      return;
    }

    // Her nav button için izin kontrolü yap
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const page = btn.dataset.page;
      if (!page) return;
      
      const perm = permissions[page];
      btn.style.display = (perm && perm.access) ? '' : 'none';
    });
  },

  navigate(page, pushHistory = true) {
    // Push browser history state
    if (pushHistory && history.pushState) {
      history.pushState({ page }, '', '#' + page);
    }

    // Show instant loading feedback
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <i class="fas fa-spinner fa-spin text-4xl text-indigo-500 mb-4"></i>
          <p class="text-gray-400">Sayfa yükleniyor...</p>
        </div>
      </div>
    `;
    
    // Update active navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      if (btn.dataset.page === page) {
        btn.classList.add('gradient-btn', 'shadow-lg', 'text-white');
        btn.classList.remove('text-gray-400', 'border-transparent');
      } else {
        btn.classList.remove('gradient-btn', 'shadow-lg', 'text-white');
        btn.classList.add('text-gray-400');
      }
    });

    // Render page
    this.currentPage = page;
    
    // Role-based access guard
    const user = authManager.currentUser;
    if (user) {
      // İzin kontrolü: sayfaya erişim izni yoksa varsayılan sayfaya yönlendir
      if (page !== 'welcome' && !authManager.hasPermission(page)) {
        const defaultPage = authManager.getDefaultPage();
        if (defaultPage !== page) {
          page = defaultPage;
          this.currentPage = page;
        }
      }
    }

    switch (page) {
      case 'welcome':
        this.renderWelcome();
        break;
      case 'dashboard':
        dashboardPage.render();
        break;
      case 'goods-receipt':
        goodsReceiptPage.render();
        break;
      case 'returns':
        ReturnsPage.render();
        break;
      case 'quality':
        qualityPage.render();
        break;
      case 'admin':
        adminPage.render();
        break;
      case 'projects':
        ProjectsPage.render();
        break;
      case 'technicians':
        TechPage.render();
        break;
      case 'taskboard':
        TaskBoard.render();
        break;
      case 'paket-analiz':
        PaketAnaliz.render();
        break;
      case 'prosedur-otpa':
        ProsedurOtpa.render();
        break;
      case 'field-changelog':
        FieldChangelog.render();
        break;
      default:
        this.navigate('dashboard');
    }

    // Scroll to top
    window.scrollTo(0, 0);
  },

  renderWelcome() {
    const content = document.getElementById('content');
    const user = authManager.currentUser;
    content.innerHTML = `
      <div class="max-w-4xl mx-auto">
        <!-- Hoş Geldin Kartı -->
        <div class="glass-card rounded-2xl p-8 mb-8 text-center">
          <div class="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <i class="fas fa-hand-sparkles text-3xl text-white"></i>
          </div>
          <h1 class="text-3xl font-bold text-white mb-3">Hoş Geldiniz, ${user ? user.full_name : ''}!</h1>
          <p class="text-gray-400 text-lg mb-2">E-LAB Süreç Kontrol Sistemine başarıyla kayıt oldunuz.</p>
          <div class="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-4 py-2 rounded-xl text-sm font-medium mt-2">
            <i class="fas fa-clock"></i>
            Hesabınız henüz bir role atanmamıştır. Yöneticiniz en kısa sürede rolünüzü belirleyecektir.
          </div>
        </div>

        <!-- Sistem Tanıtım -->
        <h2 class="text-xl font-bold text-gray-300 mb-4"><i class="fas fa-info-circle mr-2 text-indigo-500"></i>Sistemde Neler Yapabilirsiniz?</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <!-- Malzeme Giriş -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-blue-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-box text-blue-400"></i>
              </div>
              <div>
                <h3 class="font-bold text-white">Malzeme Girişi</h3>
                <p class="text-sm text-gray-400 mt-1">Gelen malzemelerin sisteme kaydedilmesi, sipariş numarası ve OTPA bilgileri ile takip.</p>
              </div>
            </div>
          </div>

          <!-- Kalite Kontrol -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-green-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-green-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-check-circle text-green-400"></i>
              </div>
              <div>
                <h3 class="font-bold text-white">Kalite Kontrol</h3>
                <p class="text-sm text-gray-400 mt-1">Gelen malzemelerin kalite muayenesi, kabul/ret kararları ve iade işlemleri.</p>
              </div>
            </div>
          </div>

          <!-- İş Takip -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-purple-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-purple-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-hard-hat text-purple-400"></i>
              </div>
              <div>
                <h3 class="font-bold text-white">Tekniker İş Takip</h3>
                <p class="text-sm text-gray-400 mt-1">Teknikerlere iş atama, görev durumu takibi, performans puanlaması ve günlük raporlar.</p>
              </div>
            </div>
          </div>

          <!-- Proje Takip -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-orange-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-orange-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-project-diagram text-orange-400"></i>
              </div>
              <div>
                <h3 class="font-bold text-white">Proje Takip</h3>
                <p class="text-sm text-gray-400 mt-1">Projelerin planlanması, görev atamaları, Gantt şeması ve ilerleme takibi.</p>
              </div>
            </div>
          </div>

          <!-- Paket Analiz -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-teal-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-teal-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-cubes text-teal-400"></i>
              </div>
              <div>
                <h3 class="font-bold text-white">Paket Analiz</h3>
                <p class="text-sm text-gray-400 mt-1">Ürün paket analizleri, maliyet hesaplamaları, tedarikçi karşılaştırmaları ve detaylı raporlar.</p>
              </div>
            </div>
          </div>

          <!-- Raporlar -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-indigo-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-indigo-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-chart-bar text-indigo-400"></i>
              </div>
              <div>
                <h3 class="font-bold text-white">Dashboard & Raporlar</h3>
                <p class="text-sm text-gray-400 mt-1">Genel bakış, istatistikler, Word/Excel rapor çıktıları ve performans analizleri.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card rounded-xl p-5 text-center">
          <i class="fas fa-headset text-2xl text-indigo-400 mb-2"></i>
          <p class="text-gray-400 text-sm">Sorularınız için yöneticinize başvurabilirsiniz. Rolünüz atandıktan sonra ilgili modüllere erişebileceksiniz.</p>
        </div>
      </div>
    `;
  }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// Export app
window.app = app;
