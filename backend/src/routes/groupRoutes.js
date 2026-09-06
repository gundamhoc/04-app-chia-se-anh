const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const { handleUploadSingle, handleUploadAnyFile } = require('../middlewares/upload');
const {
  createGroup,
  getMyGroups,
  getGroupDetail,
  updateGroup,
  addMembers,
  removeMember,
  getGroupMessages,
  sendGroupMessage,
  sendGroupImageMessage,
  sendGroupFileMessage,
  togglePinGroup,
  toggleMuteGroup,
  searchGroupMessages,
} = require('../controllers/groupController');

// Tất cả route nhóm đều yêu cầu đăng nhập
router.use(authMiddleware);

// 1. Tạo nhóm mới & lấy danh sách nhóm
router.post('/', handleUploadSingle, createGroup);
router.get('/', getMyGroups);

// 2. Tìm kiếm tin nhắn trong nhóm
router.get('/:id/search', searchGroupMessages);

// 3. Chi tiết nhóm & cập nhật nhóm
router.get('/:id', getGroupDetail);
router.put('/:id', handleUploadSingle, updateGroup);

// 4. Quản lý thành viên nhóm
router.post('/:id/members', addMembers);
router.delete('/:id/members/:userId', removeMember);

// 5. Tin nhắn nhóm
router.get('/:id/messages', getGroupMessages);
router.post('/:id/messages', sendGroupMessage);
router.post('/:id/upload-image', handleUploadSingle, sendGroupImageMessage);
router.post('/:id/upload-file', handleUploadAnyFile, sendGroupFileMessage);

// 6. Ghim nhóm & Bật/Tắt thông báo nhóm
router.put('/:id/pin', togglePinGroup);
router.put('/:id/mute', toggleMuteGroup);

module.exports = router;
