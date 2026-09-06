/**
 * socketHandler.js
 * Xử lý tất cả Socket.io events
 * Giai đoạn 1: Chỉ setup nền tảng, chưa có business logic
 */

// Map lưu userId -> socketId để gửi tin nhắn trực tiếp về sau
const connectedUsers = new Map();

const initSocketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // -------------------------------------------------------
    // Event: user_online
    // Client gửi khi đã đăng nhập thành công
    // payload: { userId }
    // -------------------------------------------------------
    socket.on('user_online', ({ userId }) => {
      if (userId) {
        connectedUsers.set(userId, socket.id);
        socket.userId = userId;
        console.log(`👤 User ${userId} is online (socket: ${socket.id})`);

        // Thông báo cho client biết đã online thành công
        socket.emit('user_online_ack', { status: 'online', userId });
      }
    });

    // -------------------------------------------------------
    // Event: ping (để test kết nối)
    // -------------------------------------------------------
    socket.on('ping_server', (data) => {
      socket.emit('pong_server', { message: 'pong', timestamp: Date.now() });
    });

    // -------------------------------------------------------
    // Event: disconnect
    // -------------------------------------------------------
    socket.on('disconnect', (reason) => {
      if (socket.userId) {
        connectedUsers.delete(socket.userId);
        console.log(`👋 User ${socket.userId} went offline (reason: ${reason})`);
      } else {
        console.log(`🔌 Socket disconnected: ${socket.id} (reason: ${reason})`);
      }
    });
  });

  console.log('✅ Socket.io handler initialized');
};

// Helper: Lấy socketId của user (dùng cho các module khác sau này)
const getSocketId = (userId) => connectedUsers.get(userId);

// Helper: Lấy danh sách userId đang online
const getOnlineUsers = () => Array.from(connectedUsers.keys());

/**
 * Gửi thông báo tới 1 user cụ thể nếu họ đang online
 */
const sendNotificationToUser = (io, targetUserId, eventName, payload) => {
  const targetSocketId = connectedUsers.get(parseInt(targetUserId, 10)) || connectedUsers.get(String(targetUserId));
  if (targetSocketId && io) {
    io.to(targetSocketId).emit(eventName, payload);
    return true;
  }
  return false;
};

/**
 * Gửi thông báo tới nhiều users cùng lúc
 */
const broadcastToUsers = (io, targetUserIds, eventName, payload) => {
  if (!Array.isArray(targetUserIds) || !io) return;
  targetUserIds.forEach((uId) => {
    sendNotificationToUser(io, uId, eventName, payload);
  });
};

module.exports = {
  initSocketHandler,
  getSocketId,
  getOnlineUsers,
  sendNotificationToUser,
  broadcastToUsers,
};

