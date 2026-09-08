const express = require('express');
const router = express.Router();

// Định nghĩa thông tin các phiên bản OTA trên hệ thống
const SYSTEM_VERSIONS = {
  production: {
    latest_version: '1.2.6',
    release_date: '2026-09-08',
    bundle_size: '3.3 MB',
    mandatory: false,
    channel: 'production',
    changelog_vi: [
      'Khắc phục lỗi bàn phím che khuất ô nhập chú thích (caption) khi đăng khoảnh khắc.',
      'Khắc phục lỗi bàn phím che khuất Tên hiển thị và Bio khi chỉnh sửa hồ sơ.',
      'Tự động cuộn thông minh đưa ô nhập văn bản lên trên bàn phím ảo khi chạm vào.',
      'Bổ sung bộ đếm ký tự thời gian thực cho chú thích bài đăng ({caption}/200).',
    ],
    changelog_en: [
      'Fixed keyboard covering caption input when posting a new moment.',
      'Fixed keyboard covering Name and Bio inputs when editing profile.',
      'Smart auto-scrolling bringing text inputs above the virtual keyboard when focused.',
      'Added real-time character counter for post caption ({caption}/200).',
    ],
  },
  beta: {
    latest_version: '1.3.0-beta.2',
    release_date: '2026-09-07',
    bundle_size: '3.8 MB',
    mandatory: false,
    channel: 'beta',
    changelog_vi: [
      '[Beta] Tính năng gọi thoại và video 1-1 thử nghiệm.',
      '[Beta] Bộ lọc hình ảnh nghệ thuật trực tiếp khi tải lên khoảnh khắc.',
      '[Beta] Tối ưu hóa bộ nhớ đệm cache tin nhắn nhóm lớn.',
    ],
    changelog_en: [
      '[Beta] Experimental 1-on-1 voice and video calling.',
      '[Beta] Live artistic photo filters for moment uploads.',
      '[Beta] Optimized message caching for large group chats.',
    ],
  },
};

/**
 * GET /api/system/ota-check
 * Query params:
 *  - current_version: string (vd: "1.2.0")
 *  - channel: "production" | "beta"
 *  - simulate: "new_version" | "up_to_date"
 */
router.get('/ota-check', (req, res) => {
  const currentVersion = (req.query.current_version || '1.2.0').trim();
  const channel = req.query.channel === 'beta' ? 'beta' : 'production';
  const simulate = req.query.simulate;

  const versionInfo = SYSTEM_VERSIONS[channel];

  let isUpdateAvailable = false;

  if (simulate === 'new_version') {
    isUpdateAvailable = true;
  } else if (simulate === 'up_to_date') {
    isUpdateAvailable = false;
  } else {
    // So sánh phiên bản (chuỗi hoặc semver đơn giản)
    const cleanCurrent = currentVersion.replace(/^v/, '').trim();
    const cleanLatest = versionInfo.latest_version.replace(/^v/, '').trim();
    isUpdateAvailable = cleanCurrent !== cleanLatest;
  }

  return res.json({
    success: true,
    message: isUpdateAvailable ? 'Có bản cập nhật OTA mới!' : 'Ứng dụng đã ở phiên bản mới nhất.',
    data: {
      is_update_available: isUpdateAvailable,
      current_version: currentVersion,
      latest_version: versionInfo.latest_version,
      release_date: versionInfo.release_date,
      bundle_size: versionInfo.bundle_size,
      mandatory: versionInfo.mandatory,
      channel: versionInfo.channel,
      changelog_vi: versionInfo.changelog_vi,
      changelog_en: versionInfo.changelog_en,
      download_url: `/api/system/bundle/${versionInfo.latest_version}`,
    },
  });
});

module.exports = router;
