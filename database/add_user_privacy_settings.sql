-- Migration: Thêm cài đặt quyền riêng tư tài khoản vào bảng users
ALTER TABLE users
  ADD COLUMN is_private_account TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN allow_suggest_account TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN searchable_by_name TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN searchable_by_username TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN searchable_by_email TINYINT(1) NOT NULL DEFAULT 1;
