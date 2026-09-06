-- ============================================
-- Masita - MySQL Database Schema
-- Giai đoạn 1: Nền tảng cơ bản (Auth only)
-- ============================================

CREATE DATABASE IF NOT EXISTS masita
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE masita;

-- ============================================
-- Bảng: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)       NOT NULL UNIQUE,
  email         VARCHAR(100)      NOT NULL UNIQUE,
  password_hash VARCHAR(255)      NOT NULL,
  full_name     VARCHAR(100)      DEFAULT NULL,
  avatar_url    VARCHAR(500)      DEFAULT NULL,
  bio           TEXT              DEFAULT NULL,
  is_active     TINYINT(1)        NOT NULL DEFAULT 1,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_email    (email),
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- (Tương lai) Placeholder cho các bảng tiếp theo
-- posts, comments, likes, follows, messages...
-- ============================================
