-- ============================================================
-- Schema cho Bảng Bài viết đã lưu (Saved Photos) & Đăng lại (Reposts)
-- Thư mục: database/saved_and_reposts.sql
-- Database: masita
-- ============================================================

-- 1. Bảng bài viết đã lưu
CREATE TABLE IF NOT EXISTS saved_photos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  photo_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_user_saved_photo (user_id, photo_id),
  KEY idx_saved_user (user_id),
  KEY idx_saved_photo (photo_id),
  CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_photo FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Bảng bài viết đăng lại (Reposts)
CREATE TABLE IF NOT EXISTS photo_reposts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  photo_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_user_repost (user_id, photo_id),
  KEY idx_repost_user (user_id),
  KEY idx_repost_photo (photo_id),
  CONSTRAINT fk_repost_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_repost_photo FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
