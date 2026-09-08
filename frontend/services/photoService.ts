import { Platform } from 'react-native';
import api from './api';
import { ApiResponse, Photo, PhotoReaction, PhotoPrivacy } from '../types';
import { compressImage } from '../utils/imageCompressor';

export interface PhotoFeedResponse {
  photos: Photo[];
  nextCursor: number | null;
  hasMore: boolean;
}

export const photoService = {
  // Lấy danh sách bài viết Locket Feed (hỗ trợ tìm kiếm, phạm vi all/friends/public và phân trang vô tận cursor)
  async getPhotoFeed(
    query?: string,
    scope: 'all' | 'friends' | 'public' = 'all',
    cursor?: number | null,
    limit: number = 15
  ): Promise<PhotoFeedResponse> {
    const res = await api.get<ApiResponse<Photo[]> & { pagination?: { next_cursor: number | null; has_more: boolean } }>('/photos/feed', {
      params: {
        ...(query ? { q: query } : {}),
        scope,
        ...(cursor ? { cursor } : {}),
        limit,
      },
    });
    return {
      photos: res.data.data || [],
      nextCursor: res.data.pagination?.next_cursor ?? null,
      hasMore: Boolean(res.data.pagination?.has_more),
    };
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

  // Lấy danh sách ảnh do chính mình đăng (Grid 3x3 Profile)
  async getMyPhotos(): Promise<Photo[]> {
    const res = await api.get<ApiResponse<Photo[]>>('/photos/me');
    return res.data.data || [];
  },

  // Lấy danh sách ảnh mình đã thả cảm xúc (Tab Liked Profile)
  async getLikedPhotos(): Promise<Photo[]> {
    const res = await api.get<ApiResponse<Photo[]>>('/photos/liked');
    return res.data.data || [];
  },

  // Lấy danh sách bài viết đã lưu (Tab Lưu bài viết Profile)
  async getSavedPhotos(): Promise<Photo[]> {
    const res = await api.get<ApiResponse<Photo[]>>('/photos/saved');
    return res.data.data || [];
  },

  // Lưu / Bỏ lưu bài viết
  async toggleSavePhoto(photoId: number, action?: 'save' | 'unsave'): Promise<{ is_saved: boolean }> {
    const res = await api.post<ApiResponse<{ is_saved: boolean }>>(`/photos/${photoId}/save`, { action });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể lưu bài viết.');
    }
    return res.data.data;
  },

  // Lấy danh sách bài viết đã đăng lại (Tab Đăng lại Profile)
  async getRepostedPhotos(): Promise<Photo[]> {
    const res = await api.get<ApiResponse<Photo[]>>('/photos/reposts');
    return res.data.data || [];
  },

  // Đăng lại / Hủy đăng lại bài viết
  async toggleRepost(photoId: number, action?: 'repost' | 'unrepost'): Promise<{ is_reposted: boolean }> {
    const res = await api.post<ApiResponse<{ is_reposted: boolean }>>(`/photos/${photoId}/repost`, { action });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể đăng lại bài viết.');
    }
    return res.data.data;
  },

  // Upload video khoảnh khắc Locket mới (hỗ trợ kèm ảnh bìa thumbnail)
  async uploadVideoPost(
    videoUri: string,
    thumbnailUri?: string | null,
    caption?: string,
    recipientId?: number | null,
    privacy: PhotoPrivacy = 'friends'
  ): Promise<Photo> {
    const formData = new FormData();

    const cleanUri = videoUri.split('?')[0];
    const rawName = cleanUri.split('/').pop() || `video_${Date.now()}.mp4`;
    let safeBase = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safeBase.endsWith('.mp4') && !safeBase.endsWith('.mov') && !safeBase.endsWith('.m4v')) {
      safeBase = `${safeBase}.mp4`;
    }

    if (Platform.OS === 'web') {
      try {
        const response = await fetch(videoUri);
        const blob = await response.blob();
        formData.append('video', blob, safeBase);
      } catch (e) {
        console.warn('Lỗi chuyển đổi video URI sang blob trên web:', e);
        formData.append('video', {
          uri: videoUri,
          name: safeBase,
          type: 'video/mp4',
        } as unknown as Blob);
      }
    } else {
      formData.append('video', {
        uri: videoUri,
        name: safeBase,
        type: 'video/mp4',
      } as unknown as Blob);
    }

    // Đính kèm thumbnail ảnh bìa nếu có
    if (thumbnailUri) {
      const thumbName = `thumb_${Date.now()}.jpg`;
      if (Platform.OS === 'web') {
        try {
          const thumbRes = await fetch(thumbnailUri);
          const thumbBlob = await thumbRes.blob();
          formData.append('thumbnail', thumbBlob, thumbName);
        } catch {
          formData.append('thumbnail', {
            uri: thumbnailUri,
            name: thumbName,
            type: 'image/jpeg',
          } as unknown as Blob);
        }
      } else {
        formData.append('thumbnail', {
          uri: thumbnailUri,
          name: thumbName,
          type: 'image/jpeg',
        } as unknown as Blob);
      }
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

    const res = await api.post<ApiResponse<Photo>>('/photos/upload-video', formData, {
      timeout: 120000,
    });

    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể đăng video.');
    }

    return res.data.data;
  },

  // Lấy URL phát luồng video bài viết chuẩn HTTP 206 (YouTube Progressive Buffer Streaming)
  getPhotoVideoStreamUrl(photoId: number, token?: string | null): string {
    const baseURL = api.defaults.baseURL || '';
    const cleanBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    return `${cleanBase}/photos/video-stream/${photoId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};

