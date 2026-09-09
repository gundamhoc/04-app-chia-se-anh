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
} = require('../controllers/adminController');

// Thống kê tổng quan
router.get('/stats', getDashboardStats);

// Quản lý người dùng
router.get('/users', getUsers);
router.put('/users/:id/toggle-status', toggleUserStatus);
router.put('/users/:id/status', toggleUserStatus);
router.put('/users/:id/ban', banUser);
router.put('/users/:id/reset-password', adminResetPassword);
router.post('/users/:id/reset-password', adminResetPassword);

// Quản lý yêu cầu cấp lại mật khẩu
router.get('/reset-requests', getResetRequests);
router.put('/reset-requests/:id', updateResetRequestStatus);
router.put('/reset-requests/:id/status', updateResetRequestStatus);

// Kiểm duyệt bài viết & phát luồng video
router.get('/posts', getPosts);
router.get('/posts/:id/stream', streamPostVideo);
router.get('/posts/:id/video', streamPostVideo);
router.delete('/posts/:id', deletePost);

module.exports = router;
