import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { ColorScheme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { useI18n, formatRelativeTime } from '../utils/i18n';
import { useSocket } from '../hooks/useSocket';
import { notificationService } from '../services/notificationService';
import { friendService } from '../services/friendService';
import { NotificationItem, NotificationType } from '../types';
import { useRouter } from 'expo-router';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPhoto?: (photoId: number) => void;
  onSelectUser?: (userId: number) => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
  onSelectPhoto,
  onSelectUser,
  onUnreadCountChange,
}) => {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const { t, language } = useI18n();
  const { socket } = useSocket();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  // Track which friend requests are being processed
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  // Tải danh sách thông báo
  const loadNotifications = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        const res = await notificationService.getNotifications(1, 30);
        setNotifications(res.notifications);
        setUnreadCount(res.unread_count);
        onUnreadCountChange?.(res.unread_count);
      } catch (err) {
        console.error('Lỗi tải danh sách thông báo:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onUnreadCountChange]
  );

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible, loadNotifications]);

  // Lắng nghe sự kiện socket `new_notification`
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: { notification: NotificationItem; unread_count: number }) => {
      if (data?.notification) {
        setNotifications((prev) => {
          // Tránh trùng ID
          if (prev.some((n) => n.id === data.notification.id)) {
            return prev.map((n) => (n.id === data.notification.id ? data.notification : n));
          }
          return [data.notification, ...prev];
        });
      }
      if (typeof data?.unread_count === 'number') {
        setUnreadCount(data.unread_count);
        onUnreadCountChange?.(data.unread_count);
      }
    };

    socket.on('new_notification', handleNewNotification);
    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket, onUnreadCountChange]);

  // Đánh dấu tất cả đã đọc
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    try {
      setMarkingAll(true);
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      onUnreadCountChange?.(0);
    } catch (err) {
      console.error('Lỗi đánh dấu tất cả thông báo đã đọc:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Đánh dấu 1 thông báo đã đọc
  const handleMarkAsRead = async (item: NotificationItem) => {
    if (!item.is_read) {
      // Cập nhật UI lạc quan
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newCount);
      onUnreadCountChange?.(newCount);

      try {
        await notificationService.markAsRead(item.id);
      } catch (err) {
        console.warn('Lỗi đánh dấu thông báo đã đọc:', err);
      }
    }
  };

  // Chấp nhận lời mời kết bạn ngay từ thông báo
  const handleAcceptFriendRequest = async (item: NotificationItem) => {
    if (processingIds.has(item.id)) return;
    setProcessingIds((prev) => new Set(prev).add(item.id));
    try {
      await friendService.acceptFriendRequest(item.actor_id);
      // Cập nhật thông báo thành đã đọc và xóa khỏi danh sách
      setNotifications((prev) => prev.filter((n) => n.id !== item.id));
      if (!item.is_read) {
        const newCount = Math.max(0, unreadCount - 1);
        setUnreadCount(newCount);
        onUnreadCountChange?.(newCount);
      }
      try { await notificationService.markAsRead(item.id); } catch { /* ignored */ }
    } catch (err) {
      console.warn('Lỗi chấp nhận kết bạn:', err);
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  };

  // Từ chối lời mời kết bạn ngay từ thông báo
  const handleRejectFriendRequest = async (item: NotificationItem) => {
    if (processingIds.has(item.id)) return;
    setProcessingIds((prev) => new Set(prev).add(item.id));
    try {
      await friendService.rejectOrCancelRequest(item.actor_id);
      setNotifications((prev) => prev.filter((n) => n.id !== item.id));
      if (!item.is_read) {
        const newCount = Math.max(0, unreadCount - 1);
        setUnreadCount(newCount);
        onUnreadCountChange?.(newCount);
      }
      try { await notificationService.deleteNotification(item.id); } catch { /* ignored */ }
    } catch (err) {
      console.warn('Lỗi từ chối kết bạn:', err);
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  };

  // Xóa 1 thông báo
  const handleDeleteNotification = async (id: number, isRead: boolean) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (!isRead) {
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newCount);
      onUnreadCountChange?.(newCount);
    }
    try {
      await notificationService.deleteNotification(id);
    } catch (err) {
      console.warn('Lỗi xóa thông báo:', err);
    }
  };

  // Nhấn vào thông báo để điều hướng
  const handleNotificationPress = async (item: NotificationItem) => {
    await handleMarkAsRead(item);
    onClose();

    // Điều hướng theo loại thông báo
    if (['like_post', 'comment_post', 'reply_comment'].includes(item.type) && item.entity_id) {
      if (onSelectPhoto) {
        onSelectPhoto(item.entity_id);
      } else {
        router.push({
          pathname: '/',
          params: { highlightPhotoId: item.entity_id.toString() },
        });
      }
    } else if (['friend_request', 'friend_accept'].includes(item.type) && item.actor_id) {
      if (onSelectUser) {
        onSelectUser(item.actor_id);
      } else {
        router.push({
          pathname: '/user/[id]',
          params: { id: item.actor_id.toString() },
        });
      }
    }
  };

  // Icon biểu tượng & màu sắc theo loại tương tác
  const getTypeBadge = (type: NotificationType) => {
    switch (type) {
      case 'like_post':
        return { icon: '❤️', bg: '#ef4444' };
      case 'comment_post':
        return { icon: '💬', bg: '#3b82f6' };
      case 'reply_comment':
        return { icon: '↩️', bg: '#8b5cf6' };
      case 'like_comment':
        return { icon: '🔥', bg: '#f97316' };
      case 'friend_request':
        return { icon: '👥', bg: '#10b981' };
      case 'friend_accept':
        return { icon: '🎉', bg: '#ec4899' };
      default:
        return { icon: '🔔', bg: C.primary };
    }
  };

  // Lời giải thích hành động tương tác đa ngôn ngữ
  const getActionText = (type: NotificationType): string => {
    switch (type) {
      case 'like_post':
        return t('notifications_like_post');
      case 'comment_post':
        return t('notifications_comment_post');
      case 'reply_comment':
        return t('notifications_reply_comment');
      case 'like_comment':
        return t('notifications_like_comment');
      case 'friend_request':
        return t('notifications_friend_request');
      case 'friend_accept':
        return t('notifications_friend_accept');
      case 'group_invite':
        return t('notifications_group_invite');
      default:
        return '';
    }
  };

  const renderNotificationItem = ({ item }: { item: NotificationItem }) => {
    const badge = getTypeBadge(item.type);
    const actionText = getActionText(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          !item.is_read && styles.itemUnread,
        ]}
        activeOpacity={0.7}
        onPress={() => handleNotificationPress(item)}
      >
        {/* Avatar + Badge icon */}
        <View style={styles.avatarWrapper}>
          <Image
            source={{
              uri:
                item.actor_avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
            }}
            style={styles.avatar}
            resizeMode="cover"
            {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as any) : {})}
          />
          <View style={[styles.typeBadgeCircle, { backgroundColor: badge.bg }]}>
            <Text style={styles.typeBadgeIcon}>{badge.icon}</Text>
          </View>
        </View>

        {/* Nội dung thông báo */}
        <View style={styles.contentWrapper}>
          <Text style={styles.actionText} numberOfLines={2}>
            <Text style={styles.actorName}>{item.actor_name || item.actor_username}</Text>{' '}
            {actionText}
          </Text>

          {/* Trích dẫn nội dung cho các loại thông báo có content */}
          {item.content && (item.type === 'comment_post' || item.type === 'reply_comment' || item.type === 'like_comment') ? (
            <Text style={styles.quoteText} numberOfLines={1}>
              "{item.content}"
            </Text>
          ) : null}

          {/* Nút Chấp nhận / Từ chối cho lời mời kết bạn */}
          {item.type === 'friend_request' ? (
            <View style={styles.friendActionRow}>
              <TouchableOpacity
                style={styles.friendAcceptBtn}
                onPress={(e) => { e.stopPropagation?.(); handleAcceptFriendRequest(item); }}
                disabled={processingIds.has(item.id)}
                activeOpacity={0.8}
              >
                {processingIds.has(item.id) ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.friendAcceptText}>✓ Chấp nhận</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.friendRejectBtn}
                onPress={(e) => { e.stopPropagation?.(); handleRejectFriendRequest(item); }}
                disabled={processingIds.has(item.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.friendRejectText}>✕ Từ chối</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>
              {formatRelativeTime(item.created_at, language)}
            </Text>
            {!item.is_read ? <View style={styles.unreadDot} /> : null}
          </View>
        </View>

        {/* Thumbnail bài viết (nếu có) */}
        {item.photo_thumbnail ? (
          <View style={styles.thumbnailContainer}>
            <Image
              source={{ uri: item.photo_thumbnail }}
              style={styles.thumbnail}
              resizeMode="cover"
              {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as any) : {})}
            />
            {item.photo_media_type === 'video' ? (
              <View style={styles.videoIndicator}>
                <Text style={styles.videoIndicatorIcon}>▶</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Nút xóa thông báo (chỉ hiện với non-friend_request) */}
        {item.type !== 'friend_request' ? (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteNotification(item.id, item.is_read)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('notifications_delete')}
          >
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>🔔 {t('notifications_title')}</Text>
              {unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.headerActions}>
              {unreadCount > 0 ? (
                <TouchableOpacity
                  style={styles.markAllBtn}
                  onPress={handleMarkAllAsRead}
                  disabled={markingAll}
                >
                  {markingAll ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : (
                    <Text style={styles.markAllBtnText}>✓ {t('notifications_mark_all_read')}</Text>
                  )}
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* List Content */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={C.primary} />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>{t('notifications_empty')}</Text>
              <Text style={styles.emptyDesc}>{t('notifications_empty_desc')}</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderNotificationItem}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadNotifications(true);
                  }}
                  tintColor={C.primary}
                  colors={[C.primary]}
                />
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (C: ColorScheme, isDark: boolean) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      height: '84%',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#1e293b' : '#f1f5f9',
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: C.text,
    },
    unreadBadge: {
      backgroundColor: '#ef4444',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 12,
    },
    unreadBadgeText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    markAllBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
    },
    markAllBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: C.primary,
    },
    closeBtn: {
      padding: 4,
    },
    closeBtnText: {
      fontSize: 20,
      color: C.textMuted,
      fontWeight: '600',
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 36,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16,
      opacity: 0.6,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyDesc: {
      fontSize: 13,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
    listContent: {
      paddingVertical: 8,
    },
    itemContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
    },
    itemUnread: {
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.05)',
    },
    avatarWrapper: {
      position: 'relative',
      marginRight: 12,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
    },
    typeBadgeCircle: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: isDark ? '#0f172a' : '#ffffff',
    },
    typeBadgeIcon: {
      fontSize: 10,
    },
    contentWrapper: {
      flex: 1,
      marginRight: 10,
    },
    actionText: {
      fontSize: 14,
      color: C.text,
      lineHeight: 19,
    },
    actorName: {
      fontWeight: '700',
      color: C.text,
    },
    quoteText: {
      fontSize: 12,
      color: C.textMuted,
      fontStyle: 'italic',
      marginTop: 2,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 6,
    },
    timeText: {
      fontSize: 12,
      color: C.textMuted,
    },
    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: C.primary,
    },
    thumbnailContainer: {
      position: 'relative',
      marginRight: 8,
    },
    thumbnail: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
    },
    videoIndicator: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: 8,
    },
    videoIndicatorIcon: {
      color: '#ffffff',
      fontSize: 10,
    },
    deleteBtn: {
      padding: 6,
      opacity: 0.6,
    },
    deleteBtnText: {
      fontSize: 14,
      color: C.textMuted,
      fontWeight: '600',
    },
    friendActionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    friendAcceptBtn: {
      flex: 1,
      backgroundColor: C.primary,
      paddingVertical: 7,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    friendAcceptText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
    friendRejectBtn: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      paddingVertical: 7,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
    },
    friendRejectText: {
      color: C.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
  });
