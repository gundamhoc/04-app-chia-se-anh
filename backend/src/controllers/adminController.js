const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { getDriveClient } = require('../utils/googleDrive');
const { generateToken } = require('../utils/jwt');
const { getOnlineUsers, isUserOnline, sendNotificationToUser, kickUserSockets, getIO } = require('../sockets/socketHandler');

/**
 * 1. Lấy thống kê tổng quan hệ thống cho Admin Dashboard
 * GET /api/admin/stats
 */
const getDashboardStats = async (req, res) => {
  try {
    // 1. Tổng người dùng
    const [[{ total_users, active_users }]] = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users
      FROM users
    `);

    // 2. Tổng bài viết (ảnh & video)
    const [[{ total_posts, total_photos, total_videos }]] = await pool.query(`
      SELECT 
        COUNT(*) as total_posts,
        SUM(CASE WHEN media_type = 'video' OR video_url IS NOT NULL THEN 1 ELSE 0 END) as total_videos,
        SUM(CASE WHEN media_type != 'video' AND video_url IS NULL THEN 1 ELSE 0 END) as total_photos
      FROM photos
    `);

    // 3. Tổng tương tác (Reactions + Comments)
    const [[{ total_reactions }]] = await pool.query(`SELECT COUNT(*) as total_reactions FROM photo_reactions`);
    const [[{ total_comments }]] = await pool.query(`SELECT COUNT(*) as total_comments FROM photo_comments`);

    // 4. Yêu cầu đổi mật khẩu đang chờ duyệt
    const [[{ pending_reset_requests }]] = await pool.query(`
      SELECT COUNT(*) as pending_reset_requests 
      FROM password_reset_requests 
      WHERE status = 'pending'
    `);

    // 4.1 Thắc mắc người dùng đang chờ giải đáp
    let pendingTicketsCount = 0;
    try {
      const [[{ pending_tickets }]] = await pool.query(
        "SELECT COUNT(*) as pending_tickets FROM support_tickets WHERE status = 'pending'"
      );
      pendingTicketsCount = Number(pending_tickets) || 0;
    } catch (tErr) {
      // Ignored
    }

    // 5. 5 người dùng mới đăng ký gần nhất
    const [recentUsers] = await pool.query(`
      SELECT id, username, email, full_name, avatar_url, is_active, banned_until, ban_reason, created_at
      FROM users
      ORDER BY id DESC
      LIMIT 5
    `);

    // 6. 5 bài viết mới nhất
    const [recentPosts] = await pool.query(`
      SELECT p.id, p.user_id, p.caption, p.image_url, p.video_url, p.media_type, p.privacy, p.created_at,
             COALESCE(p.video_url, p.image_url) as media_url,
             u.username, u.full_name, u.avatar_url,
             u.username as author_username, u.full_name as author_name, u.avatar_url as author_avatar
      FROM photos p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.id DESC
      LIMIT 5
    `);

    const usersCount = Number(total_users) || 0;
    const activeUsersCount = Number(active_users) || 0;
    const postsCount = Number(total_posts) || 0;
    const photosCount = Number(total_photos) || 0;
    const videosCount = Number(total_videos) || 0;
    const reactionsCount = Number(total_reactions) || 0;
    const commentsCount = Number(total_comments) || 0;
    const pendingResetsCount = Number(pending_reset_requests) || 0;

    // Lấy thông tin thời gian thực từ Socket.io presence engine
    const onlineUserIds = getOnlineUsers();
    const onlineUsersCount = onlineUserIds.length;

    // Bổ sung trạng thái online vào recent_users
    const recentUsersWithPresence = recentUsers.map(u => ({
      ...u,
      is_online: isUserOnline(u.id),
    }));

    const protocol = req.protocol;
    const host = req.get('host');
    const recentPostsFormatted = recentPosts.map(p => {
      const isVideo = p.media_type === 'video' || !!p.video_url;
      return {
        ...p,
        is_video: isVideo,
        stream_url: isVideo ? `${protocol}://${host}/api/admin/posts/${p.id}/stream` : null,
      };
    });

    return res.json({
      success: true,
      message: 'Lấy thống kê hệ thống thành công.',
      data: {
        total_users: usersCount,
        active_users: activeUsersCount,
        online_users: onlineUsersCount,
        online_user_ids: onlineUserIds,
        total_posts: postsCount,
        total_photos: photosCount,
        total_videos: videosCount,
        total_reactions: reactionsCount,
        total_comments: commentsCount,
        pending_reset_requests: pendingResetsCount,
        pending_tickets: pendingTicketsCount,
        users: { 
          total: usersCount, 
          active: activeUsersCount, 
          online: onlineUsersCount 
        },
        posts: { total: postsCount, photos: photosCount, videos: videosCount },
        interactions: { reactions: reactionsCount, comments: commentsCount },
        pending_resets: pendingResetsCount,
        recent_users: recentUsersWithPresence,
        recent_posts: recentPostsFormatted,
      },
    });
  } catch (error) {
    console.error('Admin get stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy dữ liệu thống kê.',
    });
  }
};

/**
 * 2. Lấy danh sách người dùng kèm phân trang và tìm kiếm
 * GET /api/admin/users?q=...&status=...&page=1&limit=20
 */
const getUsers = async (req, res) => {
  try {
    const q = (req.query.q || req.query.search || '').trim();
    const status = req.query.status; // 'active', 'banned', 'all'
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];

    if (q) {
      whereConditions.push('(username LIKE ? OR email LIKE ? OR full_name LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term, term);
    }

    if (status === 'active') {
      whereConditions.push('is_active = 1');
    } else if (status === 'banned') {
      whereConditions.push('is_active = 0');
    }

    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM users ${whereSql}`,
      params
    );

    const [users] = await pool.query(
      `
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.full_name, 
        u.avatar_url, 
        u.bio, 
        u.is_active, 
        u.banned_until,
        u.ban_reason,
        u.is_private_account,
        u.created_at,
        (SELECT COUNT(*) FROM photos WHERE user_id = u.id) as posts_count,
        (SELECT COUNT(*) FROM friendships WHERE (requester_id = u.id OR receiver_id = u.id) AND status = 'accepted') as friends_count
      FROM users u
      ${whereSql}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    // Bổ sung trạng thái online thời gian thực
    const usersWithPresence = users.map(u => ({
      ...u,
      is_online: isUserOnline(u.id),
    }));

    return res.json({
      success: true,
      message: 'Lấy danh sách người dùng thành công.',
      data: usersWithPresence,
      pagination: {
        total: Number(total),
        page,
        limit,
        total_pages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách người dùng.',
    });
  }
};

/**
 * 3. Khóa / Mở khóa tài khoản người dùng (Hỗ trợ tạm thời theo ngày hoặc vĩnh viễn kèm lý do)
 * PUT /api/admin/users/:id/ban
 * PUT /api/admin/users/:id/toggle-status
 * Body: { action: 'ban'|'unban', type: 'temporary'|'permanent', days: 7, reason: '...' }
 */
const banUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ.' });
    }

    const [users] = await pool.query('SELECT id, username, is_active, banned_until, ban_reason FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const { action, type, days, reason, is_active } = req.body || {};

    // 1. Nếu mở khóa (unban)
    if (action === 'unban' || is_active === 1 || (action === undefined && is_active === undefined && users[0].is_active === 0)) {
      await pool.query('UPDATE users SET is_active = 1, banned_until = NULL, ban_reason = NULL, updated_at = NOW() WHERE id = ?', [userId]);
      return res.json({
        success: true,
        message: 'Đã mở khóa tài khoản thành công.',
        data: { id: userId, is_active: 1, banned_until: null, ban_reason: null },
      });
    }

    // 2. Nếu khóa (ban)
    const banReason = (reason && typeof reason === 'string' && reason.trim()) ? reason.trim() : 'Vi phạm tiêu chuẩn cộng đồng';
    let bannedUntil = null;
    let message = '';
    const numDays = parseInt(days, 10);

    if (type === 'temporary' && !isNaN(numDays) && numDays > 0) {
      // Khóa tạm thời theo số ngày
      await pool.query(
        'UPDATE users SET is_active = 0, banned_until = DATE_ADD(NOW(), INTERVAL ? DAY), ban_reason = ?, updated_at = NOW() WHERE id = ?',
        [numDays, banReason, userId]
      );
      const [[{ calculated_until }]] = await pool.query('SELECT banned_until as calculated_until FROM users WHERE id = ?', [userId]);
      bannedUntil = calculated_until;
      message = `Đã khóa tài khoản trong ${numDays} ngày. Lý do: "${banReason}".`;
    } else {
      // Khóa vĩnh viễn
      await pool.query(
        'UPDATE users SET is_active = 0, banned_until = NULL, ban_reason = ?, updated_at = NOW() WHERE id = ?',
        [banReason, userId]
      );
      message = `Đã khóa vĩnh viễn tài khoản. Lý do: "${banReason}".`;
    }

    // 3. Nếu người dùng đang online, ngắt socket và gửi thông báo cưỡng chế đăng xuất
    const io = getIO() || req.app.get('io') || req.io;
    kickUserSockets(io, userId, 'force_logout', {
      reason: banReason,
      banned_until: bannedUntil,
      type: type === 'temporary' ? 'temporary' : 'permanent',
      message: type === 'temporary' 
        ? `Tài khoản của bạn đã bị khóa tạm thời. Lý do: ${banReason}`
        : `Tài khoản của bạn đã bị khóa vĩnh viễn. Lý do: ${banReason}`,
    });

    return res.json({
      success: true,
      message,
      data: { id: userId, is_active: 0, banned_until: bannedUntil, ban_reason: banReason },
    });
  } catch (error) {
    console.error('Admin ban user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi thay đổi trạng thái khóa tài khoản.',
    });
  }
};

const toggleUserStatus = banUser;

/**
 * 4. Đặt lại mật khẩu trực tiếp cho người dùng từ Admin Dashboard
 * PUT /api/admin/users/:id/reset-password
 */
const adminResetPassword = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { new_password } = req.body;

    if (!new_password || new_password.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password.trim(), salt);

    await pool.query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [password_hash, userId]);

    return res.json({
      success: true,
      message: 'Đã đặt lại mật khẩu cho tài khoản thành công.',
    });
  } catch (error) {
    console.error('Admin reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đặt lại mật khẩu.',
    });
  }
};

/**
 * 5. Lấy danh sách yêu cầu quên mật khẩu
 * GET /api/admin/reset-requests?status=pending|sent|resolved|all
 */
const getResetRequests = async (req, res) => {
  try {
    const status = req.query.status || 'all';
    let whereSql = '';
    let params = [];

    if (status && status !== 'all') {
      whereSql = 'WHERE pr.status = ?';
      params.push(status);
    }

    const [requests] = await pool.query(
      `
      SELECT 
        pr.id,
        pr.user_id,
        pr.email,
        pr.status,
        pr.created_at,
        u.username,
        u.full_name,
        u.avatar_url,
        u.is_active
      FROM password_reset_requests pr
      JOIN users u ON pr.user_id = u.id
      ${whereSql}
      ORDER BY pr.id DESC
      LIMIT 100
      `,
      params
    );

    return res.json({
      success: true,
      message: 'Lấy danh sách yêu cầu cấp lại mật khẩu thành công.',
      data: requests,
    });
  } catch (error) {
    console.error('Admin get reset requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách yêu cầu quên mật khẩu.',
    });
  }
};

/**
 * 6. Cập nhật trạng thái yêu cầu quên mật khẩu (sent, resolved, pending)
 * PUT /api/admin/reset-requests/:id
 */
const updateResetRequestStatus = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { status, note } = req.body;

    const validStatuses = ['pending', 'sent', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái yêu cầu không hợp lệ.' });
    }

    await pool.query('UPDATE password_reset_requests SET status = ? WHERE id = ?', [status, requestId]);

    return res.json({
      success: true,
      message: `Đã cập nhật trạng thái yêu cầu sang "${status}".`,
      data: { id: requestId, status },
    });
  } catch (error) {
    console.error('Admin update reset request status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật yêu cầu.',
    });
  }
};

/**
 * 7. Lấy danh sách bài đăng để kiểm duyệt (Photos & Videos)
 * GET /api/admin/posts?q=...&type=all|video|image&page=1&limit=20
 */
const getPosts = async (req, res) => {
  try {
    const q = (req.query.q || req.query.search || '').trim();
    const type = req.query.type || req.query.mediaType || 'all'; // 'video', 'image', 'all'
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];

    if (q) {
      whereConditions.push('(p.caption LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term, term);
    }

    if (type === 'video') {
      whereConditions.push('(p.media_type = "video" OR p.video_url IS NOT NULL)');
    } else if (type === 'image') {
      whereConditions.push('(p.media_type != "video" AND p.video_url IS NULL)');
    }

    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) as total 
      FROM photos p
      JOIN users u ON p.user_id = u.id
      ${whereSql}
      `,
      params
    );

    const [posts] = await pool.query(
      `
      SELECT 
        p.id, 
        p.user_id, 
        p.caption, 
        p.image_url, 
        p.video_url, 
        COALESCE(p.video_url, p.image_url) as media_url,
        p.media_type, 
        p.privacy, 
        p.privacy as privacy_level,
        p.created_at, 
        u.username,
        u.full_name,
        u.avatar_url,
        u.username as author_username, 
        u.full_name as author_name, 
        u.avatar_url as author_avatar, 
        (SELECT COUNT(*) FROM photo_reactions WHERE photo_id = p.id) as reactions_count,
        (SELECT COUNT(*) FROM photo_comments WHERE photo_id = p.id) as comments_count
      FROM photos p
      JOIN users u ON p.user_id = u.id
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const protocol = req.protocol;
    const host = req.get('host');
    const formattedPosts = posts.map(p => {
      const isVideo = p.media_type === 'video' || !!p.video_url;
      return {
        ...p,
        is_video: isVideo,
        stream_url: isVideo ? `${protocol}://${host}/api/admin/posts/${p.id}/stream` : null,
      };
    });

    return res.json({
      success: true,
      message: 'Lấy danh sách bài đăng thành công.',
      data: formattedPosts,
      pagination: {
        total: Number(total),
        page,
        limit,
        total_pages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (error) {
    console.error('Admin get posts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách bài viết.',
    });
  }
};

/**
 * 8. Xóa bài viết vi phạm (Quản trị viên)
 * DELETE /api/admin/posts/:id
 */
/**
 * 8. Xóa bài viết vi phạm (Quản trị viên kèm lý do & gửi thông báo đến tác giả)
 * DELETE /api/admin/posts/:id
 * Body: { reason: 'Hình ảnh không phù hợp' }
 */
const deletePost = async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ success: false, message: 'ID bài viết không hợp lệ.' });
    }

    const [existing] = await pool.query(
      'SELECT id, user_id, caption, image_url, video_url, media_type FROM photos WHERE id = ?',
      [postId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    const post = existing[0];
    const deleteReason = (req.body && req.body.reason && typeof req.body.reason === 'string' && req.body.reason.trim())
      ? req.body.reason.trim()
      : 'Vi phạm tiêu chuẩn cộng đồng';

    // 1. Xóa bài viết khỏi cơ sở dữ liệu
    await pool.query('DELETE FROM photos WHERE id = ?', [postId]);

    // 2. Gửi thông báo đến tài khoản tác giả
    const captionPreview = post.caption ? `"${post.caption.substring(0, 35)}..."` : 'Khoảnh khắc của bạn';
    const notifContent = `Bài viết ${captionPreview} đã bị Quản trị viên gỡ bỏ. Lý do: ${deleteReason}`;

    try {
      const [notifResult] = await pool.query(
        `INSERT INTO notifications (user_id, actor_id, type, entity_id, content, is_read, created_at)
         VALUES (?, ?, 'post_deleted', ?, ?, 0, NOW())`,
        [post.user_id, post.user_id, postId, notifContent]
      );
      const notifId = notifResult.insertId;
      const [[{ unread_count }]] = await pool.query(
        `SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
        [post.user_id]
      );

      // 3. Gửi sự kiện realtime chuẩn 'new_notification' để app cập nhật badge + Toast rõ ràng
      const io = req.app.get('io') || req.io;
      if (io) {
        sendNotificationToUser(io, post.user_id, 'new_notification', {
          notification: {
            id: notifId,
            user_id: post.user_id,
            actor_id: post.user_id,
            actor_name: 'Ban Quản Trị Masita',
            actor_username: 'admin',
            actor_avatar: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=100',
            type: 'post_deleted',
            entity_id: postId,
            content: notifContent,
            is_read: false,
            photo_thumbnail: null,
            photo_media_type: 'image',
            created_at: new Date().toISOString(),
          },
          unread_count: unread_count || 1,
        });
      }
    } catch (notifErr) {
      console.warn('⚠️ Could not insert notification for post deletion:', notifErr.message);
    }

    return res.json({
      success: true,
      message: `Đã xóa bài viết và gửi thông báo tới người đăng (Lý do: "${deleteReason}").`,
      data: { id: postId, author_id: post.user_id, reason: deleteReason },
    });
  } catch (error) {
    console.error('Admin delete post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xóa bài viết.',
    });
  }
};

/**
 * 9. Stream video bài viết phục vụ Admin kiểm duyệt (Hỗ trợ HTTP 206 Partial Content / Range requests)
 * GET /api/admin/posts/:id/stream
 */
const streamPostVideo = async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ success: false, message: 'ID bài viết không hợp lệ.' });
    }

    const [rows] = await pool.query(
      'SELECT id, video_url, image_url, media_type FROM photos WHERE id = ?',
      [postId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    const post = rows[0];
    const targetUrl = post.video_url || post.image_url;
    if (!targetUrl) {
      return res.status(404).json({ success: false, message: 'Bài viết này không có video.' });
    }

    // CORS & Cache headers cho phát video trên web/file
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    let mimeType = 'video/mp4';

    // 1. Nếu video lưu trên Google Drive
    let fileId = null;
    const matchD = targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchD && matchD[1]) {
      fileId = matchD[1];
    } else {
      const matchId = targetUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (matchId && matchId[1]) fileId = matchId[1];
    }

    if (fileId) {
      const drive = getDriveClient();
      if (!drive) {
        return res.status(500).json({ success: false, message: 'Google Drive client chưa sẵn sàng.' });
      }

      let totalSize = null;
      try {
        const meta = await drive.files.get({ fileId, fields: 'size, mimeType' });
        if (meta.data.size) totalSize = parseInt(meta.data.size, 10);
        if (meta.data.mimeType && meta.data.mimeType.startsWith('video/')) {
          mimeType = meta.data.mimeType;
        }
      } catch (mErr) {
        console.warn('Admin stream size read error:', mErr.message);
      }

      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Accept-Ranges': 'bytes',
          'Content-Type': mimeType,
          ...(totalSize ? { 'Content-Length': totalSize } : {}),
        });
        return res.end();
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

    // 2. Nếu video lưu cục bộ trong /uploads/
    if (targetUrl.includes('/uploads/')) {
      const matchLocal = targetUrl.match(/\/uploads\/([a-zA-Z0-9_.-]+)/);
      const fname = matchLocal ? matchLocal[1] : path.basename(targetUrl);
      const localPath = path.join(__dirname, '../../uploads', fname);

      if (fs.existsSync(localPath)) {
        const stat = fs.statSync(localPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (req.method === 'HEAD') {
          res.writeHead(200, {
            'Accept-Ranges': 'bytes',
            'Content-Type': mimeType,
            'Content-Length': fileSize,
          });
          return res.end();
        }

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

    // 3. Fallback chuyển hướng
    return res.redirect(targetUrl);
  } catch (error) {
    console.error('Admin stream video error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Lỗi phát luồng video bài viết.' });
    }
  }
};

/**
 * 10. Đăng nhập Admin / Nhân viên
 * POST /api/admin/auth/login
 * Body: { username, password }
 */
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.',
      });
    }

    const [rows] = await pool.query(
      'SELECT id, username, password_hash, full_name, email, role, is_active FROM admin_users WHERE username = ?',
      [username.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.',
      });
    }

    const user = rows[0];
    if (user.is_active === 0) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản này đã bị khóa quyền truy cập hệ thống.',
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.',
      });
    }

    // Cập nhật last_login
    await pool.query('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = generateToken({
      admin_id: user.id,
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    });

    return res.json({
      success: true,
      message: `Đăng nhập thành công với vai trò ${user.role === 'admin' ? 'Quản Trị Viên' : 'Nhân Viên CSKH'}.`,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đăng nhập quản trị.',
    });
  }
};

/**
 * 11. Lấy thông tin tài khoản Admin/Nhân viên hiện tại
 * GET /api/admin/auth/me
 */
const getAdminMe = async (req, res) => {
  return res.json({
    success: true,
    data: req.admin,
  });
};

/**
 * 12. Danh sách Nhân viên & Admin (Chỉ dành cho Admin)
 * GET /api/admin/staff
 */
const getStaffList = async (req, res) => {
  try {
    const [staffList] = await pool.query(
      `SELECT id, username, full_name, email, role, is_active, last_login, created_at
       FROM admin_users
       ORDER BY id ASC`
    );

    return res.json({
      success: true,
      data: staffList,
    });
  } catch (error) {
    console.error('Get staff list error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách nhân viên.',
    });
  }
};

/**
 * 13. Tạo tài khoản Nhân viên mới (Chỉ dành cho Admin)
 * POST /api/admin/staff
 * Body: { username, password, full_name, email, role }
 */
const createStaff = async (req, res) => {
  try {
    const { username, password, full_name, email, role } = req.body || {};
    if (!username || !password || !full_name) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ tên đăng nhập, mật khẩu và họ tên nhân viên.',
      });
    }

    const [existing] = await pool.query('SELECT id FROM admin_users WHERE username = ?', [username.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập này đã được sử dụng.',
      });
    }

    const validRole = role === 'admin' ? 'admin' : 'staff';
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO admin_users (username, password_hash, full_name, email, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW())`,
      [username.trim(), passwordHash, full_name.trim(), email ? email.trim() : null, validRole]
    );

    return res.json({
      success: true,
      message: `Đã tạo tài khoản ${validRole === 'admin' ? 'Quản trị viên' : 'Nhân viên'} thành công.`,
      data: {
        id: result.insertId,
        username: username.trim(),
        full_name: full_name.trim(),
        role: validRole,
      },
    });
  } catch (error) {
    console.error('Create staff error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tạo tài khoản nhân viên.',
    });
  }
};

/**
 * 14. Khóa / Mở khóa / Đổi mật khẩu nhân viên
 * PUT /api/admin/staff/:id
 * Body: { is_active, role, password }
 */
const toggleStaffStatus = async (req, res) => {
  try {
    const staffId = parseInt(req.params.id, 10);
    if (isNaN(staffId)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    const [existing] = await pool.query('SELECT id, username, role, is_active FROM admin_users WHERE id = ?', [staffId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản nhân viên.' });
    }

    // Không cho phép tự khóa tài khoản Admin tối cao đầu tiên (id: 1)
    if (staffId === 1 && req.body.is_active === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể khóa tài khoản Quản trị viên tối cao gốc của hệ thống.',
      });
    }

    const { is_active, role, password } = req.body;
    let updates = [];
    let params = [];

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (role && (role === 'admin' || role === 'staff')) {
      updates.push('role = ?');
      params.push(role);
    }

    if (password && password.trim()) {
      const hash = await bcrypt.hash(password.trim(), 10);
      updates.push('password_hash = ?');
      params.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có dữ liệu thay đổi.' });
    }

    params.push(staffId);
    await pool.query(`UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`, params);

    return res.json({
      success: true,
      message: 'Đã cập nhật thông tin tài khoản nhân viên thành công.',
    });
  } catch (error) {
    console.error('Update staff status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật nhân viên.',
    });
  }
};

/**
 * 15. Lấy danh sách thắc mắc của người dùng (Support Tickets)
 * GET /api/admin/support-tickets?status=all|pending|answered&q=...&page=1&limit=20
 */
const getSupportTickets = async (req, res) => {
  try {
    const status = req.query.status || 'all'; // all | pending | answered
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    let conditions = [];
    let params = [];

    if (status && status !== 'all') {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (q) {
      conditions.push('(t.subject LIKE ? OR t.message LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM support_tickets t JOIN users u ON t.user_id = u.id ${whereSql}`,
      params
    );

    const [tickets] = await pool.query(
      `SELECT 
        t.id,
        t.user_id,
        t.subject,
        t.category,
        t.message,
        t.status,
        t.staff_reply,
        t.replied_by,
        t.replied_at,
        t.created_at,
        t.updated_at,
        u.username,
        u.full_name,
        u.avatar_url,
        a.full_name as responder_name,
        a.role as responder_role
       FROM support_tickets t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN admin_users a ON t.replied_by = a.id
       ${whereSql}
       ORDER BY (CASE WHEN t.status = 'pending' THEN 0 ELSE 1 END), t.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Thống kê nhanh
    const [[{ count_pending }]] = await pool.query("SELECT COUNT(*) as count_pending FROM support_tickets WHERE status = 'pending'");
    const [[{ count_answered }]] = await pool.query("SELECT COUNT(*) as count_answered FROM support_tickets WHERE status = 'answered'");

    return res.json({
      success: true,
      data: tickets,
      counts: {
        total: Number(total),
        pending: Number(count_pending),
        answered: Number(count_answered),
      },
      pagination: {
        total: Number(total),
        page,
        limit,
        total_pages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (error) {
    console.error('Get support tickets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách câu hỏi trợ giúp.',
    });
  }
};

/**
 * 16. Trả lời giải đáp thắc mắc người dùng
 * PUT /api/admin/support-tickets/:id/reply
 * Body: { reply: '...' }
 */
const replySupportTicket = async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    const { reply } = req.body || {};

    if (isNaN(ticketId) || !reply || !reply.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập nội dung câu trả lời giải đáp.',
      });
    }

    const [rows] = await pool.query(
      'SELECT id, user_id, subject FROM support_tickets WHERE id = ?',
      [ticketId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi trợ giúp.' });
    }

    const ticket = rows[0];
    const responderId = req.admin ? req.admin.id : null;
    const responderName = req.admin ? req.admin.full_name : 'Ban Quản Trị Masita';

    // 1. Cập nhật câu trả lời vào ticket
    await pool.query(
      `UPDATE support_tickets 
       SET status = 'answered', staff_reply = ?, replied_by = ?, replied_at = NOW(), updated_at = NOW() 
       WHERE id = ?`,
      [reply.trim(), responderId, ticketId]
    );

    // 2. Gửi thông báo đến tài khoản người dùng
    const snippet = reply.trim().length > 60 ? `${reply.trim().substring(0, 60)}...` : reply.trim();
    const notifContent = `Ban Quản Trị đã giải đáp câu hỏi "${ticket.subject}": ${snippet}`;

    try {
      const [notifResult] = await pool.query(
        `INSERT INTO notifications (user_id, actor_id, type, entity_id, content, is_read, created_at)
         VALUES (?, ?, 'support_reply', ?, ?, 0, NOW())`,
        [ticket.user_id, ticket.user_id, ticketId, notifContent]
      );
      const notifId = notifResult.insertId;
      const [[{ unread_count }]] = await pool.query(
        `SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
        [ticket.user_id]
      );

      // Bắn socket realtime chuẩn 'new_notification' (fix sai signature cũ thiếu io/event)
      const io = req.app.get('io') || req.io;
      if (io) {
        sendNotificationToUser(io, ticket.user_id, 'new_notification', {
          notification: {
            id: notifId,
            user_id: ticket.user_id,
            actor_id: ticket.user_id,
            actor_name: 'Ban Quản Trị Masita',
            actor_username: 'admin',
            actor_avatar: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=100',
            type: 'support_reply',
            entity_id: ticketId,
            content: notifContent,
            is_read: false,
            photo_thumbnail: null,
            photo_media_type: 'image',
            created_at: new Date().toISOString(),
          },
          unread_count: unread_count || 1,
        });
      }
    } catch (notifErr) {
      console.warn('Lỗi gửi thông báo giải đáp:', notifErr.message);
    }

    return res.json({
      success: true,
      message: 'Đã gửi lời giải đáp và thông báo trực tiếp đến người dùng.',
      data: {
        ticket_id: ticketId,
        status: 'answered',
        reply: reply.trim(),
        replied_at: new Date().toISOString(),
        responder_name: responderName,
      },
    });
  } catch (error) {
    console.error('Reply support ticket error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi gửi giải đáp thắc mắc.',
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  toggleUserStatus,
  banUser,
  adminResetPassword,
  getResetRequests,
  updateResetRequestStatus,
  getPosts,
  deletePost,
  streamPostVideo,
  adminLogin,
  getAdminMe,
  getStaffList,
  createStaff,
  toggleStaffStatus,
  getSupportTickets,
  replySupportTicket,
};
