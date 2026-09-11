import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { useAppSettings } from '../store/appSettingsStore';

const CHANNEL_ID = 'masita';

export interface LocalNotificationInput {
  title: string;
  body?: string;
  url?: string;
}

let permissionsRequested = false;

export const initNotificationHandler = (): void => {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
};

export const ensureNotificationPermissions = async (): Promise<void> => {
  if (Platform.OS === 'web' || permissionsRequested) return;
  permissionsRequested = true;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
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
  } catch (e) {
    console.warn('[LocalNotification] Khong the khoi tao quyen thong bao:', e);
  }
};

const isAppActive = async (): Promise<boolean> => {
  return AppState.currentState === 'active';
};

export const showLocalNotification = async (input: LocalNotificationInput): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    if (await isAppActive()) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.url ? { url: input.url } : {},
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: CHANNEL_ID,
      },
    });
  } catch (e) {
    console.warn('[LocalNotification] Loi gui thong bao:', e);
  }
};

const t = (vi: string, en: string): string =>
  useAppSettings.getState().language === 'vi' ? vi : en;

export const notificationTitleForType = (type: string): string => {
  switch (type) {
    case 'like_post':
    case 'like_comment':
      return t('❤️ Cảm xúc mới', '❤️ New reaction');
    case 'comment_post':
    case 'reply_comment':
      return t('💬 Bình luận mới', '💬 New comment');
    case 'friend_request':
      return t('👋 Lời mời kết bạn', '👋 Friend request');
    case 'friend_accept':
      return t('🤝 Đã chấp nhận kết bạn', '🤝 Friend request accepted');
    case 'group_invite':
      return t('👨‍👩‍👧 Lời mời vào nhóm', '👨‍👩‍👧 Group invitation');
    case 'new_post':
      return t('📸 Khoảnh khắc mới', '📸 New moment');
    case 'new_direct_message':
    case 'new_group_message':
      return t('💬 Tin nhắn mới', '💬 New message');
    default:
      return 'Masita';
  }
};

export const notificationUrlForType = (
  type: string,
  actorId?: number | null
): string | undefined => {
  if (['friend_request', 'friend_accept', 'like_post', 'like_comment'].includes(type) && actorId) {
    return `/user/${actorId}`;
  }
  return undefined;
};
