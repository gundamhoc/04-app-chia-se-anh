import { AppState, Platform } from 'react-native';
import { useAppSettings } from '../store/appSettingsStore';
import { initNotificationHandler as initClient, ensureNotificationPermissions as ensurePerms, scheduleLocalNotification as scheduleClient } from '../utils/notificationClient';

const CHANNEL_ID = 'masita';

export interface LocalNotificationInput {
  title: string;
  body?: string;
  url?: string;
}

let permissionsRequested = false;

// Khởi tạo handler cho local notification (foreground)
export const initNotificationHandler = async (): Promise<void> => {
  await initClient();
};

// Đảm bảo quyền thông báo và channel
export const ensureNotificationPermissions = async (): Promise<void> => {
  await ensurePerms();
};

const isAppActive = (): Promise<boolean> => {
  return Promise.resolve(AppState.currentState === 'active');
};

export const showLocalNotification = async (input: LocalNotificationInput): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    if (await isAppActive()) return;
    await scheduleClient(input);
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