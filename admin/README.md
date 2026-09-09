# 👑 Masita Admin Portal — Bảng Quản Trị Hệ Thống

Bảng điều khiển quản trị web dành cho Admin hệ thống mạng xã hội **Masita**, được xây dựng bằng công nghệ thuần (HTML5, Vanilla CSS, Vanilla JS) không cần cài đặt thêm thư viện, giao diện Dark Theme hiện đại kết nối trực tiếp với backend Express.js & TiDB Cloud.

---

## 🌟 Chức năng chính

1. **📊 Tổng quan hệ thống (Overview Dashboard):**
   - Đếm số lượng người dùng thực tế (tổng số và đang hoạt động).
   - Đếm số lượng bài đăng và phân loại chi tiết (hình ảnh 🖼️ vs video 📹).
   - Tổng hợp tương tác cộng đồng (lượt thả tim ❤️ và bình luận 💬).
   - Cảnh báo nhanh số lượng yêu cầu "Quên mật khẩu" đang chờ xử lý ⏳.
   - Danh sách thành viên mới gia nhập và bài viết/video mới nhất theo thời gian thực.

2. **🔑 Quản lý Yêu cầu Cấp lại mật khẩu (Password Resets):**
   - Lọc các yêu cầu theo trạng thái: *Chờ xử lý* (Pending) | *Đã gửi mã* (Sent) | *Đã hoàn tất* (Resolved).
   - Bấm nút **"Cấp mật khẩu"** để mở popup hỗ trợ:
     - Tạo mật khẩu ngẫu nhiên an toàn một chạm (🎲 Tạo mã).
     - Cập nhật trực tiếp mật khẩu người dùng trong cơ sở dữ liệu TiDB (đã mã hóa bcrypt an toàn).
     - Chuyển trạng thái yêu cầu sang *Đã gửi mã* hoặc *Đã xong*.

3. **👥 Quản lý Người dùng (Users Management):**
   - Tìm kiếm tức thì (Realtime Debounced Search) theo tên, `@username`, hoặc Gmail.
   - Phân trang dữ liệu thông minh.
   - Hiển thị số lượng bài viết, số bạn bè, ngày tham gia của từng tài khoản.
   - **Khóa (Lock) / Mở khóa (Unlock)** tài khoản vi phạm chỉ với 1 click.
   - Đặt lại mật khẩu khẩn cấp cho bất kỳ tài khoản nào.

4. **📸 Kiểm duyệt Bài viết & Khoảnh khắc (Posts Moderation):**
   - Lọc bài đăng: Tất cả | Chỉ ảnh 🖼️ | Chỉ video 📹.
   - Xem trước nhanh nội dung hình ảnh hoặc xem video trực tiếp kèm âm thanh trong popup.
   - Theo dõi mức độ riêng tư (Công khai 🌐, Bạn bè 👥, Riêng tư 🔒) và số lượng tương tác.
   - **Gỡ bài đăng vi phạm (Xóa vĩnh viễn)** khỏi hệ thống.

5. **⚙️ Cài đặt kết nối & Giám sát (Settings & Health):**
   - Đo độ trễ (Ping latency ms) đến Backend API thời gian thực.
   - Chấm tròn trạng thái Online (Xanh lá) / Offline (Đỏ).
   - Tùy chỉnh endpoint API (mặc định `http://localhost:5000/api` hoặc link Ngrok/Cloud).
   - Tùy chọn chu kỳ tự động làm mới (15 giây, 30 giây, 1 phút).

---

## 🚀 Cách mở và sử dụng Admin Portal

### Cách 1: Truy cập qua Backend Server (Khuyên dùng)
Khi Backend đang chạy (`npm run dev` tại thư mục `backend`), bạn chỉ cần mở trình duyệt và truy cập:
👉 **[http://localhost:5000/admin](http://localhost:5000/admin)**

*(Hoặc nếu đang chạy qua Ngrok: `https://<ngrok-domain>/admin`)*

### Cách 2: Mở trực tiếp file HTML
Bạn có thể mở trực tiếp file `admin/index.html` bằng trình duyệt (Chrome, Edge, Firefox, Cốc Cốc) hoặc tiện ích Live Server trong VS Code:
- Đường dẫn: `d:\Thu Vien\27TH03\Vibe Code\appmobile\appmxh\admin\index.html`
- Tại tab **Cài đặt kết nối**, kiểm tra xem API Base URL đã trỏ tới `http://localhost:5000/api` chưa và bấm **Lưu cấu hình**.

---

## 🔌 Danh sách API Endpoints Quản trị Backend (`/api/admin`)

| Phương thức | Endpoint | Mô tả chức năng |
|---|---|---|
| `GET` | `/api/admin/stats` | Thống kê số liệu người dùng, bài viết, tương tác, reset tickets |
| `GET` | `/api/admin/users` | Danh sách người dùng (hỗ trợ `page`, `limit`, `search`, `status`) |
| `PUT` | `/api/admin/users/:id/status` | Khóa hoặc mở khóa tài khoản (`is_active: 0 / 1`) |
| `POST` | `/api/admin/users/:id/reset-password` | Đặt mật khẩu mới cho người dùng |
| `GET` | `/api/admin/reset-requests` | Lấy danh sách yêu cầu quên mật khẩu (`status=pending/sent/resolved`) |
| `PUT` | `/api/admin/reset-requests/:id/status` | Cập nhật trạng thái yêu cầu quên mật khẩu |
| `GET` | `/api/admin/posts` | Danh sách bài viết kiểm duyệt (`page`, `limit`, `mediaType`, `search`) |
| `DELETE` | `/api/admin/posts/:id` | Xóa vĩnh viễn bài viết vi phạm |
