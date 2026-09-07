import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ColorScheme } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../utils/i18n';
import { groupService } from '../../services/groupService';
import { friendService } from '../../services/friendService';
import { messageService } from '../../services/messageService';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { FileViewerModal } from '../../components/FileViewerModal';
import { Message, GroupDetail, Friend, Photo } from '../../types';

const PRESET_THEMES = [
  { id: 'cosmic', name: 'Vũ trụ huyền ảo', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000&auto=format&fit=crop' },
  { id: 'cyberpunk', name: 'Neon Cyberpunk', url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1000&auto=format&fit=crop' },
  { id: 'aurora', name: 'Cực quang Emerald', url: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?q=80&w=1000&auto=format&fit=crop' },
  { id: 'sunset', name: 'Hoàng hôn Chill', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1000&auto=format&fit=crop' },
  { id: 'dark_matter', name: 'Màn đêm Tối giản', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000&auto=format&fit=crop' },
];

export default function GroupChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { showToast, ToastComponent } = useToast();
  const { colors: C, isDark } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = parseInt(params.id, 10);

  // States dữ liệu
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  // Plus menu & tệp tin đính kèm
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    isImage: boolean;
    mimeType?: string;
    size?: number;
  } | null>(null);

  // Modals xem file, ảnh & info
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedPhotoForViewer, setSelectedPhotoForViewer] = useState<Photo | null>(null);
  const [fileViewerVisible, setFileViewerVisible] = useState(false);
  const [activeFileViewerMessage, setActiveFileViewerMessage] = useState<Message | null>(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);

  // Thêm thành viên modal
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [availableFriends, setAvailableFriends] = useState<Friend[]>([]);
  const [selectedNewFriendIds, setSelectedNewFriendIds] = useState<number[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);

  // Avatar & Theme States
  const [avatarActionModalVisible, setAvatarActionModalVisible] = useState(false);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [updatingBackground, setUpdatingBackground] = useState(false);

  // Trạng thái Ghim & Tắt thông báo nhóm
  const [isPinned, setIsPinned] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Trạng thái Tìm kiếm tin nhắn nhóm
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchMatches, setSearchMatches] = useState<Message[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Tải thông tin nhóm và tin nhắn
  const loadGroupData = useCallback(async () => {
    if (isNaN(groupId)) return;
    try {
      const [detail, msgs] = await Promise.all([
        groupService.getGroupDetail(groupId),
        groupService.getGroupMessages(groupId),
      ]);
      setGroup(detail);
      setMessages(msgs);
      if (detail.is_pinned !== undefined) {
        setIsPinned(Boolean(detail.is_pinned));
      }
      if (detail.is_muted !== undefined) {
        setIsMuted(Boolean(detail.is_muted));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Không thể tải tin nhắn nhóm.';
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  // 2. Tham gia socket room của nhóm
  useEffect(() => {
    if (!socket || isNaN(groupId)) return;

    socket.emit('join_group', { groupId });

    // Lắng nghe tin nhắn mới trong nhóm
    const handleNewGroupMessage = (msg: Message) => {
      if (msg.group_id === groupId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, { ...msg, is_mine: msg.sender_id === user?.id }];
        });
        setTimeout(() => scrollToBottom(true), 80);
      }
    };

    // Lắng nghe người khác đang soạn tin
    const handleGroupTyping = (data: { groupId: number; userId: number; userName: string; isTyping: boolean }) => {
      if (data.groupId === groupId && data.userId !== user?.id) {
        if (data.isTyping) {
          setTypingUser(data.userName);
        } else {
          setTypingUser(null);
        }
      }
    };

    // Lắng nghe cập nhật nhóm
    const handleGroupUpdated = () => {
      loadGroupData();
    };

    socket.on('new_group_message', handleNewGroupMessage);
    socket.on('user_group_typing', handleGroupTyping);
    socket.on('group_updated', handleGroupUpdated);
    socket.on('group_members_updated', handleGroupUpdated);

    return () => {
      socket.emit('leave_group', { groupId });
      socket.off('new_group_message', handleNewGroupMessage);
      socket.off('user_group_typing', handleGroupTyping);
      socket.off('group_updated', handleGroupUpdated);
      socket.off('group_members_updated', handleGroupUpdated);
    };
  }, [socket, groupId, user?.id, loadGroupData]);

  // Cuộn danh sách xuống cuối
  const scrollToBottom = (animated = true) => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated });
    }
  };

  // Typing event
  const handleTyping = (text: string) => {
    setInputText(text);
    if (!socket || isNaN(groupId)) return;

    if (!isTyping && text.trim().length > 0) {
      setIsTyping(true);
      socket.emit('group_typing_start', { groupId, userName: user?.full_name || user?.username });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('group_typing_stop', { groupId });
    }, 1500);
  };

  // Chọn ảnh camera
  const handlePickCamera = async () => {
    setShowPlusMenu(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast('error', 'Cần cấp quyền máy ảnh để chụp ảnh.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: `camera_${Date.now()}.jpg`,
          isImage: true,
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (e) {
      console.warn('Camera error:', e);
    }
  };

  // Chọn ảnh thư viện
  const handlePickLibrary = async () => {
    setShowPlusMenu(false);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          isImage: true,
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (e) {
      console.warn('Library error:', e);
    }
  };

  // Chọn tệp tin bất kỳ
  const handlePickDocument = async () => {
    setShowPlusMenu(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        const isImg = asset.mimeType ? asset.mimeType.startsWith('image/') : false;
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          isImage: isImg,
          mimeType: asset.mimeType,
          size: asset.size,
        });
      }
    } catch (e) {
      console.warn('Doc picker error:', e);
    }
  };

  // Gửi tin nhắn
  const handleSend = async () => {
    if (sending) return;
    const textToSend = inputText.trim();
    const fileToSend = selectedFile;

    if (!textToSend && !fileToSend) return;

    setSending(true);
    setInputText('');
    setSelectedFile(null);
    setShowPlusMenu(false);

    try {
      if (fileToSend) {
        if (fileToSend.isImage) {
          await groupService.sendGroupImage(groupId, fileToSend.uri, textToSend || undefined);
        } else {
          await groupService.sendGroupFile(
            groupId,
            fileToSend.uri,
            fileToSend.name,
            fileToSend.mimeType,
            textToSend || undefined
          );
        }
      } else {
        await groupService.sendGroupMessage(groupId, textToSend);
      }
      setTimeout(() => scrollToBottom(true), 100);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Không thể gửi tin nhắn.';
      showToast('error', msg);
    } finally {
      setSending(false);
    }
  };

  // Format kích thước file
  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Kiểm tra file có đọc được code/text
  const isReadableTextOrCode = (msg: Message) => {
    const name = (msg.file_name || '').toLowerCase();
    const codeExts = [
      '.txt', '.js', '.ts', '.tsx', '.jsx', '.json', '.py', '.c', '.cpp', '.cs',
      '.html', '.css', '.md', '.sql', '.java', '.xml', '.yaml', '.yml', '.sh',
    ];
    return codeExts.some((ext) => name.endsWith(ext));
  };

  const getFileEmoji = (name?: string | null) => {
    if (!name) return '📁';
    const ext = name.split('.').pop()?.toLowerCase();
    if (['js', 'ts', 'py', 'c', 'cpp', 'html', 'css', 'json', 'sql'].includes(ext || '')) return '💻';
    if (['pdf'].includes(ext || '')) return '📕';
    if (['zip', 'rar', '7z'].includes(ext || '')) return '📦';
    if (['doc', 'docx'].includes(ext || '')) return '📘';
    if (['xls', 'xlsx'].includes(ext || '')) return '📊';
    return '📁';
  };

  // Xem ảnh full
  const openImageViewer = (msg: Message) => {
    const targetUrl = msg.image_url || msg.file_url;
    if (!targetUrl) return;

    const photoModel: Photo = {
      id: msg.id,
      user_id: msg.sender_id,
      recipient_id: 0,
      image_url: targetUrl,
      caption: msg.message_text,
      created_at: msg.created_at,
      author_name: msg.sender_name || 'Thành viên',
      author_username: '',
      author_avatar: msg.sender_avatar || null,
    };
    setSelectedPhotoForViewer(photoModel);
    setViewerVisible(true);
  };

  // Chạm vào tệp tin
  const handleFilePress = (msg: Message) => {
    if (msg.image_url) {
      openImageViewer(msg);
      return;
    }
    if (isReadableTextOrCode(msg)) {
      setActiveFileViewerMessage(msg);
      setFileViewerVisible(true);
      return;
    }
    showToast('info', 'Tệp tin này không hỗ trợ đọc trực tiếp. Vui lòng bấm nút Tải về (⬇️) để mở!');
  };

  // Tải file
  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      showToast('info', `Đang tải ${fileName}...`);
      await messageService.downloadFile(fileUrl, fileName);
      showToast('success', `Đã tải ${fileName} thành công!`);
    } catch {
      showToast('error', 'Không thể tải tệp tin.');
    }
  };

  // Mở modal thêm thành viên
  const openAddMemberModal = async () => {
    try {
      const allFriends = await friendService.getFriendsList();
      const existingUserIds = (group?.members || []).map((m) => m.user_id);
      const candidates = allFriends.filter((f) => !existingUserIds.includes(f.id));
      setAvailableFriends(candidates);
      setSelectedNewFriendIds([]);
      setAddMemberModalVisible(true);
    } catch (e) {
      console.warn('Lỗi lấy danh sách bạn bè:', e);
    }
  };

  // Đổi avatar nhóm (Camera / Thư viện)
  const handlePickAvatar = async (source: 'camera' | 'library') => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showToast('error', 'Cần quyền truy cập máy ảnh để chụp ảnh.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showToast('error', 'Cần quyền truy cập thư viện ảnh.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUpdatingAvatar(true);
        showToast('info', 'Đang tải lên avatar nhóm...');
        await groupService.updateGroupAvatar(groupId, result.assets[0].uri);
        showToast('success', 'Đã đổi ảnh đại diện nhóm! 📸');
        await loadGroupData();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Không thể cập nhật avatar nhóm.';
      showToast('error', msg);
    } finally {
      setUpdatingAvatar(false);
    }
  };

  // Đổi hình nền nhóm từ Camera hoặc Thư viện
  const handlePickBackground = async (source: 'camera' | 'library') => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showToast('error', 'Cần quyền truy cập máy ảnh để chụp ảnh.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.85,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showToast('error', 'Cần quyền truy cập thư viện ảnh.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUpdatingBackground(true);
        showToast('info', 'Đang tải lên hình nền nhóm...');
        await groupService.updateGroupBackground(groupId, result.assets[0].uri);
        showToast('success', 'Đã thiết lập hình nền nhóm thành công! 🎨');
        await loadGroupData();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Không thể cập nhật hình nền nhóm.';
      showToast('error', msg);
    } finally {
      setUpdatingBackground(false);
    }
  };

  // Áp dụng Preset Background
  const handleSelectPresetBackground = async (presetUrl: string) => {
    try {
      setUpdatingBackground(true);
      await groupService.setGroupPresetBackground(groupId, presetUrl);
      showToast('success', 'Đã thay đổi giao diện hình nền! ✨');
      await loadGroupData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Không thể áp dụng hình nền.';
      showToast('error', msg);
    } finally {
      setUpdatingBackground(false);
    }
  };

  // Gỡ bỏ hình nền nhóm
  const handleRemoveBackground = async () => {
    try {
      setUpdatingBackground(true);
      await groupService.removeGroupBackground(groupId);
      showToast('info', 'Đã gỡ hình nền nhóm về mặc định.');
      await loadGroupData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Không thể gỡ hình nền.';
      showToast('error', msg);
    } finally {
      setUpdatingBackground(false);
    }
  };

  // Bật/Tắt Ghim nhóm
  const handleTogglePin = async () => {
    try {
      const next = !isPinned;
      const res = await groupService.toggleGroupPin(groupId, next);
      setIsPinned(res);
      showToast('success', res ? 'Đã ghim nhóm lên đầu! 📌' : 'Đã bỏ ghim nhóm.');
    } catch {
      showToast('error', 'Không thể ghim nhóm.');
    }
  };

  // Bật/Tắt Thông báo nhóm
  const handleToggleMute = async () => {
    try {
      const next = !isMuted;
      const res = await groupService.toggleGroupMute(groupId, next);
      setIsMuted(res);
      showToast('success', res ? 'Đã tắt thông báo nhóm! 🔕' : 'Đã bật thông báo nhóm! 🔔');
    } catch {
      showToast('error', 'Không thể đổi thông báo nhóm.');
    }
  };

  // Tìm kiếm tin nhắn trong nhóm
  const handleSearchChange = (kw: string) => {
    setSearchKeyword(kw);
    if (!kw.trim()) {
      setSearchMatches([]);
      setActiveMatchIndex(0);
      setHighlightedMessageId(null);
      return;
    }
    const lower = kw.trim().toLowerCase();
    const matched = messages.filter(
      (m) =>
        (m.message_text && m.message_text.toLowerCase().includes(lower)) ||
        (m.file_name && m.file_name.toLowerCase().includes(lower))
    );
    setSearchMatches(matched);
    setActiveMatchIndex(0);
    if (matched.length > 0) {
      jumpToMatch(matched[0]);
    } else {
      setHighlightedMessageId(null);
    }
  };

  const jumpToMatch = (targetMsg: Message) => {
    setHighlightedMessageId(targetMsg.id);
    const idx = messages.findIndex((m) => m.id === targetMsg.id);
    if (idx >= 0) {
      flatListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5,
      });
    }
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = activeMatchIndex > 0 ? activeMatchIndex - 1 : searchMatches.length - 1;
    setActiveMatchIndex(prevIdx);
    jumpToMatch(searchMatches[prevIdx]);
  };

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = activeMatchIndex < searchMatches.length - 1 ? activeMatchIndex + 1 : 0;
    setActiveMatchIndex(nextIdx);
    jumpToMatch(searchMatches[nextIdx]);
  };

  const handleCloseSearch = () => {
    setShowSearchBar(false);
    setSearchKeyword('');
    setSearchMatches([]);
    setActiveMatchIndex(0);
    setHighlightedMessageId(null);
  };

  // Xác nhận thêm thành viên
  const handleConfirmAddMembers = async () => {
    if (selectedNewFriendIds.length === 0) return;
    setAddingMembers(true);
    try {
      await groupService.addMembers(groupId, selectedNewFriendIds);
      showToast('success', 'Đã thêm thành viên vào nhóm!');
      setAddMemberModalVisible(false);
      loadGroupData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Không thể thêm thành viên.';
      showToast('error', msg);
    } finally {
      setAddingMembers(false);
    }
  };

  // Xóa thành viên hoặc Rời nhóm
  const handleRemoveOrLeave = (targetUserId: number, isSelf: boolean) => {
    Alert.alert(
      isSelf ? 'Rời khỏi nhóm' : 'Xóa thành viên',
      isSelf ? 'Bạn có chắc chắn muốn rời khỏi nhóm này?' : 'Bạn có chắc chắn muốn xóa thành viên này khỏi nhóm?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: isSelf ? 'Rời nhóm' : 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupService.removeMember(groupId, targetUserId);
              if (isSelf) {
                setInfoModalVisible(false);
                router.replace('/(tabs)/messages');
              } else {
                showToast('success', 'Đã xóa thành viên khỏi nhóm.');
                loadGroupData();
              }
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Không thể thực hiện yêu cầu.';
              showToast('error', msg);
            }
          },
        },
      ]
    );
  };

  // Render từng tin nhắn nhóm
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMine = item.is_mine || item.sender_id === user?.id;
    const isImg = Boolean(item.image_url);
    const hasFile = Boolean(item.file_url || item.image_url);

    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}>
        {!isMine && (
          <Image
            source={
              item.sender_avatar
                ? { uri: item.sender_avatar }
                : require('../../assets/splash-icon.png')
            }
            style={styles.senderAvatar}
            {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
          />
        )}

        <View
          style={[
            styles.bubbleBox,
            isMine ? styles.bubbleMine : styles.bubbleOther,
            item.id === highlightedMessageId && styles.bubbleHighlighted,
          ]}
        >
          {/* Tên người gửi trong nhóm (đối với tin nhắn của người khác) */}
          {!isMine && (
            <Text style={styles.senderNameTag}>{item.sender_name || t('group_member')}</Text>
          )}

          {/* Trường hợp: Tin nhắn là ảnh */}
          {isImg && (
            <TouchableOpacity activeOpacity={0.9} onPress={() => openImageViewer(item)} style={styles.imageWrapper}>
              <Image
                source={{ uri: item.image_url! }}
                style={styles.messageImage}
                resizeMode="cover"
                {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
              />
              <View style={styles.imageMetaBadge}>
                <View style={styles.imageMetaLeft}>
                  <Text style={styles.imageZoomHint}>🔍 {t('zoom_hint')}</Text>
                  {item.file_size ? <Text style={styles.imageSizeText}>• {formatFileSize(item.file_size)}</Text> : null}
                </View>
                {item.file_url && (
                  <TouchableOpacity
                    style={styles.downloadIconBtn}
                    onPress={() => handleDownload(item.file_url!, item.file_name || 'image.jpg')}
                  >
                    <Text style={styles.downloadIconText}>⬇️</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* Trường hợp: Tin nhắn là tệp tin */}
          {!isImg && hasFile && (
            <TouchableOpacity
              style={[styles.fileCard, isMine ? styles.fileCardMine : styles.fileCardOther]}
              activeOpacity={0.8}
              onPress={() => handleFilePress(item)}
            >
              <View style={[styles.fileCardIconBox, isMine ? styles.fileCardIconBoxMine : styles.fileCardIconBoxOther]}>
                <Text style={styles.fileCardEmoji}>{getFileEmoji(item.file_name)}</Text>
              </View>
              <View style={styles.fileCardInfo}>
                <Text
                  style={[styles.fileCardName, isMine ? styles.fileCardNameMine : styles.fileCardNameOther]}
                  numberOfLines={1}
                >
                  {item.file_name || t('readable_file')}
                </Text>
                <View style={styles.fileCardMetaRow}>
                  {item.file_size ? (
                    <Text style={[styles.fileCardSize, isMine ? styles.fileCardSizeMine : styles.fileCardSizeOther]}>
                      {formatFileSize(item.file_size)}
                    </Text>
                  ) : null}
                  {isReadableTextOrCode(item) && (
                    <View style={[styles.readableBadge, isMine ? styles.readableBadgeMine : styles.readableBadgeOther]}>
                      <Text style={[styles.readableBadgeText, isMine ? styles.readableBadgeTextMine : styles.readableBadgeTextOther]}>
                        📖 {t('readable_file')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.fileCardDownloadBtn, isMine ? styles.fileCardDownloadBtnMine : styles.fileCardDownloadBtnOther]}
                onPress={() => handleDownload(item.file_url!, item.file_name || 'file')}
              >
                <Text style={styles.downloadEmoji}>⬇️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {/* Nội dung văn bản */}
          {Boolean(item.message_text) && (
            <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextOther]}>
              {item.message_text}
            </Text>
          )}

          {/* Giờ gửi */}
          <Text style={[styles.msgTime, isMine ? styles.msgTimeMine : styles.msgTimeOther]}>
            {item.created_at ? new Date(item.created_at).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ToastComponent />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerTitleArea} onPress={() => setInfoModalVisible(true)} activeOpacity={0.8}>
          <Image
            source={
              group?.avatar_url
                ? { uri: group.avatar_url }
                : require('../../assets/splash-icon.png')
            }
            style={styles.headerAvatar}
            {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
          />
          <View style={styles.headerTextGroup}>
            <View style={styles.headerTitleRow}>
              {isPinned && <Text style={styles.headerPinIcon}>📌</Text>}
              <Text style={styles.groupTitleText} numberOfLines={1}>
                {group?.name || t('group_chat_section')}
              </Text>
              {isMuted && <Text style={styles.headerMuteIcon}>🔕</Text>}
            </View>
            <Text style={styles.groupSubText}>
              👥 {group?.member_count || 1} {t('members')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Nút Cài Đặt Nhóm (Bánh răng ⚙️ gom đủ các chức năng) */}
        <View style={styles.headerActionsGroup}>
          <TouchableOpacity
            style={[styles.infoActionBtn, (isPinned || isMuted) && styles.infoActionBtnActive]}
            onPress={() => setInfoModalVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={styles.infoActionIcon}>⚙️</Text>
            {(isPinned || isMuted) && <View style={styles.headerSettingsDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* 1.5. Thanh Tìm Kiếm Tin Nhắn In-Chat */}
      {showSearchBar && (
        <View style={styles.chatSearchBar}>
          <Text style={styles.chatSearchIcon}>🔍</Text>
          <TextInput
            style={styles.chatSearchInput}
            placeholder={t('search_in_group')}
            placeholderTextColor={C.textMuted}
            value={searchKeyword}
            onChangeText={handleSearchChange}
            autoFocus
          />
          {searchMatches.length > 0 ? (
            <View style={styles.searchMatchCounter}>
              <Text style={styles.searchMatchText}>
                {activeMatchIndex + 1}/{searchMatches.length}
              </Text>
            </View>
          ) : searchKeyword.trim().length > 0 ? (
            <View style={styles.searchMatchCounter}>
              <Text style={[styles.searchMatchText, { color: '#FF7070' }]}>0 {t('zero_results')}</Text>
            </View>
          ) : null}
          {searchMatches.length > 0 && (
            <View style={styles.searchNavButtons}>
              <TouchableOpacity
                style={styles.searchNavBtn}
                onPress={handlePrevMatch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.searchNavArrow}>▲</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchNavBtn}
                onPress={handleNextMatch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.searchNavArrow}>▼</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={styles.closeSearchBtn}
            onPress={handleCloseSearch}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.closeSearchText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Chat Area with Keyboard Avoiding */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {/* Hình nền phòng chat (Theme Background) */}
        {Boolean(group?.background_url) && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image
              source={{ uri: group!.background_url! }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            {/* Lớp phủ mờ tối bảo vệ độ tương phản chữ và tin nhắn */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 15, 26, 0.72)' }]} />
          </View>
        )}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>{t('loading')}</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessageItem}
            contentContainerStyle={[styles.messagesListContent, { paddingBottom: 16 }]}
            onContentSizeChange={() => scrollToBottom(true)}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 }), 100);
            }}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>👥✨</Text>
                <Text style={styles.emptyTitle}>{t('welcome_chat_title')}</Text>
                <Text style={styles.emptyDesc}>{t('welcome_chat_desc')}</Text>
              </View>
            }
          />
        )}

        {/* Typing Banner */}
        {Boolean(typingUser) && (
          <View style={styles.typingBanner}>
            <Text style={styles.typingBannerText}>{typingUser} {t('typing_status')}</Text>
          </View>
        )}

        {/* Attachment preview bar */}
        {selectedFile && (
          <View style={styles.attachmentPreviewBar}>
            <View style={styles.previewThumbBox}>
              {selectedFile.isImage ? (
                <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} />
              ) : (
                <Text style={styles.previewFileEmoji}>{getFileEmoji(selectedFile.name)}</Text>
              )}
              <TouchableOpacity style={styles.removeAttachBtn} onPress={() => setSelectedFile(null)}>
                <Text style={styles.removeAttachText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewName} numberOfLines={1}>{selectedFile.name}</Text>
              <Text style={styles.previewSize}>{formatFileSize(selectedFile.size)}</Text>
            </View>
          </View>
        )}

        {/* Plus Action Menu Popup */}
        {showPlusMenu && (
          <View style={styles.plusMenuPopup}>
            <TouchableOpacity style={styles.plusMenuItem} onPress={handlePickCamera}>
              <View style={[styles.plusMenuIconBox, { backgroundColor: '#FF6B6B' }]}>
                <Text style={styles.plusMenuEmoji}>📷</Text>
              </View>
              <Text style={styles.plusMenuLabel}>{t('take_photo')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.plusMenuItem} onPress={handlePickLibrary}>
              <View style={[styles.plusMenuIconBox, { backgroundColor: '#4ECDC4' }]}>
                <Text style={styles.plusMenuEmoji}>🖼️</Text>
              </View>
              <Text style={styles.plusMenuLabel}>{t('photo_library')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.plusMenuItem} onPress={handlePickDocument}>
              <View style={[styles.plusMenuIconBox, { backgroundColor: '#6C63FF' }]}>
                <Text style={styles.plusMenuEmoji}>📁</Text>
              </View>
              <Text style={styles.plusMenuLabel}>{t('choose_file')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Input Row */}
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.plusBtn, showPlusMenu && styles.plusBtnActive]}
            onPress={() => setShowPlusMenu(!showPlusMenu)}
          >
            <Text style={[styles.plusBtnText, showPlusMenu && styles.plusBtnTextActive]}>＋</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.chatInput}
            placeholder={t('type_group_message')}
            placeholderTextColor="#8A8A9E"
            value={inputText}
            onChangeText={handleTyping}
            multiline
            maxLength={2000}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() && !selectedFile) || sending ? styles.sendBtnDisabled : undefined,
            ]}
            onPress={handleSend}
            disabled={(!inputText.trim() && !selectedFile) || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendBtnText}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ImageViewerModal */}
      <ImageViewerModal
        visible={viewerVisible}
        photo={selectedPhotoForViewer}
        onClose={() => {
          setViewerVisible(false);
          setSelectedPhotoForViewer(null);
        }}
      />

      {/* FileViewerModal */}
      <FileViewerModal
        visible={fileViewerVisible}
        messageId={activeFileViewerMessage?.id || null}
        fileName={activeFileViewerMessage?.file_name || null}
        fileSize={activeFileViewerMessage?.file_size || null}
        fileUrl={activeFileViewerMessage?.file_url || null}
        onClose={() => {
          setFileViewerVisible(false);
          setActiveFileViewerMessage(null);
        }}
        onDownload={handleDownload}
      />

      {/* Group Info Modal */}
      <Modal visible={infoModalVisible} transparent animationType="slide" onRequestClose={() => setInfoModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalCard}>
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle}>{t('group_info')} 👥</Text>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                <Text style={styles.infoModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.groupCardBanner}>
              <View style={styles.avatarWrapper}>
                <Image
                  source={
                    group?.avatar_url
                      ? { uri: group.avatar_url }
                      : require('../../assets/splash-icon.png')
                  }
                  style={styles.groupBannerAvatar}
                />
                <TouchableOpacity
                  style={styles.avatarCameraBtn}
                  onPress={() => setAvatarActionModalVisible(true)}
                  disabled={updatingAvatar}
                  activeOpacity={0.8}
                >
                  {updatingAvatar ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.avatarCameraIcon}>📷</Text>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.groupBannerName}>{group?.name}</Text>
              <Text style={styles.groupBannerCount}>{group?.member_count} {t('members')}</Text>
            </View>

            {/* Quick Controls: Tìm kiếm, Ghim & Thông báo */}
            <View style={styles.groupQuickControls}>
              <TouchableOpacity
                style={styles.groupQuickBtn}
                onPress={() => {
                  setInfoModalVisible(false);
                  setTimeout(() => {
                    setShowSearchBar(true);
                  }, 250);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.groupQuickIcon}>🔍</Text>
                <Text style={styles.groupQuickText}>{t('search')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.groupQuickBtn, isPinned && styles.groupQuickBtnActive]}
                onPress={handleTogglePin}
                activeOpacity={0.8}
              >
                <Text style={styles.groupQuickIcon}>📌</Text>
                <Text style={styles.groupQuickText}>{isPinned ? t('pinned') : t('pin_group')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.groupQuickBtn, isMuted && styles.groupQuickBtnMuted]}
                onPress={handleToggleMute}
                activeOpacity={0.8}
              >
                <Text style={styles.groupQuickIcon}>{isMuted ? '🔕' : '🔔'}</Text>
                <Text style={styles.groupQuickText}>{isMuted ? t('muted_status') : t('unmuted_status')}</Text>
              </TouchableOpacity>
            </View>

            {/* Theme & Hình nền nhóm */}
            <View style={styles.themeSection}>
              <View style={styles.themeSectionHeader}>
                <Text style={styles.themeSectionTitle}>🎨 {t('theme_and_wallpaper')}</Text>
                {Boolean(group?.background_url) && (
                  <TouchableOpacity onPress={handleRemoveBackground} disabled={updatingBackground}>
                    <Text style={styles.themeRemoveBtnText}>{t('remove_wallpaper')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Nút chụp hoặc chọn ảnh từ thư viện */}
              <View style={styles.themeButtonsRow}>
                <TouchableOpacity
                  style={styles.themeBtn}
                  onPress={() => handlePickBackground('camera')}
                  disabled={updatingBackground}
                >
                  <Text style={styles.themeBtnIcon}>📷</Text>
                  <Text style={styles.themeBtnText}>{t('take_photo')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.themeBtn}
                  onPress={() => handlePickBackground('library')}
                  disabled={updatingBackground}
                >
                  <Text style={styles.themeBtnIcon}>🖼️</Text>
                  <Text style={styles.themeBtnText}>{t('photo_library')}</Text>
                </TouchableOpacity>
              </View>

              {/* Bộ sưu tập Preset Themes */}
              <Text style={styles.presetLabel}>{t('featured_wallpapers')}</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={PRESET_THEMES}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingVertical: 4 }}
                renderItem={({ item }) => {
                  const isActive = group?.background_url === item.url;
                  return (
                    <TouchableOpacity
                      style={[styles.presetItem, isActive && styles.presetItemActive]}
                      onPress={() => handleSelectPresetBackground(item.url)}
                      disabled={updatingBackground}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: item.url }} style={styles.presetThumb} />
                      <Text style={styles.presetTitle} numberOfLines={1}>{item.name}</Text>
                      {isActive && (
                        <View style={styles.presetActiveBadge}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            <View style={styles.membersSectionHeader}>
              <Text style={styles.membersSectionTitle}>{t('member_list')} ({group?.members.length})</Text>
              <TouchableOpacity style={styles.addMemberBtn} onPress={openAddMemberModal}>
                <Text style={styles.addMemberBtnText}>{t('add_member')}</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={group?.members || []}
              keyExtractor={(item) => item.user_id.toString()}
              style={{ maxHeight: 250 }}
              renderItem={({ item }) => (
                <View style={styles.memberRow}>
                  <Image
                    source={
                      item.avatar_url
                        ? { uri: item.avatar_url }
                        : require('../../assets/splash-icon.png')
                    }
                    style={styles.memberAvatar}
                  />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{item.full_name || item.username}</Text>
                    <Text style={styles.memberRole}>
                      {item.role === 'admin' ? t('group_admin') : t('group_member')}
                    </Text>
                  </View>

                  {/* Quyền xóa thành viên dành cho admin */}
                  {group?.my_role === 'admin' && !item.is_me && (
                    <TouchableOpacity
                      style={styles.kickMemberBtn}
                      onPress={() => handleRemoveOrLeave(item.user_id, false)}
                    >
                      <Text style={styles.kickMemberBtnText}>{t('delete')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />

            {/* Nút rời nhóm */}
            <TouchableOpacity
              style={styles.leaveGroupBtn}
              onPress={() => handleRemoveOrLeave(user?.id || 0, true)}
            >
              <Text style={styles.leaveGroupBtnText}>{t('leave_group')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Chọn Nguồn Avatar (Camera / Thư viện) */}
      <Modal visible={avatarActionModalVisible} transparent animationType="fade" onRequestClose={() => setAvatarActionModalVisible(false)}>
        <TouchableOpacity style={styles.actionSheetOverlay} activeOpacity={1} onPress={() => setAvatarActionModalVisible(false)}>
          <View style={styles.actionSheetCard}>
            <Text style={styles.actionSheetTitle}>{t('change_group_avatar')}</Text>
            <TouchableOpacity
              style={styles.actionSheetRow}
              onPress={() => {
                setAvatarActionModalVisible(false);
                handlePickAvatar('camera');
              }}
            >
              <Text style={styles.actionSheetRowIcon}>📷</Text>
              <Text style={styles.actionSheetRowText}>{t('take_new_photo_camera')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetRow}
              onPress={() => {
                setAvatarActionModalVisible(false);
                handlePickAvatar('library');
              }}
            >
              <Text style={styles.actionSheetRowIcon}>🖼️</Text>
              <Text style={styles.actionSheetRowText}>{t('choose_photo_library')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionSheetRow, { justifyContent: 'center', borderTopWidth: 1, borderColor: '#2A2A3E', marginTop: 4 }]}
              onPress={() => setAvatarActionModalVisible(false)}
            >
              <Text style={{ color: '#8A8A9E', fontSize: 14, fontWeight: '600' }}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Members Modal */}
      <Modal visible={addMemberModalVisible} transparent animationType="slide" onRequestClose={() => setAddMemberModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalCard}>
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle}>{t('add_friends_to_group')}</Text>
              <TouchableOpacity onPress={() => setAddMemberModalVisible(false)}>
                <Text style={styles.infoModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableFriends}
              keyExtractor={(item) => item.id.toString()}
              style={{ maxHeight: 280 }}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#8A8A9E' }}>{t('all_friends_in_group')}</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedNewFriendIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.memberRow, isSelected && { backgroundColor: 'rgba(108, 99, 255, 0.15)' }]}
                    onPress={() => {
                      setSelectedNewFriendIds((prev) =>
                        prev.includes(item.id)
                          ? prev.filter((id) => id !== item.id)
                          : [...prev, item.id]
                      );
                    }}
                  >
                    <Image
                      source={item.avatar_url ? { uri: item.avatar_url } : require('../../assets/splash-icon.png')}
                      style={styles.memberAvatar}
                    />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{item.full_name || item.username}</Text>
                    </View>
                    <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
                      {isSelected && <Text style={{ color: '#FFF', fontSize: 12 }}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              style={[styles.confirmAddBtn, selectedNewFriendIds.length === 0 && { opacity: 0.5 }]}
              onPress={handleConfirmAddMembers}
              disabled={selectedNewFriendIds.length === 0 || addingMembers}
            >
              {addingMembers ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.confirmAddBtnText}>{t('add_selected_friends')} ({selectedNewFriendIds.length})</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (C: ColorScheme, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  backBtnText: {
    color: C.text,
    fontSize: 26,
    lineHeight: 28,
  },
  headerTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.separator,
    marginRight: 10,
  },
  headerTextGroup: {
    flex: 1,
  },
  groupTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  groupSubText: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  infoActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  infoActionBtnActive: {
    backgroundColor: `${C.primary}25`,
    borderWidth: 1,
    borderColor: C.primary,
  },
  infoActionIcon: {
    fontSize: 18,
  },
  headerSettingsDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  chatArea: {
    flex: 1,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#8A8A9E',
    fontSize: 14,
    marginTop: 10,
  },
  messagesListContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#8A8A9E',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  typingBanner: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  typingBannerText: {
    color: '#9C95FF',
    fontSize: 12,
    fontStyle: 'italic',
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  msgRowMine: {
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 4,
  },
  bubbleBox: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: C.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: isDark ? '#202030' : C.card,
    borderWidth: isDark ? 0 : 1,
    borderColor: C.border,
    borderBottomLeftRadius: 4,
  },
  senderNameTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9C95FF',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageTextMine: {
    color: '#FFFFFF',
  },
  messageTextOther: {
    color: C.text,
  },
  msgTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  msgTimeMine: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  msgTimeOther: {
    color: '#8A8A9E',
  },
  imageWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 6,
  },
  messageImage: {
    width: 220,
    height: 180,
    backgroundColor: '#1E1E2D',
  },
  imageMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 15, 26, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  imageMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageZoomHint: {
    fontSize: 11,
    color: '#C0C0D0',
  },
  imageSizeText: {
    fontSize: 11,
    color: '#9C95FF',
    marginLeft: 4,
    fontWeight: '600',
  },
  downloadIconBtn: {
    padding: 2,
  },
  downloadIconText: {
    fontSize: 14,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
  },
  fileCardMine: {
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  fileCardOther: {
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : '#F1F5F9',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
  },
  fileCardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fileCardIconBoxMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  fileCardIconBoxOther: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
  },
  fileCardEmoji: {
    fontSize: 20,
  },
  fileCardInfo: {
    flex: 1,
    marginRight: 6,
  },
  fileCardName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  fileCardNameMine: {
    color: '#FFFFFF',
  },
  fileCardNameOther: {
    color: isDark ? '#FFFFFF' : '#0F172A',
  },
  fileCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  fileCardSize: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  fileCardSizeMine: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  fileCardSizeOther: {
    color: isDark ? '#8A8A9E' : '#64748B',
  },
  readableBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  readableBadgeMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  readableBadgeOther: {
    backgroundColor: isDark ? 'rgba(108, 99, 255, 0.2)' : 'rgba(108, 99, 255, 0.12)',
  },
  readableBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  readableBadgeTextMine: {
    color: '#FFFFFF',
  },
  readableBadgeTextOther: {
    color: isDark ? '#B4AFFF' : '#6C63FF',
  },
  fileCardDownloadBtn: {
    padding: 6,
    borderRadius: 8,
  },
  fileCardDownloadBtnMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  fileCardDownloadBtnOther: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
  },
  downloadEmoji: {
    fontSize: 16,
  },
  attachmentPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  previewThumbBox: {
    position: 'relative',
    marginRight: 12,
  },
  previewImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  previewFileEmoji: {
    fontSize: 28,
  },
  removeAttachBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF5252',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAttachText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  previewSize: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    marginTop: 2,
  },
  plusMenuPopup: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#26263A',
    justifyContent: 'space-around',
  },
  plusMenuItem: {
    alignItems: 'center',
  },
  plusMenuIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  plusMenuEmoji: {
    fontSize: 20,
  },
  plusMenuLabel: {
    fontSize: 12,
    color: C.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  plusBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  plusBtnActive: {
    backgroundColor: C.primary,
  },
  plusBtnText: {
    color: C.textMuted,
    fontSize: 22,
    lineHeight: 24,
  },
  plusBtnTextActive: {
    color: '#FFFFFF',
  },
  chatInput: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
    fontSize: 14,
    maxHeight: 90,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#FFF',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  infoModalCard: {
    backgroundColor: isDark ? '#1A1A2E' : '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: isDark ? 0 : 1,
    borderColor: C.border,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
  },
  infoModalClose: {
    color: C.textMuted,
    fontSize: 20,
    paddingHorizontal: 8,
  },
  groupCardBanner: {
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 14,
  },
  groupBannerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  groupBannerName: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  groupBannerCount: {
    fontSize: 13,
    color: C.textMuted,
    marginTop: 2,
  },
  membersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  membersSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  addMemberBtn: {
    backgroundColor: isDark ? 'rgba(108, 99, 255, 0.15)' : 'rgba(108, 99, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addMemberBtnText: {
    color: C.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#26263A' : '#E2E8F0',
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
    backgroundColor: C.surface,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  memberRole: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  kickMemberBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
    borderRadius: 6,
  },
  kickMemberBtnText: {
    color: '#FF5252',
    fontSize: 11,
    fontWeight: '600',
  },
  leaveGroupBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255, 82, 82, 0.12)' : '#FEE2E2',
    alignItems: 'center',
  },
  leaveGroupBtnText: {
    color: isDark ? '#FF5252' : '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  selectCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: isDark ? '#4A4A62' : '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  confirmAddBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  confirmAddBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  avatarWrapper: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 8,
  },
  avatarCameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: isDark ? '#161622' : '#FFFFFF',
  },
  avatarCameraIcon: {
    fontSize: 12,
  },
  themeSection: {
    backgroundColor: isDark ? '#161622' : '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDark ? '#262638' : '#E2E8F0',
  },
  themeSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  themeSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: isDark ? '#FFFFFF' : '#0F172A',
  },
  themeRemoveBtnText: {
    fontSize: 12,
    color: '#FF5252',
    fontWeight: '600',
  },
  themeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#202030' : '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: isDark ? '#2E2E42' : '#E2E8F0',
  },
  themeBtnIcon: {
    fontSize: 16,
  },
  themeBtnText: {
    color: isDark ? '#FFFFFF' : '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  presetLabel: {
    fontSize: 12,
    color: isDark ? '#8A8A9E' : '#64748B',
    marginBottom: 6,
  },
  presetItem: {
    width: 76,
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: isDark ? '#1C1C2A' : '#F1F5F9',
    position: 'relative',
  },
  presetItemActive: {
    borderColor: C.primary,
  },
  presetThumb: {
    width: '100%',
    height: 48,
    borderRadius: 8,
  },
  presetTitle: {
    fontSize: 10,
    color: isDark ? '#D0D0E0' : '#334155',
    textAlign: 'center',
    paddingHorizontal: 2,
    paddingVertical: 4,
    fontWeight: '500',
  },
  presetActiveBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: C.primary,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  actionSheetCard: {
    backgroundColor: isDark ? '#1E1E2D' : '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: isDark ? '#2E2E42' : '#E2E8F0',
    gap: 10,
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: isDark ? '#FFFFFF' : '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: isDark ? '#262638' : '#F8FAFC',
    borderRadius: 12,
    borderWidth: isDark ? 0 : 1,
    borderColor: isDark ? 'transparent' : '#E2E8F0',
    gap: 12,
  },
  actionSheetRowIcon: {
    fontSize: 20,
  },
  actionSheetRowText: {
    color: isDark ? '#FFFFFF' : '#0F172A',
    fontSize: 15,
    fontWeight: '600',
  },
  headerActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: isDark ? '#26263A' : '#F1F5F9',
    borderWidth: isDark ? 0 : 1,
    borderColor: isDark ? 'transparent' : '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnActive: {
    backgroundColor: C.primary,
  },
  headerIconBtnPinned: {
    backgroundColor: isDark ? 'rgba(108, 99, 255, 0.35)' : 'rgba(108, 99, 255, 0.15)',
    borderWidth: 1,
    borderColor: C.primary,
  },
  headerIconBtnEmoji: {
    fontSize: 15,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerPinIcon: {
    fontSize: 12,
  },
  headerMuteIcon: {
    fontSize: 12,
    marginLeft: 2,
  },
  chatSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1E1E2D' : '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#2C2C40' : '#E2E8F0',
    gap: 8,
  },
  chatSearchIcon: {
    fontSize: 15,
  },
  chatSearchInput: {
    flex: 1,
    color: isDark ? '#FFFFFF' : '#0F172A',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 4,
  },
  searchMatchCounter: {
    backgroundColor: isDark ? '#28283E' : '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  searchMatchText: {
    fontSize: 11,
    color: isDark ? '#D0D0E0' : '#475569',
    fontWeight: '600',
  },
  searchNavButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  searchNavBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: isDark ? '#2A2A3E' : '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchNavArrow: {
    fontSize: 11,
    color: isDark ? '#FFFFFF' : '#0F172A',
    fontWeight: '700',
  },
  closeSearchBtn: {
    padding: 4,
  },
  closeSearchText: {
    color: C.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  bubbleHighlighted: {
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  groupQuickControls: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  groupQuickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#202030' : '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: isDark ? '#2E2E42' : '#E2E8F0',
  },
  groupQuickBtnActive: {
    backgroundColor: isDark ? 'rgba(108, 99, 255, 0.25)' : 'rgba(108, 99, 255, 0.12)',
    borderColor: C.primary,
  },
  groupQuickBtnMuted: {
    backgroundColor: isDark ? 'rgba(255, 82, 82, 0.15)' : '#FEE2E2',
    borderColor: isDark ? 'rgba(255, 82, 82, 0.3)' : '#FECACA',
  },
  groupQuickIcon: {
    fontSize: 16,
  },
  groupQuickText: {
    color: isDark ? '#FFFFFF' : '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
});
