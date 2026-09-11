import { io, Socket } from 'socket.io-client';
import { getApiOrigin } from './api';
import { usePresenceStore } from '../store/presenceStore';
import { useAppSettings } from '../store/appSettingsStore';
import { useMuteStore } from '../store/muteStore';
import { messageService } from './messageService';
import { groupService } from './groupService';
import {
  showLocalNotification,
  notificationTitleForType,
  notificationUrlForType,
} from './localNotificationService';

// Cau noi authStore -> socketService (dependency injection cat Require cycle
// authStore -> socketService -> authStore). authStore dang ky chinh no khi tai module.
export interface SocketAuthBridge {
  getToken: () => string | null;
  getUserId: () => number | null;
  handleBanned: (data: {
    reason?: string;
    banned_until?: string;
    message?: string;
    type?: string;
  }) => void;
}

let authBridge: SocketAuthBridge | null = null;
export const setSocketAuthBridge = (bridge: SocketAuthBridge): void => {
  authBridge = bridge;
};

// Socket URL duoc TINH LUC KET NOI tu getApiOrigin() -> theo dung cau dao server hien tai

let socket: Socket | null = null;
let currentConnectedUserId: number | null = null;

// Seed danh sach hoi thoai/nhom DA TAT TIENG + vao phong realtime cua MOI NHOM
// ngay khi socket ket noi: notification nen group/message dung luc AND screen khong mo phong chat.
const seedMuteStoreFromApi = async (): Promise<void> => {
  try {
    const [convs, groups] = await Promise.all([
      messageService.getConversations(),
      groupService.getMyGroups(),
    ]);
    useMuteStore.getState().setMutedDirect(convs.filter((c) => c.is_muted).map((c) => Number(c.friend_id)));
    useMuteStore.getState().setMutedGroups(groups.filter((g) => g.is_muted).map((g) => Number(g.id)));
    // BE gui new_group_message toi room group_${id} -> phai join moi nhan duoc khi o man hinh khac
    groups.forEach((g) => socket?.emit('join_group', { groupId: Number(g.id) }));
  } catch (e) {
    console.warn('[Socket] Khong the dong bo danh sach tat thong bao:', e);
  }
};

/**
 * Khởi tạo và kết nối Socket.io
 * @param userId - ID của user đang đăng nhập (để emit user_online)
 * @param tokenArg - JWT token (truyền tường minh để không phụ thuộc thứ tự set store)
 */
export const connectSocket = (userId: number, tokenArg?: string | null): Socket => {
  currentConnectedUserId = userId;
  const token = tokenArg ?? authBridge?.getToken() ?? null;

  if (socket?.connected) {
    socket.emit('user_online');
    socket.emit('get_online_users');
    return socket;
  }

  // Socket cu ton tai nhung dang reconnect (co the tro server cu) -> huy hoan toan truoc khi tao moi
  if (socket) {
    try {
      socket.removeAllListeners();
      socket.close();
    } catch (e) {}
    socket = null;
  }

  socket = io(getApiOrigin(), {
    transports: ['websocket', 'polling'],
    auth: {
      token: token || '',
    },
    extraHeaders: {
      'ngrok-skip-browser-warning': '69420',
    },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket?.id);
    // Thông báo server biết user này online và yêu cầu danh sách user online
    socket?.emit('user_online');
    socket?.emit('get_online_users');
    void seedMuteStoreFromApi();
  });

  // Nhận danh sách user đang online từ server
  socket.on('online_users_list', (data: { onlineUserIds?: number[] }) => {
    if (data?.onlineUserIds && Array.isArray(data.onlineUserIds)) {
      usePresenceStore.getState().setOnlineUsers(data.onlineUserIds);
    }
  });

  // Nhận sự kiện thay đổi trạng thái user realtime (online / offline)
  socket.on('user_status_changed', (data: { userId: number; status: 'online' | 'offline' }) => {
    if (data?.userId) {
      if (data.status === 'online') {
        usePresenceStore.getState().setUserOnline(data.userId);
      } else if (data.status === 'offline') {
        usePresenceStore.getState().setUserOffline(data.userId);
      }
    }
  });

  // Nhận sự kiện cưỡng chế đăng xuất (bị Khóa / Ban tài khoản từ Quản trị viên)
  socket.on('force_logout', (data: { reason?: string; banned_until?: string; message?: string; type?: string }) => {
    console.warn('⛔ [Socket] Nhận tín hiệu cưỡng chế đăng xuất (Ban):', data);
    authBridge?.handleBanned({
      reason: data?.reason,
      banned_until: data?.banned_until,
      message: data?.message,
      type: data?.type,
    });
  });

  // -------------------------------------------------------
  // Local Notification nen ( khoa man hinh / app chay nen)
  // MOT listener duy nhat tai day — KHONG gan trong useSocket vi
  // useSocket duoc mount o nhieu man hinh (trung lap notification).
  // -------------------------------------------------------
  const previewText = (raw?: string | null): string => {
    if (!raw) return '';
    const clean = raw.replace(/\s+/g, ' ').trim();
    return clean.length > 60 ? `${clean.slice(0, 60)}...` : clean;
  };

  socket.on('new_direct_message', (data: {
    sender_id?: number;
    sender_name?: string;
    message_text?: string;
    image_url?: string | null;
    is_mine?: boolean;
  }) => {
    const settings = useAppSettings.getState();
    if (!settings.notifyMessages || data?.is_mine || !data?.sender_id) return;
    if (Number(data.sender_id) === Number(authBridge?.getUserId())) return;
    if (useMuteStore.getState().mutedDirectIds.includes(Number(data.sender_id))) return;
    const isImage = Boolean(data.image_url) && !data.message_text;
    void showLocalNotification({
      title: `💬 ${data.sender_name || notificationTitleForType('new_direct_message')}`,
      body: isImage
        ? (settings.language === 'vi' ? 'Đã gửi một hình ảnh' : 'Sent a photo')
        : previewText(data.message_text),
      url: `/chat/${data.sender_id}`,
    });
  });

  socket.on('new_group_message', (data: {
    group_id?: number;
    sender_id?: number;
    sender_name?: string;
    message_text?: string;
    image_url?: string | null;
    is_mine?: boolean;
  }) => {
    const settings = useAppSettings.getState();
    if (!settings.notifyMessages || data?.is_mine || !data?.group_id) return;
    if (Number(data.sender_id) === Number(authBridge?.getUserId())) return;
    if (useMuteStore.getState().mutedGroupIds.includes(Number(data.group_id))) return;
    const isImage = Boolean(data.image_url) && !data.message_text;
    const body = isImage
      ? `${data.sender_name || ''} ${settings.language === 'vi' ? 'đã gửi một hình ảnh' : 'sent a photo'}`
      : `${data.sender_name || ''}: ${previewText(data.message_text)}`;
    void showLocalNotification({
      title: notificationTitleForType('new_group_message'),
      body: body.trim(),
      url: `/group-chat/${data.group_id}`,
    });
  });

  socket.on('new_notification', (data: {
    notification?: { type?: string; content?: string; actor_id?: number | null };
  }) => {
    const notif = data?.notification;
    if (!notif?.type) return;
    const settings = useAppSettings.getState();
    const interactiveTypes = ['like_post', 'like_comment', 'comment_post', 'reply_comment', 'friend_request', 'friend_accept', 'group_invite'];
    if (interactiveTypes.includes(notif.type) && !settings.notifyInteractions) return;
    if (notif.type === 'new_post' && !settings.notifyPosts) return;
    void showLocalNotification({
      title: notificationTitleForType(notif.type),
      body: previewText(notif.content),
      url: notificationUrlForType(notif.type, notif.actor_id),
    });
  });

  socket.on('new_photo_posted', (data: { author_name?: string; author_id?: number; photo?: { user_id?: number } }) => {
    const settings = useAppSettings.getState();
    if (!settings.notifyPosts) return;
    const authorId = data?.author_id ?? data?.photo?.user_id;
    void showLocalNotification({
      title: notificationTitleForType('new_post'),
      body: data?.author_name
        ? (settings.language === 'vi' ? `${data.author_name} vừa chia sẻ ảnh mới! 📸` : `${data.author_name} shared a new moment 📸`)
        : undefined,
      url: authorId ? `/user/${authorId}` : undefined,
    });
  });

  socket.on('invited_to_group', (data: { id?: number; name?: string }) => {
    const settings = useAppSettings.getState();
    if (!settings.notifyInteractions) return;
    void showLocalNotification({
      title: notificationTitleForType('group_invite'),
      body: data?.name
        ? (settings.language === 'vi' ? `Bạn được mời vào nhóm ${data.name}` : `You were invited to group "${data.name}"`)
        : undefined,
      url: data?.id ? `/group-chat/${data.id}` : undefined,
    });
  });

  socket.on('connect_error', (err) => {
    console.warn('❌ Socket connect error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('👋 Socket disconnected:', reason);
  });

  return socket;
};

/**
 * Ngắt kết nối Socket.io
 */
export const disconnectSocket = (): void => {
  if (socket) {
    if (currentConnectedUserId) {
      socket.emit('user_offline', { userId: currentConnectedUserId });
    }
    socket.disconnect();
    socket = null;
    currentConnectedUserId = null;
    usePresenceStore.getState().setOnlineUsers([]);
    console.log('🔌 Socket manually disconnected');
  }
};

/**
 * Lấy instance socket hiện tại
 */
export const getSocket = (): Socket | null => socket;

/**
 * Test ping đến server
 */
export const pingServer = (callback: (data: { message: string; timestamp: number }) => void): void => {
  if (!socket) return;
  socket.emit('ping_server', {});
  socket.once('pong_server', callback);
};
