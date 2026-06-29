import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="feed" />
        <Stack.Screen name="create" />
        <Stack.Screen name="search" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
      </Stack>
    </SafeAreaProvider>
  );
}
