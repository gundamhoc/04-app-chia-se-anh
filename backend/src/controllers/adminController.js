const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

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
      SELECT id, username, email, full_name, avatar_url, is_active, created_at
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

    return res.json({
      success: true,
      message: 'Lấy thống kê hệ thống thành công.',
      data: {
        total_users: usersCount,
        active_users: activeUsersCount,
        total_posts: postsCount,
        total_photos: photosCount,
        total_videos: videosCount,
        total_reactions: reactionsCount,
        total_comments: commentsCount,
        pending_reset_requests: pendingResetsCount,
        users: { total: usersCount, active: activeUsersCount },
        posts: { total: postsCount, photos: photosCount, videos: videosCount },
        interactions: { reactions: reactionsCount, comments: commentsCount },
        pending_resets: pendingResetsCount,
        recent_users: recentUsers,
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

    return res.json({
      success: true,
      message: 'Lấy danh sách người dùng thành công.',
      data: users,
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
 * 3. Khóa / Mở khóa tài khoản người dùng
 * PUT /api/admin/users/:id/toggle-status
 */
const toggleUserStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'ID người dùng không hợp lệ.' });
    }

    const [users] = await pool.query('SELECT id, username, is_active FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const newStatus = (req.body && req.body.is_active !== undefined)
      ? (Number(req.body.is_active) === 1 ? 1 : 0)
      : (users[0].is_active ? 0 : 1);
    await pool.query('UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?', [newStatus, userId]);

    return res.json({
      success: true,
      message: newStatus === 1 ? 'Đã kích hoạt lại tài khoản thành công.' : 'Đã khóa tài khoản người dùng thành công.',
      data: { id: userId, is_active: newStatus },
    });
  } catch (error) {
    console.error('Admin toggle user status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi thay đổi trạng thái tài khoản.',
    });
  }
};

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
const deletePost = async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ success: false, message: 'ID bài viết không hợp lệ.' });
    }

    const [existing] = await pool.query('SELECT id FROM photos WHERE id = ?', [postId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    await pool.query('DELETE FROM photos WHERE id = ?', [postId]);

    return res.json({
      success: true,
      message: 'Đã xóa bài viết vi phạm thành công.',
      data: { id: postId },
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
  adminResetPassword,
  getResetRequests,
  updateResetRequestStatus,
  getPosts,
  deletePost,
};
