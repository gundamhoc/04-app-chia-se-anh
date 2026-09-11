const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/db');

/**
 * Middleware xác thực tài khoản Quản trị / Nhân viên qua JWT token
 * Gắn thông tin tài khoản vào req.admin: { id, username, full_name, email, role }
 */
const verifyAdminToken = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập quản trị viên hoặc nhân viên để tiếp tục.',
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
      });
    }

    // Token PHẢI là token Quản Trị (có admin_id) — chặn token người dùng thông thường
    if (!decoded.admin_id) {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ cho hệ thống quản trị.',
      });
    }

    // Tra cứu tài khoản trong bảng admin_users
    const adminId = decoded.admin_id;
    const [rows] = await pool.query(
      'SELECT id, username, full_name, email, role, is_active FROM admin_users WHERE id = ?',
      [adminId]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản quản trị không tồn tại hoặc đã bị gỡ bỏ.',
      });
    }

    const adminUser = rows[0];
    if (adminUser.is_active === 0) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa hoặc tạm dừng quyền truy cập.',
      });
    }

    req.admin = {
      id: adminUser.id,
      username: adminUser.username,
      full_name: adminUser.full_name,
      email: adminUser.email,
      role: adminUser.role, // 'admin' | 'staff'
    };

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xác thực quyền quản trị.',
    });
  }
};

/**
 * Middleware bắt buộc vai trò Admin tối cao (role === 'admin')
 * Dùng cho các thao tác nhạy cảm: quản lý nhân viên, cấu hình hệ thống, v.v.
 */
const requireAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Thao tác này chỉ dành riêng cho Quản trị viên tối cao (Admin).',
    });
  }
  next();
};

/**
 * Middleware cho phép cả Quản trị viên và Nhân viên (role === 'admin' || role === 'staff')
 */
const requireStaffOrAdmin = (req, res, next) => {
  if (!req.admin || (req.admin.role !== 'admin' && req.admin.role !== 'staff')) {
    return res.status(403).json({
      success: false,
      message: 'Yêu cầu quyền Nhân viên hoặc Quản trị viên để thực hiện.',
    });
  }
  next();
};

module.exports = {
  verifyAdminToken,
  requireAdmin,
  requireStaffOrAdmin,
};
