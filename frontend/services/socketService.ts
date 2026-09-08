import { io, Socket } from 'socket.io-client';
import { BASE_URL } from './api';
import { usePresenceStore } from '../store/presenceStore';

// Socket server URL (không có /api prefix)
const SOCKET_URL = BASE_URL.replace('/api', '');

let socket: Socket | null = null;
let currentConnectedUserId: number | null = null;

/**
 * Khởi tạo và kết nối Socket.io
 * @param userId - ID của user đang đăng nhập (để emit user_online)
 */
export const connectSocket = (userId: number): Socket => {
  currentConnectedUserId = userId;

  if (socket?.connected) {
    socket.emit('user_online', { userId });
    socket.emit('get_online_users');
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
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
    socket?.emit('user_online', { userId });
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
