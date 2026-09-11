import { io, Socket } from 'socket.io-client';
import { getApiOrigin } from './api';
import { usePresenceStore } from '../store/presenceStore';

// Cau noi authStore -> socketService (dependency injection cat Require cycle
// authStore -> socketService -> authStore). authStore dang ky chinh no khi tai module.
export interface SocketAuthBridge {
  getToken: () => string | null;
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
