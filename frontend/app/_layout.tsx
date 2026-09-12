import { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { ToastProvider } from '../context/ToastContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { useAppSettings } from '../store/appSettingsStore';
import { initNotificationHandler, getLastNotificationResponse, clearLastNotificationResponse, addNotificationResponseListener } from '../utils/notificationClient';
import { Platform } from 'react-native';

import { BannedAccountModal } from '../components/BannedAccountModal';

// Giữ splash screen cho đến khi sẵn sàng
SplashScreen.preventAutoHideAsync();

// Handler notification: phải đăng ký sớm nhất (module-level), trước khi có notification nào bay về
initNotificationHandler();

// Inner layout component — dùng theme context để set statusbar
function InnerLayout() {
  const { isDark, colors } = useTheme();

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ flex: 1, backgroundColor: colors.background }}>
      <ToastProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-photo" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="search" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="user/[id]" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <BannedAccountModal />
      </ToastProvider>
    </SafeAreaProvider>
  );
}


export default function RootLayout() {
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);
  const loadSettings = useAppSettings((s) => s.loadSettings);
  // isInitializing = true CHỈ khi app mới mở, đang check storage lần đầu
  // KHÔNG bị ảnh hưởng bởi login/register (tránh white-screen)
  const isInitializing = useAuthStore((s) => s.isInitializing);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // URL khi app mo tu notification nen (cold start)
  const pendingNotificationUrl = useRef<string | null>(null);

  useEffect(() => {
    // Dam bao tren Web browser, thêm meta referrer no-referrer để load ảnh ngoại bộ an toàn
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      let meta = document.querySelector('meta[name="referrer"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'referrer');
        meta.setAttribute('content', 'no-referrer');
        document.head.appendChild(meta);
      } else {
        meta.setAttribute('content', 'no-referrer');
      }
    }

    // Bam notification nen -> dieu huong dung phong chat / trang ca nhan (push, khong replace)
    let notificationSubscription: { remove: () => void } | null = null;
    if (Platform.OS !== 'web') {
      const navigateFromNotification = (url: unknown) => {
        if (typeof url === 'string' && url.startsWith('/')) {
          router.push(url as never);
        }
      };

      // Cold start từ notification
      getLastNotificationResponse().then((initialResponse) => {
        const initialUrl = initialResponse?.notification.request.content.data?.url;
        if (typeof initialUrl === 'string' && initialUrl.startsWith('/')) {
          pendingNotificationUrl.current = initialUrl;
          clearLastNotificationResponse().catch(() => {});
        }
      });

      // Listener khi app đang chạy
      addNotificationResponseListener((response) => {
        navigateFromNotification(response.notification.request.content.data?.url);
      }).then((sub) => {
        notificationSubscription = sub;
      });
    }

    loadStoredAuth();
    loadSettings(); // Load app display settings (theme, language, etc.)

    return () => {
      notificationSubscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (!isInitializing && fontsLoaded && pendingNotificationUrl.current) {
      const url = pendingNotificationUrl.current;
      pendingNotificationUrl.current = null;
      router.push(url as never);
    }
  }, [isInitializing, fontsLoaded]);

  useEffect(() => {
    if (!isInitializing && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isInitializing, fontsLoaded]);

  // Chỉ ẩn app khi chưa load xong storage lần đầu HOẶC chưa load fonts
  // KHÔNG ẩn khi isLoading (login/register) — đó là bug cũ
  if (isInitializing || !fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}