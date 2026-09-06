require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { testConnection } = require('./src/config/db');
const { initSocketHandler } = require('./src/sockets/socketHandler');
const authRoutes = require('./src/routes/authRoutes');

// ============================================================
// Khởi tạo Express App
// ============================================================
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// Middleware
// ============================================================
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging chỉ ở development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve static files (ảnh upload)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================
// Routes
// ============================================================
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Masita API đang chạy 🚀',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Không tìm thấy route: ${req.method} ${req.url}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Lỗi server không xác định.',
    ...(process.env.NODE_ENV === 'development' && { error: err.message }),
  });
});

// ============================================================
// HTTP Server + Socket.io
// ============================================================
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// Khởi tạo socket handler
initSocketHandler(io);

// ============================================================
// Khởi động server
// ============================================================
const startServer = async () => {
  // Kiểm tra kết nối DB trước khi start
  await testConnection();

  httpServer.listen(PORT, () => {
    console.log('');
    console.log('🚀 Masita Backend đang chạy!');
    console.log(`📡 HTTP API  : http://localhost:${PORT}/api`);
    console.log(`🔌 Socket.io : ws://localhost:${PORT}`);
    console.log(`🌿 ENV       : ${process.env.NODE_ENV || 'development'}`);
    console.log('');
  });
};

startServer().catch((err) => {
  console.error('❌ Không thể khởi động server:', err);
  process.exit(1);
});

module.exports = { app, io };
