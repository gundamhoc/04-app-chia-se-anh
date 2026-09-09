const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const { createTicket, getMyTickets } = require('../controllers/supportController');

// Tất cả các route yêu cầu đăng nhập ứng dụng
router.use(authMiddleware);

// Gửi thắc mắc mới
router.post('/tickets', createTicket);

// Lịch sử thắc mắc của tôi
router.get('/tickets/my', getMyTickets);

module.exports = router;
