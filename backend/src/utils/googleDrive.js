const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1skG3ecA93SLyGOZn2NBzKUPQ29auTScf';

let driveInstance = null;

function getDriveClient() {
  if (driveInstance) return driveInstance;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
  }

  return driveInstance;
}

/**
 * Upload a local file to Google Drive folder and set public read permission.
 * Returns direct image view URL: https://lh3.googleusercontent.com/d/{fileId}
 */
async function uploadFileToDrive(filePath, mimeType, filename) {
  const drive = getDriveClient();
  if (!drive) {
    throw new Error('Google Drive API chưa được cấu hình credentials!');
  }

  const fileMetadata = {
    name: filename || `masita_${Date.now()}${path.extname(filePath)}`,
    parents: [FOLDER_ID],
  };

  const media = {
    mimeType: mimeType || 'image/jpeg',
    body: fs.createReadStream(filePath),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = response.data.id;

  // Cấp quyền công khai cho mọi người có link có thể xem
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // URL hiển thị trực tiếp ảnh chuẩn Google (high quality direct image URL)
  const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

  return {
    fileId,
    directUrl,
    webViewLink: response.data.webViewLink,
  };
}

module.exports = {
  uploadFileToDrive,
  getDriveClient,
};
