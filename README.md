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
| POST | `/api/auth/register` | ❌ | Đăng ký |
| POST | `/api/auth/login` | ❌ | Đăng nhập |
| GET | `/api/auth/profile` | ✅ JWT | Lấy hồ sơ |
| PUT | `/api/auth/avatar` | ✅ JWT | Upload ảnh đại diện |
| GET | `/api/health` | ❌ | Health check |

## Cấu trúc thư mục

```
masita/
├── backend/          # Node.js API server
├── frontend/         # Expo React Native app
└── database/         # MySQL schema
```
