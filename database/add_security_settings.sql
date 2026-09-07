-- ============================================================
-- Migration: Thêm trường bảo mật vào bảng users
-- và tạo bảng login_sessions
-- ============================================================

USE masita;

-- Thêm các cột bảo mật vào bảng users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Bật xác minh 2 bước',
  ADD COLUMN IF NOT EXISTS remember_login TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Lưu thông tin đăng nhập',
  ADD COLUMN IF NOT EXISTS last_password_changed DATETIME DEFAULT NULL COMMENT 'Lần đổi mật khẩu gần nhất';

-- Bảng theo dõi phiên đăng nhập
CREATE TABLE IF NOT EXISTS login_sessions (
  id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED      NOT NULL,
  device_name VARCHAR(255)      DEFAULT 'Thiết bị không xác định',
  ip_address  VARCHAR(45)       DEFAULT NULL,
  token_hash  VARCHAR(64)       DEFAULT NULL COMMENT 'SHA256 của JWT token',
  last_active DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active   TINYINT(1)        NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  INDEX idx_user_id (user_id),
  INDEX idx_token_hash (token_hash),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
