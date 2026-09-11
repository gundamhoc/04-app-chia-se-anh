const { pool } = require('../config/db');
const { sendNotificationToUser } = require('../sockets/socketHandler');
const { createNotification } = require('../services/notificationService');
const { canViewPhoto } = require('../controllers/photoController');

// ============================================================
// Controller: Quản lý Bình luận & Thả cảm xúc bình luận
// Format response CHUẨN: { success, message, data }
// ============================================================

const VALID_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢'];

/**
 * 1. Lấy danh sách bình luận của bài viết
 * GET /api/photos/:id/comments
 */
const getComments = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const photoId = req.params.id;

    // KIỂM TRA QUYỀN: không xem được bài viết thì không đọc được bình luận
    const view = await canViewPhoto(photoId, currentUserId);
    if (!view.allowed) {
      return res.status(view.reason === 'not_found' ? 404 : 403).json({
        success: false,
        message: view.reason === 'not_found' ? 'Không tìm thấy bài viết.' : 'Bạn không có quyền xem bình luận của bài viết này.',
      });
    }

    // Lấy danh sách bình luận kèm thông tin tác giả và người được reply
    const [rows] = await pool.query(
      `
      SELECT 
        c.id,
        c.photo_id,
        c.user_id,
        c.parent_id,
        c.content,
        c.created_at,
        u.full_name AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar,
        pu.username AS reply_to_username,
        pu.full_name AS reply_to_name
      FROM photo_comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN photo_comments pc ON c.parent_id = pc.id
      LEFT JOIN users pu ON pc.user_id = pu.id
      WHERE c.photo_id = ?
      ORDER BY c.created_at ASC
      `,
      [photoId]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        message: 'Lấy danh sách bình luận thành công.',
        data: [],
      });
    }

    const commentIds = rows.map((c) => c.id);

    // Lấy cảm xúc của các bình luận
    const [reactions] = await pool.query(
      `
      SELECT 
        comment_id,
        emoji,
        COUNT(*) as count,
        SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as user_reacted
      FROM comment_reactions
      WHERE comment_id IN (?)
      GROUP BY comment_id, emoji
      `,
      [currentUserId, commentIds]
    );

    const reactionsMap = {};
    reactions.forEach((r) => {
      if (!reactionsMap[r.comment_id]) {
        reactionsMap[r.comment_id] = [];
      }
      reactionsMap[r.comment_id].push({
        emoji: r.emoji,
        count: parseInt(r.count, 10),
        user_reacted: r.user_reacted > 0,
      });
    });

    const protocol = req.protocol;
    const host = req.get('host');

    const formattedComments = rows.map((c) => {
      let author_avatar = c.author_avatar;
      if (author_avatar && !author_avatar.startsWith('http')) {
        author_avatar = `${protocol}://${host}${author_avatar.startsWith('/') ? '' : '/'}${author_avatar}`;
      }

      return {
        id: c.id,
        photo_id: c.photo_id,
        user_id: c.user_id,
        parent_id: c.parent_id,
        content: c.content,
        created_at: c.created_at,
        author_name: c.author_name || c.author_username,
        author_username: c.author_username,
        author_avatar,
        reply_to_username: c.reply_to_username || null,
        reply_to_name: c.reply_to_name || null,
        reactions: reactionsMap[c.id] || [],
      };
    });

    return res.json({
      success: true,
      message: 'Lấy danh sách bình luận thành công.',
      data: formattedComments,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách bình luận.',
    });
  }
};

/**
 * 2. Thêm bình luận mới hoặc phản hồi bình luận
 * POST /api/photos/:id/comments
 * Body: { content, parent_id? }
 */
const createComment = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const photoId = req.params.id;
    const { content, parent_id } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung bình luận không được để trống.',
      });
    }

    // Kiểm tra ảnh tồn tại + QUYỀN bình luận (bị ẩn/private/không phải bạn bè -> chặn)
    const view = await canViewPhoto(photoId, currentUserId);
    if (!view.allowed) {
      return res.status(view.reason === 'not_found' ? 404 : 403).json({
        success: false,
        message: view.reason === 'not_found' ? 'Không tìm thấy bức ảnh này.' : 'Bạn không có quyền bình luận bài viết này.',
      });
    }
    const [photos] = await pool.query('SELECT id, user_id FROM photos WHERE id = ?', [photoId]);
    const photoAuthorId = photos[0].user_id;

    let parentId = null;
    let parentAuthorId = null;

    // Nếu là phản hồi bình luận (reply)
    if (parent_id && !isNaN(parent_id)) {
      parentId = parseInt(parent_id, 10);
      const [parentComments] = await pool.query(
        `SELECT id, user_id FROM photo_comments WHERE id = ? AND photo_id = ?`,
        [parentId, photoId]
      );
      if (parentComments.length > 0) {
        parentAuthorId = parentComments[0].user_id;
      } else {
        parentId = null;
      }
    }

    const [result] = await pool.query(
      `INSERT INTO photo_comments (photo_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)`,
      [photoId, currentUserId, parentId, content.trim()]
    );

    const commentId = result.insertId;

    // Lấy bình luận vừa tạo
    const [rows] = await pool.query(
      `
      SELECT 
        c.id,
        c.photo_id,
        c.user_id,
        c.parent_id,
        c.content,
        c.created_at,
        u.full_name AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar,
        pu.username AS reply_to_username,
        pu.full_name AS reply_to_name
      FROM photo_comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN photo_comments pc ON c.parent_id = pc.id
      LEFT JOIN users pu ON pc.user_id = pu.id
      WHERE c.id = ?
      `,
      [commentId]
    );

    const protocol = req.protocol;
    const host = req.get('host');

    const createdComment = rows[0];
    if (createdComment.author_avatar && !createdComment.author_avatar.startsWith('http')) {
      createdComment.author_avatar = `${protocol}://${host}${createdComment.author_avatar.startsWith('/') ? '' : '/'}${createdComment.author_avatar}`;
    }
    createdComment.reactions = [];

    // Gửi socket notification & lưu thông báo tới tác giả bài viết
    if (photoAuthorId !== currentUserId) {
      if (req.io) {
        sendNotificationToUser(req.io, photoAuthorId, 'new_comment', {
          photo_id: parseInt(photoId, 10),
          comment: createdComment,
          message: `💬 ${createdComment.author_name || createdComment.author_username} đã bình luận vào ảnh của bạn!`,
        });
      }

      createNotification({
        userId: photoAuthorId,
        actorId: currentUserId,
        type: 'comment_post',
        entityId: photoId,
        content: `${createdComment.author_name || createdComment.author_username} đã bình luận về bài viết: "${content.trim().slice(0, 60)}"`,
        io: req.io,
      }).catch((err) => console.error('Lỗi tạo thông báo comment_post:', err.message));
    }

    // Nếu trả lời bình luận của người khác, gửi socket và thông báo cho người đó
    if (parentAuthorId && parentAuthorId !== currentUserId && parentAuthorId !== photoAuthorId) {
      if (req.io) {
        sendNotificationToUser(req.io, parentAuthorId, 'new_comment_reply', {
          photo_id: parseInt(photoId, 10),
          comment: createdComment,
          message: `💬 ${createdComment.author_name || createdComment.author_username} đã trả lời bình luận của bạn!`,
        });
      }

      createNotification({
        userId: parentAuthorId,
        actorId: currentUserId,
        type: 'reply_comment',
        entityId: photoId,
        content: `${createdComment.author_name || createdComment.author_username} đã trả lời bình luận của bạn: "${content.trim().slice(0, 60)}"`,
        io: req.io,
      }).catch((err) => console.error('Lỗi tạo thông báo reply_comment:', err.message));
    }

    return res.status(201).json({
      success: true,
      message: 'Đã gửi bình luận thành công.',
      data: createdComment,
    });
  } catch (error) {
    console.error('Create comment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi gửi bình luận.',
    });
  }
};

/**
 * 3. Xóa bình luận
 * DELETE /api/photos/comments/:commentId
 */
const deleteComment = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const commentId = req.params.commentId;

    // Chỉ tác giả bình luận HOẶC tác giả bài viết mới được xóa
    const [comments] = await pool.query(
      `
      SELECT c.id, c.user_id, c.photo_id, p.user_id AS photo_author_id 
      FROM photo_comments c
      JOIN photos p ON c.photo_id = p.id
      WHERE c.id = ?
      `,
      [commentId]
    );

    if (comments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bình luận này.',
      });
    }

    const comment = comments[0];
    // Người xóa PHẢI còn quyền xem bài viết (chủ bài hoặc tác giả comment)
    const view = await canViewPhoto(comment.photo_id, currentUserId);
    if (!view.allowed) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa bình luận này.',
      });
    }
    if (comment.user_id !== currentUserId && comment.photo_author_id !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa bình luận này.',
      });
    }

    await pool.query(`DELETE FROM photo_comments WHERE id = ?`, [commentId]);

    return res.json({
      success: true,
      message: 'Đã xóa bình luận thành công.',
      data: { comment_id: parseInt(commentId, 10) },
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xóa bình luận.',
    });
  }
};

/**
 * 4. Thả / Bỏ thả biểu tượng cảm xúc trên bình luận
 * POST /api/photos/comments/:commentId/react
 * Body: { emoji }
 */
const toggleCommentReaction = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const commentId = req.params.commentId;
    const { emoji } = req.body;

    if (!emoji || !VALID_EMOJIS.includes(emoji)) {
      return res.status(400).json({
        success: false,
        message: 'Biểu tượng cảm xúc không hợp lệ.',
      });
    }

    // Kiểm tra bình luận có tồn tại
    const [comments] = await pool.query(`SELECT id, user_id, photo_id FROM photo_comments WHERE id = ?`, [commentId]);
    if (comments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bình luận này.',
      });
    }

    const commentAuthorId = comments[0].user_id;

    // KIỂM TRA QUYỀN: phải xem được bài viết chứa bình luận mới được thả cảm xúc
    const view = await canViewPhoto(comments[0].photo_id, currentUserId);
    if (!view.allowed) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền tương tác với bình luận này.',
      });
    }

    // Kiểm tra đã thả chưa (1 người chỉ có DUY NHẤT 1 cảm xúc trên 1 bình luận - kiểu Facebook)
    const [existing] = await pool.query(
      `SELECT id, emoji FROM comment_reactions WHERE comment_id = ? AND user_id = ?`,
      [commentId, currentUserId]
    );

    let action = '';
    if (existing.length > 0) {
      if (existing[0].emoji === emoji) {
        await pool.query(`DELETE FROM comment_reactions WHERE id = ?`, [existing[0].id]);
        action = 'removed';
      } else {
        await pool.query(`UPDATE comment_reactions SET emoji = ? WHERE id = ?`, [emoji, existing[0].id]);
        action = 'replaced';
      }
    } else {
      await pool.query(
        `INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES (?, ?, ?)`,
        [commentId, currentUserId, emoji]
      );
      action = 'added';
    }

    // Lấy lại danh sách reactions mới của bình luận
    const [updatedReactions] = await pool.query(
      `
      SELECT 
        emoji,
        COUNT(*) as count,
        SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as user_reacted
      FROM comment_reactions
      WHERE comment_id = ?
      GROUP BY emoji
      `,
      [currentUserId, commentId]
    );

    const formattedReactions = updatedReactions.map((r) => ({
      emoji: r.emoji,
      count: parseInt(r.count, 10),
      user_reacted: r.user_reacted > 0,
    }));

    // Gửi socket event & lưu thông báo tới tác giả bình luận nếu không phải bản thân
    if (commentAuthorId !== currentUserId) {
      const [users] = await pool.query(`SELECT full_name, username FROM users WHERE id = ?`, [currentUserId]);
      const actorName = users[0]?.full_name || users[0]?.username || 'Một người bạn';

      if (req.io) {
        sendNotificationToUser(req.io, commentAuthorId, 'comment_reaction_updated', {
          comment_id: parseInt(commentId, 10),
          actor_id: currentUserId,
          actor_name: actorName,
          emoji,
          action,
          reactions: formattedReactions,
          message: `${actorName} đã thả ${emoji} vào bình luận của bạn!`,
        });
      }

      if (action === 'added') {
        createNotification({
          userId: commentAuthorId,
          actorId: currentUserId,
          type: 'like_comment',
          entityId: commentId,
          content: `${actorName} đã thả ${emoji} vào bình luận của bạn.`,
          io: req.io,
        }).catch((err) => console.error('Lỗi tạo thông báo like_comment:', err.message));
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
        comment_id: parseInt(commentId, 10),
        reactions: formattedReactions,
      },
    });
  } catch (error) {
    console.error('Toggle comment reaction error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi thả cảm xúc bình luận.',
    });
  }
};

module.exports = {
  getComments,
  createComment,
  deleteComment,
  toggleCommentReaction,
};
