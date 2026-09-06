import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from '../../hooks/useToast';
import { photoService } from '../../services/photoService';
import { Photo, PhotoReaction } from '../../types';
import { CommentModal } from '../../components/CommentModal';
import { ShareModal } from '../../components/ShareModal';
import { PostOptionsModal } from '../../components/PostOptionsModal';
import { EditPostModal } from '../../components/EditPostModal';
import { ImageViewerModal } from '../../components/ImageViewerModal';

const C = Colors.dark;
const EMOJIS = ['❤️', '🔥', '😂', '😮', '😢'];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isConnected, socket } = useSocket();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reactingPhotoId, setReactingPhotoId] = useState<number | null>(null);
  const [activeCommentPhoto, setActiveCommentPhoto] = useState<Photo | null>(null);
  const [activeEmojiPopoverPhotoId, setActiveEmojiPopoverPhotoId] = useState<number | null>(null);
  const [activeSharePhoto, setActiveSharePhoto] = useState<Photo | null>(null);
  const [activeOptionsPhoto, setActiveOptionsPhoto] = useState<Photo | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [selectedViewerPhoto, setSelectedViewerPhoto] = useState<Photo | null>(null);

  // Search bài viết / bài đăng
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'friends' | 'public'>('friends');
  const [isSearchingBackend, setIsSearchingBackend] = useState(false);

  const fetchFeed = useCallback(async (query?: string, scope: 'friends' | 'public' = 'friends') => {
    try {
      const data = await photoService.getPhotoFeed(query, scope);
      setPhotos(data);
    } catch (error: unknown) {
      console.warn('Fetch feed error:', error);
      showToast('error', 'Không thể tải bảng tin Locket.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsSearchingBackend(false);
    }
  }, []);

  const handleSearchBackend = async (q: string, scope = searchScope) => {
    setIsSearchingBackend(true);
    fetchFeed(q.trim() || undefined, scope);
  };

  const handleScopeChange = (newScope: 'friends' | 'public') => {
    setSearchScope(newScope);
    setIsSearchingBackend(true);
    fetchFeed(searchQuery.trim() || undefined, newScope);
  };

  // Lọc bài viết realtime trên client theo caption và tên/username người đăng
  const filteredPhotos = useMemo(() => {
    if (!searchQuery.trim()) return photos;
    const q = searchQuery.toLowerCase().trim();
    return photos.filter((p) => {
      const captionMatch = p.caption ? p.caption.toLowerCase().includes(q) : false;
      const authorMatch = p.author_name ? p.author_name.toLowerCase().includes(q) : false;
      const usernameMatch = p.author_username ? p.author_username.toLowerCase().includes(q) : false;
      return captionMatch || authorMatch || usernameMatch;
    });
  }, [photos, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      fetchFeed();
    }, [fetchFeed])
  );

  // Socket event listener thời gian thực cho Feed bài viết & reactions
  useEffect(() => {
    if (!socket) return;

    const handleReactionUpdate = (data: { photo_id: number; reactions: PhotoReaction[] }) => {
      setPhotos((prevPhotos) =>
        prevPhotos.map((p) => {
          if (p.id === data.photo_id) {
            return { ...p, reactions: data.reactions };
          }
          return p;
        })
      );
    };

    const handleNewPhotoPosted = (data: { photo: Photo }) => {
      if (data.photo && data.photo.id) {
        setPhotos((prev) => {
          if (prev.some((p) => p.id === data.photo.id)) return prev;
          return [data.photo, ...prev];
        });
      }
    };

    const handleNewComment = (data: { photo_id: number }) => {
      setPhotos((prevPhotos) =>
        prevPhotos.map((p) => {
          if (p.id === data.photo_id) {
            return { ...p, comment_count: (p.comment_count || 0) + 1 };
          }
          return p;
        })
      );
    };

    socket.on('photo_reaction_updated', handleReactionUpdate);
    socket.on('new_photo_posted', handleNewPhotoPosted);
    socket.on('new_comment', handleNewComment);

    return () => {
      socket.off('photo_reaction_updated', handleReactionUpdate);
      socket.off('new_photo_posted', handleNewPhotoPosted);
      socket.off('new_comment', handleNewComment);
    };
  }, [socket]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  const confirmDeletePhoto = (photo: Photo) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Bạn có chắc chắn muốn xóa bài đăng này không?')) {
        handleDeletePhoto(photo.id);
      }
    } else {
      Alert.alert(
        'Xóa bài đăng',
        'Bạn có chắc chắn muốn xóa bài đăng khoảnh khắc này không?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xóa',
            style: 'destructive',
            onPress: () => handleDeletePhoto(photo.id),
          },
        ]
      );
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    setDeletingId(photoId);
    try {
      const msg = await photoService.deletePhoto(photoId);
      showToast('info', msg);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Xóa ảnh thất bại.';
      showToast('error', errMsg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleReaction = async (photoId: number, emoji: string) => {
    setReactingPhotoId(photoId);
    try {
      const res = await photoService.toggleReaction(photoId, emoji);
      setPhotos((prev) =>
        prev.map((p) => {
          if (p.id === photoId) {
            return { ...p, reactions: res.reactions };
          }
          return p;
        })
      );
    } catch (error: any) {
      showToast('error', error.message || 'Lỗi thả cảm xúc.');
    } finally {
      setReactingPhotoId(null);
    }
  };

  const handleSharePhoto = async (item: Photo) => {
    try {
      const message = `${item.author_name} chia sẻ khoảnh khắc trên Masita: ${item.caption || ''}\n${item.image_url}`;
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(item.image_url);
          showToast('success', 'Đã sao chép liên kết ảnh vào bộ nhớ tạm! 📋');
        } else {
          showToast('info', 'Liên kết: ' + item.image_url);
        }
      } else {
        await Share.share({
          title: 'Khoảnh khắc Masita 📸',
          message,
          url: item.image_url,
        });
      }
    } catch (e: any) {
      console.warn('Share error:', e);
    }
  };

  // Format relative date (vd: "Vừa xong", "10 phút trước", "15:30 06/09")
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const renderPhotoCard = ({ item }: { item: Photo }) => {
    const isOwner = user?.id === item.user_id;
    const authorAvatarUri = item.author_avatar
      ? { uri: item.author_avatar }
      : require('../../assets/splash-icon.png');

    const reactions = item.reactions || [];
    // Tính toán Top 2 Emoji có lượt thả nhiều nhất (giới hạn tối đa đúng 2 emoji)
    const validReactions = reactions.filter((r) => r.count > 0);
    const sortedReactions = [...validReactions].sort((a, b) => b.count - a.count);
    const top2Reactions = sortedReactions.slice(0, 2);
    const totalReactionsCount = validReactions.reduce((acc, r) => acc + r.count, 0);

    const userReaction = reactions.find((r) => r.user_reacted);
    const hasUserReacted = !!userReaction;

    return (
      <View style={styles.photoCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <Image source={authorAvatarUri} style={styles.authorAvatar} />
          <View style={styles.authorInfo}>
            <View style={styles.authorRow}>
              <Text style={styles.authorName} numberOfLines={1}>
                {item.author_name}
              </Text>
              {item.recipient_name ? (
                <Text style={styles.recipientTag} numberOfLines={1}>
                  {' '}➔ {item.recipient_name}
                </Text>
              ) : null}
            </View>
            <View style={styles.timeAndPrivacyRow}>
              <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <View style={[
                styles.privacyBadge,
                item.privacy === 'public' && styles.privacyBadgePublic,
                item.privacy === 'private' && styles.privacyBadgePrivate,
              ]}>
                <Text style={styles.privacyBadgeText}>
                  {item.privacy === 'public'
                    ? '🌐 Công khai'
                    : item.privacy === 'private'
                    ? '🔒 Riêng tư'
                    : '👥 Bạn bè coi'}
                </Text>
              </View>
            </View>
          </View>

          {isOwner && (
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => setActiveOptionsPhoto(item)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.6}
            >
              <Text style={styles.moreBtnText}>•••</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Photo Image (Chạm để mở chế độ xem toàn màn hình và phóng to/thu nhỏ) */}
        <TouchableOpacity
          style={styles.imageContainer}
          activeOpacity={0.92}
          onPress={() => setSelectedViewerPhoto(item)}
        >
          <Image
            source={{ uri: item.image_url }}
            style={styles.photoImage}
            resizeMode="cover"
            {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as any) : {})}
          />

          {/* Biểu tượng góc bên phải: hiện số lượt thẻ emoji nhiều nhất và giới hạn 2 emoji */}
          {top2Reactions.length > 0 && (
            <View style={styles.topEmojiFloatBadge}>
              <Text style={styles.topEmojiFloatIcons}>
                {top2Reactions.map((r) => r.emoji).join(' ')}
              </Text>
              <Text style={styles.topEmojiFloatCount}>
                {totalReactionsCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Caption */}
        {item.caption ? (
          <View style={styles.captionContainer}>
            <Text style={styles.captionText}>{item.caption}</Text>
          </View>
        ) : null}

        {/* Social Metrics Bar: Lượt thích và Số bình luận */}
        {(totalReactionsCount > 0 || (item.comment_count && item.comment_count > 0)) ? (
          <View style={styles.metricsBar}>
            {top2Reactions.length > 0 ? (
              <View style={styles.metricsReactionTag}>
                <Text style={styles.metricsEmojiIcons}>
                  {top2Reactions.map((r) => r.emoji).join('')}
                </Text>
                <Text style={styles.metricsReactionCount}>
                  {totalReactionsCount} lượt tương tác
                </Text>
              </View>
            ) : <View />}

            {item.comment_count && item.comment_count > 0 ? (
              <TouchableOpacity onPress={() => setActiveCommentPhoto(item)}>
                <Text style={styles.metricsCommentText}>
                  {item.comment_count} bình luận
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Action Bar: 3 Nút Thích, Bình luận, Chia sẻ */}
        <View style={styles.mainActionBar}>
          {/* Floating Emoji Dock khi ấn giữ nút Thích */}
          {activeEmojiPopoverPhotoId === item.id && (
            <View style={styles.floatingEmojiDock}>
              {EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.floatingEmojiItem}
                  onPress={() => {
                    setActiveEmojiPopoverPhotoId(null);
                    handleToggleReaction(item.id, emoji);
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={styles.floatingEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.mainActionBtn, hasUserReacted && styles.mainActionBtnActive]}
            onPress={() => {
              if (activeEmojiPopoverPhotoId === item.id) {
                setActiveEmojiPopoverPhotoId(null);
              } else {
                handleToggleReaction(item.id, userReaction ? userReaction.emoji : '❤️');
              }
            }}
            onLongPress={() => {
              setActiveEmojiPopoverPhotoId(item.id);
            }}
            delayLongPress={220}
            activeOpacity={0.7}
          >
            <Text style={styles.mainActionIcon}>{hasUserReacted ? userReaction.emoji : '🤍'}</Text>
            <Text style={[styles.mainActionText, hasUserReacted && styles.mainActionTextActive]}>
              {hasUserReacted ? 'Đã thích' : 'Thích'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mainActionBtn}
            onPress={() => {
              setActiveEmojiPopoverPhotoId(null);
              setActiveCommentPhoto(item);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.mainActionIcon}>💬</Text>
            <Text style={styles.mainActionText}>
              Bình luận {item.comment_count && item.comment_count > 0 ? `(${item.comment_count})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mainActionBtn}
            onPress={() => {
              setActiveEmojiPopoverPhotoId(null);
              setActiveSharePhoto(item);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.mainActionIcon}>↗️</Text>
            <Text style={styles.mainActionText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar style="light" />

      {/* App Bar hoặc Search Bar bài viết */}
      {isSearchVisible ? (
        <View style={styles.searchHeaderContainer}>
          <View style={styles.searchBarWrapper}>
            <View style={styles.searchBarBox}>
              <Text style={styles.searchBarIcon}>🔍</Text>
              <TextInput
                style={styles.searchBarInput}
                placeholder={
                  searchScope === 'friends'
                    ? 'Tìm bài viết của bạn bè...'
                    : 'Khám phá bài viết công khai của mọi người...'
                }
                placeholderTextColor={C.textMuted}
                value={searchQuery}
                onChangeText={(text) => setSearchQuery(text)}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={() => handleSearchBackend(searchQuery, searchScope)}
              />
              {isSearchingBackend ? (
                <ActivityIndicator size="small" color={C.primary} style={{ marginRight: 6 }} />
              ) : searchQuery.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    fetchFeed(undefined, searchScope);
                  }}
                  style={styles.clearSearchBtn}
                >
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.closeSearchBtn}
              onPress={() => {
                setIsSearchVisible(false);
                setSearchQuery('');
                setSearchScope('friends');
                fetchFeed();
              }}
            >
              <Text style={styles.closeSearchText}>Đóng</Text>
            </TouchableOpacity>
          </View>

          {/* 2 Scope Switcher: Bạn bè vs Khám phá (Công khai) */}
          <View style={styles.scopeSwitcherRow}>
            <TouchableOpacity
              style={[
                styles.scopeChip,
                searchScope === 'friends' && styles.scopeChipActive,
              ]}
              onPress={() => handleScopeChange('friends')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.scopeChipText,
                  searchScope === 'friends' && styles.scopeChipTextActive,
                ]}
              >
                👥 Bài viết bạn bè
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.scopeChip,
                searchScope === 'public' && styles.scopeChipActive,
              ]}
              onPress={() => handleScopeChange('public')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.scopeChipText,
                  searchScope === 'public' && styles.scopeChipTextActive,
                ]}
              >
                🌐 Khám phá (Toàn MXH)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.appBar}>
          <Text style={styles.appName}>Masita 📸</Text>

          <View style={styles.appBarRight}>
            <View style={[styles.socketBadge, isConnected ? styles.socketOn : styles.socketOff]}>
              <View style={[styles.socketDot, isConnected ? styles.dotOn : styles.dotOff]} />
              <Text style={styles.socketText}>{isConnected ? 'Online' : 'Offline'}</Text>
            </View>

            <TouchableOpacity
              style={styles.btnHeaderCamera}
              onPress={() => router.push('/add-photo')}
            >
              <Text style={styles.btnHeaderCameraText}>+ Khoảnh khắc</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => setIsSearchVisible(true)}
              accessibilityLabel="Tìm kiếm bài viết"
            >
              <Text style={styles.searchBtnText}>🔍</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Banner thông báo kết quả tìm kiếm bài viết */}
      {isSearchVisible && searchQuery.trim().length > 0 && (
        <View style={styles.searchBanner}>
          <Text style={styles.searchBannerText} numberOfLines={1}>
            {searchScope === 'friends' ? '👥 Bạn bè' : '🌐 Khám phá'}: "{searchQuery.trim()}" ({filteredPhotos.length} bài)
          </Text>
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              fetchFeed(undefined, searchScope);
            }}
          >
            <Text style={styles.searchBannerReset}>Bỏ lọc</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Feed Stream */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Đang tải khoảnh khắc Locket...</Text>
        </View>
      ) : filteredPhotos.length === 0 ? (
        <View style={styles.centerContainer}>
          {searchQuery.trim().length > 0 ? (
            <>
              <Text style={styles.emptyEmoji}>🔎</Text>
              <Text style={styles.emptyTitle}>Không tìm thấy bài viết</Text>
              <Text style={styles.emptySub}>
                Không có bài viết nào khớp với từ khóa "{searchQuery}" trong phạm vi{' '}
                {searchScope === 'friends' ? 'bạn bè' : 'khám phá công khai'}.
              </Text>
              {searchScope === 'friends' && (
                <TouchableOpacity
                  style={styles.btnSwitchExplore}
                  onPress={() => handleScopeChange('public')}
                >
                  <Text style={styles.btnSwitchExploreText}>
                    🌐 Tìm kiếm trong Khám phá công khai
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.btnCreateFirst}
                onPress={() => {
                  setSearchQuery('');
                  fetchFeed(undefined, searchScope);
                }}
              >
                <Text style={styles.btnCreateFirstText}>✕ Xóa từ khóa tìm kiếm</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.emptyEmoji}>📸</Text>
              <Text style={styles.emptyTitle}>Chưa có khoảnh khắc nào</Text>
              <Text style={styles.emptySub}>
                Hãy đăng khoảnh khắc đầu tiên của bạn hoặc kết bạn thêm để ngắm nhìn ảnh từ bạn bè!
              </Text>
              <TouchableOpacity
                style={styles.btnCreateFirst}
                onPress={() => router.push('/add-photo')}
              >
                <Text style={styles.btnCreateFirstText}>📷 Chia sẻ khoảnh khắc ngay</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredPhotos}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPhotoCard}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => {
            if (activeEmojiPopoverPhotoId) {
              setActiveEmojiPopoverPhotoId(null);
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
            />
          }
        />
      )}

      {/* Comment Modal */}
      <CommentModal
        visible={!!activeCommentPhoto}
        photoId={activeCommentPhoto ? activeCommentPhoto.id : null}
        onClose={() => setActiveCommentPhoto(null)}
        onCommentCountChange={(pId, newCount) => {
          setPhotos((prev) =>
            prev.map((p) => (p.id === pId ? { ...p, comment_count: newCount } : p))
          );
        }}
      />

      {/* Share Modal */}
      <ShareModal
        visible={!!activeSharePhoto}
        photo={activeSharePhoto}
        onClose={() => setActiveSharePhoto(null)}
      />

      {/* Post Options Modal (Nút 3 chấm) */}
      <PostOptionsModal
        visible={!!activeOptionsPhoto}
        photo={activeOptionsPhoto}
        onClose={() => setActiveOptionsPhoto(null)}
        onEdit={(photo) => {
          setEditingPhoto(photo);
        }}
        onDelete={(photo) => {
          confirmDeletePhoto(photo);
        }}
      />

      {/* Edit Post Modal (Chỉnh sửa bài đăng) */}
      <EditPostModal
        visible={!!editingPhoto}
        photo={editingPhoto}
        onClose={() => setEditingPhoto(null)}
        onSuccess={(updated) => {
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === updated.id
                ? {
                    ...p,
                    caption: updated.caption,
                    privacy: updated.privacy || p.privacy,
                  }
                : p
            )
          );
        }}
      />

      {/* ImageViewerModal (Xem ảnh toàn màn hình & Phóng to / Thu nhỏ) */}
      <ImageViewerModal
        visible={!!selectedViewerPhoto}
        photo={selectedViewerPhoto}
        onClose={() => setSelectedViewerPhoto(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  appName: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: C.primary,
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  socketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  socketOn: { backgroundColor: `${C.success}20` },
  socketOff: { backgroundColor: `${C.error}20` },
  socketDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOn: { backgroundColor: C.success },
  dotOff: { backgroundColor: C.error },
  socketText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
  },
  btnHeaderCamera: {
    backgroundColor: C.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  btnHeaderCameraText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  searchBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${C.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${C.primary}50`,
  },
  searchBtnText: {
    fontSize: 14,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  photoCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.separator,
  },
  authorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  recipientTag: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.primaryLight,
  },
  timeAndPrivacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  dotSeparator: {
    fontSize: 11,
    color: C.textMuted,
    marginHorizontal: 5,
  },
  privacyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: `${C.primary}18`,
    borderWidth: 1,
    borderColor: `${C.primary}35`,
  },
  privacyBadgePublic: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderColor: 'rgba(52, 199, 89, 0.35)',
  },
  privacyBadgePrivate: {
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    borderColor: 'rgba(255, 149, 0, 0.35)',
  },
  privacyBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
  },
  moreBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  moreBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: C.textMuted,
    letterSpacing: 2,
  },
  imageContainer: {
    width: '100%',
    height: 380,
    backgroundColor: '#000000',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: C.card,
  },
  captionText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: C.text,
    lineHeight: 22,
  },
  topEmojiFloatBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 14, 23, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  topEmojiFloatIcons: {
    fontSize: 15,
    marginRight: 4,
  },
  topEmojiFloatCount: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  metricsReactionTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricsEmojiIcons: {
    fontSize: 14,
    marginRight: 6,
  },
  metricsReactionCount: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: C.textMuted,
  },
  metricsCommentText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  mainActionBar: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: `${C.border}50`,
    marginTop: 6,
    zIndex: 10,
  },
  floatingEmojiDock: {
    position: 'absolute',
    bottom: 46,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E2F',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 20,
    zIndex: 9999,
    gap: 6,
  },
  floatingEmojiItem: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingEmojiText: {
    fontSize: 22,
  },
  mainActionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  mainActionBtnActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
  },
  mainActionIcon: {
    fontSize: 16,
  },
  mainActionText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.textMuted,
  },
  mainActionTextActive: {
    color: C.primaryLight,
  },
  reactionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: `${C.card}`,
    borderTopWidth: 1,
    borderTopColor: `${C.border}30`,
  },
  emojiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: `${C.border}40`,
    gap: 4,
  },
  emojiBtnActive: {
    backgroundColor: `${C.primary}35`,
    borderWidth: 1,
    borderColor: C.primary,
  },
  emojiText: {
    fontSize: 16,
  },
  emojiCount: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: C.textMuted,
  },
  emojiCountActive: {
    color: C.primaryLight,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: C.textMuted,
    fontSize: 14,
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
  },
  emptyEmoji: {
    fontSize: 54,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  btnCreateFirst: {
    backgroundColor: C.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  btnCreateFirstText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  searchHeaderContainer: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 10,
  },
  searchBarBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: `${C.primary}40`,
  },
  searchBarIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.text,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 14,
    color: C.textMuted,
  },
  closeSearchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  closeSearchText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.primary,
  },
  scopeSwitcherRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#242426',
    borderWidth: 1,
    borderColor: C.border,
  },
  scopeChipActive: {
    backgroundColor: `${C.primary}25`,
    borderColor: C.primary,
  },
  scopeChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: C.textMuted,
  },
  scopeChipTextActive: {
    color: C.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  searchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${C.primary}15`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${C.primary}30`,
  },
  searchBannerText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: C.primaryLight || C.primary,
    flex: 1,
  },
  searchBannerReset: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: C.textMuted,
    marginLeft: 8,
  },
  btnSwitchExplore: {
    backgroundColor: `${C.primary}20`,
    borderWidth: 1,
    borderColor: C.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
  },
  btnSwitchExploreText: {
    color: C.primaryLight || C.primary,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
