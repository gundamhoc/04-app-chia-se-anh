const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { uploadFileToDrive } = require('../utils/googleDrive');
const { getIO, isUserOnline } = require('../sockets/socketHandler');
const fs = require('fs');

// ============================================================
// REGISTER
// POST /api/auth/register
// Body: { username, email, password, full_name? }
// ============================================================
const register = async (req, res) => {
  const { username, email, password, full_name } = req.body;

  // Validate input
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng điền đầy đủ username, email và password.',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Mật khẩu phải có ít nhất 6 ký tự.',
    });
  }

  try {
    // Kiểm tra username/email đã tồn tại chưa
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username hoặc email đã được sử dụng.',
      });
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES (?, ?, ?, ?)`,
      [username, email, password_hash, full_name || null]
    );

    const userId = result.insertId;

    // Tạo JWT token
    const token = generateToken({ id: userId, username, email });

    // Realtime: thông báo bảng điều khiển admin có thành viên mới
    try {
      const io = getIO();
      if (io) {
        io.to('admins').emit('admin_new_user', {
          id: userId,
          username,
          full_name: full_name || null,
          avatar_url: null,
          is_active: 1,
          created_at: new Date().toISOString(),
          is_online: isUserOnline(userId),
        });
      }
    } catch (emitErr) {
      console.error('Emit admin_new_user error:', emitErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thành công!',
      data: {
        token,
        user: {
          id: userId,
          username,
          email,
          full_name: full_name || null,
          avatar_url: null,
        },
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại.',
    });
  }
};

// ============================================================
// LOGIN
// POST /api/auth/login
// Body: { email, password }
// ============================================================
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng điền email và password.',
    });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, password_hash, full_name, avatar_url, is_active, banned_until, ban_reason FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng.',
      });
    }

    const user = rows[0];

    // Kiểm tra trạng thái khóa tài khoản
    if (!user.is_active) {
      if (user.banned_until) {
        const banExpiry = new Date(user.banned_until);
        const now = new Date();
        if (banExpiry <= now) {
          // Hạn khóa tạm thời đã hết -> tự động mở khóa lại
          await pool.query('UPDATE users SET is_active = 1, banned_until = NULL, ban_reason = NULL, updated_at = NOW() WHERE id = ?', [user.id]);
          user.is_active = 1;
        } else {
          const formattedDate = banExpiry.toLocaleString('vi-VN', {
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
          });
          const reasonText = user.ban_reason ? ` Lý do: ${user.ban_reason}.` : '';
          return res.status(403).json({
            success: false,
            message: `Tài khoản của bạn đang bị tạm khóa đến ${formattedDate}.${reasonText}`,
          });
        }
      } else {
        const reasonText = user.ban_reason ? ` Lý do: ${user.ban_reason}.` : '';
        return res.status(403).json({
          success: false,
          message: `Tài khoản của bạn đã bị khóa vĩnh viễn.${reasonText}`,
        });
      }
    }

    // So sánh password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng.',
      });
    }

    // Tạo token
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
    });

    const responseUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
    };

    if (responseUser.avatar_url && !responseUser.avatar_url.startsWith('http')) {
      const protocol = req.protocol;
      const host = req.get('host');
      responseUser.avatar_url = `${protocol}://${host}${responseUser.avatar_url}`;
    }

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      data: {
        token,
        user: responseUser,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại.',
    });
  }
};

// ============================================================
// GET PROFILE
// GET /api/auth/profile  (protected - cần JWT)
// ============================================================
const getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, avatar_url, cover_url, bio, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
      });
    }

    const user = rows[0];
    const protocol = req.protocol;
    const host = req.get('host');
    if (user.avatar_url && !user.avatar_url.startsWith('http')) {
      user.avatar_url = `${protocol}://${host}${user.avatar_url}`;
    }
    if (user.cover_url && !user.cover_url.startsWith('http')) {
      user.cover_url = `${protocol}://${host}${user.cover_url}`;
    }

    // Thống kê chỉ số hồ sơ: Posts, Friends, Likes
    const [postRows] = await pool.query(
      'SELECT COUNT(*) as count FROM photos WHERE user_id = ?',
      [req.user.id]
    );
    const [friendRows] = await pool.query(
      "SELECT COUNT(*) as count FROM friendships WHERE (requester_id = ? OR receiver_id = ?) AND status = 'accepted'",
      [req.user.id, req.user.id]
    );
    const [likeRows] = await pool.query(
      'SELECT COUNT(*) as count FROM photo_reactions pr JOIN photos p ON pr.photo_id = p.id WHERE p.user_id = ?',
      [req.user.id]
    );
    const [savedRows] = await pool.query(
      'SELECT COUNT(*) as count FROM saved_photos WHERE user_id = ?',
      [req.user.id]
    );
    const [repostRows] = await pool.query(
      'SELECT COUNT(*) as count FROM photo_reposts WHERE user_id = ?',
      [req.user.id]
    );

    user.stats = {
      posts_count: parseInt(postRows[0]?.count || 0, 10),
      friends_count: parseInt(friendRows[0]?.count || 0, 10),
      likes_count: parseInt(likeRows[0]?.count || 0, 10),
      saved_count: parseInt(savedRows[0]?.count || 0, 10),
      reposts_count: parseInt(repostRows[0]?.count || 0, 10),
    };

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('GetProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server.',
    });
  }
};

// ============================================================
// UPDATE PROFILE (Full Name & Bio)
// PUT /api/auth/profile (protected - cần JWT)
// Body: { full_name, bio }
// ============================================================
const updateProfile = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { full_name, bio } = req.body;

    const trimmedFullName = typeof full_name === 'string' ? full_name.trim().slice(0, 100) : null;
    const trimmedBio = typeof bio === 'string' ? bio.trim().slice(0, 500) : null;

    await pool.query(
      'UPDATE users SET full_name = ?, bio = ?, updated_at = NOW() WHERE id = ?',
      [trimmedFullName, trimmedBio, currentUserId]
    );

    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, avatar_url, cover_url, bio, created_at FROM users WHERE id = ?',
      [currentUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
      });
    }

    const user = rows[0];
    const protocol = req.protocol;
    const host = req.get('host');
    if (user.avatar_url && !user.avatar_url.startsWith('http')) {
      user.avatar_url = `${protocol}://${host}${user.avatar_url}`;
    }
    if (user.cover_url && !user.cover_url.startsWith('http')) {
      user.cover_url = `${protocol}://${host}${user.cover_url}`;
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin hồ sơ thành công!',
      data: { user },
    });
  } catch (error) {
    console.error('UpdateProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật hồ sơ.',
    });
  }
};

// ============================================================
// UPDATE AVATAR
// PUT /api/auth/avatar  (protected - cần JWT + Multer)
// ============================================================
const updateAvatar = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng chọn file ảnh.',
    });
  }

  try {
    let avatarUrl = `/uploads/${req.file.filename}`;

    try {
      const driveResult = await uploadFileToDrive(req.file.path, req.file.mimetype, req.file.filename);
      if (driveResult && driveResult.directUrl) {
        avatarUrl = driveResult.directUrl;
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      }
    } catch (driveErr) {
      console.warn('⚠️ Gặp sự cố upload Google Drive cho avatar, fallback sang lưu nội bộ:', driveErr.message);
    }

    await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [
      avatarUrl,
      req.user.id,
    ]);

    const protocol = req.protocol;
    const host = req.get('host');
    const finalAvatarUrl = avatarUrl.startsWith('http') ? avatarUrl : `${protocol}://${host}${avatarUrl}`;

    return res.status(200).json({
      success: true,
      message: 'Cập nhật ảnh đại diện thành công!',
      data: { avatar_url: finalAvatarUrl },
    });
  } catch (error) {
    console.error('UpdateAvatar error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server.',
    });
  }
};

// ============================================================
// UPDATE COVER BANNER
// PUT /api/auth/cover  (protected - cần JWT + Multer)
// ============================================================
const updateCover = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng chọn file ảnh bìa.',
    });
  }

  try {
    let coverUrl = `/uploads/${req.file.filename}`;

    try {
      const driveResult = await uploadFileToDrive(req.file.path, req.file.mimetype, req.file.filename);
      if (driveResult && driveResult.directUrl) {
        coverUrl = driveResult.directUrl;
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      }
    } catch (driveErr) {
      console.warn('⚠️ Gặp sự cố upload Google Drive cho ảnh bìa, fallback sang lưu nội bộ:', driveErr.message);
    }

    await pool.query('UPDATE users SET cover_url = ? WHERE id = ?', [
      coverUrl,
      req.user.id,
    ]);

    const protocol = req.protocol;
    const host = req.get('host');
    const finalCoverUrl = coverUrl.startsWith('http') ? coverUrl : `${protocol}://${host}${coverUrl}`;

    return res.status(200).json({
      success: true,
      message: 'Cập nhật ảnh bìa thành công!',
      data: { cover_url: finalCoverUrl },
    });
  } catch (error) {
    console.error('UpdateCover error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật ảnh bìa.',
    });
  }
};

// ============================================================
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// Body: { email }
// ============================================================
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập địa chỉ gmail của bạn.',
    });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Kiểm tra email có tồn tại trong database (bảng users) hay không
    const [users] = await pool.query(
      'SELECT id, username, email, full_name FROM users WHERE LOWER(email) = ?',
      [cleanEmail]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Gmail đó không có trong hệ thống.',
      });
    }

    const user = users[0];

    // 2. Lưu lại thông tin yêu cầu của người dùng
    await pool.query(
      'INSERT INTO password_reset_requests (user_id, email, status) VALUES (?, ?, ?)',
      [user.id, user.email, 'pending']
    );

    return res.status(200).json({
      success: true,
      message: 'Đã lưu lại thông tin, admin sẽ gửi mã cho bạn!',
      data: {
        email: user.email,
        full_name: user.full_name,
      },
    });
  } catch (error) {
    console.error('ForgotPassword error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xử lý yêu cầu quên mật khẩu.',
    });
  }
};

/**
 * 6. Cập nhật Username
 * PUT /api/auth/username (protected - cần JWT)
 * Body: { username }
 */
const updateUsername = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    let { username } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp username hợp lệ.',
      });
    }

    username = username.trim();

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Username phải từ 3 đến 30 ký tự.',
      });
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username chỉ được chứa chữ cái, số và dấu gạch dưới (_).',
      });
    }

    // Kiểm tra xem username đã có người dùng khác sử dụng chưa
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [username, currentUserId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username này đã được sử dụng bởi người khác.',
      });
    }

    await pool.query('UPDATE users SET username = ? WHERE id = ?', [username, currentUserId]);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật username thành công!',
      data: { username },
    });
  } catch (error) {
    console.error('UpdateUsername error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật username.',
    });
  }
};

/**
 * 7. Cập nhật Email đăng ký (Yêu cầu nhập đúng mật khẩu hiện tại)
 * PUT /api/auth/email (protected - cần JWT)
 * Body: { email, password }
 */
const updateEmail = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email mới và mật khẩu hiện tại để xác thực.',
      });
    }

    email = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng email không hợp lệ.',
      });
    }

    // Lấy thông tin user hiện tại
    const [users] = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE id = ?',
      [currentUserId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
      });
    }

    const currentUser = users[0];

    // Xác thực mật khẩu đúng mới cho đổi email
    const isMatch = await bcrypt.compare(password, currentUser.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu không chính xác. Bạn phải nhập đúng mật khẩu để đổi email.',
      });
    }

    if (currentUser.email && currentUser.email.toLowerCase() === email) {
      return res.status(400).json({
        success: false,
        message: 'Email mới phải khác với email đăng ký hiện tại.',
      });
    }

    // Kiểm tra xem email mới đã được tài khoản khác sử dụng chưa
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, currentUserId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email này đã được sử dụng bởi tài khoản khác.',
      });
    }

    await pool.query('UPDATE users SET email = ? WHERE id = ?', [email, currentUserId]);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật email đăng ký thành công!',
      data: { email },
    });
  } catch (error) {
    console.error('UpdateEmail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật email.',
    });
  }
};

/**
 * 8. Đổi Mật Khẩu (Yêu cầu nhập đúng email đăng ký)
 * PUT /api/auth/change-password (protected - cần JWT)
 * Body: { email, new_password }
 */
const changePassword = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    let { email, new_password } = req.body;

    if (!email || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email đăng ký và mật khẩu mới.',
      });
    }

    email = email.trim().toLowerCase();

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
      });
    }

    // Lấy thông tin user hiện tại
    const [users] = await pool.query(
      'SELECT id, email FROM users WHERE id = ?',
      [currentUserId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
      });
    }

    const currentUser = users[0];

    // Xác thực: trong mật khẩu phải nhập đúng email mới cho đổi mật khẩu
    if (!currentUser.email || currentUser.email.toLowerCase() !== email) {
      return res.status(400).json({
        success: false,
        message: 'Email không khớp với email đăng ký của tài khoản này.',
      });
    }

    const saltRounds = 12;
    const password_hash = await bcrypt.hash(new_password, saltRounds);

    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
      password_hash,
      currentUserId,
    ]);

    return res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công!',
    });
  } catch (error) {
    console.error('ChangePassword error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đổi mật khẩu.',
    });
  }
};

/**
 * 9. Lấy cài đặt quyền riêng tư
 * GET /api/auth/privacy-settings (protected - cần JWT)
 */
const getPrivacySettings = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      `SELECT is_private_account, allow_suggest_account, searchable_by_name, searchable_by_username, searchable_by_email 
       FROM users WHERE id = ?`,
      [currentUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
      });
    }

    const row = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        is_private_account: Boolean(row.is_private_account),
        allow_suggest_account: Boolean(row.allow_suggest_account),
        searchable_by_name: Boolean(row.searchable_by_name),
        searchable_by_username: Boolean(row.searchable_by_username),
        searchable_by_email: Boolean(row.searchable_by_email),
      },
    });
  } catch (error) {
    console.error('GetPrivacySettings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy cài đặt quyền riêng tư.',
    });
  }
};

/**
 * 10. Cập nhật cài đặt quyền riêng tư
 * PUT /api/auth/privacy-settings (protected - cần JWT)
 * Body: { is_private_account?, allow_suggest_account?, searchable_by_name?, searchable_by_username?, searchable_by_email? }
 */
const updatePrivacySettings = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const {
      is_private_account,
      allow_suggest_account,
      searchable_by_name,
      searchable_by_username,
      searchable_by_email,
    } = req.body;

    const updates = [];
    const values = [];

    if (typeof is_private_account === 'boolean') {
      updates.push('is_private_account = ?');
      values.push(is_private_account ? 1 : 0);
    }
    if (typeof allow_suggest_account === 'boolean') {
      updates.push('allow_suggest_account = ?');
      values.push(allow_suggest_account ? 1 : 0);
    }
    if (typeof searchable_by_name === 'boolean') {
      updates.push('searchable_by_name = ?');
      values.push(searchable_by_name ? 1 : 0);
    }
    if (typeof searchable_by_username === 'boolean') {
      updates.push('searchable_by_username = ?');
      values.push(searchable_by_username ? 1 : 0);
    }
    if (typeof searchable_by_email === 'boolean') {
      updates.push('searchable_by_email = ?');
      values.push(searchable_by_email ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có trường cài đặt quyền riêng tư nào được cập nhật.',
      });
    }

    values.push(currentUserId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    // Lấy lại cài đặt đã cập nhật
    const [rows] = await pool.query(
      `SELECT is_private_account, allow_suggest_account, searchable_by_name, searchable_by_username, searchable_by_email 
       FROM users WHERE id = ?`,
      [currentUserId]
    );
    const row = rows[0];

    return res.status(200).json({
      success: true,
      message: 'Cập nhật cài đặt quyền riêng tư thành công!',
      data: {
        is_private_account: Boolean(row.is_private_account),
        allow_suggest_account: Boolean(row.allow_suggest_account),
        searchable_by_name: Boolean(row.searchable_by_name),
        searchable_by_username: Boolean(row.searchable_by_username),
        searchable_by_email: Boolean(row.searchable_by_email),
      },
    });
  } catch (error) {
    console.error('UpdatePrivacySettings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật cài đặt quyền riêng tư.',
    });
  }
};

// ============================================================
// GET SECURITY STATUS
// GET /api/auth/security-status (protected)
// ============================================================
const getSecurityStatus = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      `SELECT created_at, last_password_changed, two_factor_enabled, remember_login FROM users WHERE id = ?`,
      [currentUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const user = rows[0];

    // Đếm số phiên đang hoạt động
    const [sessionRows] = await pool.query(
      `SELECT COUNT(*) as count FROM login_sessions WHERE user_id = ? AND is_active = 1`,
      [currentUserId]
    );

    const activeSessionCount = sessionRows[0].count;

    return res.json({
      success: true,
      data: {
        created_at: user.created_at,
        last_password_changed: user.last_password_changed,
        two_factor_enabled: Boolean(user.two_factor_enabled),
        remember_login: Boolean(user.remember_login),
        active_session_count: activeSessionCount,
      },
    });
  } catch (error) {
    console.error('GetSecurityStatus error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy trạng thái bảo mật.' });
  }
};

// ============================================================
// TOGGLE TWO FACTOR
// PUT /api/auth/two-factor (protected)
// Body: { enabled: boolean }
// ============================================================
const toggleTwoFactor = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Giá trị enabled phải là boolean.' });
    }

    await pool.query(`UPDATE users SET two_factor_enabled = ? WHERE id = ?`, [enabled ? 1 : 0, currentUserId]);

    return res.json({
      success: true,
      message: enabled ? 'Đã bật xác minh 2 bước! 🔐' : 'Đã tắt xác minh 2 bước.',
      data: { two_factor_enabled: enabled },
    });
  } catch (error) {
    console.error('ToggleTwoFactor error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật 2FA.' });
  }
};

// ============================================================
// TOGGLE REMEMBER LOGIN
// PUT /api/auth/remember-login (protected)
// Body: { enabled: boolean }
// ============================================================
const toggleRememberLogin = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Giá trị enabled phải là boolean.' });
    }

    await pool.query(`UPDATE users SET remember_login = ? WHERE id = ?`, [enabled ? 1 : 0, currentUserId]);

    return res.json({
      success: true,
      message: enabled ? 'Đã bật lưu thông tin đăng nhập.' : 'Đã tắt lưu thông tin đăng nhập.',
      data: { remember_login: enabled },
    });
  } catch (error) {
    console.error('ToggleRememberLogin error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật cài đặt đăng nhập.' });
  }
};

// ============================================================
// GET LOGIN SESSIONS
// GET /api/auth/sessions (protected)
// ============================================================
const getLoginSessions = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      `SELECT id, device_name, ip_address, last_active, created_at, is_active
       FROM login_sessions
       WHERE user_id = ? AND is_active = 1
       ORDER BY last_active DESC
       LIMIT 20`,
      [currentUserId]
    );

    return res.json({
      success: true,
      message: 'Lấy danh sách phiên đăng nhập thành công.',
      data: rows,
    });
  } catch (error) {
    console.error('GetLoginSessions error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách phiên đăng nhập.' });
  }
};

// ============================================================
// REVOKE SESSION
// DELETE /api/auth/sessions/:id (protected)
// ============================================================
const revokeSession = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const sessionId = parseInt(req.params.id, 10);

    if (!sessionId || isNaN(sessionId)) {
      return res.status(400).json({ success: false, message: 'ID phiên không hợp lệ.' });
    }

    // Kiểm tra phiên thuộc về user hiện tại
    const [rows] = await pool.query(
      `SELECT id FROM login_sessions WHERE id = ? AND user_id = ? AND is_active = 1`,
      [sessionId, currentUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên đăng nhập này.' });
    }

    await pool.query(`UPDATE login_sessions SET is_active = 0 WHERE id = ?`, [sessionId]);

    return res.json({
      success: true,
      message: 'Đã đăng xuất thiết bị này thành công.',
    });
  } catch (error) {
    console.error('RevokeSession error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thu hồi phiên đăng nhập.' });
  }
};

// ============================================================
// DELETE ACCOUNT
// DELETE /api/auth/account (protected)
// Body: { email, password }
// ============================================================
const deleteAccount = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email và mật khẩu để xác nhận xóa tài khoản.',
      });
    }

    // Lấy thông tin user để xác minh
    const [rows] = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE id = ? AND is_active = 1',
      [currentUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
    }

    const user = rows[0];

    // Kiểm tra email khớp
    if (user.email.toLowerCase() !== email.trim().toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: 'Email xác nhận không khớp với tài khoản này.',
      });
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Mật khẩu xác nhận không đúng.',
      });
    }

    // Soft delete: set is_active = 0
    await pool.query(`UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?`, [currentUserId]);

    // Thu hồi tất cả phiên đăng nhập
    await pool.query(`UPDATE login_sessions SET is_active = 0 WHERE user_id = ?`, [currentUserId]);

    return res.json({
      success: true,
      message: 'Tài khoản của bạn đã được xóa thành công. Tạm biệt! 👋',
    });
  } catch (error) {
    console.error('DeleteAccount error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa tài khoản.' });
  }
};

// ============================================================
// GENERATE OTP (Giả lập 2FA — OTP trả về ngay trong response)
// POST /api/auth/generate-otp (protected)
// ============================================================
const generateOtp = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Kiểm tra user có bật 2FA không
    const [rows] = await pool.query(
      'SELECT two_factor_enabled, email FROM users WHERE id = ? AND is_active = 1',
      [currentUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
    }

    // Tạo OTP 6 chữ số ngẫu nhiên
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu OTP vào DB với thời hạn 5 phút (dùng một trường tạm)
    // Vì là giả lập, ta trả về OTP thẳng trong response
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    return res.json({
      success: true,
      message: `Mã OTP đã được tạo (Demo: ${otp}). Hiệu lực 5 phút.`,
      data: {
        otp, // Giả lập: trả về thẳng trong app thay vì gửi email
        expires_at: expiresAt,
        email: rows[0].email,
      },
    });
  } catch (error) {
    console.error('GenerateOTP error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo OTP.' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  updateAvatar,
  updateCover,
  forgotPassword,
  updateUsername,
  updateEmail,
  changePassword,
  getPrivacySettings,
  updatePrivacySettings,
  getSecurityStatus,
  toggleTwoFactor,
  toggleRememberLogin,
  getLoginSessions,
  revokeSession,
  deleteAccount,
  generateOtp,
};
