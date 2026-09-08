import api from './api';
import { ApiResponse, NotificationItem } from '../types';

export interface GetNotificationsResponse {
  notifications: NotificationItem[];
  unread_count: number;
}

export const notificationService = {
  // Lấy danh sách thông báo
  async getNotifications(page = 1, limit = 20): Promise<GetNotificationsResponse> {
    const res = await api.get<ApiResponse<NotificationItem[]> & { unread_count?: number }>(
      '/notifications',
      {
        params: { page, limit },
      }
    );
    return {
      notifications: res.data.data || [],
      unread_count: res.data.unread_count ?? 0,
    };
  },

  // Lấy số lượng thông báo chưa đọc
  async getUnreadCount(): Promise<number> {
    const res = await api.get<ApiResponse<{ unread_count: number }>>('/notifications/unread-count');
    return res.data.data?.unread_count ?? 0;
  },

  // Đánh dấu 1 thông báo đã đọc
  async markAsRead(id: number): Promise<number> {
    const res = await api.put<ApiResponse<{ unread_count: number }>>(`/notifications/${id}/read`);
    return res.data.data?.unread_count ?? 0;
  },

  // Đánh dấu tất cả thông báo đã đọc
  async markAllAsRead(): Promise<boolean> {
    const res = await api.put<ApiResponse>('/notifications/read-all');
    return res.data.success;
  },

  // Xóa 1 thông báo
  async deleteNotification(id: number): Promise<number> {
    const res = await api.delete<ApiResponse<{ unread_count: number }>>(`/notifications/${id}`);
    return res.data.data?.unread_count ?? 0;
  },
};
