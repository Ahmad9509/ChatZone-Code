// API client for Admin Panel
// Production-ready admin API integration
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Create axios instance for admin
const adminApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add admin token to requests
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default adminApi;

// Admin API methods
export const adminAuth = {
  login: (username: string, password: string) => adminApi.post('/api/admin/login', { username, password }),
  getMe: () => adminApi.get('/api/admin/me'),
  logout: () => adminApi.post('/api/admin/logout'),
};

export const models = {
  list: () => adminApi.get('/api/admin/models'),
  create: (data: any) => adminApi.post('/api/admin/models', data),
  update: (id: string, data: any) => adminApi.put(`/api/admin/models/${id}`, data),
  delete: (id: string) => adminApi.delete(`/api/admin/models/${id}`),
};

export const users = {
  list: (params?: any) => adminApi.get('/api/admin/users', { params }),
  get: (id: string) => adminApi.get(`/api/admin/users/${id}`),
  update: (id: string, data: any) => adminApi.put(`/api/admin/users/${id}`, data),
  delete: (id: string) => adminApi.delete(`/api/admin/users/${id}`),
};

export const analytics = {
  overview: () => adminApi.get('/api/admin/analytics/overview'),
  revenue: (params?: any) => adminApi.get('/api/admin/analytics/revenue', { params }),
  usage: (params?: any) => adminApi.get('/api/admin/analytics/usage', { params }),
};

export const systemPrompts = {
  list: () => adminApi.get('/api/admin/prompts'),
  update: (type: string, content: string) => adminApi.put('/api/admin/prompts', { type, content }),
};

export const tiers = {
  list: () => adminApi.get('/api/admin/tiers'),
  update: (tierName: string, config: any) => adminApi.put(`/api/admin/tiers/${tierName}`, config),
};

