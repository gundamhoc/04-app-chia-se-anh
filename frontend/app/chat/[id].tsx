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
  Keyboard,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ColorScheme } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../utils/i18n';
import { messageService } from '../../services/messageService';
import { Message, Photo } from '../../types';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { WebCameraModal } from '../../components/WebCameraModal';
import { FileViewerModal } from '../../components/FileViewerModal';

const PRESET_THEMES = [
  { id: 'cosmic', name: 'Vũ trụ huyền ảo', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000&auto=format&fit=crop' },
  { id: 'cyberpunk', name: 'Neon Cyberpunk', url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1000&auto=format&fit=crop' },
  { id: 'aurora', name: 'Cực quang Emerald', url: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?q=80&w=1000&auto=format&fit=crop' },
  { id: 'sunset', name: 'Hoàng hôn Chill', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1000&auto=format&fit=crop' },
  { id: 'dark_matter', name: 'Màn đêm Tối giản', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000&auto=format&fit=crop' },
];

interface SelectedFileState {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  isImage?: boolean;
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { socket, isConnected, isUserOnline } = useSocket();
  const { showToast } = useToast();
  const { colors: C, isDark } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
  }>();

  const friendId = parseInt(params.id, 10);
  const [friendName, setFriendName] = useState<string>(params.name || (language === 'vi' ? 'Người bạn' : 'Friend'));
  const [friendAvatar, setFriendAvatar] = useState<string | null>(params.avatar || null);

  useEffect(() => {
    if (params.name) setFriendName(params.name);
    if (params.avatar) setFriendAvatar(params.avatar);
  }, [params.name, params.avatar]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // Trạng thái Theme / Hình nền chat 1-1
  const [chatBackground, setChatBackground] = useState<string | null>(null);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [updatingTheme, setUpdatingTheme] = useState(false);

  // Trạng thái Ghim & Tắt thông báo
  const [isPinned, setIsPinned] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Trạng thái Modal Cài Đặt Cuộc Trò Chuyện (Bánh răng ⚙️)
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Trạng thái Tìm kiếm tin nhắn
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchMatches, setSearchMatches] = useState<Message[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);

  // Menu mở rộng khi bấm nút (+)
  const [showActionMenu, setShowActionMenu] = useState(false);

  // Trạng thái bàn phím để căn chỉnh layout mượt mà
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Ảnh hoặc tệp tin đính kèm chuẩn bị gửi
  const [selectedFile, setSelectedFile] = useState<SelectedFileState | null>(null);
  const [showWebCamera, setShowWebCamera] = useState(false);

  // Phóng to thu nhỏ ảnh khi chạm vào ảnh trong tin nhắn
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedPhotoForViewer, setSelectedPhotoForViewer] = useState<Photo | null>(null);

  // Modal đọc nội dung tệp tin văn bản / code
  const [fileViewerVisible, setFileViewerVisible] = useState(false);
  const [activeFileViewerMessage, setActiveFileViewerMessage] = useState<Message | null>(null);

  // Trạng thái đang soạn tin (typing indicator)
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flatListRef = useRef<FlatList<Message>>(null);

  // Tự động cuộn xuống cuối cùng
  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, []);

  // Format dung lượng hiển thị KB / MB
  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // 1. Tải lịch sử tin nhắn
  const fetchMessages = useCallback(async () => {
    if (isNaN(friendId)) return;
    try {
      const data = await messageService.getMessages(friendId);
      setMessages(data.messages);
      if (data.friend) {
        const resolvedName = data.friend.full_name || data.friend.username;
        if (resolvedName) {
          setFriendName(resolvedName);
        }
        if (data.friend.avatar_url) {
          setFriendAvatar(data.friend.avatar_url);
        }
      }
      if (data.background_url !== undefined) {
        setChatBackground(data.background_url || null);
      }
      if (data.is_pinned !== undefined) {
        setIsPinned(Boolean(data.is_pinned));
      }
      if (data.is_muted !== undefined) {
        setIsMuted(Boolean(data.is_muted));
      }
      // Đánh dấu đã đọc trên server
      await messageService.markMessagesRead(friendId);
      setTimeout(() => scrollToBottom(false), 200);
    } catch (e) {
      console.warn('Lỗi tải tin nhắn:', e);
      showToast('error', language === 'vi' ? 'Không thể tải lịch sử trò chuyện.' : 'Failed to load chat history.');
    } finally {
      setLoading(false);
    }
  }, [friendId, scrollToBottom, showToast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 2. Lắng nghe sự kiện bàn phím mở/đóng để tự động đẩy tin nhắn lên
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      setShowActionMenu(false);
      setTimeout(() => scrollToBottom(true), 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottom]);

  // 3. Lắng nghe sự kiện Realtime qua Socket.io
  useEffect(() => {
    if (!socket || isNaN(friendId)) return;

    // Tin nhắn mới từ server
    const handleNewMessage = (newMsg: Message) => {
      const isRelated =
        (newMsg.sender_id === friendId && newMsg.receiver_id === user?.id) ||
        (newMsg.sender_id === user?.id && newMsg.receiver_id === friendId);

      if (isRelated) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        setTimeout(() => scrollToBottom(true), 80);

        if (newMsg.receiver_id === user?.id) {
          messageService.markMessagesRead(friendId).catch(() => {});
        }
      }
    };

    // Bạn chat đã đọc tin nhắn
    const handleMessagesRead = (data: { reader_id: number }) => {
      if (data.reader_id === friendId) {
        setMessages((prev) =>
          prev.map((m) => (m.is_mine ? { ...m, is_read: true } : m))
        );
      }
    };

    // Bạn chat đang soạn tin
    const handleUserTyping = (data: { senderId: number; isTyping: boolean }) => {
      if (data.senderId === friendId) {
        setIsFriendTyping(data.isTyping);
        if (data.isTyping) {
          setTimeout(() => scrollToBottom(true), 80);
        }
      }
    };

    // Lắng nghe thay đổi theme / hình nền chat 1-1
    const handleDirectThemeUpdated = (payload: { background_url: string | null; updated_by: number }) => {
      setChatBackground(payload.background_url || null);
    };

    socket.on('new_direct_message', handleNewMessage);
    socket.on('messages_marked_read', handleMessagesRead);
    socket.on('user_typing', handleUserTyping);
    socket.on('direct_theme_updated', handleDirectThemeUpdated);

    return () => {
      socket.off('new_direct_message', handleNewMessage);
      socket.off('messages_marked_read', handleMessagesRead);
      socket.off('user_typing', handleUserTyping);
      socket.off('direct_theme_updated', handleDirectThemeUpdated);
      if (socket.connected) {
        socket.emit('typing_stop', { receiverId: friendId });
      }
    };
  }, [socket, friendId, user?.id, scrollToBottom]);

  // 4. Xử lý gõ phím (Typing Indicator)
  const handleTextChange = (text: string) => {
    setInputText(text);

    if (!socket || !socket.connected || isNaN(friendId)) return;

    socket.emit('typing_start', { receiverId: friendId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (socket.connected) {
        socket.emit('typing_stop', { receiverId: friendId });
      }
    }, 2000);
  };

  // 5. Bấm nút (+) để mở menu action
  const toggleActionMenu = () => {
    if (showActionMenu) {
      setShowActionMenu(false);
    } else {
      Keyboard.dismiss();
      setShowActionMenu(true);
    }
  };

  // 6. Chọn ảnh từ thư viện
  const pickImageFromGallery = async () => {
    setShowActionMenu(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast('warning', 'Quyền truy cập thư viện ảnh bị từ chối.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.82,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const rawName = asset.fileName || asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
        setSelectedFile({
          uri: asset.uri,
          name: rawName,
          size: asset.fileSize || undefined,
          mimeType: asset.mimeType || 'image/jpeg',
          isImage: true,
        });
        setTimeout(() => scrollToBottom(true), 100);
      }
    } catch (e) {
      console.warn('Lỗi chọn ảnh từ thư viện:', e);
      showToast('error', 'Không thể mở thư viện ảnh.');
    }
  };

  // 7. Chụp ảnh từ máy ảnh
  const takePhotoFromCamera = async () => {
    setShowActionMenu(false);
    if (Platform.OS === 'web') {
      setShowWebCamera(true);
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast('warning', 'Quyền truy cập Máy ảnh bị từ chối.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.82,
        cameraType: ImagePicker.CameraType.back,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const rawName = asset.fileName || `camera_${Date.now()}.jpg`;
        setSelectedFile({
          uri: asset.uri,
          name: rawName,
          size: asset.fileSize || undefined,
          mimeType: asset.mimeType || 'image/jpeg',
          isImage: true,
        });
        setTimeout(() => scrollToBottom(true), 100);
      }
    } catch (e) {
      console.warn('Lỗi mở camera:', e);
      showToast('error', 'Không thể khởi động camera.');
    }
  };

  // 8. Chọn tệp tin bất kỳ từ thiết bị (Document Picker)
  const pickDocumentFile = async () => {
    setShowActionMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const ext = file.name.split('.').pop()?.toLowerCase();
        const isImg = file.mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '');

        setSelectedFile({
          uri: file.uri,
          name: file.name,
          size: file.size || undefined,
          mimeType: file.mimeType || 'application/octet-stream',
          isImage: isImg,
        });
        setTimeout(() => scrollToBottom(true), 100);
      }
    } catch (e) {
      console.warn('Lỗi chọn tệp tin:', e);
      showToast('error', 'Không thể mở bộ chọn tệp tin.');
    }
  };

  // 9. Gửi tin nhắn (văn bản, ảnh hoặc tệp tin)
  const handleSend = async () => {
    const textToSend = inputText.trim();
    const fileToSend = selectedFile;

    if (!textToSend && !fileToSend) return;
    if (sending) return;

    setSending(true);

    if (socket && socket.connected) {
      socket.emit('typing_stop', { receiverId: friendId });
    }

    try {
      if (fileToSend) {
        // Gửi tệp tin (hỗ trợ mọi định dạng: code, txt, pdf, zip, ảnh...)
        const newMsg = await messageService.sendFileMessage(
          friendId,
          fileToSend.uri,
          fileToSend.name,
          fileToSend.size,
          fileToSend.mimeType,
          textToSend
        );
        setSelectedFile(null);
        setInputText('');
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom(true), 100);
      } else {
        // Gửi tin nhắn văn bản thuần túy
        setInputText('');
        const newMsg = await messageService.sendMessage(friendId, textToSend);
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom(true), 100);
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Lỗi gửi tin nhắn';
      console.warn('Lỗi gửi tin nhắn:', e);
      showToast('error', errorMsg);
    } finally {
      setSending(false);
    }
  };

  // Đổi hình nền cuộc trò chuyện từ Camera hoặc Thư viện
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
        setUpdatingTheme(true);
        showToast('info', 'Đang tải lên hình nền cuộc trò chuyện...');
        const updated = await messageService.updateChatTheme(friendId, {
          imageUri: result.assets[0].uri,
        });
        setChatBackground(updated.background_url);
        showToast('success', 'Đã thay đổi hình nền trò chuyện! 🎨');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Không thể cập nhật hình nền.';
      showToast('error', msg);
    } finally {
      setUpdatingTheme(false);
    }
  };

  // Áp dụng Preset Background
  const handleSelectPresetTheme = async (presetUrl: string) => {
    try {
      setUpdatingTheme(true);
      const updated = await messageService.updateChatTheme(friendId, {
        presetUrl,
      });
      setChatBackground(updated.background_url);
      showToast('success', 'Đã áp dụng hình nền chủ đề! ✨');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Không thể áp dụng hình nền.';
      showToast('error', msg);
    } finally {
      setUpdatingTheme(false);
    }
  };

  // Gỡ hình nền
  const handleRemoveTheme = async () => {
    try {
      setUpdatingTheme(true);
      const updated = await messageService.updateChatTheme(friendId, {
        remove: true,
      });
      setChatBackground(updated.background_url);
      showToast('info', 'Đã đặt lại hình nền mặc định.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Không thể gỡ hình nền.';
      showToast('error', msg);
    } finally {
      setUpdatingTheme(false);
    }
  };

  // Bật/Tắt Ghim cuộc trò chuyện 1-1
  const handleTogglePin = async () => {
    try {
      const next = !isPinned;
      const res = await messageService.togglePin(friendId, next);
      setIsPinned(res);
      showToast('success', res ? 'Đã ghim cuộc trò chuyện lên đầu! 📌' : 'Đã bỏ ghim cuộc trò chuyện.');
    } catch {
      showToast('error', 'Không thể ghim cuộc trò chuyện.');
    }
  };

  // Bật/Tắt Thông báo cuộc trò chuyện 1-1
  const handleToggleMute = async () => {
    try {
      const next = !isMuted;
      const res = await messageService.toggleMute(friendId, next);
      setIsMuted(res);
      showToast('success', res ? 'Đã tắt thông báo cuộc trò chuyện! 🔕' : 'Đã bật thông báo cuộc trò chuyện! 🔔');
    } catch {
      showToast('error', 'Không thể thay đổi cài đặt thông báo.');
    }
  };

  // Tìm kiếm tin nhắn trong phòng chat
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

  // 10. Phân loại định dạng file
  const isImageMessage = (msg: Message) => {
    if (msg.image_url) return true;
    const ext = msg.file_name?.split('.').pop()?.toLowerCase();
    return (
      msg.file_type?.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic'].includes(ext || '')
    );
  };

  const isReadableTextOrCode = (msg: Message) => {
    const ext = msg.file_name?.split('.').pop()?.toLowerCase();
    const readableExts = [
      'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'py',
      'c', 'cpp', 'h', 'java', 'sql', 'xml', 'csv', 'log', 'env', 'yaml', 'yml', 'sh'
    ];
    return (
      Boolean(msg.file_type?.startsWith('text/')) ||
      readableExts.includes(ext || '') ||
      msg.file_type === 'application/json' ||
      msg.file_type === 'application/javascript'
    );
  };

  const getFileEmoji = (fileName?: string | null) => {
    if (!fileName) return '📁';
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['js', 'ts', 'tsx', 'jsx', 'py', 'c', 'cpp', 'h', 'java', 'html', 'css', 'sql', 'sh'].includes(ext || '')) return '💻';
    if (['txt', 'md', 'log', 'csv', 'env'].includes(ext || '')) return '📝';
    if (ext === 'pdf') return '📕';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return '📦';
    if (['mp3', 'wav', 'm4a', 'flac'].includes(ext || '')) return '🎵';
    if (['mp4', 'mkv', 'mov', 'avi'].includes(ext || '')) return '🎬';
    if (['doc', 'docx'].includes(ext || '')) return '📘';
    if (['xls', 'xlsx'].includes(ext || '')) return '📊';
    if (['ppt', 'pptx'].includes(ext || '')) return '📙';
    return '📁';
  };

  // 11. Xử lý khi chạm vào tệp tin (Đọc hoặc báo không hỗ trợ)
  const handleFilePress = (msg: Message) => {
    if (isImageMessage(msg)) {
      openImageViewer(msg);
      return;
    }

    if (isReadableTextOrCode(msg)) {
      setActiveFileViewerMessage(msg);
      setFileViewerVisible(true);
      return;
    }

    // Tệp tin không hỗ trợ đọc trực tiếp
    showToast(
      'info',
      'Tệp tin này không hỗ trợ đọc trực tiếp. Vui lòng bấm nút Tải về (⬇️) để mở trên thiết bị!'
    );
  };

  // 12. Tải tệp tin về thiết bị
  const handleDownloadFile = async (fileUrl: string, fileName: string) => {
    try {
      showToast('info', `Đang tải ${fileName}...`);
      await messageService.downloadFile(fileUrl, fileName);
      showToast('success', `Đã tải ${fileName} thành công!`);
    } catch (e) {
      console.warn('Lỗi tải file:', e);
      showToast('error', 'Không thể tải tệp tin.');
    }
  };

  // 13. Mở xem toàn màn hình và phóng to/thu nhỏ ảnh
  const openImageViewer = (msg: Message) => {
    const targetUrl = msg.image_url || msg.file_url;
    if (!targetUrl) return;

    const photoModel: Photo = {
      id: msg.id,
      user_id: msg.sender_id,
      recipient_id: msg.receiver_id ?? null,
      image_url: targetUrl,
      caption: msg.message_text,
      created_at: msg.created_at,
      author_name: msg.is_mine ? 'Bạn' : msg.sender_name || friendName,
      author_username: '',
      author_avatar: msg.is_mine ? user?.avatar_url || null : msg.sender_avatar || friendAvatar,
    };

    setSelectedPhotoForViewer(photoModel);
    setViewerVisible(true);
  };

  // Format giờ phút
  const formatMsgTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Render từng dòng tin nhắn
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMine = item.is_mine || item.sender_id === user?.id;
    const isImg = isImageMessage(item);
    const hasFile = Boolean(item.file_url || item.image_url);

    return (
      <View
        style={[
          styles.msgRow,
          isMine ? styles.msgRowMine : styles.msgRowFriend,
        ]}
      >
        {!isMine && (
          <Image
            source={
              item.sender_avatar || friendAvatar
                ? { uri: item.sender_avatar || friendAvatar! }
                : require('../../assets/splash-icon.png')
            }
            style={styles.senderAvatar}
            {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
          />
        )}

        <View
          style={[
            styles.bubbleBox,
            isMine ? styles.bubbleMine : styles.bubbleFriend,
            isImg ? styles.bubbleWithImage : undefined,
            item.id === highlightedMessageId && styles.bubbleHighlighted,
          ]}
        >
          {/* TRƯỜNG HỢP 1: Tin nhắn tệp tin là HÌNH ẢNH */}
          {isImg && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => openImageViewer(item)}
              style={styles.imageWrapper}
            >
              <Image
                source={{ uri: item.image_url || item.file_url! }}
                style={styles.messageImage}
                resizeMode="cover"
                {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
              />
              
              {/* Huy hiệu hiển thị dung lượng MB ở dưới tấm hình + nút tải về */}
              <View style={styles.imageMetaBadge}>
                <View style={styles.imageMetaLeft}>
                  <Text style={styles.imageZoomHint}>🔍 {t('zoom_hint')}</Text>
                  {item.file_size ? (
                    <Text style={styles.imageSizeText}>• {formatFileSize(item.file_size)}</Text>
                  ) : null}
                </View>

                {item.file_url && (
                  <TouchableOpacity
                    style={styles.downloadIconBtn}
                    onPress={() => handleDownloadFile(item.file_url!, item.file_name || 'image.jpg')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.downloadIconText}>⬇️</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* TRƯỜNG HỢP 2: Tin nhắn tệp tin là CODE, TEXT, PDF, ZIP, DOCX... */}
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

              {/* Nút tải về tệp tin */}
              <TouchableOpacity
                style={[styles.fileCardDownloadBtn, isMine ? styles.fileCardDownloadBtnMine : styles.fileCardDownloadBtnOther]}
                onPress={() => handleDownloadFile(item.file_url!, item.file_name || 'file')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.fileCardDownloadIcon}>⬇️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {/* Nội dung văn bản chú thích */}
          {item.message_text && item.message_text.length > 0 && (
            <Text
              style={[
                styles.messageText,
                isMine ? styles.textMine : styles.textFriend,
                isImg ? styles.textUnderImage : undefined,
                !isImg && hasFile ? styles.textUnderFile : undefined,
              ]}
            >
              {item.message_text}
            </Text>
          )}

          {/* Thời gian và trạng thái đã đọc */}
          <View style={[styles.metaRow, isMine ? styles.metaRight : styles.metaLeft]}>
            <Text style={styles.timeText}>{formatMsgTime(item.created_at)}</Text>
            {isMine && (
              <Text style={[styles.readStatus, item.is_read ? styles.readSeen : styles.readSent]}>
                {item.is_read ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* 1. Header Bar cố định trên đỉnh */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfile}
          onPress={() =>
            router.push({
              pathname: '/user/[id]',
              params: { id: friendId.toString() },
            })
          }
          activeOpacity={0.7}
        >
          <View style={styles.headerAvatarContainer}>
            <Image
              source={
                friendAvatar
                  ? { uri: friendAvatar }
                  : require('../../assets/splash-icon.png')
              }
              style={styles.headerAvatar}
              {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
            />
            {isUserOnline(friendId) && <View style={styles.headerOnlineDot} />}
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              {isPinned && <Text style={styles.headerPinIcon}>📌</Text>}
              <Text style={styles.headerName} numberOfLines={1}>
                {friendName}
              </Text>
              {isMuted && <Text style={styles.headerMuteIcon}>🔕</Text>}
            </View>
            <Text style={[styles.headerStatus, isFriendTyping && styles.headerStatusTyping]}>
              {isFriendTyping
                ? t('typing_status')
                : isUserOnline(friendId)
                ? t('online')
                : t('offline')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Nút Cài Đặt Cuộc Trò Chuyện (Bánh răng ⚙️ gom 4 chức năng) */}
        <TouchableOpacity
          style={[
            styles.headerSettingsBtn,
            (isPinned || isMuted) && styles.headerSettingsBtnHighlighted,
          ]}
          onPress={() => setSettingsModalVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Text style={styles.headerSettingsIcon}>⚙️</Text>
          {(isPinned || isMuted) && <View style={styles.headerSettingsDot} />}
        </TouchableOpacity>
      </View>

      {/* 1.5. Thanh Tìm Kiếm Tin Nhắn In-Chat */}
      {showSearchBar && (
        <View style={styles.chatSearchBar}>
          <Text style={styles.chatSearchIcon}>🔍</Text>
          <TextInput
            style={styles.chatSearchInput}
            placeholder={t('search_in_chat')}
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

      {/* 2. KeyboardAvoidingView bọc trọn vùng chat & khung nhập */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 54 : 0}
      >
        {/* Hình nền cuộc trò chuyện nếu có kèm lớp phủ tối tương phản */}
        {chatBackground ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image
              source={{ uri: chatBackground }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: 'rgba(15, 15, 26, 0.72)' },
              ]}
            />
          </View>
        ) : null}
        {/* Danh sách tin nhắn */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>Đang tải cuộc trò chuyện...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.listContainer}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScrollToIndexFailed={(info) => {
              setTimeout(() => flatListRef.current?.scrollToIndex({ index: info.index, animated: true }), 100);
            }}
            onTouchStart={() => {
              if (showActionMenu) setShowActionMenu(false);
            }}
            onContentSizeChange={() => scrollToBottom(true)}
            onLayout={() => scrollToBottom(false)}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>👋✨</Text>
                <Text style={styles.emptyTitle}>{language === 'vi' ? 'Chưa có tin nhắn' : 'No messages yet'}</Text>
                <Text style={styles.emptyDesc}>
                  {language === 'vi'
                    ? `Hãy gửi một lời chào, hình ảnh hoặc tệp tin tới ${friendName} nào!`
                    : `Send a greeting, photo, or file to ${friendName}!`}
                </Text>
              </View>
            }
          />
        )}

        {/* Typing indicator banner */}
        {isFriendTyping && (
          <View style={styles.typingBanner}>
            <Text style={styles.typingBannerText}>
              {friendName} {language === 'vi' ? 'đang soạn tin... ✍️' : 'is typing... ✍️'}
            </Text>
          </View>
        )}

        {/* Xem trước tệp tin đính kèm trước khi gửi */}
        {selectedFile && (
          <View style={styles.attachmentPreviewBar}>
            <View style={styles.previewImageContainer}>
              {selectedFile.isImage ? (
                <Image source={{ uri: selectedFile.uri }} style={styles.previewThumbnail} />
              ) : (
                <View style={styles.previewFileBox}>
                  <Text style={styles.previewFileEmoji}>{getFileEmoji(selectedFile.name)}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => setSelectedFile(null)}
              >
                <Text style={styles.removeImageText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewFileInfo}>
              <Text style={styles.previewFileName} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <Text style={styles.previewFileMeta}>
                {formatFileSize(selectedFile.size)} • Sẵn sàng gửi
              </Text>
            </View>
          </View>
        )}

        {/* Menu chọn Chụp ảnh / Thư viện / Tệp tin khi bấm nút (+) */}
        {showActionMenu && (
          <View style={styles.actionMenuContainer}>
            {/* 1. Chụp ảnh */}
            <TouchableOpacity
              style={styles.actionOption}
              onPress={takePhotoFromCamera}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#6C63FF' }]}>
                <Text style={styles.actionEmoji}>📷</Text>
              </View>
              <Text style={styles.actionTitle}>{t('take_photo')}</Text>
            </TouchableOpacity>

            {/* 2. Thư viện ảnh */}
            <TouchableOpacity
              style={styles.actionOption}
              onPress={pickImageFromGallery}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#10B981' }]}>
                <Text style={styles.actionEmoji}>🖼️</Text>
              </View>
              <Text style={styles.actionTitle}>{t('photo_library')}</Text>
            </TouchableOpacity>

            {/* 3. Tệp tin */}
            <TouchableOpacity
              style={styles.actionOption}
              onPress={pickDocumentFile}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.actionEmoji}>📁</Text>
              </View>
              <Text style={styles.actionTitle}>{t('choose_file')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. Bottom Input Bar */}
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 10) },
          ]}
        >
          {/* Nút (+) gộp gọn chức năng Chụp ảnh, Thư viện, Tệp tin */}
          <TouchableOpacity
            style={[styles.plusButton, showActionMenu && styles.plusButtonActive]}
            onPress={toggleActionMenu}
            disabled={sending}
            activeOpacity={0.7}
          >
            <Text style={[styles.plusIcon, showActionMenu && styles.plusIconActive]}>
              {showActionMenu ? '✕' : '+'}
            </Text>
          </TouchableOpacity>

          {/* Khung nhập tin nhắn */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={selectedFile ? t('attach_note_placeholder') : t('type_message')}
              placeholderTextColor={C.textMuted}
              value={inputText}
              onChangeText={handleTextChange}
              onFocus={() => {
                if (showActionMenu) setShowActionMenu(false);
                setTimeout(() => scrollToBottom(true), 120);
              }}
              multiline
              maxLength={1000}
              editable={!sending}
            />
          </View>

          {/* Nút gửi */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (inputText.trim().length > 0 || selectedFile) && !sending
                ? styles.sendButtonActive
                : styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={(!inputText.trim() && !selectedFile) || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 4. Modal Web Camera (dành riêng cho Web) */}
      <WebCameraModal
        visible={showWebCamera}
        onClose={() => setShowWebCamera(false)}
        onCapture={(dataUrl) => {
          setSelectedFile({
            uri: dataUrl,
            name: `webcam_${Date.now()}.jpg`,
            isImage: true,
            mimeType: 'image/jpeg',
          });
          setShowWebCamera(false);
          setTimeout(() => scrollToBottom(true), 100);
        }}
      />

      {/* 5. Modal Phóng to Thu nhỏ ảnh (Pinch-to-zoom) */}
      <ImageViewerModal
        visible={viewerVisible}
        photo={selectedPhotoForViewer}
        onClose={() => {
          setViewerVisible(false);
          setSelectedPhotoForViewer(null);
        }}
      />

      {/* 6. Modal Đọc tệp tin trực tiếp (Code, Text viewer) */}
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
        onDownload={handleDownloadFile}
      />

      {/* 6.5. Modal Cài đặt Cuộc trò chuyện (Bánh răng ⚙️) */}
      <Modal
        visible={settingsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModalCard}>
            {/* Header Modal */}
            <View style={styles.settingsModalHeader}>
              <View style={styles.settingsHeaderLeft}>
                <Image
                  source={
                    friendAvatar
                      ? { uri: friendAvatar }
                      : require('../../assets/splash-icon.png')
                  }
                  style={styles.settingsHeaderAvatar}
                  {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
                />
                <View style={styles.settingsHeaderInfo}>
                  <Text style={styles.settingsModalTitle} numberOfLines={1}>
                    {t('chat_settings')} ⚙️
                  </Text>
                  <Text style={styles.settingsModalSubtitle} numberOfLines={1}>
                    {friendName}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSettingsModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Danh sách 4 chức năng cài đặt */}
            <View style={styles.settingsItemsContainer}>
              {/* 1. Tìm kiếm tin nhắn */}
              <TouchableOpacity
                style={styles.settingsItemRow}
                onPress={() => {
                  setSettingsModalVisible(false);
                  setTimeout(() => {
                    setShowSearchBar(true);
                  }, 250);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.settingsItemIconBox, { backgroundColor: '#382BF022' }]}>
                  <Text style={styles.settingsItemIcon}>🔍</Text>
                </View>
                <View style={styles.settingsItemContent}>
                  <Text style={styles.settingsItemTitle}>{t('search')}</Text>
                  <Text style={styles.settingsItemDesc}>{t('search_messages_desc')}</Text>
                </View>
                <Text style={styles.settingsItemArrow}>›</Text>
              </TouchableOpacity>

              {/* 2. Ghim cuộc trò chuyện */}
              <TouchableOpacity
                style={styles.settingsItemRow}
                onPress={handleTogglePin}
                activeOpacity={0.7}
              >
                <View style={[styles.settingsItemIconBox, { backgroundColor: isPinned ? '#6C63FF33' : '#26263A' }]}>
                  <Text style={styles.settingsItemIcon}>📌</Text>
                </View>
                <View style={styles.settingsItemContent}>
                  <Text style={styles.settingsItemTitle}>{t('pin_chat')}</Text>
                  <Text style={styles.settingsItemDesc}>
                    {isPinned ? t('pinned_chat_desc') : t('pin_chat_desc')}
                  </Text>
                </View>
                <View style={[styles.settingsBadge, isPinned ? styles.settingsBadgeActive : styles.settingsBadgeInactive]}>
                  <Text style={[styles.settingsBadgeText, isPinned && styles.settingsBadgeTextActive]}>
                    {isPinned ? `${t('pinned')} 📌` : t('unpinned_status')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* 3. Thông báo tin nhắn */}
              <TouchableOpacity
                style={styles.settingsItemRow}
                onPress={handleToggleMute}
                activeOpacity={0.7}
              >
                <View style={[styles.settingsItemIconBox, { backgroundColor: isMuted ? '#FF525222' : '#4CAF5022' }]}>
                  <Text style={styles.settingsItemIcon}>{isMuted ? '🔕' : '🔔'}</Text>
                </View>
                <View style={styles.settingsItemContent}>
                  <Text style={styles.settingsItemTitle}>{t('notifications')}</Text>
                  <Text style={styles.settingsItemDesc}>
                    {isMuted ? t('muted_chat_desc') : t('mute_chat_desc')}
                  </Text>
                </View>
                <View style={[styles.settingsBadge, isMuted ? styles.settingsBadgeMuted : styles.settingsBadgeEnabled]}>
                  <Text style={[styles.settingsBadgeText, isMuted ? styles.settingsBadgeTextMuted : styles.settingsBadgeTextEnabled]}>
                    {isMuted ? `${t('off')} 🔕` : `${t('on')} 🔔`}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* 4. Hình nền & Theme */}
              <TouchableOpacity
                style={styles.settingsItemRow}
                onPress={() => {
                  setSettingsModalVisible(false);
                  setTimeout(() => {
                    setThemeModalVisible(true);
                  }, 250);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.settingsItemIconBox, { backgroundColor: '#FFB80022' }]}>
                  <Text style={styles.settingsItemIcon}>🎨</Text>
                </View>
                <View style={styles.settingsItemContent}>
                  <Text style={styles.settingsItemTitle}>{t('chat_theme')}</Text>
                  <Text style={styles.settingsItemDesc}>
                    {chatBackground ? t('custom_theme_desc') : t('theme_chat_desc')}
                  </Text>
                </View>
                <Text style={styles.settingsItemArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Nút Đóng */}
            <TouchableOpacity
              style={styles.settingsCloseBtn}
              onPress={() => setSettingsModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.settingsCloseBtnText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 7. Modal Cài đặt Theme / Hình nền */}
      <Modal
        visible={themeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.themeModalCard}>
            <View style={styles.themeModalHeader}>
              <View>
                <Text style={styles.themeModalTitle}>Hình Nền & Giao Diện 🎨</Text>
                <Text style={styles.themeModalSubtitle}>
                  Áp dụng cho cuộc trò chuyện với {friendName}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setThemeModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Hành động Tải ảnh lên / Chụp ảnh */}
            <View style={styles.themeActionsRow}>
              <TouchableOpacity
                style={styles.themeActionBtn}
                onPress={() => handlePickBackground('camera')}
                disabled={updatingTheme}
                activeOpacity={0.8}
              >
                <Text style={styles.themeActionIcon}>📷</Text>
                <Text style={styles.themeActionText}>Chụp ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.themeActionBtn}
                onPress={() => handlePickBackground('library')}
                disabled={updatingTheme}
                activeOpacity={0.8}
              >
                <Text style={styles.themeActionIcon}>🖼️</Text>
                <Text style={styles.themeActionText}>Thư viện / Tệp</Text>
              </TouchableOpacity>

              {chatBackground && (
                <TouchableOpacity
                  style={[styles.themeActionBtn, styles.themeRemoveBtn]}
                  onPress={handleRemoveTheme}
                  disabled={updatingTheme}
                  activeOpacity={0.8}
                >
                  <Text style={styles.themeActionIcon}>🗑️</Text>
                  <Text style={[styles.themeActionText, { color: '#FF5252' }]}>Gỡ nền</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Danh sách Preset Themes */}
            <Text style={styles.presetHeading}>Gợi ý hình nền thịnh hành:</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={PRESET_THEMES}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.presetListContent}
              renderItem={({ item }) => {
                const isActive = chatBackground === item.url;
                return (
                  <TouchableOpacity
                    style={[styles.presetCard, isActive && styles.presetCardActive]}
                    onPress={() => handleSelectPresetTheme(item.url)}
                    disabled={updatingTheme}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.url }} style={styles.presetCardThumb} />
                    <Text style={styles.presetCardTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isActive && (
                      <View style={styles.presetActiveBadge}>
                        <Text style={styles.presetActiveCheck}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />

            {updatingTheme && (
              <View style={styles.updatingOverlay}>
                <ActivityIndicator size="small" color={C.primary} />
                <Text style={styles.updatingText}>Đang cập nhật hình nền...</Text>
              </View>
            )}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.card,
    zIndex: 10,
  },
  backBtn: {
    padding: 6,
    marginRight: 10,
  },
  backArrow: {
    color: C.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.separator,
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#00E676',
    borderWidth: 2,
    borderColor: C.card,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  headerStatus: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    marginTop: 1,
  },
  headerStatusTyping: {
    color: C.primary,
    fontFamily: 'Inter_500Medium',
  },
  chatArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: C.textMuted,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    maxWidth: '86%',
  },
  msgRowMine: {
    alignSelf: 'flex-end',
  },
  msgRowFriend: {
    alignSelf: 'flex-start',
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#202030',
  },
  bubbleBox: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  bubbleWithImage: {
    paddingHorizontal: 5,
    paddingTop: 5,
    paddingBottom: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bubbleMine: {
    backgroundColor: C.primary,
    borderBottomRightRadius: 4,
  },
  bubbleFriend: {
    backgroundColor: isDark ? '#202030' : C.card,
    borderWidth: isDark ? 0 : 1,
    borderColor: C.border,
    borderBottomLeftRadius: 4,
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  messageImage: {
    width: 240,
    height: 240,
    borderRadius: 15,
    backgroundColor: '#161622',
  },
  imageMetaBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  imageZoomHint: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  imageSizeText: {
    color: '#00E676',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
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
    minWidth: 220,
    maxWidth: 280,
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
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fileCardIconBoxMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  fileCardIconBoxOther: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
  },
  fileCardEmoji: {
    fontSize: 22,
  },
  fileCardInfo: {
    flex: 1,
    marginRight: 8,
  },
  fileCardName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 3,
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
    fontSize: 9,
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
  fileCardDownloadIcon: {
    fontSize: 16,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 21,
  },
  textUnderImage: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  textUnderFile: {
    paddingTop: 8,
  },
  textMine: {
    color: '#FFFFFF',
  },
  textFriend: {
    color: isDark ? '#FFFFFF' : C.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  metaRight: {
    justifyContent: 'flex-end',
  },
  metaLeft: {
    justifyContent: 'flex-start',
  },
  timeText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  readStatus: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  readSent: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  readSeen: {
    color: '#00E676',
  },
  typingBanner: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
  },
  typingBannerText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.primary,
    fontStyle: 'italic',
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
  previewImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  previewThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primary,
  },
  previewFileBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  previewFileEmoji: {
    fontSize: 22,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: C.error,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  previewFileInfo: {
    flex: 1,
  },
  previewFileName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  previewFileMeta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    marginTop: 2,
  },
  actionMenuContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 28,
  },
  actionOption: {
    alignItems: 'center',
    gap: 6,
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  actionEmoji: {
    fontSize: 22,
  },
  actionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: C.text,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  plusButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  plusButtonActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  plusIcon: {
    fontSize: 22,
    color: C.primary,
    fontWeight: '600',
    lineHeight: 24,
  },
  plusIconActive: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    maxHeight: 100,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  textInput: {
    color: C.text,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 32,
    maxHeight: 90,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: C.primary,
  },
  sendButtonDisabled: {
    backgroundColor: '#2A2A3C',
    opacity: 0.6,
  },
  sendIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    marginLeft: 2,
  },
  headerThemeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerThemeIcon: {
    fontSize: 18,
  },
  headerSettingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: C.border,
  },
  headerSettingsBtnHighlighted: {
    backgroundColor: `${C.primary}20`,
    borderWidth: 1,
    borderColor: C.primary,
  },
  headerSettingsIcon: {
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
  settingsModalCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: C.border,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  settingsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsHeaderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.separator,
  },
  settingsHeaderInfo: {
    flex: 1,
  },
  settingsModalTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: C.text,
  },
  settingsModalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    marginTop: 2,
  },
  settingsItemsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  settingsItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  settingsItemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsItemIcon: {
    fontSize: 18,
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 2,
  },
  settingsItemDesc: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  settingsItemArrow: {
    fontSize: 20,
    color: C.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  settingsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  settingsBadgeActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.25)',
    borderWidth: 1,
    borderColor: C.primary,
  },
  settingsBadgeInactive: {
    backgroundColor: '#26263A',
  },
  settingsBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: C.textMuted,
  },
  settingsBadgeTextActive: {
    color: '#B0AAFF',
  },
  settingsBadgeEnabled: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  settingsBadgeTextEnabled: {
    color: '#81C784',
  },
  settingsBadgeMuted: {
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  settingsBadgeTextMuted: {
    color: '#FF8A80',
  },
  settingsCloseBtn: {
    backgroundColor: '#26263A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  settingsCloseBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  headerNameRow: {
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
    backgroundColor: '#1E1E2D',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C40',
    gap: 8,
  },
  chatSearchIcon: {
    fontSize: 15,
  },
  chatSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 4,
  },
  searchMatchCounter: {
    backgroundColor: '#28283E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  searchMatchText: {
    fontSize: 11,
    color: '#D0D0E0',
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
    backgroundColor: '#2A2A3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchNavArrow: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  closeSearchBtn: {
    padding: 4,
  },
  closeSearchText: {
    color: '#8A8A9E',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  themeModalCard: {
    backgroundColor: isDark ? '#1E1E2D' : '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: isDark ? '#2E2E42' : '#E2E8F0',
  },
  themeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  themeModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: isDark ? '#FFFFFF' : '#0F172A',
  },
  themeModalSubtitle: {
    fontSize: 12,
    color: isDark ? '#8A8A9E' : '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: C.textMuted,
    fontWeight: '600',
  },
  themeActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  themeActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#26263A' : '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: isDark ? '#32324D' : '#E2E8F0',
  },
  themeRemoveBtn: {
    backgroundColor: isDark ? 'rgba(255, 82, 82, 0.12)' : '#FEE2E2',
    borderColor: isDark ? 'rgba(255, 82, 82, 0.3)' : '#FECACA',
  },
  themeActionIcon: {
    fontSize: 16,
  },
  themeActionText: {
    color: isDark ? '#FFFFFF' : '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  presetHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: isDark ? '#C0C0D4' : '#334155',
    marginBottom: 10,
  },
  presetListContent: {
    paddingBottom: 8,
  },
  presetCard: {
    width: 90,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: isDark ? '#2A2A3E' : '#E2E8F0',
    backgroundColor: isDark ? '#161622' : '#FFFFFF',
    position: 'relative',
  },
  presetCardActive: {
    borderColor: C.primary,
  },
  presetCardThumb: {
    width: '100%',
    height: 64,
  },
  presetCardTitle: {
    fontSize: 11,
    color: isDark ? '#E0E0EE' : '#334155',
    textAlign: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    fontWeight: '500',
  },
  presetActiveBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: C.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetActiveCheck: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  updatingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 6,
  },
  updatingText: {
    color: C.primary,
    fontSize: 12,
    fontWeight: '500',
  },
});
