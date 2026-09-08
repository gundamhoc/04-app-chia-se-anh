const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectOrCancelRequest,
  getFriendsList,
  getPendingRequests,
  getSuggestions,
  getUserProfile,
} = require('../controllers/friendController');

// Tất cả các route kết bạn đều yêu cầu JWT auth
router.use(authMiddleware);

// 0. Xem thông tin trang cá nhân người khác
router.get('/profile/:id', getUserProfile);

// 1. Tìm kiếm người dùng theo keyword
router.get('/search', searchUsers);

// 2. Lấy danh sách bạn bè đã kết bạn
router.get('/list', getFriendsList);

// 3. Lấy danh sách lời mời kết bạn đang chờ nhận được
router.get('/requests', getPendingRequests);

// 4. Lấy danh sách gợi ý kết bạn
router.get('/suggestions', getSuggestions);

// 5. Gửi lời mời kết bạn
router.post('/request', sendFriendRequest);

// 6. Chấp nhận lời mời kết bạn
router.post('/accept', acceptFriendRequest);

// 7. Từ chối lời mời / Hủy lời mời đã gửi / Hủy kết bạn
router.post('/reject', rejectOrCancelRequest);

module.exports = router;
