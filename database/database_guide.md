# Tài liệu thiết kế và hướng dẫn Cơ sở Dữ liệu (Database) - Nhóm 4

Dự án này sử dụng mô hình lưu trữ dữ liệu cho ứng dụng chia sẻ hình ảnh trực tiếp dạng Locket.
Dưới đây là thiết kế thực thể dữ liệu và cách cấu hình kết nối database khi bạn phát triển thêm.

---

## 1. Thiết kế Bảng/Thực thể (Schemas)

Để làm ứng dụng chia sẻ hình ảnh giống Locket, chúng ta cần tối thiểu 2 bảng chính: **Người dùng (Users)** và **Hình ảnh/Bài đăng (Photos)**.

### A. Thực thể Người dùng (User Schema)
Dùng để quản lý tài khoản, đăng nhập và danh sách bạn bè.

```json
{
  "userId": "String (khóa chính, ví dụ: 'user_01')",
  "username": "String (tên đăng nhập, ví dụ: 'hoang_nam')",
  "displayName": "String (tên hiển thị, ví dụ: 'Nam Hoàng')",
  "avatarUrl": "String (đường dẫn ảnh đại diện)",
  "friendsList": ["Mảng userId bạn bè, ví dụ: ['user_02', 'user_03']"],
  "createdAt": "DateTime (Thời gian tạo tài khoản)"
}
```

### B. Thực thể Hình ảnh (Photo/Feed Schema)
Lưu thông tin các bức ảnh được gửi trực tiếp lên màn hình của bạn bè.

```json
{
  "photoId": "String (khóa chính)",
  "senderId": "String (ID người gửi, liên kết với User.userId)",
  "caption": "String (Dòng trạng thái đính kèm ảnh)",
  "imageUrl": "String (Đường dẫn lưu trữ file ảnh trên server/cloud)",
  "recipients": ["Mảng userId những người nhận được ảnh này"],
  "createdAt": "DateTime (Thời gian gửi ảnh, dùng để sắp xếp dòng thời gian)"
}
```

---

## 2. Hướng dẫn Tích hợp Database vào Backend

### Tùy chọn 1: Sử dụng MongoDB (Khuyên dùng cho NodeJS)
MongoDB là cơ sở dữ liệu NoSQL dạng tài liệu, cực kỳ phù hợp với NodeJS và cấu trúc dữ liệu JSON ở trên.

1. **Cài đặt thư viện Mongoose:**
   ```bash
   cd backend
   npm install mongoose
   ```

2. **Kết nối trong `server.js`:**
   ```javascript
   const mongoose = require('mongoose');
   
   // Thay chuỗi kết nối bằng MongoDB Atlas hoặc Local của bạn
   const MONGO_URI = 'mongodb://localhost:27017/locket_db';
   
   mongoose.connect(MONGO_URI)
     .then(() => console.log('Đã kết nối cơ sở dữ liệu MongoDB thành công!'))
     .catch(err => console.error('Lỗi kết nối database:', err));
   ```

### Tùy chọn 2: Sử dụng Firebase Firestore (Thời gian thực)
Nếu nhóm muốn đồng bộ hóa ảnh siêu tốc mà không cần code Socket.io phức tạp, Firebase Firestore và Firebase Storage là lựa chọn hàng đầu.
- **Firebase Firestore**: Lưu trữ thông tin người dùng và bài đăng.
- **Firebase Storage**: Lưu trữ file ảnh thật.

---

## 3. Bản ghi mẫu (Seed Data)
Dữ liệu lịch sử ban đầu trong server đang được lưu tạm thời trong bộ nhớ RAM (`in-memory`) của server để chạy demo mượt mà. Khi tắt server, dữ liệu này sẽ mất đi. Để giữ dữ liệu vĩnh viễn, nhóm hãy làm theo hướng dẫn kết nối MongoDB ở mục 2.
