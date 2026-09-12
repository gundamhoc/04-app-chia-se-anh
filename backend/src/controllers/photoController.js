const { pool } = require('../config/db');
const { uploadFileToDrive, getDriveClient } = require('../utils/googleDrive');
const { sendNotificationToUser, broadcastToUsers, getIO } = require('../sockets/socketHandler');
const { createNotification } = require('../services/notificationService');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

/**
 * Realtime: phát sự kiện bài đăng mới tới room 'admins' (Admin Portal)
 */
const emitAdminNewPost = (photo, host, protocol) => {
  try {
    const io = getIO();
    if (!io) return;
    const isVideo = photo.media_type === 'video' || !!photo.video_url;
    io.to('admins').emit('admin_new_post', {
      id: photo.id,
      user_id: photo.user_id,
      caption: photo.caption,
      image_url: photo.image_url,
      video_url: photo.video_url || null,
      media_type: photo.media_type || 'image',
      privacy: photo.privacy,
      created_at: photo.created_at,
      username: photo.author_username,
      full_name: photo.author_name,
      avatar_url: photo.author_avatar,
      is_video: isVideo,
      reactions_count: 0,
      stream_url: isVideo ? `${protocol}://${host}/api/admin/posts/${photo.id}/stream` : null,
    });
  } catch (emitErr) {
    console.warn('⚠️ Lỗi emit admin_new_post:', emitErr.message);
  }
};

// Helper chuẩn hóa link ảnh: chuyển link Google Drive sang proxy route backend để tránh lỗi Google 429 trên Web
function formatImageUrl(rawUrl, protocol, host) {
  if (!rawUrl) return null;
  if (rawUrl.includes('googleusercontent.com/d/') || rawUrl.includes('drive.google.com')) {
    const match = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `${protocol}://${host}/api/photos/drive/${match[1]}`;
    }
  }
  if (!rawUrl.startsWith('http')) {
    return `${protocol}://${host}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  }
  return rawUrl;
}

// Helper bổ sung reactions, top 2 reactions và số lượng bình luận cho danh sách ảnh
async function enrichPhotosWithReactionsAndComments(rows, currentUserId, req) {
  const protocol = req.protocol;
  const host = req.get('host');

  const photoIds = rows.map((p) => p.id);
  let reactionsMap = {};
  let commentCountMap = {};
  let savedMap = {};
  let repostMap = {};

  if (photoIds.length > 0) {
    const [reactions] = await pool.query(
      `
      SELECT 
        photo_id,
        emoji,
        COUNT(*) as count,
        SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as user_reacted
      FROM photo_reactions
      WHERE photo_id IN (?)
      GROUP BY photo_id, emoji
      `,
      [currentUserId, photoIds]
    );

    reactions.forEach((r) => {
      if (!reactionsMap[r.photo_id]) {
        reactionsMap[r.photo_id] = [];
      }
      reactionsMap[r.photo_id].push({
        emoji: r.emoji,
        count: parseInt(r.count, 10),
        user_reacted: r.user_reacted > 0,
      });
    });

    const [commentCounts] = await pool.query(
      `
      SELECT photo_id, COUNT(*) as count
      FROM photo_comments
      WHERE photo_id IN (?)
      GROUP BY photo_id
      `,
      [photoIds]
    );

    commentCounts.forEach((c) => {
      commentCountMap[c.photo_id] = parseInt(c.count, 10);
    });

    // Lấy trạng thái đã lưu & đã đăng lại của người dùng hiện tại
    if (currentUserId) {
      const [savedRows] = await pool.query(
        'SELECT photo_id FROM saved_photos WHERE user_id = ? AND photo_id IN (?)',
        [currentUserId, photoIds]
      );
      savedRows.forEach((s) => {
        savedMap[s.photo_id] = true;
      });

      const [repostRows] = await pool.query(
        'SELECT photo_id FROM photo_reposts WHERE user_id = ? AND photo_id IN (?)',
        [currentUserId, photoIds]
      );
      repostRows.forEach((rp) => {
        repostMap[rp.photo_id] = true;
      });
    }
  }

  return rows.map((p) => {
    let image_url = formatImageUrl(p.image_url, protocol, host);

    let author_avatar = p.author_avatar;
    if (author_avatar && !author_avatar.startsWith('http')) {
      author_avatar = `${protocol}://${host}${author_avatar.startsWith('/') ? '' : '/'}${author_avatar}`;
    }

    const reactionsList = reactionsMap[p.id] || [];
    const sortedReactions = [...reactionsList].sort((a, b) => b.count - a.count);
    const top2Reactions = sortedReactions.slice(0, 2);
    const totalReactionsCount = reactionsList.reduce((acc, r) => acc + r.count, 0);

    return {
      id: p.id,
      user_id: p.user_id,
      recipient_id: p.recipient_id,
      image_url,
      video_url: p.video_url || null,
      media_type: p.media_type || (p.video_url ? 'video' : 'image'),
      caption: p.caption,
      privacy: p.privacy || 'friends',
      created_at: p.created_at,
      author_name: p.author_name || p.author_username,
      author_username: p.author_username,
      author_avatar,
      recipient_name: p.recipient_name || null,
      reactions: reactionsList,
      top_reactions: top2Reactions,
      total_reactions: totalReactionsCount,
      comment_count: commentCountMap[p.id] || 0,
      is_saved: Boolean(savedMap[p.id]),
      is_reposted: Boolean(repostMap[p.id]),
    };
  });
}

// ============================================================
// Controller: Quản lý Ảnh Locket & Feed Bài viết & Reactions
// Format response CHUẨN: { success, message, data }
// ============================================================

/**
 * 1. Upload ảnh bài viết Locket mới
 * POST /api/photos/upload
 * Headers: Authorization (JWT)
 * Multipart form: image (file), caption (text), recipient_id (optional)
 */
const uploadPhoto = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn 1 bức ảnh để tải lên.',
      });
    }

    const { caption, recipient_id, privacy } = req.body;
    let recipientId = null;

    if (recipient_id && !isNaN(recipient_id)) {
      recipientId = parseInt(recipient_id, 10);
    }
    const validPrivacy = ['public', 'friends', 'private'].includes(privacy) ? privacy : 'friends';

    let finalImageUrl = `/uploads/${req.file.filename}`;

    // Upload lên Google Drive nếu cấu hình credentials
    try {
      const driveResult = await uploadFileToDrive(req.file.path, req.file.mimetype, req.file.filename);
      if (driveResult && driveResult.directUrl) {
        finalImageUrl = driveResult.directUrl;
        // Xóa file tạm trên máy sau khi upload lên Drive thành công
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      }
    } catch (driveErr) {
      console.warn('⚠️ Gặp sự cố upload Google Drive, fallback sang lưu file nội bộ:', driveErr.message);
    }

    const [result] = await pool.query(
      `INSERT INTO photos (user_id, recipient_id, image_url, caption, privacy) VALUES (?, ?, ?, ?, ?)`,
      [currentUserId, recipientId, finalImageUrl, caption ? caption.trim() : null, validPrivacy]
    );

    const photoId = result.insertId;

    // Lấy thông tin bài viết vừa tạo kèm thông tin tác giả
    const [rows] = await pool.query(
      `
      SELECT 
        p.id,
        p.user_id,
        p.recipient_id,
        p.image_url,
        p.caption,
        p.privacy,
        p.created_at,
        u.full_name AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar
      FROM photos p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
      `,
      [photoId]
    );

    const protocol = req.protocol;
    const host = req.get('host');

    const createdPhoto = rows[0];
    createdPhoto.image_url = formatImageUrl(createdPhoto.image_url, protocol, host);
    if (createdPhoto.author_avatar && !createdPhoto.author_avatar.startsWith('http')) {
      createdPhoto.author_avatar = `${protocol}://${host}${createdPhoto.author_avatar.startsWith('/') ? '' : '/'}${createdPhoto.author_avatar}`;
    }

    // Gửi socket notification tới bạn bè realtime
    try {
      // Lấy danh sách bạn bè đã kết bạn
      const [friends] = await pool.query(
        `
        SELECT 
          CASE WHEN requester_id = ? THEN receiver_id ELSE requester_id END AS friend_id
        FROM friendships
        WHERE (requester_id = ? OR receiver_id = ?) AND status = 'accepted'
        `,
        [currentUserId, currentUserId, currentUserId]
      );

      const friendIds = friends.map((f) => f.friend_id);
      if (friendIds.length > 0 && req.io && validPrivacy !== 'private') {
        broadcastToUsers(req.io, friendIds, 'new_photo_posted', {
          photo: createdPhoto,
          author_name: createdPhoto.author_name || createdPhoto.author_username,
          message: `📸 ${createdPhoto.author_name || createdPhoto.author_username} vừa chia sẻ một khoảnh khắc Locket mới!`,
        });
      }
    } catch (socketErr) {
      console.warn('⚠️ Lỗi gửi socket notification cho photo:', socketErr.message);
    }

    // Realtime: thông báo bảng điều khiển admin có bài viết mới
    emitAdminNewPost(createdPhoto, host, protocol);

    return res.status(201).json({
      success: true,
      message: 'Đăng ảnh khoảnh khắc Locket thành công! 📸',
      data: createdPhoto,
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đăng ảnh.',
    });
  }
};

/**
 * 1.1. Upload video bài viết Locket mới
 * POST /api/photos/upload-video
 * Multipart form: video (file), thumbnail (file, optional), caption (text), recipient_id (optional), privacy (optional)
 */
const uploadVideoPost = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    if (!req.videoFile) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn 1 video để tải lên.',
      });
    }

    const { caption, recipient_id, privacy } = req.body;
    let recipientId = null;

    if (recipient_id && !isNaN(recipient_id)) {
      recipientId = parseInt(recipient_id, 10);
    }
    const validPrivacy = ['public', 'friends', 'private'].includes(privacy) ? privacy : 'friends';

    let finalVideoUrl = `/uploads/${req.videoFile.filename}`;
    let finalThumbnailUrl = null;

    if (req.thumbnailFile) {
      finalThumbnailUrl = `/uploads/${req.thumbnailFile.filename}`;
    }

    // Upload video lên Google Drive nếu cấu hình credentials
    try {
      const driveResult = await uploadFileToDrive(req.videoFile.path, req.videoFile.mimetype, req.videoFile.filename);
      if (driveResult && driveResult.directUrl) {
        finalVideoUrl = driveResult.directUrl;
        if (fs.existsSync(req.videoFile.path)) {
          fs.unlinkSync(req.videoFile.path);
        }
      }
    } catch (driveErr) {
      console.warn('⚠️ Gặp sự cố upload Video Google Drive, fallback sang lưu file nội bộ:', driveErr.message);
    }

    // Upload ảnh bìa thumbnail lên Google Drive nếu có
    if (req.thumbnailFile) {
      try {
        const driveThumbResult = await uploadFileToDrive(req.thumbnailFile.path, req.thumbnailFile.mimetype, req.thumbnailFile.filename);
        if (driveThumbResult && driveThumbResult.directUrl) {
          finalThumbnailUrl = driveThumbResult.directUrl;
          if (fs.existsSync(req.thumbnailFile.path)) {
            fs.unlinkSync(req.thumbnailFile.path);
          }
        }
      } catch (driveThumbErr) {
        console.warn('⚠️ Gặp sự cố upload Thumbnail Google Drive, fallback sang lưu file nội bộ:', driveThumbErr.message);
      }
    }

    const [result] = await pool.query(
      `INSERT INTO photos (user_id, recipient_id, image_url, video_url, media_type, caption, privacy) VALUES (?, ?, ?, ?, 'video', ?, ?)`,
      [currentUserId, recipientId, finalThumbnailUrl, finalVideoUrl, caption ? caption.trim() : null, validPrivacy]
    );

    const photoId = result.insertId;

    // Lấy thông tin bài viết vừa tạo kèm thông tin tác giả
    const [rows] = await pool.query(
      `
      SELECT 
        p.id,
        p.user_id,
        p.recipient_id,
        p.image_url,
        p.video_url,
        p.media_type,
        p.caption,
        p.privacy,
        p.created_at,
        u.full_name AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar
      FROM photos p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
      `,
      [photoId]
    );

    const protocol = req.protocol;
    const host = req.get('host');

    const createdPhoto = rows[0];
    createdPhoto.image_url = formatImageUrl(createdPhoto.image_url, protocol, host);
    if (createdPhoto.author_avatar && !createdPhoto.author_avatar.startsWith('http')) {
      createdPhoto.author_avatar = `${protocol}://${host}${createdPhoto.author_avatar.startsWith('/') ? '' : '/'}${createdPhoto.author_avatar}`;
    }

    // Gửi socket notification tới bạn bè realtime
    try {
      const [friends] = await pool.query(
        `
        SELECT 
          CASE WHEN requester_id = ? THEN receiver_id ELSE requester_id END AS friend_id
        FROM friendships
        WHERE (requester_id = ? OR receiver_id = ?) AND status = 'accepted'
        `,
        [currentUserId, currentUserId, currentUserId]
      );

      const friendIds = friends.map((f) => f.friend_id);
      if (friendIds.length > 0 && req.io && validPrivacy !== 'private') {
        broadcastToUsers(req.io, friendIds, 'new_photo_posted', {
          photo: createdPhoto,
          author_name: createdPhoto.author_name || createdPhoto.author_username,
          message: `📹 ${createdPhoto.author_name || createdPhoto.author_username} vừa chia sẻ một video khoảnh khắc mới!`,
        });
      }
    } catch (socketErr) {
      console.warn('⚠️ Lỗi gửi socket notification cho video photo:', socketErr.message);
    }

    // Realtime: thông báo bảng điều khiển admin có video mới
    emitAdminNewPost(createdPhoto, host, protocol);

    return res.status(201).json({
      success: true,
      message: 'Đăng video khoảnh khắc thành công! 📹',
      data: createdPhoto,
    });
  } catch (error) {
    console.error('Upload video post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đăng video.',
    });
  }
};

/**
 * 2. Lấy Bảng tin (Locket Feed) kèm danh sách Reactions
 * GET /api/photos/feed
 */
const getPhotoFeed = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const queryTerm = req.query.q ? req.query.q.trim() : '';
    const scope = req.query.scope || 'all';

    let querySql = `
      SELECT DISTINCT
        p.id,
        p.user_id,
        p.recipient_id,
        p.image_url,
        p.video_url,
        p.media_type,
        p.caption,
        p.privacy,
        p.created_at,
        u.full_name AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar,
        ru.full_name AS recipient_name
      FROM photos p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN users ru ON p.recipient_id = ru.id
      LEFT JOIN friendships f 
        ON ((f.requester_id = ? AND f.receiver_id = p.user_id) 
         OR (f.receiver_id = ? AND f.requester_id = p.user_id))
    `;
    let queryParams = [currentUserId, currentUserId];

    if (scope === 'public') {
      // Phạm vi công khai / khám phá: CHỈ bài đăng được cài đặt 'public' của người dùng công khai hoặc bạn bè đã kết bạn
      querySql += ` WHERE (p.privacy = 'public' AND p.recipient_id IS NULL AND (u.is_private_account IS NULL OR u.is_private_account = 0 OR p.user_id = ? OR f.status = 'accepted'))`;
      queryParams.push(currentUserId);
    } else if (scope === 'friends') {
      // Phạm vi chỉ bạn bè:
      // 1. Bài của chính bản thân (luôn thấy kể cả riêng tư)
      // 2. Bài của bạn bè: chỉ thấy nếu privacy thuộc 'public' hoặc 'friends' (không thấy bài riêng tư 'private' của bạn bè)
      querySql += ` WHERE (p.user_id = ? OR (f.status = 'accepted' AND p.privacy IN ('public', 'friends') AND (p.recipient_id IS NULL OR p.recipient_id = ?)))`;
      queryParams.push(currentUserId, currentUserId);
    } else {
      // Phạm vi mặc định 'all' (Bảng tin chung: Bài của mình + Bài bạn bè + Bài Công khai từ tất cả mọi người):
      // 1. Bài của chính bản thân (luôn thấy)
      // 2. Bài Công khai (public) của bất kỳ ai trong cộng đồng (tài khoản công khai hoặc bạn bè, không gửi riêng)
      // 3. Bài Bạn bè (friends) từ những người đã kết bạn thành công (f.status = 'accepted')
      querySql += ` WHERE (
        p.user_id = ?
        OR (p.privacy = 'public' AND p.recipient_id IS NULL AND (u.is_private_account IS NULL OR u.is_private_account = 0 OR f.status = 'accepted'))
        OR (f.status = 'accepted' AND p.privacy = 'friends' AND (p.recipient_id IS NULL OR p.recipient_id = ?))
      )`;
      queryParams.push(currentUserId, currentUserId);
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
    const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : null;

    if (queryTerm) {
      querySql += ` AND (p.caption LIKE ? OR u.full_name LIKE ? OR u.username LIKE ?)`;
      const termPattern = `%${queryTerm}%`;
      queryParams.push(termPattern, termPattern, termPattern);
    }

    if (cursor && !isNaN(cursor)) {
      querySql += ` AND p.id < ?`;
      queryParams.push(cursor);
    }

    querySql += ` ORDER BY p.id DESC LIMIT ?`;
    queryParams.push(limit);

    // Query các bức ảnh theo phân trang con trỏ thời gian (Cursor-based Pagination)
    const [rows] = await pool.query(querySql, queryParams);
    const formattedPhotos = await enrichPhotosWithReactionsAndComments(rows, currentUserId, req);

    const nextCursor = formattedPhotos.length === limit ? formattedPhotos[formattedPhotos.length - 1].id : null;
    const hasMore = formattedPhotos.length === limit;

    return res.json({
      success: true,
      message: 'Lấy bảng tin Locket thành công.',
      data: formattedPhotos,
      pagination: {
        next_cursor: nextCursor,
        has_more: hasMore,
        limit,
      },
    });
  } catch (error) {
    console.error('Get photo feed error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy bảng tin.',
    });
  }
};

/**
 * 2.1. Lấy danh sách ảnh do chính mình đăng (phục vụ Grid 3x3 Profile)
 * GET /api/photos/me
 */
const getMyPhotos = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT 
        p.id,
        p.user_id,
        p.recipient_id,
        p.image_url,
        p.video_url,
        p.media_type,
        p.caption,
        p.privacy,
        p.created_at,
        u.full_name AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar
      FROM photos p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT 100
      `,
      [currentUserId]
    );

    const formattedPhotos = await enrichPhotosWithReactionsAndComments(rows, currentUserId, req);

    return res.json({
      success: true,
      message: 'Lấy danh sách ảnh của tôi thành công.',
      data: formattedPhotos,
    });
  } catch (error) {
    console.error('Get my photos error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách ảnh của tôi.',
    });
  }
};

/**
 * 2.2. Lấy danh sách ảnh mình đã thả cảm xúc (phục vụ Tab Liked Profile)
 * GET /api/photos/liked
 */
const getLikedPhotos = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT DISTINCT
        p.id,
        p.user_id,
        p.recipient_id,
        p.image_url,
        p.video_url,
        p.media_type,
        p.caption,
        p.privacy,
        p.created_at,
        u.full_name AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar
      FROM photos p
      JOIN users u ON p.user_id = u.id
      JOIN photo_reactions pr ON p.id = pr.photo_id
      WHERE pr.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT 100
      `,
      [currentUserId]
    );

    const formattedPhotos = await enrichPhotosWithReactionsAndComments(rows, currentUserId, req);

    return res.json({
      success: true,
      message: 'Lấy danh sách ảnh đã thích thành công.',
      data: formattedPhotos,
    });
  } catch (error) {
    console.error('Get liked photos error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách ảnh đã thích.',
    });
  }
};

/**
 * 2.3. Lấy danh sách ảnh đã lưu (Saved / Bookmarks) của chính mình
 * GET /api/photos/saved
 */
const getSavedPhotos = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT 
        p.id,
        p.user_id,
        p.recipient_id,
        p.image_url,
        p.video_url,
        p.media_type,
        p.caption,
        p.privacy,
        p.created_at,
        u.full_name AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar
      FROM saved_photos sp
      JOIN photos p ON sp.photo_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE sp.user_id = ?
      ORDER BY sp.created_at DESC
      LIMIT 100
      `,
      [currentUserId]
    );

    const formattedPhotos = await enrichPhotosWithReactionsAndComments(rows, currentUserId, req);

    return res.json({
      success: true,
      message: 'Lấy danh sách bài viết đã lưu thành công.',
      data: formattedPhotos,
    });
  } catch (error) {
    console.error('Get saved photos error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy bài viết đã lưu.',
    });
  }
};

/**
 * 2.4. Lưu / Bỏ lưu bài viết (Toggle Bookmark)
 * POST /api/photos/:id/save
 */
const toggleSavePhoto = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const photoId = parseInt(req.params.id, 10);
    const { action } = req.body || {}; // 'save' | 'unsave' | undefined

    if (!photoId || isNaN(photoId)) {
      return res.status(400).json({ success: false, message: 'ID ảnh không hợp lệ.' });
    }

    const view = await canViewPhoto(photoId, currentUserId);
    if (!view.allowed) {
      return res.status(view.reason === 'not_found' ? 404 : 403).json({
        success: false,
        message: view.reason === 'not_found' ? 'Không tìm thấy bài viết.' : 'Bạn không có quyền thao tác với bài viết này.',
      });
    }

    const [existing] = await pool.query(
      'SELECT id FROM saved_photos WHERE user_id = ? AND photo_id = ?',
      [currentUserId, photoId]
    );

    let isSaved = false;
    if (action === 'save') {
      if (existing.length === 0) {
        await pool.query('INSERT INTO saved_photos (user_id, photo_id) VALUES (?, ?)', [
          currentUserId,
          photoId,
        ]);
      }
      isSaved = true;
    } else if (action === 'unsave') {
      if (existing.length > 0) {
        await pool.query('DELETE FROM saved_photos WHERE id = ?', [existing[0].id]);
      }
      isSaved = false;
    } else {
      // Toggle
      if (existing.length > 0) {
        await pool.query('DELETE FROM saved_photos WHERE id = ?', [existing[0].id]);
        isSaved = false;
      } else {
        await pool.query('INSERT INTO saved_photos (user_id, photo_id) VALUES (?, ?)', [
          currentUserId,
          photoId,
        ]);
        isSaved = true;
      }
    }

    return res.json({
      success: true,
      message: isSaved ? 'Đã lưu bài viết vào mục Đã lưu! 🔖' : 'Đã bỏ lưu bài viết.',
      data: { is_saved: isSaved },
    });
  } catch (error) {
    console.error('Toggle save photo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lưu bài viết.',
    });
  }
};

/**
 * 2.5. Lấy danh sách ảnh đã đăng lại (Reposts) của chính mình
 * GET /api/photos/reposts
 */
const getRepostedPhotos = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT 
        p.id,
        p.user_id,
        p.recipient_id,
        p.image_url,
        p.video_url,
        p.media_type,
        p.caption,
        p.privacy,
        p.created_at,
        u.full_name AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar
      FROM photo_reposts prp
      JOIN photos p ON prp.photo_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE prp.user_id = ?
      ORDER BY prp.created_at DESC
      LIMIT 100
      `,
      [currentUserId]
    );

    const formattedPhotos = await enrichPhotosWithReactionsAndComments(rows, currentUserId, req);

    return res.json({
      success: true,
      message: 'Lấy danh sách bài viết đăng lại thành công.',
      data: formattedPhotos,
    });
  } catch (error) {
    console.error('Get reposted photos error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy bài viết đăng lại.',
    });
  }
};

/**
 * 2.6. Đăng lại / Hủy đăng lại bài viết (Toggle Repost)
 * POST /api/photos/:id/repost
 */
const toggleRepost = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const photoId = parseInt(req.params.id, 10);
    const { action } = req.body || {}; // 'repost' | 'unrepost' | undefined

    if (!photoId || isNaN(photoId)) {
      return res.status(400).json({ success: false, message: 'ID ảnh không hợp lệ.' });
    }

    const view = await canViewPhoto(photoId, currentUserId);
    if (!view.allowed) {
      return res.status(view.reason === 'not_found' ? 404 : 403).json({
        success: false,
        message: view.reason === 'not_found' ? 'Không tìm thấy bài viết.' : 'Bạn không có quyền thao tác với bài viết này.',
      });
    }

    const [existing] = await pool.query(
      'SELECT id FROM photo_reposts WHERE user_id = ? AND photo_id = ?',
      [currentUserId, photoId]
    );

    let isReposted = false;
    if (action === 'repost') {
      if (existing.length === 0) {
        await pool.query('INSERT INTO photo_reposts (user_id, photo_id) VALUES (?, ?)', [
          currentUserId,
          photoId,
        ]);
      }
      isReposted = true;
    } else if (action === 'unrepost') {
      if (existing.length > 0) {
        await pool.query('DELETE FROM photo_reposts WHERE id = ?', [existing[0].id]);
      }
      isReposted = false;
    } else {
      // Toggle
      if (existing.length > 0) {
        await pool.query('DELETE FROM photo_reposts WHERE id = ?', [existing[0].id]);
        isReposted = false;
      } else {
        await pool.query('INSERT INTO photo_reposts (user_id, photo_id) VALUES (?, ?)', [
          currentUserId,
          photoId,
        ]);
        isReposted = true;
      }
    }

    return res.json({
      success: true,
      message: isReposted ? 'Đã đăng lại bài viết lên trang cá nhân! 🔁' : 'Đã hủy đăng lại bài viết.',
      data: { is_reposted: isReposted },
    });
  } catch (error) {
    console.error('Toggle repost photo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đăng lại bài viết.',
    });
  }
};

/**
 * 3. Thả / Bỏ thả biểu tượng cảm xúc (Toggle Reaction)
 * POST /api/photos/:id/react
 * Body: { emoji }
 */
const toggleReaction = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const photoId = req.params.id;
    const { emoji } = req.body;

    const validEmojis = ['❤️', '🔥', '😂', '😮', '😢'];
    if (!emoji || !validEmojis.includes(emoji)) {
      return res.status(400).json({
        success: false,
        message: 'Biểu tượng cảm xúc không hợp lệ.',
      });
    }

    // Kiểm tra ảnh có tồn tại
    const [photos] = await pool.query(`SELECT id, user_id FROM photos WHERE id = ?`, [photoId]);
    if (photos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bức ảnh này.',
      });
    }

    const photoAuthorId = photos[0].user_id;

    // KIỂM TRA QUYỀN: không xem được bài thì không thả được cảm xúc
    const view = await canViewPhoto(photoId, currentUserId);
    if (!view.allowed) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền tương tác với bài viết này.' });
    }

    // Kiểm tra đã thả chưa (1 người chỉ có DUY NHẤT 1 cảm xúc trên 1 bài - kiểu Facebook)
    const [existing] = await pool.query(
      `SELECT id, emoji FROM photo_reactions WHERE photo_id = ? AND user_id = ?`,
      [photoId, currentUserId]
    );

    let action = '';
    if (existing.length > 0) {
      if (existing[0].emoji === emoji) {
        // Đã thả đúng emoji này -> Bỏ thả
        await pool.query(`DELETE FROM photo_reactions WHERE id = ?`, [existing[0].id]);
        action = 'removed';
      } else {
        // Đã thả emoji khác -> Thay thế cảm xúc
        await pool.query(`UPDATE photo_reactions SET emoji = ? WHERE id = ?`, [emoji, existing[0].id]);
        action = 'replaced';
      }
    } else {
      // Chưa thả -> Thả mới
      await pool.query(
        `INSERT INTO photo_reactions (photo_id, user_id, emoji) VALUES (?, ?, ?)`,
        [photoId, currentUserId, emoji]
      );
      action = 'added';
    }

    // Lấy lại danh sách reactions mới của ảnh
    const [updatedReactions] = await pool.query(
      `
      SELECT 
        emoji,
        COUNT(*) as count,
        SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as user_reacted
      FROM photo_reactions
      WHERE photo_id = ?
      GROUP BY emoji
      `,
      [currentUserId, photoId]
    );

    const formattedReactions = updatedReactions.map((r) => ({
      emoji: r.emoji,
      count: parseInt(r.count, 10),
      user_reacted: r.user_reacted > 0,
    }));

    // Gửi socket event và lưu thông báo tới tác giả bức ảnh nếu không phải bản thân
    if (photoAuthorId !== currentUserId) {
      // Lấy tên người thả
      const [users] = await pool.query(`SELECT full_name, username FROM users WHERE id = ?`, [currentUserId]);
      const actorName = users[0]?.full_name || users[0]?.username || 'Một người bạn';

      if (req.io) {
        sendNotificationToUser(req.io, photoAuthorId, 'photo_reaction_updated', {
          photo_id: parseInt(photoId, 10),
          actor_id: currentUserId,
          actor_name: actorName,
          emoji,
          action,
          reactions: formattedReactions,
          message: `${actorName} đã thả ${emoji} vào bức ảnh của bạn!`,
        });
      }

      // Lưu notification vào database & phát realtime
      if (action === 'added') {
        createNotification({
          userId: photoAuthorId,
          actorId: currentUserId,
          type: 'like_post',
          entityId: photoId,
          content: `${actorName} đã bày tỏ cảm xúc ${emoji} về bài viết của bạn.`,
          io: req.io,
        }).catch((err) => console.error('Lỗi tạo thông báo like_post:', err.message));
      }
    }

    return res.json({
      success: true,
      message:
        action === 'added'
          ? `Đã thả ${emoji}`
          : action === 'replaced'
            ? `Đã đổi cảm xúc sang ${emoji}`
            : `Đã bỏ ${emoji}`,
      data: {
        photo_id: parseInt(photoId, 10),
        reactions: formattedReactions,
      },
    });
  } catch (error) {
    console.error('Toggle reaction error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi thả cảm xúc.',
    });
  }
};

/**
 * 3.1. Lấy danh sách người đã thả cảm xúc cho bài viết (theo từng emoji)
 * GET /api/photos/:id/reactions
 */
const getPhotoReactions = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const photoId = parseInt(req.params.id, 10);

    if (!photoId || isNaN(photoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID ảnh không hợp lệ.',
      });
    }

    // Kiểm tra người dùng có xem được bài viết không
    const view = await canViewPhoto(photoId, currentUserId);
    if (!view.allowed) {
      return res.status(view.reason === 'not_found' ? 404 : 403).json({
        success: false,
        message: view.reason === 'not_found' ? 'Không tìm thấy bài viết.' : 'Bạn không có quyền xem bài viết này.',
      });
    }

    // Lấy danh sách các cảm xúc kèm thông tin người dùng
    const [rows] = await pool.query(
      `
      SELECT 
        u.id AS user_id,
        u.username,
        u.full_name,
        u.avatar_url,
        pr.emoji
      FROM photo_reactions pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.photo_id = ?
      ORDER BY pr.emoji, pr.created_at ASC
      `,
      [photoId]
    );

    // Nhóm theo emoji
    const reactionsMap = {};
    rows.forEach((row) => {
      const emoji = row.emoji;
      if (!reactionsMap[emoji]) {
        reactionsMap[emoji] = [];
      }
      reactionsMap[emoji].push({
        user_id: row.user_id,
        username: row.username,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
      });
    });

    // Build response với avatar_url đầy đủ
    const protocol = req.protocol;
    const host = req.get('host');
    const reactions = {};
    for (const emoji of Object.keys(reactionsMap)) {
      reactions[emoji] = reactionsMap[emoji].map((user) => ({
        user_id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url && !user.avatar_url.startsWith('http')
          ? `${protocol}://${host}${user.avatar_url.startsWith('/') ? '' : '/'}${user.avatar_url}`
          : user.avatar_url,
      }));
    }

    return res.json({
      success: true,
      message: 'Lấy danh sách người đã thả cảm xúc thành công.',
      data: {
        photo_id: photoId,
        reactions,
      },
    });
  } catch (error) {
    console.error('Get photo reactions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách cảm xúc.',
    });
  }
};

/**
 * 4. Xóa ảnh khoảnh khắc của chính mình
 * DELETE /api/photos/:id
 */
const deletePhoto = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const photoId = req.params.id;

    const [result] = await pool.query(
      `DELETE FROM photos WHERE id = ? AND user_id = ?`,
      [photoId, currentUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ảnh hoặc bạn không có quyền xóa ảnh này.',
      });
    }

    return res.json({
      success: true,
      message: 'Đã xóa ảnh thành công.',
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xóa ảnh.',
    });
  }
};

/**
 * 5. Chỉnh sửa bài đăng (Cập nhật caption và privacy)
 * PUT /api/photos/:id
 */
const updatePhoto = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const photoId = req.params.id;
    const { caption, privacy } = req.body;

    const trimmedCaption = typeof caption === 'string' ? caption.trim() : null;
    const validPrivacy = ['public', 'friends', 'private'].includes(privacy) ? privacy : null;

    const [result] = await pool.query(
      `UPDATE photos SET caption = ?, privacy = COALESCE(?, privacy) WHERE id = ? AND user_id = ?`,
      [trimmedCaption, validPrivacy, photoId, currentUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài đăng hoặc bạn không có quyền chỉnh sửa bài đăng này.',
      });
    }

    const [rows] = await pool.query(
      `SELECT id, caption, privacy FROM photos WHERE id = ?`,
      [photoId]
    );
    const updatedRecord = rows[0] || {
      id: parseInt(photoId, 10),
      caption: trimmedCaption,
      privacy: validPrivacy || 'friends',
    };

    return res.json({
      success: true,
      message: 'Cập nhật bài đăng thành công.',
      data: {
        id: updatedRecord.id,
        caption: updatedRecord.caption,
        privacy: updatedRecord.privacy,
      },
    });
  } catch (error) {
    console.error('Update photo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật bài đăng.',
    });
  }
};

/**
 * 6. Stream ảnh Google Drive an toàn không bị chặn 429
 * GET /api/photos/drive/:fileId
 */
const getDriveImage = async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!fileId) {
      return res.status(400).send('Thiếu fileId');
    }

    // Set cache header để browser cache ảnh 1 ngày
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Content-Type', 'image/jpeg');

    const drive = getDriveClient();
    if (!drive) {
      return res.redirect(`https://lh3.googleusercontent.com/d/${fileId}`);
    }

    const driveStream = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    driveStream.data
      .on('error', (err) => {
        console.warn('⚠️ Lỗi stream ảnh Google Drive:', err.message);
        if (!res.headersSent) {
          res.redirect(`https://lh3.googleusercontent.com/d/${fileId}`);
        }
      })
      .pipe(res);
  } catch (error) {
    console.warn('⚠️ Get drive image error:', error.message);
    if (!res.headersSent) {
      res.redirect(`https://lh3.googleusercontent.com/d/${req.params.fileId}`);
    }
  }
};

/**
 * 7. Stream video bài viết Locket chuẩn HTTP 206 Partial Content (YouTube progressive buffer streaming)
 * GET /api/photos/video-stream/:photoId
 * Hỗ trợ Query param: ?token=... hoặc Header Authorization
 * Hỗ trợ Header Range: bytes=start-end
 */
const streamPhotoVideo = async (req, res) => {
  try {
    const photoId = parseInt(req.params.photoId, 10);
    if (isNaN(photoId)) {
      return res.status(400).json({ success: false, message: 'ID bài viết không hợp lệ.' });
    }

    // Xác thực token (qua Authorization header hoặc query param ?token=...)
    let userId = req.user ? req.user.id : null;
    if (!userId && req.query.token) {
      try {
        const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (tokenErr) {
        return res.status(401).json({ success: false, message: 'Token xác thực không hợp lệ.' });
      }
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để xem video.' });
    }

    const [rows] = await pool.query(
      `SELECT id, user_id, recipient_id, video_url, media_type, privacy FROM photos WHERE id = ?`,
      [photoId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
    }

    const photo = rows[0];
    const targetUrl = photo.video_url;
    if (!targetUrl) {
      return res.status(404).json({ success: false, message: 'Bài viết này không có tệp video.' });
    }

    // Kiểm tra quyền xem bài viết
    if (photo.user_id !== userId) {
      if (photo.privacy === 'private') {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem video riêng tư này.' });
      }
      if (photo.privacy === 'friends') {
        const [friends] = await pool.query(
          `SELECT id FROM friendships WHERE ((requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)) AND status = 'accepted'`,
          [photo.user_id, userId, userId, photo.user_id]
        );
        if (friends.length === 0) {
          return res.status(403).json({ success: false, message: 'Chỉ bạn bè mới có quyền xem video này.' });
        }
      }
      if (photo.recipient_id && photo.recipient_id !== userId) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem video gửi riêng này.' });
      }
    }

    const mimeType = 'video/mp4';

    // 1. Nếu video lưu trên Google Drive
    const match = targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      const drive = getDriveClient();
      if (!drive) {
        return res.status(500).json({ success: false, message: 'Google Drive client chưa sẵn sàng.' });
      }

      let totalSize = null;
      try {
        const meta = await drive.files.get({ fileId, fields: 'size, mimeType' });
        if (meta.data.size) {
          totalSize = parseInt(meta.data.size, 10);
        }
      } catch (mErr) {
        console.warn('Lỗi đọc size video photo từ Google Drive:', mErr.message);
      }

      const range = req.headers.range;
      if (range && totalSize) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType,
          'Cache-Control': 'no-cache',
        });

        const driveStream = await drive.files.get(
          { fileId, alt: 'media' },
          {
            responseType: 'stream',
            headers: {
              Range: `bytes=${start}-${end}`,
            },
          }
        );

        driveStream.data.on('error', (streamErr) => {
          if (!res.headersSent) res.status(500).end();
        });

        return driveStream.data.pipe(res);
      } else {
        res.writeHead(200, {
          'Accept-Ranges': 'bytes',
          'Content-Type': mimeType,
          ...(totalSize ? { 'Content-Length': totalSize } : {}),
        });

        const driveStream = await drive.files.get(
          { fileId, alt: 'media' },
          { responseType: 'stream' }
        );

        driveStream.data.on('error', (streamErr) => {
          if (!res.headersSent) res.status(500).end();
        });

        return driveStream.data.pipe(res);
      }
    }

    // 2. Nếu video lưu cục bộ trong /uploads/
    if (targetUrl.includes('/uploads/')) {
      const matchLocal = targetUrl.match(/\/uploads\/([a-zA-Z0-9_.-]+)/);
      const fname = matchLocal ? matchLocal[1] : path.basename(targetUrl);
      const localPath = path.join(__dirname, '../../uploads', fname);

      if (fs.existsSync(localPath)) {
        const stat = fs.statSync(localPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunkSize = end - start + 1;

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mimeType,
          });

          const fileStream = fs.createReadStream(localPath, { start, end });
          return fileStream.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
            'Content-Type': mimeType,
          });
          return fs.createReadStream(localPath).pipe(res);
        }
      }
    }

    // Fallback chuyển hướng đến file gốc
    return res.redirect(targetUrl);
  } catch (error) {
    console.error('Stream photo video error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi phát luồng video bài viết.' });
    }
  }
};


// ============================================================
// HELPER: Kiểm tra 1 user có QUYỀN XEM 1 bài viết hay không
// (tái dùng đúng điều kiện phạm vi của getPhotoFeed + getUserProfile)
// Trả về: { allowed: boolean, reason?: 'not_found' | 'private' | 'friends' | 'recipient' }
// ============================================================
const canViewPhoto = async (photoId, viewerId) => {
  const [photos] = await pool.query(
    'SELECT id, user_id, recipient_id, privacy FROM photos WHERE id = ?',
    [photoId]
  );
  if (photos.length === 0) {
    return { allowed: false, reason: 'not_found' };
  }
  const photo = photos[0];
  const pid = parseInt(photoId, 10);
  const vid = parseInt(viewerId, 10);

  // Chủ bài luôn xem được bài của mình
  if (photo.user_id === vid) return { allowed: true };

  // Bài gửi riêng tư: chỉ người gửi + người nhận
  if (photo.recipient_id) {
    if (photo.recipient_id === vid) return { allowed: true };
    return { allowed: false, reason: 'recipient' };
  }

  // Bài riêng tư: chỉ mình chủ bài
  if (photo.privacy === 'private') return { allowed: false, reason: 'private' };

  // Kiểm tra quan hệ bạn bè + tài khoản riêng tư của tác giả
  const [rel] = await pool.query(
    "SELECT id FROM friendships WHERE ((requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)) AND status = 'accepted'",
    [photo.user_id, vid, vid, photo.user_id]
  );
  const isFriend = rel.length > 0;

  if (photo.privacy === 'friends') {
    return isFriend ? { allowed: true } : { allowed: false, reason: 'friends' };
  }

  // privacy === 'public'
  const [author] = await pool.query('SELECT is_private_account FROM users WHERE id = ?', [photo.user_id]);
  const authorPrivate = author.length > 0 && Number(author[0].is_private_account) === 1;
  if (authorPrivate && !isFriend) return { allowed: false, reason: 'friends' };

  return { allowed: true };
};

module.exports = {
  uploadPhoto,
  uploadVideoPost,
  getPhotoFeed,
  getMyPhotos,
  getLikedPhotos,
  getSavedPhotos,
  toggleSavePhoto,
  getRepostedPhotos,
  toggleRepost,
  toggleReaction,
  getPhotoReactions,
  deletePhoto,
  updatePhoto,
  getDriveImage,
  streamPhotoVideo,
  formatImageUrl,
  enrichPhotosWithReactionsAndComments,
  canViewPhoto,
};

