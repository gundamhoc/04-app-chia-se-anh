// Types chung cho toàn bộ ứng dụng

export interface UserStats {
  posts_count: number;
  friends_count: number;
  likes_count: number;
  saved_count?: number;
  reposts_count?: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  bio?: string | null;
  created_at?: string;
  stats?: UserStats;
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

export interface OtherUserProfile {
  id: number;
  username: string;
  email?: string;
  full_name: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  bio: string | null;
  is_private_account?: boolean;
  created_at?: string;
  stats: UserStats;
  friendship_status: FriendshipStatus | 'self';
  friendship_id?: number | null;
  is_online?: boolean;
}

export interface UserProfileData {
  user: OtherUserProfile;
  photos: Photo[];
  is_locked: boolean;
}

export interface UserSearchResult {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  friendship_status: FriendshipStatus;
  is_online?: boolean;
}

export interface Friend {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  friendship_date: string;
  is_online?: boolean;
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

export type PhotoPrivacy = 'public' | 'friends' | 'private';

export interface Photo {
  id: number;
  user_id: number;
  recipient_id: number | null;
  image_url: string;
  video_url?: string | null;
  media_type?: 'image' | 'video';
  caption: string | null;
  privacy?: PhotoPrivacy;
  created_at: string;
  author_name: string;
  author_username: string;
  author_avatar: string | null;
  recipient_name?: string | null;
  reactions?: PhotoReaction[];
  top_reactions?: PhotoReaction[];
  total_reactions?: number;
  comment_count?: number;
  is_saved?: boolean;
  is_reposted?: boolean;
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

export interface Conversation {
  friend_id: number;
  friend_name: string;
  friend_username: string;
  friend_avatar: string | null;
  last_message_id?: number | null;
  last_message_text?: string | null;
  last_message_image?: string | null;
  last_message_file_url?: string | null;
  last_message_file_name?: string | null;
  last_message_sender_id?: number | null;
  last_message_is_read?: boolean;
  last_message_time?: string | null;
  unread_count: number;
  is_pinned?: boolean;
  is_muted?: boolean;
  is_online?: boolean;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id?: number | null;
  group_id?: number | null;
  message_text: string | null;
  image_url: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
  is_mine: boolean;
}

export interface FileContentData {
  fileName: string;
  fileSize: number;
  fileType: string;
  content: string;
}

export interface ChatHistoryResponse {
  friend: {
    id: number;
    full_name: string;
    username: string;
    avatar_url: string | null;
    is_online?: boolean;
  };
  background_url?: string | null;
  is_pinned?: boolean;
  is_muted?: boolean;
  messages: Message[];
}

export interface GroupMember {
  id: number;
  user_id: number;
  role: 'admin' | 'member';
  joined_at: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  is_me?: boolean;
}

export interface Group {
  id: number;
  name: string;
  avatar_url: string | null;
  background_url?: string | null;
  creator_id: number;
  my_role: 'admin' | 'member';
  member_count: number;
  is_pinned?: boolean;
  is_muted?: boolean;
  last_message?: {
    id: number;
    text: string | null;
    image_url: string | null;
    file_name: string | null;
    file_url: string | null;
    sender_id: number;
    sender_name: string;
    time: string;
  } | null;
  created_at: string;
}

export interface GroupDetail {
  id: number;
  name: string;
  avatar_url: string | null;
  background_url?: string | null;
  creator_id: number;
  created_at: string;
  my_role: 'admin' | 'member';
  member_count: number;
  is_pinned?: boolean;
  is_muted?: boolean;
  members: GroupMember[];
}

export interface UserPrivacySettings {
  is_private_account: boolean;
  allow_suggest_account: boolean;
  searchable_by_name: boolean;
  searchable_by_username: boolean;
  searchable_by_email: boolean;
}

export interface SecurityStatus {
  created_at: string;
  last_password_changed: string | null;
  two_factor_enabled: boolean;
  remember_login: boolean;
  active_session_count: number;
}

export interface LoginSession {
  id: number;
  device_name: string;
  ip_address: string | null;
  last_active: string;
  created_at: string;
  is_active: number;
}

export type NotificationType =
  | 'like_post'
  | 'comment_post'
  | 'reply_comment'
  | 'like_comment'
  | 'friend_request'
  | 'friend_accept'
  | 'group_invite'
  | 'new_post'
  | 'post_deleted';

export interface NotificationItem {
  id: number;
  user_id: number;
  actor_id: number;
  actor_name: string;
  actor_username: string;
  actor_avatar: string | null;
  type: NotificationType;
  entity_id: number | null;
  content: string;
  is_read: boolean;
  created_at: string;
  photo_thumbnail: string | null;
  photo_media_type?: 'image' | 'video' | null;
  friendship_status?: 'pending' | 'accepted' | 'rejected' | null;
}


