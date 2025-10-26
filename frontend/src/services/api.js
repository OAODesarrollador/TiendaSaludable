import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Crear instancia de axios con configuración
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ========== AUTH ==========
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile')
};

// ========== PRODUCTS ==========
export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  getByEAN: (ean13) => api.get(`/products/ean/${ean13}`),
  create: (productData) => api.post('/products', productData),
  update: (id, productData) => api.put(`/products/${id}`, productData),
  delete: (id) => api.delete(`/products/${id}`),
  getCategories: () => api.get('/products/categories'),
  getLowStock: () => api.get('/products/low-stock'),
  getBarcodeImage: (ean13) => `${API_URL}/products/barcode/${ean13}`
};

// ========== SALES ==========
export const salesAPI = {
  create: (saleData) => api.post('/sales', saleData),
  getAll: (params) => api.get('/sales', { params }),
  getById: (id) => api.get(`/sales/${id}`),
  getTicketPDF: (id) => api.get(`/sales/${id}/ticket`, { responseType: 'blob' })
};

// ========== REPORTS ==========
export const reportsAPI = {
  getSalesReport: (params) => api.get('/reports/sales', { params }),
  exportCSV: (params) =>
    api.get('/reports/export/csv', { params, responseType: 'blob' }),
  exportPDF: (params) =>
    api.get('/reports/export/pdf', { params, responseType: 'blob' }),

  // 👇 nuevos endpoints para vencimientos
  getExpiringProducts: (params) =>
    api.get('/reports/expiring', { params }),
  exportExpiringCSV: (params) =>
    api.get('/reports/export/expiring-csv', { params, responseType: 'blob' }),
  exportExpiringPDF: (params) =>
    api.get('/reports/export/expiring-pdf', { params, responseType: 'blob' })
};

// ========== DASHBOARD ==========
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats')
};

// ========== IMPORTADOR ==========

export async function fetchProducts() {
  const res = await fetch(`${API_URL}/products`);
  return res.json();
}

export async function createProduct(data) {
  const res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function updateProduct(id, data) {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteProduct(id) {
  const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
  return res.json();
}

export const importCsv = async (formData) => {
  const res = await fetch(`${API_URL}/import`, {
    method: 'POST',
    body: formData
  });

  // Manejo explícito de errores HTTP
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error en servidor: ${res.status} ${text || res.statusText}`);
  }

  // Retornamos el JSON parseado
  return res.json();
};

export const updatePricesMatched = async (formData) => {
  const res = await fetch(`${API_URL}/import/update-prices-matched`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Error en servidor: ${res.status} ${text || res.statusText}`);
  }

  return res.json();
};



export default api;