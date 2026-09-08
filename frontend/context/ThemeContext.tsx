import React, { createContext, useContext, useEffect } from 'react';
import { Colors, ColorScheme } from '../constants/Colors';
import { useAppSettings, ThemeMode } from '../store/appSettingsStore';

// ============================================================
// ThemeContext — Cung cấp màu sắc cho toàn bộ app
// Tự động cập nhật khi user bật/tắt Dark Mode trong Settings
// ============================================================

interface ThemeContextType {
  colors: ColorScheme;
  isDark: boolean;
  themeMode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: Colors.light,
  isDark: false,
  themeMode: 'light',
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { themeMode, loadSettings, isLoaded } = useAppSettings();

  // Load settings lần đầu khi Provider mount
  useEffect(() => {
    if (!isLoaded) {
      loadSettings();
    }
  }, []);

  const isDark = themeMode === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ colors, isDark, themeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => useContext(ThemeContext);
