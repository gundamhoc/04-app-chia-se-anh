import { Platform } from 'react-native';
import api from './api';
import { ApiResponse, Photo, PhotoReaction, PhotoPrivacy } from '../types';
import { compressImage } from '../utils/imageCompressor';

export const photoService = {
  // Lấy danh sách bài viết Locket Feed (hỗ trợ tìm kiếm theo caption, tác giả và phạm vi friends/public)
  async getPhotoFeed(query?: string, scope: 'friends' | 'public' = 'friends'): Promise<Photo[]> {
    const res = await api.get<ApiResponse<Photo[]>>('/photos/feed', {
      params: {
        ...(query ? { q: query } : {}),
        scope,
      },
    });
    return res.data.data || [];
  },

  // Upload khoảnh khắc Locket mới
  async uploadPhoto(
    imageUri: string,
    caption?: string,
    recipientId?: number | null,
    privacy: PhotoPrivacy = 'friends'
  ): Promise<Photo> {
    // Tự động nén và tối ưu hóa kích thước ảnh (giảm từ 10MB-30MB xuống ~500KB)
    let processedUri = imageUri;
    try {
      processedUri = await compressImage(imageUri, { maxWidth: 1440, quality: 0.82 });
    } catch (compressErr) {
      console.warn('Lỗi nén ảnh, dùng ảnh gốc:', compressErr);
    }

    const formData = new FormData();

    // Xử lý an toàn filename & mimeType cho mọi nguồn URI (Data URI, File URI, Blob URI)
    let filename = `photo_${Date.now()}.jpg`;
    let mimeType = 'image/jpeg';

    if (processedUri.startsWith('data:')) {
      const mimeMatch = processedUri.match(/^data:([^;]+);/);
      if (mimeMatch && mimeMatch[1]) {
        mimeType = mimeMatch[1];
        const sub = mimeType.split('/')[1] || 'jpeg';
        const safeExt = sub === 'jpeg' ? 'jpg' : sub;
        filename = `photo_${Date.now()}.${safeExt}`;
      }
    } else {
      const cleanUri = processedUri.split('?')[0];
      const rawName = cleanUri.split('/').pop() || `photo_${Date.now()}`;
      const safeBase = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const extMatch = safeBase.match(/\.([a-zA-Z0-9]+)$/);
      if (extMatch && extMatch[1]) {
        const ext = extMatch[1].toLowerCase();
        filename = safeBase;
        mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      } else {
        filename = `${safeBase}.jpg`;
        mimeType = 'image/jpeg';
      }
    }

    // Append file tương thích đa nền tảng (Web browser vs Mobile Native)
    if (Platform.OS === 'web') {
      try {
        const response = await fetch(processedUri);
        const blob = await response.blob();
        formData.append('image', blob, filename);
      } catch (e) {
        console.warn('Lỗi chuyển đổi URI sang blob trên web:', e);
        formData.append('image', {
          uri: processedUri,
          name: filename,
          type: mimeType,
        } as unknown as Blob);
      }
    } else {
      formData.append('image', {
        uri: processedUri,
        name: filename,
        type: mimeType,
      } as unknown as Blob);
    }

    if (caption && caption.trim().length > 0) {
      formData.append('caption', caption.trim());
    }

    if (recipientId && !isNaN(recipientId)) {
      formData.append('recipient_id', recipientId.toString());
    }

    if (privacy) {
      formData.append('privacy', privacy);
    }

    // Gửi multipart form mà không ép header cứng, để Axios & Runtime tự thêm boundary chuẩn
    const res = await api.post<ApiResponse<Photo>>('/photos/upload', formData, {
      timeout: 60000,
    });

    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể đăng ảnh.');
    }

    return res.data.data;
  },

  // Chỉnh sửa bài đăng (cập nhật chú thích/caption và quyền riêng tư)
  async updatePhoto(
    photoId: number,
    caption: string,
    privacy?: PhotoPrivacy
  ): Promise<{ id: number; caption: string; privacy?: PhotoPrivacy }> {
    const res = await api.put<ApiResponse<{ id: number; caption: string; privacy?: PhotoPrivacy }>>(`/photos/${photoId}`, {
      caption,
      privacy,
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể cập nhật bài đăng.');
    }
    return res.data.data;
  },

  // Xóa khoảnh khắc của chính mình
  async deletePhoto(photoId: number): Promise<string> {
    const res = await api.delete<ApiResponse>(`/photos/${photoId}`);
    return res.data.message;
  },

  // Thả / Bỏ thả biểu tượng cảm xúc vào bài viết
  async toggleReaction(photoId: number, emoji: string): Promise<{ photo_id: number; reactions: PhotoReaction[] }> {
    const res = await api.post<ApiResponse<{ photo_id: number; reactions: PhotoReaction[] }>>(`/photos/${photoId}/react`, {
      emoji,
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể thả cảm xúc.');
    }
    return res.data.data;
  },
};

