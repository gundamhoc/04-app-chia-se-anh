const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { uploadFileToDrive } = require('../utils/googleDrive');
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
      'SELECT id, username, email, password_hash, full_name, avatar_url, is_active FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng.',
      });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị vô hiệu hóa.',
      });
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
      'SELECT id, username, email, full_name, avatar_url, bio, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
      });
    }

    const user = rows[0];
    if (user.avatar_url && !user.avatar_url.startsWith('http')) {
      const protocol = req.protocol;
      const host = req.get('host');
      user.avatar_url = `${protocol}://${host}${user.avatar_url}`;
    }

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

module.exports = { register, login, getProfile, updateAvatar };
