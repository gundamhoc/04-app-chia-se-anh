const { pool } = require('../config/db');
const { uploadFileToDrive } = require('../utils/googleDrive');
const { sendNotificationToGroup, sendNotificationToUser, leaveGroupRoom } = require('../sockets/socketHandler');
const fs = require('fs');

// Helper chuẩn hóa link ảnh Google Drive hoặc local
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

// Helper link download tệp tin
function formatDownloadUrl(messageId, protocol, host) {
  if (!messageId) return null;
  return `${protocol}://${host}/api/messages/download/${messageId}`;
}

/**
 * 1. Tạo nhóm trò chuyện mới
 * POST /api/groups
 * Body: { name, member_ids: [userId1, userId2] }
 */
const createGroup = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { name, member_ids = [] } = req.body;
    const protocol = req.protocol;
    const host = req.get('host');

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Tên nhóm phải có ít nhất 2 ký tự.' });
    }

    let groupAvatar = null;
    if (req.file) {
      try {
        const driveResult = await uploadFileToDrive(req.file.path, req.file.mimetype, req.file.filename);
        if (driveResult && driveResult.directUrl) {
          groupAvatar = driveResult.directUrl;
        }
      } catch (err) {
        groupAvatar = `/uploads/${req.file.filename}`;
      }
    }

    // 1. Tạo nhóm
    const [groupResult] = await pool.query(
      `INSERT INTO \`groups\` (name, avatar_url, creator_id) VALUES (?, ?, ?)`,
      [name.trim(), groupAvatar, currentUserId]
    );

    const groupId = groupResult.insertId;

    // 2. Thêm creator làm admin
    await pool.query(
      `INSERT INTO \`group_members\` (group_id, user_id, role) VALUES (?, ?, 'admin')`,
      [groupId, currentUserId]
    );

    // 3. Thêm các thành viên ban đầu
    let rawMembers = req.body.member_ids || req.body['member_ids[]'] || [];
    if (typeof rawMembers === 'string') {
      try {
        rawMembers = JSON.parse(rawMembers);
      } catch (e) {
        rawMembers = rawMembers.split(',').map((s) => s.trim());
      }
    }
    const validMemberIds = (Array.isArray(rawMembers) ? rawMembers : [rawMembers])
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id) && id !== currentUserId);

    for (const memberId of validMemberIds) {
      await pool.query(
        `INSERT IGNORE INTO \`group_members\` (group_id, user_id, role) VALUES (?, ?, 'member')`,
        [groupId, memberId]
      );
    }

    // 4. Lấy thông tin nhóm đầy đủ vừa tạo
    const [rows] = await pool.query(
      `
      SELECT 
        g.id,
        g.name,
        g.avatar_url,
        g.background_url,
        g.creator_id,
        g.created_at,
        COUNT(gm.id) AS member_count
      FROM \`groups\` g
      LEFT JOIN \`group_members\` gm ON g.id = gm.group_id
      WHERE g.id = ?
      GROUP BY g.id
      `,
      [groupId]
    );

    const group = rows[0];
    const formattedGroup = {
      id: group.id,
      name: group.name,
      avatar_url: formatImageUrl(group.avatar_url, protocol, host),
      background_url: formatImageUrl(group.background_url, protocol, host),
      creator_id: group.creator_id,
      member_count: parseInt(group.member_count, 10) || 1,
      my_role: 'admin',
      created_at: group.created_at,
    };

    // Thông báo realtime tới các thành viên được mời
    if (req.io) {
      for (const mId of validMemberIds) {
        sendNotificationToUser(req.io, mId, 'invited_to_group', formattedGroup);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Tạo nhóm trò chuyện thành công! 👥',
      data: formattedGroup,
    });
  } catch (error) {
    console.error('Create group error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo nhóm.' });
  }
};

/**
 * 2. Lấy danh sách nhóm người dùng tham gia
 * GET /api/groups
 */
const getMyGroups = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const protocol = req.protocol;
    const host = req.get('host');

    const [rows] = await pool.query(
      `
      SELECT 
        g.id,
        g.name,
        g.avatar_url,
        g.background_url,
        g.creator_id,
        g.created_at,
        gm.role AS my_role,
        gm.is_pinned,
        gm.is_muted,
        (SELECT COUNT(*) FROM \`group_members\` WHERE group_id = g.id) AS member_count,
        lm.id AS last_message_id,
        lm.message_text AS last_message_text,
        lm.image_url AS last_message_image,
        lm.file_name AS last_message_file_name,
        lm.file_url AS last_message_file_url,
        lm.sender_id AS last_message_sender_id,
        u.full_name AS last_message_sender_name,
        lm.created_at AS last_message_time
      FROM \`group_members\` gm
      JOIN \`groups\` g ON gm.group_id = g.id
      LEFT JOIN (
        SELECT m1.*
        FROM messages m1
        JOIN (
          SELECT group_id, MAX(id) AS max_id
          FROM messages
          WHERE group_id IS NOT NULL
          GROUP BY group_id
        ) m2 ON m1.id = m2.max_id
      ) lm ON g.id = lm.group_id
      LEFT JOIN users u ON lm.sender_id = u.id
      WHERE gm.user_id = ?
      ORDER BY 
        CASE WHEN gm.is_pinned = 1 THEN 0 ELSE 1 END,
        CASE WHEN lm.created_at IS NOT NULL THEN 0 ELSE 1 END,
        lm.created_at DESC,
        g.created_at DESC
      `,
      [currentUserId]
    );

    const groups = rows.map((g) => ({
      id: g.id,
      name: g.name,
      avatar_url: formatImageUrl(g.avatar_url, protocol, host),
      background_url: formatImageUrl(g.background_url, protocol, host),
      creator_id: g.creator_id,
      my_role: g.my_role,
      is_pinned: Boolean(g.is_pinned),
      is_muted: Boolean(g.is_muted),
      member_count: parseInt(g.member_count, 10) || 0,
      last_message: g.last_message_id
        ? {
            id: g.last_message_id,
            text: g.last_message_text,
            image_url: formatImageUrl(g.last_message_image, protocol, host),
            file_name: g.last_message_file_name,
            file_url: g.last_message_file_url ? formatDownloadUrl(g.last_message_id, protocol, host) : null,
            sender_id: g.last_message_sender_id,
            sender_name: g.last_message_sender_name,
            time: g.last_message_time,
          }
        : null,
      created_at: g.created_at,
    }));

    return res.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    console.error('Get my groups error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách nhóm.' });
  }
};

/**
 * 3. Lấy thông tin chi tiết nhóm và danh sách thành viên
 * GET /api/groups/:id
 */
const getGroupDetail = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = parseInt(req.params.id, 10);
    const protocol = req.protocol;
    const host = req.get('host');

    if (isNaN(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ.' });
    }

    // Kiểm tra user có trong nhóm không
    const [membership] = await pool.query(
      `SELECT role, is_pinned, is_muted FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
      [groupId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên của nhóm này.' });
    }

    const myRole = membership[0].role;
    const isPinned = Boolean(membership[0].is_pinned);
    const isMuted = Boolean(membership[0].is_muted);

    // Lấy thông tin nhóm
    const [groupRows] = await pool.query(
      `SELECT id, name, avatar_url, background_url, creator_id, created_at FROM \`groups\` WHERE id = ?`,
      [groupId]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm này.' });
    }

    const group = groupRows[0];

    // Lấy danh sách thành viên
    const [memberRows] = await pool.query(
      `
      SELECT 
        gm.id AS membership_id,
        gm.user_id,
        gm.role,
        gm.joined_at,
        u.username,
        u.full_name,
        u.avatar_url
      FROM \`group_members\` gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY 
        CASE WHEN gm.role = 'admin' THEN 0 ELSE 1 END,
        gm.joined_at ASC
      `,
      [groupId]
    );

    const members = memberRows.map((m) => ({
      id: m.membership_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      username: m.username,
      full_name: m.full_name || m.username,
      avatar_url: formatImageUrl(m.avatar_url, protocol, host),
      is_me: m.user_id === currentUserId,
    }));

    return res.json({
      success: true,
      data: {
        id: group.id,
        name: group.name,
        avatar_url: formatImageUrl(group.avatar_url, protocol, host),
        background_url: formatImageUrl(group.background_url, protocol, host),
        creator_id: group.creator_id,
        created_at: group.created_at,
        my_role: myRole,
        is_pinned: isPinned,
        is_muted: isMuted,
        member_count: members.length,
        members,
      },
    });
  } catch (error) {
    console.error('Get group detail error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy chi tiết nhóm.' });
  }
};

/**
 * 4. Cập nhật tên hoặc ảnh đại diện nhóm
 * PUT /api/groups/:id
 */
const updateGroup = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = parseInt(req.params.id, 10);
    const { name, type = 'avatar', background_preset, remove_background, remove_avatar } = req.body;
    const protocol = req.protocol;
    const host = req.get('host');

    if (isNaN(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ.' });
    }

    const [membership] = await pool.query(
      `SELECT role FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
      [groupId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa nhóm này.' });
    }

    const updates = [];
    const params = [];

    if (name && name.trim().length >= 2) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (req.file) {
      let uploadedUrl = `/uploads/${req.file.filename}`;
      try {
        const driveResult = await uploadFileToDrive(req.file.path, req.file.mimetype, req.file.filename);
        if (driveResult && driveResult.directUrl) {
          uploadedUrl = driveResult.directUrl;
        }
      } catch (err) {
        console.warn('Lỗi upload file nhóm lên drive:', err.message);
      }

      if (type === 'background') {
        updates.push('background_url = ?');
        params.push(uploadedUrl);
      } else {
        updates.push('avatar_url = ?');
        params.push(uploadedUrl);
      }
    }

    if (background_preset && background_preset.trim().length > 0) {
      updates.push('background_url = ?');
      params.push(background_preset.trim());
    }

    if (remove_background === 'true' || remove_background === true) {
      updates.push('background_url = NULL');
    }

    if (remove_avatar === 'true' || remove_avatar === true) {
      updates.push('avatar_url = NULL');
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có thông tin nào để cập nhật.' });
    }

    params.push(groupId);
    await pool.query(`UPDATE \`groups\` SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.query(
      `SELECT id, name, avatar_url, background_url FROM \`groups\` WHERE id = ?`,
      [groupId]
    );
    const groupData = {
      id: updated[0].id,
      name: updated[0].name,
      avatar_url: formatImageUrl(updated[0].avatar_url, protocol, host),
      background_url: formatImageUrl(updated[0].background_url, protocol, host),
    };

    if (req.io) {
      sendNotificationToGroup(req.io, groupId, 'group_updated', groupData);
    }

    return res.json({
      success: true,
      message: 'Cập nhật nhóm thành công! ✨',
      data: groupData,
    });
  } catch (error) {
    console.error('Update group error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật nhóm.' });
  }
};

/**
 * 5. Thêm thành viên vào nhóm
 * POST /api/groups/:id/members
 * Body: { member_ids: [userId1, userId2] }
 */
const addMembers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = parseInt(req.params.id, 10);
    const { member_ids = [] } = req.body;

    if (isNaN(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ.' });
    }

    const [membership] = await pool.query(
      `SELECT role FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
      [groupId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên nhóm này.' });
    }

    let rawMembers = req.body.member_ids || req.body['member_ids[]'] || [];
    if (typeof rawMembers === 'string') {
      try {
        rawMembers = JSON.parse(rawMembers);
      } catch (e) {
        rawMembers = rawMembers.split(',').map((s) => s.trim());
      }
    }
    const validMemberIds = (Array.isArray(rawMembers) ? rawMembers : [rawMembers])
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    if (validMemberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 thành viên để thêm.' });
    }

    for (const uId of validMemberIds) {
      await pool.query(
        `INSERT IGNORE INTO \`group_members\` (group_id, user_id, role) VALUES (?, ?, 'member')`,
        [groupId, uId]
      );
    }

    if (req.io) {
      sendNotificationToGroup(req.io, groupId, 'group_members_updated', { groupId });
    }

    return res.json({
      success: true,
      message: 'Đã thêm thành viên vào nhóm thành công! 👥',
    });
  } catch (error) {
    console.error('Add group members error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thêm thành viên.' });
  }
};

/**
 * 6. Xóa thành viên hoặc Rời khỏi nhóm
 * DELETE /api/groups/:id/members/:userId
 */
const removeMember = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(groupId) || isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.' });
    }

    const [myMembership] = await pool.query(
      `SELECT role FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
      [groupId, currentUserId]
    );

    if (myMembership.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không có trong nhóm này.' });
    }

    const isSelfLeaving = currentUserId === targetUserId;
    const isAdmin = myMembership[0].role === 'admin';

    if (!isSelfLeaving && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới có quyền xóa thành viên.' });
    }

    const [targetMembership] = await pool.query(
      `SELECT role FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
      [groupId, targetUserId]
    );

    if (targetMembership.length === 0) {
      return res.status(404).json({ success: false, message: 'Thành viên không tồn tại trong nhóm.' });
    }

    if (!isSelfLeaving && targetMembership[0].role === 'admin') {
      return res.status(403).json({ success: false, message: 'Không thể xóa quản trị viên khác.' });
    }

    if (isSelfLeaving && isAdmin) {
      const [memberStats] = await pool.query(
        `SELECT COUNT(*) AS total_members, SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admin_count
         FROM \`group_members\` WHERE group_id = ?`,
        [groupId]
      );
      const totalMembers = Number(memberStats[0].total_members) || 0;
      const adminCount = Number(memberStats[0].admin_count) || 0;
      if (adminCount <= 1 && totalMembers > 1) {
        return res.status(403).json({
          success: false,
          message: 'Bạn là quản trị viên cuối cùng. Hãy thêm hoặc phân quyền quản trị cho thành viên khác trước khi rời nhóm.',
        });
      }
    }

    await pool.query(
      `DELETE FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
      [groupId, targetUserId]
    );

    // Nếu admin rời nhóm và vẫn còn thành viên, tự động thăng cấp thành viên lâu nhất làm admin
    if (isSelfLeaving && isAdmin) {
      const [remaining] = await pool.query(
        `SELECT user_id FROM \`group_members\` WHERE group_id = ? ORDER BY joined_at ASC LIMIT 1`,
        [groupId]
      );
      if (remaining.length > 0) {
        await pool.query(
          `UPDATE \`group_members\` SET role = 'admin' WHERE group_id = ? AND user_id = ?`,
          [groupId, remaining[0].user_id]
        );
      }
    }

    if (req.io) {
      // Cuong che nguoi bi xoa/roi nhom ra khoi phong realtime de khong con nghe tin
      leaveGroupRoom(req.io, groupId, targetUserId);
      sendNotificationToGroup(req.io, groupId, 'group_members_updated', { groupId, removedUserId: targetUserId });
    }

    return res.json({
      success: true,
      message: isSelfLeaving ? 'Bạn đã rời khỏi nhóm.' : 'Đã xóa thành viên khỏi nhóm.',
    });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xử lý thành viên.' });
  }
};

/**
 * 7. Lấy lịch sử tin nhắn trong nhóm
 * GET /api/groups/:id/messages
 */
const getGroupMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = parseInt(req.params.id, 10);
    const protocol = req.protocol;
    const host = req.get('host');

    if (isNaN(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ.' });
    }

    const [membership] = await pool.query(
      `SELECT role FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
      [groupId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên nhóm này.' });
    }

    const [messages] = await pool.query(
      `
      SELECT 
        m.id,
        m.sender_id,
        m.group_id,
        m.message_text,
        m.image_url,
        m.file_url,
        m.file_name,
        m.file_size,
        m.file_type,
        m.created_at,
        u.full_name AS sender_name,
        u.avatar_url AS sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.group_id = ?
      ORDER BY m.created_at ASC
      LIMIT 100
      `,
      [groupId]
    );

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      group_id: m.group_id,
      message_text: m.message_text,
      image_url: formatImageUrl(m.image_url, protocol, host),
      file_url: m.file_url ? formatDownloadUrl(m.id, protocol, host) : null,
      file_name: m.file_name,
      file_size: m.file_size,
      file_type: m.file_type,
      created_at: m.created_at,
      sender_name: m.sender_name,
      sender_avatar: formatImageUrl(m.sender_avatar, protocol, host),
      is_mine: m.sender_id === currentUserId,
    }));

    return res.json({
      success: true,
      data: formattedMessages,
    });
  } catch (error) {
    console.error('Get group messages error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy tin nhắn nhóm.' });
  }
};

/**
 * 8. Gửi tin nhắn văn bản vào nhóm
 * POST /api/groups/:id/messages
 * Body: { message_text }
 */
const sendGroupMessage = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = parseInt(req.params.id, 10);
    const { message_text } = req.body;
    const protocol = req.protocol;
    const host = req.get('host');

    if (isNaN(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ.' });
    }

    if (!message_text || message_text.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
    }

    const [membership] = await pool.query(
      `SELECT role FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
      [groupId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên nhóm này.' });
    }

    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, group_id, message_text) VALUES (?, ?, ?)`,
      [currentUserId, groupId, message_text.trim()]
    );

    const messageId = result.insertId;

    const [rows] = await pool.query(
      `
      SELECT 
        m.id,
        m.sender_id,
        m.group_id,
        m.message_text,
        m.image_url,
        m.file_url,
        m.file_name,
        m.file_size,
        m.file_type,
        m.created_at,
        u.full_name AS sender_name,
        u.avatar_url AS sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
      `,
      [messageId]
    );

    const created = rows[0];
    const formattedMessage = {
      id: created.id,
      sender_id: created.sender_id,
      group_id: created.group_id,
      message_text: created.message_text,
      image_url: null,
      file_url: null,
      file_name: null,
      file_size: null,
      file_type: null,
      created_at: created.created_at,
      sender_name: created.sender_name,
      sender_avatar: formatImageUrl(created.sender_avatar, protocol, host),
      is_mine: false,
    };

    if (req.io) {
      sendNotificationToGroup(req.io, groupId, 'new_group_message', formattedMessage);
    }

    return res.status(201).json({
      success: true,
      message: 'Gửi tin nhắn nhóm thành công.',
      data: {
        ...formattedMessage,
        is_mine: true,
      },
    });
  } catch (error) {
    console.error('Send group message error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gửi tin nhắn nhóm.' });
  }
};

/**
 * 9. Gửi hình ảnh vào nhóm
 * POST /api/groups/:id/upload-image
 */
const sendGroupImageMessage = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = parseInt(req.params.id, 10);
    const { message_text } = req.body;
    const protocol = req.protocol;
    const host = req.get('host');

    if (isNaN(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn 1 hình ảnh.' });
    }

    const [membership] = await pool.query(
      `SELECT role FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
      [groupId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên nhóm này.' });
    }

    let finalImageUrl = `/uploads/${req.file.filename}`;
    try {
      const driveResult = await uploadFileToDrive(req.file.path, req.file.mimetype, req.file.filename);
      if (driveResult && driveResult.directUrl) {
        finalImageUrl = driveResult.directUrl;
      }
    } catch (err) {
      console.warn('Lỗi upload ảnh nhóm lên drive:', err.message);
    }

    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, group_id, message_text, image_url) VALUES (?, ?, ?, ?)`,
      [currentUserId, groupId, message_text ? message_text.trim() : null, finalImageUrl]
    );

    const messageId = result.insertId;

    const [rows] = await pool.query(
      `
      SELECT 
        m.id,
        m.sender_id,
        m.group_id,
        m.message_text,
        m.image_url,
        m.file_url,
        m.file_name,
        m.file_size,
        m.file_type,
        m.created_at,
        u.full_name AS sender_name,
        u.avatar_url AS sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
      `,
      [messageId]
    );

    const created = rows[0];
    const formattedMessage = {
      id: created.id,
      sender_id: created.sender_id,
      group_id: created.group_id,
      message_text: created.message_text,
      image_url: formatImageUrl(created.image_url, protocol, host),
      file_url: null,
      file_name: null,
      file_size: null,
      file_type: null,
      created_at: created.created_at,
      sender_name: created.sender_name,
      sender_avatar: formatImageUrl(created.sender_avatar, protocol, host),
      is_mine: false,
    };

    if (req.io) {
      sendNotificationToGroup(req.io, groupId, 'new_group_message', formattedMessage);
    }

    return res.status(201).json({
      success: true,
      message: 'Gửi ảnh nhóm thành công! 📸',
      data: {
        ...formattedMessage,
        is_mine: true,
      },
    });
  } catch (error) {
    console.error('Send group image error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gửi ảnh nhóm.' });
  }
};

/**
 * 10. Gửi tệp tin vào nhóm (code, doc, pdf, zip...)
 * POST /api/groups/:id/upload-file
 */
const sendGroupFileMessage = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = parseInt(req.params.id, 10);
    const { message_text } = req.body;
    const protocol = req.protocol;
    const host = req.get('host');

    if (isNaN(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn 1 tệp tin.' });
    }

    const [membership] = await pool.query(
      `SELECT role FROM \`group_members\` WHERE group_id = ? AND user_id = ?`,
      [groupId, currentUserId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên nhóm này.' });
    }

    let finalFileUrl = `/uploads/${req.file.filename}`;
    const isImage = req.file.mimetype ? req.file.mimetype.startsWith('image/') : false;

    try {
      const driveResult = await uploadFileToDrive(req.file.path, req.file.mimetype, req.file.originalname || req.file.filename);
      if (driveResult && driveResult.directUrl) {
        finalFileUrl = driveResult.directUrl;
        if (fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkErr) {
            console.warn('⚠️ Lỗi xóa file tạm sau upload nhóm:', unlinkErr.message);
          }
        }
      }
    } catch (err) {
      console.warn('Lỗi upload file nhóm lên drive:', err.message);
    }

    let imageUrl = isImage ? finalFileUrl : null;

    // Nếu là video hoặc tệp tin và có gửi kèm thumbnail ảnh bìa
    if (!isImage && req.thumbnailFile) {
      let finalThumbUrl = `/uploads/${req.thumbnailFile.filename}`;
      try {
        const thumbDriveResult = await uploadFileToDrive(
          req.thumbnailFile.path,
          req.thumbnailFile.mimetype,
          req.thumbnailFile.originalname || req.thumbnailFile.filename
        );
        if (thumbDriveResult && thumbDriveResult.directUrl) {
          finalThumbUrl = thumbDriveResult.directUrl;
          if (fs.existsSync(req.thumbnailFile.path)) {
            try {
              fs.unlinkSync(req.thumbnailFile.path);
            } catch (unlinkErr) {
              console.warn('⚠️ Lỗi xóa file thumbnail nhóm tạm:', unlinkErr.message);
            }
          }
        }
      } catch (thumbDriveErr) {
        console.warn('⚠️ Lỗi upload thumbnail nhóm lên Google Drive:', thumbDriveErr.message);
      }
      imageUrl = finalThumbUrl;
    }

    const fileName = req.file.originalname || req.file.filename;
    const fileSize = req.file.size;
    const fileType = req.file.mimetype || 'application/octet-stream';

    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, group_id, message_text, image_url, file_url, file_name, file_size, file_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [currentUserId, groupId, message_text ? message_text.trim() : null, imageUrl, finalFileUrl, fileName, fileSize, fileType]
    );

    const messageId = result.insertId;

    const [rows] = await pool.query(
      `
      SELECT 
        m.id,
        m.sender_id,
        m.group_id,
        m.message_text,
        m.image_url,
        m.file_url,
        m.file_name,
        m.file_size,
        m.file_type,
        m.created_at,
        u.full_name AS sender_name,
        u.avatar_url AS sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
      `,
      [messageId]
    );

    const created = rows[0];
    const formattedMessage = {
      id: created.id,
      sender_id: created.sender_id,
      group_id: created.group_id,
      message_text: created.message_text,
      image_url: formatImageUrl(created.image_url, protocol, host),
      file_url: formatDownloadUrl(created.id, protocol, host),
      file_name: created.file_name,
      file_size: created.file_size,
      file_type: created.file_type,
      created_at: created.created_at,
      sender_name: created.sender_name,
      sender_avatar: formatImageUrl(created.sender_avatar, protocol, host),
      is_mine: false,
    };

    if (req.io) {
      sendNotificationToGroup(req.io, groupId, 'new_group_message', formattedMessage);
    }

    return res.status(201).json({
      success: true,
      message: 'Gửi tệp tin nhóm thành công! 📁',
      data: {
        ...formattedMessage,
        is_mine: true,
      },
    });
  } catch (error) {
    console.error('Send group file error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gửi tệp tin nhóm.' });
  }
};

/**
 * 12. Bật/Tắt Ghim nhóm chat
 * PUT /api/groups/:id/pin
 * Body: { is_pinned?: boolean }
 */
const togglePinGroup = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = parseInt(req.params.id, 10);

    if (isNaN(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ.' });
    }

    const [membership] = await pool.query(
      'SELECT is_pinned FROM `group_members` WHERE group_id = ? AND user_id = ?',
      [groupId, currentUserId]
    );
    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên nhóm này.' });
    }

    let isPinned = req.body?.is_pinned;
    if (isPinned === undefined) {
      isPinned = membership[0].is_pinned ? 0 : 1;
    } else {
      isPinned = isPinned ? 1 : 0;
    }

    await pool.query(
      'UPDATE `group_members` SET is_pinned = ? WHERE group_id = ? AND user_id = ?',
      [isPinned, groupId, currentUserId]
    );

    return res.json({
      success: true,
      message: isPinned ? 'Đã ghim nhóm lên đầu! 📌' : 'Đã bỏ ghim nhóm.',
      data: { is_pinned: Boolean(isPinned) },
    });
  } catch (error) {
    console.error('Toggle pin group error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi ghim nhóm.' });
  }
};

/**
 * 13. Bật/Tắt Thông báo nhóm chat
 * PUT /api/groups/:id/mute
 * Body: { is_muted?: boolean }
 */
const toggleMuteGroup = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = parseInt(req.params.id, 10);

    if (isNaN(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ.' });
    }

    const [membership] = await pool.query(
      'SELECT is_muted FROM `group_members` WHERE group_id = ? AND user_id = ?',
      [groupId, currentUserId]
    );
    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên nhóm này.' });
    }

    let isMuted = req.body?.is_muted;
    if (isMuted === undefined) {
      isMuted = membership[0].is_muted ? 0 : 1;
    } else {
      isMuted = isMuted ? 1 : 0;
    }

    await pool.query(
      'UPDATE `group_members` SET is_muted = ? WHERE group_id = ? AND user_id = ?',
      [isMuted, groupId, currentUserId]
    );

    return res.json({
      success: true,
      message: isMuted ? 'Đã tắt thông báo nhóm! 🔕' : 'Đã bật thông báo nhóm! 🔔',
      data: { is_muted: Boolean(isMuted) },
    });
  } catch (error) {
    console.error('Toggle mute group error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đổi thông báo nhóm.' });
  }
};

/**
 * 14. Tìm kiếm tin nhắn trong nhóm chat
 * GET /api/groups/:id/search?q=...
 */
const searchGroupMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = parseInt(req.params.id, 10);
    const query = (req.query.q || '').trim();
    const protocol = req.protocol;
    const host = req.get('host');

    if (isNaN(groupId)) {
      return res.status(400).json({ success: false, message: 'ID nhóm không hợp lệ.' });
    }

    const [membership] = await pool.query(
      'SELECT id FROM `group_members` WHERE group_id = ? AND user_id = ?',
      [groupId, currentUserId]
    );
    if (membership.length === 0) {
      return res.status(403).json({ success: false, message: 'Bạn không phải là thành viên nhóm này.' });
    }

    if (!query) {
      return res.json({ success: true, data: [] });
    }

    const searchPattern = `%${query}%`;
    const [rows] = await pool.query(
      `SELECT m.id, m.sender_id, m.message_text, m.image_url, m.file_url, m.file_name, m.file_size, m.file_type, m.created_at,
              u.full_name AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.group_id = ?
         AND (m.message_text LIKE ? OR m.file_name LIKE ?)
       ORDER BY m.id DESC
       LIMIT 50`,
      [groupId, searchPattern, searchPattern]
    );

    const results = rows.map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      message_text: m.message_text,
      image_url: formatImageUrl(m.image_url, protocol, host),
      file_url: m.file_url ? formatDownloadUrl(m.id, protocol, host) : null,
      file_name: m.file_name,
      file_size: m.file_size,
      file_type: m.file_type,
      created_at: m.created_at,
      sender_name: m.sender_name,
      sender_avatar: formatImageUrl(m.sender_avatar, protocol, host),
      is_mine: m.sender_id === currentUserId,
    }));

    return res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Search group messages error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tìm kiếm tin nhắn nhóm.' });
  }
};

module.exports = {
  createGroup,
  getMyGroups,
  getGroupDetail,
  updateGroup,
  addMembers,
  removeMember,
  getGroupMessages,
  sendGroupMessage,
  sendGroupImageMessage,
  sendGroupFileMessage,
  togglePinGroup,
  toggleMuteGroup,
  searchGroupMessages,
};
