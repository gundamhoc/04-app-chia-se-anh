# fix.md — Kế hoạch cải tiến UX nhỏ cho Masita

> **Nguyên tắc:** Theo `PROTOCOL.md` — Phân tích → Code → Test từng phần → Verify toàn bộ
> **Giai đoạn:** Foundation (Sprint 11) — Chỉ thêm tính năng nhỏ, không đổi logic cốt lõi

---

## 📋 TOP 5 CẢI TIẾN ƯU TIÊN CAO

### 1. Pull-to-refresh Feed đúng lúc (search scope)

**Vấn đề:** `FlatList` trong `index.tsx` có `refreshControl` nhưng `onRefresh` gọi `fetchFeed(searchQuery.trim() || undefined, searchScope)`. Khi đang search, nó fetch đúng scope nhưng mất query.

**Giải pháp:**
- Cập nhật `onRefresh` để giữ nguyên `searchQuery` và `searchScope` hiện tại
- Test: Kéo refresh khi đang search "abc" scope "friends" → vẫn lọc "abc" trong friends

**File:** `frontend/app/(tabs)/index.tsx`

---

### 2. Image placeholder/cache cho Feed

**Vấn đề:** Ảnh load chậm, trắng lúc scroll nhanh. `<Image>` không có placeholder.

**Giải pháp:**
- Thêm `placeholder={require('../../assets/placeholder.png')}` hoặc dùng `expo-image` (Expo SDK 50+)
- Tạo asset placeholder đơn giản (1x1px hoặc blur)

**File:** `frontend/app/(tabs)/index.tsx` (component `renderPhotoCard`)

---

### 3. Error Boundary wrapper

**Vấn đề:** Crash một component (ví dụ: image load fail, map undefined) sập cả app.

**Giải pháp:**
- Tạo `ErrorBoundary.tsx` wrapper
- Bọc `FlatList` renderItem hoặc toàn bộ `InnerLayout`
- Hiển thị UI fallback thay vì white screen

**File:** `frontend/components/ErrorBoundary.tsx` (mới) + sửa `index.tsx`

---

### 4. Seen indicator (✓✓) cho tin nhắn

**Vấn đề:** Backend `messages` đã có `is_read`, UI chỉ hiển thị delivered (1 tick), chưa có seen (2 tick).

**Giải pháp:**
- Backend: Thêm `GET /api/messages/:friendId/seen-status` hoặc mở rộng response `chat/[id].tsx`
- Frontend: Hiển thị ✓ (sent) → ✓✓ (delivered) → ✓✓ xanh (seen)
- Real-time: Socket event `message_read` cập nhật UI

**File:** 
- `backend/src/controllers/messageController.js`
- `backend/src/routes/messageRoutes.js`
- `frontend/app/chat/[id].tsx`
- `frontend/services/messageService.ts`

---

### 5. KeyboardAvoidingView cho Chat input

**Vấn đề:** Trên Android, bàn phím che input khi typing.

**Giải pháp:**
- Bọc input area trong `KeyboardAvoidingView` (behavior='padding' iOS, 'height' Android)
- Thêm `keyboardVerticalOffset` đúng với header height

**File:** `frontend/app/chat/[id].tsx` và `frontend/app/group-chat/[id].tsx`

---

## 🔧 TECHNICAL DEBT (Trung bình)

| Task | Mô tả | Ưu tiên |
|------|-------|---------|
| Optimistic UI reactions rollback | Khi thả cảm xúc fail → rollback UI | Trung bình |
| Infinite scroll Comments pagination | CommentModal load all, cần cursor-based | Trung bình |
| Bundle size optimize | Code-split routes, lazy load modal | Thấp |
| Sentry/Crashlytics integration | Track crash production | Thấp |

---

## ✅ CHECKLIST TRIỂN KHAI (Mỗi task)

```
□ Đã đọc file liên quan
□ Code đúng convention (PROTOCOL.md)
□ Backend test curl/Postman
□ Frontend: npx tsc --noEmit pass
□ End-to-end test trên Expo Go
□ Không console error
□ Cập nhật AI_CONTEXT.md log
```

---

## 📝 LOG TRIỂN KHAI

### [ ] Task 1: Pull-to-refresh Feed
- File: `index.tsx`
- Test: Kéo refresh khi search & không search

### [ ] Task 2: Image placeholder
- File: `index.tsx`
- Asset: Tạo placeholder hoặc dùng expo-image

### [ ] Task 3: Error Boundary
- File: `ErrorBoundary.tsx` (new) + `index.tsx`
- Test: Throw error trong renderItem → không crash app

### [ ] Task 4: Seen indicator
- Backend: API + socket event
- Frontend: UI tick ✓ → ✓✓ → ✓✓ xanh
- Test: Mở chat → đọc → tick xanh

### [ ] Task 5: KeyboardAvoidingView
- File: `chat/[id].tsx` + `group-chat/[id].tsx`
- Test: Type trên Android → input không bị che

---

## 🆕 TASK 6: Realtime thông báo user/bài đăng mới cho Admin Portal

**Vấn đề:** Trang admin (`admin/`) hiện chỉ "kéo" (polling) dữ liệu qua `GET /api/admin/stats`. User mới đăng ký hoặc bài đăng mới chỉ xuất hiện sau chu kỳ auto-refresh (15s–60s), và tab Users/Posts không tự refresh. Bản thân `admin/app.js` chưa có socket.io client.

**Nguyên nhân:** Backend `socketHandler.js:78` đang REJECT token có `admin_id` (chỉ nhận user thường), và controller `register`/`uploadPhoto` chưa emit event nào cho admin.

### Kế hoạch chi tiết

#### Backend (3 file)
1. **`backend/src/sockets/socketHandler.js`** — sửa middleware auth socket:
   - Token có `admin_id` (không có `id`) → chấp nhận, gắn `socket.isAdmin = true`, `socket.join('admins')` khi connect
   - Token có `id` → giữ nguyên flow user thường
   - Thiếu cả hai → reject như cũ
   - (Đã có sẵn `getIO()` export để controller dùng)
2. **`backend/src/controllers/authController.js`** — trong `register`, sau INSERT thành công:
   - `getIO()?.to('admins').emit('admin_new_user', {...})` bọc try/catch (emit lỗi không làm fail đăng ký)
   - Payload khớp format `recent_users`: `id, username, full_name, avatar_url, is_active, created_at, is_online`
3. **`backend/src/controllers/photoController.js`** — trong `uploadPhoto` (CẢ 2 nhánh ảnh + video), sau INSERT:
   - `getIO()?.to('admins').emit('admin_new_post', {...})` bọc try/catch
   - Payload khớp format `recent_posts`: `id, caption, media_url, media_type, privacy, username, full_name, created_at, is_video, stream_url`

#### Frontend Admin (2 file)
4. **`admin/index.html`** — thêm CDN `socket.io-client@4.7.5` (jsdelivr, giống Chart.js)
5. **`admin/app.js`**:
   - `connectAdminSocket()`: `io(origin, { auth: { token: state.adminToken } })` (origin = apiBaseUrl bỏ `/api`). Gọi sau khi restore session / login thành công; `disconnectAdminSocket()` khi logout / 401
   - Listener `admin_new_user` + `admin_new_post` (cả admin & staff cùng nhận):
     - Tab **overview** đang mở → `loadDashboardStats()` cập nhật tức thì
     - Tab **users**/**posts** đang mở → Toast + nút "Tải ngay" (không auto-refresh, giữ vị trí bảng); bấm → `loadUsers(1)` / `loadPosts(1)`
     - Tab khác → chỉ toast
   - Helper mới `showToastWithAction(msg, type, label, onClick)`
   - `connect_error` → im lặng (socket.io tự reconnect)

### Checklist test (PROTOCOL)
```
□ node --check 3 file backend pass
□ Backend chạy, curl POST /api/auth/register → log emit, /api/admin/stats có user mới
□ Mở localhost:5000/admin, tắt auto-refresh → đăng ký user mới → Overview nhảy tức thì
□ Upload bài từ app → tab Posts đang mở → toast "Tải ngay" → bấm thấy bài mới trang 1
□ Logout → login lại → socket reconnect không lỗi 401
□ Không console error trên admin page
□ Log AI_CONTEXT.md
```

### Log triển khai
- [x] Bước 1: socketHandler admin token
- [x] Bước 2: authController emit admin_new_user
- [x] Bước 3: photoController emit admin_new_post
- [x] Bước 4: index.html CDN
- [x] Bước 5: app.js socket client + toast action
- [x] Bước 6: Test end-to-end + log

---

## 🆕 TASK 7: Fix biểu đồ "Tăng trưởng người dùng" hiển thị toàn 0 ✅ (XONG 12/09/2026)

**Hiện tượng:** Chart User Growth + Posts Interaction trên Admin phẳng toàn số 0 dù DB có dữ liệu.

**Nguyên nhân:**
1. `DATE(created_at)` trả JS Date object làm key Map, lookup bằng string `'YYYY-MM-DD'` → không bao giờ khớp
2. `startDate` theo giờ local (UTC+7) nhưng key build bằng `toISOString()` (UTC) → label lệch 1 ngày, thiếu hôm nay

**Fix:** `adminController.js` — dùng `DATE_FORMAT(...,'%Y-%m-%d')` (string key), `startDate` UTC (`setUTCHours`), helper `buildChartDayKeys()` chung 2 endpoint.

**Test:** `days=7` → `[4,0,3,2,16,1,2]` khớp probe DB; health 200.

---

## 🎯 TRẠNG THÁI HIỆN TẠI

- [x] Tạo fix.md
- [x] Task 1: Pull-to-refresh — Code đã đúng, hoạt động
- [x] Task 2: Image placeholder — Thêm `defaultSource` cho Image (Feed, ImageViewer, VideoPost)
- [x] Task 3: Error Boundary — Tạo `ErrorBoundary.tsx` + HOC `withErrorBoundary`
- [x] Task 4: Seen indicator — Socket `messages_marked_read` + UI `✓/✓✓` đã có sẵn
- [x] Task 5: KeyboardAvoidingView — `chat/[id].tsx` + `group-chat/[id].tsx` đều có rồi
- [x] Task 6: Realtime Admin (socket `admin_new_user`/`admin_new_post` + toast nút "Tải ngay") — verify script Node 12/09/2026
- [ ] Technical debt: Optimistic reactions, Comment pagination (reserve)

*Hoàn thành ngày: $(date)*