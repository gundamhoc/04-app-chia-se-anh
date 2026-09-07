import { io, Socket } from 'socket.io-client';
import { BASE_URL } from './api';

// Socket server URL (không có /api prefix)
const SOCKET_URL = BASE_URL.replace('/api', '');

let socket: Socket | null = null;

/**
 * Khởi tạo và kết nối Socket.io
 * @param userId - ID của user đang đăng nhập (để emit user_online)
 */
export const connectSocket = (userId: number): Socket => {
  if (socket?.connected) {
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
    // Thông báo server biết user này online
    socket?.emit('user_online', { userId });
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
    socket.disconnect();
    socket = null;
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
