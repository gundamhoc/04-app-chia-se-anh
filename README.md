# Locket Clone - K27 Group Project

Dự án mô phỏng mạng xã hội chia sẻ ảnh khoảnh khắc Locket. Được phát triển bằng công nghệ **React Native (Expo)** ở giao diện và **Node.js (Express + Prisma + SQLite)** ở máy chủ dịch vụ.

---

## 📁 Cấu trúc Thư mục Repository

Kho lưu trữ source code được tổ chức thành 3 thư mục chính theo phân vai nhiệm vụ dự án:

```text
K27-LOCKET-CLONE/
├── backend/            # Code máy chủ API (Express, Prisma, SQLite)
│   ├── prisma/
│   │   ├── schema.prisma   # Schema định nghĩa cơ sở dữ liệu
│   │   └── dev.db          # [DATABASE CHẠY THẬT] File SQLite đang chạy runtime
│   └── src/            # Controllers, Routes, Middleware xác thực
├── database/           # Tài liệu thiết kế CSDL (Nộp bài / Tham khảo)
│   ├── schema.sql      # Lệnh SQL khởi tạo bảng (User, Friendship, Photo)
│   ├── erd_diagram.md  # Sơ đồ mối quan hệ thực thể (ERD) bằng Mermaid
│   └── dev_backup.db   # [DATABASE BACKUP] Dữ liệu mẫu tĩnh để phục vụ chấm điểm
├── frontend/           # Code giao diện (React Native + Expo SDK 54)
│   ├── app/            # Expo Router screens (Auth, Tabs layout)
│   ├── components/     # UI Components dùng chung
│   ├── constants/      # Cấu hình IP LAN máy chủ
│   └── context/        # Quản lý phiên đăng nhập (AuthContext)
└── README.md           # Tài liệu hướng dẫn (File này)
```

> [!IMPORTANT]
> **Phân biệt hai file Database SQLite:**
> 1. **`backend/prisma/dev.db`**: Đây là **Database chạy thật** lúc chạy server. Prisma ORM đọc/ghi trực tiếp lên file này. (File này đã được đưa vào `.gitignore` để tránh xung đột mã nguồn khi commit).
> 2. **`database/dev_backup.db`**: Đây là **Database backup tĩnh** đã nạp sẵn dữ liệu tài khoản và quan hệ bạn bè mẫu để phục vụ việc nộp bài và chấm điểm.

---

## 🛠️ Cài đặt & Khởi động Dự án

Sau khi clone dự án về máy, bạn thực hiện các bước sau:

### 🔑 Bước 1: Tạo cấu hình môi trường Backend
Tạo file `.env` nằm trong thư mục `backend/` (`backend/.env`) với nội dung mẫu:
```env
PORT=3000
DATABASE_URL="file:./dev.db"
JWT_SECRET="Tự_Nhập_Một_Chuỗi_Ký_Tự_Ngẫu_Nhiên_Dài"
```

### ⚙️ Bước 2: Cài đặt và Khởi chạy Backend
1. Di chuyển vào thư mục `backend`:
   ```bash
   cd backend
   ```
2. Cài đặt các thư viện:
   ```bash
   npm install
   ```
3. Đồng bộ cơ sở dữ liệu (tạo file `dev.db` mới nếu chưa có):
   ```bash
   npx prisma db push
   ```
4. Khởi chạy server:
   ```bash
   npm run dev
   ```

### 📱 Bước 3: Cài đặt và Khởi chạy Frontend
1. Mở một terminal mới và di chuyển vào thư mục `frontend`:
   ```bash
   cd frontend
   ```
2. Cài đặt các thư viện (bao gồm Expo Camera và Image Manipulator):
   ```bash
   npm install
   ```
3. **Cấu hình IP LAN máy chủ**:
   Mở file `frontend/constants/config.ts`, cập nhật biến `DEV_MACHINE_IP` thành địa chỉ IP mạng WiFi của máy tính đang chạy server backend (lấy IP bằng cách chạy `ip a` trên Linux/Mac hoặc `ipconfig` trên Windows).
4. Khởi động Metro Bundler:
   ```bash
   npm start
   ```
   *Quét mã QR bằng ứng dụng Expo Go trên điện thoại để trải nghiệm hoặc nhấn `w` để test trên Web.*
