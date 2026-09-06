-- ============================================================
-- Schema: Theme / Hình nền trò chuyện trực tiếp 1-1
-- Database: masita
-- ============================================================

CREATE TABLE IF NOT EXISTS direct_chat_themes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user1_id INT UNSIGNED NOT NULL,
  user2_id INT UNSIGNED NOT NULL,
  background_url VARCHAR(500) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_pair (user1_id, user2_id),
  FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
