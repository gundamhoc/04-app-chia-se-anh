const { pool } = require('../config/db');
const { sendNotificationToUser } = require('../sockets/socketHandler');

/**
 * Tạo thông báo mới và phát realtime qua Socket.IO
 * @param {Object} params
 * @param {number} params.userId - Người nhận thông báo
 * @param {number} params.actorId - Người thực hiện tương tác
 * @param {'like_post'|'comment_post'|'reply_comment'|'friend_request'|'friend_accept'|'like_comment'|'group_invite'|'new_post'} params.type
 * @param {number|null} [params.entityId] - ID của bài viết / comment / group liên quan
 * @param {string} [params.content] - Nội dung tóm tắt hiển thị
 * @param {Object} [params.io] - Đối tượng Socket.IO Server
 */
const createNotification = async ({ userId, actorId, type, entityId = null, content = '', io = null }) => {
  try {
    // 1. Không gửi thông báo cho chính mình khi tự tương tác
    if (!userId || !actorId || Number(userId) === Number(actorId)) {
      return null;
    }

    const targetUserId = parseInt(userId, 10);
    const sourceActorId = parseInt(actorId, 10);
    const safeEntityId = entityId ? parseInt(entityId, 10) : null;

    // 2. Chống spam thông báo trùng lặp (ví dụ: thả tim liên tiếp trong 2 phút)
    let notificationId = null;
    if (['like_post', 'like_comment', 'friend_request'].includes(type)) {
      const [existing] = await pool.query(
        `SELECT id FROM notifications 
         WHERE user_id = ? AND actor_id = ? AND type = ? AND (entity_id = ? OR (entity_id IS NULL AND ? IS NULL))
         ORDER BY id DESC LIMIT 1`,
        [targetUserId, sourceActorId, type, safeEntityId, safeEntityId]
      );

      if (existing.length > 0) {
        notificationId = existing[0].id;
        await pool.query(
          `UPDATE notifications SET content = ?, is_read = 0, created_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [content, notificationId]
        );
      }
    }

    if (!notificationId) {
      const [result] = await pool.query(
        `INSERT INTO notifications (user_id, actor_id, type, entity_id, content, is_read) 
         VALUES (?, ?, ?, ?, ?, 0)`,
        [targetUserId, sourceActorId, type, safeEntityId, content]
      );
      notificationId = result.insertId;
    }

    // 3. Lấy dữ liệu chi tiết kèm thông tin actor và thumbnail bài viết
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
        p.media_type AS photo_media_type
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      LEFT JOIN photos p ON (n.type IN ('like_post', 'comment_post', 'reply_comment', 'new_post') AND n.entity_id = p.id)
      WHERE n.id = ?
      `,
      [notificationId]
    );

    if (rows.length === 0) return null;

    const notif = rows[0];

    // 4. Đếm tổng số thông báo chưa đọc của người nhận
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [targetUserId]
    );
    const unreadCount = countRows[0]?.unread_count || 0;

    // 5. Gửi socket realtime tới người nhận nếu có truyền io
    if (io) {
      sendNotificationToUser(io, targetUserId, 'new_notification', {
        notification: {
          id: notif.id,
          user_id: notif.user_id,
          actor_id: notif.actor_id,
          actor_name: notif.actor_name || notif.actor_username,
          actor_username: notif.actor_username,
          actor_avatar: notif.actor_avatar,
          type: notif.type,
          entity_id: notif.entity_id,
          content: notif.content,
          is_read: Boolean(notif.is_read),
          photo_thumbnail: notif.photo_thumbnail || null,
          photo_media_type: notif.photo_media_type || 'image',
          created_at: notif.created_at,
        },
        unread_count: unreadCount,
      });
    }

    return notif;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

module.exports = {
  createNotification,
};
