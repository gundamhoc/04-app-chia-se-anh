const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/db');

/**
 * Middleware xác thực JWT & kiểm tra trạng thái tài khoản (Khóa / Ban / Xóa)
 * Gắn thông tin user vào req.user nếu token hợp lệ và tài khoản đang hoạt động
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Không tìm thấy token xác thực. Vui lòng đăng nhập.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Kiểm tra trạng thái tài khoản trong DB (đặc biệt khi bị ban/khóa)
    const [rows] = await pool.query(
      'SELECT id, username, email, is_active, banned_until, ban_reason FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc đã bị xóa.',
      });
    }

    const user = rows[0];

    // Xử lý khi tài khoản đang bị khóa (is_active = 0)
    if (user.is_active === 0) {
      if (user.banned_until) {
        const banExpiry = new Date(user.banned_until);
        const now = new Date();
        if (now >= banExpiry) {
          // Khóa tạm thời đã hết hạn -> Tự động phục hồi
          await pool.query('UPDATE users SET is_active = 1, banned_until = NULL, ban_reason = NULL WHERE id = ?', [user.id]);
          user.is_active = 1;
        } else {
          const reasonMsg = user.ban_reason ? ` Lý do: ${user.ban_reason}` : '';
          return res.status(403).json({
            success: false,
            banned: true,
            banned_until: user.banned_until,
            reason: user.ban_reason,
            message: `Tài khoản của bạn đã bị khóa đến ${banExpiry.toLocaleString('vi-VN')}.${reasonMsg}`,
          });
        }
      } else {
        const reasonMsg = user.ban_reason ? ` Lý do: ${user.ban_reason}` : '';
        return res.status(403).json({
          success: false,
          banned: true,
          banned_until: null,
          reason: user.ban_reason,
          message: `Tài khoản của bạn đã bị khóa vĩnh viễn bởi quản trị viên.${reasonMsg}`,
        });
      }
    }

    req.user = {
      ...decoded,
      is_active: user.is_active,
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ.',
    });
  }
};

module.exports = { authMiddleware };

