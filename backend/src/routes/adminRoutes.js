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

// 1. Xác thực Quản Trị / Nhân Viên (DUY NHẤT route public)
router.post('/auth/login', adminLogin);

// MỌI route bên dưới yêu cầu token Quản Trị / Nhân Viên
// (verifyAdminToken hỗ trợ ?token= query cho thẻ <video> stream)
router.use(verifyAdminToken);
router.use(requireStaffOrAdmin);

// 2. Thông tin admin hiện tại
router.get('/auth/me', getAdminMe);

// 3. Thống kê tổng quan
router.get('/stats', getDashboardStats);

// 4. Quản lý Nhân viên (Chỉ Admin tối cao)
router.get('/staff', requireAdmin, getStaffList);
router.post('/staff', requireAdmin, createStaff);
router.put('/staff/:id', requireAdmin, toggleStaffStatus);

// 5. Quản lý người dùng
router.get('/users', getUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.put('/users/:id/status', toggleUserStatus);
router.put('/users/:id/ban', banUser);
router.put('/users/:id/reset-password', adminResetPassword);
router.post('/users/:id/reset-password', adminResetPassword);

// 6. Quản lý yêu cầu cấp lại mật khẩu
router.get('/reset-requests', getResetRequests);
router.put('/reset-requests/:id', updateResetRequestStatus);
router.put('/reset-requests/:id/status', updateResetRequestStatus);

// 7. Kiểm duyệt bài viết & phát luồng video
router.get('/posts', getPosts);
router.get('/posts/:id/stream', streamPostVideo);
router.get('/posts/:id/video', streamPostVideo);
router.delete('/posts/:id', deletePost);

// 8. Quản lý & Giải đáp thắc mắc người dùng (Support Tickets)
router.get('/support-tickets', getSupportTickets);
router.put('/support-tickets/:id/reply', replySupportTicket);

module.exports = router;
