const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
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
        users: { 
          total: usersCount, 
          active: activeUsersCount, 
          online: onlineUsersCount 
        },
        posts: { total: postsCount, photos: photosCount, videos: videosCount },
        interactions: { reactions: reactionsCount, comments: commentsCount },
        pending_resets: pendingResetsCount,
        recent_users: recentUsersWithPresence,
        recent_posts: recentPosts,
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

    return res.json({
      success: true,
      message: 'Lấy danh sách bài đăng thành công.',
      data: posts,
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
      await pool.query(
        `INSERT INTO notifications (user_id, actor_id, type, entity_id, content, is_read, created_at)
         VALUES (?, ?, 'post_deleted', 0, ?, 0, NOW())`,
        [post.user_id, post.user_id, notifContent]
      );
    } catch (notifErr) {
      console.warn('⚠️ Could not insert notification for post deletion:', notifErr.message);
    }

    // 3. Gửi sự kiện realtime qua Socket.io nếu tác giả đang online
    const io = req.app.get('io') || req.io;
    if (io) {
      sendNotificationToUser(io, post.user_id, 'notification', {
        type: 'post_deleted',
        title: 'Bài viết đã bị gỡ bỏ',
        message: notifContent,
        reason: deleteReason,
        postId,
        created_at: new Date().toISOString(),
      });
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
};
