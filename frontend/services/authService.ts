import api from './api';

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    full_name?: string;
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
};

export default authService;
