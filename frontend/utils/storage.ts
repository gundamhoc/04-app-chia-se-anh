import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Storage adapter hỗ trợ cả Mobile (SecureStore) và Web (localStorage).
 * Tránh crash ứng dụng khi chạy trên Web do SecureStore không hỗ trợ web.
 */
export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch (e) {
        console.warn('[Storage] localStorage getItem error:', e);
      }
      return null;
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn('[Storage] SecureStore getItemAsync error:', e);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch (e) {
        console.warn('[Storage] localStorage setItem error:', e);
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn('[Storage] SecureStore setItemAsync error:', e);
    }
  },

  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch (e) {
        console.warn('[Storage] localStorage removeItem error:', e);
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn('[Storage] SecureStore deleteItemAsync error:', e);
    }
  },
};
