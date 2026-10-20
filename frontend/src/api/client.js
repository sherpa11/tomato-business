import axios from 'axios';

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const baseURL = apiBase ? `${apiBase}/api` : '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tomato_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('tomato_token');
      localStorage.removeItem('tomato_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error.response ? error.response.data : error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me')
};

export const settingsAPI = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data)
};

export const buyersAPI = {
  getBuyers: (params) => api.get('/buyers', { params }),
  getBuyerById: (id) => api.get(`/buyers/${id}`),
  createBuyer: (data) => api.post('/buyers', data),
  updateBuyer: (id, data) => api.put(`/buyers/${id}`, data),
  deleteBuyer: (id) => api.delete(`/buyers/${id}`),
  getBuyerLedger: (id) => api.get(`/buyers/${id}/ledger`),
  recalculateBuyer: (id) => api.post(`/buyers/${id}/recalculate`)
};

export const suppliersAPI = {
  getSuppliers: (params) => api.get('/suppliers', { params }),
  getSupplierById: (id) => api.get(`/suppliers/${id}`),
  createSupplier: (data) => api.post('/suppliers', data),
  updateSupplier: (id, data) => api.put(`/suppliers/${id}`, data),
  deleteSupplier: (id) => api.delete(`/suppliers/${id}`),
  getSupplierPurchases: (id) => api.get(`/suppliers/${id}/purchases`)
};


export const purchasesAPI = {
  getPurchases: (params) => api.get('/purchases', { params }),
  getPurchaseById: (id) => api.get(`/purchases/${id}`),
  createPurchase: (data) => api.post('/purchases', data),
  voidPurchase: (id, data) => api.post(`/purchases/${id}/void`, data),
  getConsolidated: (params) => api.get('/purchases/consolidated', { params }),
  saveDeductions: (data) => api.put('/purchases/consolidated/deductions', data)
};

export const transactionsAPI = {
  getTransactions: (params) => api.get('/transactions', { params }),
  getTransactionById: (id) => api.get(`/transactions/${id}`),
  createSale: (data) => api.post('/transactions/sale', data),
  createPayment: (data) => api.post('/transactions/payment', data),
  voidTransaction: (id, data) => api.post(`/transactions/${id}/void`, data),
  getConsolidated: (params) => api.get('/transactions/consolidated', { params })
};

export const dashboardAPI = {
  getSummary: (date) => api.get('/dashboard', { params: { date } })
};

export const reportsAPI = {
  getReports: (params) => api.get('/reports', { params })
};

export const printAPI = {
  getStatus: () => api.get('/print/status'),
  directPrint: (data) => api.post('/print/direct', data),
  streamPdf: (data) => api.post('/print/pdf', data, { responseType: 'blob' })
};

export default api;
