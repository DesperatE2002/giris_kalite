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
      
      // Update user info
      this.updateUserInfo();
      
      // Viewer role -> welcome screen, proje_yonetici -> projects, others -> dashboard
      const user = authManager.currentUser;
      if (user && user.role === 'viewer') {
        this.navigate('welcome');
      } else if (user && user.role === 'proje_yonetici') {
        this.navigate('projects');
      } else {
        this.navigate('dashboard');
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

    const role = user.role;

    // Viewer: hide everything except logout
    if (role === 'viewer') {
      document.querySelectorAll('.nav-btn').forEach(btn => btn.style.display = 'none');
      return;
    }

    // Proje Yöneticisi: only projects page
    if (role === 'proje_yonetici') {
      document.querySelectorAll('.nav-btn').forEach(btn => {
        const page = btn.dataset.page;
        btn.style.display = (page === 'projects') ? '' : 'none';
      });
      return;
    }

    // --- Normal role logic for tekniker, kalite, admin ---

    // Dashboard, goods-receipt, returns, technicians, taskboard - visible to tekniker/kalite/admin
    ['dashboard', 'goods-receipt', 'returns', 'technicians', 'taskboard'].forEach(page => {
      document.querySelectorAll(`[data-page="${page}"]`).forEach(btn => btn.style.display = '');
    });

    // Quality page - only for kalite and admin
    document.querySelectorAll('[data-page="quality"]').forEach(btn => {
      btn.style.display = (role === 'kalite' || role === 'admin') ? '' : 'none';
    });

    // Admin page - only for admin
    document.querySelectorAll('[data-page="admin"]').forEach(btn => {
      btn.style.display = (role === 'admin') ? '' : 'none';
    });

    // Projects page - for admin and proje_yonetici
    document.querySelectorAll('[data-page="projects"]').forEach(btn => {
      btn.style.display = (role === 'admin' || role === 'proje_yonetici') ? '' : 'none';
    });

    // Paket-Analiz - only for admin
    document.querySelectorAll('[data-page="paket-analiz"]').forEach(btn => {
      btn.style.display = (role === 'admin') ? '' : 'none';
    });

    // Prosedür & OTPA - admin ve kalite
    document.querySelectorAll('[data-page="prosedur-otpa"]').forEach(btn => {
      btn.style.display = (role === 'admin' || role === 'kalite') ? '' : 'none';
    });
  },

  navigate(page) {
    // Show instant loading feedback
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="text-center">
          <i class="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
          <p class="text-gray-600">Sayfa yükleniyor...</p>
        </div>
      </div>
    `;
    
    // Update active navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      if (btn.dataset.page === page) {
        btn.classList.add('gradient-btn', 'shadow-lg', 'text-white');
        btn.classList.remove('text-gray-600', 'border-transparent', 'hover:bg-gray-100');
      } else {
        btn.classList.remove('gradient-btn', 'shadow-lg', 'text-white');
        btn.classList.add('text-gray-600', 'hover:bg-gray-100');
      }
    });

    // Render page
    this.currentPage = page;
    
    // Role-based access guard
    const user = authManager.currentUser;
    if (user) {
      if (user.role === 'viewer' && page !== 'welcome') {
        page = 'welcome';
        this.currentPage = page;
      }
      if (user.role === 'proje_yonetici' && page !== 'projects') {
        page = 'projects';
        this.currentPage = page;
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
          <h1 class="text-3xl font-bold text-gray-800 mb-3">Hoş Geldiniz, ${user ? user.full_name : ''}!</h1>
          <p class="text-gray-500 text-lg mb-2">E-LAB Süreç Kontrol Sistemine başarıyla kayıt oldunuz.</p>
          <div class="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-xl text-sm font-medium mt-2">
            <i class="fas fa-clock"></i>
            Hesabınız henüz bir role atanmamıştır. Yöneticiniz en kısa sürede rolünüzü belirleyecektir.
          </div>
        </div>

        <!-- Sistem Tanıtım -->
        <h2 class="text-xl font-bold text-gray-700 mb-4"><i class="fas fa-info-circle mr-2 text-indigo-500"></i>Sistemde Neler Yapabilirsiniz?</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <!-- Malzeme Giriş -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-blue-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-box text-blue-600"></i>
              </div>
              <div>
                <h3 class="font-bold text-gray-800">Malzeme Girişi</h3>
                <p class="text-sm text-gray-500 mt-1">Gelen malzemelerin sisteme kaydedilmesi, sipariş numarası ve OTPA bilgileri ile takip.</p>
              </div>
            </div>
          </div>

          <!-- Kalite Kontrol -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-green-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-check-circle text-green-600"></i>
              </div>
              <div>
                <h3 class="font-bold text-gray-800">Kalite Kontrol</h3>
                <p class="text-sm text-gray-500 mt-1">Gelen malzemelerin kalite muayenesi, kabul/ret kararları ve iade işlemleri.</p>
              </div>
            </div>
          </div>

          <!-- İş Takip -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-purple-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-hard-hat text-purple-600"></i>
              </div>
              <div>
                <h3 class="font-bold text-gray-800">Tekniker İş Takip</h3>
                <p class="text-sm text-gray-500 mt-1">Teknikerlere iş atama, görev durumu takibi, performans puanlaması ve günlük raporlar.</p>
              </div>
            </div>
          </div>

          <!-- Proje Takip -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-orange-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-project-diagram text-orange-600"></i>
              </div>
              <div>
                <h3 class="font-bold text-gray-800">Proje Takip</h3>
                <p class="text-sm text-gray-500 mt-1">Projelerin planlanması, görev atamaları, Gantt şeması ve ilerleme takibi.</p>
              </div>
            </div>
          </div>

          <!-- Paket Analiz -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-teal-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-cubes text-teal-600"></i>
              </div>
              <div>
                <h3 class="font-bold text-gray-800">Paket Analiz</h3>
                <p class="text-sm text-gray-500 mt-1">Ürün paket analizleri, maliyet hesaplamaları, tedarikçi karşılaştırmaları ve detaylı raporlar.</p>
              </div>
            </div>
          </div>

          <!-- Raporlar -->
          <div class="glass-card rounded-xl p-5 border-l-4 border-indigo-500">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-chart-bar text-indigo-600"></i>
              </div>
              <div>
                <h3 class="font-bold text-gray-800">Dashboard & Raporlar</h3>
                <p class="text-sm text-gray-500 mt-1">Genel bakış, istatistikler, Word/Excel rapor çıktıları ve performans analizleri.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card rounded-xl p-5 bg-gradient-to-r from-indigo-50 to-purple-50 text-center">
          <i class="fas fa-headset text-2xl text-indigo-400 mb-2"></i>
          <p class="text-gray-600 text-sm">Sorularınız için yöneticinize başvurabilirsiniz. Rolünüz atandıktan sonra ilgili modüllere erişebileceksiniz.</p>
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
