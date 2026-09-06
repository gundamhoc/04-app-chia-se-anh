const { pool } = require('../config/db');
const { uploadFileToDrive, getDriveClient } = require('../utils/googleDrive');
const { sendNotificationToUser, broadcastToUsers } = require('../sockets/socketHandler');
const fs = require('fs');

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
 * 2. Lấy Bảng tin (Locket Feed) kèm danh sách Reactions
 * GET /api/photos/feed
 */
const getPhotoFeed = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const queryTerm = req.query.q ? req.query.q.trim() : '';
    const scope = req.query.scope === 'public' ? 'public' : 'friends';

    let querySql = `
      SELECT DISTINCT
        p.id,
        p.user_id,
        p.recipient_id,
        p.image_url,
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
      // Phạm vi công khai / khám phá: CHỈ bài đăng được cài đặt 'public' của bất kỳ ai trong hệ thống (kể cả người lạ)
      querySql += ` WHERE (p.privacy = 'public' AND p.recipient_id IS NULL)`;
    } else {
      // Phạm vi bạn bè:
      // 1. Bài của chính bản thân (p.user_id = currentUserId): luôn thấy kể cả riêng tư
      // 2. Bài của bạn bè: chỉ thấy nếu privacy thuộc 'public' hoặc 'friends' (không thấy bài riêng tư 'private' của bạn bè)
      querySql += ` WHERE (p.user_id = ? OR (f.status = 'accepted' AND p.privacy IN ('public', 'friends') AND (p.recipient_id IS NULL OR p.recipient_id = ?)))`;
      queryParams.push(currentUserId, currentUserId);
    }

    if (queryTerm) {
      querySql += ` AND (p.caption LIKE ? OR u.full_name LIKE ? OR u.username LIKE ?)`;
      const termPattern = `%${queryTerm}%`;
      queryParams.push(termPattern, termPattern, termPattern);
    }

    querySql += ` ORDER BY p.created_at DESC LIMIT 50`;

    // Query các bức ảnh của bản thân HOẶC của bạn bè đã accepted (có lọc theo từ khóa nếu có)
    const [rows] = await pool.query(querySql, queryParams);

    const protocol = req.protocol;
    const host = req.get('host');

    // Lấy tất cả reactions và comment_count cho danh sách các bức ảnh thu được
    const photoIds = rows.map((p) => p.id);
    let reactionsMap = {};
    let commentCountMap = {};

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
    }

    const formattedPhotos = rows.map((p) => {
      let image_url = formatImageUrl(p.image_url, protocol, host);

      let author_avatar = p.author_avatar;
      if (author_avatar && !author_avatar.startsWith('http')) {
        author_avatar = `${protocol}://${host}${author_avatar.startsWith('/') ? '' : '/'}${author_avatar}`;
      }

      const reactionsList = reactionsMap[p.id] || [];
      // Sắp xếp các emoji theo count giảm dần và lấy đúng tối đa 2 emoji cao nhất
      const sortedReactions = [...reactionsList].sort((a, b) => b.count - a.count);
      const top2Reactions = sortedReactions.slice(0, 2);
      const totalReactionsCount = reactionsList.reduce((acc, r) => acc + r.count, 0);

      return {
        id: p.id,
        user_id: p.user_id,
        recipient_id: p.recipient_id,
        image_url,
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
      };
    });

    return res.json({
      success: true,
      message: 'Lấy bảng tin Locket thành công.',
      data: formattedPhotos,
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

    // Kiểm tra đã thả chưa
    const [existing] = await pool.query(
      `SELECT id FROM photo_reactions WHERE photo_id = ? AND user_id = ? AND emoji = ?`,
      [photoId, currentUserId, emoji]
    );

    let action = '';
    if (existing.length > 0) {
      // Đã thả -> Bỏ thả
      await pool.query(`DELETE FROM photo_reactions WHERE id = ?`, [existing[0].id]);
      action = 'removed';
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

    // Gửi socket event tới tác giả bức ảnh nếu không phải bản thân
    if (photoAuthorId !== currentUserId && req.io) {
      // Lấy tên người thả
      const [users] = await pool.query(`SELECT full_name, username FROM users WHERE id = ?`, [currentUserId]);
      const actorName = users[0]?.full_name || users[0]?.username || 'Một người bạn';

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

    return res.json({
      success: true,
      message: action === 'added' ? `Đã thả ${emoji}` : `Đã bỏ ${emoji}`,
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

module.exports = {
  uploadPhoto,
  getPhotoFeed,
  toggleReaction,
  deletePhoto,
  updatePhoto,
  getDriveImage,
};

