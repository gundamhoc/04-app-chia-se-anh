// Types chung cho toàn bộ ứng dụng

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  created_at?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: User;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

export interface UserSearchResult {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  friendship_status: FriendshipStatus;
}

export interface Friend {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  friendship_date: string;
}

export interface FriendRequest {
  friendship_id: number;
  requester_id: number;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  request_time: string;
}

export interface PhotoReaction {
  emoji: string;
  count: number;
  user_reacted: boolean;
}

export interface Photo {
  id: number;
  user_id: number;
  recipient_id: number | null;
  image_url: string;
  caption: string | null;
  created_at: string;
  author_name: string;
  author_username: string;
  author_avatar: string | null;
  recipient_name?: string | null;
  reactions?: PhotoReaction[];
  top_reactions?: PhotoReaction[];
  total_reactions?: number;
  comment_count?: number;
}

export interface CommentReaction {
  emoji: string;
  count: number;
  user_reacted: boolean;
}

export interface CommentItem {
  id: number;
  photo_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  created_at: string;
  author_name: string;
  author_username: string;
  author_avatar: string | null;
  reply_to_username?: string | null;
  reply_to_name?: string | null;
  reactions?: CommentReaction[];
}



