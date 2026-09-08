import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  RefreshControl,
  Share,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ColorScheme } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../utils/i18n';
import { useToast } from '../../hooks/useToast';
import { useAuthStore } from '../../store/authStore';
import { useSocket } from '../../hooks/useSocket';
import { friendService } from '../../services/friendService';
import { BASE_URL } from '../../services/api';
import { Photo, OtherUserProfile, FriendshipStatus } from '../../types';
import { ImageViewerModal } from '../../components/ImageViewerModal';

const getAvatarUrl = (avatarUrl?: string | null): string | null => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  const base = BASE_URL.replace(/\/api\/?$/, '');
  return `${base}${avatarUrl}`;
};

export default function OtherUserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user: currentUser } = useAuthStore();
  const { showToast } = useToast();
  const { isUserOnline } = useSocket();
  const { colors: C, isDark } = useTheme();
  const { t } = useI18n();

  const targetUserId = parseInt(params.id || '0', 10);

  const styles = useMemo(() => createStyles(C, isDark, windowWidth), [C, isDark, windowWidth]);

  // Data states
  const [profileUser, setProfileUser] = useState<OtherUserProfile | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal xem ảnh toàn màn hình
  const [selectedPhotoForView, setSelectedPhotoForView] = useState<Photo | null>(null);

  // Kích thước ô lưới ảnh (3 cột)
  const gridItemSize = useMemo(() => {
    const horizontalPadding = 16 * 2;
    const gap = 4 * 2;
    return Math.floor((windowWidth - horizontalPadding - gap) / 3);
  }, [windowWidth]);

  // Tải dữ liệu hồ sơ
  const loadProfile = useCallback(async () => {
    if (!targetUserId || isNaN(targetUserId)) {
      showToast('error', 'ID người dùng không hợp lệ.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await friendService.getUserProfile(targetUserId);
      setProfileUser(data.user);
      setPhotos(data.photos || []);
      setIsLocked(Boolean(data.is_locked));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải thông tin trang cá nhân.';
      showToast('error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetUserId, showToast]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  // Chia sẻ liên kết trang cá nhân
  const handleShareProfile = async () => {
    if (!profileUser) return;
    const profileUrl = `https://masita.app/u/${profileUser.username}`;
    const shareMessage = `Xem hồ sơ của ${profileUser.full_name || profileUser.username} (@${profileUser.username}) trên Masita! 🌟\n${profileUrl}`;

    try {
      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(profileUrl);
          showToast('success', 'Đã sao chép liên kết trang cá nhân vào khay nhớ tạm! 📋');
        } else {
          await Clipboard.setStringAsync(profileUrl);
          showToast('success', 'Đã sao chép liên kết trang cá nhân! 📋');
        }
      } else {
        await Share.share({
          message: shareMessage,
          url: profileUrl,
          title: `Hồ sơ Masita của @${profileUser.username}`,
        });
      }
    } catch (e) {
      console.warn('Share profile error:', e);
    }
  };

  // 1. Gửi lời mời kết bạn
  const handleSendRequest = async () => {
    if (!profileUser || actionLoading) return;
    setActionLoading(true);
    try {
      await friendService.sendFriendRequest(profileUser.id);
      showToast('success', `Đã gửi lời mời kết bạn tới ${profileUser.full_name || profileUser.username}! 🎉`);
      setProfileUser((prev) => (prev ? { ...prev, friendship_status: 'pending_sent' } : null));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể gửi lời mời kết bạn.';
      showToast('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Chấp nhận lời mời kết bạn
  const handleAcceptRequest = async () => {
    if (!profileUser || actionLoading) return;
    setActionLoading(true);
    try {
      await friendService.acceptFriendRequest(profileUser.id);
      showToast('success', `Đã đồng ý kết bạn với ${profileUser.full_name || profileUser.username}! 🤝`);
      setProfileUser((prev) => (prev ? { ...prev, friendship_status: 'accepted' } : null));
      loadProfile(); // Load lại để hiển thị khoảnh khắc bạn bè
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể chấp nhận lời mời kết bạn.';
      showToast('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Từ chối / Hủy lời mời
  const handleCancelOrReject = async () => {
    if (!profileUser || actionLoading) return;
    setActionLoading(true);
    try {
      await friendService.rejectOrCancelRequest(profileUser.id);
      showToast('info', 'Đã hủy lời mời kết bạn.');
      setProfileUser((prev) => (prev ? { ...prev, friendship_status: 'none' } : null));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể thực hiện yêu cầu.';
      showToast('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Hủy kết bạn (Unfriend)
  const confirmUnfriend = () => {
    if (!profileUser) return;
    const name = profileUser.full_name || profileUser.username;
    Alert.alert(
      'Hủy kết bạn',
      `Bạn có chắc chắn muốn hủy kết bạn với ${name}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đồng ý',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await friendService.rejectOrCancelRequest(profileUser.id);
              showToast('info', `Đã hủy kết bạn với ${name}.`);
              setProfileUser((prev) => (prev ? { ...prev, friendship_status: 'none' } : null));
              loadProfile();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Không thể hủy kết bạn.';
              showToast('error', msg);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // 5. Mở cuộc trò chuyện
  const handleOpenChat = () => {
    if (!profileUser) return;
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: profileUser.id.toString(),
        name: profileUser.full_name || profileUser.username,
        avatar: profileUser.avatar_url || '',
      },
    });
  };

  // Render các nút hành động theo quan hệ kết bạn
  const renderActionButtons = () => {
    if (!profileUser) return null;

    const status: FriendshipStatus | 'self' = profileUser.friendship_status || 'none';

    if (status === 'self' || profileUser.id === currentUser?.id) {
      return (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Hồ sơ của tôi 👤</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'accepted') {
      return (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, styles.flexBtn]}
            onPress={handleOpenChat}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>💬 Nhắn tin</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.outlineBtn, styles.flexBtn]}
            onPress={confirmUnfriend}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={C.textSecondary} />
            ) : (
              <Text style={styles.outlineBtnText}>Bạn bè ✓</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'pending_sent') {
      return (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.secondaryBtn, styles.flexBtn]}
            onPress={handleCancelOrReject}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={C.text} />
            ) : (
              <Text style={styles.secondaryBtnText}>Đã gửi lời mời ✕</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, styles.flexBtn]}
            onPress={handleOpenChat}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>💬 Nhắn tin</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'pending_received') {
      return (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, styles.flexBtn]}
            onPress={handleAcceptRequest}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Chấp nhận ✓</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.outlineBtn, styles.flexBtn]}
            onPress={handleCancelOrReject}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.outlineBtnText}>Từ chối ✕</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Default: 'none'
    return (
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.primaryBtn, styles.flexBtn]}
          onPress={handleSendRequest}
          disabled={actionLoading}
          activeOpacity={0.8}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.primaryBtnText}>+ Thêm bạn bè</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.outlineBtn, styles.flexBtn]}
          onPress={handleOpenChat}
          activeOpacity={0.8}
        >
          <Text style={styles.outlineBtnText}>💬 Nhắn tin</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* 1. Header Top */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <Text style={styles.topTitle} numberOfLines={1}>
          {profileUser ? `@${profileUser.username}` : 'Trang cá nhân'}
        </Text>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareProfile}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.shareIcon}>↗️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>Đang tải trang cá nhân...</Text>
          </View>
        ) : profileUser ? (
          <>
            {/* 2. Hero Section */}
            <View style={styles.heroCard}>
              {/* Cover Banner */}
              <View style={styles.coverContainer}>
                {profileUser.cover_url ? (
                  <Image
                    source={{ uri: getAvatarUrl(profileUser.cover_url) || profileUser.cover_url }}
                    style={styles.coverImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.defaultCover}>
                    <Text style={styles.defaultCoverEmoji}>✨ 📸 🌟</Text>
                  </View>
                )}
              </View>

              <View style={styles.heroContent}>
                {/* Avatar (Overlapping 50% on Cover) */}
                <View style={styles.avatarRow}>
                  <View style={styles.avatarWrapper}>
                    <View style={styles.avatarContainer}>
                      {(() => {
                        const avatarUri = getAvatarUrl(profileUser.avatar_url);
                        return avatarUri ? (
                          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitial}>
                              {(profileUser.full_name || profileUser.username || 'U')[0]?.toUpperCase()}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                    {isUserOnline(profileUser.id) && (
                      <View style={styles.avatarOnlineDot} />
                    )}
                  </View>
                </View>

                <View style={styles.nameBlock}>
                  <Text style={styles.fullNameText}>
                    {profileUser.full_name || profileUser.username}
                  </Text>
                  <Text style={styles.usernameText}>@{profileUser.username}</Text>
                  <View style={styles.presenceRow}>
                    <View
                      style={[
                        styles.presenceDot,
                        isUserOnline(profileUser.id) ? styles.presenceDotOnline : styles.presenceDotOffline,
                      ]}
                    />
                    <Text
                      style={[
                        styles.presenceText,
                        isUserOnline(profileUser.id) ? styles.presenceTextOnline : styles.presenceTextOffline,
                      ]}
                    >
                      {isUserOnline(profileUser.id) ? t('online') : t('offline')}
                    </Text>
                  </View>
                </View>

                <Text style={styles.bioText}>
                  {profileUser.bio?.trim() || 'Người dùng này chưa cập nhật tiểu sử.'}
                </Text>

                {/* 3. Stats Row */}
                <View style={styles.statsCard}>
                  <View style={styles.statColumn}>
                    <Text style={styles.statNumber}>{profileUser.stats?.posts_count ?? 0}</Text>
                    <Text style={styles.statLabel}>Bài viết</Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statColumn}>
                    <Text style={styles.statNumber}>{profileUser.stats?.friends_count ?? 0}</Text>
                    <Text style={styles.statLabel}>Bạn bè</Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statColumn}>
                    <Text style={styles.statNumber}>{profileUser.stats?.likes_count ?? 0}</Text>
                    <Text style={styles.statLabel}>Lượt thích</Text>
                  </View>
                </View>

                {/* 4. Action Buttons */}
                {renderActionButtons()}
              </View>
            </View>

            {/* 5. Photo Grid Section */}
            <View style={styles.postsSectionHeader}>
              <Text style={styles.postsSectionTitle}>📸 Khoảnh khắc</Text>
              <Text style={styles.postsSectionSubtitle}>
                {isLocked ? 'Riêng tư' : `${photos.length} bài viết`}
              </Text>
            </View>

            {isLocked ? (
              <View style={styles.lockedContainer}>
                <View style={styles.lockIconCircle}>
                  <Text style={styles.lockIcon}>🔒</Text>
                </View>
                <Text style={styles.lockedTitle}>Tài khoản này là riêng tư</Text>
                <Text style={styles.lockedDesc}>
                  Hãy gửi lời mời kết bạn để xem các bức ảnh và khoảnh khắc của @{profileUser.username}.
                </Text>
              </View>
            ) : photos.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📷</Text>
                <Text style={styles.emptyTitle}>Chưa có bài viết nào</Text>
                <Text style={styles.emptyDesc}>
                  @{profileUser.username} chưa đăng tải khoảnh khắc nào.
                </Text>
              </View>
            ) : (
              <View style={styles.gridWrapper}>
                <FlatList
                  data={photos}
                  keyExtractor={(item) => `photo_${item.id}`}
                  numColumns={3}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.gridCell, { width: gridItemSize, height: gridItemSize }]}
                      onPress={() => setSelectedPhotoForView(item)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.gridImage}
                        resizeMode="cover"
                      />
                      {(item.total_reactions ?? 0) > 0 && (
                        <View style={styles.reactionOverlay}>
                          <Text style={styles.reactionOverlayText}>
                            ❤️ {item.total_reactions}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={styles.emptyTitle}>Không tìm thấy người dùng</Text>
            <Text style={styles.emptyDesc}>Tài khoản có thể đã bị xóa hoặc không tồn tại.</Text>
          </View>
        )}
      </ScrollView>

      {/* Fullscreen Image Viewer Modal */}
      <ImageViewerModal
        visible={!!selectedPhotoForView}
        photo={selectedPhotoForView}
        onClose={() => setSelectedPhotoForView(null)}
      />
    </View>
  );
}

const createStyles = (C: ColorScheme, isDark: boolean, windowWidth: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
      backgroundColor: C.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    backIcon: {
      fontSize: 22,
      color: C.text,
      fontWeight: '600',
    },
    topTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginHorizontal: 12,
    },
    shareButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    shareIcon: {
      fontSize: 18,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 40,
    },
    loadingBox: {
      paddingTop: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: C.textSecondary,
    },
    heroCard: {
      backgroundColor: C.surface,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.25 : 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    coverContainer: {
      width: '100%',
      height: 140,
      backgroundColor: isDark ? '#221D38' : '#ECE8FF',
      position: 'relative',
      overflow: 'hidden',
    },
    coverImage: {
      width: '100%',
      height: '100%',
    },
    defaultCover: {
      width: '100%',
      height: '100%',
      backgroundColor: isDark ? '#221D38' : '#ECE8FF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    defaultCoverEmoji: {
      fontSize: 26,
      letterSpacing: 6,
      opacity: 0.5,
    },
    heroContent: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      alignItems: 'center',
      width: '100%',
    },
    avatarRow: {
      marginTop: -48,
      marginBottom: 14,
      alignItems: 'center',
      zIndex: 10,
    },
    avatarWrapper: {
      position: 'relative',
    },
    avatarContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      overflow: 'hidden',
      borderWidth: 4,
      borderColor: C.surface,
      backgroundColor: C.surface,
    },
    avatarOnlineDot: {
      position: 'absolute',
      bottom: 2,
      right: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#4CAF50',
      borderWidth: 3,
      borderColor: C.surface,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 38,
      fontWeight: '700',
      color: '#FFF',
    },
    nameBlock: {
      alignItems: 'center',
      marginBottom: 8,
    },
    fullNameText: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
    },
    usernameText: {
      fontSize: 14,
      color: C.textSecondary,
      marginTop: 2,
    },
    presenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      gap: 5,
    },
    presenceDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    presenceDotOnline: {
      backgroundColor: '#4CAF50',
    },
    presenceDotOffline: {
      backgroundColor: C.textMuted,
    },
    presenceText: {
      fontSize: 12,
      fontWeight: '500',
    },
    presenceTextOnline: {
      color: '#4CAF50',
    },
    presenceTextOffline: {
      color: C.textMuted,
    },
    bioText: {
      fontSize: 14,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 16,
      paddingHorizontal: 8,
    },
    statsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      width: '100%',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
      borderRadius: 16,
      paddingVertical: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: C.border,
    },
    statColumn: {
      alignItems: 'center',
      flex: 1,
    },
    statNumber: {
      fontSize: 18,
      fontWeight: '700',
      color: C.text,
    },
    statLabel: {
      fontSize: 12,
      color: C.textSecondary,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 24,
      backgroundColor: C.border,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      gap: 10,
    },
    flexBtn: {
      flex: 1,
    },
    fullBtn: {
      width: '100%',
    },
    primaryBtn: {
      backgroundColor: C.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    secondaryBtn: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
    },
    outlineBtn: {
      borderWidth: 1.5,
      borderColor: C.border,
      paddingVertical: 11,
      paddingHorizontal: 18,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surface,
    },
    outlineBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: C.textSecondary,
    },
    postsSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginTop: 24,
      marginBottom: 12,
    },
    postsSectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
    },
    postsSectionSubtitle: {
      fontSize: 13,
      color: C.textSecondary,
    },
    lockedContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surface,
      marginHorizontal: 16,
      borderRadius: 20,
      padding: 32,
      borderWidth: 1,
      borderColor: C.border,
      marginTop: 8,
    },
    lockIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    lockIcon: {
      fontSize: 30,
    },
    lockedTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: C.text,
      marginBottom: 8,
    },
    lockedDesc: {
      fontSize: 13,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      marginHorizontal: 16,
    },
    emptyIcon: {
      fontSize: 44,
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: C.text,
      marginBottom: 4,
    },
    emptyDesc: {
      fontSize: 13,
      color: C.textSecondary,
      textAlign: 'center',
    },
    gridWrapper: {
      paddingHorizontal: 16,
    },
    gridCell: {
      margin: 2,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: C.separator,
      position: 'relative',
    },
    gridImage: {
      width: '100%',
      height: '100%',
    },
    reactionOverlay: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    reactionOverlayText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
    },
  });
