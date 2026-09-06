const { pool } = require('../config/db');
const { sendNotificationToUser } = require('../sockets/socketHandler');

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

    // Gửi socket notification tới targetId nếu online
    try {
      if (req.io) {
        const [sender] = await pool.query('SELECT full_name, username FROM users WHERE id = ?', [currentUserId]);
        const senderName = sender[0]?.full_name || sender[0]?.username || 'Một người bạn';
        sendNotificationToUser(req.io, targetId, 'friend_request_received', {
          sender_id: currentUserId,
          sender_name: senderName,
          message: `👥 ${senderName} đã gửi cho bạn một lời mời kết bạn!`,
        });
      }
    } catch (socketErr) {
      console.warn('⚠️ Lỗi gửi socket notification friend_request:', socketErr.message);
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
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lời mời kết bạn đang chờ phù hợp.',
      });
    }

    // Gửi socket notification tới requesterId nếu online
    try {
      if (req.io) {
        const [accepter] = await pool.query('SELECT full_name, username FROM users WHERE id = ?', [currentUserId]);
        const accepterName = accepter[0]?.full_name || accepter[0]?.username || 'Một người bạn';
        sendNotificationToUser(req.io, requesterId, 'friend_request_accepted', {
          user_id: currentUserId,
          user_name: accepterName,
          message: `🎉 ${accepterName} đã đồng ý lời mời kết bạn của bạn!`,
        });
      }
    } catch (socketErr) {
      console.warn('⚠️ Lỗi gửi socket notification friend_accept:', socketErr.message);
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

module.exports = {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectOrCancelRequest,
  getFriendsList,
  getPendingRequests,
  getSuggestions,
};
