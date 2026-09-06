-- ============================================================
-- Epic-6: Schema Quản lý Nhóm Chat (Group Chat) & Thành viên
-- ============================================================

-- 1. Bảng groups: Quản lý thông tin nhóm trò chuyện
CREATE TABLE IF NOT EXISTS `groups` (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  background_url VARCHAR(500) NULL,
  creator_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_creator (creator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bổ sung cột background_url nếu bảng groups đã tồn tại
-- ALTER TABLE `groups` ADD COLUMN background_url VARCHAR(500) NULL AFTER avatar_url;

-- 2. Bảng group_members: Quản lý thành viên và vai trò trong nhóm
CREATE TABLE IF NOT EXISTS `group_members` (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_group_user (group_id, user_id),
  INDEX idx_user_groups (user_id, group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Cập nhật bảng messages: Cho phép tin nhắn thuộc nhóm
-- receiver_id cho phép NULL (nếu là tin nhắn gửi vào nhóm)
ALTER TABLE messages MODIFY receiver_id INT UNSIGNED NULL;

-- Bổ sung cột group_id liên kết bảng groups
ALTER TABLE messages ADD COLUMN group_id INT UNSIGNED NULL AFTER receiver_id;
ALTER TABLE messages ADD CONSTRAINT fk_messages_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE;
ALTER TABLE messages ADD INDEX idx_group_messages (group_id, created_at);
