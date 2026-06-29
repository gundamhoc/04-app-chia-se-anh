const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Cấu hình Express và HTTP Server
const app = express();
const server = http.createServer(app);

// Cấu hình Socket.io với CORS
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Đảm bảo thư mục uploads tồn tại để lưu ảnh
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Cấu hình tĩnh để truy cập ảnh qua URL
app.use('/uploads', express.static(uploadsDir));

// Cấu hình Multer để lưu ảnh tải lên
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Đặt tên file độc nhất bằng timestamp + số ngẫu nhiên
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Cơ sở dữ liệu tạm thời trong bộ nhớ (In-memory database) để làm demo
// Trong thực tế, bạn sẽ lưu cái này vào MongoDB, MySQL hoặc Firebase
let sharedPhotos = [];

// API chào mừng
app.get('/', (req, res) => {
  res.json({ message: "Welcome to Locket Clone API Server - Group 4" });
});

// API lấy lịch sử ảnh đã chia sẻ
app.get('/api/history', (req, res) => {
  res.json(sharedPhotos);
});

// API upload và chia sẻ ảnh
app.post('/api/upload', upload.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Không tìm thấy ảnh để tải lên" });
    }

    const sender = req.body.sender || "Ẩn danh";
    const caption = req.body.caption || "";
    
    // Tạo đối tượng ảnh mới
    const photoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const newPhoto = {
      id: Date.now().toString(),
      sender: sender,
      caption: caption,
      url: photoUrl,
      createdAt: new Date().toISOString()
    };

    // Lưu vào danh sách lịch sử
    sharedPhotos.unshift(newPhoto); // Thêm lên đầu danh sách
    
    // Giới hạn lịch sử lưu tối đa 50 ảnh
    if (sharedPhotos.length > 50) {
      sharedPhotos = sharedPhotos.slice(0, 50);
    }

    // Phát sự kiện WebSockets thời gian thực đến toàn bộ ứng dụng đang kết nối
    io.emit('new_photo', newPhoto);
    console.log(`[Locket] Ảnh mới được gửi từ ${sender}: ${caption}`);

    res.status(201).json({
      success: true,
      message: "Tải ảnh và chia sẻ thành công",
      photo: newPhoto
    });
  } catch (error) {
    console.error("Lỗi khi upload ảnh:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi xử lý ảnh" });
  }
});

// Quản lý kết nối Socket.io
io.on('connection', (socket) => {
  console.log(`[Socket] Thiết bị kết nối mới: ${socket.id}`);

  // Gửi danh sách ảnh hiện tại cho thiết bị vừa kết nối
  socket.emit('history', sharedPhotos);

  socket.on('disconnect', () => {
    console.log(`[Socket] Thiết bị đã ngắt kết nối: ${socket.id}`);
  });
});

// Khởi động Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Locket Clone Server (Group 4) đang chạy tại:`);
  console.log(`- Local: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
