-- ====================================================
-- MASITA DATABASE BACKUP
-- Timestamp: 2026-09-07T04:43:11.467Z (2026-09-07_11-43-11)
-- Host: mysql-2c02e781-student-2791.b.aivencloud.com
-- Database: defaultdb
-- ====================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------
-- Cấu trúc bảng: `comment_reactions`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `comment_reactions`;
CREATE TABLE IF NOT EXISTS "comment_reactions" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "comment_id" int unsigned NOT NULL,
  "user_id" int unsigned NOT NULL,
  "emoji" varchar(10) NOT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "unique_user_comment_emoji" ("comment_id","user_id","emoji"),
  KEY "fk_comment_reactions_user" ("user_id"),
  CONSTRAINT "fk_comment_reactions_comment" FOREIGN KEY ("comment_id") REFERENCES "photo_comments" ("id") ON DELETE CASCADE,
  CONSTRAINT "fk_comment_reactions_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Dữ liệu bảng: `comment_reactions` (1 dòng)
INSERT INTO `comment_reactions` (`id`, `comment_id`, `user_id`, `emoji`, `created_at`) VALUES (2, 3, 3, '🔥', '2026-09-07 04:13:57');

-- ----------------------------------------------------
-- Cấu trúc bảng: `direct_chat_settings`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `direct_chat_settings`;
CREATE TABLE IF NOT EXISTS "direct_chat_settings" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "user_id" int unsigned NOT NULL,
  "friend_id" int unsigned NOT NULL,
  "is_pinned" tinyint(1) NOT NULL DEFAULT '0',
  "is_muted" tinyint(1) NOT NULL DEFAULT '0',
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "uq_user_friend" ("user_id","friend_id"),
  KEY "idx_user_friend" ("user_id","friend_id"),
  KEY "friend_id" ("friend_id"),
  CONSTRAINT "direct_chat_settings_ibfk_1" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "direct_chat_settings_ibfk_2" FOREIGN KEY ("friend_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Dữ liệu bảng: `direct_chat_settings` (2 dòng)
INSERT INTO `direct_chat_settings` (`id`, `user_id`, `friend_id`, `is_pinned`, `is_muted`, `created_at`, `updated_at`) VALUES (1, 1, 2, 0, 1, '2026-09-06 13:29:38', '2026-09-06 13:33:04');
INSERT INTO `direct_chat_settings` (`id`, `user_id`, `friend_id`, `is_pinned`, `is_muted`, `created_at`, `updated_at`) VALUES (12, 2, 1, 0, 0, '2026-09-06 15:29:46', '2026-09-06 15:29:46');

-- ----------------------------------------------------
-- Cấu trúc bảng: `direct_chat_themes`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `direct_chat_themes`;
CREATE TABLE IF NOT EXISTS "direct_chat_themes" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "user1_id" int unsigned NOT NULL,
  "user2_id" int unsigned NOT NULL,
  "background_url" varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "uq_user_pair" ("user1_id","user2_id"),
  KEY "user2_id" ("user2_id"),
  CONSTRAINT "direct_chat_themes_ibfk_1" FOREIGN KEY ("user1_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "direct_chat_themes_ibfk_2" FOREIGN KEY ("user2_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Dữ liệu bảng: `direct_chat_themes` (2 dòng)
INSERT INTO `direct_chat_themes` (`id`, `user1_id`, `user2_id`, `background_url`, `updated_at`) VALUES (1, 1, 2, NULL, '2026-09-06 13:17:07');
INSERT INTO `direct_chat_themes` (`id`, `user1_id`, `user2_id`, `background_url`, `updated_at`) VALUES (4, 2, 3, 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000&auto=format&fit=crop', '2026-09-06 13:18:43');

-- ----------------------------------------------------
-- Cấu trúc bảng: `friendships`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `friendships`;
CREATE TABLE IF NOT EXISTS "friendships" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "requester_id" int unsigned NOT NULL,
  "receiver_id" int unsigned NOT NULL,
  "status" enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "unique_friend_pair" ("requester_id","receiver_id"),
  KEY "fk_friend_receiver" ("receiver_id"),
  CONSTRAINT "fk_friend_receiver" FOREIGN KEY ("receiver_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "fk_friend_requester" FOREIGN KEY ("requester_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Dữ liệu bảng: `friendships` (1 dòng)
INSERT INTO `friendships` (`id`, `requester_id`, `receiver_id`, `status`, `created_at`, `updated_at`) VALUES (1, 3, 2, 'accepted', '2026-09-06 20:22:58', '2026-09-06 20:23:04');

-- ----------------------------------------------------
-- Cấu trúc bảng: `group_members`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `group_members`;
CREATE TABLE IF NOT EXISTS "group_members" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "group_id" int unsigned NOT NULL,
  "user_id" int unsigned NOT NULL,
  "role" enum('admin','member') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'member',
  "is_pinned" tinyint(1) NOT NULL DEFAULT '0',
  "is_muted" tinyint(1) NOT NULL DEFAULT '0',
  "joined_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "uq_group_user" ("group_id","user_id"),
  KEY "idx_user_groups" ("user_id","group_id"),
  CONSTRAINT "group_members_ibfk_1" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE,
  CONSTRAINT "group_members_ibfk_2" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Dữ liệu bảng: `group_members` (12 dòng)
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (1, 1, 1, 'admin', 0, 0, '2026-09-06 12:50:37');
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (2, 1, 2, 'member', 0, 0, '2026-09-06 12:50:37');
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (3, 1, 3, 'member', 0, 0, '2026-09-06 12:50:37');
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (4, 2, 1, 'admin', 0, 0, '2026-09-06 12:52:03');
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (5, 2, 2, 'member', 0, 0, '2026-09-06 12:52:03');
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (6, 2, 3, 'member', 0, 0, '2026-09-06 12:52:03');
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (7, 3, 1, 'admin', 0, 0, '2026-09-06 12:52:38');
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (9, 3, 3, 'member', 0, 0, '2026-09-06 12:52:38');
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (10, 4, 2, 'admin', 0, 0, '2026-09-06 12:54:51');
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (11, 4, 3, 'member', 0, 0, '2026-09-06 12:54:51');
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (12, 5, 1, 'admin', 0, 0, '2026-09-06 13:02:18');
INSERT INTO `group_members` (`id`, `group_id`, `user_id`, `role`, `is_pinned`, `is_muted`, `joined_at`) VALUES (13, 6, 1, 'admin', 0, 0, '2026-09-06 13:02:52');

-- ----------------------------------------------------
-- Cấu trúc bảng: `groups`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `groups`;
CREATE TABLE IF NOT EXISTS "groups" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "name" varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  "avatar_url" varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  "background_url" varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  "creator_id" int unsigned NOT NULL,
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  KEY "idx_creator" ("creator_id"),
  CONSTRAINT "groups_ibfk_1" FOREIGN KEY ("creator_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Dữ liệu bảng: `groups` (6 dòng)
INSERT INTO `groups` (`id`, `name`, `avatar_url`, `background_url`, `creator_id`, `created_at`, `updated_at`) VALUES (1, 'Team Dev Masita E2E', NULL, NULL, 1, '2026-09-06 12:50:36', '2026-09-06 12:50:36');
INSERT INTO `groups` (`id`, `name`, `avatar_url`, `background_url`, `creator_id`, `created_at`, `updated_at`) VALUES (2, 'Team Dev Masita E2E', NULL, NULL, 1, '2026-09-06 12:52:03', '2026-09-06 12:52:03');
INSERT INTO `groups` (`id`, `name`, `avatar_url`, `background_url`, `creator_id`, `created_at`, `updated_at`) VALUES (3, 'Team Dev Masita E2E', NULL, NULL, 1, '2026-09-06 12:52:38', '2026-09-06 12:52:38');
INSERT INTO `groups` (`id`, `name`, `avatar_url`, `background_url`, `creator_id`, `created_at`, `updated_at`) VALUES (4, 'Wibu', NULL, 'https://lh3.googleusercontent.com/d/11zO8mli7WyHWA2dREzmPfUFg88n4dx03', 2, '2026-09-06 12:54:51', '2026-09-06 13:04:37');
INSERT INTO `groups` (`id`, `name`, `avatar_url`, `background_url`, `creator_id`, `created_at`, `updated_at`) VALUES (5, 'Nhóm Test Avatar & Theme', NULL, NULL, 1, '2026-09-06 13:02:18', '2026-09-06 13:02:18');
INSERT INTO `groups` (`id`, `name`, `avatar_url`, `background_url`, `creator_id`, `created_at`, `updated_at`) VALUES (6, 'Nhóm Test Avatar & Theme', 'https://lh3.googleusercontent.com/d/1RBvrseTepoCYBExMep85GSFXiU6d2ng-', NULL, 1, '2026-09-06 13:02:52', '2026-09-06 13:03:01');

-- ----------------------------------------------------
-- Cấu trúc bảng: `login_sessions`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `login_sessions`;
CREATE TABLE IF NOT EXISTS "login_sessions" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "user_id" int unsigned NOT NULL,
  "device_name" varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Thiết bị không xác định',
  "ip_address" varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  "token_hash" varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  "last_active" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_active" tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY ("id"),
  KEY "idx_user_id" ("user_id"),
  KEY "idx_token_hash" ("token_hash"),
  CONSTRAINT "fk_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- ----------------------------------------------------
-- Cấu trúc bảng: `messages`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `messages`;
CREATE TABLE IF NOT EXISTS "messages" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "sender_id" int unsigned NOT NULL,
  "receiver_id" int unsigned DEFAULT NULL,
  "group_id" int unsigned DEFAULT NULL,
  "message_text" text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  "image_url" varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  "file_url" varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  "file_name" varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  "file_size" int unsigned DEFAULT NULL,
  "file_type" varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  "is_read" tinyint(1) DEFAULT '0',
  "created_at" timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  KEY "idx_sender_receiver" ("sender_id","receiver_id"),
  KEY "idx_receiver_unread" ("receiver_id","is_read"),
  KEY "idx_created_at" ("created_at"),
  KEY "idx_group_messages" ("group_id","created_at"),
  CONSTRAINT "fk_messages_group" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE,
  CONSTRAINT "messages_ibfk_1" FOREIGN KEY ("sender_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "messages_ibfk_2" FOREIGN KEY ("receiver_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Dữ liệu bảng: `messages` (23 dòng)
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (2, 1, 2, NULL, 'Xin chao tu integration test! 1788695035379', NULL, NULL, NULL, NULL, NULL, 1, '2026-09-06 11:43:55');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (3, 1, 2, NULL, 'Test chat realtime 1788695072620', NULL, NULL, NULL, NULL, NULL, 1, '2026-09-06 11:44:32');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (4, 3, 2, NULL, 'hello bạn', NULL, NULL, NULL, NULL, NULL, 1, '2026-09-06 11:51:41');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (5, 2, 3, NULL, 'Hello', NULL, NULL, NULL, NULL, NULL, 1, '2026-09-06 11:52:14');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (6, 2, 3, NULL, NULL, 'https://lh3.googleusercontent.com/d/1M4ypsQvAKfs1IeBL0T7jpq9NBvZhI09y', NULL, NULL, NULL, NULL, 1, '2026-09-06 11:53:38');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (7, 2, 3, NULL, NULL, 'https://lh3.googleusercontent.com/d/1Isbwx_npFpezrP4JUp4HK-Atbdx_l9N4', NULL, NULL, NULL, NULL, 1, '2026-09-06 11:54:07');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (8, 2, 3, NULL, 'Hi', NULL, NULL, NULL, NULL, NULL, 1, '2026-09-06 11:59:23');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (9, 3, 2, NULL, 'hihi', NULL, NULL, NULL, NULL, NULL, 1, '2026-09-06 11:59:29');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (10, 1, 2, NULL, 'Gui file code test', NULL, 'https://lh3.googleusercontent.com/d/16238gL8YeneRCzqGTv0R1Oq8mLKahW45', 'package.json', 717, 'application/octet-stream', 1, '2026-09-06 12:09:43');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (11, 3, 2, NULL, NULL, NULL, 'https://lh3.googleusercontent.com/d/16DxpMNE1nML_u5e0KXs-u-SU6sSsHH2S', 'Huong dan thuc hien tieu luÃ¢n mon hoc.pdf', 599708, 'application/pdf', 1, '2026-09-06 12:18:48');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (12, 1, NULL, 2, 'Xin chào cả nhóm Masita E2E! Đây là tin nhắn text.', NULL, NULL, NULL, NULL, NULL, 0, '2026-09-06 12:52:03');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (13, 2, NULL, 2, 'User 2 nhận thông báo và phản hồi tức thì!', NULL, NULL, NULL, NULL, NULL, 0, '2026-09-06 12:52:03');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (14, 3, NULL, 2, 'Đây là file code JavaScript gửi vào nhóm!', NULL, 'https://lh3.googleusercontent.com/d/1kfX_c2w9f27fFEXDkSOU6REbFx78Cdt_', 'masita_team.js', 140, 'text/javascript', 0, '2026-09-06 12:52:10');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (15, 1, NULL, 3, 'Xin chào cả nhóm Masita E2E! Đây là tin nhắn text.', NULL, NULL, NULL, NULL, NULL, 0, '2026-09-06 12:52:38');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (16, 2, NULL, 3, 'User 2 nhận thông báo và phản hồi tức thì!', NULL, NULL, NULL, NULL, NULL, 0, '2026-09-06 12:52:38');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (17, 3, NULL, 3, 'Đây là file code JavaScript gửi vào nhóm!', NULL, 'https://lh3.googleusercontent.com/d/18ySWHIN7He3YloYWw-ErIcy6dLmAwVak', 'masita_team.js', 140, 'text/javascript', 0, '2026-09-06 12:52:44');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (18, 2, NULL, 4, 'Đẹp', 'https://lh3.googleusercontent.com/d/1cx1a98Gp7ZW0lyE2OcgXJHI7N590TkGF', NULL, NULL, NULL, NULL, 0, '2026-09-06 12:55:13');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (19, 1, 2, NULL, 'Hello friend, this is a test: UniqueSearchWord_1788701377413!', NULL, NULL, NULL, NULL, NULL, 1, '2026-09-06 13:29:37');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (20, 1, 2, NULL, 'Hello friend, this is a test: UniqueSearchWord_1788701398517!', NULL, NULL, NULL, NULL, NULL, 1, '2026-09-06 13:29:58');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (21, 1, NULL, 1, 'Announcement: GroupUniqueKeyword_1788701400186 here!', NULL, NULL, NULL, NULL, NULL, 0, '2026-09-06 13:30:00');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (22, 1, 2, NULL, 'Hello friend, this is a test: UniqueSearchWord_1788701465823!', NULL, NULL, NULL, NULL, NULL, 1, '2026-09-06 13:31:05');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (23, 1, 2, NULL, 'Hello friend, this is a test: UniqueSearchWord_1788701584397!', NULL, NULL, NULL, NULL, NULL, 1, '2026-09-06 13:33:04');
INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `group_id`, `message_text`, `image_url`, `file_url`, `file_name`, `file_size`, `file_type`, `is_read`, `created_at`) VALUES (24, 1, NULL, 1, 'Announcement: GroupUniqueKeyword_1788701585059 here!', NULL, NULL, NULL, NULL, NULL, 0, '2026-09-06 13:33:05');

-- ----------------------------------------------------
-- Cấu trúc bảng: `password_reset_requests`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `password_reset_requests`;
CREATE TABLE IF NOT EXISTS "password_reset_requests" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "user_id" int unsigned NOT NULL,
  "email" varchar(100) NOT NULL,
  "status" enum('pending','sent','resolved') DEFAULT 'pending',
  "created_at" datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  KEY "idx_reset_email" ("email"),
  KEY "user_id" ("user_id"),
  CONSTRAINT "password_reset_requests_ibfk_1" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Dữ liệu bảng: `password_reset_requests` (1 dòng)
INSERT INTO `password_reset_requests` (`id`, `user_id`, `email`, `status`, `created_at`) VALUES (1, 1, 'masita_test@example.com', 'pending', '2026-09-06 13:51:20');

-- ----------------------------------------------------
-- Cấu trúc bảng: `photo_comments`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `photo_comments`;
CREATE TABLE IF NOT EXISTS "photo_comments" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "photo_id" int unsigned NOT NULL,
  "user_id" int unsigned NOT NULL,
  "parent_id" int unsigned DEFAULT NULL,
  "content" text NOT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  KEY "fk_comments_photo" ("photo_id"),
  KEY "fk_comments_user" ("user_id"),
  KEY "fk_comments_parent" ("parent_id"),
  CONSTRAINT "fk_comments_parent" FOREIGN KEY ("parent_id") REFERENCES "photo_comments" ("id") ON DELETE CASCADE,
  CONSTRAINT "fk_comments_photo" FOREIGN KEY ("photo_id") REFERENCES "photos" ("id") ON DELETE CASCADE,
  CONSTRAINT "fk_comments_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Dữ liệu bảng: `photo_comments` (1 dòng)
INSERT INTO `photo_comments` (`id`, `photo_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (3, 4, 2, NULL, 'Hi', '2026-09-06 15:57:52', '2026-09-06 15:57:52');

-- ----------------------------------------------------
-- Cấu trúc bảng: `photo_reactions`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `photo_reactions`;
CREATE TABLE IF NOT EXISTS "photo_reactions" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "photo_id" int unsigned NOT NULL,
  "user_id" int unsigned NOT NULL,
  "emoji" varchar(10) NOT NULL,
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE KEY "unique_user_photo_emoji" ("photo_id","user_id","emoji"),
  KEY "user_id" ("user_id"),
  CONSTRAINT "photo_reactions_ibfk_1" FOREIGN KEY ("photo_id") REFERENCES "photos" ("id") ON DELETE CASCADE,
  CONSTRAINT "photo_reactions_ibfk_2" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- ----------------------------------------------------
-- Cấu trúc bảng: `photos`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `photos`;
CREATE TABLE IF NOT EXISTS "photos" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "user_id" int unsigned NOT NULL,
  "recipient_id" int unsigned DEFAULT NULL,
  "image_url" varchar(500) NOT NULL,
  "caption" text,
  "privacy" enum('public','friends','private') NOT NULL DEFAULT 'friends',
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  KEY "fk_photos_user" ("user_id"),
  KEY "fk_photos_recipient" ("recipient_id"),
  CONSTRAINT "fk_photos_recipient" FOREIGN KEY ("recipient_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "fk_photos_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Dữ liệu bảng: `photos` (5 dòng)
INSERT INTO `photos` (`id`, `user_id`, `recipient_id`, `image_url`, `caption`, `privacy`, `created_at`, `updated_at`) VALUES (4, 3, NULL, 'https://lh3.googleusercontent.com/d/1OQgUWsP9t05iFpWMvsKYWyVAGkQOEpVo', 'Caption moi cap nhat tu test!', 'friends', '2026-09-06 07:36:00', '2026-09-06 08:20:39');
INSERT INTO `photos` (`id`, `user_id`, `recipient_id`, `image_url`, `caption`, `privacy`, `created_at`, `updated_at`) VALUES (6, 2, NULL, 'https://lh3.googleusercontent.com/d/1qb71y_fQnVV51pM4rndvJyy_yuIMxxIN', NULL, 'friends', '2026-09-06 08:13:51', '2026-09-06 08:13:51');
INSERT INTO `photos` (`id`, `user_id`, `recipient_id`, `image_url`, `caption`, `privacy`, `created_at`, `updated_at`) VALUES (7, 2, NULL, 'https://lh3.googleusercontent.com/d/1Fra6Hnj5iuuVbkv3xVO3F5KoqxRrCJqE', NULL, 'friends', '2026-09-06 08:14:15', '2026-09-06 08:14:15');
INSERT INTO `photos` (`id`, `user_id`, `recipient_id`, `image_url`, `caption`, `privacy`, `created_at`, `updated_at`) VALUES (8, 1, NULL, 'https://lh3.googleusercontent.com/d/1-6Tf_tS9OI-wWWy1TgYhYHkzk2kSQpyA', NULL, 'friends', '2026-09-06 08:32:18', '2026-09-06 15:54:55');
INSERT INTO `photos` (`id`, `user_id`, `recipient_id`, `image_url`, `caption`, `privacy`, `created_at`, `updated_at`) VALUES (11, 3, NULL, 'https://lh3.googleusercontent.com/d/11dWFb0-Ix5fZj6GA5Hd4PQeH0-tON5sy', NULL, 'friends', '2026-09-06 08:41:41', '2026-09-06 08:41:41');

-- ----------------------------------------------------
-- Cấu trúc bảng: `users`
-- ----------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS "users" (
  "id" int unsigned NOT NULL AUTO_INCREMENT,
  "username" varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  "email" varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  "password_hash" varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  "full_name" varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  "avatar_url" varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  "bio" text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  "is_active" tinyint(1) NOT NULL DEFAULT '1',
  "created_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  "is_private_account" tinyint(1) NOT NULL DEFAULT '0',
  "allow_suggest_account" tinyint(1) NOT NULL DEFAULT '1',
  "searchable_by_name" tinyint(1) NOT NULL DEFAULT '1',
  "searchable_by_username" tinyint(1) NOT NULL DEFAULT '1',
  "searchable_by_email" tinyint(1) NOT NULL DEFAULT '1',
  "two_factor_enabled" tinyint(1) NOT NULL DEFAULT '0',
  "remember_login" tinyint(1) NOT NULL DEFAULT '1',
  "last_password_changed" datetime DEFAULT NULL,
  PRIMARY KEY ("id"),
  UNIQUE KEY "username" ("username"),
  UNIQUE KEY "email" ("email"),
  KEY "idx_email" ("email"),
  KEY "idx_username" ("username")
);

-- Dữ liệu bảng: `users` (4 dòng)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `avatar_url`, `bio`, `is_active`, `created_at`, `updated_at`, `is_private_account`, `allow_suggest_account`, `searchable_by_name`, `searchable_by_username`, `searchable_by_email`, `two_factor_enabled`, `remember_login`, `last_password_changed`) VALUES (1, 'masita_test', 'masita_test@example.com', '$2a$12$O1AnjsrBw42mA5FGauGAMOHpK28O5O7ATxs.tSY6SR756JfePCAoq', 'Masita Test', NULL, NULL, 1, '2026-09-06 18:19:01', '2026-09-06 16:42:01', 0, 1, 1, 1, 1, 0, 1, NULL);
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `avatar_url`, `bio`, `is_active`, `created_at`, `updated_at`, `is_private_account`, `allow_suggest_account`, `searchable_by_name`, `searchable_by_username`, `searchable_by_email`, `two_factor_enabled`, `remember_login`, `last_password_changed`) VALUES (2, 'nhi224986', 'nhi224986@gmail.com', '$2a$10$VqnYsNzK/3SD3yi1IKVymeDakRG2jEE21TD5D4sfEmG1T62Yne6pS', 'nhi', NULL, NULL, 1, '2026-09-06 20:22:12', '2026-09-06 16:42:01', 0, 1, 1, 1, 1, 0, 1, NULL);
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `avatar_url`, `bio`, `is_active`, `created_at`, `updated_at`, `is_private_account`, `allow_suggest_account`, `searchable_by_name`, `searchable_by_username`, `searchable_by_email`, `two_factor_enabled`, `remember_login`, `last_password_changed`) VALUES (3, 'gundamhoc', 'gundamhoc20@gmail.com', '$2a$12$MOgPgSzopDPwUa4ngmGHTuDUmbDMgynU1594Cq3DKxz63ItHD0ZFK', 'Học', NULL, NULL, 1, '2026-09-06 20:22:48', '2026-09-06 20:22:48', 0, 1, 1, 1, 1, 0, 1, NULL);
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `full_name`, `avatar_url`, `bio`, `is_active`, `created_at`, `updated_at`, `is_private_account`, `allow_suggest_account`, `searchable_by_name`, `searchable_by_username`, `searchable_by_email`, `two_factor_enabled`, `remember_login`, `last_password_changed`) VALUES (4, 'sectest_u9', 'sectest9@test.com', '$2a$12$nojpg92cO3HOwbYPIqJOSed/qBfpDltKZLkYCodamzlcqgm8nbXqe', NULL, NULL, NULL, 1, '2026-09-06 17:02:17', '2026-09-06 17:02:17', 0, 1, 1, 1, 1, 1, 0, NULL);

SET FOREIGN_KEY_CHECKS = 1;
-- Hoàn tất sao lưu lúc: 2026-09-07T04:43:14.949Z
