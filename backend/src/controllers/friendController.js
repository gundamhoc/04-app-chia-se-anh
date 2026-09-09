const { pool } = require('../config/db');
const { sendNotificationToUser, isUserOnline } = require('../sockets/socketHandler');
const { enrichPhotosWithReactionsAndComments, formatImageUrl } = require('./photoController');
const { createNotification } = require('../services/notificationService');

// ============================================================
// Controller: Quản lý Bạn bè
// Format response CHUẨN: { success, message, data }
// ============================================================

/**
 * 1. Tìm kiếm người dùng theo username, full_name hoặc email
 * GET /api/friends/search?q=query
 */
const searchUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const query = req.query.q ? req.query.q.trim() : '';

    if (!query) {
      return res.json({
        success: true,
        message: 'Từ khóa tìm kiếm trống.',
        data: [],
      });
    }

    const escapedQuery = query.replace(/([%_\\])/g, '\\$1');
    const searchTerm = `%${escapedQuery}%`;

    // Query người dùng (trừ bản thân) kèm thông tin friendship giữa currentUserId và user đó
    const [rows] = await pool.query(
      `
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.full_name, 
        u.avatar_url, 
        u.bio,
        f.id AS friendship_id,
        f.requester_id,
        f.receiver_id,
        f.status AS friendship_raw_status
      FROM users u
      LEFT JOIN friendships f 
        ON ((f.requester_id = ? AND f.receiver_id = u.id) 
         OR (f.receiver_id = ? AND f.requester_id = u.id))
      WHERE u.id != ? 
        AND u.is_active = 1
        AND (
          (u.username LIKE ? AND (COALESCE(f.status, '') = 'accepted' OR u.searchable_by_username = 1))
          OR
          (u.full_name LIKE ? AND (COALESCE(f.status, '') = 'accepted' OR u.searchable_by_name = 1))
          OR
          (u.email LIKE ? AND (COALESCE(f.status, '') = 'accepted' OR u.searchable_by_email = 1))
        )
      ORDER BY u.full_name ASC, u.username ASC
      LIMIT 30
      `,
      [currentUserId, currentUserId, currentUserId, searchTerm, searchTerm, searchTerm]
    );

    // Format avatar_url & tính toán trạng thái kết bạn chi tiết (friendship_status)
    const protocol = req.protocol;
    const host = req.get('host');

    const formattedUsers = rows.map((u) => {
      let avatar_url = u.avatar_url;
      if (avatar_url && !avatar_url.startsWith('http://') && !avatar_url.startsWith('https://')) {
        avatar_url = `${protocol}://${host}${avatar_url.startsWith('/') ? '' : '/'}${avatar_url}`;
      }

      let friendship_status = 'none';
      if (u.friendship_raw_status === 'accepted') {
        friendship_status = 'accepted';
      } else if (u.friendship_raw_status === 'pending') {
        if (u.requester_id === currentUserId) {
          friendship_status = 'pending_sent';
        } else {
          friendship_status = 'pending_received';
        }
      }

      return {
        id: u.id,
        username: u.username,
        email: u.email,
        full_name: u.full_name,
        avatar_url,
        bio: u.bio,
        friendship_status,
        is_online: isUserOnline(u.id),
      };
    });

    return res.json({
      success: true,
      message: 'Tìm thấy danh sách người dùng.',
      data: formattedUsers,
    });
  } catch (error) {
    console.error('Search users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tìm kiếm người dùng.',
    });
  }
};

/**
 * 2. Gửi lời mời kết bạn
 * POST /api/friends/request
 * Body: { target_id }
 */
const sendFriendRequest = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { target_id } = req.body;

    if (!target_id || isNaN(target_id)) {
      return res.status(400).json({
        success: false,
        message: 'ID người nhận lời mời không hợp lệ.',
      });
    }

    const targetId = parseInt(target_id, 10);
    if (targetId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể tự gửi lời mời kết bạn cho chính mình.',
      });
    }

    // Kiểm tra user nhận có tồn tại không
    const [targetUser] = await pool.query('SELECT id FROM users WHERE id = ? AND is_active = 1', [targetId]);
    if (targetUser.length === 0) {
      return res.status(440).json({
        success: false,
        message: 'Người dùng không tồn tại.',
      });
    }

    // Kiểm tra xem đã có mối quan hệ kết bạn nào chưa
    const [existing] = await pool.query(
      `SELECT * FROM friendships WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)`,
      [currentUserId, targetId, targetId, currentUserId]
    );

    if (existing.length > 0) {
      const record = existing[0];
      if (record.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Hai bạn đã là bạn bè từ trước.',
        });
      }
      if (record.status === 'pending') {
        if (record.requester_id === currentUserId) {
          return res.status(400).json({
            success: false,
            message: 'Bạn đã gửi lời mời kết bạn trước đó.',
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'Người này đã gửi lời mời kết bạn cho bạn. Hãy chấp nhận lời mời.',
          });
        }
      }

      // Nếu trạng thái cũ là rejected, cập nhật lại thành pending
      await pool.query(
        `UPDATE friendships SET requester_id = ?, receiver_id = ?, status = 'pending' WHERE id = ?`,
        [currentUserId, targetId, record.id]
      );
    } else {
      // Tạo lời mời kết bạn mới
      await pool.query(
        `INSERT INTO friendships (requester_id, receiver_id, status) VALUES (?, ?, 'pending')`,
        [currentUserId, targetId]
      );
    }

    // Gửi socket notification & lưu thông báo tới targetId
    try {
      const [sender] = await pool.query('SELECT full_name, username FROM users WHERE id = ?', [currentUserId]);
      const senderName = sender[0]?.full_name || sender[0]?.username || 'Một người bạn';

      if (req.io) {
        sendNotificationToUser(req.io, targetId, 'friend_request_received', {
          sender_id: currentUserId,
          sender_name: senderName,
          message: `👥 ${senderName} đã gửi cho bạn một lời mời kết bạn!`,
        });
      }

      createNotification({
        userId: targetId,
        actorId: currentUserId,
        type: 'friend_request',
        entityId: currentUserId,
        content: `${senderName} đã gửi cho bạn một lời mời kết bạn.`,
        io: req.io,
      }).catch((err) => console.error('Lỗi tạo thông báo friend_request:', err.message));
    } catch (socketErr) {
      console.warn('⚠️ Lỗi gửi thông báo friend_request:', socketErr.message);
    }

    return res.json({
      success: true,
      message: 'Đã gửi lời mời kết bạn thành công.',
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi gửi lời mời kết bạn.',
    });
  }
};

/**
 * 3. Chấp nhận lời mời kết bạn
 * POST /api/friends/accept
 * Body: { requester_id }
 */
const acceptFriendRequest = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { requester_id } = req.body;

    if (!requester_id || isNaN(requester_id)) {
      return res.status(400).json({
        success: false,
        message: 'ID người gửi lời mời không hợp lệ.',
      });
    }

    const requesterId = parseInt(requester_id, 10);

    const [result] = await pool.query(
      `UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND receiver_id = ? AND status = 'pending'`,
      [requesterId, currentUserId]
    );

    if (result.affectedRows === 0) {
      // Kiểm tra xem hai bạn đã là bạn bè từ trước hay chưa
      const [alreadyFriends] = await pool.query(
        `SELECT id FROM friendships WHERE ((requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)) AND status = 'accepted'`,
        [requesterId, currentUserId, currentUserId, requesterId]
      );
      if (alreadyFriends.length > 0) {
        // Xóa thông báo lời mời kết bạn cũ bị tồn đọng
        await pool.query(
          `DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'friend_request'`,
          [currentUserId, requesterId]
        );
        return res.json({
          success: true,
          message: 'Hai bạn đã là bạn bè từ trước.',
        });
      }

      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lời mời kết bạn đang chờ phù hợp.',
      });
    }

    // Dọn dẹp thông báo lời mời kết bạn đang chờ
    await pool.query(
      `DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'friend_request'`,
      [currentUserId, requesterId]
    );

    // Gửi socket notification & lưu thông báo tới requesterId
    try {
      const [accepter] = await pool.query('SELECT full_name, username FROM users WHERE id = ?', [currentUserId]);
      const accepterName = accepter[0]?.full_name || accepter[0]?.username || 'Một người bạn';

      if (req.io) {
        sendNotificationToUser(req.io, requesterId, 'friend_request_accepted', {
          user_id: currentUserId,
          user_name: accepterName,
          message: `🎉 ${accepterName} đã đồng ý lời mời kết bạn của bạn!`,
        });
      }

      createNotification({
        userId: requesterId,
        actorId: currentUserId,
        type: 'friend_accept',
        entityId: currentUserId,
        content: `${accepterName} đã chấp nhận lời mời kết bạn của bạn.`,
        io: req.io,
      }).catch((err) => console.error('Lỗi tạo thông báo friend_accept:', err.message));
    } catch (socketErr) {
      console.warn('⚠️ Lỗi gửi thông báo friend_accept:', socketErr.message);
    }

    return res.json({
      success: true,
      message: 'Đã chấp nhận lời mời kết bạn.',
    });

  } catch (error) {
    console.error('Accept friend request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi chấp nhận lời mời kết bạn.',
    });
  }
};

/**
 * 4. Từ chối / Hủy lời mời / Hủy kết bạn
 * POST /api/friends/reject
 * Body: { target_id }
 */
const rejectOrCancelRequest = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { target_id } = req.body;

    if (!target_id || isNaN(target_id)) {
      return res.status(400).json({
        success: false,
        message: 'ID đối phương không hợp lệ.',
      });
    }

    const targetId = parseInt(target_id, 10);

    const [result] = await pool.query(
      `DELETE FROM friendships WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)`,
      [currentUserId, targetId, targetId, currentUserId]
    );

    // Dọn dẹp thông báo kết bạn liên quan
    await pool.query(
      `DELETE FROM notifications WHERE ((user_id = ? AND actor_id = ?) OR (user_id = ? AND actor_id = ?)) AND type = 'friend_request'`,
      [currentUserId, targetId, targetId, currentUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy mối quan hệ kết bạn để xóa.',
      });
    }

    return res.json({
      success: true,
      message: 'Đã xử lý hủy / từ chối kết bạn thành công.',
    });

  } catch (error) {
    console.error('Reject or cancel friend request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi hủy mối quan hệ kết bạn.',
    });
  }
};

/**
 * 5. Lấy danh sách bạn bè đã kết bạn
 * GET /api/friends/list
 */
const getFriendsList = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.full_name, 
        u.avatar_url, 
        u.bio,
        f.updated_at AS friendship_date
      FROM users u
      JOIN friendships f 
        ON ((f.requester_id = ? AND f.receiver_id = u.id) 
         OR (f.receiver_id = ? AND f.requester_id = u.id))
      WHERE f.status = 'accepted'
        AND u.is_active = 1
      ORDER BY u.full_name ASC
      `,
      [currentUserId, currentUserId]
    );

    const protocol = req.protocol;
    const host = req.get('host');

    const formattedFriends = rows.map((u) => {
      let avatar_url = u.avatar_url;
      if (avatar_url && !avatar_url.startsWith('http://') && !avatar_url.startsWith('https://')) {
        avatar_url = `${protocol}://${host}${avatar_url.startsWith('/') ? '' : '/'}${avatar_url}`;
      }
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        full_name: u.full_name,
        avatar_url,
        bio: u.bio,
        friendship_date: u.friendship_date,
        is_online: isUserOnline(u.id),
      };
    });

    return res.json({
      success: true,
      message: 'Lấy danh sách bạn bè thành công.',
      data: formattedFriends,
    });
  } catch (error) {
    console.error('Get friends list error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách bạn bè.',
    });
  }
};

/**
 * 6. Lấy danh sách lời mời kết bạn đang chờ (được nhận)
 * GET /api/friends/requests
 */
const getPendingRequests = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT 
        f.id AS friendship_id,
        u.id AS requester_id,
        u.username,
        u.email,
        u.full_name,
        u.avatar_url,
        u.bio,
        f.created_at AS request_time
      FROM friendships f
      JOIN users u ON f.requester_id = u.id
      WHERE f.receiver_id = ? 
        AND f.status = 'pending'
        AND u.is_active = 1
      ORDER BY f.created_at DESC
      `,
      [currentUserId]
    );

    const protocol = req.protocol;
    const host = req.get('host');

    const formattedRequests = rows.map((r) => {
      let avatar_url = r.avatar_url;
      if (avatar_url && !avatar_url.startsWith('http://') && !avatar_url.startsWith('https://')) {
        avatar_url = `${protocol}://${host}${avatar_url.startsWith('/') ? '' : '/'}${avatar_url}`;
      }
      return {
        friendship_id: r.friendship_id,
        requester_id: r.requester_id,
        username: r.username,
        email: r.email,
        full_name: r.full_name,
        avatar_url,
        bio: r.bio,
        request_time: r.request_time,
      };
    });

    return res.json({
      success: true,
      message: 'Lấy danh sách lời mời kết bạn thành công.',
      data: formattedRequests,
    });
  } catch (error) {
    console.error('Get pending requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách lời mời kết bạn.',
    });
  }
};

/**
 * 7. Lấy danh sách gợi ý kết bạn (những người chưa kết bạn và không có pending request)
 * GET /api/friends/suggestions
 */
const getSuggestions = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Tìm những người dùng đang hoạt động, khác bản thân, và không có mối quan hệ bạn bè (hoặc bị từ chối/hủy)
    const [rows] = await pool.query(
      `
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.full_name, 
        u.avatar_url, 
        u.bio
      FROM users u
      LEFT JOIN friendships f 
        ON ((f.requester_id = ? AND f.receiver_id = u.id) 
         OR (f.receiver_id = ? AND f.requester_id = u.id))
      WHERE u.id != ? 
        AND u.is_active = 1
        AND (u.allow_suggest_account IS NULL OR u.allow_suggest_account = 1)
        AND (f.id IS NULL OR f.status NOT IN ('accepted', 'pending'))
      ORDER BY u.created_at DESC
      LIMIT 30
      `,
      [currentUserId, currentUserId, currentUserId]
    );

    const protocol = req.protocol;
    const host = req.get('host');

    const formattedSuggestions = rows.map((u) => {
      let avatar_url = u.avatar_url;
      if (avatar_url && !avatar_url.startsWith('http://') && !avatar_url.startsWith('https://')) {
        avatar_url = `${protocol}://${host}${avatar_url.startsWith('/') ? '' : '/'}${avatar_url}`;
      }
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        full_name: u.full_name,
        avatar_url,
        bio: u.bio,
        friendship_status: 'none',
        is_online: isUserOnline(u.id),
      };
    });

    return res.json({
      success: true,
      message: 'Lấy danh sách gợi ý kết bạn thành công.',
      data: formattedSuggestions,
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách gợi ý kết bạn.',
    });
  }
};

/**
 * 8. Xem trang cá nhân người khác
 * GET /api/friends/profile/:id
 */
const getUserProfile = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = parseInt(req.params.id, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'ID người dùng không hợp lệ.',
      });
    }

    const protocol = req.protocol;
    const host = req.get('host');

    // 1. Lấy thông tin tài khoản người dùng
    const [userRows] = await pool.query(
      `SELECT id, username, email, full_name, avatar_url, cover_url, bio, is_active, is_private_account, created_at 
       FROM users 
       WHERE id = ?`,
      [targetUserId]
    );

    if (userRows.length === 0 || userRows[0].is_active === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng này hoặc tài khoản đã bị vô hiệu hóa.',
      });
    }

    const targetUser = userRows[0];
    const formattedAvatar = formatImageUrl(targetUser.avatar_url, protocol, host);
    const formattedCover = formatImageUrl(targetUser.cover_url, protocol, host);

    // 2. Xác định mối quan hệ kết bạn giữa currentUserId và targetUserId
    let friendship_status = 'none';
    let friendship_id = null;
    const isSelf = currentUserId === targetUserId;

    if (isSelf) {
      friendship_status = 'self';
    } else {
      const [fRows] = await pool.query(
        `SELECT id, requester_id, receiver_id, status 
         FROM friendships 
         WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)`,
        [currentUserId, targetUserId, targetUserId, currentUserId]
      );

      if (fRows.length > 0) {
        const f = fRows[0];
        friendship_id = f.id;
        if (f.status === 'accepted') {
          friendship_status = 'accepted';
        } else if (f.status === 'pending') {
          friendship_status = f.requester_id === currentUserId ? 'pending_sent' : 'pending_received';
        }
      }
    }

    // 3. Tính toán thống kê người dùng (Bài viết, Bạn bè, Tổng lượt thích)
    const [postCountRows] = await pool.query(
      'SELECT COUNT(*) as count FROM photos WHERE user_id = ?',
      [targetUserId]
    );
    const [friendCountRows] = await pool.query(
      "SELECT COUNT(*) as count FROM friendships WHERE (requester_id = ? OR receiver_id = ?) AND status = 'accepted'",
      [targetUserId, targetUserId]
    );
    const [likeCountRows] = await pool.query(
      'SELECT COUNT(*) as count FROM photo_reactions pr JOIN photos p ON pr.photo_id = p.id WHERE p.user_id = ?',
      [targetUserId]
    );

    const stats = {
      posts_count: parseInt(postCountRows[0]?.count || 0, 10),
      friends_count: parseInt(friendCountRows[0]?.count || 0, 10),
      likes_count: parseInt(likeCountRows[0]?.count || 0, 10),
    };

    // 4. Lấy danh sách ảnh hiển thị theo quyền riêng tư và quan hệ kết bạn
    let photosRows = [];
    let isLocked = false;

    if (isSelf) {
      const [rows] = await pool.query(
        `SELECT 
           p.id, p.user_id, p.recipient_id, p.image_url, p.video_url, p.media_type, p.caption, p.privacy, p.created_at,
           u.full_name AS author_name, u.username AS author_username, u.avatar_url AS author_avatar
         FROM photos p
         JOIN users u ON p.user_id = u.id
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC
         LIMIT 60`,
        [targetUserId]
      );
      photosRows = rows;
    } else if (friendship_status === 'accepted') {
      const [rows] = await pool.query(
        `SELECT 
           p.id, p.user_id, p.recipient_id, p.image_url, p.video_url, p.media_type, p.caption, p.privacy, p.created_at,
           u.full_name AS author_name, u.username AS author_username, u.avatar_url AS author_avatar
         FROM photos p
         JOIN users u ON p.user_id = u.id
         WHERE p.user_id = ? 
           AND p.privacy IN ('public', 'friends') 
           AND (p.recipient_id IS NULL OR p.recipient_id = ? OR p.recipient_id = ?)
         ORDER BY p.created_at DESC
         LIMIT 60`,
        [targetUserId, currentUserId, targetUserId]
      );
      photosRows = rows;
    } else {
      // Không phải bạn bè
      if (targetUser.is_private_account) {
        isLocked = true;
        photosRows = [];
      } else {
        const [rows] = await pool.query(
          `SELECT 
             p.id, p.user_id, p.recipient_id, p.image_url, p.video_url, p.media_type, p.caption, p.privacy, p.created_at,
             u.full_name AS author_name, u.username AS author_username, u.avatar_url AS author_avatar
           FROM photos p
           JOIN users u ON p.user_id = u.id
           WHERE p.user_id = ? 
             AND p.privacy = 'public' 
             AND p.recipient_id IS NULL
           ORDER BY p.created_at DESC
           LIMIT 60`,
          [targetUserId]
        );
        photosRows = rows;
      }
    }

    const formattedPhotos = photosRows.length > 0
      ? await enrichPhotosWithReactionsAndComments(photosRows, currentUserId, req)
      : [];

    return res.json({
      success: true,
      message: 'Lấy thông tin trang cá nhân thành công.',
      data: {
        user: {
          id: targetUser.id,
          username: targetUser.username,
          email: targetUser.email,
          full_name: targetUser.full_name,
          avatar_url: formattedAvatar,
          cover_url: formattedCover,
          bio: targetUser.bio,
          is_private_account: Boolean(targetUser.is_private_account),
          created_at: targetUser.created_at,
          stats,
          friendship_status,
          friendship_id,
          is_online: isUserOnline(targetUserId),
        },
        photos: formattedPhotos,
        is_locked: isLocked,
      },
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy thông tin trang cá nhân.',
    });
  }
};

module.exports = {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectOrCancelRequest,
  getFriendsList,
  getPendingRequests,
  getSuggestions,
  getUserProfile,
};
