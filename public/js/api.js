// API Base URL
const API_BASE_URL = '/api';

// API Helper
const api = {
  // Helper function to make requests
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Bir hata oluştu');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  // Auth endpoints
  auth: {
    login: (username, password) => 
      api.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      }),
    
    logout: () => 
      api.request('/auth/logout', { method: 'POST' }),
    
    me: () => 
      api.request('/auth/me'),
    
    getUsers: () => 
      api.request('/auth/users'),
    
    createUser: (userData) => 
      api.request('/auth/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      })
  },

  // OTPA endpoints
  otpa: {
    list: () => 
      api.request('/otpa'),
    
    get: (id) => 
      api.request(`/otpa/${id}`),
    
    create: (data) => 
      api.request('/otpa', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    
    update: (id, data) => 
      api.request(`/otpa/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    
    delete: (id) => 
      api.request(`/otpa/${id}`, { method: 'DELETE' })
  },

  // BOM endpoints
  bom: {
    get: (otpaId) => 
      api.request(`/bom/${otpaId}`),
    
    upload: async (otpaId, file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('otpaId', otpaId);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/bom/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Yükleme hatası');
      return data;
    },
    
    create: (data) => 
      api.request('/bom', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    
    delete: (id) => 
      api.request(`/bom/${id}`, { method: 'DELETE' })
  },

  // Goods Receipt endpoints
  goodsReceipt: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return api.request(`/goods-receipt${query ? '?' + query : ''}`);
    },
    
    getByOtpa: (otpaId) => 
      api.request(`/goods-receipt/otpa/${otpaId}`),
    
    get: (id) => 
      api.request(`/goods-receipt/${id}`),
    
    create: (data) => 
      api.request('/goods-receipt', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },

  // Quality endpoints
  quality: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return api.request(`/quality${query ? '?' + query : ''}`);
    },
    
    pending: () => 
      api.request('/quality/pending'),
    
    get: (receiptId) => 
      api.request(`/quality/${receiptId}`),
    
    decision: (receiptId, data) => 
      api.request(`/quality/${receiptId}`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },

  // Reports endpoints
  reports: {
    otpaCompletion: (otpaId = null) => {
      const query = otpaId ? `?otpa_id=${otpaId}` : '';
      return api.request(`/reports/otpa-completion${query}`);
    },
    
    missingMaterials: (otpaId = null) => {
      const query = otpaId ? `?otpa_id=${otpaId}` : '';
      return api.request(`/reports/missing-materials${query}`);
    },
    
    rejections: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return api.request(`/reports/rejections${query ? '?' + query : ''}`);
    },
    
    summary: () => 
      api.request('/reports/summary')
  }
};

// Export to window
window.api = api;
