const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const { handleUploadSingle } = require('../middlewares/upload');
const {
  uploadPhoto,
  getPhotoFeed,
  getMyPhotos,
  getLikedPhotos,
  getSavedPhotos,
  toggleSavePhoto,
  getRepostedPhotos,
  toggleRepost,
  toggleReaction,
  deletePhoto,
  updatePhoto,
  getDriveImage,
} = require('../controllers/photoController');
const {
  getComments,
  createComment,
  deleteComment,
  toggleCommentReaction,
} = require('../controllers/commentController');

// Phục vụ ảnh Google Drive trực tiếp (public endpoint cho thẻ <Image /> / <img> không cần JWT header)
router.get('/drive/:fileId', getDriveImage);

// Tất cả các route bên dưới đều yêu cầu xác thực JWT
router.use(authMiddleware);

// 1. Lấy Bảng tin Locket Feed & Ảnh cá nhân / Lưu / Đăng lại
router.get('/feed', getPhotoFeed);
router.get('/me', getMyPhotos);
router.get('/liked', getLikedPhotos);
router.get('/saved', getSavedPhotos);
router.get('/reposts', getRepostedPhotos);

// 2. Upload ảnh mới (Multer single 'image')
router.post('/upload', handleUploadSingle, uploadPhoto);

// 3. Thả / bỏ thả biểu tượng cảm xúc bài viết & Lưu / Đăng lại
router.post('/:id/react', toggleReaction);
router.post('/:id/save', toggleSavePhoto);
router.post('/:id/repost', toggleRepost);

// 4. Chỉnh sửa & Xóa ảnh
router.put('/:id', updatePhoto);
router.delete('/:id', deletePhoto);

// 5. Bình luận & Thả cảm xúc bình luận
router.get('/:id/comments', getComments);
router.post('/:id/comments', createComment);
router.delete('/comments/:commentId', deleteComment);
router.post('/comments/:commentId/react', toggleCommentReaction);

module.exports = router;
