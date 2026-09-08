import api from './api';
import { ApiResponse, UserSearchResult, Friend, FriendRequest, UserProfileData } from '../types';

export const friendService = {
  // Xem thông tin trang cá nhân người khác
  async getUserProfile(userId: number): Promise<UserProfileData> {
    const res = await api.get<ApiResponse<UserProfileData>>(`/friends/profile/${userId}`);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể tải thông tin hồ sơ.');
    }
    return res.data.data;
  },

  // Tìm kiếm người dùng theo từ khóa
  async searchUsers(query: string): Promise<UserSearchResult[]> {
    const res = await api.get<ApiResponse<UserSearchResult[]>>(`/friends/search`, {
      params: { q: query },
    });
    return res.data.data || [];
  },

  // Lấy danh sách bạn bè đã chấp nhận
  async getFriendsList(): Promise<Friend[]> {
    const res = await api.get<ApiResponse<Friend[]>>('/friends/list');
    return res.data.data || [];
  },

  // Lấy danh sách lời mời kết bạn đang chờ nhận được
  async getPendingRequests(): Promise<FriendRequest[]> {
    const res = await api.get<ApiResponse<FriendRequest[]>>('/friends/requests');
    return res.data.data || [];
  },

  // Gửi lời mời kết bạn
  async sendFriendRequest(targetId: number): Promise<string> {
    const res = await api.post<ApiResponse>('/friends/request', { target_id: targetId });
    return res.data.message;
  },

  // Chấp nhận lời mời kết bạn
  async acceptFriendRequest(requesterId: number): Promise<string> {
    const res = await api.post<ApiResponse>('/friends/accept', { requester_id: requesterId });
    return res.data.message;
  },

  // Lấy danh sách gợi ý kết bạn
  async getSuggestions(): Promise<UserSearchResult[]> {
    const res = await api.get<ApiResponse<UserSearchResult[]>>('/friends/suggestions');
    return res.data.data || [];
  },

  // Từ chối / Hủy kết bạn
  async rejectOrCancelRequest(targetId: number): Promise<string> {
    const res = await api.post<ApiResponse>('/friends/reject', { target_id: targetId });
    return res.data.message;
  },
};
