import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { ToastProvider } from '../context/ToastContext';

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
        </Stack>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
