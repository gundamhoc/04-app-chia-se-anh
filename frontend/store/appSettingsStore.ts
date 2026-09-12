import { create } from 'zustand';
import { storage } from '../utils/storage';
import { useColorScheme } from 'react-native';

// ============================================================
// App Settings Store — Lưu trữ cài đặt hiển thị của ứng dụng
// Tất cả thay đổi được persist vào SecureStore
// ============================================================

export type AppLanguage = 'vi' | 'en';
export type ThemeMode = 'dark' | 'light';

export interface AppSettings {
  // Chế độ giao diện
  themeMode: ThemeMode;

  // Thông báo
  notifyMessages: boolean;    // Tin nhắn mới
  notifyPosts: boolean;       // Bài viết mới
  notifyInteractions: boolean; // Tương tác (like, comment)

  // Ngôn ngữ
  language: AppLanguage;

  // Trợ năng
  highContrast: boolean;      // Độ tương phản cao
  reduceMotion: boolean;      // Giảm hiệu ứng chuyển động
  largeText: boolean;         // Chữ lớn

  // Cập nhật OTA
  appVersion: string;
  otaChannel: 'production' | 'beta';
  autoCheckOta: boolean;
  lastOtaCheckTime: string | null;
}

interface AppSettingsState extends AppSettings {
  isLoaded: boolean;

  // Actions
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setNotifyMessages: (val: boolean) => Promise<void>;
  setNotifyPosts: (val: boolean) => Promise<void>;
  setNotifyInteractions: (val: boolean) => Promise<void>;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  setHighContrast: (val: boolean) => Promise<void>;
  setReduceMotion: (val: boolean) => Promise<void>;
  setLargeText: (val: boolean) => Promise<void>;

  // OTA Actions
  setAppVersion: (v: string) => Promise<void>;
  setOtaChannel: (c: 'production' | 'beta') => Promise<void>;
  setAutoCheckOta: (val: boolean) => Promise<void>;
  setLastOtaCheckTime: (time: string | null) => Promise<void>;
  loadSettings: () => Promise<void>;
}

const STORAGE_KEY = 'app_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'light',
  notifyMessages: true,
  notifyPosts: true,
  notifyInteractions: true,
  language: 'vi',
  highContrast: false,
  reduceMotion: false,
  largeText: false,
  appVersion: '1.0.7',
  otaChannel: 'production',
  autoCheckOta: true,
  lastOtaCheckTime: null,
};

const persistSettings = async (settings: AppSettings) => {
  try {
    await storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[AppSettingsStore] Failed to persist settings:', e);
  }
};

export const useAppSettings = create<AppSettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  isLoaded: false,

  // -------------------------------------------------------
  // Load settings từ storage khi app khởi động
  // -------------------------------------------------------
  loadSettings: async () => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: Partial<AppSettings> = JSON.parse(raw);
        set({ ...DEFAULT_SETTINGS, ...saved, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  // -------------------------------------------------------
  // Theme Mode
  // -------------------------------------------------------
  setThemeMode: async (themeMode) => {
    set({ themeMode });
    const current = get();
    await persistSettings({ ...current, themeMode });
  },

  // -------------------------------------------------------
  // Thông báo
  // -------------------------------------------------------
  setNotifyMessages: async (notifyMessages) => {
    set({ notifyMessages });
    const current = get();
    await persistSettings({ ...current, notifyMessages });
  },

  setNotifyPosts: async (notifyPosts) => {
    set({ notifyPosts });
    const current = get();
    await persistSettings({ ...current, notifyPosts });
  },

  setNotifyInteractions: async (notifyInteractions) => {
    set({ notifyInteractions });
    const current = get();
    await persistSettings({ ...current, notifyInteractions });
  },

  // -------------------------------------------------------
  // Ngôn ngữ
  // -------------------------------------------------------
  setLanguage: async (language) => {
    set({ language });
    const current = get();
    await persistSettings({ ...current, language });
  },

  // -------------------------------------------------------
  // Trợ năng
  // -------------------------------------------------------
  setHighContrast: async (highContrast) => {
    set({ highContrast });
    const current = get();
    await persistSettings({ ...current, highContrast });
  },

  setReduceMotion: async (reduceMotion) => {
    set({ reduceMotion });
    const current = get();
    await persistSettings({ ...current, reduceMotion });
  },

  setLargeText: async (largeText) => {
    set({ largeText });
    const current = get();
    await persistSettings({ ...current, largeText });
  },

  // -------------------------------------------------------
  // Cập nhật OTA
  // -------------------------------------------------------
  setAppVersion: async (appVersion) => {
    set({ appVersion });
    const current = get();
    await persistSettings({ ...current, appVersion });
  },

  setOtaChannel: async (otaChannel) => {
    set({ otaChannel });
    const current = get();
    await persistSettings({ ...current, otaChannel });
  },

  setAutoCheckOta: async (autoCheckOta) => {
    set({ autoCheckOta });
    const current = get();
    await persistSettings({ ...current, autoCheckOta });
  },

  setLastOtaCheckTime: async (lastOtaCheckTime) => {
    set({ lastOtaCheckTime });
    const current = get();
    await persistSettings({ ...current, lastOtaCheckTime });
  },
}));
