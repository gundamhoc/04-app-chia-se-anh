import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/config';

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (loginKey: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (username: string, email: string, password: string, fullName: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';

// Safe secure storage helpers supporting Web environment fallback
const saveToken = async (token: string) => {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (e) {
    console.error('Error saving auth token:', e);
  }
};

const getToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    }
  } catch (e) {
    console.error('Error getting auth token:', e);
    return null;
  }
};

const removeToken = async () => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (e) {
    console.error('Error removing auth token:', e);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and load token on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = await getToken();
        if (storedToken) {
          // Verify token and fetch profile
          const response = await fetch(`${API_URL}/auth/me`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${storedToken}`,
              'Content-Type': 'application/json',
            },
          });

          const json = await response.json();
          if (json.success && json.data) {
            setToken(storedToken);
            setUser(json.data);
          } else {
            // Token is invalid/expired
            await removeToken();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (loginKey: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginKey, password }),
      });

      const json = await response.json();

      if (json.success && json.data) {
        const { token: userToken, user: userData } = json.data;
        await saveToken(userToken);
        setToken(userToken);
        setUser(userData);
        return { success: true, message: json.message || 'Login successful' };
      } else {
        return { success: false, message: json.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login request error:', error);
      return { success: false, message: 'Could not connect to the server. Please check your connection.' };
    }
  };

  const register = async (username: string, email: string, password: string, fullName: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, fullName }),
      });

      const json = await response.json();

      if (json.success && json.data) {
        const { token: userToken, user: userData } = json.data;
        await saveToken(userToken);
        setToken(userToken);
        setUser(userData);
        return { success: true, message: json.message || 'Registration successful' };
      } else {
        return { success: false, message: json.message || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration request error:', error);
      return { success: false, message: 'Could not connect to the server. Please check your connection.' };
    }
  };

  const logout = async () => {
    await removeToken();
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
