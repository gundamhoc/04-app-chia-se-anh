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
  // 1. Trình duyệt Web trên máy local (Chrome / Edge localhost) -> Luôn dùng trực tiếp localhost:5000 để tối đa tốc độ và ổn định Socket
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return 'http://localhost:5000/api';
  }

  // 2. Thiết bị di động hoặc môi trường cần tunnel ngrok (EXPO_PUBLIC_API_URL trong .env)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    return `${trimmed}/api`;
  }

  // 3. Fallback cho Web
  if (Platform.OS === 'web') {
    return 'http://localhost:5000/api';
  }

  // 4. Thiết bị thật (Expo Go trên Mobile) -> Tự động phát hiện IP LAN từ Expo Bundler
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
  timeout: 20000,
  headers: {
    'ngrok-skip-browser-warning': '69420',
  },
});

import { storage } from '../utils/storage';

// Request interceptor: tự động gắn JWT token
api.interceptors.request.use(
  async (config) => {
    config.headers['ngrok-skip-browser-warning'] = '69420';
    const token = await storage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Nếu data là FormData, xóa Content-Type để Axios/Browser/React Native tự động sinh header multipart/form-data kèm boundary chuẩn
    const isFormData =
      config.data instanceof FormData ||
      (config.data && typeof (config.data as any).getParts === 'function');

    if (isFormData && config.headers) {
      if (typeof (config.headers as any).delete === 'function') {
        (config.headers as any).delete('Content-Type');
        (config.headers as any).delete('content-type');
      } else {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
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

    // Nhận diện lỗi khi tunnel ngrok offline hoặc server trả về HTML error page thay vì JSON API
    const isHtmlResponse =
      typeof error?.response?.data === 'string' &&
      (error.response.data.includes('<!DOCTYPE') ||
        error.response.data.includes('<html') ||
        error.response.data.includes('ERR_NGROK'));

    if (isHtmlResponse || error.message === 'Network Error' || !error.response) {
      (error as any).isNetworkOrTunnelError = true;
      (error as any).userFriendlyMessage =
        'Không thể kết nối đến máy chủ backend (Ngrok đang ngoại tuyến hoặc đường truyền mạng bị gián đoạn). Vui lòng kiểm tra lại.';
    }

    return Promise.reject(error);
  }
);

export default api;
export { BASE_URL };
