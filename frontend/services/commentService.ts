import api from './api';
import { ApiResponse, CommentItem, CommentReaction } from '../types';

export const commentService = {
  // 1. Lấy danh sách bình luận của bài viết
  async getComments(photoId: number): Promise<CommentItem[]> {
    const res = await api.get<ApiResponse<CommentItem[]>>(`/photos/${photoId}/comments`);
    return res.data.data || [];
  },

  // 2. Gửi bình luận mới hoặc trả lời bình luận
  async createComment(
    photoId: number,
    content: string,
    parentId?: number | null
  ): Promise<CommentItem> {
    const res = await api.post<ApiResponse<CommentItem>>(`/photos/${photoId}/comments`, {
      content,
      parent_id: parentId || null,
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể gửi bình luận.');
    }
    return res.data.data;
  },

  // 3. Xóa bình luận
  async deleteComment(commentId: number): Promise<number> {
    const res = await api.delete<ApiResponse<{ comment_id: number }>>(`/photos/comments/${commentId}`);
    return res.data.data?.comment_id || commentId;
  },

  // 4. Thả / Bỏ thả biểu tượng cảm xúc cho bình luận
  async toggleCommentReaction(
    commentId: number,
    emoji: string
  ): Promise<{ comment_id: number; reactions: CommentReaction[] }> {
    const res = await api.post<ApiResponse<{ comment_id: number; reactions: CommentReaction[] }>>(
      `/photos/comments/${commentId}/react`,
      { emoji }
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Không thể thả cảm xúc bình luận.');
    }
    return res.data.data;
  },
};
