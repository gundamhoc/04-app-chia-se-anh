import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import api from './api';
import { ApiResponse, Conversation, Message, ChatHistoryResponse, FileContentData } from '../types';
import { compressImage } from '../utils/imageCompressor';

export const messageService = {
  // Lấy danh sách cuộc trò chuyện gần nhất
  async getConversations(): Promise<Conversation[]> {
    const res = await api.get<ApiResponse<Conversation[]>>('/messages/conversations');
    return res.data.data || [];
  },

  // Lấy lịch sử chat với bạn bè
  async getMessages(friendId: number): Promise<ChatHistoryResponse> {
    const res = await api.get<ApiResponse<ChatHistoryResponse>>(`/messages/${friendId}`);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể tải tin nhắn.');
    }
    return res.data.data;
  },

  // Gửi tin nhắn văn bản (1-1)
  async sendMessage(receiverId: number, messageText: string): Promise<Message> {
    const res = await api.post<ApiResponse<Message>>('/messages', {
      receiver_id: receiverId,
      message_text: messageText.trim(),
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể gửi tin nhắn.');
    }
    return res.data.data;
  },

  // Gửi tin nhắn đính kèm hình ảnh (Tải lên Google Drive)
  async sendImageMessage(
    receiverId: number,
    imageUri: string,
    messageText?: string
  ): Promise<Message> {
    // Tự động nén ảnh trước khi gửi
    let processedUri = imageUri;
    try {
      processedUri = await compressImage(imageUri, { maxWidth: 1440, quality: 0.82 });
    } catch (e) {
      console.warn('Lỗi nén ảnh tin nhắn, dùng ảnh gốc:', e);
    }

    const formData = new FormData();

    // Trích xuất filename & mimeType an toàn
    let filename = `chat_${Date.now()}.jpg`;
    let mimeType = 'image/jpeg';

    if (processedUri.startsWith('data:')) {
      const mimeMatch = processedUri.match(/^data:([^;]+);/);
      if (mimeMatch && mimeMatch[1]) {
        mimeType = mimeMatch[1];
        const sub = mimeType.split('/')[1] || 'jpeg';
        const safeExt = sub === 'jpeg' ? 'jpg' : sub;
        filename = `chat_${Date.now()}.${safeExt}`;
      }
    } else {
      const cleanUri = processedUri.split('?')[0];
      const rawName = cleanUri.split('/').pop() || `chat_${Date.now()}`;
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

    formData.append('receiver_id', receiverId.toString());
    if (messageText && messageText.trim().length > 0) {
      formData.append('message_text', messageText.trim());
    }

    const res = await api.post<ApiResponse<Message>>('/messages/upload-image', formData, {
      timeout: 60000,
    });

    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể gửi ảnh tin nhắn.');
    }

    return res.data.data;
  },

  // Gửi tin nhắn đính kèm tệp tin bất kỳ (code, txt, pdf, zip, docx, video...)
  async sendFileMessage(
    receiverId: number,
    fileUri: string,
    fileName: string,
    fileSize?: number,
    mimeType?: string,
    messageText?: string,
    thumbnailUri?: string
  ): Promise<Message> {
    const formData = new FormData();
    const finalMimeType = mimeType || 'application/octet-stream';

    if (Platform.OS === 'web') {
      try {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        formData.append('file', blob, fileName);
      } catch (e) {
        console.warn('Lỗi chuyển đổi file URI sang blob trên web:', e);
        formData.append('file', {
          uri: fileUri,
          name: fileName,
          type: finalMimeType,
        } as unknown as Blob);
      }
    } else {
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: finalMimeType,
      } as unknown as Blob);
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

    formData.append('receiver_id', receiverId.toString());
    if (messageText && messageText.trim().length > 0) {
      formData.append('message_text', messageText.trim());
    }

    const res = await api.post<ApiResponse<Message>>('/messages/upload-file', formData, {
      timeout: 60000,
    });

    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể gửi tệp tin.');
    }

    return res.data.data;
  },

  // Đọc nội dung tệp tin (code/text)
  async getFileContent(messageId: number): Promise<FileContentData> {
    const res = await api.get<ApiResponse<FileContentData>>(`/messages/file-content/${messageId}`);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể đọc nội dung tệp tin.');
    }
    return res.data.data;
  },

  // Tải tệp tin về thiết bị (Web & Mobile Android/iOS)
  async downloadFile(fileUrl: string, fileName: string): Promise<void> {
    // Nếu URL là link proxy ảnh /photos/drive/:fileId, chuyển sang link tải file trực tiếp từ Google Drive
    let targetDownloadUrl = fileUrl;
    if (fileUrl.includes('/api/photos/drive/')) {
      const match = fileUrl.match(/\/api\/photos\/drive\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        targetDownloadUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }

    if (Platform.OS === 'web') {
      try {
        const link = document.createElement('a');
        link.href = targetDownloadUrl;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        console.warn('Lỗi download trên web:', e);
        window.open(targetDownloadUrl, '_blank');
      }
    } else {
      try {
        await Linking.openURL(targetDownloadUrl);
      } catch (e) {
        console.warn('Lỗi download trên mobile:', e);
      }
    }
  },

  // Đánh dấu đã đọc tất cả tin nhắn từ bạn bè
  async markMessagesRead(friendId: number): Promise<void> {
    await api.put(`/messages/${friendId}/read`);
  },

  // Cập nhật Theme / Hình nền trò chuyện 1-1
  async updateChatTheme(
    friendId: number,
    options: { imageUri?: string; presetUrl?: string; remove?: boolean }
  ): Promise<{ background_url: string | null }> {
    if (options.imageUri) {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(options.imageUri);
        const blob = await response.blob();
        formData.append('image', blob, 'chat_theme.jpg');
      } else {
        const compressed = await compressImage(options.imageUri);
        const uriParts = compressed.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        // @ts-expect-error React Native FormData file
        formData.append('image', {
          uri: compressed,
          name: `chat_theme.${fileType}`,
          type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
        });
      }

      const res = await api.put<ApiResponse<{ background_url: string | null }>>(
        `/messages/${friendId}/theme`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return res.data.data || { background_url: null };
    }

    const payload: { background_preset?: string; remove_background?: string } = {};
    if (options.presetUrl) payload.background_preset = options.presetUrl;
    if (options.remove) payload.remove_background = 'true';

    const res = await api.put<ApiResponse<{ background_url: string | null }>>(
      `/messages/${friendId}/theme`,
      payload
    );
    return res.data.data || { background_url: null };
  },

  // Bật/Tắt Ghim cuộc trò chuyện 1-1
  async togglePin(friendId: number, isPinned?: boolean): Promise<boolean> {
    const res = await api.put<ApiResponse<{ is_pinned: boolean }>>(`/messages/${friendId}/pin`, {
      is_pinned: isPinned,
    });
    return res.data.data?.is_pinned ?? false;
  },

  // Bật/Tắt Thông báo cuộc trò chuyện 1-1
  async toggleMute(friendId: number, isMuted?: boolean): Promise<boolean> {
    const res = await api.put<ApiResponse<{ is_muted: boolean }>>(`/messages/${friendId}/mute`, {
      is_muted: isMuted,
    });
    return res.data.data?.is_muted ?? false;
  },

  // Tìm kiếm tin nhắn 1-1 theo từ khóa
  async searchMessages(friendId: number, query: string): Promise<Message[]> {
    if (!query.trim()) return [];
    const res = await api.get<ApiResponse<Message[]>>(`/messages/${friendId}/search`, {
      params: { q: query.trim() },
    });
    return res.data.data || [];
  },

  // Lấy URL phát video trực tiếp chuẩn HTTP 206 (YouTube Progressive Buffer Streaming)
  getVideoStreamUrl(messageId: number, token?: string | null): string {
    const baseURL = api.defaults.baseURL || '';
    const cleanBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    return `${cleanBase}/messages/video-stream/${messageId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};

