import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { ToastProvider } from '../context/ToastContext';

import { Platform } from 'react-native';

// Giữ splash screen cho đến khi sẵn sàng
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);
  // isInitializing = true CHỈ khi app mới mở, đang check storage lần đầu
  // KHÔNG bị ảnh hưởng bởi login/register (tránh white-screen)
  const isInitializing = useAuthStore((s) => s.isInitializing);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    // Đảm bảo trên Web browser, thêm meta referrer no-referrer để load ảnh ngoại bộ an toàn
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
    loadStoredAuth();
  }, []);

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
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#0F0F1A' }}>
      <ToastProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F0F1A' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-photo" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="search" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
