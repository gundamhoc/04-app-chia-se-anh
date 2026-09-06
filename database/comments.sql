-- ============================================================
-- Schema: Hệ thống Bình luận & Thả cảm xúc bình luận
-- Thư mục: database/comments.sql
-- Database: masita
-- ============================================================

USE masita;

-- 1. Bảng lưu trữ bình luận bài đăng (hỗ trợ trả lời trực tiếp / phân cấp qua parent_id)
CREATE TABLE IF NOT EXISTS photo_comments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  photo_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  parent_id INT UNSIGNED DEFAULT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_comments_photo FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES photo_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Bảng lưu trữ biểu tượng cảm xúc trên từng bình luận
CREATE TABLE IF NOT EXISTS comment_reactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  comment_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_user_comment_emoji (comment_id, user_id, emoji),
  CONSTRAINT fk_comment_reactions_comment FOREIGN KEY (comment_id) REFERENCES photo_comments(id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
