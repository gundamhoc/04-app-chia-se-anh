const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const { handleUploadSingle, handleUploadPostVideo } = require('../middlewares/upload');
const {
  uploadPhoto,
  uploadVideoPost,
  getPhotoFeed,
  getMyPhotos,
  getLikedPhotos,
  getSavedPhotos,
  toggleSavePhoto,
  getRepostedPhotos,
  toggleRepost,
  toggleReaction,
  getPhotoReactions,
  deletePhoto,
  updatePhoto,
  getDriveImage,
  streamPhotoVideo,
} = require('../controllers/photoController');
const {
  getComments,
  createComment,
  deleteComment,
  toggleCommentReaction,
} = require('../controllers/commentController');

// Phục vụ ảnh Google Drive trực tiếp (public endpoint cho thẻ <Image /> / <img> không cần JWT header)
router.get('/drive/:fileId', getDriveImage);

// Phục vụ stream video bài viết chuẩn HTTP 206 (xác thực qua token query hoặc Bearer)
router.get('/video-stream/:photoId', streamPhotoVideo);

// Tất cả các route bên dưới đều yêu cầu xác thực JWT
router.use(authMiddleware);

// 1. Lấy Bảng tin Locket Feed & Ảnh cá nhân / Lưu / Đăng lại
router.get('/feed', getPhotoFeed);
router.get('/me', getMyPhotos);
router.get('/liked', getLikedPhotos);
router.get('/saved', getSavedPhotos);
router.get('/reposts', getRepostedPhotos);

// 2. Upload bài viết mới (Ảnh hoặc Video kèm Thumbnail)
router.post('/upload', handleUploadSingle, uploadPhoto);
router.post('/upload-video', handleUploadPostVideo, uploadVideoPost);

// 3. Thả / bỏ thả biểu tượng cảm xúc bài viết & Lưu / Đăng lại
router.post('/:id/react', toggleReaction);
router.get('/:id/reactions', getPhotoReactions);
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
