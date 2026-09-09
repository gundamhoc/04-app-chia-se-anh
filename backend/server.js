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
const friendRoutes = require('./src/routes/friendRoutes');
const photoRoutes = require('./src/routes/photoRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const groupRoutes = require('./src/routes/groupRoutes');
const systemRoutes = require('./src/routes/systemRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

// ============================================================
// Khởi tạo Express App
// ============================================================
const app = express();
app.set('trust proxy', true);
// Vô hiệu hóa ETag mặc định để tránh HTTP 304 Not Modified cache trên các API động
app.disable('etag');
const PORT = process.env.PORT || 5000;

// ============================================================
// Middleware
// ============================================================
// Chống cache cho toàn bộ API động (luôn trả về 200 OK với dữ liệu mới nhất)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'ngrok-skip-browser-warning',
    'bypass-tunnel-reminder',
    'x-requested-with',
    'Cache-Control',
    'Pragma',
    'cache-control',
    'pragma',
  ],
}));

app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// Logging chỉ ở development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve static files (ảnh upload & admin web portal)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// Attach io to req
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ============================================================
// Routes
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

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

  httpServer.listen(PORT, async () => {
    console.log('');
    console.log('🚀 Masita Backend đang chạy!');
    console.log(`📡 HTTP API  : http://localhost:${PORT}/api`);
    console.log(`🔌 Socket.io : ws://localhost:${PORT}`);
    console.log(`🌿 ENV       : ${process.env.NODE_ENV || 'development'}`);
    console.log('');

    // Khởi chạy Ngrok tự động nếu có biến NGROK_AUTHTOKEN và NGROK_DOMAIN (Cloud 24/7)
    // Tự động retry mỗi 15 giây nếu máy tính cá nhân đang giữ domain, khi tắt máy cloud sẽ tự chiếm quyền!
    if (process.env.NGROK_AUTHTOKEN && process.env.NGROK_DOMAIN) {
      let ngrokConnected = false;
      const connectNgrok = async () => {
        if (ngrokConnected) return;
        try {
          const ngrok = require('@ngrok/ngrok');
          const listener = await ngrok.forward({
            addr: PORT,
            authtoken: process.env.NGROK_AUTHTOKEN,
            domain: process.env.NGROK_DOMAIN,
          });
          ngrokConnected = true;
          console.log(`🎉 [Ngrok Cloud] Tunnel ĐÃ KẾT NỐI THÀNH CÔNG: ${listener.url()}`);
        } catch (ngrokErr) {
          console.warn('⏳ [Ngrok Cloud] Domain đang bận trên máy cá nhân. Đang chờ bạn tắt máy/tắt ngrok local để cloud tự kích hoạt...');
        }
      };

      await connectNgrok();
      const retryTimer = setInterval(async () => {
        if (!ngrokConnected) {
          await connectNgrok();
        } else {
          clearInterval(retryTimer);
        }
      }, 15000);
    }

    // Tự động ping giữ máy chủ thức 24/7 (Anti-sleep cho Render free)
    const externalUrl = process.env.RENDER_EXTERNAL_URL;
    if (externalUrl) {
      console.log(`🛡️ [Keep-Alive] Kích hoạt chống ngủ đông cho ${externalUrl}`);
      setInterval(async () => {
        try {
          await fetch(`${externalUrl}/api/health`);
          console.log('💓 [Keep-Alive] Ping máy chủ thành công');
        } catch (e) {
          // Silent catch
        }
      }, 9 * 60 * 1000); // 9 phút một lần (Render ngủ sau 15p)
    }
  });
};

startServer().catch((err) => {
  console.error('❌ Không thể khởi động server:', err);
  process.exit(1);
});


module.exports = { app, io };
