const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 30 * 1024 * 1024; // 30MB

// Tạo thư mục uploads nếu chưa tồn tại
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Cấu hình disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Format: userId_timestamp_originalname
    const userId = req.user ? req.user.id : 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${userId}_${timestamp}${ext}`;
    cb(null, filename);
  },
});

// Chỉ chấp nhận file ảnh (rộng rãi để tương thích với Mobile Expo ImagePicker)
const fileFilter = (req, file, cb) => {
  const isImageMime = file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype === 'application/octet-stream');
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp'];

  if (isImageMime || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP, HEIC).'), false);
  }
};

// Multer instance cho upload ảnh đơn
const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('image');

// Multer instance cho upload nhiều ảnh (tối đa 5)
const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).array('images', 5);

// Middleware wrapper xử lý lỗi multer
const handleUploadSingle = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      console.warn('⚠️ Multer upload error:', err.message);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File quá lớn. Tối đa ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

module.exports = { handleUploadSingle, uploadMultiple };
