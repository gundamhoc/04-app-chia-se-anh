/**
 * Masita Admin Portal — Frontend Application Logic
 * Vanilla JavaScript implementation for dashboard, user moderation, post management, and password reset handling.
 */

// ==========================================
// 1. STATE & CONFIGURATION
// ==========================================
const state = {
  // Determine API base URL dynamically: if hosted on same origin use current origin + /api, else fallback to localStorage or localhost:5000/api
  apiBaseUrl: localStorage.getItem('masita_admin_api_url') || 
    (window.location.origin.startsWith('http') ? `${window.location.origin}/api` : 'http://localhost:5000/api'),
  autoRefreshRate: parseInt(localStorage.getItem('masita_admin_refresh_rate') || '30000', 10),
  refreshTimer: null,
  currentTab: 'overview',

  // Overview stats
  stats: null,

  // Users tab state
  users: {
    data: [],
    page: 1,
    limit: 10,
    totalPages: 1,
    total: 0,
    search: '',
    searchTimeout: null,
  },

  // Reset requests tab state
  resets: {
    data: [],
    filter: 'all', // all | pending | sent | resolved
  },

  // Posts tab state
  posts: {
    data: [],
    page: 1,
    limit: 10,
    totalPages: 1,
    total: 0,
    mediaType: 'all', // all | image | video
  },

  // Modal active targets
  activeResetTarget: {
    requestId: null,
    userId: null,
    email: '',
    username: '',
  },
};

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

/**
 * Format relative or absolute time
 */
function formatDate(dateString) {
  if (!dateString) return 'Chưa rõ';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Chưa rõ';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Clean and normalize media URLs (support localhost / storage relative paths / Cloudinary)
 */
function resolveMediaUrl(url) {
  if (!url) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = state.apiBaseUrl.replace(/\/api$/, '');
  return `${base}/${url.replace(/^\//, '')}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Toast Notification system
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠️' : 'ℹ️';
  
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Generic API Fetcher with Error Handling & Timeout
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${state.apiBaseUrl}${endpoint}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Lỗi máy chủ (${response.status})`);
    }
    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

// ==========================================
// 3. TAB NAVIGATION
// ==========================================
const tabTitles = {
  overview: { title: 'Tổng quan hệ thống', subtitle: 'Theo dõi trạng thái và chỉ số thời gian thực của Masita' },
  resets: { title: 'Yêu cầu cấp lại mật khẩu', subtitle: 'Hỗ trợ người dùng quên mật khẩu và quản lý mã xác thực' },
  users: { title: 'Quản lý người dùng', subtitle: 'Xem thông tin thành viên, phân quyền và khóa tài khoản vi phạm' },
  posts: { title: 'Kiểm duyệt bài viết', subtitle: 'Quản lý bài đăng ảnh/video và nội dung cộng đồng' },
  settings: { title: 'Cài đặt kết nối', subtitle: 'Cấu hình endpoint API và tùy chọn bảng quản trị' },
};

function switchTab(tabId) {
  if (!tabTitles[tabId]) return;
  state.currentTab = tabId;

  // Update Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabId);
  });

  // Update Tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });

  // Update Header
  document.getElementById('page-title').textContent = tabTitles[tabId].title;
  document.getElementById('page-subtitle').textContent = tabTitles[tabId].subtitle;

  // Load Data for Tab
  refreshCurrentTab();
}

function refreshCurrentTab() {
  switch (state.currentTab) {
    case 'overview':
      loadDashboardStats();
      break;
    case 'resets':
      loadResetRequests();
      break;
    case 'users':
      loadUsers(state.users.page);
      break;
    case 'posts':
      loadPosts(state.posts.page);
      break;
    case 'settings':
      // Settings already populated
      break;
  }
}

// ==========================================
// 4. OVERVIEW DASHBOARD
// ==========================================
async function loadDashboardStats() {
  try {
    const res = await apiRequest('/admin/stats');
    if (!res.success) return;

    const stats = res.data;
    state.stats = stats;

    // Stat Cards
    document.getElementById('stat-total-users').textContent = stats.users.total.toLocaleString();
    document.getElementById('stat-active-users').textContent = `${stats.users.active.toLocaleString()} tài khoản hoạt động`;

    document.getElementById('stat-total-posts').textContent = stats.posts.total.toLocaleString();
    document.getElementById('stat-media-breakdown').textContent = `${stats.posts.photos} ảnh • ${stats.posts.videos} video`;

    const totalInteractions = stats.interactions.reactions + stats.interactions.comments;
    document.getElementById('stat-total-interactions').textContent = totalInteractions.toLocaleString();
    document.getElementById('stat-interactions-breakdown').textContent = `${stats.interactions.reactions} cảm xúc • ${stats.interactions.comments} bình luận`;

    // Reset Requests
    const pendingCount = stats.pending_resets || 0;
    const statPendingElem = document.getElementById('stat-pending-resets');
    statPendingElem.textContent = pendingCount.toString();

    const badgePendingElem = document.getElementById('badge-pending-resets');
    if (pendingCount > 0) {
      badgePendingElem.style.display = 'inline-flex';
      badgePendingElem.textContent = pendingCount.toString();
      document.getElementById('card-reset-alert').style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else {
      badgePendingElem.style.display = 'none';
      document.getElementById('card-reset-alert').style.borderColor = '';
    }

    // Recent Users List
    const recentUsersContainer = document.getElementById('overview-recent-users');
    if (stats.recent_users && stats.recent_users.length > 0) {
      recentUsersContainer.innerHTML = stats.recent_users.map(u => `
        <div class="user-item">
          <img src="${resolveMediaUrl(u.avatar_url)}" alt="${escapeHtml(u.username)}" class="user-avatar" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'">
          <div class="user-details">
            <span class="user-name">${escapeHtml(u.full_name || u.username)}</span>
            <span class="user-sub">@${escapeHtml(u.username)} • ${formatDate(u.created_at)}</span>
          </div>
          <span class="status-pill status-${u.is_active ? 'active' : 'inactive'}">
            ${u.is_active ? 'Hoạt động' : 'Bị khóa'}
          </span>
        </div>
      `).join('');
    } else {
      recentUsersContainer.innerHTML = '<div class="empty-state">Chưa có người dùng nào.</div>';
    }

    // Recent Posts List
    const recentPostsContainer = document.getElementById('overview-recent-posts');
    if (stats.recent_posts && stats.recent_posts.length > 0) {
      recentPostsContainer.innerHTML = stats.recent_posts.map(p => `
        <div class="post-preview-item">
          <div class="post-preview-thumb">
            ${p.media_type === 'video' 
              ? `<video src="${resolveMediaUrl(p.media_url)}" muted></video><div class="thumb-badge">VIDEO</div>`
              : `<img src="${resolveMediaUrl(p.media_url)}" alt="Post image" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'">`
            }
          </div>
          <div class="post-preview-info">
            <span class="post-caption">${escapeHtml(p.caption || '(Không có chú thích)')}</span>
            <div class="post-meta-line">
              <span>Đăng bởi <strong>@${escapeHtml(p.username)}</strong></span>
              <span>• ${formatDate(p.created_at)}</span>
              <span>• ❤️ ${p.reactions_count || 0}</span>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      recentPostsContainer.innerHTML = '<div class="empty-state">Chưa có bài viết nào gần đây.</div>';
    }

  } catch (error) {
    showToast(`Không thể tải dữ liệu tổng quan: ${error.message}`, 'error');
  }
}

// ==========================================
// 5. PASSWORD RESET REQUESTS
// ==========================================
async function loadResetRequests() {
  const tbody = document.getElementById('resets-table-body');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Đang tải danh sách yêu cầu...</td></tr>';

  try {
    const filter = state.resets.filter === 'all' ? '' : state.resets.filter;
    const res = await apiRequest(`/admin/reset-requests?status=${filter}`);
    if (!res.success) return;

    const requests = Array.isArray(res.data) ? res.data : (res.data?.requests || []);
    state.resets.data = requests;

    if (requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center empty-cell">Không có yêu cầu cấp lại mật khẩu nào.</td></tr>';
      return;
    }

    tbody.innerHTML = requests.map(req => {
      const statusLabels = {
        pending: '<span class="status-pill status-pending">Chờ xử lý ⏳</span>',
        sent: '<span class="status-pill status-active">Đã gửi mã ✉️</span>',
        resolved: '<span class="status-pill status-resolved">Đã xong ✓</span>',
      };

      return `
        <tr>
          <td>#${req.id}</td>
          <td>
            <div class="user-inline">
              <img src="${resolveMediaUrl(req.avatar_url)}" alt="avatar" class="avatar-sm" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'">
              <div>
                <strong>${escapeHtml(req.full_name || req.username || 'Không tên')}</strong>
                <div class="sub-text">@${escapeHtml(req.username || 'unknown')}</div>
              </div>
            </div>
          </td>
          <td>
            <a href="mailto:${escapeHtml(req.email)}" class="email-link">${escapeHtml(req.email)}</a>
          </td>
          <td>${formatDate(req.created_at)}</td>
          <td>${statusLabels[req.status] || req.status}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-primary" onclick="openResetModalForRequest(${req.id}, ${req.user_id}, '${escapeHtml(req.email)}', '${escapeHtml(req.username)}')">
                🔑 Cấp mật khẩu
              </button>
              ${req.status === 'pending' ? `
                <button class="btn btn-sm btn-secondary" onclick="updateResetStatus(${req.id}, 'sent')">
                  ✉️ Đánh dấu đã gửi
                </button>
              ` : ''}
              ${req.status !== 'resolved' ? `
                <button class="btn btn-sm btn-success" onclick="updateResetStatus(${req.id}, 'resolved')">
                  ✓ Xong
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center error-cell">Lỗi tải dữ liệu: ${error.message}</td></tr>`;
    showToast(`Lỗi: ${error.message}`, 'error');
  }
}

function filterResets(filter) {
  state.resets.filter = filter;
  document.querySelectorAll('#tab-resets .filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  loadResetRequests();
}

async function updateResetStatus(requestId, status) {
  try {
    const res = await apiRequest(`/admin/reset-requests/${requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });

    if (res.success) {
      showToast('Đã cập nhật trạng thái yêu cầu thành công!', 'success');
      loadResetRequests();
      loadDashboardStats(); // update badges
    }
  } catch (error) {
    showToast(`Không thể cập nhật: ${error.message}`, 'error');
  }
}

// ==========================================
// 6. USERS MANAGEMENT
// ==========================================
function handleUsersSearch(value) {
  clearTimeout(state.users.searchTimeout);
  state.users.search = value.trim();
  state.users.searchTimeout = setTimeout(() => {
    state.users.page = 1;
    loadUsers(1);
  }, 400);
}

async function loadUsers(page = 1) {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center">Đang tải dữ liệu người dùng...</td></tr>';

  try {
    state.users.page = page;
    const query = new URLSearchParams({
      page: state.users.page,
      limit: state.users.limit,
      search: state.users.search,
    });

    const res = await apiRequest(`/admin/users?${query.toString()}`);
    if (!res.success) return;

    const users = Array.isArray(res.data) ? res.data : (res.data?.users || []);
    const pagination = res.pagination || res.data?.pagination || { total: users.length, page: 1, limit: 10, totalPages: 1, total_pages: 1 };
    state.users.data = users;
    state.users.totalPages = pagination.totalPages || pagination.total_pages || 1;
    state.users.total = pagination.total || users.length;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center empty-cell">Không tìm thấy người dùng phù hợp.</td></tr>';
      renderPagination('users-pagination', pagination, loadUsers);
      return;
    }

    tbody.innerHTML = users.map(user => `
      <tr>
        <td>#${user.id}</td>
        <td>
          <div class="user-inline">
            <img src="${resolveMediaUrl(user.avatar_url)}" alt="avatar" class="avatar-sm" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'">
            <div>
              <strong>${escapeHtml(user.full_name || user.username)}</strong>
              <div class="sub-text">@${escapeHtml(user.username)}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(user.email)}</td>
        <td><strong>${user.posts_count || user.post_count || 0}</strong></td>
        <td>${user.friends_count || user.friend_count || 0}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>
          <span class="status-pill status-${user.is_active ? 'active' : 'inactive'}">
            ${user.is_active ? 'Hoạt động' : 'Đang khóa'}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm ${user.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleUserActive(${user.id}, ${user.is_active})">
              ${user.is_active ? '🔒 Khóa' : '🔓 Mở khóa'}
            </button>
            <button class="btn btn-sm btn-secondary" onclick="openResetModalDirect(${user.id}, '${escapeHtml(user.email)}', '${escapeHtml(user.username)}')">
              🔑 Mật khẩu
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPagination('users-pagination', pagination, loadUsers);

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center error-cell">Lỗi tải dữ liệu: ${error.message}</td></tr>`;
    showToast(`Lỗi: ${error.message}`, 'error');
  }
}

async function toggleUserActive(userId, currentStatus) {
  const newStatus = currentStatus ? 0 : 1;
  const actionText = newStatus === 0 ? 'KHÓA' : 'MỞ KHÓA';
  
  if (!confirm(`Bạn có chắc muốn ${actionText} tài khoản người dùng #${userId}?`)) {
    return;
  }

  try {
    const res = await apiRequest(`/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: newStatus }),
    });

    if (res.success) {
      showToast(`Đã ${actionText.toLowerCase()} tài khoản thành công!`, 'success');
      loadUsers(state.users.page);
      loadDashboardStats();
    }
  } catch (error) {
    showToast(`Không thể thay đổi trạng thái: ${error.message}`, 'error');
  }
}

// ==========================================
// 7. POSTS MODERATION
// ==========================================
function filterPostsType(mediaType) {
  state.posts.mediaType = mediaType;
  document.querySelectorAll('#tab-posts .filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(mediaType === 'image' ? 'ảnh' : mediaType === 'video' ? 'video' : 'tất cả'));
  });
  state.posts.page = 1;
  loadPosts(1);
}

async function loadPosts(page = 1) {
  const tbody = document.getElementById('posts-table-body');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center">Đang tải danh sách bài viết...</td></tr>';

  try {
    state.posts.page = page;
    const query = new URLSearchParams({
      page: state.posts.page,
      limit: state.posts.limit,
      mediaType: state.posts.mediaType,
    });

    const res = await apiRequest(`/admin/posts?${query.toString()}`);
    if (!res.success) return;

    const posts = Array.isArray(res.data) ? res.data : (res.data?.posts || []);
    const pagination = res.pagination || res.data?.pagination || { total: posts.length, page: 1, limit: 10, totalPages: 1, total_pages: 1 };
    state.posts.data = posts;
    state.posts.totalPages = pagination.totalPages || pagination.total_pages || 1;
    state.posts.total = pagination.total || posts.length;

    if (posts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center empty-cell">Không có bài viết nào.</td></tr>';
      renderPagination('posts-pagination', pagination, loadPosts);
      return;
    }

    tbody.innerHTML = posts.map(post => {
      const isVideo = post.media_type === 'video' || !!post.video_url;
      const mediaSource = post.media_url || post.video_url || post.image_url;
      const resolvedMedia = resolveMediaUrl(mediaSource);
      const authorName = post.full_name || post.author_name || post.username || post.author_username || 'Tác giả';
      const authorUsername = post.username || post.author_username || 'unknown';
      const authorAvatar = post.avatar_url || post.author_avatar;

      return `
        <tr>
          <td>#${post.id}</td>
          <td>
            <div class="user-inline">
              <img src="${resolveMediaUrl(authorAvatar)}" alt="avatar" class="avatar-sm" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'">
              <div>
                <strong>${escapeHtml(authorName)}</strong>
                <div class="sub-text">@${escapeHtml(authorUsername)}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="media-thumb-box" onclick="previewMedia('${resolvedMedia}', '${post.media_type}', '${escapeHtml(post.caption)}')">
              ${isVideo ? `
                <video src="${resolvedMedia}" muted></video>
                <div class="thumb-badge">▶ VIDEO</div>
              ` : `
                <img src="${resolvedMedia}" alt="Media thumbnail" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100'">
                <div class="thumb-badge">🖼️ ẢNH</div>
              `}
            </div>
          </td>
          <td class="caption-cell">
            <span class="caption-text" title="${escapeHtml(post.caption)}">${escapeHtml(post.caption || '(Không có chú thích)')}</span>
          </td>
          <td>
            <span class="privacy-badge privacy-${post.privacy_level}">
              ${post.privacy_level === 'public' ? '🌐 Công khai' : post.privacy_level === 'friends' ? '👥 Bạn bè' : '🔒 Riêng tư'}
            </span>
          </td>
          <td>
            <div class="engagement-pill">
              ❤️ ${post.reactions_count || 0} • 💬 ${post.comments_count || 0}
            </div>
          </td>
          <td>${formatDate(post.created_at)}</td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="deletePostItem(${post.id})">
              🗑️ Xóa bài
            </button>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination('posts-pagination', pagination, loadPosts);

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center error-cell">Lỗi tải bài viết: ${error.message}</td></tr>`;
    showToast(`Lỗi: ${error.message}`, 'error');
  }
}

async function deletePostItem(postId) {
  if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn bài đăng #${postId}? Hành động này sẽ gỡ bỏ tất cả ảnh/video và bình luận liên quan.`)) {
    return;
  }

  try {
    const res = await apiRequest(`/admin/posts/${postId}`, {
      method: 'DELETE',
    });

    if (res.success) {
      showToast('Đã gỡ bài viết thành công!', 'success');
      loadPosts(state.posts.page);
      loadDashboardStats();
    }
  } catch (error) {
    showToast(`Không thể xóa bài viết: ${error.message}`, 'error');
  }
}

function previewMedia(url, type, caption) {
  const content = document.getElementById('media-preview-content');
  const title = document.getElementById('media-preview-title');
  title.textContent = type === 'video' ? 'Xem trước Video' : 'Xem trước Hình ảnh';

  if (type === 'video') {
    content.innerHTML = `
      <video src="${url}" controls autoplay class="modal-video-player"></video>
      <p class="modal-media-caption">${caption}</p>
    `;
  } else {
    content.innerHTML = `
      <img src="${url}" alt="Full media" class="modal-image-preview">
      <p class="modal-media-caption">${caption}</p>
    `;
  }

  openModal('modal-media-preview');
}

// ==========================================
// 8. PAGINATION COMPONENT
// ==========================================
function renderPagination(containerId, pagination, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { page, totalPages, total } = pagination;
  if (totalPages <= 1) {
    container.innerHTML = `<span class="pagination-info">Tổng cộng ${total} kết quả</span>`;
    return;
  }

  let html = `
    <div class="pagination-buttons">
      <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="${onPageChange.name}(${page - 1})">
        ‹ Trang trước
      </button>
      <span class="page-current">Trang ${page} / ${totalPages}</span>
      <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="${onPageChange.name}(${page + 1})">
        Trang sau ›
      </button>
    </div>
    <span class="pagination-info">Tổng cộng ${total} kết quả</span>
  `;

  container.innerHTML = html;
}

// ==========================================
// 9. MODALS & RESET PASSWORD LOGIC
// ==========================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
}

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let password = 'M@';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById('reset-new-password').value = password;
}

function openResetModalForRequest(requestId, userId, email, username) {
  state.activeResetTarget = { requestId, userId, email, username };
  document.getElementById('modal-reset-title').textContent = `Xử lý yêu cầu quên mật khẩu #${requestId}`;
  document.getElementById('modal-reset-desc').innerHTML = `
    Tài khoản: <strong>@${escapeHtml(username)}</strong> (${escapeHtml(email)})<br>
    Bạn có thể cấp mật khẩu mới trực tiếp và chuyển trạng thái yêu cầu sang Đã gửi/Đã giải quyết.
  `;
  generateRandomPassword();
  openModal('modal-reset-password');
}

function openResetModalDirect(userId, email, username) {
  state.activeResetTarget = { requestId: null, userId, email, username };
  document.getElementById('modal-reset-title').textContent = `Đặt lại mật khẩu cho @${escapeHtml(username)}`;
  document.getElementById('modal-reset-desc').innerHTML = `
    Người dùng: <strong>${escapeHtml(username)}</strong> (${escapeHtml(email)})<br>
    Nhập mật khẩu mới hoặc tạo ngẫu nhiên để gửi cho người dùng.
  `;
  generateRandomPassword();
  openModal('modal-reset-password');
}

async function confirmResetPasswordAction() {
  const newPassword = document.getElementById('reset-new-password').value.trim();
  const selectedStatus = document.querySelector('input[name="reset-status"]:checked')?.value || 'resolved';
  const { requestId, userId } = state.activeResetTarget;

  if (!newPassword || newPassword.length < 6) {
    showToast('Mật khẩu mới phải có ít nhất 6 ký tự!', 'warning');
    return;
  }

  const btnConfirm = document.getElementById('btn-confirm-reset');
  btnConfirm.disabled = true;
  btnConfirm.textContent = 'Đang xử lý...';

  try {
    // 1. If we have userId, reset their password
    if (userId) {
      await apiRequest(`/admin/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      });
    }

    // 2. If this came from a reset request ticket, update ticket status
    if (requestId) {
      await apiRequest(`/admin/reset-requests/${requestId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: selectedStatus }),
      });
    }

    showToast(`Đã đổi mật khẩu thành: "${newPassword}" thành công! Hãy gửi cho người dùng.`, 'success');
    closeModal('modal-reset-password');

    // Reload active tab
    refreshCurrentTab();
    loadDashboardStats();

  } catch (error) {
    showToast(`Không thể cập nhật mật khẩu: ${error.message}`, 'error');
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.textContent = 'Áp dụng thay đổi';
  }
}

// ==========================================
// 10. SYSTEM HEALTH & SETTINGS
// ==========================================
async function checkBackendHealth() {
  const statusText = document.getElementById('backend-status-text');
  const pingText = document.getElementById('backend-ping-text');
  const statusDot = document.querySelector('.status-dot');

  const start = performance.now();
  try {
    const res = await apiRequest('/admin/stats');
    const latency = Math.round(performance.now() - start);

    if (res.success) {
      statusText.textContent = 'Trực tuyến (Online)';
      pingText.textContent = `${latency}ms`;
      statusDot.style.background = 'var(--success)';
      statusDot.style.boxShadow = '0 0 8px var(--success)';
    }
  } catch (error) {
    statusText.textContent = 'Mất kết nối API';
    pingText.textContent = 'Offline';
    statusDot.style.background = 'var(--danger)';
    statusDot.style.boxShadow = '0 0 8px var(--danger)';
  }
}

function saveConnectionSettings(event) {
  event.preventDefault();
  const urlInput = document.getElementById('api-base-url').value.trim();
  const refreshRate = parseInt(document.getElementById('auto-refresh-rate').value, 10);

  if (urlInput) {
    state.apiBaseUrl = urlInput.replace(/\/+$/, '');
    localStorage.setItem('masita_admin_api_url', state.apiBaseUrl);
  }

  state.autoRefreshRate = refreshRate;
  localStorage.setItem('masita_admin_refresh_rate', refreshRate.toString());

  setupAutoRefresh();
  showToast('Đã lưu cấu hình kết nối thành công!', 'success');
  checkBackendHealth();
  refreshCurrentTab();
}

async function testCurrentConnection() {
  const resultText = document.getElementById('test-result-text');
  const urlInput = document.getElementById('api-base-url').value.trim() || state.apiBaseUrl;
  
  resultText.textContent = 'Đang kiểm tra kết nối...';
  resultText.style.color = 'var(--text-muted)';

  const start = performance.now();
  try {
    const res = await fetch(`${urlInput}/admin/stats`);
    const latency = Math.round(performance.now() - start);
    if (res.ok) {
      resultText.textContent = `✓ Kết nối thành công! Độ trễ: ${latency}ms`;
      resultText.style.color = 'var(--success)';
    } else {
      resultText.textContent = `✕ Lỗi máy chủ HTTP ${res.status}`;
      resultText.style.color = 'var(--danger)';
    }
  } catch (err) {
    resultText.textContent = `✕ Không thể kết nối: ${err.message}`;
    resultText.style.color = 'var(--danger)';
  }
}

function setupAutoRefresh() {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }

  if (state.autoRefreshRate > 0) {
    state.refreshTimer = setInterval(() => {
      checkBackendHealth();
      if (state.currentTab === 'overview' || state.currentTab === 'resets') {
        refreshCurrentTab();
      }
    }, state.autoRefreshRate);
  }
}

// ==========================================
// 11. INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Bind Sidebar Nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchTab(item.dataset.tab);
    });
  });

  // Bind Refresh Button
  document.getElementById('btn-refresh').addEventListener('click', () => {
    showToast('Đang làm mới dữ liệu...', 'info');
    checkBackendHealth();
    refreshCurrentTab();
  });

  // Populate Settings fields
  const apiInput = document.getElementById('api-base-url');
  if (apiInput) apiInput.value = state.apiBaseUrl;

  const refreshSelect = document.getElementById('auto-refresh-rate');
  if (refreshSelect) refreshSelect.value = state.autoRefreshRate.toString();

  // Close modals on clicking outside
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  });

  // Initial Load
  checkBackendHealth();
  loadDashboardStats();
  setupAutoRefresh();
});
