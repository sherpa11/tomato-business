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

// In-memory cache & request deduplication for active dropdown reference lists
let activeBuyersCache = null;
let activeBuyersCacheTime = 0;
let activeBuyersInFlight = null;

let activeSuppliersCache = null;
let activeSuppliersCacheTime = 0;
let activeSuppliersInFlight = null;

const CACHE_TTL_MS = 60000; // 60 seconds TTL

export const invalidateDropdownCache = () => {
  activeBuyersCache = null;
  activeBuyersCacheTime = 0;
  activeBuyersInFlight = null;
  activeSuppliersCache = null;
  activeSuppliersCacheTime = 0;
  activeSuppliersInFlight = null;
};

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me')
};

export const settingsAPI = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data)
};

export const buyersAPI = {
  getBuyers: (params = {}) => {
    // Only cache pure active buyer list without search
    const isActiveOnly = params && params.active === true && !params.search;
    const now = Date.now();

    if (isActiveOnly) {
      if (activeBuyersCache && now - activeBuyersCacheTime < CACHE_TTL_MS) {
        return Promise.resolve(activeBuyersCache);
      }
      if (activeBuyersInFlight) {
        return activeBuyersInFlight;
      }

      activeBuyersInFlight = api
        .get('/buyers', { params: { dropdown: 'true', ...params } })
        .then((data) => {
          activeBuyersCache = data;
          activeBuyersCacheTime = Date.now();
          activeBuyersInFlight = null;
          return data;
        })
        .catch((err) => {
          activeBuyersInFlight = null;
          throw err;
        });

      return activeBuyersInFlight;
    }

    return api.get('/buyers', { params });
  },
  getBuyerById: (id) => api.get(`/buyers/${id}`),
  createBuyer: async (data) => {
    const res = await api.post('/buyers', data);
    invalidateDropdownCache();
    return res;
  },
  updateBuyer: async (id, data) => {
    const res = await api.put(`/buyers/${id}`, data);
    invalidateDropdownCache();
    return res;
  },
  deleteBuyer: async (id) => {
    const res = await api.delete(`/buyers/${id}`);
    invalidateDropdownCache();
    return res;
  },
  getBuyerLedger: (id) => api.get(`/buyers/${id}/ledger`),
  recalculateBuyer: async (id) => {
    const res = await api.post(`/buyers/${id}/recalculate`);
    invalidateDropdownCache();
    return res;
  }
};

export const suppliersAPI = {
  getSuppliers: (params = {}) => {
    const isActiveOnly = params && params.active === true && !params.search;
    const now = Date.now();

    if (isActiveOnly) {
      if (activeSuppliersCache && now - activeSuppliersCacheTime < CACHE_TTL_MS) {
        return Promise.resolve(activeSuppliersCache);
      }
      if (activeSuppliersInFlight) {
        return activeSuppliersInFlight;
      }

      activeSuppliersInFlight = api
        .get('/suppliers', { params: { dropdown: 'true', ...params } })
        .then((data) => {
          activeSuppliersCache = data;
          activeSuppliersCacheTime = Date.now();
          activeSuppliersInFlight = null;
          return data;
        })
        .catch((err) => {
          activeSuppliersInFlight = null;
          throw err;
        });

      return activeSuppliersInFlight;
    }

    return api.get('/suppliers', { params });
  },
  getSupplierById: (id) => api.get(`/suppliers/${id}`),
  createSupplier: async (data) => {
    const res = await api.post('/suppliers', data);
    invalidateDropdownCache();
    return res;
  },
  updateSupplier: async (id, data) => {
    const res = await api.put(`/suppliers/${id}`, data);
    invalidateDropdownCache();
    return res;
  },
  deleteSupplier: async (id) => {
    const res = await api.delete(`/suppliers/${id}`);
    invalidateDropdownCache();
    return res;
  },
  getSupplierPurchases: (id) => api.get(`/suppliers/${id}/purchases`)
};

export const purchasesAPI = {
  getPurchases: (params) => api.get('/purchases', { params }),
  getPurchaseById: (id) => api.get(`/purchases/${id}`),
  createPurchase: async (data) => {
    const res = await api.post('/purchases', data);
    invalidateDropdownCache();
    return res;
  },
  voidPurchase: async (id, data) => {
    const res = await api.post(`/purchases/${id}/void`, data);
    invalidateDropdownCache();
    return res;
  },
  getConsolidated: (params) => api.get('/purchases/consolidated', { params }),
  saveDeductions: async (data) => {
    const res = await api.put('/purchases/consolidated/deductions', data);
    invalidateDropdownCache();
    return res;
  }
};

export const transactionsAPI = {
  getTransactions: (params) => api.get('/transactions', { params }),
  getTransactionById: (id) => api.get(`/transactions/${id}`),
  createSale: async (data) => {
    const res = await api.post('/transactions/sale', data);
    invalidateDropdownCache();
    return res;
  },
  createPayment: async (data) => {
    const res = await api.post('/transactions/payment', data);
    invalidateDropdownCache();
    return res;
  },
  voidTransaction: async (id, data) => {
    const res = await api.post(`/transactions/${id}/void`, data);
    invalidateDropdownCache();
    return res;
  },
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
