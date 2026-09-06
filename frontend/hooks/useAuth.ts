import { useAuthStore } from '../store/authStore';

/**
 * Hook tiện lợi để truy cập auth state
 */
export const useAuth = () => {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);
  const updateUser = useAuthStore((s) => s.updateUser);

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    loadStoredAuth,
    updateUser,
  };
};
