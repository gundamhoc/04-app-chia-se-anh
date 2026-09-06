import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ====================================================
// Cách kết nối backend:
// 1. Ưu tiên: EXPO_PUBLIC_API_URL (ngrok / production server)
// 2. Tự động lấy IP của máy tính (LAN IP) qua Expo Metro hostUri
// 3. Fallback: Android emulator (10.0.2.2) hoặc iOS/Web (localhost)
// ====================================================

const getHostIp = (): string | null => {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest?.debuggerHost ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri && typeof hostUri === 'string') {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  } catch (e) {
    // fallback if Constants fails
  }
  return null;
};

const getBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    return `${trimmed}/api`;
  }

  // 1. Trình duyệt Web (Chrome DevTools / Web browser) -> Dùng localhost:5000
  if (Platform.OS === 'web') {
    return 'http://localhost:5000/api';
  }

  // 2. Thiết bị thật (Expo Go trên Mobile) -> Tự động phát hiện IP LAN từ Expo Bundler
  const hostIp = getHostIp();
  if (hostIp) {
    return `http://${hostIp}:5000/api`;
  }

  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5000/api';
    }
    if (Platform.OS === 'ios') {
      return 'http://localhost:5000/api';
    }
  }
  return 'http://localhost:5000/api';
};

const BASE_URL = getBaseUrl();
if (__DEV__) {
  console.log('🌐 [API] Base URL configured:', BASE_URL);
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

import { storage } from '../utils/storage';

// Request interceptor: tự động gắn JWT token
api.interceptors.request.use(
  async (config) => {
    const token = await storage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: xử lý lỗi global
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await storage.deleteItem('auth_token');
    }
    return Promise.reject(error);
  }
);

export default api;
export { BASE_URL };
