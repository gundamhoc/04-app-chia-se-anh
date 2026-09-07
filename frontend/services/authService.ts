import api from './api';
import { UserPrivacySettings, SecurityStatus, LoginSession } from '../types';

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
};

export default authService;
