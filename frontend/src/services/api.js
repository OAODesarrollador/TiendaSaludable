import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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
  getTicketPDF: (id) => api.get(`/sales/${id}/ticket`, { responseType: 'blob' }),

  // ✅ NUEVO: crear nota de crédito (refund)
  createRefund: (saleId, refundData) => api.post(`/sales/${saleId}/refunds`, refundData),

  // ✅ NUEVO: obtener todas las notas de crédito de una venta
  getRefundsBySale: (saleId) => api.get(`/sales/${saleId}/refunds`),

  // ✅ NUEVO: obtener una nota de crédito específica
  getRefundById: (refundId) => api.get(`/sales/refund/${refundId}`),

  // 🧾 NUEVO: obtener PDF de una nota de crédito
  getRefundPDF: (refundId) => api.get(`/sales/refund/${refundId}/pdf`, { responseType: 'blob' }),

  checkRefund: (saleId) => api.get(`/sales/${saleId}/check-refund`)

};

// ========== REPORTS ==========
export const reportsAPI = {
  // === Ventas ===
  getSalesReport: (params) => api.get('/reports/sales', { params }),
  getMonthlySalesReport: (params) => api.get('/reports/sales/monthly', { params }),
  getSalesAnalysisReport: (params) => api.get('/reports/sales/analysis', { params }),
  exportSalesAnalysisExcel: (params) =>
    api.get('/reports/sales/analysis/export/excel', { params, responseType: 'blob' }),
  exportCSV: (params) =>
    api.get('/reports/sales/export/csv', { params, responseType: 'blob' }),
  exportExcel: (params) =>
    api.get('/reports/sales/export/excel', { params, responseType: 'blob' }),
  exportPDF: (params) =>
    api.get('/reports/sales/export/pdf', { params, responseType: 'blob' }),
  exportMonthlySalesExcel: (params) =>
    api.get('/reports/sales/monthly/export/excel', { params, responseType: 'blob' }),
  exportMonthlySalesPDF: (params) =>
    api.get('/reports/sales/monthly/export/pdf', { params, responseType: 'blob' }),

  // === Vencimientos ===
  getExpiringProducts: (params) =>
    api.get('/reports/expiring', { params }),
  exportExpiringCSV: (params) =>
    api.get('/reports/expiring/export/csv', { params, responseType: 'blob' }),
  exportExpiringExcel: (params) =>
    api.get('/reports/expiring/export/excel', { params, responseType: 'blob' }),
  exportExpiringPDF: (params) =>
    api.get('/reports/expiring/export/pdf', { params, responseType: 'blob' }),

  // === 🆕 Descuentos ===
  getDiscountSales: (params) =>
    api.get('/reports/discounts', { params }),

  exportDiscountCSV: (params) =>
    api.get('/reports/discounts/export/csv', {
      params,
      responseType: 'blob'
    }),
  exportDiscountExcel: (params) =>
    api.get('/reports/discounts/export/excel', {
      params,
      responseType: 'blob'
    }),

  exportDiscountPDF: (params) =>
    api.get('/reports/discounts/export/pdf', {
      params,
      responseType: 'blob'
    }),

  getProductsReport: (params) =>
    api.get('/reports/products', { params }),

  exportProductsCSV: (params) =>
    api.get('/reports/products/export/csv', {
      params,
      responseType: 'blob'
    }),
  exportProductsExcel: (params) =>
    api.get('/reports/products/export/excel', {
      params,
      responseType: 'blob'
    }),

  exportProductsPDF: (params) =>
    api.get('/reports/products/export/pdf', {
      params,
      responseType: 'blob'
    }),

  getRestockExpensesReport: (params) =>
    api.get('/reports/expenses/restock', { params }),
  getRestockExpenseConcepts: (params) =>
    api.get('/reports/expenses/restock/concepts', { params }),
  exportRestockExpensesExcel: (params) =>
    api.get('/reports/expenses/restock/export/excel', {
      params,
      responseType: 'blob'
    })
};

// ========== DASHBOARD ==========
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getSalesTimeline: (start, end) =>
    api.get(`/dashboard/timeline?start_date=${start}&end_date=${end}`) // ✅ Usa 'api' en vez de 'axios'
};

// ========== CASH ==========
export const cashAPI = {
  getSession: () => api.get('/cash/session'),
  getPendingClose: () => api.get('/cash/pending-close'),
  openSession: (data) => api.post('/cash/register', data),
  closeSession: (data) => api.post('/cash/close', data),
  addMovement: (data) => api.post('/cash/movement', data),
  getReport: (params) => api.get('/cash/report', { params })
};

// ========= SALE TYPES ==========
export const saleTypesAPI = {
  getAll: () => api.get('/sale-types'),
  create: (data) => api.post('/sale-types', data),
  update: (id, data) => api.put(`/sale-types/${id}`, data),
  delete: (id) => api.delete(`/sale-types/${id}`)
};

// ========== IMPORTADOR ==========

export async function fetchProducts() {
  const res = await api.get('/products');
  return res.data;
}

export async function createProduct(data) {
  const res = await api.post('/products', data);
  return res.data;
}

export async function updateProduct(id, data) {
  const res = await api.put(`/products/${id}`, data);
  return res.data;
}

export async function deleteProduct(id) {
  const res = await api.delete(`/products/${id}`);
  return res.data;
}

export const importCsv = async (formData) => {
  const res = await api.post('/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const updatePricesMatched = async (formData) => {
  const res = await api.post('/import/update-prices-matched', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};



export default api;
