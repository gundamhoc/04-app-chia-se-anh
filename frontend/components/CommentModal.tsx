import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  KeyboardEvent,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ColorScheme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { CommentItem, CommentReaction } from '../types';
import { commentService } from '../services/commentService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useI18n } from '../utils/i18n';
import { useRouter } from 'expo-router';

const VALID_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢'];

interface CommentModalProps {
  visible: boolean;
  photoId: number | null;
  onClose: () => void;
  onCommentCountChange?: (photoId: number, count: number) => void;
}

export const CommentModal: React.FC<CommentModalProps> = ({
  visible,
  photoId,
  onClose,
  onCommentCountChange,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const handleUserProfilePress = (authorId: number) => {
    onClose();
    if (authorId === user?.id) {
      router.push('/(tabs)/profile');
    } else {
      router.push({
        pathname: '/user/[id]',
        params: { id: authorId.toString() },
      });
    }
  };
  const { colors: C, isDark } = useTheme();
  const { t, formatTime } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{
    id: number;
    username: string;
    name: string;
  } | null>(null);
  const [activeEmojiPopoverCommentId, setActiveEmojiPopoverCommentId] = useState<number | null>(null);

  const inputRef = useRef<TextInput | null>(null);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Lắng nghe sự kiện bàn phím để đẩy modal lên trên (Android Modal không tự adjustResize)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Chiều cao tối đa an toàn của card khi bàn phím xuất hiện
  const maxCardHeight = useMemo(() => {
    if (keyboardHeight > 0) {
      return Math.max(260, windowHeight - keyboardHeight - Math.max(insets.top, 24) - 10);
    }
    return windowHeight * 0.8;
  }, [windowHeight, keyboardHeight, insets.top]);

  useEffect(() => {
    if (visible && photoId) {
      loadComments(photoId);
    } else {
      setComments([]);
      setInputText('');
      setReplyingTo(null);
      setActiveEmojiPopoverCommentId(null);
      setKeyboardHeight(0);
    }
  }, [visible, photoId]);

  const loadComments = async (pId: number) => {
    setLoading(true);
    try {
      const data = await commentService.getComments(pId);
      setComments(data);
      onCommentCountChange?.(pId, data.length);
    } catch (e: any) {
      showToast('error', e.message || t('load_comments_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!photoId || !inputText.trim() || submitting) return;

    const content = inputText.trim();
    setSubmitting(true);

    try {
      const newComment = await commentService.createComment(
        photoId,
        content,
        replyingTo ? replyingTo.id : null
      );

      const updated = [...comments, newComment];
      setComments(updated);
      onCommentCountChange?.(photoId, updated.length);

      setInputText('');
      setReplyingTo(null);
    } catch (e: any) {
      showToast('error', e.message || t('send_comment_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    const doDelete = async () => {
      try {
        await commentService.deleteComment(commentId);
        const updated = comments.filter((c) => c.id !== commentId);
        setComments(updated);
        if (photoId) {
          onCommentCountChange?.(photoId, updated.length);
        }
        showToast('info', t('delete_comment_success'));
      } catch (e: any) {
        showToast('error', e.message || t('delete_comment_error'));
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('delete_comment_confirm'))) {
        await doDelete();
      }
    } else {
      Alert.alert(t('delete_comment_title'), t('delete_comment_confirm'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleToggleReaction = async (commentId: number, emoji: string) => {
    try {
      const res = await commentService.toggleCommentReaction(commentId, emoji);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, reactions: res.reactions } : c))
      );
    } catch (e: any) {
      showToast('error', e.message || t('react_comment_error'));
    }
  };

  const renderCommentItem = ({ item }: { item: CommentItem }) => {
    const isOwner = user?.id === item.user_id;
    const avatarUri = item.author_avatar
      ? { uri: item.author_avatar }
      : require('../assets/splash-icon.png');
    const isReply = !!item.parent_id;

    const reactions = item.reactions || [];
    const userReaction = reactions.find((r) => r.user_reacted);
    const hasUserReacted = !!userReaction;
    const totalReactionsCount = reactions.reduce((acc, r) => acc + r.count, 0);
    const topReactions = [...reactions].sort((a, b) => b.count - a.count).slice(0, 2);

    return (
      <View style={[styles.commentRow, isReply && styles.replyRow]}>
        <TouchableOpacity
          onPress={() => handleUserProfilePress(item.user_id)}
          activeOpacity={0.7}
        >
          <Image source={avatarUri} style={styles.commentAvatar} />
        </TouchableOpacity>

        <View style={styles.commentBody}>
          {/* Header info */}
          <View style={styles.commentHeader}>
            <TouchableOpacity
              onPress={() => handleUserProfilePress(item.user_id)}
              activeOpacity={0.7}
            >
              <Text style={styles.commentAuthorName} numberOfLines={1}>
                {item.author_name || item.author_username}
              </Text>
            </TouchableOpacity>
            <Text style={styles.commentTime}>{formatTime(item.created_at)}</Text>
          </View>

          {/* Reply tag if replying */}
          {item.reply_to_username && (
            <Text style={styles.replyToText}>
              {t('reply_to_tag')} <Text style={styles.replyToHighlight}>@{item.reply_to_username}</Text>
            </Text>
          )}

          {/* Content */}
          <Text style={styles.commentContent}>{item.content}</Text>

          {/* Actions: Thích + Trả lời + Badge + Xóa */}
          <View style={styles.commentActions}>
            {/* Floating Emoji Dock khi ấn giữ nút Thích của comment */}
            {activeEmojiPopoverCommentId === item.id && (
              <View style={styles.floatingEmojiDock}>
                {VALID_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.floatingEmojiItem,
                      hasUserReacted && userReaction.emoji === emoji && styles.floatingEmojiItemActive,
                    ]}
                    onPress={() => {
                      setActiveEmojiPopoverCommentId(null);
                      handleToggleReaction(item.id, emoji);
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.floatingEmojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Nút Thích (giống bài đăng: 🤍 Thích / <Emoji> Đã thích) */}
            <TouchableOpacity
              style={[styles.commentActionBtn, hasUserReacted && styles.commentActionBtnActive]}
              onPress={() => {
                if (activeEmojiPopoverCommentId === item.id) {
                  setActiveEmojiPopoverCommentId(null);
                } else {
                  handleToggleReaction(item.id, userReaction ? userReaction.emoji : '❤️');
                }
              }}
              onLongPress={() => {
                setActiveEmojiPopoverCommentId(item.id);
              }}
              delayLongPress={220}
              activeOpacity={0.7}
            >
              <Text style={styles.commentActionIcon}>
                {hasUserReacted ? userReaction.emoji : '🤍'}
              </Text>
              <Text style={[styles.commentActionText, hasUserReacted && styles.commentActionTextActive]}>
                {hasUserReacted ? t('liked') : t('like')}
              </Text>
            </TouchableOpacity>

            {/* Nút Trả lời (giống bài đăng: 💬 Trả lời) */}
            <TouchableOpacity
              style={styles.commentActionBtn}
              onPress={() => {
                setActiveEmojiPopoverCommentId(null);
                setReplyingTo({
                  id: item.id,
                  username: item.author_username,
                  name: item.author_name || item.author_username,
                });
                inputRef.current?.focus();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.commentActionIcon}>💬</Text>
              <Text style={styles.commentActionText}>{t('reply')}</Text>
            </TouchableOpacity>

            {/* Badge hiển thị tương tác nếu có */}
            {totalReactionsCount > 0 && (
              <TouchableOpacity
                style={styles.commentReactionsBadge}
                activeOpacity={0.8}
                onPress={() => {
                  setActiveEmojiPopoverCommentId(item.id);
                }}
              >
                <Text style={styles.commentReactionsBadgeIcons}>
                  {topReactions.map((r) => r.emoji).join('')}
                </Text>
                <Text style={styles.commentReactionsBadgeCount}>
                  {totalReactionsCount}
                </Text>
              </TouchableOpacity>
            )}

            {isOwner && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  setActiveEmojiPopoverCommentId(null);
                  handleDeleteComment(item.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteBtnText}>{t('delete')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => {
            if (activeEmojiPopoverCommentId) {
              setActiveEmojiPopoverCommentId(null);
            } else {
              onClose();
            }
          }}
        />

        <View
          style={[
            styles.modalCard,
            {
              maxHeight: maxCardHeight,
              marginBottom: Platform.OS === 'android' ? keyboardHeight : 0,
              paddingBottom: keyboardHeight > 0 ? 8 : Platform.OS === 'ios' ? 24 : Math.max(insets.bottom, 12),
            },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.dragBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              💬 {t('comments_title')} {comments.length > 0 ? `(${comments.length})` : ''}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Comments list */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.loadingText}>{t('loading')}</Text>
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>{t('comments_title')}</Text>
              <Text style={styles.emptySub}>{t('comments_empty')}</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderCommentItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => setActiveEmojiPopoverCommentId(null)}
            />
          )}

          {/* Reply indicator banner */}
          {replyingTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {t('replying_to')} <Text style={{ fontWeight: 'bold' }}>@{replyingTo.username}</Text>
              </Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Text style={styles.cancelReplyText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Comment Input Footer */}
          <View style={styles.inputBar}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={replyingTo ? `${t('reply')} @${replyingTo.username}...` : t('write_comment')}
              placeholderTextColor={C.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() || submitting) && styles.sendBtnDisabled,
              ]}
              onPress={handleSendComment}
              disabled={!inputText.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sendBtnText}>{t('send')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (C: ColorScheme, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '45%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  dragBar: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: C.text,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  closeText: {
    color: C.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: C.textMuted,
    fontSize: 13,
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  replyRow: {
    marginLeft: 32,
    borderLeftWidth: 2,
    borderLeftColor: C.border,
    paddingLeft: 10,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.separator,
    marginRight: 10,
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentAuthorName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    flex: 1,
  },
  commentTime: {
    fontSize: 11,
    color: C.textMuted,
    marginLeft: 8,
  },
  replyToText: {
    fontSize: 12,
    color: C.textMuted,
    marginBottom: 2,
  },
  replyToHighlight: {
    color: C.primary,
    fontWeight: '600',
  },
  commentContent: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.text,
    lineHeight: 20,
    marginBottom: 6,
  },
  commentActions: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 12,
    zIndex: 10,
  },
  commentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 5,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  commentActionBtnActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.18)',
    borderColor: C.primary,
  },
  commentActionIcon: {
    fontSize: 14,
  },
  commentActionText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: C.textMuted,
  },
  commentActionTextActive: {
    color: C.primaryLight,
  },
  commentReactionsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 3,
  },
  commentReactionsBadgeIcons: {
    fontSize: 11,
  },
  commentReactionsBadgeCount: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: C.text,
  },
  floatingEmojiDock: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.5 : 0.15,
    shadowRadius: 8,
    elevation: 20,
    zIndex: 9999,
    gap: 6,
  },
  floatingEmojiItem: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 12,
  },
  floatingEmojiItemActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.18)',
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  floatingEmojiText: {
    fontSize: 18,
  },
  deleteBtn: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginLeft: 'auto',
  },
  deleteBtnText: {
    fontSize: 11,
    color: C.error,
  },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  replyBannerText: {
    fontSize: 12,
    color: C.textMuted,
    flex: 1,
  },
  cancelReplyText: {
    fontSize: 12,
    color: C.error,
    fontWeight: '600',
    marginLeft: 10,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.card,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    backgroundColor: C.inputBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
    fontFamily: 'Inter_400Regular',
    marginRight: 10,
  },
  sendBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
