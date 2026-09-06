// Bảng màu cho Masita
// Chủ đề: Tím gradient (Primary) + Dark mode

const primary = '#6C63FF';       // Tím chính
const primaryDark = '#4F46E5';   // Tím đậm
const primaryLight = '#A78BFA';  // Tím nhạt
const accent = '#FF6584';        // Hồng accent

export const Colors = {
  light: {
    // Primary
    primary,
    primaryDark,
    primaryLight,
    accent,

    // Backgrounds
    background: '#F8F7FF',
    card: '#FFFFFF',
    surface: '#F0EFFF',

    // Text
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',

    // UI
    border: '#E5E7EB',
    separator: '#F3F4F6',
    inputBg: '#F9FAFB',

    // Status
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',

    // Icon tint
    tabIconDefault: '#9CA3AF',
    tabIconSelected: primary,
    icon: '#6B7280',
  },
  dark: {
    // Primary
    primary,
    primaryDark,
    primaryLight,
    accent,

    // Backgrounds
    background: '#0F0E17',
    card: '#1A1A2E',
    surface: '#16213E',

    // Text
    text: '#F8F7FF',
    textSecondary: '#A0AEC0',
    textMuted: '#718096',

    // UI
    border: '#2D2D44',
    separator: '#1E1E30',
    inputBg: '#1A1A2E',

    // Status
    success: '#10B981',
    error: '#F87171',
    warning: '#FBBF24',

    // Icon tint
    tabIconDefault: '#718096',
    tabIconSelected: primaryLight,
    icon: '#A0AEC0',
  },
};

export type ColorScheme = typeof Colors.light;
