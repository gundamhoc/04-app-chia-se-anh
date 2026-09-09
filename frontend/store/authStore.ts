import { create } from 'zustand';
import { storage } from '../utils/storage';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socketService';
import type { User, LoginPayload, RegisterPayload } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  /** isLoading: true khi đang gọi API login/register — dùng cho nút bấm UI */
  isLoading: boolean;
  /**
   * isInitializing: true CHỈ trong lần đầu app khởi động (loadStoredAuth).
   * _layout.tsx dùng cái này để return null / ẩn app.
   * KHÔNG bao giờ set true lại trong login/register → tránh white-screen.
   */
  isInitializing: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitializing: true,   // ← chỉ true khi app mới mở, chưa check storage
  isAuthenticated: false,

  // -------------------------------------------------------
  // Đăng nhập
  // -------------------------------------------------------
  login: async (payload) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/login', payload);
      const { token, user } = res.data.data;

      await storage.setItem('auth_token', token);
      await storage.setItem('auth_user', JSON.stringify(user));

      connectSocket(user.id);

      // isInitializing KHÔNG được set ở đây — chỉ thay đổi isLoading
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      const isNgrokOrTunnelErr =
        error?.isNetworkOrTunnelError ||
        (typeof error?.response?.data === 'string' &&
          (error.response.data.includes('ERR_NGROK') ||
            error.response.data.includes('<!DOCTYPE') ||
            error.response.data.includes('<html'))) ||
        (error?.response?.status === 404 && typeof error?.response?.data !== 'object');
      const isNetworkErr = error?.message === 'Network Error' || !error?.response || isNgrokOrTunnelErr;
      const backendMsg =
        typeof error?.response?.data?.message === 'string'
          ? error.response.data.message
          : error?.userFriendlyMessage;
      const message = isNetworkErr
        ? error?.userFriendlyMessage ||
          'Không thể kết nối đến máy chủ backend (Ngrok đang tắt hoặc kết nối mạng bị gián đoạn).'
        : backendMsg || error?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
      const err = new Error(message);
      (err as any).status = error?.response?.status;
      throw err;
    }
  },

  // -------------------------------------------------------
  // Đăng ký
  // -------------------------------------------------------
  register: async (payload) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/register', payload);
      const { token, user } = res.data.data;

      await storage.setItem('auth_token', token);
      await storage.setItem('auth_user', JSON.stringify(user));

      connectSocket(user.id);

      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      const isNgrokOrTunnelErr =
        error?.isNetworkOrTunnelError ||
        (typeof error?.response?.data === 'string' &&
          (error.response.data.includes('ERR_NGROK') ||
            error.response.data.includes('<!DOCTYPE') ||
            error.response.data.includes('<html'))) ||
        (error?.response?.status === 404 && typeof error?.response?.data !== 'object');
      const isNetworkErr = error?.message === 'Network Error' || !error?.response || isNgrokOrTunnelErr;
      const backendMsg =
        typeof error?.response?.data?.message === 'string'
          ? error.response.data.message
          : error?.userFriendlyMessage;
      const message = isNetworkErr
        ? error?.userFriendlyMessage ||
          'Không thể kết nối đến máy chủ backend (Ngrok đang tắt hoặc kết nối mạng bị gián đoạn).'
        : backendMsg || error?.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      const err = new Error(message);
      (err as any).status = error?.response?.status;
      throw err;
    }
  },

  // -------------------------------------------------------
  // Đăng xuất
  // -------------------------------------------------------
  logout: async () => {
    disconnectSocket();
    await storage.deleteItem('auth_token');
    await storage.deleteItem('auth_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  // -------------------------------------------------------
  // Tải lại auth từ storage khi mở app (CHỈ CHẠY 1 LẦN)
  // -------------------------------------------------------
  loadStoredAuth: async () => {
    try {
      const token = await storage.getItem('auth_token');
      const userStr = await storage.getItem('auth_user');

      if (token && userStr) {
        const user = JSON.parse(userStr) as User;

        // Verify token vẫn còn hiệu lực
        try {
          await api.get('/auth/profile');
          connectSocket(user.id);
          set({ user, token, isAuthenticated: true, isInitializing: false });
        } catch (error: any) {
          const status = error?.response?.status;
          if (status === 401 || status === 403) {
            await storage.deleteItem('auth_token');
            await storage.deleteItem('auth_user');
            set({ user: null, token: null, isAuthenticated: false, isInitializing: false });
          } else {
            // Lỗi mạng / server — giữ nguyên trạng thái auth cũ
            set({ user, token, isAuthenticated: true, isInitializing: false });
          }
        }
      } else {
        set({ isInitializing: false });
      }
    } catch {
      set({ isInitializing: false });
    }
  },

  // -------------------------------------------------------
  // Cập nhật thông tin user local
  // -------------------------------------------------------
  updateUser: (updates) => {
    const current = get().user;
    if (current) {
      const updated = { ...current, ...updates };
      set({ user: updated });
      storage.setItem('auth_user', JSON.stringify(updated));
    }
  },
}));
