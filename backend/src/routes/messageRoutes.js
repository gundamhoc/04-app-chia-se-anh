const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const { handleUploadSingle, handleUploadAnyFile } = require('../middlewares/upload');
const {
  getConversations,
  getMessages,
  sendMessage,
  sendImageMessage,
  sendFileMessage,
  getFileContent,
  markMessagesAsRead,
  downloadMessageFile,
  streamMessageVideo,
  updateDirectTheme,
  togglePinDirectChat,
  toggleMuteDirectChat,
  searchDirectMessages,
} = require('../controllers/messageController');

// Route stream video chuẩn HTTP 206 Range Request (xác thực qua token query hoặc Bearer)
router.get('/video-stream/:messageId', streamMessageVideo);

// Tất cả các route còn lại yêu cầu xác thực JWT
router.use(authMiddleware);

// Route tải tệp tin đính kèm (YÊU CẦU đăng nhập + là người gửi/người nhận/thành viên nhóm)
router.get('/download/:messageId', downloadMessageFile);

// 1. Lấy danh sách cuộc hội thoại gần nhất
router.get('/conversations', getConversations);

// 2. Đọc nội dung tệp tin văn bản / code
router.get('/file-content/:messageId', getFileContent);

// 3. Tìm kiếm tin nhắn 1-1 theo từ khóa
router.get('/:friendId/search', searchDirectMessages);

// 4. Lấy lịch sử chat với bạn bè
router.get('/:friendId', getMessages);

// 5. Gửi tin nhắn văn bản
router.post('/', sendMessage);

// 6. Gửi tin nhắn đính kèm hình ảnh
router.post('/upload-image', handleUploadSingle, sendImageMessage);

// 7. Gửi tin nhắn đính kèm tệp tin bất kỳ (code, text, pdf, zip, docx...)
router.post('/upload-file', handleUploadAnyFile, sendFileMessage);

// 8. Đánh dấu đã đọc tin nhắn
router.put('/:friendId/read', markMessagesAsRead);

// 9. Cập nhật Theme / Hình nền trò chuyện 1-1
router.put('/:friendId/theme', handleUploadSingle, updateDirectTheme);

// 10. Ghim / Bỏ ghim cuộc trò chuyện 1-1
router.put('/:friendId/pin', togglePinDirectChat);

// 11. Bật / Tắt thông báo cuộc trò chuyện 1-1
router.put('/:friendId/mute', toggleMuteDirectChat);

module.exports = router;
