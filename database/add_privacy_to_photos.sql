-- ============================================================
-- Migration: Bổ sung cột privacy cho bảng photos
-- File: database/add_privacy_to_photos.sql
-- Database: masita
-- ============================================================

ALTER TABLE photos
ADD COLUMN privacy ENUM('public', 'friends', 'private') NOT NULL DEFAULT 'friends' AFTER caption;
