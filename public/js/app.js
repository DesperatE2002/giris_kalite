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
      
      // Navigate to dashboard
      this.navigate('dashboard');
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
        'tekniker': 'Tekniker',
        'kalite': 'Kalite',
        'admin': 'Admin'
      }[user.role] || user.role;

      document.getElementById('userInfo').textContent = 
        `${user.full_name} (${roleText})`;
    }
  },

  updateMenuVisibility() {
    const user = authManager.currentUser;
    if (!user) return;

    // Quality page - only for kalite and admin
    document.querySelectorAll('[data-page="quality"]').forEach(btn => {
      if (user.role === 'kalite' || user.role === 'admin') {
        btn.style.display = '';
      } else {
        btn.style.display = 'none';
      }
    });

    // Admin page - only for admin
    document.querySelectorAll('[data-page="admin"]').forEach(btn => {
      if (user.role === 'admin') {
        btn.style.display = '';
      } else {
        btn.style.display = 'none';
      }
    });

    // Projects page - only for admin
    document.querySelectorAll('[data-page="projects"]').forEach(btn => {
      if (user.role === 'admin') {
        btn.style.display = '';
      } else {
        btn.style.display = 'none';
      }
    });

    // Technicians page - visible to all users
    document.querySelectorAll('[data-page="technicians"]').forEach(btn => {
      btn.style.display = '';
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
    
    switch (page) {
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
      default:
        this.navigate('dashboard');
    }

    // Scroll to top
    window.scrollTo(0, 0);
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
