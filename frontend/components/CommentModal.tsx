import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Colors } from '../constants/Colors';
import { CommentItem, CommentReaction } from '../types';
import { commentService } from '../services/commentService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const C = Colors.dark;
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
  const { user } = useAuth();
  const { showToast } = useToast();

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

  useEffect(() => {
    if (visible && photoId) {
      loadComments(photoId);
    } else {
      setComments([]);
      setInputText('');
      setReplyingTo(null);
      setActiveEmojiPopoverCommentId(null);
    }
  }, [visible, photoId]);

  const loadComments = async (pId: number) => {
    setLoading(true);
    try {
      const data = await commentService.getComments(pId);
      setComments(data);
      onCommentCountChange?.(pId, data.length);
    } catch (e: any) {
      showToast('error', e.message || 'Không thể tải danh sách bình luận.');
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
      showToast('error', e.message || 'Gửi bình luận thất bại.');
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
        showToast('info', 'Đã xóa bình luận.');
      } catch (e: any) {
        showToast('error', e.message || 'Xóa bình luận thất bại.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Bạn có chắc muốn xóa bình luận này?')) {
        await doDelete();
      }
    } else {
      Alert.alert('Xóa bình luận', 'Bạn có chắc muốn xóa bình luận này?', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa', style: 'destructive', onPress: doDelete },
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
      showToast('error', e.message || 'Không thể thả cảm xúc.');
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins}p trước`;
      if (diffHours < 24) return `${diffHours}h trước`;
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return '';
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
        <Image source={avatarUri} style={styles.commentAvatar} />

        <View style={styles.commentBody}>
          {/* Header info */}
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthorName} numberOfLines={1}>
              {item.author_name || item.author_username}
            </Text>
            <Text style={styles.commentTime}>{formatTime(item.created_at)}</Text>
          </View>

          {/* Reply tag if replying */}
          {item.reply_to_username && (
            <Text style={styles.replyToText}>
              Trả lời <Text style={styles.replyToHighlight}>@{item.reply_to_username}</Text>
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
                    style={styles.floatingEmojiItem}
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
                {hasUserReacted ? 'Đã thích' : 'Thích'}
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
              <Text style={styles.commentActionText}>Trả lời</Text>
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
                <Text style={styles.deleteBtnText}>Xóa</Text>
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

        <View style={styles.modalCard}>
          {/* Drag handle */}
          <View style={styles.dragBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              💬 Bình luận {comments.length > 0 ? `(${comments.length})` : ''}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Comments list */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.loadingText}>Đang tải bình luận...</Text>
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>Chưa có bình luận nào</Text>
              <Text style={styles.emptySub}>Hãy là người đầu tiên chia sẻ cảm nghĩ nhé!</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderCommentItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={() => setActiveEmojiPopoverCommentId(null)}
            />
          )}

          {/* Reply indicator banner */}
          {replyingTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                Đang trả lời <Text style={{ fontWeight: 'bold' }}>@{replyingTo.username}</Text>
              </Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Text style={styles.cancelReplyText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Comment Input Footer */}
          <View style={styles.inputBar}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={replyingTo ? `Trả lời @${replyingTo.username}...` : 'Viết bình luận...'}
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
                <Text style={styles.sendBtnText}>Gửi</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: '#161622',
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
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    backgroundColor: C.card,
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
    color: '#FFFFFF',
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
    color: '#E0E0EE',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  commentActionBtnActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.18)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 3,
  },
  commentReactionsBadgeIcons: {
    fontSize: 11,
  },
  commentReactionsBadgeCount: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  floatingEmojiDock: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E2F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
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
    backgroundColor: '#1E1E2F',
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
    backgroundColor: '#12121D',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    backgroundColor: '#1C1C2A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#FFFFFF',
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
