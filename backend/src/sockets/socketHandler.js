/**
 * socketHandler.js
 * Xử lý tất cả Socket.io events
 * Giai đoạn 1: Chỉ setup nền tảng, chưa có business logic
 */

const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/db');

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

let ioInstance = null;

const initSocketHandler = (io) => {
  ioInstance = io;
  // -------------------------------------------------------
  // Middleware xác thực socket: BẮT BUỘC JWT người dùng hợp lệ
  // Client gửi token qua socket.handshake.auth.token
  // -------------------------------------------------------
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('UNAUTHORIZED: thiếu token xác thực'));
      }
      const decoded = verifyToken(token);
      if (decoded && decoded.admin_id) {
        // Token quản trị viên / nhân viên admin portal → vào room 'admins' nhận realtime event
        socket.isAdmin = true;
        socket.adminId = parseInt(decoded.admin_id, 10);
        return next();
      }
      if (!decoded || !decoded.id) {
        return next(new Error('UNAUTHORIZED: token không hợp lệ'));
      }
      socket.userId = parseInt(decoded.id, 10);
      next();
    } catch (err) {
      next(new Error('UNAUTHORIZED: ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    // -------------------------------------------------------
    // Admin portal socket: chỉ join room 'admins', không tính presence
    // -------------------------------------------------------
    if (socket.isAdmin) {
      socket.join('admins');
      console.log(`👑 Admin ${socket.adminId} connected to realtime feed (socket: ${socket.id})`);
      return;
    }


    // -------------------------------------------------------
    // Event: user_online
    // Client gửi khi đăng nhập thành công hoặc reconnect
    // -------------------------------------------------------
    socket.on('user_online', () => {
      const userId = socket.userId;
      if (userId) {
        const becameOnline = addUserSocket(userId, socket.id);
        console.log(`👤 User ${userId} is online (socket: ${socket.id}, active sockets: ${connectedUsers.get(parseInt(userId, 10))?.size || 1})`);
        
        if (becameOnline) {
          const onlineList = getOnlineUsers();
          console.log(`🟢 [Presence Engine] 👤 User ${userId} vừa Online (socket: ${socket.id}). Hiện có ${onlineList.length} người đang Online [IDs: ${onlineList.join(', ')}]`);
          io.emit('user_status_changed', { userId: Number(userId), status: 'online' });
        }
        
        // Gửi lại danh sách các user online hiện tại cho client này
        socket.emit('online_users_list', { onlineUserIds: getOnlineUsers() });
      }
    });

    // -------------------------------------------------------
    // Event: get_online_users
    // Client yêu cầu danh sách user online
    // -------------------------------------------------------
    socket.on('get_online_users', () => {
      socket.emit('online_users_list', { onlineUserIds: getOnlineUsers() });
    });

    // -------------------------------------------------------
    // Event: user_offline
    // Client gửi khi chủ động đăng xuất
    // -------------------------------------------------------
    socket.on('user_offline', () => {
      const userId = socket.userId;
      if (userId) {
        const becameOffline = removeUserSocket(userId, socket.id);
        if (becameOffline) {
          const onlineList = getOnlineUsers();
          console.log(`🔴 [Presence Engine] 👤 User ${userId} đã Offline. Hiện còn ${onlineList.length} người đang Online [IDs: ${onlineList.join(', ')}]`);
          io.emit('user_status_changed', { userId: Number(userId), status: 'offline' });
        }
      }
    });

    // -------------------------------------------------------
    // Event: join_conversation / leave_conversation (1-1 chat)
    // -------------------------------------------------------
    // RoomId LUÔN do server tính từ socket.userId (chống nghe lén hội thoại người khác)
    const buildChatRoom = (friendId) => {
      const fid = parseInt(friendId, 10);
      if (!socket.userId || isNaN(fid) || fid <= 0) return null;
      return `chat_${[socket.userId, fid].sort((a, b) => a - b).join('_')}`;
    };

    socket.on('join_conversation', (data) => {
      const roomId = buildChatRoom(data?.friendId);
      if (roomId) {
        socket.join(roomId);
      }
    });

    socket.on('leave_conversation', (data) => {
      const roomId = buildChatRoom(data?.friendId);
      if (roomId) {
        socket.leave(roomId);
      }
    });

    // -------------------------------------------------------
    // Event: join_group / leave_group (Group chat)
    // -------------------------------------------------------
    socket.on('join_group', async (data) => {
      const groupId = parseInt(data?.groupId, 10);
      if (!groupId || !socket.userId) return;
      try {
        // CHỈ thành viên nhóm mới được vào phòng realtime của nhóm
        const [membership] = await pool.query(
          'SELECT id FROM `group_members` WHERE group_id = ? AND user_id = ?',
          [groupId, socket.userId]
        );
        if (membership.length > 0) {
          socket.join(`group_${groupId}`);
        } else {
          console.warn(`⛔ [Socket] User ${socket.userId} try join group_${groupId} WITHOUT membership - blocked`);
        }
      } catch (err) {
        console.error('join_group membership check error:', err.message);
      }
    });

    socket.on('leave_group', (data) => {
      const groupId = data?.groupId;
      if (groupId) {
        socket.leave(`group_${groupId}`);
      }
    });

    // -------------------------------------------------------
    // Event: typing indicators
    // -------------------------------------------------------
    socket.on('typing_start', (data) => {
      const { receiverId } = data || {};
      if (receiverId) {
        sendNotificationToUser(io, receiverId, 'user_typing', {
          senderId: socket.userId,
          isTyping: true,
        });
      }
    });

    socket.on('typing_stop', (data) => {
      const { receiverId } = data || {};
      if (receiverId) {
        sendNotificationToUser(io, receiverId, 'user_typing', {
          senderId: socket.userId,
          isTyping: false,
        });
      }
    });

    socket.on('group_typing_start', (data) => {
      const groupId = data?.groupId;
      const userName = data?.userName || 'Thành viên';
      const senderId = socket.userId;
      if (groupId && senderId) {
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
      const senderId = socket.userId;
      if (groupId && senderId) {
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

const getIO = () => ioInstance;

/**
 * Gửi thông báo tới 1 user cụ thể nếu họ đang online (hỗ trợ đa socket)
 */
const sendNotificationToUser = (io, targetUserId, eventName, payload) => {
  const theIO = io || ioInstance;
  const uid = parseInt(targetUserId, 10);
  const socketIds = connectedUsers.get(uid);
  if (socketIds && socketIds.size > 0 && theIO) {
    socketIds.forEach((sId) => {
      theIO.to(sId).emit(eventName, payload);
    });
    return true;
  }
  return false;
};

/**
 * Ngắt kết nối socket của user và cưỡng chế đăng xuất (Ban / Force Logout)
 */
const kickUserSockets = (io, targetUserId, eventName, payload) => {
  const theIO = io || ioInstance;
  const uid = parseInt(targetUserId, 10);
  const socketIds = connectedUsers.get(uid);
  if (socketIds && socketIds.size > 0 && theIO) {
    socketIds.forEach((sId) => {
      theIO.to(sId).emit(eventName || 'force_logout', payload);
      setTimeout(() => {
        const sock = theIO.sockets?.sockets?.get(sId);
        if (sock) {
          try { sock.disconnect(true); } catch (e) {}
        }
      }, 500);
    });
    return true;
  }
  return false;
};

/**
 * Gửi thông báo tới nhiều users cùng lúc
 */
const broadcastToUsers = (io, targetUserIds, eventName, payload) => {
  const theIO = io || ioInstance;
  if (!Array.isArray(targetUserIds) || !theIO) return;
  targetUserIds.forEach((uId) => {
    sendNotificationToUser(theIO, uId, eventName, payload);
  });
};

/**
 * Gửi thông báo tới cả phòng nhóm (room group_${groupId})
 */
/**
 * Cưỡng chế 1 user rời khỏi phòng realtime của nhóm (khi bị xóa / rời nhóm)
 */
const leaveGroupRoom = (io, groupId, userId) => {
  const theIO = io || ioInstance;
  const uid = parseInt(userId, 10);
  if (!theIO || isNaN(uid) || !groupId) return;
  const socketIds = connectedUsers.get(uid);
  if (socketIds) {
    socketIds.forEach((sId) => {
      const sock = theIO.sockets?.sockets?.get(sId);
      if (sock) sock.leave(`group_${groupId}`);
    });
  }
};

const sendNotificationToGroup = (io, groupId, eventName, payload) => {
  const theIO = io || ioInstance;
  if (!theIO || !groupId) return false;
  theIO.to(`group_${groupId}`).emit(eventName, payload);
  return true;
};

module.exports = {
  initSocketHandler,
  getIO,
  getSocketId,
  getOnlineUsers,
  isUserOnline,
  sendNotificationToUser,
  kickUserSockets,
  broadcastToUsers,
  sendNotificationToGroup,
  leaveGroupRoom,
};


