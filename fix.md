# 🔧 FIX.md — Kế hoạch sửa lỗi rà soát toàn app (mobile)

> Nguồn: Audit backend + frontend mobile theo 55 kịch bản TESTER.md.
> Phạm vi: KHÔNG audit `website/`, `admin/` giao diện — NGOẠI TRỪ backend route admin phải đảm bảo Admin Portal vẫn dùng token hoạt động.
> Quy trình theo PROTOCOL.md: Phân tích → Code → Test từng phần → Verify → Ghi log AI_CONTEXT.md.
> (File này được viết lại sạch UTF-8 sau sự cố encoding do PowerShell 5.1.)

---

## 📌 QUYẾT ĐỊNH ĐÃ CHỐT

| # | Vấn đề | Quyết định | Căn cứ |
|---|--------|-----------|--------|
| Q1 | Cho phép người lạ chat 1-1? | **GIỮ — là FEATURE**, chỉ thêm validate receiver tồn tại + chặn tự nhắn | Log AI_CONTEXT "Khắc phục Điểm nghẽn UX" |
| Q2 | `replaced` có gửi notification? | **KHÔNG** (giống Facebook) | Yêu cầu "làm theo đề xuất" phiên FB |
| Q3 | Chủ bài được xóa comment người khác trên bài mình? | **GIỮ** (thiết kế có chủ đích trong commentController) | Test E2E 111/111 pass |

---

## 🔥 ĐỢT 1 — BẢO MẬT

### B1. `GET /api/messages/download/:messageId` — IDOR (KHÔNG cần đăng nhập) ✅ XONG
- Route đặt TRƯỚC `router.use(authMiddleware)` → ai có messageId tải được file của ai.
- **Đã sửa**: đưa vào sau `authMiddleware`; `downloadMessageFile` kiểm tra sender / receiver / group member. FE không gọi endpoint này (tải thẳng Google Drive) → không sửa FE.

### B2. `adminRoutes.js` — đa số route admin KHÔNG cần token ✅ XONG
- **Đã sửa**: chỉ `POST /auth/login` public; mọi route khác `verifyAdminToken` + `requireStaffOrAdmin`. Admin Portal (`admin/app.js`) thêm `?token=` cho URL `<video src=.../admin/posts/:id/stream>` (vì verifyAdminToken vốn hỗ trợ query token).

### B2b. Cross-token privilege (PHÁT HIỆN THÊM KHI CODE) ✅ XONG
- Token admin `{admin_id, id}` → user thường có `id` trùng `admin_id` dùng được API admin và ngược lại.
- **Đã sửa**: `auth.js` chặn token có `admin_id`; `adminAuth.js` BẮT BUỘC `admin_id` (không fallback `decoded.id`).

### B3. Comment endpoints không kiểm tra quyền xem bài ✅ XONG
### B4. `react`/`save`/`repost` không kiểm tra tồn tại + quyền ✅ XONG
- **Đã sửa**: helper mới `canViewPhoto(photoId, viewerId)` trong `photoController.js` (owner; private→chỉ owner; recipient→gửi+nhận; friends→bạn accepted; public→tất cả nhưng chặn người lạ nếu tác giả `is_private_account=1`). Áp cho `getComments`, `createComment`, `deleteComment`, `toggleCommentReaction` (commentController) và `toggleReaction`, `toggleSavePhoto`, `toggleRepost` (photoController).

### B5. `sendMessage` 1-1 thiếu kiểm tra receiver ✅ XONG
- Helper `validateDirectReceiver`: receiver tồn tại + `is_active` (404), chặn tự nhắn (400). Áp `sendMessage`/`sendImageMessage`/`sendFileMessage`.

### B6 + B7. Socket không xác thực / join phòng tùy ý ✅ XONG
- `io.use` verify JWT `socket.handshake.auth.token` (chặn token admin); `socket.userId` từ token.
- `user_online`/`user_offline`: dùng `socket.userId`, bỏ tin `data.userId`.
- `join_group`: verify `group_members` trước khi join; helper `leaveGroupRoom` + gọi khi removeMember.
- `join_conversation`: room `chat_` LUÔN server tính từ `socket.userId` (bỏ `conversationId` client gửi).
- `group_typing`: senderId = `socket.userId`.
- FE: `socketService.connectSocket(userId, tokenArg)` thêm `auth:{token}`; `authStore` 3 call sites truyền token tường minh (vì `connectSocket` chạy TRƯỚC `set({token})`).

### ✅ Test Đợt 1 — 42/42 PASS (script `backend/qa_sec_test.js`, ĐÃ XÓA sau test)

---

## 🥈 ĐỢT 2 — RACE CONDITION / LOGIC ✅ XONG (2026-09-11)

### B12. Chat screen: `fetchMessages()` `setMessages(data.messages)` đè mất tin realtime đang bay về giữa fetch ✅
- **Đã sửa**: merge dedup theo `m.id` (map prev), giữ `is_read` local, giữ tin realtime mới hơn response, sort theo id.

### B11. `messages.tsx`: socket `new_direct_message` vừa update cục bộ VỪA refetch toàn bộ → double render + race fetch cũ đè mới ✅
- **Đã sửa**: guard sequence-number (`loadSeqRef`) chống response cũ ghi đè mới; `new_direct_message` chỉ refetch khi danh sách CHƯA có hội thoại đó, ngược lại cập nhật cục bộ `last_message_*` + `unread_count` rồi sort lại (helper `compareConversationsOrder` khớp SQL).
- Test: `npx tsc --noEmit` 0 lỗi + node script mô phỏng logic merge/sort/guard PASS (không giữ file).

## 🥉 ĐỢT 3 — NHỎ ✅ XONG (2026-09-11)

- ✅ B10. `profile.tsx` optimistic `photo_reaction_updated`: `replaced` KHÔNG +1 (`added` +1, `removed` -1, `replaced` giữ nguyên).
- ✅ B14. Notification `like_post` đã có dedup trong `notificationService` (đã verify OK — không cần sửa).
- ✅ `removeMember` (`groupController.js`): chặn admin đá admin khác (403); chặn admin CUỐI CÙNG rời nhóm khi còn thành viên (403, hướng dẫn phân quyền trước); target không tồn tại trong nhóm → 404. FE `group-chat/[id].tsx`: ẩn nút Xóa trên thành viên là admin.
- ✅ Doc-sync: AI_CONTEXT mục Database/`.env`/schema/PROMPT mẫu đã cập nhật đúng nền thật **TiDB Cloud Serverless** (kèm ghi chú lịch sử Local → Aiven → TiDB), che secret khỏi tài liệu.
- Test: `node qa_group_test.js` 9/9 PASS API-level (kick member OK, kick admin 403 hai chiều, không-phải-admin-cuối rời OK, admin-cuối-bị-chặn 403, solo admin rời OK, 404 non-member) + `npx tsc --noEmit` 0 lỗi. Script + dữ liệu QA đã XÓA/dọn sạch.

---

## 📝 TRẠNG THÁI
- [x] Đợt 1 — B1 → B7 + B2b (42/42 PASS, 2026-09-10). Đã ghi log AI_CONTEXT.md.
- [x] Đợt 2 — B11, B12 (XONG 2026-09-11, tsc 0 lỗi + logic test PASS). Đã ghi log AI_CONTEXT.md.
- [x] Đợt 3 — B10, group admin rule, doc-sync (XONG 2026-09-11, 9/9 PASS). Đã ghi log AI_CONTEXT.md.

## ⚠️ GHI CHÚ SỰ CỐ ENCODING (đã khắc phục)
- Một số edit qua `Get-Content -Raw | Set-Content` trong PowerShell 5.1 làm **mojibake UTF-8** tại: `fix.md`, `database/photo_reactions.sql`, `database/comments.sql`.
- **Đã khôi phục**: 2 file SQL restore từ `git checkout HEAD` rồi đổi unique key lại bằng **node (UTF-8 an toàn)**; `fix.md` viết lại sạch. Backend JS/TS frontend KHÔNG bị ảnh hưởng (đã scan moji=0). Từ nay dùng `node`/write-tool cho file có tiếng Việt, tránh `Set-Content -Encoding UTF8` của PS 5.1 (thêm BOM + double-encode).

---

# 🚀 ĐỢT 4 — KEEP-ALIVE RENDER + CẦU DAO TEST SERVER TRONG APP (ĐANG LÀM)

> Bối cảnh: Người dùng muốn (1) Render free chạy gần 24/24 để demo, (2) test code mới liên tục bằng ngrok trên điện thoại mà KHÔNG phải sửa `frontend/.env` + restart Expo mỗi lần.
> Sự thật đã verify: Render `zero4-app-chia-se-anh.onrender.com` health 200 nhưng cold-start 32.6s (free tier ngủ sau ~15 phút); Render đang chạy code CŨ (26 file sửa ở máy chưa push).

## Kiến trúc 2 tầng
- **Render** = URL cố định cho demo/production + build APK (`eas.json preview` đã trỏ sẵn).
- **ngrok** = cây cầu tạm để điện thoại test code MỚI trên máy khi chưa push.

## Các file sẽ sửa/tạo
1. **`frontend/constants/servers.ts`** (MỚI): constant `RENDER_URL`, `NGROK_URL` (quy tắc: không hardcode rải rác).
2. **`frontend/services/api.ts`**:
   - `currentBaseUrl` mutable + key storage `api_base_override` (dùng `utils/storage.ts` đa nền tảng có sẵn).
   - `loadApiOverride()`: đọc storage lúc khởi động → override cao nhất; không có thì giữ luồng cũ (env → LAN → localhost).
   - `applyApiBaseUrlOverride(url|null)`: đổi `api.defaults.baseURL` ngay lúc chạy; null = trả về mặc định.
   - Export `getApiBaseUrl()`.
3. **`frontend/services/socketService.ts`**: `SOCKET_URL` tính lúc connect bằng `getApiBaseUrl()` (bỏ const tĩnh).
4. **`frontend/store/authStore.ts`**: `loadStoredAuth()` await `loadApiOverride()` trước khi verify profile (chống race server cũ/mới).
5. **`frontend/components/SettingsModal.tsx`**: mục **🧪 Developer (chỉ `__DEV__`)** trong phần Hỗ trợ: chip `☁️ Render` / `🚇 Ngrok` / `📶 Mặc định (LAN/env)` + ô URL tùy chỉnh; chọn → lưu storage → `disconnectSocket()` + `connectSocket()` lại → toast; đổi server xong nhắc đăng nhập lại (JWT/DB mỗi nơi khác nhau).
6. **`frontend/utils/i18n.ts`**: keys mới vi/en cho mục Developer.
7. **`.github/workflows/keep-alive.yml`** (MỚI): GitHub Actions cron mỗi 10 phút `curl /api/health` → Render gần như không ngủ đông → socket realtime ổn định, không chờ 30s.
8. **Chuẩn bị commit (KHÔNG push tới khi user lệnh)**: tách 3 commit — `fix(reaction)`, `fix(security) dot 1`, `feat(dev)` + docs. Loại trừ `website/*` (dirty từ phiên trước, user chưa xác nhận).

## Test dự kiến
- `npx tsc --noEmit` 0 lỗi; workflow YAML parse OK; logic override test bằng node script tạm (mô phỏng đọc storage) → XÓA sau test.
- Manual checklist user: Settings → Developer → chọn Ngrok → log `🌐 [API] Base URL` đổi → feed load qua ngrok; chọn Render → re-login → feed qua Render.

## ✅ TRẠNG THÁI ĐỢT 4 — HOÀN THÀNH (chưa commit/push)
- [x] 1 `frontend/constants/servers.ts` (RENDER + NGROK + mặc định)
- [x] 2 `services/api.ts` — override `api_base_override` + `applyApiBaseUrlOverride` / `loadApiOverride` / `getApiBaseUrl` / `getApiOrigin` (bỏ export `BASE_URL` const stale, đổi 3 file gọi sang `getApiOrigin()`)
- [x] 3 `services/socketService.ts` — `io(getApiOrigin())` tính lúc connect + đóng socket cũ khi đổi server
- [x] 4 `store/authStore.ts` — `loadStoredAuth()` await `loadApiOverride()` trước verify token
- [x] 5 `components/SettingsModal.tsx` — mục 🧪 Developer (chỉ `__DEV__`): 3 chip Render/Ngrok/Mặc định + ô URL tùy chỉnh + auto-reconnect socket
- [x] 6 i18n: dùng inline vi/en trong SettingsModal (không cần keys mới — giữ gọn)
- [x] 7 `.github/workflows/keep-alive.yml` — cron `*/10` ping `/api/health` (YAML parse OK)
- [x] 8 `npx tsc --noEmit` 0 lỗi; logic normalize URL test OK mọi case trailing `/api/`
- [ ] Push + Render redeploy (CHỜ người dùng ra lệnh)

---

# 📦 COMMIT + DEPLOY — ✅ HOÀN THÀNH (2026-09-11)
- Đã push `main` 3 commit: `fb5083a` security+reaction BE → `3e9dc7c` FE (dev switch + Dot 2-3) → `9764f6f` chore/docs/website/keep-alive.
- Render redeploy code mới, verify cloud `qa_cloud_test.js` 15/15 PASS (health, register, feed+auth, IDOR 401, receiver 404, admin 401, group admin rule 403, socket reject-no-token / accept-token). Script + dữ liệu QA đã XÓA/dọn sạch. `website/**` + `i18n.ts` được user duyệt commit kèm.

## (Tài liệu cũ) KHUYẾN NGHỊ TÁCH COMMIT — ĐÃ THỰC HIỆN theo Khuyến nghị A

> **CẢNH BÁO quan trọng**: các thay đổi Reaction, Security Đợt 1 và Dev-bridge **xen lẫn trong CÙNG nhiều file** (`photoController.js`, `commentController.js`, `messageController.js`, `socketService.ts`, `authStore.ts`, `profile.tsx`). Không thể tách thành 3 commit ĐỘC LẬP chạy được, vì mỗi commit trung gian sẽ gọi hàm chưa được thêm ở commit sau (ví dụ `canViewPhoto` / `getApiOrigin`). Bisect history sẽ đỏ nếu tách cưỡng ép.

## Khuyến nghị A (đơn giản, an toàn) — GOM theo tầng, mỗi commit tự chạy được
1. **`fix: security (Dot 1) + FB-style reaction — backend`**
   - `backend/src/controllers/{photo,comment,message,group}Controller.js`
   - `backend/src/middlewares/{auth,adminAuth}.js`
   - `backend/src/routes/{adminRoutes,messageRoutes}.js`
   - `backend/src/sockets/socketHandler.js`
   - `database/photo_reactions.sql`, `database/comments.sql`
2. **`feat: server switch (dev) + realtime token auth — frontend`**
   - `frontend/constants/servers.ts` (MỚI)
   - `frontend/services/{api,socketService}.ts`, `frontend/store/authStore.ts`
   - `frontend/app/(tabs)/{profile}.tsx`, `frontend/app/user/[id].tsx`, `frontend/components/EditProfileModal.tsx` (đổi BASE_URL -> getApiOrigin)
   - `frontend/app/(tabs)/index.tsx`, `frontend/components/CommentModal.tsx` (dock highlight reaction)
   - `frontend/app/(tabs)/messages.tsx`, `frontend/app/chat/[id].tsx` (Đợt 2: race condition merge + seq guard)
   - `frontend/app/group-chat/[id].tsx` (Đợt 3: ẩn nút xóa trên admin)
   - `frontend/components/SettingsModal.tsx` (mục Developer)
3. **`chore: admin portal token + docs (AI_CONTEXT/TESTER/fix/AGENTS) + keep-alive workflow`**
   - `admin/app.js`, `.github/workflows/keep-alive.yml`, `AI_CONTEXT.md`, `TESTER.md`, `fix.md`, `AGENTS.md`

## Khuyến nghị B (nếu muốn tách reaction riêng) — PHẢI dùng `git add -p` chọn từng hunk
Chỉ tách được reaction-FE (`index.tsx` dock, `CommentModal` dock, `profile` optimistic) sang riêng, CÒN reaction-BE dính security trong `photo/commentController` -> không tách được. Vì vậy B không sạch bằng A.

## KHÔNG đưa vào commit (dirty từ phiên trước, chưa xác nhận)
- `website/**` (styles.css, index.html, script.js, qr_code.png), `frontend/utils/i18n.ts` — phiên trước để lại, hỏi user trước khi commit.

## Lệnh tham khảo (KHÔNG chạy tới khi user bảo) — theo Khuyến nghị A
```bash
git add backend/src/controllers backend/src/middlewares backend/src/routes backend/src/sockets database/photo_reactions.sql database/comments.sql
git commit -m "fix: security (Dot 1 IDOR/privacy/socket) + FB-style single-reaction backend"

git add frontend/constants/servers.ts frontend/services/api.ts frontend/services/socketService.ts frontend/store/authStore.ts "frontend/app/(tabs)/profile.tsx" "frontend/app/user/[id].tsx" frontend/components/EditProfileModal.tsx "frontend/app/(tabs)/index.tsx" frontend/components/CommentModal.tsx frontend/components/SettingsModal.tsx
git commit -m "feat: runtime server switch (dev) + socket JWT auth + FB reaction UI"

git add admin/app.js .github/workflows/keep-alive.yml AI_CONTEXT.md TESTER.md fix.md AGENTS.md
git commit -m "chore: admin portal token, Render keep-alive workflow, docs"

# Render deploy TREN TAI NGUYEN backend/ -> push se tu dong redeploy (code moi co security)
# git push origin main   # <== CHAY KHI USER XAC NHAN
```


