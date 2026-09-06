-- Migration: Bổ sung các cột lưu trữ thông tin tệp tin vào bảng messages
-- file_url: Link tải hoặc xem tệp tin (Google Drive hoặc lưu trữ nội bộ)
-- file_name: Tên gốc của tệp tin (vd: index.js, document.pdf, photo.png)
-- file_size: Dung lượng tệp tin (tính bằng byte)
-- file_type: Định dạng MIME hoặc phần mở rộng của tệp tin

ALTER TABLE messages
  ADD COLUMN file_url VARCHAR(500) NULL AFTER image_url,
  ADD COLUMN file_name VARCHAR(255) NULL AFTER file_url,
  ADD COLUMN file_size INT UNSIGNED NULL AFTER file_name,
  ADD COLUMN file_type VARCHAR(100) NULL AFTER file_size;
