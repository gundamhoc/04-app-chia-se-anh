const { pool } = require('../config/db');

/**
 * 1. Người dùng gửi câu hỏi / thắc mắc mới tới Trung tâm trợ giúp
 * POST /api/support/tickets
 * Body: { subject, category, message }
 */
const createTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, category, message } = req.body || {};

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tiêu đề thắc mắc của bạn.',
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập nội dung chi tiết thắc mắc hoặc báo lỗi.',
      });
    }

    const validCategory = (category && typeof category === 'string') ? category.trim() : 'general';

    const [result] = await pool.query(
      `INSERT INTO support_tickets (user_id, subject, category, message, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', NOW())`,
      [userId, subject.trim(), validCategory, message.trim()]
    );

    return res.status(201).json({
      success: true,
      message: 'Câu hỏi của bạn đã được gửi tới Ban Quản Trị. Chúng tôi sẽ giải đáp sớm nhất!',
      data: {
        id: result.insertId,
        subject: subject.trim(),
        category: validCategory,
        message: message.trim(),
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi gửi thắc mắc.',
    });
  }
};

/**
 * 2. Người dùng xem lịch sử các thắc mắc của mình kèm phản hồi từ Ban Quản Trị
 * GET /api/support/tickets/my
 */
const getMyTickets = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT 
        t.id, 
        t.subject, 
        t.category, 
        t.message, 
        t.status, 
        t.staff_reply, 
        t.replied_at, 
        t.created_at,
        a.full_name AS responder_name,
        a.role AS responder_role
       FROM support_tickets t
       LEFT JOIN admin_users a ON t.replied_by = a.id
       WHERE t.user_id = ?
       ORDER BY t.id DESC`,
      [userId]
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('Get my support tickets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy lịch sử thắc mắc.',
    });
  }
};

module.exports = {
  createTicket,
  getMyTickets,
};
