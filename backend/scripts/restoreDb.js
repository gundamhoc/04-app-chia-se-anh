/**
 * ============================================================
 * Masita Auto-Restore Database Script
 * Tự động nạp lại bản sao lưu từ database/backups/latest_backup.sql
 * Chạy lệnh: npm run db:restore
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function restore() {
  console.log('📥 [Restore] Bắt đầu quá trình khôi phục Database từ bản backup...');
  const startTime = Date.now();

  const backupFile = path.resolve(__dirname, '../../database/backups/latest_backup.sql');
  if (!fs.existsSync(backupFile)) {
    console.error('❌ Không tìm thấy file backup: database/backups/latest_backup.sql');
    console.log('👉 Hãy chạy lệnh `npm run db:backup` trước để tạo bản sao lưu.');
    process.exit(1);
  }

  const sql = fs.readFileSync(backupFile, 'utf8');

  // Kết nối trực tiếp với multipleStatements: true
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'masita',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
  });

  try {
    console.log(`📋 Đang thực thi nạp toàn bộ file backup vào [${process.env.DB_NAME}]...`);
    await connection.query(sql);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 [Restore Thành Công!] Đã nạp lại toàn bộ cấu trúc & dữ liệu trong ${duration}s.`);
  } catch (error) {
    console.error('❌ [Restore Error]:', error.message);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

restore();
