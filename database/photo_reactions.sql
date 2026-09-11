-- ============================================================
-- Bảng: photo_reactions (Lưu cảm xúc thả trên bài viết Locket)
-- Database: masita
-- ============================================================

USE masita;

CREATE TABLE IF NOT EXISTS photo_reactions (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  photo_id    INT UNSIGNED  NOT NULL,
  user_id     INT UNSIGNED  NOT NULL,
  emoji       VARCHAR(10)   NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_user_photo_reaction (photo_id, user_id),
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
