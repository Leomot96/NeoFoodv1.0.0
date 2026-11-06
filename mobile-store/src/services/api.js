import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

const DEFAULT_SERVER_URL = import.meta.env?.VITE_API_URL || 'http://localhost:4000/api/v1';

export const normalizeServerUrl = (rawUrl) => {
  let cleanUrl = (rawUrl || '').trim();
  if (!cleanUrl) return DEFAULT_SERVER_URL;

  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    const isLocalHost = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?(\/|$)/i.test(cleanUrl);
    cleanUrl = `${isLocalHost ? 'http' : 'https'}://${cleanUrl}`;
  }

  cleanUrl = cleanUrl.replace(/\/+$/, '');
  if (!cleanUrl.endsWith('/api/v1')) {
    if (cleanUrl.endsWith('/api')) {
      cleanUrl = `${cleanUrl}/v1`;
    } else {
      cleanUrl = `${cleanUrl}/api/v1`;
    }
  }
  return cleanUrl;
};

export const getServerUrl = async () => {
  try {
    const { value } = await Preferences.get({ key: 'neofood_store_server_url' });
    return value || localStorage.getItem('neofood_store_server_url') || DEFAULT_SERVER_URL;
  } catch (e) {
    return localStorage.getItem('neofood_store_server_url') || DEFAULT_SERVER_URL;
  }
};

export const setServerUrl = async (url) => {
  const cleanUrl = normalizeServerUrl(url);
  try {
    await Preferences.set({ key: 'neofood_store_server_url', value: cleanUrl });
  } catch (e) {
    // Fallback
  }
  localStorage.setItem('neofood_store_server_url', cleanUrl);
  api.defaults.baseURL = cleanUrl;
  return cleanUrl;
};

const api = axios.create({
  baseURL: localStorage.getItem('neofood_store_server_url') || DEFAULT_SERVER_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para asegurar que use la baseURL almacenada
api.interceptors.request.use(async (config) => {
  try {
    const currentBase = await getServerUrl();
    if (currentBase) {
      config.baseURL = currentBase;
    }
  } catch (e) {}
  return config;
});

export const storeService = {
  getPublicStore: async (slug = 'default') => {
    const res = await api.get(`/store/public/${slug}`);
    return res.data?.data || res.data;
  },
  createPublicOrder: async (slug = 'default', orderPayload) => {
    const res = await api.post(`/store/public/${slug}/order`, orderPayload);
    return res.data?.data || res.data;
  }
};

export default api;
