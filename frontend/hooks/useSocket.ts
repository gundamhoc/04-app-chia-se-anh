import { useEffect, useState } from 'react';
import { getSocket, pingServer } from '../services/socketService';
import { useToast } from '../context/ToastContext';
import { useAppSettings } from '../store/appSettingsStore';

/**
 * Hook để sử dụng Socket.io trong components
 */
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const socket = getSocket();
  const { showToast } = useToast();
  const { notifyMessages, notifyPosts, notifyInteractions } = useAppSettings();

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
    const onNewPhoto = (data: { message?: string; author_name?: string }) => {
      if (!notifyPosts) return;
      const msg = data.message || `📸 ${data.author_name || 'Một người bạn'} vừa chia sẻ ảnh mới!`;
      showToast('info', msg, 4000);
    };

    const onFriendRequest = (data: { message?: string; sender_name?: string }) => {
      const msg = data.message || `👥 ${data.sender_name || 'Một người bạn'} đã gửi lời mời kết bạn!`;
      showToast('info', msg, 4000);
    };

    const onFriendAccept = (data: { message?: string; user_name?: string }) => {
      const msg = data.message || `🎉 ${data.user_name || 'Một người bạn'} đã chấp nhận kết bạn!`;
      showToast('success', msg, 4000);
    };

    const onPhotoReaction = (data: { message?: string; actor_name?: string; emoji?: string }) => {
      if (!notifyInteractions) return;
      const msg = data.message || `❤️ ${data.actor_name || 'Bạn bè'} đã thả cảm xúc vào ảnh của bạn!`;
      showToast('info', msg, 3500);
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

    socket.on('new_photo_posted', onNewPhoto);
    socket.on('friend_request_received', onFriendRequest);
    socket.on('friend_request_accepted', onFriendAccept);
    socket.on('photo_reaction_updated', onPhotoReaction);
    socket.on('new_direct_message', onNewDirectMessage);

    // Set initial state
    if (mounted) setIsConnected(socket.connected);

    return () => {
      mounted = false;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);

      socket.off('new_photo_posted', onNewPhoto);
      socket.off('friend_request_received', onFriendRequest);
      socket.off('friend_request_accepted', onFriendAccept);
      socket.off('photo_reaction_updated', onPhotoReaction);
      socket.off('new_direct_message', onNewDirectMessage);
    };
  }, [socket, showToast, notifyMessages, notifyPosts, notifyInteractions]);

  const ping = (callback: (data: { message: string; timestamp: number }) => void) => {
    pingServer(callback);
  };

  return { socket, isConnected, ping };
};
