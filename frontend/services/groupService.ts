import { Platform } from 'react-native';
import api from './api';
import { ApiResponse, Group, GroupDetail, Message } from '../types';
import { compressImage } from '../utils/imageCompressor';

export const groupService = {
  // 1. Lấy danh sách nhóm người dùng tham gia
  async getMyGroups(): Promise<Group[]> {
    const res = await api.get<ApiResponse<Group[]>>('/groups');
    return res.data.data || [];
  },

  // 2. Lấy thông tin chi tiết nhóm & thành viên
  async getGroupDetail(groupId: number): Promise<GroupDetail> {
    const res = await api.get<ApiResponse<GroupDetail>>(`/groups/${groupId}`);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể tải thông tin nhóm.');
    }
    return res.data.data;
  },

  // 3. Tạo nhóm trò chuyện mới
  async createGroup(name: string, memberIds: number[], avatarUri?: string): Promise<Group> {
    const formData = new FormData();
    formData.append('name', name.trim());
    memberIds.forEach((id) => {
      formData.append('member_ids[]', id.toString());
    });

    if (avatarUri) {
      if (Platform.OS === 'web') {
        const response = await fetch(avatarUri);
        const blob = await response.blob();
        formData.append('image', blob, 'group_avatar.jpg');
      } else {
        const compressed = await compressImage(avatarUri);
        const uriParts = compressed.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        // @ts-expect-error React Native FormData file
        formData.append('image', {
          uri: compressed,
          name: `group_avatar.${fileType}`,
          type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
        });
      }
    }

    const res = await api.post<ApiResponse<Group>>('/groups', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể tạo nhóm.');
    }
    return res.data.data;
  },

  // 4. Cập nhật tên hoặc avatar nhóm
  async updateGroup(groupId: number, name?: string, avatarUri?: string): Promise<Partial<Group>> {
    const formData = new FormData();
    if (name) formData.append('name', name.trim());

    if (avatarUri) {
      if (Platform.OS === 'web') {
        const response = await fetch(avatarUri);
        const blob = await response.blob();
        formData.append('image', blob, 'group_avatar.jpg');
      } else {
        const compressed = await compressImage(avatarUri);
        const uriParts = compressed.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        // @ts-expect-error React Native FormData file
        formData.append('image', {
          uri: compressed,
          name: `group_avatar.${fileType}`,
          type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
        });
      }
    }

    const res = await api.put<ApiResponse<Partial<Group>>>(`/groups/${groupId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể cập nhật nhóm.');
    }
    return res.data.data;
  },

  // 4a. Cập nhật ảnh đại diện nhóm
  async updateGroupAvatar(groupId: number, avatarUri: string): Promise<Partial<Group>> {
    const formData = new FormData();
    formData.append('type', 'avatar');

    if (Platform.OS === 'web') {
      const response = await fetch(avatarUri);
      const blob = await response.blob();
      formData.append('image', blob, 'group_avatar.jpg');
    } else {
      const compressed = await compressImage(avatarUri);
      const uriParts = compressed.split('.');
      const fileType = uriParts[uriParts.length - 1] || 'jpg';
      // @ts-expect-error React Native FormData file
      formData.append('image', {
        uri: compressed,
        name: `group_avatar.${fileType}`,
        type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
      });
    }

    const res = await api.put<ApiResponse<Partial<Group>>>(`/groups/${groupId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể cập nhật avatar nhóm.');
    }
    return res.data.data;
  },

  // 4b. Cập nhật hình nền (Theme) nhóm từ ảnh tải lên
  async updateGroupBackground(groupId: number, backgroundUri: string): Promise<Partial<Group>> {
    const formData = new FormData();
    formData.append('type', 'background');

    if (Platform.OS === 'web') {
      const response = await fetch(backgroundUri);
      const blob = await response.blob();
      formData.append('image', blob, 'group_bg.jpg');
    } else {
      const compressed = await compressImage(backgroundUri);
      const uriParts = compressed.split('.');
      const fileType = uriParts[uriParts.length - 1] || 'jpg';
      // @ts-expect-error React Native FormData file
      formData.append('image', {
        uri: compressed,
        name: `group_bg.${fileType}`,
        type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
      });
    }

    const res = await api.put<ApiResponse<Partial<Group>>>(`/groups/${groupId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể cập nhật hình nền nhóm.');
    }
    return res.data.data;
  },

  // 4c. Chọn preset hình nền có sẵn
  async setGroupPresetBackground(groupId: number, presetUrl: string): Promise<Partial<Group>> {
    const res = await api.put<ApiResponse<Partial<Group>>>(`/groups/${groupId}`, {
      background_preset: presetUrl,
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể áp dụng hình nền.');
    }
    return res.data.data;
  },

  // 4d. Gỡ bỏ hình nền (khôi phục nền mặc định)
  async removeGroupBackground(groupId: number): Promise<Partial<Group>> {
    const res = await api.put<ApiResponse<Partial<Group>>>(`/groups/${groupId}`, {
      remove_background: 'true',
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể gỡ hình nền nhóm.');
    }
    return res.data.data;
  },

  // 5. Thêm thành viên vào nhóm
  async addMembers(groupId: number, memberIds: number[]): Promise<void> {
    await api.post(`/groups/${groupId}/members`, { member_ids: memberIds });
  },

  // 6. Xóa thành viên hoặc Rời nhóm
  async removeMember(groupId: number, userId: number): Promise<void> {
    await api.delete(`/groups/${groupId}/members/${userId}`);
  },

  // 7. Lấy lịch sử tin nhắn trong nhóm
  async getGroupMessages(groupId: number): Promise<Message[]> {
    const res = await api.get<ApiResponse<Message[]>>(`/groups/${groupId}/messages`);
    return res.data.data || [];
  },

  // 8. Gửi tin nhắn văn bản vào nhóm
  async sendGroupMessage(groupId: number, messageText: string): Promise<Message> {
    const res = await api.post<ApiResponse<Message>>(`/groups/${groupId}/messages`, {
      message_text: messageText.trim(),
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể gửi tin nhắn nhóm.');
    }
    return res.data.data;
  },

  // 9. Gửi hình ảnh vào nhóm
  async sendGroupImage(groupId: number, imageUri: string, messageText?: string): Promise<Message> {
    const formData = new FormData();
    if (messageText && messageText.trim().length > 0) {
      formData.append('message_text', messageText.trim());
    }

    if (Platform.OS === 'web') {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      formData.append('image', blob, 'group_image.jpg');
    } else {
      const compressed = await compressImage(imageUri);
      const uriParts = compressed.split('.');
      const fileType = uriParts[uriParts.length - 1] || 'jpg';
      // @ts-expect-error React Native FormData file
      formData.append('image', {
        uri: compressed,
        name: `group_image_${Date.now()}.${fileType}`,
        type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
      });
    }

    const res = await api.post<ApiResponse<Message>>(`/groups/${groupId}/upload-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể gửi ảnh nhóm.');
    }
    return res.data.data;
  },

  // 10. Gửi tệp tin vào nhóm (hỗ trợ video kèm thumbnail)
  async sendGroupFile(
    groupId: number,
    fileUri: string,
    fileName: string,
    mimeType?: string,
    messageText?: string,
    thumbnailUri?: string
  ): Promise<Message> {
    const formData = new FormData();
    if (messageText && messageText.trim().length > 0) {
      formData.append('message_text', messageText.trim());
    }

    if (Platform.OS === 'web') {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      formData.append('file', blob, fileName);
    } else {
      // @ts-expect-error React Native FormData file
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType || 'application/octet-stream',
      });
    }

    // Đính kèm ảnh bìa thumbnail nếu có (dành cho video)
    if (thumbnailUri) {
      const thumbName = `thumb_${fileName.replace(/\.[^/.]+$/, '')}.jpg`;
      if (Platform.OS === 'web') {
        try {
          const thumbResponse = await fetch(thumbnailUri);
          const thumbBlob = await thumbResponse.blob();
          formData.append('thumbnail', thumbBlob, thumbName);
        } catch {
          // @ts-expect-error React Native FormData thumbnail
          formData.append('thumbnail', {
            uri: thumbnailUri,
            name: thumbName,
            type: 'image/jpeg',
          });
        }
      } else {
        // @ts-expect-error React Native FormData thumbnail
        formData.append('thumbnail', {
          uri: thumbnailUri,
          name: thumbName,
          type: 'image/jpeg',
        });
      }
    }

    const res = await api.post<ApiResponse<Message>>(`/groups/${groupId}/upload-file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể gửi tệp tin nhóm.');
    }
    return res.data.data;
  },

  // Bật/Tắt Ghim nhóm chat
  async toggleGroupPin(groupId: number, isPinned?: boolean): Promise<boolean> {
    const res = await api.put<ApiResponse<{ is_pinned: boolean }>>(`/groups/${groupId}/pin`, {
      is_pinned: isPinned,
    });
    return res.data.data?.is_pinned ?? false;
  },

  // Bật/Tắt Thông báo nhóm chat
  async toggleGroupMute(groupId: number, isMuted?: boolean): Promise<boolean> {
    const res = await api.put<ApiResponse<{ is_muted: boolean }>>(`/groups/${groupId}/mute`, {
      is_muted: isMuted,
    });
    return res.data.data?.is_muted ?? false;
  },

  // Tìm kiếm tin nhắn nhóm theo từ khóa
  async searchGroupMessages(groupId: number, query: string): Promise<Message[]> {
    if (!query.trim()) return [];
    const res = await api.get<ApiResponse<Message[]>>(`/groups/${groupId}/search`, {
      params: { q: query.trim() },
    });
    return res.data.data || [];
  },
};
