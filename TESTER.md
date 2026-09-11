# 🧪 TESTER.md — 55 Kịch Bản Trải Nghiệm Masita (Góc Nhìn Người Dùng Mới)

> **Mục đích**: Giả làm một người dùng mới toanh, tải app về và "mò mẫm" mọi ngóc ngách với sự thích thú, đồng thời soi lỗi.
> **Cách dùng**: Chạy từng kịch bản theo thứ tự trên thiết bị thật (Android/iOS/Web), tick `[ ]` → `[x]` khi PASS.
> **Quy ước**: ❌ = FAIL (ghi chú lại bug) | ⚠️ = PASS nhưng có điểm khó chịu (UX) | ✅ = OK

---

## 🚪 Phần A — Lần đầu chạm ngõ & Tạo tài khoản (TC-01 → TC-08)

### TC-01: Mở app lần đầu
- **Tôi là**: người vừa cài APK, mở app lên với tâm thế tò mò.
- **Kịch bản**: Chờ màn hình loading chuyển hướng.
- **Kỳ vọng**: Không trắng màn hình, không crash, tự đưa về màn hình Đăng nhập, logo Masita hiển thị sắc nét, nền sáng (Light mặc định).
- [ ] PASS

### TC-02: Đăng ký tài khoản "xịn"
- **Kịch bản**: Bấm "Đăng ký ngay" → điền Tên hiển thị `Test Thủ`, username `thuthu.moi`, email `thuthu@test.com`, mật khẩu `123456`, xác nhận khớp → bấm "Tạo tài khoản".
- **Kỳ vọng**: Toast xanh thành công, chờ ~1.5s rồi tự vào Home Feed, không quay lại login.
- [ ] PASS

### TC-03: Đăng ký "báo" — email trùng
- **Kịch bản**: Đăng xuất, thử đăng ký lại với đúng email `thuthu@test.com`.
- **Kỳ vọng**: Toast ĐỎ thông báo lỗi tiếng Việt dễ hiểu ("Email đã được sử dụng..."), KHÔNG crash, form giữ nguyên dữ liệu đã nhập.
- [ ] PASS

### TC-04: Đăng ký "báo" — mật khẩu không khớp / quá ngắn
- **Kịch bản**: (a) Xác nhận mật khẩu khác mật khẩu. (b) Mật khẩu chỉ 3 ký tự.
- **Kỳ vọng**: Chặn ngay tại frontend bằng thông báo rõ ràng, không kịp gọi API.
- [ ] PASS

### TC-05: "Quên mật khẩu" khi tôi gõ nhầm Gmail
- **Kịch bản**: Ở màn login → bấm "Quên mật khẩu?" → nhập gmail KHÔNG có trong hệ thống `khongtonTai@zmail.com` → Gửi.
- **Kỳ vọng**: Báo "Gmail đó không có trong hệ thống." Modal không đóng vô lý, còn email tồn tại thì báo "Đã lưu lại thông tin, admin sẽ gửi mã cho bạn!".
- [ ] PASS

### TC-06: Đăng nhập + Lưu tài khoản
- **Kịch bản**: Đăng nhập đúng → tick "Lưu tài khoản" → vào app → đăng xuất → mở lại login.
- **Kỳ vọng**: Email `thuthu@test.com` tự điền sẵn, tôi chỉ cần gõ mật khẩu.
- [ ] PASS

### TC-07: Đăng nhập sai mật khẩu 5 lần
- **Kịch bản**: Nhập sai mật khẩu liên tục.
- **Kỳ vọng**: Mỗi lần sai đều có toast đỏ lịch sự, không bị khóa app, không màn hình trắng, lần cuối nhập đúng thì vào bình thường.
- [ ] PASS

### TC-08: Tắt wifi rồi đăng nhập (mạng yếu)
- **Kịch bản**: Bật chế độ máy bay → bấm Đăng nhập.
- **Kỳ vọng**: Thông báo thân thiện *"Không thể kết nối đến máy chủ..."* (không phải "Network Error" tiếng Anh thô), app không crash, bật mạng lại thử ngay được.
- [ ] PASS

---

## 👤 Phần B — Hồ sơ cá nhân (TC-09 → TC-15)

### TC-09: "Ồ mình có trang cá nhân!"
- **Kịch bản**: Vào tab Hồ sơ.
- **Kỳ vọng**: Thấy avatar, @username, bio, ảnh bìa gradient mặc định đẹp mắt, 4 chỉ số (Bài viết | Lượt thích | Đã lưu | Đăng lại) đều = 0 cho người mới.
- [ ] PASS

### TC-10: Đổi ảnh đại diện từ camera
- **Kịch bản**: Bấm bút chì ✏️ trên avatar → chọn "Chụp ảnh" → cấp quyền camera → chụp → Lưu.
- **Kỳ vọng**: Ảnh hiện ngay trên Hồ sơ, Feed và mọi nơi khác (đồng bộ avatar toàn app), không phải ảnh vỡ.
- [ ] PASS

### TC-11: Đổi ảnh bìa (Cover Banner)
- **Kịch bản**: Bấm 📷 "Đổi ảnh bìa" → chọn từ thư viện.
- **Kỳ vọng**: Avatar đè 50% lên ảnh bìa như Facebook, bo viền đẹp, không lệch bố cục.
- [ ] PASS

### TC-12: Chỉnh sửa hồ sơ — bàn phím có che không?
- **Kịch bản**: Mở "✏️ Chỉnh sửa hồ sơ" → Tap ô Tên → gõ → Tap ô Bio → gõ 140 ký tự.
- **Kỳ vọng**: Bàn phím KHÔNG che ô nhập (đã fix), bộ đếm ký tự bio cập nhật realtime, Lưu xong thấy tên mới ngay.
- [ ] PASS

### TC-13: Xem 4 sub-tabs Hồ sơ
- **Kịch bản**: Lần lượt bấm 📸 Bài viết / ❤️ Đã thích / 🔖 Lưu bài viết / 🔁 Đăng lại khi chưa có gì.
- **Kỳ vọng**: Mỗi tab có empty state dễ thương (không phải khoảng trắng vô hồn), bấm cột số thống kê cũng nhảy đúng tab tương ứng.
- [ ] PASS

### TC-14: Chia sẻ hồ sơ của tôi
- **Kịch bản**: Bấm nút "↗️ Chia sẻ" trên Hồ sơ.
- **Kỳ vọng**: Trên mobile mở bảng chia sẻ hệ thống; link dạng `https://masita.app/u/thuthu.moi` hợp lệ.
- [ ] PASS

### TC-15: Reload bằng kéo-thả (Pull-to-refresh)
- **Kịch bản**: Kéo thả trang Hồ sơ xuống.
- **Kỳ vọng**: Có phản hồi loading, nhả ra dữ liệu reload mượt, không giật.
- [ ] PASS

---

## 👥 Phần C — Kết bạn & Tìm kiếm người (TC-16 → TC-22)

### TC-16: Tìm người bạn đầu tiên
- **Kịch bản**: Vào tab Bạn bè → gõ tên/username bạn đã biết ở thanh tìm kiếm.
- **Kỳ vọng**: Kết quả realtime nhanh, chia rõ 2 nhóm "👥 Bạn bè của bạn" và "➕ Tìm kết bạn mới", ảnh đại diện + nút "+ Kết bạn" hiển thị đủ.
- [ ] PASS

### TC-17: Gửi lời mời rồi đổi ý
- **Kịch bản**: Bấm "+ Kết bạn" → nút đổi thành "Đã gửi ✓" → bấm vào "Đã gửi" để hủy.
- **Kỳ vọng**: Toggle chính xác 2 chiều, trạng thái không "treo" giữa chừng.
- [ ] PASS

### TC-18: Được kết bạn — cảm xúc lan tỏa
- **Kịch bản**: Dùng máy B gửi lời mời cho `thuthu.moi`. Trên máy A: thấy chấm đỏ ở tab Bạn bè → vào tab "Lời mời" → bấm "Chấp nhận".
- **Kỳ vọng**: Toast/Notification realtime nổi lên dù đang ở màn hình khác; chấp nhận xong cả 2 máy thành "Bạn bè ✓".
- [ ] PASS

### TC-19: Gợi ý kết bạn — ai đây?
- **Kịch bản**: Mở sub-tab "Gợi ý kết bạn".
- **Kỳ vọng**: Danh sách người chưa kết bạn, KHÔNG xuất hiện người đã là bạn bè / đã gửi lời mời; bấm "+ Kết bạn" ngay từ đây được.
- [ ] PASS

### TC-20: Từ chối lời mời khó ở
- **Kịch bản**: Có lời mời từ người lạ → bấm "Xóa/Từ chối".
- **Kỳ vọng**: Lời mời biến mất khỏi danh sách + badge trừ đúng, reload lại không thấy quay lại.
- [ ] PASS

### TC-21: Xem profile người khác bằng cách... chạm bừa
- **Kịch bản**: Từ Feed, bấm avatar của người lạ; từ Chat bấm tên bạn; từ Kết quả tìm kiếm bấm vào người dùng.
- **Kỳ vọng**: Cả 3 đường đều mở trang cá nhân người đó (`/user/[id]`), thấy stats + lưới ảnh của họ, nút hành động đúng quan hệ (`+ Thêm bạn bè` / `💬 Nhắn tin` / `Bạn bè ✓`).
- [ ] PASS

### TC-22: Hủy kết bạn (tình cảm mong manh)
- **Kịch bản**: Trong tab Bạn bè → bấm hủy kết bạn → xác nhận.
- **Kỳ vọng**: Có hộp thoại xác nhận (không hủy lén), bạn biến mất khỏi danh sách, trạng thái 2 phía đồng bộ.
- [ ] PASS

---

## 📸 Phần D — Đăng khoảnh khắc & Bảng tin (TC-23 → TC-32)

### TC-23: Đăng tấm ảnh đầu tiên đời
- **Kịch bản**: Bấm "+ Khoảnh khắc" → chọn "🖼️ Chọn từ thư viện" → chọn ảnh → nhập caption "Ngày đầu trên Masita ✨" → "Chia sẻ".
- **Kỳ vọng**: LoadingOverlay "Đang tải khoảnh khắc lên... 📸" hiện ra, xong về Feed thấy ngay bài của mình, ảnh hiển thị fullHD không lỗi URI.
- [ ] PASS

### TC-24: Chụp bằng camera luôn (không qua thư viện)
- **Kịch bản**: "+ Khoảnh khắc" → "📷 Chụp ảnh mới".
- **Kỳ vọng**: Mở thẳng camera native ( KHÔNG bung trình chọn file), chụp xong quay về form đăng, có nút "🔄 Chọn ảnh khác".
- [ ] PASS

### TC-25: Bài đăng đầu tiên của bạn bè xuất hiện trên Feed
- **Kịch bản**: Máy B đăng bài. Trên máy A (tab ✨ Tất cả hoặc 👥 Bạn bè) kéo refresh.
- **Kỳ vọng**: Bài của bạn xuất hiện, realtime hơn nữa thì không cần refresh (socket `new_photo_posted`).
- [ ] PASS

### TC-26: Bộ 3 bộ lọcFeed: ✨ Tất cả / 👥 Bạn bè / 🌐 Khám phá
- **Kịch bản**: Chuyển qua lại 3 tab lọc.
- **Kỳ vọng**: `Tất cả` = mình + công khai + bạn bè; `Bạn bè` = chỉ mình + bạn; `Khám phá` = chỉ bài công khai của người lạ. Không lẫn lộn.
- [ ] PASS

### TC-27: Bài Riêng tư của tôi — người lạ có thấy không?
- **Kịch bản**: Đăng bài chọn 🔒 Riêng tư → lấy máy B (không kết bạn) mở Khám phá.
- **Kỳ vọng**: Máy B KHÔNG thấy bài; chính tôi vẫn thấy ở tab Tất cả kèm badge 🔒.
- [ ] PASS

### TC-28: Bài Bạn bè — chỉ bạn thấy
- **Kịch bản**: Đăng bài `👥 Bạn bè coi` → kiểm tra bằng máy C chưa kết bạn và máy D đã kết bạn.
- **Kỳ vọng**: C không thấy, D thấy. Toggle privacy qua "✏️ Chỉnh sửa bài đăng" thì feed cập nhật tức thì.
- [ ] PASS

### TC-29: Tìm bài viết như tìm kho báu
- **Kịch bản**: Bấm 🔍 trên Header Feed → gõ từ khóa caption / tên tác giả → thử cả 2 chip phạm vi.
- **Kỳ vọng**: Có banner số kết quả, lọc realtime mượt, không có kết quả thì gợi ý "🌐 Tìm trong Khám phá".
- [ ] PASS

### TC-30: Lướt vô tận (Infinite scroll)
- **Kịch bản**: Cuộn Feed liên tục xuống đáy (cần DB có >15 bài).
- **Kỳ vọng**: Tự nạp thêm trang mới mượt, có spinner nhỏ, hết bài thì báo "đã xem hết" thay vì tải mãi.
- [ ] PASS

### TC-31: Skeleton loading có dễ thương không?
- **Kịch bản**: Tắt mạng → vào Feed → Bật mạng giữa lúc skeleton đang nhấp nháy → refresh.
- **Kỳ vọng**: FeedSkeleton hiển thị khung xương đẹp (không vòng xoay đơn điệu), có trạng thái lỗi/rỗng rõ ràng khi không có mạng.
- [ ] PASS

### TC-32: Chỉnh sửa & Xóa bài của mình
- **Kịch bản**: Bấm ••• trên bài của mình → "Chỉnh sửa bài đăng" đổi caption → lưu; sau đó "Xóa bài đăng".
- **Kỳ vọng**: Có confirm trước khi xóa, bài biến mất khỏi Feed + Hồ sơ ngay không cần refresh.
- [ ] PASS

---

## ❤️ Phần E — Tương tác: Thích, Bình luận, Chia sẻ, Lưu (TC-33 → TC-38)

### TC-33: Tim đầu tiên — chạm nhanh & ấn giữ
- **Kịch bản**: Chạm nút "Thích" (toggle ❤️), sau đó **ấn giữ** ~220ms.
- **Kỳ vọng**: Chạm nhanh = thích luôn bằng ❤️; ấn giữ = dock emoji nổi (`❤️🔥😂😮😢`) hiện mượt; chọn emoji khác xong dock tự đóng; số like trên nút cập nhật tức thì.
- [ ] PASS

### TC-34: Badge top 2 cảm xúc trên ảnh
- **Kịch bản**: Nhờ 3-4 người thả nhiều loại emoji lên 1 bài.
- **Kỳ vọng**: Góc ảnh chỉ hiển thị ĐÚNG 2 emoji phổ biến nhất + tổng số (vd `❤️🔥 5`), không tràn, không 3 emoji.
- [ ] PASS

### TC-35: Bình luận & trả lời "thread"
- **Kịch bản**: Mở 💬 Bình luận → gửi bình luận → bấm "💬 Trả lời" trên chính nó → gửi reply → reload lại.
- **Kỳ vọng**: Reply gắn `@username`, hiển thị lồng đúng cấp, số comment trên nút 💬 cộng dồn đúng.
- [ ] PASS

### TC-36: Thả tim & xóa bình luận
- **Kịch bản**: Thả cảm xúc lên bình luận của bạn (long-press nút "Thích" trong comment), sau đó thử xóa bình luận CỦA NGƯỜI KHÁC và của MÌNH.
- **Kỳ vọng**: Badge emoji hiện trên comment; xóa comment người khác bị chặn; xóa comment mình có confirm rồi biến mất, comment cha con xử lý hợp lý.
- [ ] PASS

### TC-37: Menu Chia sẻ đa năng
- **Kịch bản**: Bấm ↗️ Chia sẻ → lần lượt: "💾 Lưu ảnh về máy" (cấp quyền), "🔗 Sao chép link", "📤 Chia sẻ qua app khác" (Zalo/Messenger).
- **Kỳ vọng**: Ảnh về gallery thật (chỉ xin quyền Ảnh, không đòi Audio), clipboard hoạt động, share hệ thống mở đúng.
- [ ] PASS

### TC-38: 🔖 Lưu bài & 🔁 Đăng lại của người lạ
- **Kịch bản**: Mở ••• trên bài người lạ → "Lưu bài viết" → xem tab Hồ sơ → Đã lưu; rồi "Đăng lại" → xem tab Đăng lại; bấm vào bài đã lưu → "Bỏ bài viết".
- **Kỳ vọng**: Badge "Đã lưu ✓"/"Đã đăng lại ✓" phản ánh đúng, lưới 3x3 trên profile cập nhật, cột thống kê Đã lưu/Đăng lại tăng giảm đúng.
- [ ] PASS

---

## 💬 Phần F — Chat 1-1 (TC-39 → TC-45)

### TC-39: Tin nhắn đầu tiên "alo alo 👋"
- **Kịch bản**: Từ tab Bạn bè bấm "💬 Nhắn tin" cho bạn.
- **Kỳ vọng**: Header hiện ĐÚNG TÊN bạn (không phải "Người bạn"), avatar đúng, gửi tin → bong bóng tôi bên phải, bạn nhận realtime + toast dù app đang ở tab khác.
- [ ] PASS

### TC-40: Thấy bạn online — tim đập nhanh
- **Kịch bản**: Bạn B mở app đăng nhập; quan sát trên danh sách Trò chuyện và trong chat của A.
- **Kỳ vọng**: Chấm xanh 🟢 + "Đang hoạt động" hiện ĐÚNG lúc B online, B tắt app → chuyển "Ngoại tuyến" (không báo ảo).
- [ ] PASS

### TC-41: Typing indicator "đang gõ..."
- **Kịch bản**: B mở phòng chat với A và gõ liên tục nhiều ký tự.
- **Kỳ vọng**: A thấy "[Tên] đang soạn tin... ✍️" realtime, dừng gõ ~vài giây thì indicator biến mất.
- [ ] PASS

### TC-42: Gửi đủ loại tệp tin
- **Kịch bản**: Bấm `+` → gửi (a) ảnh từ thư viện, (b) file `.txt`/`.py`, (c) file `.pdf`/`.zip` to.
- **Kỳ vọng**: Ảnh hiện trong chat xem full được; file văn bản/code bấm vào mở trình xem in-app dark theme; pdf/zip có nút tải về thành công; báo tiến trình upload rõ.
- [ ] PASS

### TC-43: Gửi video — xem như YouTube
- **Kịch bản**: Gửi video ~20-50MB → bấm vào video trong chat → tua đến cuối rồi tua lại đầu.
- **Kỳ vọng**: Player in-app mở mượt, streaming HTTP 206 tua tức thì không chờ tải trọn file, nút ⬇️ Tải về lưu vào gallery, không tốn pin "đứng hình".
- [ ] PASS

### TC-44: Hình nền chat — trang hoàng phòng riêng
- **Kịch bản**: ⚙️ → "🎨 Theme & Hình nền" → chọn preset vũ trụ → sau đó chọn "chụp ảnh làm nền".
- **Kỳ vọng**: Nền phủ TOÀN MÀN HÌNH (cả header + thanh nhập kiểu kính mờ), tin nhắn 2 phía đều đổi (đồng bộ 2 chiều), chữ trên bong bóng vẫn đọc rõ.
- [ ] PASS

### TC-45: Ghim, Tắt thông báo & Tìm trong chat
- **Kịch bản**: ⚙️ → "📌 Ghim" → thấy chat lên đầu list + huy hiệu 📌; "🔕 Tắt thông báo" → bạn nhắn tin KHÔNG toast; 🔍 tìm từ khóa đã nhắn → bấm `▼` điều hướng kết quả.
- **Kỳ vọng**: Ghim/mute là của RIÊNG tôi (bạn không bị ảnh hưởng), tìm kiếm highlight đúng bong bóng + cuộn tới nơi, bộ đếm `1/3` chính xác.
- [ ] PASS

---

## 👨‍👩‍👧‍👦 Phần G — Chat nhóm (TC-46 → TC-49)

### TC-46: Lập "hội những người bạn thân"
- **Kịch bản**: Tab Trò chuyện → "Tạo nhóm" → đặt tên "Hội Quán Net" + chọn avatar + tick 2-3 bạn → Tạo.
- **Kỳ vọng**: Nhóm xuất hiện trong list + tab "Nhóm", thành viên nhận thông báo được mời realtime.
- [ ] PASS

### TC-47: Chat nhóm đa phương tiện
- **Kịch bản**: Gửi tin nhắn, ảnh, video, file trong nhóm; 2 thành viên cùng nhắn dồn dập.
- **Kỳ vọng**: Tin hiển thị kèm tên+avatar người gửi, realtime đa phía không trùng/lộn thứ tự, gửi ảnh/video/file thành công như chat 1-1.
- [ ] PASS

### TC-48: Quản lý nhóm — thêm bạn, đá "member ảo", đổi avatar
- **Kịch bản**: Vào thông tin nhóm → thêm bạn bè → thử xóa 1 thành viên (với tài khoản admin/trưởng nhóm) → đổi avatar nhóm.
- **Kỳ vọng**: Danh sách cập nhật realtime, thành viên bị xóa không còn thấy nhóm, nhãn "Trưởng nhóm"/"Thành viên" đúng.
- [ ] PASS

### TC-49: Rời nhóm & "Hội tan"
- **Kịch bản**: Thành viên thường bấm "Rời nhóm"; trưởng nhóm thử rời khi còn người khác.
- **Kỳ vọng**: Có xác nhận, group list 2 phía đồng bộ, tin nhắn nhóm không còn hiện trên máy người đã rời.
- [ ] PASS

---

## 🔔 Phần H — Thông báo (TC-50 → TC-51)

### TC-50: Trung tâm thông báo có đầy đủ không?
- **Kịch bản**: Nhờ bạn: kết bạn, chấp nhận, thích bài, bình luận, mời vào nhóm, xóa bài (admin)... Sau đó mở chuông 🔔.
- **Kỳ vọng**: Mỗi loại có câu chữ rõ ràng + badge số chưa đọc đúng, bấm vào điều hướng đúng nơi (ảnh/bình luận/nhóm), KHÔNG bị double toast cùng 1 sự kiện.
- [ ] PASS

### TC-51: Tắt loại thông báo trong Cài đặt có ăn không?
- **Kịch bản**: Tắt "Thông báo tương tác" → nhờ bạn thả tim bài của tôi.
- **Kỳ vọng**: Không toast làm phiền (vẫn vào trung tâm thông báo), bật lại thì toast hoạt động tiếp.
- [ ] PASS

---

## ⚙️ Phần I — Cài đặt, Giao diện, Ngôn ngữ & linh tinh (TC-52 → TC-55)

### TC-52: Đổi ngôn ngữ — app có "biết nói" tiếng Anh không?
- **Kịch bản**: Cài đặt → Ngôn ngữ → English → lướt qua TOÀN BỘ: Feed, chat, comment, profile, login, thời gian (`2h ago`).
- **Kỳ vọng**: 100% đổi sang tiếng Anh, kể cả timestamp và toast validate; đổi về Tiếng Việt cũng vậy.
- [ ] PASS

### TC-53: Dark Mode OLED test
- **Kịch bản**: Bật Dark Mode → đi thăm từng màn hình + mọi modal (bình luận, chia sẻ, cài đặt chat...).
- **Kỳ vọng**: Không còn "điểm sáng lạc loài" (chỗ tối chỗ sáng lẫn lộn), status bar đổi theo, đọc rõ chữ.
- [ ] PASS

### TC-54: Bảo mật tài khoản — đổi Username / Email / Mật khẩu
- **Kịch bản**: Trong Cài đặt → Tài khoản: (a) đặt username trùng người khác; (b) đổi email nhưng sai mật khẩu hiện tại; (c) làm đúng cả hai; (d) đổi mật khẩu nhưng nhập sai email xác thực; (e) đúng email → đổi pass → đăng xuất → đăng nhập bằng mật khẩu CŨ rồi mật khẩu MỚI.
- **Kỳ vọng**: (a)(b)(d) bị chặn với thông báo rõ; (c)(e) thành công; pass mới đăng nhập được, pass cũ không.
- [ ] PASS

### TC-55: Quyền riêng tư tài khoản & Đăng xuất "an toàn"
- **Kịch bản**: Bật "Tài khoản riêng tư" + tắt "Tìm bằng username" → dùng máy người lạ search tôi & xem Khám phá; bật "Kiểm tra cập nhật tự động" → bấm "🧪 Giả lập có bản mới"; cuối cùng: Đăng xuất trong Cài đặt.
- **Kỳ vọng**: Người lạ không tìm/không thấy bài công khai của tôi; OTA hiện card có bản mới + changelog; đăng xuất có confirm → về login, quay lại app không tự vào trong.
- [ ] PASS

---

## 📋 Bảng tổng kết

| Phần |Kịch bản | Đã test | Pass | Fail | UX ⚠️ |
|------|--------|---------|------|-------|-------|
| A — Đăng ký/Login | TC-01→08 | | | | |
| B — Hồ sơ | TC-09→15 | | | | |
| C — Bạn bè | TC-16→22 | | | | |
| D — Feed & Bài đăng | TC-23→32 | | | | |
| E — Tương tác | TC-33→38 | | | | |
| F — Chat 1-1 | TC-39→45 | | | | |
| G — Chat nhóm | TC-46→49 | | | | |
| H — Thông báo | TC-50→51 | | | | |
| I — Cài đặt | TC-52→55 | | | | |
| **TỔNG** | **55** | | | | |

### 🐞 Ghi chú bug phát hiện
| # | Kịch bản | Hiện tượng | Mức độ (Ca/Th/BN) | Ảnh/Log |
|---|----------|------------|-------------------|---------|
| 1 | | | | |
