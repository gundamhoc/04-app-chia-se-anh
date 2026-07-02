import { Platform } from 'react-native';

// ⚠️ IMPORTANT: Change this to your machine's current WiFi IP before building APK!
// Run `ip a` (Linux/Mac) or `ipconfig` (Windows) to find your LAN IP.
// This changes every time you switch WiFi networks!
const DEV_MACHINE_IP = '192.168.210.224';

export const API_URL = Platform.select({
  ios: `http://${DEV_MACHINE_IP}:3000/api`,     // iOS physical device via LAN
  android: `http://${DEV_MACHINE_IP}:3000/api`, // Android physical device via LAN
  // For Android Emulator only, use: http://10.0.2.2:3000/api
  // For iOS Simulator only, use:    http://localhost:3000/api
  web: 'http://localhost:3000/api',              // Web browser testing
  default: `http://${DEV_MACHINE_IP}:3000/api`,
});
