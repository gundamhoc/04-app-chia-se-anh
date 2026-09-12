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

  // Auth state
  adminToken: localStorage.getItem('masita_admin_token') || null,
  adminUser: JSON.parse(localStorage.getItem('masita_admin_user') || 'null'),

  // Support tickets tab state
  tickets: {
    data: [],
    page: 1,
    limit: 10,
    totalPages: 1,
    total: 0,
    filter: 'all', // all | pending | answered
    search: '',
    searchTimeout: null,
  },

  // Staff tab state
  staff: {
    data: [],
  },

  activeTicketTarget: null,
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

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (state.adminToken) {
      headers['Authorization'] = `Bearer ${state.adminToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      disconnectAdminSocket();
      showLoginOverlay('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
      throw new Error('Yêu cầu đăng nhập quản trị.');
    }

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
  tickets: { title: 'Trung tâm trợ giúp & Hỗ trợ', subtitle: 'Giải đáp thắc mắc, hướng dẫn người dùng và xử lý báo lỗi' },
  posts: { title: 'Kiểm duyệt bài viết', subtitle: 'Quản lý bài đăng ảnh/video và nội dung cộng đồng' },
  resets: { title: 'Yêu cầu cấp lại mật khẩu', subtitle: 'Hỗ trợ người dùng quên mật khẩu và quản lý mã xác thực' },
  users: { title: 'Quản lý người dùng', subtitle: 'Xem thông tin thành viên, phân quyền và khóa tài khoản vi phạm' },
  staff: { title: 'Quản lý Đội ngũ Nhân viên', subtitle: 'Phân quyền kiểm duyệt và quản lý tài khoản nhân viên' },
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
    case 'tickets':
      loadSupportTickets(state.tickets.page);
      break;
    case 'posts':
      loadPosts(state.posts.page);
      break;
    case 'resets':
      loadResetRequests();
      break;
    case 'users':
      loadUsers(state.users.page);
      break;
    case 'staff':
      loadStaffList();
      break;
    case 'settings':
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
    
    // Cập nhật chỉ số trực tuyến realtime từ Socket presence
    const onlineCount = stats.online_users !== undefined ? stats.online_users : (stats.users?.online || 0);
    const onlineStatElem = document.getElementById('stat-online-users');
    if (onlineStatElem) onlineStatElem.textContent = `• 🟢 ${onlineCount} trực tuyến`;
    const topbarOnlineText = document.getElementById('topbar-online-text');
    if (topbarOnlineText) topbarOnlineText.textContent = `${onlineCount} trực tuyến`;

    document.getElementById('stat-total-posts').textContent = stats.posts.total.toLocaleString();
    document.getElementById('stat-media-breakdown').textContent = `${stats.posts.photos} ảnh • ${stats.posts.videos} video`;

    const totalInteractions = stats.interactions.reactions + stats.interactions.comments;
    document.getElementById('stat-total-interactions').textContent = totalInteractions.toLocaleString();
    document.getElementById('stat-interactions-breakdown').textContent = `${stats.interactions.reactions} cảm xúc • ${stats.interactions.comments} bình luận`;

    // Reset Requests
    const pendingCount = stats.pending_resets || 0;
    const statPendingElem = document.getElementById('stat-pending-resets');
    if (statPendingElem) statPendingElem.textContent = pendingCount.toString();

    const badgePendingElem = document.getElementById('badge-pending-resets');
    if (badgePendingElem) {
      if (pendingCount > 0) {
        badgePendingElem.style.display = 'inline-flex';
        badgePendingElem.textContent = pendingCount.toString();
        const alertCard = document.getElementById('card-reset-alert');
        if (alertCard) alertCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      } else {
        badgePendingElem.style.display = 'none';
        const alertCard = document.getElementById('card-reset-alert');
        if (alertCard) alertCard.style.borderColor = '';
      }
    }

    // Support Tickets Badge
    const pendingTickets = stats.pending_tickets || 0;
    const badgePendingTickets = document.getElementById('badge-pending-tickets');
    if (badgePendingTickets) {
      if (pendingTickets > 0) {
        badgePendingTickets.style.display = 'inline-flex';
        badgePendingTickets.textContent = pendingTickets.toString();
      } else {
        badgePendingTickets.style.display = 'none';
      }
    }

    // Recent Users List
    const recentUsersContainer = document.getElementById('overview-recent-users');
    if (stats.recent_users && stats.recent_users.length > 0) {
      recentUsersContainer.innerHTML = stats.recent_users.map(u => `
        <div class="user-item">
          <div class="user-item-main">
            <div style="position: relative; flex-shrink: 0;">
              <img src="${resolveMediaUrl(u.avatar_url)}" alt="${escapeHtml(u.username)}" class="user-avatar" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'">
              <span class="presence-dot ${u.is_online ? 'presence-online' : 'presence-offline'}" style="position: absolute; bottom: 0; right: 0; border: 2px solid var(--bg-card);" title="${u.is_online ? 'Đang online' : 'Ngoại tuyến'}"></span>
            </div>
            <div class="user-details">
              <span class="user-name">${escapeHtml(u.full_name || u.username)}</span>
              <span class="user-sub">@${escapeHtml(u.username)} • ${formatDate(u.created_at)}</span>
            </div>
          </div>
          <span class="status-pill status-${u.is_active ? 'active' : 'inactive'}">
            ${u.is_active ? '✓ Hoạt động' : '🔒 Đã khóa'}
          </span>
        </div>
      `).join('');
    } else {
      recentUsersContainer.innerHTML = '<div class="empty-state">Chưa có người dùng nào.</div>';
    }

    // Recent Posts List
    const recentPostsContainer = document.getElementById('overview-recent-posts');
    if (stats.recent_posts && stats.recent_posts.length > 0) {
      recentPostsContainer.innerHTML = stats.recent_posts.map(p => {
        const isVideo = p.media_type === 'video' || !!p.video_url;
        const mediaSource = p.media_url || p.video_url || p.image_url;
        const resolvedMedia = resolveMediaUrl(mediaSource);
        const authorUsername = p.username || p.author_username || 'unknown';

        return `
          <div class="post-preview-item">
            <div class="post-preview-thumb" onclick="openPostReviewModal(${p.id})" title="Bấm để xem video/ảnh lớn & kiểm duyệt">
              <img src="${resolveMediaUrl(p.image_url || p.media_url)}" alt="Post thumbnail" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'">
              <div class="thumb-badge">${isVideo ? '▶ VIDEO' : '🖼️ ẢNH'}</div>
            </div>
            <div class="post-preview-info">
              <span class="post-caption" title="${escapeHtml(p.caption || '')}">${escapeHtml(p.caption || '(Không có chú thích)')}</span>
              <div class="post-meta-line">
                <span>Đăng bởi <strong>@${escapeHtml(authorUsername)}</strong></span>
                <span>• ${formatDate(p.created_at)}</span>
                <span>• ❤️ ${p.reactions_count || 0}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      recentPostsContainer.innerHTML = '<div class="empty-state">Chưa có bài viết nào gần đây.</div>';
    }

  } catch (error) {
    console.error('Dashboard stats error:', error);
    // Show toast only for non-network errors (silent fail on disconnect)
    if (error.name !== 'TypeError' || !error.message.includes('fetch')) {
      showToast(`Lỗi tải dữ liệu: ${error.message}`, 'error');
    }
  } finally {
    // Initialize default charts with 7 days (never block)
    loadUserGrowthChart(7).catch(e => console.error('Chart error:', e));
    loadPostsInteractionChart(7).catch(e => console.error('Chart error:', e));
  }
}

// ==========================================
// 4A. CHARTS - User Growth & Posts Interaction
// ==========================================
let userGrowthChart = null;
let postsInteractionChart = null;

// Fallback sample data for charts when backend API not available
const SAMPLE_USER_GROWTH = (days = 7) => ({
  labels: Array.from({length: days}, (_, i) => `Ngày ${i+1}`),
  values: Array.from({length: days}, () => Math.floor(Math.random() * 50) + 10)
});

const SAMPLE_POSTS_INTERACTION = (days = 7) => ({
  labels: Array.from({length: days}, (_, i) => `Ngày ${i+1}`),
  posts: Array.from({length: days}, () => Math.floor(Math.random() * 30) + 5),
  interactions: Array.from({length: days}, () => Math.floor(Math.random() * 100) + 20)
});

async function loadUserGrowthChart(days = 7) {
  let data;
  try {
    const res = await apiRequest(`/admin/analytics/user-growth?days=${days}`);
    if (!res.success) throw new Error('API failed');
    data = res.data;
  } catch (err) {
    // Use sample data as fallback
    data = SAMPLE_USER_GROWTH(days);
  }

  const elem = document.getElementById('userGrowthChart');
  if (!elem || !Chart) return;
  const ctx = elem.getContext('2d');

  if (userGrowthChart) userGrowthChart.destroy();

  userGrowthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Người dùng mới',
        data: data.values,
        borderColor: '#6C63FF',
        backgroundColor: 'rgba(108, 99, 255, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: 'var(--text-secondary)' }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: 'var(--text-secondary)' }
        }
      }
    }
  });
}

async function loadPostsInteractionChart(days = 7) {
  let data;
  try {
    const res = await apiRequest(`/admin/analytics/posts-interaction?days=${days}`);
    if (!res.success) throw new Error('API failed');
    data = res.data;
  } catch (err) {
    // Use sample data as fallback
    data = SAMPLE_POSTS_INTERACTION(days);
  }

  const elem = document.getElementById('postsInteractionChart');
  if (!elem || !Chart) return;
  const ctx = elem.getContext('2d');

  if (postsInteractionChart) postsInteractionChart.destroy();

  postsInteractionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Bài viết',
        data: data.posts,
        backgroundColor: 'rgba(108, 99, 255, 0.7)',
        borderRadius: 4
      }, {
        label: 'Tương tác',
        data: data.interactions,
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: 'var(--text-secondary)' }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: 'var(--text-secondary)' }
        }
      }
    }
  });
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

    const isAdmin = Boolean(state.adminUser && state.adminUser.role === 'admin');

    tbody.innerHTML = users.map(user => {
      let statusPillHtml = '';
      if (user.is_active) {
        statusPillHtml = '<span class="status-pill status-active">✓ Hoạt động</span>';
      } else if (user.banned_until) {
        statusPillHtml = `<span class="status-pill status-pending" title="Lý do: ${escapeHtml(user.ban_reason || 'Không có')}">⏳ Khóa đến ${formatDate(user.banned_until)}</span>`;
      } else {
        statusPillHtml = `<span class="status-pill status-inactive" title="Lý do: ${escapeHtml(user.ban_reason || 'Không có')}">⛔ Khóa vĩnh viễn</span>`;
      }

      return `
        <tr>
          <td>#${user.id}</td>
          <td>
            <div class="user-inline">
              <div style="position: relative; flex-shrink: 0;">
                <img src="${resolveMediaUrl(user.avatar_url)}" alt="avatar" class="avatar-sm" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'">
                <span class="presence-dot ${user.is_online ? 'presence-online' : 'presence-offline'}" style="position: absolute; bottom: 0; right: 0; border: 2px solid var(--bg-card);" title="${user.is_online ? 'Đang trực tuyến' : 'Ngoại tuyến'}"></span>
              </div>
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
          <td>${statusPillHtml}</td>
          <td>
            <div class="action-buttons">
              ${user.is_active ? (
                isAdmin
                  ? `<button class="btn btn-sm btn-danger" onclick="openBanUserModal(${user.id})" title="Khóa tài khoản kèm lý do và thời hạn">🔒 Khóa</button>`
                  : `<button class="btn btn-sm btn-secondary" disabled title="Chỉ Quản trị viên tối cao mới có quyền khóa tài khoản">🔒 Khóa (Admin)</button>`
              ) : (
                isAdmin
                  ? `<button class="btn btn-sm btn-success" onclick="unbanUserDirect(${user.id}, '${escapeHtml(user.username)}')" title="Mở khóa tài khoản ngay">🔓 Mở khóa</button>`
                  : `<button class="btn btn-sm btn-secondary" disabled title="Chỉ Quản trị viên tối cao mới có quyền mở khóa">🔒 Đã khóa</button>`
              )}
              <button class="btn btn-sm btn-secondary" onclick="openResetModalDirect(${user.id}, '${escapeHtml(user.email)}', '${escapeHtml(user.username)}')">
                🔑 Mật khẩu
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination('users-pagination', pagination, loadUsers);

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center error-cell">Lỗi tải dữ liệu: ${error.message}</td></tr>`;
    showToast(`Lỗi: ${error.message}`, 'error');
  }
}

// ==========================================
// BAN USER CONTROLLERS
// ==========================================
let activeBanTarget = null;

function openBanUserModal(userId) {
  const user = state.users.data.find(u => u.id === userId);
  if (!user) return;
  activeBanTarget = user;

  document.getElementById('modal-ban-title').textContent = `Khóa tài khoản @${escapeHtml(user.username)}`;
  document.getElementById('modal-ban-user-card').innerHTML = `
    <div class="user-item-main">
      <img src="${resolveMediaUrl(user.avatar_url)}" alt="avatar" class="user-avatar" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'">
      <div class="user-details">
        <span class="user-name">${escapeHtml(user.full_name || user.username)}</span>
        <span class="user-sub">@${escapeHtml(user.username)} • ${escapeHtml(user.email)}</span>
      </div>
    </div>
    <span class="status-pill status-${user.is_active ? 'active' : 'inactive'}">
      ${user.is_active ? '✓ Đang hoạt động' : '🔒 Đã khóa'}
    </span>
  `;

  // Reset form controls
  const temporaryRadio = document.querySelector('input[name="ban-type"][value="temporary"]');
  if (temporaryRadio) temporaryRadio.checked = true;
  const daysSelect = document.getElementById('ban-days-select');
  if (daysSelect) daysSelect.value = '7';
  const customDays = document.getElementById('ban-days-custom');
  if (customDays) customDays.value = '';
  const customWrapper = document.getElementById('custom-days-wrapper');
  if (customWrapper) customWrapper.style.display = 'none';
  const reasonPreset = document.getElementById('ban-reason-preset');
  if (reasonPreset) reasonPreset.value = 'Vi phạm tiêu chuẩn cộng đồng';
  const reasonText = document.getElementById('ban-reason-text');
  if (reasonText) reasonText.value = 'Vi phạm tiêu chuẩn cộng đồng';
  const groupDays = document.getElementById('group-ban-days');
  if (groupDays) groupDays.style.display = 'block';

  openModal('modal-ban-user');
}

function toggleBanDurationFields() {
  const isTemporary = document.querySelector('input[name="ban-type"]:checked')?.value === 'temporary';
  const groupDays = document.getElementById('group-ban-days');
  if (groupDays) groupDays.style.display = isTemporary ? 'block' : 'none';
}

function handleBanDaysChange(value) {
  const customWrapper = document.getElementById('custom-days-wrapper');
  if (customWrapper) customWrapper.style.display = value === 'custom' ? 'block' : 'none';
}

function handleBanPresetChange(value) {
  const reasonText = document.getElementById('ban-reason-text');
  if (!reasonText) return;
  if (value === 'custom') {
    reasonText.value = '';
    reasonText.focus();
  } else {
    reasonText.value = value;
  }
}

async function submitBanUserAction() {
  if (!activeBanTarget) return;
  const isTemporary = document.querySelector('input[name="ban-type"]:checked')?.value === 'temporary';
  const presetDays = document.getElementById('ban-days-select').value;
  let days = presetDays === 'custom' 
    ? parseInt(document.getElementById('ban-days-custom').value, 10) 
    : parseInt(presetDays, 10);

  if (isTemporary && (!days || isNaN(days) || days <= 0)) {
    showToast('Vui lòng chọn hoặc nhập số ngày khóa hợp lệ (tối thiểu 1 ngày)!', 'warning');
    return;
  }

  const reason = document.getElementById('ban-reason-text').value.trim();
  if (!reason) {
    showToast('Vui lòng nhập lý do khóa tài khoản!', 'warning');
    return;
  }

  const btnConfirm = document.getElementById('btn-confirm-ban');
  btnConfirm.disabled = true;
  btnConfirm.textContent = 'Đang xử lý...';

  try {
    const res = await apiRequest(`/admin/users/${activeBanTarget.id}/ban`, {
      method: 'PUT',
      body: JSON.stringify({
        action: 'ban',
        type: isTemporary ? 'temporary' : 'permanent',
        days: isTemporary ? days : null,
        reason,
      }),
    });

    if (res.success) {
      showToast(res.message || 'Đã khóa tài khoản thành công!', 'success');
      closeModal('modal-ban-user');
      loadUsers(state.users.page);
      loadDashboardStats();
    }
  } catch (error) {
    showToast(`Không thể khóa tài khoản: ${error.message}`, 'error');
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.textContent = '🔒 Xác nhận khóa';
  }
}

async function unbanUserDirect(userId, username) {
  if (!confirm(`Bạn có chắc muốn MỞ KHÓA tài khoản @${username}? Người dùng sẽ có thể đăng nhập bình thường.`)) {
    return;
  }

  try {
    const res = await apiRequest(`/admin/users/${userId}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'unban' }),
    });

    if (res.success) {
      showToast(`Đã mở khóa tài khoản @${username} thành công!`, 'success');
      loadUsers(state.users.page);
      loadDashboardStats();
    }
  } catch (error) {
    showToast(`Không thể mở khóa: ${error.message}`, 'error');
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
            <div class="media-thumb-box" onclick="openPostReviewModal(${post.id})" title="Nhấp để xem trước ảnh/video & kiểm duyệt">
              <img src="${resolveMediaUrl(post.image_url || post.media_url)}" alt="Media thumbnail" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100'">
              <div class="thumb-badge">${isVideo ? '▶ VIDEO' : '🖼️ ẢNH'}</div>
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
            <div class="action-buttons">
              <button class="btn btn-sm btn-secondary" onclick="openPostReviewModal(${post.id})" title="Xem đầy đủ ảnh hoặc phát video trực tiếp">
                👁️ Xem
              </button>
              <button class="btn btn-sm btn-danger" onclick="openDeletePostModal(${post.id})" title="Gỡ bài viết kèm lý do và gửi thông báo tới tác giả">
                🗑️ Xóa bài
              </button>
            </div>
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

// ==========================================
// POST MODERATION & REVIEW CONTROLLERS
// ==========================================
let activeDeleteTarget = null;

function handleVideoPlayerError(videoEl, postId) {
  console.warn('Lỗi tải video bài viết ID:', postId);
  const notice = document.getElementById('video-stream-warning');
  if (notice) notice.style.display = 'block';
}

function openPostReviewModal(postId) {
  let post = state.posts.data.find(p => p.id === postId);
  if (!post && state.stats && state.stats.recent_posts) {
    post = state.stats.recent_posts.find(p => p.id === postId);
  }
  if (!post) return;

  const isVideo = post.media_type === 'video' || !!post.video_url || post.is_video;
  const videoStreamUrl = (post.stream_url || `${state.apiBaseUrl}/admin/posts/${post.id}/stream`) + (state.adminToken ? `?token=${encodeURIComponent(state.adminToken)}` : '');
  const resolvedMedia = resolveMediaUrl(post.media_url || post.image_url);
  const authorName = post.full_name || post.author_name || post.username || post.author_username || 'Tác giả';
  const authorUsername = post.username || post.author_username || 'unknown';
  const authorAvatar = post.avatar_url || post.author_avatar;

  document.getElementById('media-preview-title').textContent = isVideo ? 'Xem trước Video & Kiểm duyệt' : 'Xem trước Hình ảnh & Kiểm duyệt';

  const content = document.getElementById('media-preview-content');
  if (isVideo) {
    content.innerHTML = `
      <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
        <video 
          id="admin-video-element"
          src="${videoStreamUrl}" 
          controls 
          autoplay 
          muted
          playsinline 
          preload="auto"
          class="modal-video-player" 
          style="max-height: 55vh; width: 100%; background: #000; border-radius: 8px;"
          onerror="handleVideoPlayerError(this, ${post.id})"
        ></video>
        <div id="video-stream-hint" style="margin-top: 8px; font-size: 12px; color: #9ca3af; display: flex; align-items: center; gap: 6px;">
          <span>💡 Video đang phát tự động ở chế độ tắt tiếng. Bấm biểu tượng loa trên thanh điều khiển để nghe âm thanh.</span>
        </div>
        <div id="video-stream-warning" style="display: none; padding: 10px; color: #f87171; text-align: center; font-size: 13px;">
          ⚠️ Không thể phát video trực tiếp qua trình phát này. 
          <a href="${videoStreamUrl}" target="_blank" style="color: #60a5fa; text-decoration: underline; margin-left: 6px;">Mở tab mới để xem</a>
        </div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <img src="${resolvedMedia}" alt="Full media" class="modal-image-preview" style="max-height: 55vh;">
    `;
  }

  const meta = document.getElementById('media-preview-meta');
  meta.innerHTML = `
    <div class="review-author-row">
      <div class="user-inline">
        <img src="${resolveMediaUrl(authorAvatar)}" class="avatar-sm" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'">
        <div>
          <strong>${escapeHtml(authorName)}</strong>
          <div class="sub-text">@${escapeHtml(authorUsername)} • ${formatDate(post.created_at)}</div>
        </div>
      </div>
      <span class="privacy-badge privacy-${post.privacy_level || post.privacy || 'friends'}">
        ${(post.privacy_level === 'public' || post.privacy === 'public') ? '🌐 Công khai' : (post.privacy_level === 'friends' || post.privacy === 'friends') ? '👥 Bạn bè' : '🔒 Riêng tư'}
      </span>
    </div>
    ${post.caption ? `<div class="review-caption-box">${escapeHtml(post.caption)}</div>` : '<div class="sub-text">(Bài viết không có chú thích)</div>'}
    <div class="review-actions-row">
      <div class="engagement-pill">❤️ ${post.reactions_count || 0} cảm xúc • 💬 ${post.comments_count || 0} bình luận</div>
      <button class="btn btn-sm btn-danger" onclick="closeModal('modal-media-preview'); openDeletePostModal(${post.id});">
        🗑️ Gỡ bài này (kèm lý do)
      </button>
    </div>
  `;

  openModal('modal-media-preview');

  if (isVideo) {
    setTimeout(() => {
      const vid = document.getElementById('admin-video-element');
      if (vid) {
        vid.muted = true;
        const playPromise = vid.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn('Browser autoplay policy prevented playback:', err);
          });
        }
      }
    }, 150);
  }
}

function previewMedia(url, type, caption) {
  // Backward compatibility: find if any post has this media url
  let post = state.posts.data.find(p => (p.media_url === url || p.image_url === url || p.video_url === url));
  if (!post && state.stats && state.stats.recent_posts) {
    post = state.stats.recent_posts.find(p => (p.media_url === url || p.image_url === url || p.video_url === url));
  }

  if (post) {
    openPostReviewModal(post.id);
    return;
  }

  const content = document.getElementById('media-preview-content');
  const title = document.getElementById('media-preview-title');
  title.textContent = type === 'video' ? 'Xem trước Video' : 'Xem trước Hình ảnh';

  if (type === 'video') {
    content.innerHTML = `
      <video src="${url}" controls autoplay playsinline class="modal-video-player" style="max-height: 55vh; width: 100%; background: #000;"></video>
    `;
  } else {
    content.innerHTML = `
      <img src="${url}" alt="Full media" class="modal-image-preview" style="max-height: 55vh;">
    `;
  }

  const meta = document.getElementById('media-preview-meta');
  meta.innerHTML = caption ? `<div class="review-caption-box">${escapeHtml(caption)}</div>` : '';

  openModal('modal-media-preview');
}

function openDeletePostModal(postId) {
  let post = state.posts.data.find(p => p.id === postId);
  if (!post && state.stats && state.stats.recent_posts) {
    post = state.stats.recent_posts.find(p => p.id === postId);
  }
  if (!post) return;
  activeDeleteTarget = post;

  const isVideo = post.media_type === 'video' || !!post.video_url || post.is_video;
  const thumbUrl = resolveMediaUrl(post.image_url || post.media_url);
  const authorName = post.full_name || post.author_name || post.username || post.author_username || 'Tác giả';

  document.getElementById('modal-delete-post-preview').innerHTML = `
    <div class="post-preview-thumb">
      <img src="${thumbUrl}" alt="thumb" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'">
      ${isVideo ? `<div class="thumb-badge">VIDEO</div>` : ''}
    </div>
    <div class="post-preview-info">
      <span class="post-caption">${escapeHtml(post.caption || '(Không có chú thích)')}</span>
      <div class="post-meta-line">
        <span>Tác giả: <strong>@${escapeHtml(post.username || post.author_username || '')}</strong> (${escapeHtml(authorName)})</span>
        <span>• ID: #${post.id}</span>
      </div>
    </div>
  `;

  document.getElementById('delete-post-reason-preset').value = 'Hình ảnh / Video nhạy cảm, vi phạm tiêu chuẩn cộng đồng';
  document.getElementById('delete-post-reason-text').value = 'Hình ảnh / Video nhạy cảm, vi phạm tiêu chuẩn cộng đồng';

  openModal('modal-delete-post');
}

function handleDeletePostPresetChange(value) {
  const reasonText = document.getElementById('delete-post-reason-text');
  if (!reasonText) return;
  if (value === 'custom') {
    reasonText.value = '';
    reasonText.focus();
  } else {
    reasonText.value = value;
  }
}

async function submitDeletePostAction() {
  if (!activeDeleteTarget) return;
  const reason = document.getElementById('delete-post-reason-text').value.trim();

  if (!reason) {
    showToast('Vui lòng nhập lý do gỡ bài để thông báo cho tác giả!', 'warning');
    return;
  }

  const btnConfirm = document.getElementById('btn-confirm-delete-post');
  btnConfirm.disabled = true;
  btnConfirm.textContent = 'Đang xóa...';

  try {
    const res = await apiRequest(`/admin/posts/${activeDeleteTarget.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });

    if (res.success) {
      showToast(res.message || 'Đã gỡ bài viết vi phạm và gửi thông báo tới người đăng!', 'success');
      closeModal('modal-delete-post');
      loadPosts(state.posts.page);
      loadDashboardStats();
    }
  } catch (error) {
    showToast(`Không thể xóa bài viết: ${error.message}`, 'error');
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.textContent = '🗑️ Xác nhận gỡ & Gửi thông báo';
  }
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
    // Dừng phát và giải phóng tài nguyên video khi đóng modal xem trước
    if (modalId === 'modal-media-preview' || modalId === 'modal-delete-post') {
      const videos = modal.querySelectorAll('video');
      videos.forEach(v => {
        try {
          v.pause();
          v.removeAttribute('src');
          v.load();
        } catch (e) {}
      });
    }
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

  // Dùng /health endpoint (không cần token) để check trạng thái server
  // Tránh trigger showLoginOverlay khi token chưa có hoặc hết hạn
  const healthUrl = state.apiBaseUrl.replace(/\/api$/, '') + '/api/health';
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - start);

    if (res.ok) {
      if (statusText) statusText.textContent = 'Trực tuyến (Online)';
      if (pingText) pingText.textContent = `${latency}ms`;
      if (statusDot) {
        statusDot.style.background = 'var(--success)';
        statusDot.style.boxShadow = '0 0 8px var(--success)';
      }
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (error) {
    if (statusText) statusText.textContent = 'Mất kết nối API';
    if (pingText) pingText.textContent = 'Offline';
    if (statusDot) {
      statusDot.style.background = 'var(--danger)';
      statusDot.style.boxShadow = '0 0 8px var(--danger)';
    }
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
  connectAdminSocket();
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
// 10. AUTHENTICATION & LOGIN MANAGEMENT
// ==========================================
function showLoginOverlay(errorMsg = '') {
  const overlay = document.getElementById('admin-login-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }
  const errorBox = document.getElementById('login-error-box');
  if (errorBox) {
    if (errorMsg) {
      errorBox.style.display = 'block';
      errorBox.textContent = errorMsg;
    } else {
      errorBox.style.display = 'none';
    }
  }
}

function hideLoginOverlay() {
  const overlay = document.getElementById('admin-login-overlay');
  if (overlay) overlay.style.display = 'none';
}

function fillLoginPreset(username, password) {
  document.getElementById('login-username').value = username;
  document.getElementById('login-password').value = password;
  const form = document.getElementById('admin-login-form');
  if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
}

async function handleAdminLoginSubmit(e) {
  if (e) e.preventDefault();
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const submitBtn = document.getElementById('btn-login-submit');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!username || !password) {
    showLoginOverlay('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Đang xác thực...';
    }

    const res = await apiRequest('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (res.success && res.data) {
      state.adminToken = res.data.token;
      state.adminUser = res.data.user;

      localStorage.setItem('masita_admin_token', state.adminToken);
      localStorage.setItem('masita_admin_user', JSON.stringify(state.adminUser));

      hideLoginOverlay();
      updateTopbarProfile();
      showToast(`Chào mừng ${state.adminUser.full_name || state.adminUser.username} (${state.adminUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'})!`, 'success');
      
      connectAdminSocket();
      checkBackendHealth();
      refreshCurrentTab();
      setupAutoRefresh();
    }
  } catch (err) {
    showLoginOverlay(err.message || 'Tài khoản hoặc mật khẩu không chính xác.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Đăng nhập hệ thống';
    }
  }
}

function handleAdminLogout() {
  state.adminToken = null;
  state.adminUser = null;
  localStorage.removeItem('masita_admin_token');
  localStorage.removeItem('masita_admin_user');
  disconnectAdminSocket();
  updateTopbarProfile();
  showLoginOverlay('Bạn đã đăng xuất khỏi hệ thống.');
  showToast('Đã đăng xuất tài khoản quản trị.', 'info');
}

async function checkAdminAuth() {
  if (!state.adminToken) {
    showLoginOverlay();
    return false;
  }

  try {
    const res = await apiRequest('/admin/auth/me');
    if (res.success && res.data) {
      state.adminUser = res.data;
      localStorage.setItem('masita_admin_user', JSON.stringify(state.adminUser));
      hideLoginOverlay();
      updateTopbarProfile();
      connectAdminSocket();
      return true;
    }
  } catch (err) {
    showLoginOverlay('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    return false;
  }
  return false;
}

function updateTopbarProfile() {
  const nameEl = document.getElementById('topbar-admin-name');
  const roleEl = document.getElementById('topbar-admin-role');
  const avatarEl = document.getElementById('topbar-admin-avatar');
  const navStaff = document.getElementById('nav-staff');

  if (state.adminUser) {
    const isAdmin = state.adminUser.role === 'admin';
    if (nameEl) nameEl.textContent = state.adminUser.full_name || state.adminUser.username;
    if (roleEl) {
      roleEl.innerHTML = isAdmin
        ? '<span class="badge-role-admin">👑 Admin</span>'
        : '<span class="badge-role-staff">🛡️ Nhân viên</span>';
    }
    if (avatarEl) avatarEl.textContent = isAdmin ? '👑' : '🛡️';

    // Show staff tab only for admin
    if (navStaff) {
      navStaff.style.display = isAdmin ? 'flex' : 'none';
      if (!isAdmin && state.currentTab === 'staff') {
        switchTab('overview');
      }
    }
  } else {
    if (nameEl) nameEl.textContent = 'Chưa đăng nhập';
    if (roleEl) roleEl.textContent = 'Khách';
    if (avatarEl) avatarEl.textContent = '👤';
    if (navStaff) navStaff.style.display = 'none';
  }
}

// ==========================================
// 11. SUPPORT TICKETS CONTROLLER
// ==========================================
async function loadSupportTickets(page = 1) {
  const tbody = document.getElementById('tickets-table-body');
  if (!tbody) return;

  state.tickets.page = page;
  tbody.innerHTML = '<tr><td colspan="8" class="text-center loading-cell">Đang tải danh sách câu hỏi...</td></tr>';

  try {
    const res = await apiRequest(`/admin/support-tickets?status=${state.tickets.filter}&q=${encodeURIComponent(state.tickets.search)}&page=${page}&limit=${state.tickets.limit}`);
    if (!res.success) return;

    state.tickets.data = res.data;
    state.tickets.totalPages = res.pagination.total_pages || 1;
    state.tickets.total = res.pagination.total || 0;

    // Update filter counts
    if (res.counts) {
      const allEl = document.getElementById('count-ticket-all');
      const pendEl = document.getElementById('count-ticket-pending');
      const ansEl = document.getElementById('count-ticket-answered');
      if (allEl) allEl.textContent = res.counts.total.toString();
      if (pendEl) pendEl.textContent = res.counts.pending.toString();
      if (ansEl) ansEl.textContent = res.counts.answered.toString();

      const badge = document.getElementById('badge-pending-tickets');
      if (badge) {
        if (res.counts.pending > 0) {
          badge.style.display = 'inline-flex';
          badge.textContent = res.counts.pending.toString();
        } else {
          badge.style.display = 'none';
        }
      }
    }

    if (res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center empty-cell">Không có câu hỏi hoặc thắc mắc nào.</td></tr>';
      renderPagination('tickets-pagination', res.pagination, loadSupportTickets);
      return;
    }

    const categoryNames = {
      general: 'Hỏi đáp chung',
      account: 'Tài khoản & Đăng nhập',
      posts: 'Bài viết & Khoảnh khắc',
      chat_friends: 'Tin nhắn & Bạn bè',
      bug_report: 'Báo cáo lỗi kỹ thuật',
      other: 'Khác',
    };

    tbody.innerHTML = res.data.map(t => {
      const isPending = t.status === 'pending';
      const statusHtml = isPending
        ? '<span class="badge-ticket-pending">⏳ Chờ giải đáp</span>'
        : '<span class="badge-ticket-answered">✓ Đã giải đáp</span>';

      const categoryLabel = categoryNames[t.category] || t.category || 'Chung';

      return `
        <tr>
          <td>#${t.id}</td>
          <td>
            <div class="user-inline">
              <img src="${resolveMediaUrl(t.avatar_url)}" alt="avatar" class="avatar-sm" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'">
              <div>
                <strong>${escapeHtml(t.full_name || t.username)}</strong>
                <div class="sub-text">@${escapeHtml(t.username)}</div>
              </div>
            </div>
          </td>
          <td style="max-width: 260px;">
            <div style="font-weight: 600; color: #fff; margin-bottom: 2px;">${escapeHtml(t.subject)}</div>
            <div class="sub-text text-truncate" style="max-width: 240px;">${escapeHtml(t.message)}</div>
          </td>
          <td><span class="privacy-badge privacy-public">${escapeHtml(categoryLabel)}</span></td>
          <td>${statusHtml}</td>
          <td>${formatDate(t.created_at)}</td>
          <td>
            ${t.responder_name ? `
              <div>
                <strong>${escapeHtml(t.responder_name)}</strong>
                <div class="sub-text">${t.replied_at ? formatDate(t.replied_at) : ''}</div>
              </div>
            ` : '<span class="sub-text">—</span>'}
          </td>
          <td>
            <button class="btn btn-sm ${isPending ? 'btn-primary' : 'btn-secondary'}" onclick="openTicketReplyModal(${t.id})" title="${isPending ? 'Trả lời câu hỏi' : 'Xem lại lời giải đáp'}">
              ${isPending ? '💬 Trả lời' : '👁️ Xem'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination('tickets-pagination', res.pagination, loadSupportTickets);
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center error-cell">Lỗi tải danh sách: ${error.message}</td></tr>`;
    showToast(`Lỗi: ${error.message}`, 'error');
  }
}

function filterTickets(filter) {
  state.tickets.filter = filter;
  document.querySelectorAll('[data-ticket-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ticketFilter === filter);
  });
  loadSupportTickets(1);
}

function handleTicketsSearch(value) {
  clearTimeout(state.tickets.searchTimeout);
  state.tickets.searchTimeout = setTimeout(() => {
    state.tickets.search = value.trim();
    loadSupportTickets(1);
  }, 400);
}

function openTicketReplyModal(ticketId) {
  const ticket = state.tickets.data.find(t => t.id === ticketId);
  if (!ticket) return;

  state.activeTicketTarget = ticket;
  const isPending = ticket.status === 'pending';

  const previewBox = document.getElementById('modal-ticket-preview');
  previewBox.innerHTML = `
    <div class="ticket-user-header">
      <div class="user-inline">
        <img src="${resolveMediaUrl(ticket.avatar_url)}" class="avatar-sm" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'">
        <div>
          <strong>${escapeHtml(ticket.full_name || ticket.username)}</strong>
          <div class="sub-text">@${escapeHtml(ticket.username)} • Gửi lúc ${formatDate(ticket.created_at)}</div>
        </div>
      </div>
      <span class="privacy-badge privacy-public">${escapeHtml(ticket.category)}</span>
    </div>
    <div class="ticket-subject-title">❓ ${escapeHtml(ticket.subject)}</div>
    <div class="ticket-message-content">${escapeHtml(ticket.message)}</div>
    ${ticket.staff_reply ? `
      <div class="ticket-previous-reply">
        <div class="ticket-previous-reply-title">
          <span>✓ Đã được giải đáp bởi ${escapeHtml(ticket.responder_name || 'Ban Quản Trị')}</span>
          <span>(${formatDate(ticket.replied_at)})</span>
        </div>
        <div style="color: #D1D5DB; font-size: 13px; line-height: 1.5;">${escapeHtml(ticket.staff_reply)}</div>
      </div>
    ` : ''}
  `;

  document.getElementById('modal-ticket-title').textContent = isPending ? 'Giải đáp thắc mắc người dùng' : 'Chi tiết thắc mắc & Lời giải đáp';
  const replyInput = document.getElementById('ticket-reply-text');
  replyInput.value = ticket.staff_reply || '';

  const submitBtn = document.getElementById('btn-submit-reply');
  if (submitBtn) {
    submitBtn.textContent = isPending ? '📨 Gửi lời giải đáp' : '💾 Cập nhật câu trả lời';
  }

  openModal('modal-ticket-reply');
}

function insertQuickReply(type) {
  const input = document.getElementById('ticket-reply-text');
  if (!input) return;

  const templates = {
    1: 'Chào bạn, Ban Quản Trị Masita đã tiếp nhận vấn đề và tiến hành xử lý kỹ thuật xong. Bạn hãy thử lại tính năng này nhé. Cảm ơn bạn đã đồng hành!',
    2: 'Chào bạn, tính năng này bạn có thể vào trang cá nhân -> Cài đặt để tùy chỉnh, hoặc kiểm tra kết nối mạng/cập nhật phiên bản mới nhất để sử dụng mượt mà nhất.',
    3: 'Masita chân thành cảm ơn ý kiến đóng góp quý báu từ bạn! Đội ngũ phát triển sẽ ghi nhận để nâng cấp và hoàn thiện trải nghiệm trong các bản cập nhật sắp tới.',
  };

  input.value = templates[type] || '';
  input.focus();
}

async function submitTicketReplyAction() {
  if (!state.activeTicketTarget) return;

  const reply = document.getElementById('ticket-reply-text').value.trim();
  if (!reply) {
    showToast('Vui lòng nhập nội dung câu trả lời giải đáp.', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-reply');
  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Đang gửi...';
    }

    const res = await apiRequest(`/admin/support-tickets/${state.activeTicketTarget.id}/reply`, {
      method: 'PUT',
      body: JSON.stringify({ reply }),
    });

    if (res.success) {
      closeModal('modal-ticket-reply');
      showToast('Đã gửi lời giải đáp và thông báo trực tiếp tới người dùng!', 'success');
      loadSupportTickets(state.tickets.page);
    }
  } catch (err) {
    showToast(`Lỗi: ${err.message}`, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '📨 Gửi lời giải đáp';
    }
  }
}

// ==========================================
// 12. STAFF MANAGEMENT CONTROLLER (ADMIN ONLY)
// ==========================================
async function loadStaffList() {
  const tbody = document.getElementById('staff-table-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="text-center loading-cell">Đang tải danh sách nhân viên...</td></tr>';

  try {
    const res = await apiRequest('/admin/staff');
    if (!res.success) return;

    state.staff.data = res.data;

    if (res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center empty-cell">Chưa có nhân viên nào.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(s => {
      const isMasterAdmin = s.id === 1;
      const isAdmin = s.role === 'admin';
      const roleBadge = isAdmin
        ? '<span class="badge-role-admin">👑 Admin</span>'
        : '<span class="badge-role-staff">🛡️ Nhân viên</span>';

      const statusBadge = s.is_active
        ? '<span class="status-pill status-active">🟢 Hoạt động</span>'
        : '<span class="status-pill status-inactive">🔴 Đã khóa</span>';

      return `
        <tr>
          <td>#${s.id}</td>
          <td><strong>${escapeHtml(s.full_name)}</strong></td>
          <td>@${escapeHtml(s.username)}</td>
          <td>${escapeHtml(s.email || '—')}</td>
          <td>${roleBadge}</td>
          <td>${statusBadge}</td>
          <td>${s.last_login ? formatDate(s.last_login) : '<span class="sub-text">Chưa đăng nhập</span>'}</td>
          <td>
            ${isMasterAdmin ? `
              <span class="sub-text" title="Tài khoản Admin gốc hệ thống">🔒 Không thể sửa</span>
            ` : `
              <div class="action-buttons">
                <button class="btn btn-sm ${s.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleStaffStatusAction(${s.id}, ${s.is_active})">
                  ${s.is_active ? '🔒 Khóa' : '🔓 Mở'}
                </button>
              </div>
            `}
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center error-cell">Lỗi tải danh sách: ${error.message}</td></tr>`;
    showToast(`Lỗi: ${error.message}`, 'error');
  }
}

function generateStaffPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  let pwd = 'Nv@';
  for (let i = 0; i < 7; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById('staff-password').value = pwd;
}

async function submitCreateStaffAction(e) {
  if (e) e.preventDefault();

  const full_name = document.getElementById('staff-fullname').value.trim();
  const username = document.getElementById('staff-username').value.trim();
  const email = document.getElementById('staff-email').value.trim();
  const password = document.getElementById('staff-password').value;
  const role = document.getElementById('staff-role').value;

  if (!full_name || !username || !password) {
    showToast('Vui lòng điền đầy đủ họ tên, tên đăng nhập và mật khẩu.', 'warning');
    return;
  }

  try {
    const res = await apiRequest('/admin/staff', {
      method: 'POST',
      body: JSON.stringify({ full_name, username, email, password, role }),
    });

    if (res.success) {
      closeModal('modal-add-staff');
      document.getElementById('form-add-staff').reset();
      showToast(`Đã tạo tài khoản ${role === 'admin' ? 'Quản trị viên' : 'Nhân viên'} thành công!`, 'success');
      loadStaffList();
    }
  } catch (err) {
    showToast(`Lỗi: ${err.message}`, 'error');
  }
}

async function toggleStaffStatusAction(staffId, currentStatus) {
  const newStatus = currentStatus ? 0 : 1;
  const actionText = newStatus ? 'mở khóa' : 'tạm khóa';

  if (!confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản nhân viên #${staffId}?`)) return;

  try {
    const res = await apiRequest(`/admin/staff/${staffId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: newStatus }),
    });

    if (res.success) {
      showToast(`Đã ${actionText} tài khoản thành công!`, 'success');
      loadStaffList();
    }
  } catch (err) {
    showToast(`Lỗi: ${err.message}`, 'error');
  }
}

// ==========================================
// 12.5 REALTIME SOCKET (user/bài đăng mới → admin portal)
// ==========================================
let adminSocket = null;
let pendingRealtimeUpdates = { users: 0, posts: 0 };

function connectAdminSocket() {
  disconnectAdminSocket();
  if (!state.adminToken || typeof io === 'undefined') return;

  const origin = state.apiBaseUrl.replace(/\/api\/?$/, '');
  adminSocket = io(origin, {
    auth: { token: state.adminToken },
    transports: ['websocket', 'polling'],
  });

  adminSocket.on('connect_error', (err) => {
    console.warn('Admin socket connect_error:', err.message);
  });

  adminSocket.on('admin_new_user', (user) => {
    const name = user.full_name || user.username || 'Người dùng';
    handleRealtimeSignal('users', `🆕 Thành viên mới vừa đăng ký: @${escapeHtml(user.username || '')}`);
    if (state.currentTab === 'overview') loadDashboardStats();
  });

  adminSocket.on('admin_new_post', (post) => {
    const type = post.is_video ? 'video' : 'khoảnh khắc';
    handleRealtimeSignal('posts', `🆕 @${escapeHtml(post.username || '')} vừa đăng ${type} mới`);
    if (state.currentTab === 'overview') loadDashboardStats();
  });
}

function disconnectAdminSocket() {
  if (adminSocket) {
    adminSocket.removeAllListeners();
    adminSocket.disconnect();
    adminSocket = null;
  }
}

function handleRealtimeSignal(kind, message) {
  pendingRealtimeUpdates[kind] += 1;

  const onMatchingTab = (kind === 'users' && state.currentTab === 'users') ||
    (kind === 'posts' && state.currentTab === 'posts');

  if (onMatchingTab) {
    const label = kind === 'users' ? 'Tải người dùng' : 'Tải bài viết';
    showToastWithAction(message, 'info', label, () => {
      pendingRealtimeUpdates[kind] = 0;
      if (kind === 'users') loadUsers(1); else loadPosts(1);
    });
  } else if (state.currentTab !== 'overview') {
    showToast(message, 'info');
  }
}

function showToastWithAction(message, type, actionLabel, onClick) {
  const container = document.getElementById('toast-container');
  if (!container) return showToast(message, type);

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
    <button type="button" class="btn btn-sm btn-primary" style="margin-left:12px;white-space:nowrap;">${escapeHtml(actionLabel)}</button>
  `;
  const btn = toast.querySelector('button');
  btn.addEventListener('click', () => {
    toast.remove();
    onClick();
  });
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards ease';
    setTimeout(() => toast.remove(), 300);
  }, 8000);
}

// Global initialize for body onload
async function initializeDashboard() {
  console.log('init dashboard', Chart ? 'Chart ready' : 'Chart missing');
  try {
    await loadUserGrowthChart(7);
    await loadPostsInteractionChart(7);
  } catch (err) {
    console.error('Chart init error:', err);
  }
}

// ==========================================
// 13. INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Bind Sidebar Nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        switchTab(item.dataset.tab);
      });
    });

    // Bind Refresh Button
    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        showToast('Đang làm mới dữ liệu...', 'info');
        checkBackendHealth();
        refreshCurrentTab();
      });
    }

    // Populate Settings fields
    const apiInput = document.getElementById('api-base-url');
    if (apiInput) apiInput.value = state.apiBaseUrl;

    const refreshSelect = document.getElementById('auto-refresh-rate');
    if (refreshSelect) refreshSelect.value = state.autoRefreshRate.toString();

    // Check if admin is already logged in (restore session from localStorage)
    await checkAdminAuth();
    
    // Init charts (don't await - don't block page)
    initializeDashboard().catch(e => console.error('Init error:', e));
  } catch (err) {
    console.error('DOM init error:', err);
    showToast('Lỗi khởi tạo trang: ' + err.message, 'error');
  }
});
