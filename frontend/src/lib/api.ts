import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

// Auth
export const getChallenge = (publicKey: string) =>
  api.get('/auth/challenge', { params: { publicKey } });
export const register = (body: object) => api.post('/auth/register', body);
export const login = (body: object) => api.post('/auth/login', body);
export const getMe = () => api.get('/auth/me');

// Products
export const getProducts = (params?: object) => api.get('/products', { params });
export const getProduct = (id: string) => api.get(`/products/${id}`);
export const createProduct = (data: FormData) =>
  api.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const activateProduct = (id: string, body: object) =>
  api.patch(`/products/${id}/activate`, body);
export const updateProduct = (id: string, body: object) =>
  api.patch(`/products/${id}`, body);
export const delistProduct = (id: string) => api.delete(`/products/${id}`);

// Orders
export const getOrders = () => api.get('/orders');
export const getOrder = (id: string) => api.get(`/orders/${id}`);
export const createOrder = (body: object) => api.post('/orders', body);
export const fundOrder = (id: string, body: object) =>
  api.patch(`/orders/${id}/fund`, body);
export const shipOrder = (id: string, body: object) =>
  api.post(`/orders/${id}/ship`, body);
export const completeOrder = (id: string, body: object) =>
  api.post(`/orders/${id}/complete`, body);
export const disputeOrder = (id: string, body: object) =>
  api.post(`/orders/${id}/dispute`, body);
export const resolveOrder = (id: string, body: object) =>
  api.patch(`/orders/${id}/resolve`, body);

// Users
export const getUser = (publicKey: string) => api.get(`/users/${publicKey}`);
export const verifyChain = () => api.patch('/users/verify-chain');
export const updateMe = (body: object) => api.patch('/users/me', body);
export const getUserHistory = (publicKey: string) =>
  api.get(`/users/${publicKey}/history`);

// Disputes
export const getDisputes = () => api.get('/disputes');
