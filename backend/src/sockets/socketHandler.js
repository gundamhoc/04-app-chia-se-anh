/**
 * socketHandler.js
 * Xử lý tất cả Socket.io events
 * Giai đoạn 1: Chỉ setup nền tảng, chưa có business logic
 */

// Map lưu userId (number) -> Set<socketId> để hỗ trợ nhiều tab/thiết bị đồng thời
const connectedUsers = new Map();

/**
 * Thêm socket cho 1 user.
 * Trả về true nếu đây là kết nối đầu tiên của user (vừa chuyển từ Offline -> Online).
 */
const addUserSocket = (userId, socketId) => {
  const uid = parseInt(userId, 10);
  if (isNaN(uid) || uid <= 0) return false;
  if (!connectedUsers.has(uid)) {
    connectedUsers.set(uid, new Set());
  }
  const set = connectedUsers.get(uid);
  const wasOffline = set.size === 0;
  set.add(socketId);
  return wasOffline;
};

/**
 * Gỡ socket của 1 user.
 * Trả về true nếu user không còn socket nào hoạt động (chuyển sang Offline).
 */
const removeUserSocket = (userId, socketId) => {
  const uid = parseInt(userId, 10);
  if (isNaN(uid) || !connectedUsers.has(uid)) return false;
  const set = connectedUsers.get(uid);
  set.delete(socketId);
  if (set.size === 0) {
    connectedUsers.delete(uid);
    return true; // Hoàn toàn offline
  }
  return false;
};

// Helper: Lấy danh sách userId (number) đang online
const getOnlineUsers = () => Array.from(connectedUsers.keys()).map((id) => Number(id));

// Helper: Kiểm tra 1 user có đang online không
const isUserOnline = (userId) => {
  const uid = parseInt(userId, 10);
  if (isNaN(uid) || uid <= 0) return false;
  const set = connectedUsers.get(uid);
  return Boolean(set && set.size > 0);
};

// Helper: Lấy 1 socketId bất kỳ của user (tương thích ngược)
const getSocketId = (userId) => {
  const uid = parseInt(userId, 10);
  const set = connectedUsers.get(uid);
  return set && set.size > 0 ? Array.from(set)[0] : null;
};

const initSocketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // -------------------------------------------------------
    // Event: user_online
    // Client gửi khi đã đăng nhập thành công
    // payload: { userId }
    // -------------------------------------------------------
    socket.on('user_online', ({ userId }) => {
      const uid = parseInt(userId, 10);
      if (uid && !isNaN(uid)) {
        socket.userId = uid;
        const becameOnline = addUserSocket(uid, socket.id);
        const onlineList = getOnlineUsers();
        console.log(`🟢 [Presence Engine] 👤 User ${uid} vừa Online (socket: ${socket.id}). Hiện có ${onlineList.length} người đang Online [IDs: ${onlineList.join(', ')}]`);

        // Gửi xác nhận cho client
        socket.emit('user_online_ack', { status: 'online', userId: uid });

        // Gửi toàn bộ danh sách online users hiện thời cho chính client này
        socket.emit('online_users_list', { onlineUserIds: onlineList });

        // Nếu user này vừa mới chuyển trạng thái sang online -> broadcast cho TẤT CẢ các client khác
        if (becameOnline) {
          socket.broadcast.emit('user_status_changed', { userId: uid, status: 'online' });
        }
      }
    });

    // -------------------------------------------------------
    // Event: get_online_users (Client chủ động yêu cầu danh sách)
    // -------------------------------------------------------
    socket.on('get_online_users', () => {
      socket.emit('online_users_list', { onlineUserIds: getOnlineUsers() });
    });

    // -------------------------------------------------------
    // Event: user_offline (Client chủ động báo ngắt kết nối / đăng xuất)
    // -------------------------------------------------------
    socket.on('user_offline', ({ userId }) => {
      const uid = parseInt(userId || socket.userId, 10);
      if (uid && !isNaN(uid)) {
        const becameOffline = removeUserSocket(uid, socket.id);
        if (becameOffline) {
          const onlineList = getOnlineUsers();
          console.log(`🔴 [Presence Engine] 👤 User ${uid} vừa Offline (manual logout). Hiện còn ${onlineList.length} người đang Online [IDs: ${onlineList.join(', ')}]`);
          io.emit('user_status_changed', { userId: uid, status: 'offline' });
        }
      }
    });

    // -------------------------------------------------------
    // Event: typing_start & typing_stop
    // -------------------------------------------------------
    socket.on('typing_start', ({ receiverId }) => {
      if (socket.userId && receiverId) {
        sendNotificationToUser(io, receiverId, 'user_typing', {
          senderId: socket.userId,
          isTyping: true,
        });
      }
    });

    socket.on('typing_stop', ({ receiverId }) => {
      if (socket.userId && receiverId) {
        sendNotificationToUser(io, receiverId, 'user_typing', {
          senderId: socket.userId,
          isTyping: false,
        });
      }
    });

    // -------------------------------------------------------
    // Event: Group Chat Rooms (Gia nhập & rời phòng chat nhóm)
    // -------------------------------------------------------
    socket.on('join_group', (data) => {
      const groupId = typeof data === 'object' && data !== null ? data.groupId : data;
      if (groupId) {
        socket.join(`group_${groupId}`);
        console.log(`👥 User ${socket.userId || socket.id} joined room group_${groupId}`);
      }
    });

    socket.on('leave_group', (data) => {
      const groupId = typeof data === 'object' && data !== null ? data.groupId : data;
      if (groupId) {
        socket.leave(`group_${groupId}`);
        console.log(`🚪 User ${socket.userId || socket.id} left room group_${groupId}`);
      }
    });

    socket.on('group_typing_start', (data) => {
      const groupId = data?.groupId;
      const userName = data?.userName || 'Thành viên';
      const senderId = socket.userId || data?.userId;
      if (groupId) {
        socket.to(`group_${groupId}`).emit('user_group_typing', {
          groupId,
          userId: senderId,
          userName,
          isTyping: true,
        });
      }
    });

    socket.on('group_typing_stop', (data) => {
      const groupId = data?.groupId;
      const senderId = socket.userId || data?.userId;
      if (groupId) {
        socket.to(`group_${groupId}`).emit('user_group_typing', {
          groupId,
          userId: senderId,
          isTyping: false,
        });
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
        const uid = socket.userId;
        const becameOffline = removeUserSocket(uid, socket.id);
        console.log(`👋 Socket disconnected for user ${uid} (socket: ${socket.id}, reason: ${reason})`);
        if (becameOffline) {
          const onlineList = getOnlineUsers();
          console.log(`🔴 [Presence Engine] 👤 User ${uid} đã Offline. Hiện còn ${onlineList.length} người đang Online [IDs: ${onlineList.join(', ')}]`);
          io.emit('user_status_changed', { userId: uid, status: 'offline' });
        }
      } else {
        console.log(`🔌 Socket disconnected: ${socket.id} (reason: ${reason})`);
      }
    });
  });

  console.log('✅ Socket.io handler initialized with Realtime Presence Engine');
};

/**
 * Gửi thông báo tới 1 user cụ thể nếu họ đang online (hỗ trợ đa socket)
 */
const sendNotificationToUser = (io, targetUserId, eventName, payload) => {
  const uid = parseInt(targetUserId, 10);
  const socketIds = connectedUsers.get(uid);
  if (socketIds && socketIds.size > 0 && io) {
    socketIds.forEach((sId) => {
      io.to(sId).emit(eventName, payload);
    });
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

/**
 * Gửi thông báo tới cả phòng nhóm (room group_${groupId})
 */
const sendNotificationToGroup = (io, groupId, eventName, payload) => {
  if (!io || !groupId) return false;
  io.to(`group_${groupId}`).emit(eventName, payload);
  return true;
};

module.exports = {
  initSocketHandler,
  getSocketId,
  getOnlineUsers,
  isUserOnline,
  sendNotificationToUser,
  broadcastToUsers,
  sendNotificationToGroup,
};

