# Masita - Ứng Dụng Mạng Xã Hội

## Công nghệ

| Layer | Stack |
|-------|-------|
| Frontend | Expo (React Native), Expo Router v5, TypeScript, Socket.io-client |
| Backend | Node.js, Express, Socket.io, Multer |
| Database | MySQL (MySQL Workbench CE) |
| State | Zustand |
| Auth | JWT + SecureStore |

## Cài đặt

### 1. Database
Chạy file `database/schema.sql` trong MySQL Workbench CE để tạo database và bảng `users`.

### 2. Backend
```bash
cd backend
cp .env.example .env
# Sửa DB_PASSWORD trong .env
npm install
npm run dev
```

Server chạy tại: `http://localhost:5000`

### 3. Frontend
```bash
cd frontend
npm install
npx expo start
```

> ⚠️ Khi test trên điện thoại thật, sửa `BASE_URL` trong `frontend/services/api.ts` thành IP LAN của máy (vd: `http://192.168.1.5:5000/api`)

## API Endpoints

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/auth/register` | ❌ | Đăng ký tài khoản |
| POST | `/api/auth/login` | ❌ | Đăng nhập hệ thống |
| GET | `/api/auth/profile` | ✅ JWT | Lấy thông tin hồ sơ |
| PUT | `/api/auth/avatar` | ✅ JWT | Cập nhật ảnh đại diện |
| GET | `/api/photos/feed` | ✅ JWT | Lấy bảng tin khoảnh khắc (Locket Feed) |
| POST | `/api/photos/upload` | ✅ JWT | Đăng ảnh khoảnh khắc mới |
| PUT | `/api/photos/:id` | ✅ JWT | Chỉnh sửa chú thích bài đăng |
| DELETE | `/api/photos/:id` | ✅ JWT | Xóa ảnh bài đăng |
| POST | `/api/photos/:id/react` | ✅ JWT | Thả / bỏ thả emoji bài viết |
| GET | `/api/photos/:id/comments` | ✅ JWT | Lấy danh sách bình luận |
| POST | `/api/photos/:id/comments` | ✅ JWT | Đăng bình luận mới |
| DELETE | `/api/photos/comments/:commentId` | ✅ JWT | Xóa bình luận |
| POST | `/api/photos/comments/:commentId/react` | ✅ JWT | Thả cảm xúc bình luận |
| GET | `/api/photos/drive/:fileId` | ❌ | Proxy stream ảnh Google Drive an toàn |
| GET | `/api/friends` | ✅ JWT | Lấy danh sách bạn bè |
| GET | `/api/friends/requests` | ✅ JWT | Lấy lời mời kết bạn |
| POST | `/api/friends/request/:id` | ✅ JWT | Gửi lời mời kết bạn |
| PUT | `/api/friends/accept/:id` | ✅ JWT | Chấp nhận kết bạn |
| DELETE | `/api/friends/reject/:id` | ✅ JWT | Từ chối kết bạn |
| GET | `/api/health` | ❌ | Health check |

## Cấu trúc thư mục

```
masita/
├── backend/          # Node.js Express & Socket.io server
├── frontend/         # Expo React Native (iOS, Android, Web)
└── database/         # MySQL schema & migrations
```
