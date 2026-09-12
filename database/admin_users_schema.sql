-- ============================================
-- Masita - Admin Users Schema
-- Quản lý tài khoản Quản trị viên & Nhân viên CSKH
-- ============================================

USE masita;

-- ============================================
-- Bảng: admin_users
-- Lưu trữ tài khoản quản trị viên và nhân viên hệ thống
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)       NOT NULL UNIQUE,
  email         VARCHAR(100)      DEFAULT NULL,
  password_hash VARCHAR(255)      NOT NULL,
  full_name     VARCHAR(100)      NOT NULL,
  role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  is_active     TINYINT(1)        NOT NULL DEFAULT 1,
  last_login    DATETIME          DEFAULT NULL,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_username (username),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;