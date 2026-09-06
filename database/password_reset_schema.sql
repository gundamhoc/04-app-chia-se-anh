-- Migration: Tạo bảng password_reset_requests lưu lại thông tin yêu cầu quên mật khẩu
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  email VARCHAR(100) NOT NULL,
  status ENUM('pending', 'sent', 'resolved') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reset_email (email),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
