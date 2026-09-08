const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
  updateProfile,
  updateAvatar,
  forgotPassword,
  updateUsername,
  updateEmail,
  changePassword,
  getPrivacySettings,
  updatePrivacySettings,
  getSecurityStatus,
  toggleTwoFactor,
  toggleRememberLogin,
  getLoginSessions,
  revokeSession,
  deleteAccount,
  generateOtp,
} = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/auth');
const { handleUploadSingle } = require('../middlewares/upload');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

// Protected routes (yêu cầu JWT)
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.put('/avatar', authMiddleware, handleUploadSingle, updateAvatar);
router.put('/username', authMiddleware, updateUsername);
router.put('/email', authMiddleware, updateEmail);
router.put('/change-password', authMiddleware, changePassword);
router.get('/privacy-settings', authMiddleware, getPrivacySettings);
router.put('/privacy-settings', authMiddleware, updatePrivacySettings);

// Security routes
router.get('/security-status', authMiddleware, getSecurityStatus);
router.put('/two-factor', authMiddleware, toggleTwoFactor);
router.put('/remember-login', authMiddleware, toggleRememberLogin);
router.get('/sessions', authMiddleware, getLoginSessions);
router.delete('/sessions/:id', authMiddleware, revokeSession);
router.delete('/account', authMiddleware, deleteAccount);
router.post('/generate-otp', authMiddleware, generateOtp);

module.exports = router;
