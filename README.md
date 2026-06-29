# K27-GROUP4 - Ứng dụng Chia Sẻ Hình Ảnh Trực Tiếp (Locket Clone)

Đây là kho lưu trữ mã nguồn của **Nhóm 4** cho đề tài ứng dụng kết nối và chia sẻ hình ảnh trực tiếp thời gian thực, hoạt động tương tự như ứng dụng **Locket Locket**.

---

## 📁 Cấu trúc Thư mục Dự án

```
K27-GROUP4-APP-CHIA-SE-ANH-TRUC-TIEP/
├── backend/          # Máy chủ API & WebSocket (Node.js/Express + Socket.io)
├── database/         # Thiết kế cơ sở dữ liệu và hướng dẫn kết nối (MongoDB/Firebase)
├── frontend/         # Mã nguồn ứng dụng di động (Expo - React Native)
└── README.md         # Hướng dẫn này
```

---

## 🛠️ Công nghệ Sử dụng

- **Frontend**: Expo (React Native), Expo Router (TypeScript), Socket.io-client.
- **Backend**: Node.js, Express, Socket.io (WebSocket kết nối trực tiếp), Multer (Quản lý tải tệp ảnh).
- **Database**: Hỗ trợ lưu trữ trong RAM (In-memory) khi chạy thử nghiệm và có hướng dẫn kết nối MongoDB/Firebase vĩnh viễn.

---

## 🚀 Hướng dẫn Chạy Dự án

Để chạy toàn bộ dự án dưới local, bạn cần mở 2 cửa sổ terminal riêng biệt: một cửa sổ chạy Server (backend) và một cửa sổ chạy App (frontend).

### Bước 1: Khởi động Backend (Máy chủ)
1. Mở terminal và di chuyển vào thư mục `backend`:
   ```powershell
   cd K27-GROUP4-APP-CHIA-SE-ANH-TRUC-TIEP/backend
   ```
2. Cài đặt các thư viện cần thiết:
   ```powershell
   npm.cmd install
   ```
3. Khởi động server ở chế độ phát triển (tự động tải lại khi đổi code):
   ```powershell
   npm.cmd run dev
   ```
   *Lúc này, server sẽ chạy tại cổng mặc định `http://localhost:5000`.*

### Bước 2: Khởi động Frontend (Ứng dụng Expo)
1. Mở cửa sổ terminal thứ 2 và di chuyển vào thư mục `frontend`:
   ```powershell
   cd K27-GROUP4-APP-CHIA-SE-ANH-TRUC-TIEP/frontend
   ```
2. Khởi động môi trường Expo Dev Client:
   ```powershell
   npx.cmd expo start
   ```
3. Quét mã QR:
   - Tải ứng dụng **Expo Go** trên điện thoại Android từ CH Play (hoặc App Store trên iOS).
   - Đảm bảo điện thoại và máy tính chạy server dùng chung **một mạng Wi-Fi**.
   - Mở camera hoặc app Expo Go để quét mã QR xuất hiện trên màn hình terminal của máy tính để mở app trực tiếp trên điện thoại.

---

## 📲 Quy trình Build file APK để cài đặt trực tiếp
Khi ứng dụng đã hoàn thiện và bạn muốn tạo file cài đặt APK:

1. **Đăng nhập hoặc đăng ký tài khoản Expo** tại [https://expo.dev](https://expo.dev).
2. **Cấu hình EAS (Expo Application Services)**:
   Mở terminal trong thư mục `frontend` và cài đặt EAS CLI toàn cục:
   ```powershell
   npm.cmd install -g eas-cli
   ```
3. Đăng nhập EAS trong terminal:
   ```powershell
   eas.cmd login
   ```
4. Khởi tạo cấu hình build:
   ```powershell
   eas.cmd build:configure
   ```
5. Chạy lệnh build file APK trên cloud (Expo sẽ tự động tạo file APK trực tuyến và cung cấp link tải/mã QR để cài vào điện thoại):
   ```powershell
   eas.cmd build --platform android --profile preview
   ```
   *(Profile `preview` được cấu hình mặc định để xuất trực tiếp file `.apk` thay vì `.aab` gửi lên Google Play)*.
