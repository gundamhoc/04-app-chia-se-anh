const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/adminController');

const {
  verifyAdminToken,
  requireAdmin,
  requireStaffOrAdmin,
} = require('../middlewares/adminAuth');

// 1. Xác thực Quản trị / Nhân viên
router.post('/auth/login', adminLogin);
router.get('/auth/me', verifyAdminToken, getAdminMe);

// 2. Thống kê tổng quan
router.get('/stats', getDashboardStats);

// 3. Quản lý Nhân viên (Chỉ Admin tối cao)
router.get('/staff', verifyAdminToken, requireAdmin, getStaffList);
router.post('/staff', verifyAdminToken, requireAdmin, createStaff);
router.put('/staff/:id', verifyAdminToken, requireAdmin, toggleStaffStatus);

// 4. Quản lý người dùng
router.get('/users', getUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.put('/users/:id/status', toggleUserStatus);
router.put('/users/:id/ban', banUser);
router.put('/users/:id/reset-password', adminResetPassword);
router.post('/users/:id/reset-password', adminResetPassword);

// 5. Quản lý yêu cầu cấp lại mật khẩu
router.get('/reset-requests', getResetRequests);
router.put('/reset-requests/:id', updateResetRequestStatus);
router.put('/reset-requests/:id/status', updateResetRequestStatus);

// 6. Kiểm duyệt bài viết & phát luồng video
router.get('/posts', getPosts);
router.get('/posts/:id/stream', streamPostVideo);
router.get('/posts/:id/video', streamPostVideo);
router.delete('/posts/:id', deletePost);

// 7. Quản lý & Giải đáp thắc mắc người dùng (Support Tickets)
router.get('/support-tickets', verifyAdminToken, requireStaffOrAdmin, getSupportTickets);
router.put('/support-tickets/:id/reply', verifyAdminToken, requireStaffOrAdmin, replySupportTicket);

module.exports = router;
