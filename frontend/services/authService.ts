import { Platform } from 'react-native';
import api from './api';
import { UserPrivacySettings, SecurityStatus, LoginSession, User, ApiResponse } from '../types';
import { compressImage } from '../utils/imageCompressor';

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    full_name?: string;
  };
}

export interface UpdateUsernameResponse {
  success: boolean;
  message: string;
  data?: {
    username: string;
  };
}

export interface UpdateEmailResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
  };
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

export interface PrivacySettingsResponse {
  success: boolean;
  message?: string;
  data: UserPrivacySettings;
}

export interface SecurityStatusResponse {
  success: boolean;
  message?: string;
  data: SecurityStatus;
}

export interface SessionsResponse {
  success: boolean;
  message?: string;
  data: LoginSession[];
}

export interface OtpResponse {
  success: boolean;
  message: string;
  data: {
    otp: string;
    expires_at: string;
    email: string;
  };
}

export const authService = {
  /**
   * Gửi yêu cầu quên mật khẩu
   * POST /api/auth/forgot-password
   */
  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    const res = await api.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
    return res.data;
  },

  /**
   * Cập nhật Username
   * PUT /api/auth/username
   */
  updateUsername: async (username: string): Promise<UpdateUsernameResponse> => {
    const res = await api.put<UpdateUsernameResponse>('/auth/username', { username });
    return res.data;
  },

  /**
   * Cập nhật Email đăng ký (cần nhập mật khẩu hiện tại)
   * PUT /api/auth/email
   */
  updateEmail: async (email: string, password: string): Promise<UpdateEmailResponse> => {
    const res = await api.put<UpdateEmailResponse>('/auth/email', { email, password });
    return res.data;
  },

  /**
   * Đổi Mật Khẩu (cần nhập email đăng ký)
   * PUT /api/auth/change-password
   */
  changePassword: async (email: string, new_password: string): Promise<ChangePasswordResponse> => {
    const res = await api.put<ChangePasswordResponse>('/auth/change-password', {
      email,
      new_password,
    });
    return res.data;
  },

  /**
   * Lấy cài đặt quyền riêng tư
   * GET /api/auth/privacy-settings
   */
  getPrivacySettings: async (): Promise<PrivacySettingsResponse> => {
    const res = await api.get<PrivacySettingsResponse>('/auth/privacy-settings');
    return res.data;
  },

  /**
   * Cập nhật cài đặt quyền riêng tư
   * PUT /api/auth/privacy-settings
   */
  updatePrivacySettings: async (
    payload: Partial<UserPrivacySettings>
  ): Promise<PrivacySettingsResponse> => {
    const res = await api.put<PrivacySettingsResponse>('/auth/privacy-settings', payload);
    return res.data;
  },

  /**
   * Lấy trạng thái bảo mật tài khoản
   * GET /api/auth/security-status
   */
  getSecurityStatus: async (): Promise<SecurityStatusResponse> => {
    const res = await api.get<SecurityStatusResponse>('/auth/security-status');
    return res.data;
  },

  /**
   * Bật/tắt xác minh 2 bước (2FA)
   * PUT /api/auth/two-factor
   */
  toggleTwoFactor: async (enabled: boolean): Promise<{ success: boolean; message: string; data: { two_factor_enabled: boolean } }> => {
    const res = await api.put('/auth/two-factor', { enabled });
    return res.data;
  },

  /**
   * Bật/tắt lưu thông tin đăng nhập
   * PUT /api/auth/remember-login
   */
  toggleRememberLogin: async (enabled: boolean): Promise<{ success: boolean; message: string; data: { remember_login: boolean } }> => {
    const res = await api.put('/auth/remember-login', { enabled });
    return res.data;
  },

  /**
   * Lấy danh sách phiên đăng nhập đang hoạt động
   * GET /api/auth/sessions
   */
  getLoginSessions: async (): Promise<SessionsResponse> => {
    const res = await api.get<SessionsResponse>('/auth/sessions');
    return res.data;
  },

  /**
   * Thu hồi (đăng xuất) một phiên cụ thể
   * DELETE /api/auth/sessions/:id
   */
  revokeSession: async (sessionId: number): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/auth/sessions/${sessionId}`);
    return res.data;
  },

  /**
   * Xóa tài khoản (soft delete) — yêu cầu xác nhận email + mật khẩu
   * DELETE /api/auth/account
   */
  deleteAccount: async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete('/auth/account', { data: { email, password } });
    return res.data;
  },

  /**
   * Tạo OTP giả lập cho xác minh 2 bước
   * POST /api/auth/generate-otp
   */
  generateOtp: async (): Promise<OtpResponse> => {
    const res = await api.post<OtpResponse>('/auth/generate-otp');
    return res.data;
  },

  /**
   * Lấy thông tin cá nhân kèm thống kê chỉ số
   * GET /api/auth/profile
   */
  getProfile: async (): Promise<{ user: User }> => {
    const res = await api.get<ApiResponse<{ user: User }>>('/auth/profile');
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể lấy thông tin hồ sơ.');
    }
    return res.data.data;
  },

  /**
   * Cập nhật thông tin hồ sơ (Họ tên & Bio)
   * PUT /api/auth/profile
   */
  updateProfile: async (full_name: string, bio: string): Promise<{ user: User }> => {
    const res = await api.put<ApiResponse<{ user: User }>>('/auth/profile', {
      full_name,
      bio,
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể cập nhật thông tin hồ sơ.');
    }
    return res.data.data;
  },

  /**
   * Cập nhật ảnh đại diện (Avatar)
   * PUT /api/auth/avatar
   */
  updateAvatar: async (imageUri: string): Promise<{ avatar_url: string }> => {
    let processedUri = imageUri;
    try {
      processedUri = await compressImage(imageUri, { maxWidth: 800, quality: 0.85 });
    } catch (compressErr) {
      console.warn('Lỗi nén ảnh avatar, dùng ảnh gốc:', compressErr);
    }

    const formData = new FormData();
    let filename = `avatar_${Date.now()}.jpg`;
    let mimeType = 'image/jpeg';

    if (processedUri.startsWith('data:')) {
      const mimeMatch = processedUri.match(/^data:([^;]+);/);
      if (mimeMatch && mimeMatch[1]) {
        mimeType = mimeMatch[1];
        const sub = mimeType.split('/')[1] || 'jpeg';
        const safeExt = sub === 'jpeg' ? 'jpg' : sub;
        filename = `avatar_${Date.now()}.${safeExt}`;
      }
    } else {
      const cleanUri = processedUri.split('?')[0];
      const rawName = cleanUri.split('/').pop() || `avatar_${Date.now()}`;
      const safeBase = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const extMatch = safeBase.match(/\.([a-zA-Z0-9]+)$/);
      if (extMatch && extMatch[1]) {
        const ext = extMatch[1].toLowerCase();
        filename = safeBase;
        mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      } else {
        filename = `${safeBase}.jpg`;
        mimeType = 'image/jpeg';
      }
    }

    if (Platform.OS === 'web') {
      try {
        const response = await fetch(processedUri);
        const blob = await response.blob();
        formData.append('image', blob, filename);
      } catch (e) {
        formData.append('image', {
          uri: processedUri,
          name: filename,
          type: mimeType,
        } as unknown as Blob);
      }
    } else {
      formData.append('image', {
        uri: processedUri,
        name: filename,
        type: mimeType,
      } as unknown as Blob);
    }

    const res = await api.put<ApiResponse<{ avatar_url: string }>>('/auth/avatar', formData, {
      timeout: 60000,
    });

    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể cập nhật ảnh đại diện.');
    }

    return res.data.data;
  },
};

export default authService;
