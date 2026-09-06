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

> 💡 **Kiểm thử nhóm khác mạng / 4G:** Cấu hình `EXPO_PUBLIC_API_URL=https://reassure-limelight-twiddle.ngrok-free.dev` trong `frontend/.env` và chạy `npm run ngrok` ở backend để tất cả thành viên trong nhóm kết nối từ xa.

## API Endpoints

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/auth/register` | ❌ | Đăng ký tài khoản |
| POST | `/api/auth/login` | ❌ | Đăng nhập hệ thống |
| POST | `/api/auth/forgot-password` | ❌ | Gửi yêu cầu quên mật khẩu / cấp lại mã |
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
| GET | `/api/messages/conversations` | ✅ JWT | Lấy danh sách cuộc trò chuyện gần nhất |
| GET | `/api/messages/:friendId` | ✅ JWT | Lấy lịch sử chat 1-1 với bạn bè |
| POST | `/api/messages` | ✅ JWT | Gửi tin nhắn văn bản |
| POST | `/api/messages/upload-image` | ✅ JWT | Gửi tin nhắn hình ảnh (tải lên Google Drive) |
| POST | `/api/messages/upload-file` | ✅ JWT | Gửi tệp tin (code, txt, pdf, zip, docx...) |
| GET | `/api/messages/file-content/:messageId` | ✅ JWT | Đọc nội dung tệp tin văn bản/code trực tiếp |
| GET | `/api/messages/download/:messageId` | ❌ | Tải tệp tin đính kèm về máy (Content-Disposition attachment) |
| PUT | `/api/messages/:friendId/read` | ✅ JWT | Đánh dấu đã đọc tin nhắn |
| POST | `/api/groups` | ✅ JWT | Tạo nhóm trò chuyện mới |
| GET | `/api/groups` | ✅ JWT | Lấy danh sách nhóm người dùng tham gia |
| GET | `/api/groups/:id` | ✅ JWT | Lấy chi tiết nhóm và danh sách thành viên |
| PUT | `/api/groups/:id` | ✅ JWT | Cập nhật tên hoặc ảnh đại diện nhóm |
| POST | `/api/groups/:id/members` | ✅ JWT | Thêm thành viên mới vào nhóm |
| DELETE | `/api/groups/:id/members/:userId` | ✅ JWT | Xóa thành viên (Admin) hoặc rời nhóm |
| GET | `/api/groups/:id/messages` | ✅ JWT | Lấy lịch sử tin nhắn nhóm |
| POST | `/api/groups/:id/messages` | ✅ JWT | Gửi tin nhắn văn bản vào nhóm |
| POST | `/api/groups/:id/upload-image` | ✅ JWT | Gửi hình ảnh vào nhóm (Google Drive) |
| POST | `/api/groups/:id/upload-file` | ✅ JWT | Gửi tệp tin vào nhóm (Google Drive) |
| PUT | `/api/groups/:id/theme` | ✅ JWT | Cập nhật hình nền / Preset Theme nhóm |
| PUT | `/api/groups/:id/pin` | ✅ JWT | Ghim / Bỏ ghim nhóm chat |
| PUT | `/api/groups/:id/mute` | ✅ JWT | Bật / Tắt thông báo nhóm chat |
| GET | `/api/groups/:id/search` | ✅ JWT | Tìm kiếm tin nhắn trong nhóm chat |
| PUT | `/api/messages/:friendId/theme` | ✅ JWT | Cập nhật hình nền / Preset Theme chat 1-1 |
| PUT | `/api/messages/:friendId/pin` | ✅ JWT | Ghim / Bỏ ghim cuộc trò chuyện 1-1 |
| PUT | `/api/messages/:friendId/mute` | ✅ JWT | Bật / Tắt thông báo cuộc trò chuyện 1-1 |
| GET | `/api/messages/:friendId/search` | ✅ JWT | Tìm kiếm tin nhắn cuộc trò chuyện 1-1 |
| GET | `/api/health` | ❌ | Health check |

## Cấu trúc thư mục

```
masita/
├── backend/          # Node.js Express & Socket.io server
├── frontend/         # Expo React Native (iOS, Android, Web)
└── database/         # MySQL schema & migrations
```
