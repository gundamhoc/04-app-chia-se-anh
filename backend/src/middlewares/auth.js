const { verifyToken } = require('../utils/jwt');

/**
 * Middleware xác thực JWT
 * Gắn thông tin user vào req.user nếu token hợp lệ
 */
const authMiddleware = (req, res, next) => {
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

    req.user = decoded; // { id, username, email, iat, exp }
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
