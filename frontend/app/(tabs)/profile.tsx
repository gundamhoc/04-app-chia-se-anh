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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { ColorScheme } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../utils/i18n';
import { useToast } from '../../hooks/useToast';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { photoService } from '../../services/photoService';
import { friendService } from '../../services/friendService';
import { useSocket } from '../../hooks/useSocket';
import { getApiOrigin } from '../../services/api';
import { Photo, Friend, User } from '../../types';
import { SettingsModal, maskEmail } from '../../components/SettingsModal';
import { EditProfileModal } from '../../components/EditProfileModal';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { VideoPlayerModal } from '../../components/VideoPlayerModal';

type ProfileTab = 'posts' | 'liked' | 'saved' | 'reposts';

const getAvatarUrl = (avatarUrl?: string | null): string | null => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  return `${getApiOrigin()}${avatarUrl}`;
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors: C, isDark } = useTheme();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { user, updateUser } = useAuthStore();
  const { socket } = useSocket();

  const styles = useMemo(() => createStyles(C, isDark, windowWidth), [C, isDark, windowWidth]);

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [selectedPhotoForView, setSelectedPhotoForView] = useState<Photo | null>(null);
  const [selectedVideoForView, setSelectedVideoForView] = useState<Photo | null>(null);
  const [viewingCustomImage, setViewingCustomImage] = useState<{ url: string; title: string } | null>(null);

  // Tabs state: posts | liked | saved | reposts
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  // Data state
  const [myPhotos, setMyPhotos] = useState<Photo[]>([]);
  const [likedPhotos, setLikedPhotos] = useState<Photo[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<Photo[]>([]);
  const [repostedPhotos, setRepostedPhotos] = useState<Photo[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tính toán kích thước ô lưới ảnh (3 cột)
  const gridItemSize = useMemo(() => {
    const horizontalPadding = 16 * 2;
    const gap = 3 * 2;
    return Math.floor((windowWidth - horizontalPadding - gap) / 3);
  }, [windowWidth]);

  // Tải dữ liệu toàn diện hồ sơ (Bài viết, Đã thích, Đã lưu, Đăng lại, Bạn bè)
  const loadProfileData = useCallback(async () => {
    try {
      const [
        profileRes,
        myPhotosRes,
        likedPhotosRes,
        savedPhotosRes,
        repostedPhotosRes,
        friendsRes,
      ] = await Promise.allSettled([
        authService.getProfile(),
        photoService.getMyPhotos(),
        photoService.getLikedPhotos(),
        photoService.getSavedPhotos(),
        photoService.getRepostedPhotos(),
        friendService.getFriendsList(),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value?.user) {
        updateUser(profileRes.value.user);
      }
      if (myPhotosRes.status === 'fulfilled') {
        setMyPhotos(myPhotosRes.value);
      }
      if (likedPhotosRes.status === 'fulfilled') {
        setLikedPhotos(likedPhotosRes.value);
      }
      if (savedPhotosRes.status === 'fulfilled') {
        setSavedPhotos(savedPhotosRes.value);
      }
      if (repostedPhotosRes.status === 'fulfilled') {
        setRepostedPhotos(repostedPhotosRes.value);
      }
      if (friendsRes.status === 'fulfilled') {
        setFriends(friendsRes.value);
      }
    } catch (err) {
      console.warn('Load profile data error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [updateUser]);

  // Tải lại toàn bộ dữ liệu hồ sơ mỗi khi tab được mở (focus)
  // -> Số liệu likes/saved/reposts luôn mới nhất mà không cần pull-to-refresh thủ công
  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProfileData();
  };

  // Realtime: khi có người thích/bỏ thích bài đăng của mình -> cập nhật ngay lượt thích trên Hồ sơ (0ms)
  useEffect(() => {
    if (!socket) return;

    const handleReactionUpdate = (data?: { action?: string }) => {
      const currentStats = user?.stats;
      const current = currentStats?.likes_count ?? 0;
      if (!currentStats) return;
      const optimistic =
        data?.action === 'removed'
          ? Math.max(current - 1, 0)
          : data?.action === 'replaced'
            ? current
            : current + 1;
      updateUser({
        stats: {
          posts_count: currentStats.posts_count,
          friends_count: currentStats.friends_count,
          likes_count: optimistic,
          saved_count: currentStats.saved_count,
          reposts_count: currentStats.reposts_count,
        },
      });
      // Tải lại stats chính xác từ server (count có thể tăng hoặc giảm tùy hành động)
      authService
        .getProfile()
        .then((res) => {
          if (res?.user) updateUser(res.user);
        })
        .catch(() => {
          // Lỗi mạng -> giữ nguyên optimistic, không kick user
        });
    };

    socket.on('photo_reaction_updated', handleReactionUpdate);
    return () => {
      socket.off('photo_reaction_updated', handleReactionUpdate);
    };
  }, [socket, user?.stats, updateUser]);

  const [updatingCover, setUpdatingCover] = useState(false);

  // Chọn và cập nhật ảnh bìa hồ sơ
  const handlePickCover = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast('warning', 'Quyền truy cập thư viện ảnh bị từ chối.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUpdatingCover(true);
        showToast('info', 'Đang tải ảnh bìa lên... ⏳');
        const res = await authService.updateCover(result.assets[0].uri);
        if (res?.cover_url && user) {
          updateUser({ ...user, cover_url: res.cover_url });
          showToast('success', 'Cập nhật ảnh bìa thành công! ✨');
        }
      }
    } catch (error) {
      console.warn('Pick cover error:', error);
      showToast('error', 'Không thể cập nhật ảnh bìa.');
    } finally {
      setUpdatingCover(false);
    }
  };

  // Chia sẻ hồ sơ
  const handleShareProfile = async () => {
    const profileUrl = `https://masita.app/u/${user?.username}`;
    const shareMessage = `Xem hồ sơ của ${user?.full_name || user?.username} (@${user?.username}) trên mạng xã hội Masita! 🌟\n${profileUrl}`;

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
          title: `Hồ sơ Masita của @${user?.username}`,
        });
      }
    } catch (e) {
      console.warn('Share profile error:', e);
    }
  };

  // Số liệu thống kê đồng bộ với 4 Sub-Tabs
  const postsCount = user?.stats?.posts_count ?? myPhotos.length;
  const likesCount = user?.stats?.likes_count ?? likedPhotos.length;
  const savedCount = user?.stats?.saved_count ?? savedPhotos.length;
  const repostsCount = user?.stats?.reposts_count ?? repostedPhotos.length;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

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
        {/* 1. Header Top */}
        <View style={styles.topHeader}>
          <Text style={styles.topTitle}>{t('profile')}</Text>
          <TouchableOpacity
            style={styles.gearButton}
            onPress={() => setShowSettingsModal(true)}
            activeOpacity={0.7}
            accessibilityLabel="settings-button"
          >
            <Text style={styles.gearIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Profile Hero Section */}
        <View style={styles.heroCard}>
          {/* Cover Banner (Ảnh bìa nằm ngang - Chạm để xem chi tiết) */}
          <View style={styles.coverContainer}>
            {(() => {
              const coverUri = getAvatarUrl(user?.cover_url);
              return coverUri ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setViewingCustomImage({ url: coverUri, title: t('cover_title') })}
                  style={StyleSheet.absoluteFill}
                >
                  <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
                </TouchableOpacity>
              ) : (
                <View style={styles.defaultCover}>
                  <Text style={styles.defaultCoverEmoji}>✨ 📸 🌟</Text>
                </View>
              );
            })()}

            {/* Nút Đổi ảnh bìa 📷 */}
            <TouchableOpacity
              style={styles.editCoverButton}
              onPress={handlePickCover}
              disabled={updatingCover}
              activeOpacity={0.8}
            >
              {updatingCover ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Text style={styles.editCoverIcon}>📷</Text>
                  <Text style={styles.editCoverText}>Đổi ảnh bìa</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.heroContent}>
            {/* Avatar with Verified Badge & Quick Edit Button (Đè 50% lên ảnh bìa) */}
            <View style={styles.avatarRow}>
            <View style={styles.avatarContainer}>
              {(() => {
                const avatarUri = getAvatarUrl(user?.avatar_url);
                return avatarUri ? (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => setViewingCustomImage({ url: avatarUri, title: t('avatar_title') })}
                  >
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {(user?.full_name || user?.username || 'U')[0]?.toUpperCase()}
                    </Text>
                  </View>
                );
              })()}

              {/* Verified Checkmark Badge */}
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedIcon}>✓</Text>
              </View>

              {/* Pencil Edit Avatar Button */}
              <TouchableOpacity
                style={styles.pencilButton}
                onPress={() => setShowEditProfileModal(true)}
                activeOpacity={0.8}
                accessibilityLabel="edit-avatar-button"
              >
                <Text style={styles.pencilIcon}>✏️</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Name & Handle */}
          <View style={styles.nameBlock}>
            <Text style={styles.fullNameText}>{user?.full_name || user?.username}</Text>
            <Text style={styles.usernameText}>@{user?.username}</Text>
          </View>

          {/* Bio Description */}
          <Text style={styles.bioText}>
            {user?.bio?.trim()
              ? user.bio.trim()
              : 'Chưa có lời giới thiệu. Bấm "Chỉnh sửa hồ sơ" để thêm tiểu sử! ✨'}
          </Text>

          {/* 3. Stats Row (4 Columns: Bài viết | Lượt thích | Đã lưu | Đăng lại) */}
          <View style={styles.statsCard}>
            <TouchableOpacity
              style={styles.statColumn}
              onPress={() => setActiveTab('posts')}
              activeOpacity={0.7}
            >
              <Text style={styles.statNumber}>{postsCount}</Text>
              <Text style={styles.statLabel}>Bài viết</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={styles.statColumn}
              onPress={() => setActiveTab('liked')}
              activeOpacity={0.7}
            >
              <Text style={styles.statNumber}>{likesCount}</Text>
              <Text style={styles.statLabel}>Lượt thích</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={styles.statColumn}
              onPress={() => setActiveTab('saved')}
              activeOpacity={0.7}
            >
              <Text style={styles.statNumber}>{savedCount}</Text>
              <Text style={styles.statLabel}>Đã lưu</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={styles.statColumn}
              onPress={() => setActiveTab('reposts')}
              activeOpacity={0.7}
            >
              <Text style={styles.statNumber}>{repostsCount}</Text>
              <Text style={styles.statLabel}>Đăng lại</Text>
            </TouchableOpacity>
          </View>

          {/* 4. Mutual / Friends Preview Strip (Chạm để mở trang Bạn bè) */}
          <TouchableOpacity
            style={styles.connectionsStrip}
            onPress={() => router.push('/(tabs)/friends')}
            activeOpacity={0.75}
          >
            <View style={styles.connectionsLeft}>
              <View style={styles.miniAvatarsGroup}>
                {friends.length > 0 ? (
                  friends.slice(0, 3).map((f, idx) => {
                    const friendAvatarUri = getAvatarUrl(f.avatar_url);
                    return (
                      <View
                        key={f.id}
                        style={[
                          styles.miniAvatarWrapper,
                          { marginLeft: idx > 0 ? -10 : 0, zIndex: 10 - idx },
                        ]}
                      >
                        {friendAvatarUri ? (
                          <Image source={{ uri: friendAvatarUri }} style={styles.miniAvatarImg} />
                        ) : (
                          <View style={styles.miniAvatarPlaceholder}>
                            <Text style={styles.miniAvatarInitial}>
                              {(f.full_name || f.username || 'U')[0]?.toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.miniAvatarWrapper}>
                    <View style={styles.miniAvatarPlaceholder}>
                      <Text style={styles.miniAvatarInitial}>👥</Text>
                    </View>
                  </View>
                )}
              </View>

              <Text style={styles.connectionsText}>
                {friends.length > 0
                  ? `${friends.length} bạn bè kết nối trong mạng xã hội`
                  : 'Chưa có bạn bè kết nối. Khám phá bạn bè ngay!'}
              </Text>
            </View>

            <Text style={styles.connectionsChevron}>›</Text>
          </TouchableOpacity>

          {/* 5. Pill Action Buttons */}
          <View style={styles.actionPillsRow}>
            <TouchableOpacity
              style={styles.editProfilePill}
              onPress={() => setShowEditProfileModal(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.editProfilePillText}>Chỉnh sửa hồ sơ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareProfilePill}
              onPress={handleShareProfile}
              activeOpacity={0.75}
            >
              <Text style={styles.shareProfilePillText}>Chia sẻ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsPill}
              onPress={() => setShowSettingsModal(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.settingsPillIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

        {/* 6. Horizontal Sub-Tabs Bar (Bài viết | Đã thích | Lưu bài viết | Đăng lại) */}
        <View style={styles.tabsBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}
            onPress={() => setActiveTab('posts')}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>📸</Text>
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              Bài viết
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'liked' && styles.tabButtonActive]}
            onPress={() => setActiveTab('liked')}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>❤️</Text>
            <Text style={[styles.tabText, activeTab === 'liked' && styles.tabTextActive]}>
              Đã thích
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'saved' && styles.tabButtonActive]}
            onPress={() => setActiveTab('saved')}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>🔖</Text>
            <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>
              Lưu bài viết
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'reposts' && styles.tabButtonActive]}
            onPress={() => setActiveTab('reposts')}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>🔁</Text>
            <Text style={[styles.tabText, activeTab === 'reposts' && styles.tabTextActive]}>
              Đăng lại
            </Text>
          </TouchableOpacity>
        </View>

        {/* 7. Tab Content Rendering */}
        <View style={styles.tabContentContainer}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.loadingText}>Đang tải trang cá nhân...</Text>
            </View>
          ) : (
            <>
              {/* TAB 1: BÀI VIẾT (Grid 3x3) */}
              {activeTab === 'posts' && (
                <View style={styles.gridWrapper}>
                  {myPhotos.length > 0 ? (
                    <FlatList
                      data={myPhotos}
                      keyExtractor={(item) => `photo_${item.id}`}
                      numColumns={3}
                      scrollEnabled={false}
                      renderItem={({ item }) => {
                        const isVideo = item.media_type === 'video' || Boolean(item.video_url);
                        return (
                          <TouchableOpacity
                            style={[styles.gridCell, { width: gridItemSize, height: gridItemSize }]}
                            onPress={() => (isVideo ? setSelectedVideoForView(item) : setSelectedPhotoForView(item))}
                            activeOpacity={0.8}
                          >
                            <Image
                              source={{ uri: item.image_url }}
                              style={styles.gridImage}
                              resizeMode="cover"
                            />
                            {isVideo && (
                              <View style={styles.gridVideoBadge}>
                                <Text style={styles.gridVideoBadgeText}>▶</Text>
                              </View>
                            )}
                            {(item.total_reactions ?? 0) > 0 && (
                              <View style={styles.reactionOverlay}>
                                <Text style={styles.reactionOverlayText}>
                                  ❤️ {item.total_reactions}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      }}
                    />
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyEmoji}>📸</Text>
                      <Text style={styles.emptyTitle}>Chưa có khoảnh khắc nào</Text>
                      <Text style={styles.emptySubtitle}>
                        Hãy lưu giữ những kỉ niệm thường nhật cùng bạn bè ngay hôm nay!
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyActionBtn}
                        onPress={() => router.push('/add-photo')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.emptyActionBtnText}>+ Đăng khoảnh khắc đầu tiên</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* TAB 2: ĐÃ THÍCH (Grid 3x3) */}
              {activeTab === 'liked' && (
                <View style={styles.gridWrapper}>
                  {likedPhotos.length > 0 ? (
                    <FlatList
                      data={likedPhotos}
                      keyExtractor={(item) => `liked_${item.id}`}
                      numColumns={3}
                      scrollEnabled={false}
                      renderItem={({ item }) => {
                        const isVideo = item.media_type === 'video' || Boolean(item.video_url);
                        return (
                          <TouchableOpacity
                            style={[styles.gridCell, { width: gridItemSize, height: gridItemSize }]}
                            onPress={() => (isVideo ? setSelectedVideoForView(item) : setSelectedPhotoForView(item))}
                            activeOpacity={0.8}
                          >
                            <Image
                              source={{ uri: item.image_url }}
                              style={styles.gridImage}
                              resizeMode="cover"
                            />
                            {isVideo && (
                              <View style={styles.gridVideoBadge}>
                                <Text style={styles.gridVideoBadgeText}>▶</Text>
                              </View>
                            )}
                            <View style={styles.likedHeartBadge}>
                              <Text style={styles.likedHeartText}>❤️</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                    />
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyEmoji}>❤️</Text>
                      <Text style={styles.emptyTitle}>Chưa có bài viết đã thích</Text>
                      <Text style={styles.emptySubtitle}>
                        Những khoảnh khắc bạn thả cảm xúc trên Bảng tin sẽ xuất hiện tại đây.
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyActionBtn}
                        onPress={() => router.replace('/(tabs)')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.emptyActionBtnText}>Khám phá Bảng tin Feed</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* TAB 3: LƯU BÀI VIẾT (Grid 3x3) */}
              {activeTab === 'saved' && (
                <View style={styles.gridWrapper}>
                  {savedPhotos.length > 0 ? (
                    <FlatList
                      data={savedPhotos}
                      keyExtractor={(item) => `saved_${item.id}`}
                      numColumns={3}
                      scrollEnabled={false}
                      renderItem={({ item }) => {
                        const isVideo = item.media_type === 'video' || Boolean(item.video_url);
                        return (
                          <TouchableOpacity
                            style={[styles.gridCell, { width: gridItemSize, height: gridItemSize }]}
                            onPress={() => (isVideo ? setSelectedVideoForView(item) : setSelectedPhotoForView(item))}
                            activeOpacity={0.8}
                          >
                            <Image
                              source={{ uri: item.image_url }}
                              style={styles.gridImage}
                              resizeMode="cover"
                            />
                            {isVideo && (
                              <View style={styles.gridVideoBadge}>
                                <Text style={styles.gridVideoBadgeText}>▶</Text>
                              </View>
                            )}
                            <View style={styles.savedBadge}>
                              <Text style={styles.badgeEmoji}>🔖</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                    />
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyEmoji}>🔖</Text>
                      <Text style={styles.emptyTitle}>Chưa có bài viết nào được lưu</Text>
                      <Text style={styles.emptySubtitle}>
                        Hãy lưu lại những khoảnh khắc bạn yêu thích trên Bảng tin để xem lại bất cứ lúc nào!
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyActionBtn}
                        onPress={() => router.replace('/(tabs)')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.emptyActionBtnText}>Khám phá Bảng tin Feed</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* TAB 4: ĐĂNG LẠI (Grid 3x3) */}
              {activeTab === 'reposts' && (
                <View style={styles.gridWrapper}>
                  {repostedPhotos.length > 0 ? (
                    <FlatList
                      data={repostedPhotos}
                      keyExtractor={(item) => `repost_${item.id}`}
                      numColumns={3}
                      scrollEnabled={false}
                      renderItem={({ item }) => {
                        const isVideo = item.media_type === 'video' || Boolean(item.video_url);
                        return (
                          <TouchableOpacity
                            style={[styles.gridCell, { width: gridItemSize, height: gridItemSize }]}
                            onPress={() => (isVideo ? setSelectedVideoForView(item) : setSelectedPhotoForView(item))}
                            activeOpacity={0.8}
                          >
                            <Image
                              source={{ uri: item.image_url }}
                              style={styles.gridImage}
                              resizeMode="cover"
                            />
                            {isVideo && (
                              <View style={styles.gridVideoBadge}>
                                <Text style={styles.gridVideoBadgeText}>▶</Text>
                              </View>
                            )}
                            <View style={styles.repostBadge}>
                              <Text style={styles.badgeEmoji}>🔁</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                    />
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyEmoji}>🔁</Text>
                      <Text style={styles.emptyTitle}>Chưa có bài đăng lại nào</Text>
                      <Text style={styles.emptySubtitle}>
                        Chia sẻ lại những khoảnh khắc tuyệt vời của bạn bè lên trang cá nhân của bạn!
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyActionBtn}
                        onPress={() => router.replace('/(tabs)')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.emptyActionBtnText}>Khám phá Bảng tin Feed</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Settings Modal (Cài đặt & Đăng xuất) */}
      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        onSuccess={() => {
          loadProfileData();
        }}
      />

      {/* Fullscreen Image Viewer Modal cho bài viết */}
      <ImageViewerModal
        visible={Boolean(selectedPhotoForView)}
        photo={selectedPhotoForView}
        onClose={() => setSelectedPhotoForView(null)}
      />

      {/* Fullscreen Image Viewer Modal cho Ảnh đại diện & Ảnh bìa */}
      <ImageViewerModal
        visible={Boolean(viewingCustomImage)}
        imageUrl={viewingCustomImage?.url}
        title={viewingCustomImage?.title}
        authorName={user?.full_name || user?.username}
        authorAvatar={getAvatarUrl(user?.avatar_url)}
        onClose={() => setViewingCustomImage(null)}
      />

      {/* VideoPlayerModal (Xem video) */}
      <VideoPlayerModal
        visible={Boolean(selectedVideoForView)}
        videoUrl={selectedVideoForView ? photoService.getPhotoVideoStreamUrl(selectedVideoForView.id, useAuthStore.getState().token) : null}
        thumbnailUrl={selectedVideoForView?.image_url}
        fileName={selectedVideoForView?.caption || 'Video'}
        onClose={() => setSelectedVideoForView(null)}
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
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 40,
    },
    topHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    topTitle: {
      fontSize: 26,
      fontFamily: 'Inter_700Bold',
      color: C.text,
    },
    gearButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: C.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 4,
      elevation: 3,
    },
    gearIcon: {
      fontSize: 20,
    },
    heroCard: {
      backgroundColor: C.card,
      marginHorizontal: 16,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 10,
      elevation: 4,
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
    editCoverButton: {
      position: 'absolute',
      bottom: 10,
      right: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    editCoverIcon: {
      fontSize: 14,
    },
    editCoverText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
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
      zIndex: 10,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatarImage: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 4,
      borderColor: C.card,
    },
    avatarPlaceholder: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 4,
      borderColor: C.card,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    avatarInitial: {
      fontSize: 36,
      fontFamily: 'Inter_700Bold',
      color: '#fff',
    },
    verifiedBadge: {
      position: 'absolute',
      bottom: 2,
      left: -2,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#3897F0',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: C.card,
    },
    verifiedIcon: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#fff',
    },
    pencilButton: {
      position: 'absolute',
      bottom: 2,
      right: -2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: C.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    pencilIcon: {
      fontSize: 13,
    },
    nameBlock: {
      alignItems: 'center',
      marginBottom: 8,
    },
    fullNameText: {
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginBottom: 2,
    },
    usernameText: {
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: C.textMuted,
    },
    bioText: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      paddingHorizontal: 12,
      marginBottom: 18,
    },
    statsCard: {
      flexDirection: 'row',
      width: '100%',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'space-around',
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 14,
    },
    statColumn: {
      flex: 1,
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 17,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textMuted,
    },
    statDivider: {
      width: 1,
      height: 24,
      backgroundColor: C.border,
    },
    connectionsStrip: {
      flexDirection: 'row',
      width: '100%',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: C.border,
    },
    connectionsLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    miniAvatarsGroup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    miniAvatarWrapper: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: C.card,
      overflow: 'hidden',
    },
    miniAvatarImg: {
      width: '100%',
      height: '100%',
    },
    miniAvatarPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    miniAvatarInitial: {
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      color: '#fff',
    },
    connectionsText: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textMuted,
      flex: 1,
    },
    connectionsChevron: {
      fontSize: 18,
      color: C.textMuted,
      marginLeft: 6,
    },
    actionPillsRow: {
      flexDirection: 'row',
      width: '100%',
      gap: 10,
    },
    editProfilePill: {
      flex: 1.4,
      height: 42,
      borderRadius: 21,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    editProfilePillText: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: '#FFFFFF',
    },
    shareProfilePill: {
      flex: 1.1,
      height: 42,
      borderRadius: 21,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    shareProfilePillText: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
    },
    settingsPill: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    settingsPillIcon: {
      fontSize: 18,
    },
    tabsBar: {
      flexDirection: 'row',
      marginHorizontal: 16,
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 4,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 12,
      gap: 4,
    },
    tabButtonActive: {
      backgroundColor: isDark ? 'rgba(108, 99, 255, 0.18)' : 'rgba(108, 99, 255, 0.12)',
    },
    tabIcon: {
      fontSize: 14,
    },
    tabText: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textMuted,
    },
    tabTextActive: {
      fontFamily: 'Inter_700Bold',
      color: C.primary,
    },
    tabContentContainer: {
      marginHorizontal: 16,
    },
    loadingBox: {
      paddingVertical: 50,
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textMuted,
    },
    gridWrapper: {
      width: '100%',
    },
    gridCell: {
      margin: 1.5,
      backgroundColor: C.card,
      borderRadius: 8,
      overflow: 'hidden',
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
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    reactionOverlayText: {
      fontSize: 10,
      fontFamily: 'Inter_600SemiBold',
      color: '#fff',
    },
    likedHeartBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    likedHeartText: {
      fontSize: 11,
    },
    savedBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    gridVideoBadge: {
      position: 'absolute',
      top: 4,
      left: 4,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    gridVideoBadgeText: {
      fontSize: 10,
      color: '#FFFFFF',
      marginLeft: 1,
    },
    repostBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeEmoji: {
      fontSize: 11,
    },
    emptyCard: {
      padding: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
    },
    emptyEmoji: {
      fontSize: 44,
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 18,
    },
    emptyActionBtn: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: C.primary,
    },
    emptyActionBtnText: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: '#fff',
    },
  });
