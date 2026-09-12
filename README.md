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
| GET | `/api/auth/privacy-settings` | ✅ JWT | Lấy cài đặt quyền riêng tư tài khoản |
| PUT | `/api/auth/privacy-settings` | ✅ JWT | Cập nhật quyền riêng tư (riêng tư/công khai, đề xuất, tìm kiếm) |
| GET | `/api/auth/security-status` | ✅ JWT | Lấy trạng thái bảo mật (2FA, lưu đăng nhập, lần đổi MK) |
| PUT | `/api/auth/two-factor` | ✅ JWT | Bật / tắt xác thực hai bước (2FA) |
| PUT | `/api/auth/remember-login` | ✅ JWT | Bật / tắt ghi nhớ đăng nhập |
| GET | `/api/auth/sessions` | ✅ JWT | Lấy danh sách các phiên thiết bị đăng nhập |
| DELETE | `/api/auth/sessions/:id` | ✅ JWT | Thu hồi / đăng xuất thiết bị từ xa |
| DELETE | `/api/auth/account` | ✅ JWT | Xóa tài khoản vĩnh viễn (xác thực email + mật khẩu) |
| POST | `/api/auth/generate-otp` | ✅ JWT | Tạo mã OTP xác thực 2FA |
| GET | `/api/photos/feed` | ✅ JWT | Lấy bảng tin khoảnh khắc (Locket Feed) |
| POST | `/api/photos/upload` | ✅ JWT | Đăng ảnh khoảnh khắc mới (Google Drive) |
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
| GET | `/api/system/ota-check` | ❌ | Kiểm tra bản cập nhật Over-The-Air (OTA) và Changelog |
| GET | `/api/health` | ❌ | Health check server |

## Các lệnh quản trị & tiện ích Database

```bash
cd backend

# Tự động sao lưu toàn bộ cấu trúc & dữ liệu database ra file .sql
npm run db:backup

# Khôi phục toàn bộ database từ bản backup gần nhất (latest_backup.sql)
npm run db:restore
```

## Cấu trúc thư mục

```
masita/
├── admin/            # Cổng quản trị hệ thống Masita (Dashboard, Quản lý tài khoản, Giám sát Realtime)
├── backend/          # Node.js Express & Socket.io server (TiDB Cloud, Realtime Engine, Google Drive Storage)
├── database/         # MySQL / TiDB schema, migrations và backups
├── frontend/         # Expo React Native đa nền tảng Android / iOS / Tablet / Web (Theme Engine, OTA Update)
├── website/          # Landing Page giới thiệu, quét mã QR & tải file APK v1.0.7 (GitHub Pages)
└── README.md         # Tài liệu dự án
```

## 📱 Tải ứng dụng APK Android (v1.0.7)

- **Landing Page & Web App**: [https://gundamhoc.github.io/04-app-chia-se-anh/](https://gundamhoc.github.io/04-app-chia-se-anh/)
- **Tải trực tiếp APK (Build 8)**: [Tải Masita v1.0.7 APK](https://expo.dev/artifacts/eas/SjJ7qKPPxFCaSPGlCx18j5MtD63AuN9UlaI8vFFMOkA.apk)
- **EAS Cloud Build Details**: [Expo EAS Build Page](https://expo.dev/accounts/gundamhoc/projects/masita/builds/5f942933-5b97-4328-8b36-b55d48150f80)

