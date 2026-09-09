const { pool } = require('../config/db');
const { formatImageUrl } = require('./photoController');

/**
 * 1. Lấy danh sách thông báo của người dùng hiện tại (hỗ trợ phân trang)
 * GET /api/notifications?page=1&limit=20
 */
const getNotifications = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const offset = (page - 1) * limit;

    const protocol = req.protocol;
    const host = req.get('host');

    // 1. Tự động dọn dẹp các thông báo kết bạn mà hai bên ĐÃ LÀ BẠN BÈ từ trước
    try {
      await pool.query(
        `DELETE n FROM notifications n
         JOIN friendships f ON ((f.requester_id = n.actor_id AND f.receiver_id = n.user_id) OR (f.requester_id = n.user_id AND f.receiver_id = n.actor_id))
         WHERE n.type = 'friend_request' AND n.user_id = ? AND f.status = 'accepted'`,
        [currentUserId]
      );
    } catch (cleanErr) {
      console.warn('⚠️ Lỗi dọn dẹp thông báo kết bạn cũ:', cleanErr.message);
    }

    // 2. Lấy danh sách thông báo
    const [rows] = await pool.query(
      `
      SELECT 
        n.id,
        n.user_id,
        n.actor_id,
        n.type,
        n.entity_id,
        n.content,
        n.is_read,
        n.created_at,
        u.username AS actor_username,
        u.full_name AS actor_name,
        u.avatar_url AS actor_avatar,
        p.image_url AS photo_thumbnail,
        p.media_type AS photo_media_type,
        (
          SELECT f.status FROM friendships f 
          WHERE (f.requester_id = n.actor_id AND f.receiver_id = n.user_id)
             OR (f.requester_id = n.user_id AND f.receiver_id = n.actor_id)
          LIMIT 1
        ) AS friendship_status
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      LEFT JOIN photos p ON (n.type IN ('like_post', 'comment_post', 'reply_comment', 'new_post') AND n.entity_id = p.id)
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [currentUserId, limit, offset]
    );

    // Đếm tổng số chưa đọc
    const [unreadRows] = await pool.query(
      `SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [currentUserId]
    );
    const unreadCount = unreadRows[0]?.unread_count || 0;

    const formattedNotifications = rows.map((n) => {
      let avatar = n.actor_avatar;
      if (avatar && !avatar.startsWith('http')) {
        avatar = `${protocol}://${host}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
      }

      let thumbnail = null;
      if (n.photo_thumbnail) {
        thumbnail = formatImageUrl(n.photo_thumbnail, protocol, host);
      }

      // Với thông báo hệ thống kiểm duyệt bài viết từ Ban Quản Trị
      const isPostDeleted = n.type === 'post_deleted';
      const actorName = isPostDeleted ? 'Ban Quản Trị Masita' : (n.actor_name || n.actor_username);
      const actorUsername = isPostDeleted ? 'admin' : n.actor_username;
      const finalAvatar = isPostDeleted 
        ? 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=100'
        : avatar;

      return {
        id: n.id,
        user_id: n.user_id,
        actor_id: n.actor_id,
        actor_name: actorName,
        actor_username: actorUsername,
        actor_avatar: finalAvatar,
        type: n.type,
        entity_id: n.entity_id,
        content: n.content,
        is_read: Boolean(n.is_read),
        photo_thumbnail: thumbnail,
        photo_media_type: n.photo_media_type || 'image',
        friendship_status: n.friendship_status || null,
        created_at: n.created_at,
      };
    });


    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách thông báo thành công.',
      data: {
        notifications: formattedNotifications,
        unread_count: unreadCount,
        has_more: rows.length === limit,
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách thông báo.',
    });
  }
};

/**
 * 2. Lấy số lượng thông báo chưa đọc
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [currentUserId]
    );

    return res.status(200).json({
      success: true,
      data: {
        unread_count: rows[0]?.unread_count || 0,
      },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đếm thông báo chưa đọc.',
    });
  }
};

/**
 * 3. Đánh dấu 1 thông báo đã đọc
 * PUT /api/notifications/:id/read
 */
const markAsRead = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const notificationId = parseInt(req.params.id, 10);

    if (isNaN(notificationId)) {
      return res.status(400).json({ success: false, message: 'ID thông báo không hợp lệ.' });
    }

    await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [notificationId, currentUserId]
    );

    const [rows] = await pool.query(
      `SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [currentUserId]
    );

    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu thông báo là đã đọc.',
      data: {
        id: notificationId,
        unread_count: rows[0]?.unread_count || 0,
      },
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật trạng thái thông báo.',
    });
  }
};

/**
 * 4. Đánh dấu toàn bộ thông báo đã đọc
 * PUT /api/notifications/mark-all-read
 */
const markAllAsRead = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [currentUserId]
    );

    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc.',
      data: {
        unread_count: 0,
      },
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đánh dấu đã đọc toàn bộ thông báo.',
    });
  }
};

/**
 * 5. Xóa 1 thông báo
 * DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const notificationId = parseInt(req.params.id, 10);

    if (isNaN(notificationId)) {
      return res.status(400).json({ success: false, message: 'ID thông báo không hợp lệ.' });
    }

    await pool.query(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [notificationId, currentUserId]
    );

    const [rows] = await pool.query(
      `SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [currentUserId]
    );

    return res.status(200).json({
      success: true,
      message: 'Đã xóa thông báo.',
      data: {
        id: notificationId,
        unread_count: rows[0]?.unread_count || 0,
      },
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xóa thông báo.',
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
