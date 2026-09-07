/**
 * ============================================================
 * Masita Auto-Backup Database Script
 * Tự động sao lưu toàn bộ dữ liệu & cấu trúc bảng ra file .sql
 * Chạy lệnh: npm run db:backup
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function backup() {
  console.log('📦 [Backup] Bắt đầu quá trình sao lưu toàn bộ Database...');
  const startTime = Date.now();

  try {
    // 1. Tạo thư mục lưu backup nếu chưa có
    const backupDir = path.resolve(__dirname, '../../database/backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 2. Tạo tên file theo ngày giờ
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `masita_backup_${timestamp}.sql`;
    const filepath = path.join(backupDir, filename);
    const latestPath = path.join(backupDir, 'latest_backup.sql');

    let sqlContent = '';
    sqlContent += `-- ====================================================\n`;
    sqlContent += `-- MASITA DATABASE BACKUP\n`;
    sqlContent += `-- Timestamp: ${now.toISOString()} (${timestamp})\n`;
    sqlContent += `-- Host: ${process.env.DB_HOST || 'localhost'}\n`;
    sqlContent += `-- Database: ${process.env.DB_NAME || 'masita'}\n`;
    sqlContent += `-- ====================================================\n\n`;
    sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    // 3. Lấy toàn bộ danh sách bảng
    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = tables.map((t) => Object.values(t)[0]);
    console.log(`📋 [Backup] Tìm thấy ${tableNames.length} bảng cần sao lưu:`, tableNames.join(', '));

    let totalRowsCount = 0;

    for (const table of tableNames) {
      // Dump CREATE TABLE
      const [createResult] = await pool.query(`SHOW CREATE TABLE \`${table}\``);
      let createSql = createResult[0]['Create Table'];
      if (!createSql.includes('IF NOT EXISTS')) {
        createSql = createSql.replace(/CREATE TABLE/i, 'CREATE TABLE IF NOT EXISTS');
      }
      sqlContent += `-- ----------------------------------------------------\n`;
      sqlContent += `-- Cấu trúc bảng: \`${table}\`\n`;
      sqlContent += `-- ----------------------------------------------------\n`;
      sqlContent += `DROP TABLE IF EXISTS \`${table}\`;\n`;
      sqlContent += `${createSql};\n\n`;

      // Dump DATA
      const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
      if (rows.length > 0) {
        totalRowsCount += rows.length;
        sqlContent += `-- Dữ liệu bảng: \`${table}\` (${rows.length} dòng)\n`;
        const columns = Object.keys(rows[0]);
        const colNamesSql = columns.map((c) => `\`${c}\``).join(', ');

        for (const row of rows) {
          const valuesSql = columns
            .map((col) => {
              const val = row[col];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'number' || typeof val === 'boolean') return val;
              if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
              if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
              // Escape string an toàn
              const escaped = String(val)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r');
              return `'${escaped}'`;
            })
            .join(', ');

          sqlContent += `INSERT INTO \`${table}\` (${colNamesSql}) VALUES (${valuesSql});\n`;
        }
        sqlContent += '\n';
        console.log(`  ✓ Đã sao lưu ${rows.length} dòng từ [${table}]`);
      } else {
        console.log(`  ✓ Bảng [${table}] hiện rỗng (0 dòng)`);
      }
    }

    sqlContent += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    sqlContent += `-- Hoàn tất sao lưu lúc: ${new Date().toISOString()}\n`;

    // Ghi ra file theo ngày giờ
    fs.writeFileSync(filepath, sqlContent, 'utf8');
    // Ghi đè vào latest_backup.sql để tiện khôi phục
    fs.writeFileSync(latestPath, sqlContent, 'utf8');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 [Backup Thành Công!] Đã sao lưu ${totalRowsCount} dòng dữ liệu trong ${duration}s.`);
    console.log(`📁 File backup: database/backups/${filename}`);
    console.log(`⭐ Bản mới nhất: database/backups/latest_backup.sql`);
  } catch (error) {
    console.error('❌ [Backup Error]:', error);
  } finally {
    process.exit(0);
  }
}

backup();
