const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
  updateAvatar,
  forgotPassword,
  updateUsername,
  updateEmail,
  changePassword,
} = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/auth');
const { handleUploadSingle } = require('../middlewares/upload');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

// Protected routes (yêu cầu JWT)
router.get('/profile', authMiddleware, getProfile);
router.put('/avatar', authMiddleware, handleUploadSingle, updateAvatar);
router.put('/username', authMiddleware, updateUsername);
router.put('/email', authMiddleware, updateEmail);
router.put('/change-password', authMiddleware, changePassword);

module.exports = router;
