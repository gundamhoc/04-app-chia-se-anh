-- ============================================================
-- Bảng messages: Quản lý tin nhắn 1-1 trực tiếp giữa 2 người dùng
-- Hỗ trợ tin nhắn văn bản và tin nhắn hình ảnh (tải lên Google Drive)
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_id INT UNSIGNED NOT NULL,
  receiver_id INT UNSIGNED NOT NULL,
  message_text TEXT NULL,
  image_url VARCHAR(500) NULL,
  file_url VARCHAR(500) NULL,
  file_name VARCHAR(255) NULL,
  file_size INT UNSIGNED NULL,
  file_type VARCHAR(100) NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sender_receiver (sender_id, receiver_id),
  INDEX idx_receiver_unread (receiver_id, is_read),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
