const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log('\n❌ Chưa tìm thấy GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong file backend/.env!');
  console.log('👉 Vui lòng mở file backend/.env và thêm 2 dòng sau trước:\n');
  console.log('GOOGLE_CLIENT_ID=your_client_id_here');
  console.log('GOOGLE_CLIENT_SECRET=your_client_secret_here\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('\n============================================================');
console.log('🔑 HƯỚNG DẪN LẤY GOOGLE REFRESH TOKEN TỰ ĐỘNG');
console.log('============================================================\n');
console.log('1. Mở liên kết dưới đây trên trình duyệt của bạn:\n');
console.log(authUrl);
console.log('\n2. Đăng nhập tài khoản Google của bạn và nhấn "Cho phép" (Allow).');
console.log('3. Copy đoạn "authorization code" nhận được từ trình duyệt và dán vào bên dưới.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('👉 Dán Authorization Code vào đây: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n✅ Lấy Refresh Token THÀNH CÔNG!\n');
    console.log('🔑 Refresh Token của bạn là:\n');
    console.log(tokens.refresh_token);

    if (tokens.refresh_token) {
      const envPath = path.join(__dirname, '.env');
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (!envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
        envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
      } else {
        envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/g, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('\n💾 Đã tự động lưu GOOGLE_REFRESH_TOKEN vào file backend/.env!');
    }
  } catch (err) {
    console.error('\n❌ Lỗi khi đổi Refresh Token:', err.message);
  } finally {
    rl.close();
  }
});
