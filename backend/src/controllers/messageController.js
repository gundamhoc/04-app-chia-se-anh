const { pool } = require('../config/db');
const { uploadFileToDrive, getDriveClient } = require('../utils/googleDrive');
const { sendNotificationToUser, isUserOnline } = require('../sockets/socketHandler');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Helper chuẩn hóa link ảnh Google Drive hoặc local sang proxy URL
function formatImageUrl(rawUrl, protocol, host) {
  if (!rawUrl) return null;
  if (rawUrl.includes('googleusercontent.com/d/') || rawUrl.includes('drive.google.com')) {
    const match = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `${protocol}://${host}/api/photos/drive/${match[1]}`;
    }
  }
  if (!rawUrl.startsWith('http')) {
    return `${protocol}://${host}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  }
  return rawUrl;
}

// Helper tạo link tải tệp tin đính kèm trực tiếp (có header Content-Disposition attachment)
function formatDownloadUrl(messageId, protocol, host) {
  if (!messageId) return null;
  return `${protocol}://${host}/api/messages/download/${messageId}`;
}

/**
 * 1. Lấy danh sách các cuộc hội thoại gần nhất (Conversations List)
 * GET /api/messages/conversations
 */
const getConversations = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const protocol = req.protocol;
    const host = req.get('host');

    // Truy vấn tất cả đối tác chat (từ bảng messages) và bạn bè đã kết bạn
    const [rows] = await pool.query(
      `
      SELECT 
        u.id AS friend_id,
        u.full_name AS friend_name,
        u.username AS friend_username,
        u.avatar_url AS friend_avatar,
        COALESCE(dcs.is_pinned, 0) AS is_pinned,
        COALESCE(dcs.is_muted, 0) AS is_muted,
        lm.id AS last_message_id,
        lm.message_text AS last_message_text,
        lm.image_url AS last_message_image,
        lm.file_url AS last_message_file_url,
        lm.file_name AS last_message_file_name,
        lm.sender_id AS last_message_sender_id,
        lm.is_read AS last_message_is_read,
        lm.created_at AS last_message_time,
        COALESCE(unread.unread_count, 0) AS unread_count
      FROM (
        SELECT DISTINCT 
          CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS user_id
        FROM messages
        WHERE sender_id = ? OR receiver_id = ?
        UNION
        SELECT 
          CASE WHEN requester_id = ? THEN receiver_id ELSE requester_id END AS user_id
        FROM friendships
        WHERE (requester_id = ? OR receiver_id = ?) AND status = 'accepted'
      ) partners
      JOIN users u ON u.id = partners.user_id
      LEFT JOIN direct_chat_settings dcs ON (dcs.user_id = ? AND dcs.friend_id = u.id)
      -- Lấy tin nhắn mới nhất giữa currentUserId và partner
      LEFT JOIN (
        SELECT m1.*
        FROM messages m1
        INNER JOIN (
          SELECT 
            CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS partner_id,
            MAX(id) AS max_id
          FROM messages
          WHERE sender_id = ? OR receiver_id = ?
          GROUP BY partner_id
        ) m2 ON m1.id = m2.max_id
      ) lm ON (lm.sender_id = u.id AND lm.receiver_id = ?) OR (lm.sender_id = ? AND lm.receiver_id = u.id)
      -- Đếm số tin nhắn chưa đọc
      LEFT JOIN (
        SELECT sender_id, COUNT(*) AS unread_count
        FROM messages
        WHERE receiver_id = ? AND is_read = FALSE
        GROUP BY sender_id
      ) unread ON unread.sender_id = u.id
      ORDER BY 
        CASE WHEN COALESCE(dcs.is_pinned, 0) = 1 THEN 0 ELSE 1 END,
        CASE WHEN lm.created_at IS NOT NULL THEN 0 ELSE 1 END,
        lm.created_at DESC,
        u.full_name ASC
      `,
      [
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
        currentUserId,
      ]
    );

    const conversations = rows.map((c) => ({
      friend_id: c.friend_id,
      friend_name: c.friend_name || c.friend_username,
      friend_username: c.friend_username,
      friend_avatar: formatImageUrl(c.friend_avatar, protocol, host),
      is_pinned: Boolean(c.is_pinned),
      is_muted: Boolean(c.is_muted),
      last_message_id: c.last_message_id,
      last_message_text: c.last_message_text,
      last_message_image: formatImageUrl(c.last_message_image, protocol, host),
      last_message_file_url: c.last_message_file_url ? formatDownloadUrl(c.last_message_id, protocol, host) : null,
      last_message_file_name: c.last_message_file_name,
      last_message_sender_id: c.last_message_sender_id,
      last_message_is_read: Boolean(c.last_message_is_read),
      last_message_time: c.last_message_time,
      unread_count: parseInt(c.unread_count, 10) || 0,
      is_online: isUserOnline(c.friend_id),
    }));

    return res.json({
      success: true,
      message: 'Lấy danh sách cuộc trò chuyện thành công.',
      data: conversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách cuộc trò chuyện.',
    });
  }
};

/**
 * 2. Lấy lịch sử tin nhắn 1-1 với một bạn bè cụ thể
 * GET /api/messages/:friendId
 */
const getMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const friendId = parseInt(req.params.friendId, 10);
    const protocol = req.protocol;
    const host = req.get('host');

    if (isNaN(friendId)) {
      return res.status(400).json({ success: false, message: 'ID bạn bè không hợp lệ.' });
    }

    // Lấy thông tin bạn chat
    const [friendRows] = await pool.query(
      `SELECT id, full_name, username, avatar_url FROM users WHERE id = ?`,
      [friendId]
    );

    if (friendRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng này.' });
    }

    const friend = {
      id: friendRows[0].id,
      full_name: friendRows[0].full_name || friendRows[0].username,
      username: friendRows[0].username,
      avatar_url: formatImageUrl(friendRows[0].avatar_url, protocol, host),
      is_online: isUserOnline(friendId),
    };

    // Tự động đánh dấu đã đọc các tin nhắn gửi đến mình
    await pool.query(
      `UPDATE messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE`,
      [friendId, currentUserId]
    );

    // Lấy tối đa 100 tin nhắn gần nhất, sắp xếp tăng dần theo thời gian
    const [messages] = await pool.query(
      `
      SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message_text,
        m.image_url,
        m.file_url,
        m.file_name,
        m.file_size,
        m.file_type,
        m.is_read,
        m.created_at,
        u.full_name AS sender_name,
        u.avatar_url AS sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (m.sender_id = ? AND m.receiver_id = ?)
         OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
      LIMIT 100
      `,
      [currentUserId, friendId, friendId, currentUserId]
    );

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      receiver_id: m.receiver_id,
      message_text: m.message_text,
      image_url: formatImageUrl(m.image_url, protocol, host),
      file_url: m.file_url ? formatDownloadUrl(m.id, protocol, host) : null,
      file_name: m.file_name,
      file_size: m.file_size,
      file_type: m.file_type,
      is_read: Boolean(m.is_read),
      created_at: m.created_at,
      sender_name: m.sender_name,
      sender_avatar: formatImageUrl(m.sender_avatar, protocol, host),
      is_mine: m.sender_id === currentUserId,
    }));

    // Lấy theme hình nền 1-1 nếu có
    const u1 = Math.min(currentUserId, friendId);
    const u2 = Math.max(currentUserId, friendId);
    const [themeRows] = await pool.query(
      `SELECT background_url FROM direct_chat_themes WHERE user1_id = ? AND user2_id = ?`,
      [u1, u2]
    );
    const background_url = themeRows.length > 0 ? formatImageUrl(themeRows[0].background_url, protocol, host) : null;

    // Lấy cài đặt Ghim & Tắt thông báo của user đối với bạn chat
    const [settingsRows] = await pool.query(
      `SELECT is_pinned, is_muted FROM direct_chat_settings WHERE user_id = ? AND friend_id = ?`,
      [currentUserId, friendId]
    );
    const is_pinned = settingsRows.length > 0 ? Boolean(settingsRows[0].is_pinned) : false;
    const is_muted = settingsRows.length > 0 ? Boolean(settingsRows[0].is_muted) : false;

    // Gửi socket event thông báo đối phương đã đọc tin nhắn
    if (req.io) {
      sendNotificationToUser(req.io, friendId, 'messages_marked_read', {
        reader_id: currentUserId,
      });
    }

    return res.json({
      success: true,
      message: 'Lấy lịch sử tin nhắn thành công.',
      data: {
        friend,
        background_url,
        is_pinned,
        is_muted,
        messages: formattedMessages,
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy tin nhắn.',
    });
  }
};

/**
 * 3. Gửi tin nhắn văn bản mới (1-1)
 * POST /api/messages
 * Body: { receiver_id, message_text }
 */

// ============================================================
// HELPER: Kiểm tra receiver (tin nhắn 1-1)
// - receiver PHẢI là tài khoản đang hoạt động
// - CHẶN tự nhắn cho chính mình
// (Người lạ nhắn được với nhau là FEATURE theo thiết kế Masita)
// ============================================================
const validateDirectReceiver = async (receiverId, currentUserId) => {
  if (isNaN(receiverId)) {
    return { ok: false, status: 400, message: 'Người nhận không hợp lệ.' };
  }
  if (receiverId === currentUserId) {
    return { ok: false, status: 400, message: 'Không thể gửi tin nhắn cho chính mình.' };
  }
  const [users] = await pool.query('SELECT id FROM users WHERE id = ? AND is_active = 1', [receiverId]);
  if (users.length === 0) {
    return { ok: false, status: 404, message: 'Người nhận không tồn tại.' };
  }
  return { ok: true };
};

const sendMessage = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { receiver_id, message_text } = req.body;
    const protocol = req.protocol;
    const host = req.get('host');

    const receiverId = parseInt(receiver_id, 10);
    const receiverCheck = await validateDirectReceiver(receiverId, currentUserId);
    if (!receiverCheck.ok) {
      return res.status(receiverCheck.status).json({ success: false, message: receiverCheck.message });
    }

    if (!message_text || message_text.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
    }

    // Lưu tin nhắn vào CSDL
    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, message_text, is_read) VALUES (?, ?, ?, FALSE)`,
      [currentUserId, receiverId, message_text.trim()]
    );

    const messageId = result.insertId;

    // Lấy thông tin tin nhắn vừa tạo
    const [rows] = await pool.query(
      `
      SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message_text,
        m.image_url,
        m.is_read,
        m.created_at,
        u.full_name AS sender_name,
        u.avatar_url AS sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
      `,
      [messageId]
    );

    const created = rows[0];
    const formattedMessage = {
      id: created.id,
      sender_id: created.sender_id,
      receiver_id: created.receiver_id,
      message_text: created.message_text,
      image_url: null,
      is_read: false,
      created_at: created.created_at,
      sender_name: created.sender_name,
      sender_avatar: formatImageUrl(created.sender_avatar, protocol, host),
      is_mine: false,
    };

    // Gửi realtime qua Socket.io tới người nhận và người gửi
    if (req.io) {
      sendNotificationToUser(req.io, receiverId, 'new_direct_message', {
        ...formattedMessage,
        is_mine: false,
      });

      sendNotificationToUser(req.io, currentUserId, 'new_direct_message', {
        ...formattedMessage,
        is_mine: true,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Gửi tin nhắn thành công.',
      data: {
        ...formattedMessage,
        is_mine: true,
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi gửi tin nhắn.',
    });
  }
};

/**
 * 4. Gửi tin nhắn kèm hình ảnh (Tải lên Google Drive)
 * POST /api/messages/upload-image
 * Form-data: image (file), receiver_id, message_text (optional)
 */
const sendImageMessage = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { receiver_id, message_text } = req.body;
    const protocol = req.protocol;
    const host = req.get('host');

    const receiverId = parseInt(receiver_id, 10);
    const receiverCheck = await validateDirectReceiver(receiverId, currentUserId);
    if (!receiverCheck.ok) {
      return res.status(receiverCheck.status).json({ success: false, message: receiverCheck.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn 1 hình ảnh để gửi.' });
    }

    let finalImageUrl = `/uploads/${req.file.filename}`;

    // Upload lên Google Drive
    try {
      const driveResult = await uploadFileToDrive(req.file.path, req.file.mimetype, req.file.filename);
      if (driveResult && driveResult.directUrl) {
        finalImageUrl = driveResult.directUrl;
      }
    } catch (driveErr) {
      console.warn('⚠️ Lỗi upload ảnh tin nhắn lên Google Drive, fallback sang lưu nội bộ:', driveErr.message);
    }

    // Lưu tin nhắn ảnh vào CSDL
    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, message_text, image_url, is_read) VALUES (?, ?, ?, ?, FALSE)`,
      [currentUserId, receiverId, message_text ? message_text.trim() : null, finalImageUrl]
    );

    const messageId = result.insertId;

    const [rows] = await pool.query(
      `
      SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message_text,
        m.image_url,
        m.is_read,
        m.created_at,
        u.full_name AS sender_name,
        u.avatar_url AS sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
      `,
      [messageId]
    );

    const created = rows[0];
    const formattedMessage = {
      id: created.id,
      sender_id: created.sender_id,
      receiver_id: created.receiver_id,
      message_text: created.message_text,
      image_url: formatImageUrl(created.image_url, protocol, host),
      is_read: false,
      created_at: created.created_at,
      sender_name: created.sender_name,
      sender_avatar: formatImageUrl(created.sender_avatar, protocol, host),
      is_mine: false,
    };

    // Gửi realtime qua Socket.io
    if (req.io) {
      sendNotificationToUser(req.io, receiverId, 'new_direct_message', {
        ...formattedMessage,
        is_mine: false,
      });

      sendNotificationToUser(req.io, currentUserId, 'new_direct_message', {
        ...formattedMessage,
        is_mine: true,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Gửi ảnh thành công! 📸',
      data: {
        ...formattedMessage,
        is_mine: true,
      },
    });
  } catch (error) {
    console.error('Send image message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi gửi hình ảnh tin nhắn.',
    });
  }
};

/**
 * 5. Đánh dấu tất cả tin nhắn từ bạn bè là đã đọc
 * PUT /api/messages/:friendId/read
 */
const markMessagesAsRead = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const friendId = parseInt(req.params.friendId, 10);

    if (isNaN(friendId)) {
      return res.status(400).json({ success: false, message: 'ID bạn bè không hợp lệ.' });
    }

    await pool.query(
      `UPDATE messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE`,
      [friendId, currentUserId]
    );

    if (req.io) {
      sendNotificationToUser(req.io, friendId, 'messages_marked_read', {
        reader_id: currentUserId,
      });
    }

    return res.json({
      success: true,
      message: 'Đã đánh dấu tin nhắn là đã đọc.',
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật trạng thái tin nhắn.',
    });
  }
};

/**
 * 6. Gửi tin nhắn đính kèm tệp tin (code, txt, pdf, zip, docx, ảnh...)
 * POST /api/messages/upload-file
 * Form-data: file, receiver_id, message_text (optional)
 */
const sendFileMessage = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { receiver_id, message_text } = req.body;
    const protocol = req.protocol;
    const host = req.get('host');

    const receiverId = parseInt(receiver_id, 10);
    const receiverCheck = await validateDirectReceiver(receiverId, currentUserId);
    if (!receiverCheck.ok) {
      return res.status(receiverCheck.status).json({ success: false, message: receiverCheck.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn 1 tệp tin để gửi.' });
    }

    let finalFileUrl = `/uploads/${req.file.filename}`;
    const isImage = req.file.mimetype ? req.file.mimetype.startsWith('image/') : false;

    // Upload lên Google Drive
    try {
      const driveResult = await uploadFileToDrive(req.file.path, req.file.mimetype, req.file.originalname || req.file.filename);
      if (driveResult && driveResult.directUrl) {
        finalFileUrl = driveResult.directUrl;
        // Xóa ngay tệp tin tạm trên server để tiết kiệm 100% dung lượng ổ cứng
        if (fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkErr) {
            console.warn('⚠️ Lỗi xóa file tạm sau khi upload drive:', unlinkErr.message);
          }
        }
      }
    } catch (driveErr) {
      console.warn('⚠️ Lỗi upload tệp tin lên Google Drive, fallback sang lưu nội bộ:', driveErr.message);
    }

    let imageUrl = isImage ? finalFileUrl : null;

    // Nếu là video hoặc tệp tin và có gửi kèm thumbnail ảnh bìa
    if (!isImage && req.thumbnailFile) {
      let finalThumbUrl = `/uploads/${req.thumbnailFile.filename}`;
      try {
        const thumbDriveResult = await uploadFileToDrive(
          req.thumbnailFile.path,
          req.thumbnailFile.mimetype,
          req.thumbnailFile.originalname || req.thumbnailFile.filename
        );
        if (thumbDriveResult && thumbDriveResult.directUrl) {
          finalThumbUrl = thumbDriveResult.directUrl;
          if (fs.existsSync(req.thumbnailFile.path)) {
            try {
              fs.unlinkSync(req.thumbnailFile.path);
            } catch (unlinkErr) {
              console.warn('⚠️ Lỗi xóa file thumbnail tạm:', unlinkErr.message);
            }
          }
        }
      } catch (thumbDriveErr) {
        console.warn('⚠️ Lỗi upload thumbnail lên Google Drive:', thumbDriveErr.message);
      }
      imageUrl = finalThumbUrl;
    }

    const fileName = req.file.originalname || req.file.filename;
    const fileSize = req.file.size;
    const fileType = req.file.mimetype || 'application/octet-stream';

    // Lưu vào CSDL
    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, message_text, image_url, file_url, file_name, file_size, file_type, is_read) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [currentUserId, receiverId, message_text ? message_text.trim() : null, imageUrl, finalFileUrl, fileName, fileSize, fileType]
    );

    const messageId = result.insertId;

    const [rows] = await pool.query(
      `
      SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message_text,
        m.image_url,
        m.file_url,
        m.file_name,
        m.file_size,
        m.file_type,
        m.is_read,
        m.created_at,
        u.full_name AS sender_name,
        u.avatar_url AS sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
      `,
      [messageId]
    );

    const created = rows[0];
    const formattedMessage = {
      id: created.id,
      sender_id: created.sender_id,
      receiver_id: created.receiver_id,
      message_text: created.message_text,
      image_url: formatImageUrl(created.image_url, protocol, host),
      file_url: formatDownloadUrl(created.id, protocol, host),
      file_name: created.file_name,
      file_size: created.file_size,
      file_type: created.file_type,
      is_read: false,
      created_at: created.created_at,
      sender_name: created.sender_name,
      sender_avatar: formatImageUrl(created.sender_avatar, protocol, host),
      is_mine: false,
    };

    if (req.io) {
      sendNotificationToUser(req.io, receiverId, 'new_direct_message', {
        ...formattedMessage,
        is_mine: false,
      });

      sendNotificationToUser(req.io, currentUserId, 'new_direct_message', {
        ...formattedMessage,
        is_mine: true,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Gửi tệp tin thành công! 📁',
      data: {
        ...formattedMessage,
        is_mine: true,
      },
    });
  } catch (error) {
    console.error('Send file message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi gửi tệp tin.',
    });
  }
};

/**
 * 7. Đọc nội dung tệp tin văn bản / code trực tiếp
 * GET /api/messages/file-content/:messageId
 */
const getFileContent = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(messageId)) {
      return res.status(400).json({ success: false, message: 'ID tin nhắn không hợp lệ.' });
    }

    const [rows] = await pool.query(
      `SELECT id, sender_id, receiver_id, group_id, file_url, file_name, file_size, file_type FROM messages WHERE id = ?`,
      [messageId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tệp tin.' });
    }

    const msg = rows[0];
    if (msg.group_id) {
      const [membership] = await pool.query(
        `SELECT id FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
        [msg.group_id, currentUserId]
      );
      if (membership.length === 0) {
        return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên nhóm này.' });
      }
    } else {
      if (msg.sender_id !== currentUserId && msg.receiver_id !== currentUserId) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem tệp tin này.' });
      }
    }

    if (!msg.file_url) {
      return res.status(404).json({ success: false, message: 'Tin nhắn này không có tệp tin đính kèm.' });
    }

    // Đọc nếu file lưu cục bộ trong /uploads
    if (msg.file_url.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '../../', msg.file_url);
      if (fs.existsSync(localPath)) {
        const content = fs.readFileSync(localPath, 'utf8');
        return res.json({
          success: true,
          data: {
            fileName: msg.file_name,
            fileSize: msg.file_size,
            fileType: msg.file_type,
            content,
          },
        });
      }
    }

    // Nếu là Google Drive
    const match = msg.file_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const drive = getDriveClient();
      if (drive) {
        const driveRes = await drive.files.get(
          { fileId: match[1], alt: 'media' },
          { responseType: 'text' }
        );
        return res.json({
          success: true,
          data: {
            fileName: msg.file_name,
            fileSize: msg.file_size,
            fileType: msg.file_type,
            content: typeof driveRes.data === 'string' ? driveRes.data : JSON.stringify(driveRes.data),
          },
        });
      }
    }

    return res.status(400).json({ success: false, message: 'Không thể đọc nội dung tệp tin này.' });
  } catch (error) {
    console.error('Get file content error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đọc tệp tin.',
    });
  }
};

/**
 * 8. Tải tệp tin đính kèm về máy (Download file with attachment header)
 * GET /api/messages/download/:messageId
 */
const downloadMessageFile = async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    if (isNaN(messageId)) {
      return res.status(400).json({ success: false, message: 'ID tin nhắn không hợp lệ.' });
    }

    const [rows] = await pool.query(
      `SELECT id, sender_id, receiver_id, group_id, file_url, image_url, file_name, file_size, file_type FROM messages WHERE id = ?`,
      [messageId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn hoặc tệp tin.' });
    }

    const msg = rows[0];

    // KIỂM TRA QUYỀN TẢI FILE: chỉ người gửi, người nhận (1-1) hoặc thành viên nhóm
    const currentUserId = req.user.id;
    if (msg.group_id) {
      const [membership] = await pool.query(
        `SELECT id FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
        [msg.group_id, currentUserId]
      );
      if (membership.length === 0) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền tải tệp tin này.' });
      }
    } else if (msg.sender_id !== currentUserId && msg.receiver_id !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền tải tệp tin này.' });
    }

    const targetUrl = msg.file_url || msg.image_url;
    if (!targetUrl) {
      return res.status(404).json({ success: false, message: 'Tin nhắn không có tệp tin đính kèm.' });
    }

    const fileName = msg.file_name || (msg.image_url ? 'image.jpg' : 'download_file');
    const fileType = msg.file_type || (msg.image_url ? 'image/jpeg' : 'application/octet-stream');

    // Header bắt buộc trình duyệt phải tải file về máy với đúng tên file gốc
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Type', fileType);

    // 1. Nếu file lưu cục bộ trong /uploads
    if (targetUrl.includes('/uploads/')) {
      const match = targetUrl.match(/\/uploads\/([a-zA-Z0-9_.-]+)/);
      const fname = match ? match[1] : path.basename(targetUrl);
      const localPath = path.join(__dirname, '../../uploads', fname);
      if (fs.existsSync(localPath)) {
        return fs.createReadStream(localPath).pipe(res);
      }
    }

    // 2. Nếu file lưu trên Google Drive
    const match = targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const drive = getDriveClient();
      if (drive) {
        const driveStream = await drive.files.get(
          { fileId: match[1], alt: 'media' },
          { responseType: 'stream' }
        );
        return driveStream.data.pipe(res);
      } else {
        return res.redirect(`https://drive.google.com/uc?export=download&id=${match[1]}`);
      }
    }

    // 3. Fallback redirect
    return res.redirect(targetUrl);
  } catch (error) {
    console.error('Download message file error:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi tải tệp tin.',
      });
    }
  }
};

/**
 * 8.5. Stream video trực tiếp chuẩn HTTP 206 Partial Content (YouTube progressive buffer streaming)
 * GET /api/messages/video-stream/:messageId
 * Hỗ trợ Query param: ?token=... hoặc Header Authorization
 * Hỗ trợ Header Range: bytes=start-end
 */
const streamMessageVideo = async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    if (isNaN(messageId)) {
      return res.status(400).json({ success: false, message: 'ID tin nhắn không hợp lệ.' });
    }

    // Xác thực token (qua Authorization header hoặc query param ?token=...)
    let userId = req.user ? req.user.id : null;
    if (!userId && req.query.token) {
      try {
        const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (tokenErr) {
        return res.status(401).json({ success: false, message: 'Token xác thực không hợp lệ.' });
      }
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để phát video.' });
    }

    const [rows] = await pool.query(
      `SELECT id, sender_id, receiver_id, group_id, file_url, file_name, file_size, file_type FROM messages WHERE id = ?`,
      [messageId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy video.' });
    }

    const msg = rows[0];

    // Kiểm tra quyền truy cập
    if (msg.group_id) {
      const [membership] = await pool.query(
        `SELECT id FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
        [msg.group_id, userId]
      );
      if (membership.length === 0) {
        return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên nhóm này.' });
      }
    } else {
      if (msg.sender_id !== userId && msg.receiver_id !== userId) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem video này.' });
      }
    }

    const targetUrl = msg.file_url;
    if (!targetUrl) {
      return res.status(404).json({ success: false, message: 'Tin nhắn này không có tệp video.' });
    }

    const mimeType = msg.file_type || 'video/mp4';

    // 1. Nếu video lưu trên Google Drive
    const match = targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      const drive = getDriveClient();
      if (!drive) {
        return res.status(500).json({ success: false, message: 'Google Drive client chưa sẵn sàng.' });
      }

      let totalSize = msg.file_size;
      if (!totalSize) {
        try {
          const meta = await drive.files.get({ fileId, fields: 'size, mimeType' });
          totalSize = parseInt(meta.data.size, 10);
        } catch (mErr) {
          console.warn('Lỗi đọc size video từ Google Drive:', mErr.message);
        }
      }

      const range = req.headers.range;
      if (range && totalSize) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType,
          'Cache-Control': 'no-cache',
        });

        const driveStream = await drive.files.get(
          { fileId, alt: 'media' },
          {
            responseType: 'stream',
            headers: {
              Range: `bytes=${start}-${end}`,
            },
          }
        );

        driveStream.data.on('error', (streamErr) => {
          if (!res.headersSent) res.status(500).end();
        });

        return driveStream.data.pipe(res);
      } else {
        res.writeHead(200, {
          'Accept-Ranges': 'bytes',
          'Content-Type': mimeType,
          ...(totalSize ? { 'Content-Length': totalSize } : {}),
        });

        const driveStream = await drive.files.get(
          { fileId, alt: 'media' },
          { responseType: 'stream' }
        );

        driveStream.data.on('error', (streamErr) => {
          if (!res.headersSent) res.status(500).end();
        });

        return driveStream.data.pipe(res);
      }
    }

    // 2. Nếu video fallback lưu cục bộ trong /uploads/
    if (targetUrl.includes('/uploads/')) {
      const matchLocal = targetUrl.match(/\/uploads\/([a-zA-Z0-9_.-]+)/);
      const fname = matchLocal ? matchLocal[1] : path.basename(targetUrl);
      const localPath = path.join(__dirname, '../../uploads', fname);

      if (fs.existsSync(localPath)) {
        const stat = fs.statSync(localPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunkSize = end - start + 1;

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mimeType,
          });

          const fileStream = fs.createReadStream(localPath, { start, end });
          return fileStream.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
            'Content-Type': mimeType,
          });
          return fs.createReadStream(localPath).pipe(res);
        }
      }
    }

    // Fallback chuyển hướng đến file gốc
    return res.redirect(targetUrl);
  } catch (error) {
    console.error('Stream message video error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi phát luồng video.' });
    }
  }
};

/**
 * 9. Cập nhật Theme / Hình nền trò chuyện 1-1
 * PUT /api/messages/:friendId/theme
 */
const updateDirectTheme = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const friendId = parseInt(req.params.friendId, 10);
    const background_preset = req.body?.background_preset || req.body?.preset_url;
    const remove_background = req.body?.remove_background || req.body?.remove;
    const protocol = req.protocol;
    const host = req.get('host');

    if (isNaN(friendId)) {
      return res.status(400).json({ success: false, message: 'ID bạn bè không hợp lệ.' });
    }

    let targetUrl = null;

    if (req.file) {
      targetUrl = `/uploads/${req.file.filename}`;
      try {
        const driveResult = await uploadFileToDrive(req.file.path, req.file.mimetype, req.file.filename);
        if (driveResult && driveResult.directUrl) {
          targetUrl = driveResult.directUrl;
        }
      } catch (err) {
        console.warn('Lỗi upload theme 1-1 lên drive:', err.message);
      }
    } else if (background_preset && background_preset.trim().length > 0) {
      targetUrl = background_preset.trim();
    } else if (remove_background === 'true' || remove_background === true) {
      targetUrl = null;
    } else {
      return res.status(400).json({ success: false, message: 'Không có dữ liệu hình nền.' });
    }

    const u1 = Math.min(currentUserId, friendId);
    const u2 = Math.max(currentUserId, friendId);

    await pool.query(
      `INSERT INTO direct_chat_themes (user1_id, user2_id, background_url)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE background_url = VALUES(background_url)`,
      [u1, u2, targetUrl]
    );

    const formattedBg = formatImageUrl(targetUrl, protocol, host);

    // Thông báo realtime tới cả 2 người dùng qua socket
    if (req.io) {
      sendNotificationToUser(req.io, friendId, 'direct_theme_updated', {
        friendId: currentUserId,
        background_url: formattedBg,
      });
      sendNotificationToUser(req.io, currentUserId, 'direct_theme_updated', {
        friendId,
        background_url: formattedBg,
      });
    }

    return res.json({
      success: true,
      message: 'Cập nhật hình nền trò chuyện thành công! ✨',
      data: {
        background_url: formattedBg,
      },
    });
  } catch (error) {
    console.error('Update direct theme error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật hình nền trò chuyện.' });
  }
};

/**
 * 10. Bật/Tắt Ghim cuộc trò chuyện 1-1
 * PUT /api/messages/:friendId/pin
 * Body: { is_pinned?: boolean }
 */
const togglePinDirectChat = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const friendId = parseInt(req.params.friendId, 10);

    if (isNaN(friendId)) {
      return res.status(400).json({ success: false, message: 'ID bạn bè không hợp lệ.' });
    }

    let isPinned = req.body?.is_pinned;
    if (isPinned === undefined) {
      const [existing] = await pool.query(
        'SELECT is_pinned FROM direct_chat_settings WHERE user_id = ? AND friend_id = ?',
        [currentUserId, friendId]
      );
      isPinned = existing.length > 0 ? (existing[0].is_pinned ? 0 : 1) : 1;
    } else {
      isPinned = isPinned ? 1 : 0;
    }

    await pool.query(
      `INSERT INTO direct_chat_settings (user_id, friend_id, is_pinned)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE is_pinned = VALUES(is_pinned)`,
      [currentUserId, friendId, isPinned]
    );

    return res.json({
      success: true,
      message: isPinned ? 'Đã ghim cuộc trò chuyện lên đầu! 📌' : 'Đã bỏ ghim cuộc trò chuyện.',
      data: { is_pinned: Boolean(isPinned) },
    });
  } catch (error) {
    console.error('Toggle pin direct chat error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi ghim cuộc trò chuyện.' });
  }
};

/**
 * 11. Bật/Tắt Thông báo cuộc trò chuyện 1-1
 * PUT /api/messages/:friendId/mute
 * Body: { is_muted?: boolean }
 */
const toggleMuteDirectChat = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const friendId = parseInt(req.params.friendId, 10);

    if (isNaN(friendId)) {
      return res.status(400).json({ success: false, message: 'ID bạn bè không hợp lệ.' });
    }

    let isMuted = req.body?.is_muted;
    if (isMuted === undefined) {
      const [existing] = await pool.query(
        'SELECT is_muted FROM direct_chat_settings WHERE user_id = ? AND friend_id = ?',
        [currentUserId, friendId]
      );
      isMuted = existing.length > 0 ? (existing[0].is_muted ? 0 : 1) : 1;
    } else {
      isMuted = isMuted ? 1 : 0;
    }

    await pool.query(
      `INSERT INTO direct_chat_settings (user_id, friend_id, is_muted)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE is_muted = VALUES(is_muted)`,
      [currentUserId, friendId, isMuted]
    );

    return res.json({
      success: true,
      message: isMuted ? 'Đã tắt thông báo cuộc trò chuyện! 🔕' : 'Đã bật thông báo cuộc trò chuyện! 🔔',
      data: { is_muted: Boolean(isMuted) },
    });
  } catch (error) {
    console.error('Toggle mute direct chat error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thay đổi thông báo.' });
  }
};

/**
 * 12. Tìm kiếm tin nhắn trong cuộc trò chuyện 1-1
 * GET /api/messages/:friendId/search?q=...
 */
const searchDirectMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const friendId = parseInt(req.params.friendId, 10);
    const query = (req.query.q || '').trim();
    const protocol = req.protocol;
    const host = req.get('host');

    if (isNaN(friendId)) {
      return res.status(400).json({ success: false, message: 'ID bạn bè không hợp lệ.' });
    }
    if (!query) {
      return res.json({ success: true, data: [] });
    }

    const searchPattern = `%${query}%`;
    const [rows] = await pool.query(
      `SELECT id, sender_id, receiver_id, message_text, image_url, file_url, file_name, file_size, file_type, created_at
       FROM messages
       WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
         AND (message_text LIKE ? OR file_name LIKE ?)
       ORDER BY id DESC
       LIMIT 50`,
      [currentUserId, friendId, friendId, currentUserId, searchPattern, searchPattern]
    );

    const results = rows.map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      receiver_id: m.receiver_id,
      message_text: m.message_text,
      image_url: formatImageUrl(m.image_url, protocol, host),
      file_url: m.file_url ? formatDownloadUrl(m.id, protocol, host) : null,
      file_name: m.file_name,
      file_size: m.file_size,
      file_type: m.file_type,
      created_at: m.created_at,
      is_mine: m.sender_id === currentUserId,
    }));

    return res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Search direct messages error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tìm kiếm tin nhắn.' });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  sendImageMessage,
  sendFileMessage,
  getFileContent,
  markMessagesAsRead,
  downloadMessageFile,
  streamMessageVideo,
  updateDirectTheme,
  togglePinDirectChat,
  toggleMuteDirectChat,
  searchDirectMessages,
};
