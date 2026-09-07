/**
 * ============================================================
 * Masita Auto-Init Database System
 * Tự động kiểm tra & tạo đầy đủ 13 bảng nếu chưa tồn tại.
 * Đảm bảo khi sang máy mới hoặc database mới, app tự động
 * khởi tạo và chạy trơn tru mà không cần gõ lệnh SQL thủ công.
 * ============================================================
 */

const initDatabase = async (pool) => {
  console.log('🔄 [DB Init] Đang kiểm tra cấu trúc Database...');

  const queries = [
    // 1. Bảng users
    `CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) DEFAULT NULL,
      avatar_url VARCHAR(500) DEFAULT NULL,
      bio TEXT DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_private_account TINYINT(1) NOT NULL DEFAULT 0,
      allow_suggest_account TINYINT(1) NOT NULL DEFAULT 1,
      searchable_by_name TINYINT(1) NOT NULL DEFAULT 1,
      searchable_by_username TINYINT(1) NOT NULL DEFAULT 1,
      searchable_by_email TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 2. Bảng friendships
    `CREATE TABLE IF NOT EXISTS friendships (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      requester_id INT UNSIGNED NOT NULL,
      receiver_id INT UNSIGNED NOT NULL,
      status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
      background_url VARCHAR(500) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_friendship (requester_id, receiver_id),
      KEY idx_receiver (receiver_id),
      KEY idx_status (status),
      CONSTRAINT fk_friendships_requester FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_friendships_receiver FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 3. Bảng photos (Locket Feed)
    `CREATE TABLE IF NOT EXISTS photos (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      recipient_id INT UNSIGNED DEFAULT NULL,
      image_url VARCHAR(500) NOT NULL,
      caption VARCHAR(255) DEFAULT NULL,
      privacy ENUM('public', 'friends', 'private') NOT NULL DEFAULT 'friends',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_photos_user (user_id),
      KEY idx_photos_recipient (recipient_id),
      KEY idx_photos_created (created_at DESC),
      CONSTRAINT fk_photos_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_photos_recipient FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 4. Bảng photo_reactions
    `CREATE TABLE IF NOT EXISTS photo_reactions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      photo_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      emoji VARCHAR(32) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_user_photo_reaction (photo_id, user_id),
      CONSTRAINT fk_reactions_photo FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE,
      CONSTRAINT fk_reactions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 5. Bảng photo_comments
    `CREATE TABLE IF NOT EXISTS photo_comments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      photo_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      parent_id INT UNSIGNED DEFAULT NULL,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_photo_comments_photo (photo_id),
      KEY idx_photo_comments_parent (parent_id),
      CONSTRAINT fk_comments_photo FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE,
      CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES photo_comments (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 6. Bảng comment_reactions
    `CREATE TABLE IF NOT EXISTS comment_reactions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      comment_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      emoji VARCHAR(32) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_user_comment_reaction (comment_id, user_id),
      CONSTRAINT fk_creactions_comment FOREIGN KEY (comment_id) REFERENCES photo_comments (id) ON DELETE CASCADE,
      CONSTRAINT fk_creactions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 7. Bảng groups
    `CREATE TABLE IF NOT EXISTS \`groups\` (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      avatar_url VARCHAR(500) DEFAULT NULL,
      background_url VARCHAR(500) DEFAULT NULL,
      created_by INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_groups_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 8. Bảng group_members
    `CREATE TABLE IF NOT EXISTS \`group_members\` (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      group_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
      is_pinned TINYINT(1) NOT NULL DEFAULT 0,
      is_muted TINYINT(1) NOT NULL DEFAULT 0,
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_group_user (group_id, user_id),
      KEY idx_gm_group (group_id),
      KEY idx_gm_user (user_id),
      CONSTRAINT fk_gm_group FOREIGN KEY (group_id) REFERENCES \`groups\` (id) ON DELETE CASCADE,
      CONSTRAINT fk_gm_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 9. Bảng messages
    `CREATE TABLE IF NOT EXISTS messages (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      sender_id INT UNSIGNED NOT NULL,
      receiver_id INT UNSIGNED DEFAULT NULL,
      group_id INT UNSIGNED DEFAULT NULL,
      message_text TEXT DEFAULT NULL,
      image_url VARCHAR(500) DEFAULT NULL,
      file_url VARCHAR(500) DEFAULT NULL,
      file_name VARCHAR(255) DEFAULT NULL,
      file_size BIGINT DEFAULT NULL,
      file_type VARCHAR(100) DEFAULT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_messages_sender (sender_id),
      KEY idx_messages_receiver (receiver_id),
      KEY idx_messages_group (group_id),
      KEY idx_messages_created (created_at),
      CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_messages_group FOREIGN KEY (group_id) REFERENCES \`groups\` (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 10. Bảng direct_chat_settings
    `CREATE TABLE IF NOT EXISTS direct_chat_settings (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      friend_id INT UNSIGNED NOT NULL,
      is_pinned TINYINT(1) NOT NULL DEFAULT 0,
      is_muted TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_user_friend_setting (user_id, friend_id),
      KEY idx_dcs_user (user_id),
      KEY idx_dcs_friend (friend_id),
      CONSTRAINT fk_dcs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_dcs_friend FOREIGN KEY (friend_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 11. Bảng direct_chat_themes
    `CREATE TABLE IF NOT EXISTS direct_chat_themes (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      friend_id INT UNSIGNED NOT NULL,
      theme_name VARCHAR(50) DEFAULT NULL,
      custom_background_url VARCHAR(500) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_friend (user_id, friend_id),
      KEY idx_user_id (user_id),
      KEY idx_friend_id (friend_id),
      CONSTRAINT fk_dct_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_dct_friend FOREIGN KEY (friend_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 12. Bảng password_reset_requests
    `CREATE TABLE IF NOT EXISTS password_reset_requests (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      email VARCHAR(100) NOT NULL,
      status ENUM('pending', 'sent', 'resolved') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_prr_user (user_id),
      KEY idx_prr_email (email),
      CONSTRAINT fk_prr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 13. Bảng login_sessions
    `CREATE TABLE IF NOT EXISTS login_sessions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      device_info VARCHAR(255) DEFAULT NULL,
      ip_address VARCHAR(45) DEFAULT NULL,
      last_active DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ls_user (user_id),
      CONSTRAINT fk_ls_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  ];

  try {
    for (const sql of queries) {
      await pool.query(sql);
    }
    console.log('✅ [DB Init] Toàn bộ 13 bảng đã sẵn sàng & đồng bộ 100%!');
  } catch (err) {
    console.error('⚠️ [DB Init Error]:', err.message);
  }
};

module.exports = { initDatabase };
