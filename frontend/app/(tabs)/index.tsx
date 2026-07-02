import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../constants/config';
import { useSettings } from '../../context/SettingsContext';

interface Photo {
  id: string;
  userId: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
  user: {
    username: string;
    fullName: string;
  };
}

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48 - 12) / 2; // Screen width minus padding minus column gap

export default function FeedScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { colors, theme, t } = useSettings();
  
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic base url (resolves http://localhost:3000, 10.0.2.2:3000, etc.)
  const serverBaseUrl = API_URL.replace('/api', '');

  const getFullImageUrl = (imagePath: string) => {
    if (imagePath.startsWith('http')) return imagePath;
    return `${serverBaseUrl}${imagePath}`;
  };

  const fetchFeed = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/photos/feed`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const json = await response.json();
      if (json.success && json.data) {
        setPhotos(json.data);
      }
    } catch (error) {
      console.error('Error fetching photos feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Refresh feed dynamically whenever this tab screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchFeed();
    }, [fetchFeed])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return t('justNow');
      if (diffMins < 60) return `${diffMins}${t('minsAgo')}`;
      if (diffHours < 24) return `${diffHours}${t('hoursAgo')}`;
      return `${diffDays}${t('daysAgo')}`;
    } catch (e) {
      return '';
    }
  };

  const renderPhotoItem = ({ item }: { item: Photo }) => (
    <View style={[styles.photoCard, { backgroundColor: colors.background }]}>
      {/* Image container */}
      <View style={[styles.imageContainer, { backgroundColor: colors.input }]}>
        <Image
          source={{ uri: getFullImageUrl(item.imageUrl) }}
          style={styles.photoImage}
          contentFit="cover"
          transition={200}
        />
        
        {/* Overlay sender avatar in top-left */}
        <View style={styles.avatarOverlay}>
          <Text style={styles.avatarOverlayText}>{getInitials(item.user.fullName)}</Text>
        </View>
      </View>

      {/* Info section below photo */}
      <View style={styles.photoInfo}>
        <Text style={[styles.senderName, { color: colors.text }]} numberOfLines={1}>
          {item.user.fullName}
        </Text>
        {item.caption ? (
          <Text style={[styles.captionText, { color: colors.text }]} numberOfLines={2}>
            {item.caption}
          </Text>
        ) : null}
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(item.createdAt)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('feedTitle')}</Text>
        <TouchableOpacity 
          style={[styles.userProfileBadge, { backgroundColor: colors.accent }]}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.7}
        >
          <Text style={styles.badgeText}>{getInitials(user?.fullName || '')}</Text>
        </TouchableOpacity>
      </View>

      {/* Photo List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhotoItem}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.scrollList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📸</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('noMoments')}</Text>
              <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
                {t('noMomentsDesc')}
              </Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={[styles.addFriendBtn, { backgroundColor: colors.input }]}
                  onPress={() => router.push('/(tabs)/explore')}
                >
                  <Text style={[styles.addFriendBtnText, { color: colors.accent }]}>{t('findFriends')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.takePhotoBtn, { backgroundColor: colors.accent }]}
                  onPress={() => router.push('/(tabs)/add')}
                >
                  <Text style={styles.takePhotoBtnText}>{t('takePhoto')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -1,
  },
  userProfileBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollList: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  photoCard: {
    width: COLUMN_WIDTH,
    backgroundColor: '#FFFFFF',
  },
  imageContainer: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F2F2F7',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarOverlayText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
  },
  photoInfo: {
    marginTop: 6,
    paddingHorizontal: 2,
  },
  senderName: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  captionText: {
    color: '#333333',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 15,
  },
  timeText: {
    color: '#8E8E93',
    fontSize: 10,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyDescription: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addFriendBtn: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
  },
  addFriendBtnText: {
    color: '#0066FF',
    fontSize: 14,
    fontWeight: '800',
  },
  takePhotoBtn: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
  },
  takePhotoBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
