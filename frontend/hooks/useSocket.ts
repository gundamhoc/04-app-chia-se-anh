import { useEffect, useState, useCallback } from 'react';
import { getSocket, pingServer } from '../services/socketService';
import { useToast } from '../context/ToastContext';
import { useAppSettings } from '../store/appSettingsStore';
import { usePresenceStore } from '../store/presenceStore';

/**
 * Hook để sử dụng Socket.io trong components
 */
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const socket = getSocket();
  const { showToast } = useToast();
  const { notifyMessages, notifyPosts, notifyInteractions } = useAppSettings();
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);

  const isUserOnline = useCallback(
    (userId: number | undefined | null) => {
      if (!userId) return false;
      return onlineUserIds.includes(Number(userId));
    },
    [onlineUserIds]
  );

  useEffect(() => {
    if (!socket) return;

    let mounted = true;

    const onConnect = () => {
      if (mounted) setIsConnected(true);
    };
    const onDisconnect = () => {
      if (mounted) setIsConnected(false);
    };
    const onConnectError = () => {
      if (mounted) setIsConnected(false);
    };

    // Socket Event Handlers toàn cục cho Toast Notifications (dựa theo cài đặt người dùng)
    // Luồng chuẩn: mọi tương tác có lưu DB (like/comment/kết bạn/ticket/xóa bài) đều bắn 'new_notification'
    // -> Toast duy nhất tại đây để nội dung rõ ràng, tránh double Toast với sự kiện legacy.
    const onNewNotification = (data: {
      notification?: { type?: string; content?: string; actor_name?: string; actor_username?: string };
      unread_count?: number;
    }) => {
      const notif = data?.notification;
      if (!notif) return;
      const type = notif.type || '';

      // Tôn trọng cài đặt người dùng
      if (['like_post', 'like_comment', 'comment_post', 'reply_comment', 'friend_request', 'friend_accept', 'group_invite'].includes(type) && !notifyInteractions) return;
      if (type === 'new_post' && !notifyPosts) return;
      // post_deleted + support_reply là hệ thống quan trọng -> luôn hiện

      const actor = notif.actor_name || notif.actor_username || 'Ai đó';
      const content = notif.content?.trim();
      // Ưu tiên content chi tiết từ backend (đã rõ ràng), fallback sang actor
      const msg = content ? `🔔 ${content}` : `🔔 ${actor} có tương tác mới`;
      const toastType = type === 'friend_accept' ? 'success' : 'info';
      showToast(toastType, msg, 4000);
    };

    const onNewPhoto = (data: { message?: string; author_name?: string }) => {
      if (!notifyPosts) return;
      const msg = data.message || `📸 ${data.author_name || 'Một người bạn'} vừa chia sẻ ảnh mới!`;
      showToast('info', msg, 4000);
    };

    const onInvitedToGroup = (data: { group_name?: string; name?: string; inviter_name?: string; message?: string }) => {
      if (!notifyInteractions) return;
      // BE gửi formattedGroup { id, name, ... } — không có inviter_name/message nên fallback theo shape thực tế
      const groupName = data.group_name || data.name || '';
      const msg =
        data.message ||
        (groupName
          ? `👨‍👩‍👧 ${data.inviter_name || 'Bạn bè'} đã mời bạn vào nhóm ${groupName}`
          : `👨‍👩‍👧 Bạn đã được mời vào một nhóm mới`);
      showToast('info', msg, 4000);
    };

    const onNewDirectMessage = (data: { message?: string; sender_name?: string; text?: string }) => {
      if (!notifyMessages) return;
      const sender = data.sender_name || 'Bạn bè';
      const preview = data.text ? `: "${data.text.slice(0, 30)}${data.text.length > 30 ? '...' : ''}"` : '';
      showToast('info', `💬 ${sender}${preview}`, 3500);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    socket.on('new_notification', onNewNotification);
    socket.on('new_photo_posted', onNewPhoto);
    socket.on('invited_to_group', onInvitedToGroup);
    socket.on('new_direct_message', onNewDirectMessage);

    // Set initial state
    if (mounted) setIsConnected(socket.connected);

    return () => {
      mounted = false;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);

      socket.off('new_notification', onNewNotification);
      socket.off('new_photo_posted', onNewPhoto);
      socket.off('invited_to_group', onInvitedToGroup);
      socket.off('new_direct_message', onNewDirectMessage);
    };
  }, [socket, showToast, notifyMessages, notifyPosts, notifyInteractions]);

  const ping = (callback: (data: { message: string; timestamp: number }) => void) => {
    pingServer(callback);
  };

  return { socket, isConnected, ping, onlineUserIds, isUserOnline };
};
