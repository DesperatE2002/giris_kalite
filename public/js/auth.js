// Authentication Management
const authManager = {
  currentUser: null,

  async login(username, password) {
    try {
      showLoading(true);
      const result = await api.auth.login(username, password);
      
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      
      this.currentUser = result.user;
      return result;
    } catch (error) {
      throw error;
    } finally {
      showLoading(false);
    }
  },

  async logout() {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      this.currentUser = null;
      location.reload();
    }
  },

  async checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token || !user) {
      return false;
    }

    try {
      const currentUser = await api.auth.me();
      this.currentUser = currentUser;
      return true;
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return false;
    }
  },

  hasRole(...roles) {
    return this.currentUser && roles.includes(this.currentUser.role);
  },

  isAdmin() {
    return this.hasRole('admin');
  },

  isKalite() {
    return this.hasRole('kalite', 'admin');
  }
};

// Toggle between login and register forms
document.getElementById('showRegisterBtn')?.addEventListener('click', () => {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
});

document.getElementById('showLoginBtn')?.addEventListener('click', () => {
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
});

// Login Form Handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');

  try {
    errorDiv.classList.add('hidden');
    await authManager.login(username, password);
    
    // Hide login, show main app
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    // Setup app navigation and render dashboard
    app.setupNavigation();
    app.updateUserInfo();
    app.navigate('dashboard');
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  }
});

// Register Form Handler
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fullName = document.getElementById('registerFullName').value;
  const username = document.getElementById('registerUsername').value;
  const password = document.getElementById('registerPassword').value;
  const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
  const errorDiv = document.getElementById('registerError');
  const successDiv = document.getElementById('registerSuccess');

  try {
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');

    if (password !== passwordConfirm) {
      throw new Error('Şifreler eşleşmiyor');
    }

    if (password.length < 6) {
      throw new Error('Şifre en az 6 karakter olmalıdır');
    }

    await api.auth.register({ full_name: fullName, username, password });
    
    successDiv.textContent = 'Hesabınız oluşturuldu! Giriş yapabilirsiniz.';
    successDiv.classList.remove('hidden');
    
    setTimeout(() => {
      document.getElementById('registerForm').classList.add('hidden');
      document.getElementById('loginForm').classList.remove('hidden');
      document.getElementById('username').value = username;
    }, 2000);
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  }
});

// Logout Button Handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
    authManager.logout();
  }
});

// Loading indicator
function showLoading(show) {
  const loadingScreen = document.getElementById('loadingScreen');
  if (show) {
    loadingScreen.classList.remove('hidden');
  } else {
    loadingScreen.classList.add('hidden');
  }
}

// Export
window.authManager = authManager;
window.showLoading = showLoading;
