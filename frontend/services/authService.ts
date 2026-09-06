import api from './api';
import { UserPrivacySettings } from '../types';

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
};

export default authService;
