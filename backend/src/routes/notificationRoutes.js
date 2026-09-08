const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middlewares/auth');

// Tất cả route thông báo đều yêu cầu đăng nhập
router.use(authMiddleware);

// 1. Lấy danh sách thông báo
router.get('/', notificationController.getNotifications);

// 2. Lấy số lượng thông báo chưa đọc
router.get('/unread-count', notificationController.getUnreadCount);

// 3. Đánh dấu tất cả thông báo đã đọc (hỗ trợ cả /read-all và /mark-all-read)
router.put('/read-all', notificationController.markAllAsRead);
router.put('/mark-all-read', notificationController.markAllAsRead);

// 4. Đánh dấu 1 thông báo đã đọc
router.put('/:id/read', notificationController.markAsRead);

// 5. Xóa 1 thông báo
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
