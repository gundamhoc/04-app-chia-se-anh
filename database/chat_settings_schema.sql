-- ============================================================
-- Schema Cài đặt Chat: Ghim hội thoại và Bật/Tắt thông báo
-- Hỗ trợ cả Trò chuyện Cá nhân (1-1) và Trò chuyện Nhóm
-- ============================================================

-- 1. Bảng direct_chat_settings: Cài đặt riêng của từng user đối với bạn chat 1-1
CREATE TABLE IF NOT EXISTS `direct_chat_settings` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `friend_id` INT UNSIGNED NOT NULL,
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `is_muted` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_user_friend` (`user_id`, `friend_id`),
  INDEX `idx_user_friend` (`user_id`, `friend_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`friend_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Cập nhật bảng group_members: Bổ sung is_pinned và is_muted theo từng thành viên
-- ALTER TABLE `group_members` ADD COLUMN `is_pinned` TINYINT(1) NOT NULL DEFAULT 0 AFTER `role`;
-- ALTER TABLE `group_members` ADD COLUMN `is_muted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_pinned`;
