import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Wrapper an toàn cho expo-notifications
 * - Tránh crash trên Expo Go SDK 53+ (remote notifications bị remove)
 * - Chỉ import khi KHÔNG phải Expo Go (dev build / standalone build)
 * - Trả về null nếu không khả dụng (fallback lên local toast)
 */

// Detect Expo Go: appOwnership === 'expo' nghĩa là chạy trong Expo Go
const IS_EXPO_GO = Constants?.appOwnership === 'expo';
const IS_WEB = Platform.OS === 'web';
const CAN_LOAD_NOTIFICATIONS = !IS_WEB && !IS_EXPO_GO;

// Cache module sau khi load thành công
let _notifications: typeof import('expo-notifications') | null = null;
let _loadPromise: Promise<typeof import('expo-notifications') | null> | null = null;

if (IS_EXPO_GO) {
  console.log('[NotificationClient] Expo Go detected → skipping expo-notifications import');
}

if (IS_WEB) {
  console.log('[NotificationClient] Web platform → skipping expo-notifications import');
}

/**
 * Load expo-notifications động (lazy)
 * - Chỉ import khi KHÔNG phải Expo Go (để tránh crash SDK 53+)
 * - Catch lỗi nếu module không khả dụng
 */
export const loadNotifications = async (): Promise<typeof import('expo-notifications') | null> => {
  if (!CAN_LOAD_NOTIFICATIONS) return null;

  // Tránh load nhiều lần song song
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    if (_notifications) return _notifications;

    try {
      const mod = await import('expo-notifications');
      _notifications = mod;
      return mod;
    } catch (error) {
      console.warn('[NotificationClient] expo-notifications không khả dụng:', error);
      _notifications = null;
      return null;
    }
  })();

  return _loadPromise;
};

/**
 * Lấy instance Notifications đã load (sync)
 * - Trả về null nếu chưa load hoặc không khả dụng
 */
export const getNotifications = (): typeof import('expo-notifications') | null => {
  return _notifications;
};

/**
 * Kiểm tra xem module có sẵn sàng không
 */
export const isNotificationsAvailable = (): boolean => {
  return CAN_LOAD_NOTIFICATIONS && _notifications !== null;
};

/**
 * Helper: init notification handler an toàn
 */
export const initNotificationHandler = async (): Promise<void> => {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
};

/**
 * Helper: đảm bảo permissions & channel
 */
export const ensureNotificationPermissions = async (): Promise<void> => {
  if (!CAN_LOAD_NOTIFICATIONS) return;

  const Notifications = await loadNotifications();
  if (!Notifications) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('masita', {
        name: 'Masita',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6C63FF',
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  } catch (error) {
    console.warn('[NotificationClient] Không thể khởi tạo quyền thông báo:', error);
  }
};

/**
 * Helper: get last notification response (cold start)
 */
export const getLastNotificationResponse = async () => {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;
  return Notifications.getLastNotificationResponse();
};

/**
 * Helper: clear last notification response
 */
export const clearLastNotificationResponse = async () => {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  return Notifications.clearLastNotificationResponseAsync();
};

/**
 * Helper: add notification response listener
 */
export const addNotificationResponseListener = async (
  listener: (response: import('expo-notifications').NotificationResponse) => void
) => {
  const Notifications = await loadNotifications();
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(listener);
};

/**
 * Helper: schedule local notification
 */
export const scheduleLocalNotification = async (input: {
  title: string;
  body?: string;
  url?: string;
}): Promise<string | null> => {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.url ? { url: input.url } : {},
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: 'masita',
      },
    });
  } catch (error) {
    console.warn('[NotificationClient] Lỗi gửi local notification:', error);
    return null;
  }
};