import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { storage } from '../utils/storage';

// ====================================================
// Cach ket noi backend (uu tien tu cao xuong thap):
// 0. OVERRIDE cau dao Developer trong app (luu tai may, doi duoc khong can rebuild)
// 1. EXPO_PUBLIC_API_URL (ngrok / production server trong .env)
// 2. Trinh duyet web localhost -> localhost:5000
// 3. Tu dong lay IP may tinh (LAN IP) qua Expo Metro hostUri
// 4. Fallback: Android emulator (10.0.2.2) hoac iOS/Web (localhost)
// ====================================================

const API_OVERRIDE_KEY = '***';

const normalizeRoot = (url: string): string => url.trim().replace(/\/+$/, '').replace(/\/api$/, '');

const toApiBase = (rootUrl: string): string => `${normalizeRoot(rootUrl)}/api`;

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

const getDefaultBaseUrl = (): string => {
  // 1. Trinh duyet Web tren may local (Chrome / Edge localhost) -> dung truc tiep localhost:5000
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return 'http://localhost:5000/api';
  }

  // 2. Thiet bi di dong hoac moi truong can tunnel (EXPO_PUBLIC_API_URL trong .env)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return toApiBase(envUrl);
  }

  // 3. Fallback cho Web
  if (Platform.OS === 'web') {
    return 'http://localhost:5000/api';
  }

  // 4. Thiet bi that (Expo Go tren Mobile) -> Tu dong phat hien IP LAN tu Expo Bundler
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

const DEFAULT_BASE_URL = getDefaultBaseUrl();

// Base URL dang hoat dong (co the bi cau dao Developer ghi de)
let currentBaseUrl: string = DEFAULT_BASE_URL;

export const getApiBaseUrl = (): string => currentBaseUrl;
export const getDefaultApiBaseUrl = (): string => DEFAULT_BASE_URL;
export const getApiOrigin = (): string => normalizeRoot(currentBaseUrl);
export const getApiOverride = (): string | null =>
  currentBaseUrl === DEFAULT_BASE_URL ? null : normalizeRoot(currentBaseUrl);

const applyBaseUrl = (url: string): void => {
  currentBaseUrl = url;
  api.defaults.baseURL = url;
  if (__DEV__) {
    console.log('[API] Base URL switched to:', url);
  }
};

/**
 *Doc override da luu tu truoc (goi som nhat co the khi app khoi dong).
 * Tra ve true neu co override dang duoc ap dung.
 */
export const loadApiOverride = async (): Promise<boolean> => {
  try {
    const saved = await storage.getItem(API_OVERRIDE_KEY);
    if (saved && saved.trim().length > 0) {
      applyBaseUrl(toApiBase(saved));
      return true;
    }
  } catch (e) {
    console.warn('[API] Load server override failed:', e);
  }
  return false;
};

/**
 * Cau dao Developer: chuyen server ngay lap tuc, khong can rebuild.
 * @param rootUrl URL goc (vd https://xxx.onrender.com) hoac null = ve mac dinh (.env/LAN)
 */
export const applyApiBaseUrlOverride = async (rootUrl: string | null): Promise<string> => {
  if (rootUrl && rootUrl.trim().length > 0) {
    const next = toApiBase(rootUrl);
    await storage.setItem(API_OVERRIDE_KEY, normalizeRoot(rootUrl));
    applyBaseUrl(next);
    return next;
  }
  await storage.deleteItem(API_OVERRIDE_KEY);
  applyBaseUrl(DEFAULT_BASE_URL);
  return DEFAULT_BASE_URL;
};

const api = axios.create({
  baseURL: currentBaseUrl,
  timeout: 20000,
  headers: {
    'ngrok-skip-browser-warning': '69420',
  },
});

if (__DEV__) {
  console.log('🌐 [API] Base URL configured:', currentBaseUrl);
}

// Request interceptor: tu dong gan JWT token
api.interceptors.request.use(
  async (config) => {
    config.headers['ngrok-skip-browser-warning'] = '69420';
    const token = await storage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Neu data la FormData, xoa Content-Type de Axios/Browser/React Native tu sinh boundary chuan
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

// Callback xu ly khi bi ban tai khoan (tranh circular dependency voi authStore)
type BannedCallback = (info: { reason?: string; banned_until?: string | null; message?: string }) => void;
let onBannedHandler: BannedCallback | null = null;
export const setOnBannedCallback = (cb: BannedCallback) => {
  onBannedHandler = cb;
};

// Response interceptor: xu ly loi global
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 1. Neu token het han hoac khong hop le -> xoa token
    if (error.response?.status === 401) {
      await storage.deleteItem('auth_token');
      await storage.deleteItem('auth_user');
    }

    // 2. Neu tai khoan bi Quan tri vien Khoa / Ban (HTTP 403)
    if (error.response?.status === 403 && error.response?.data?.banned) {
      await storage.deleteItem('auth_token');
      await storage.deleteItem('auth_user');
      if (onBannedHandler) {
        onBannedHandler({
          reason: error.response.data.reason,
          banned_until: error.response.data.banned_until,
          message: error.response.data.message,
        });
      }
    }

    // Nhan dien loi khi tunnel ngrok offline hoac server tra HTML error page thay vi JSON
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
export { api };
