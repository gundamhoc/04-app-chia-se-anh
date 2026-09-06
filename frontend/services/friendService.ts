import api from './api';
import { ApiResponse, UserSearchResult, Friend, FriendRequest } from '../types';

export const friendService = {
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

  // Từ chối / Hủy kết bạn
  async rejectOrCancelRequest(targetId: number): Promise<string> {
    const res = await api.post<ApiResponse>('/friends/reject', { target_id: targetId });
    return res.data.message;
  },
};
