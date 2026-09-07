const mysql = require('mysql2/promise');
require('dotenv').config();

// Tạo connection pool thay vì single connection
// Pool tự động quản lý, tái sử dụng connections
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'masita',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+07:00',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const { initDatabase } = require('./initDb');

// Kiểm tra kết nối khi khởi động & tự động khởi tạo bảng
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL connected successfully');
    connection.release();

    // Tự động kiểm tra và tạo đủ 13 bảng nếu chưa có
    await initDatabase(pool);
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { pool, testConnection };
