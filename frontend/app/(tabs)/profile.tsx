import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  RefreshControl,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { API_URL } from '../../constants/config';

interface Photo {
  id: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
}

const { width } = Dimensions.get('window');
const GRID_PADDING = 24;
const COLUMN_GAP = 12;
const PHOTO_SIZE = (width - (GRID_PADDING * 2) - COLUMN_GAP) / 2;

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const { theme, language, colors, toggleTheme, setLanguage, t } = useSettings();
  
  const [myPhotos, setMyPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const serverBaseUrl = API_URL.replace('/api', '');

  const getFullImageUrl = (imagePath: string) => {
    if (imagePath.startsWith('http')) return imagePath;
    return `${serverBaseUrl}${imagePath}`;
  };

  const fetchMyPhotos = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/photos/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const json = await response.json();
      if (json.success && json.data) {
        setMyPhotos(json.data);
      }
    } catch (error) {
      console.error('Error fetching personal photos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchMyPhotos();
    }, [fetchMyPhotos])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyPhotos();
  };

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const renderPhotoItem = ({ item }: { item: Photo }) => (
    <View style={[styles.gridPhotoWrapper, { borderColor: colors.border, backgroundColor: colors.input }]}>
      <Image
        source={{ uri: getFullImageUrl(item.imageUrl) }}
        style={styles.gridPhoto}
        contentFit="cover"
        transition={200}
      />
      {item.caption ? (
        <View style={styles.captionBadge}>
          <Text style={styles.captionText} numberOfLines={1}>
            {item.caption}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.settingsIconBtn} onPress={() => setShowSettings(true)}>
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('profileTitle')}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={styles.logoutBtnText}>{t('logout')}</Text>
        </TouchableOpacity>
      </View>

      {/* Main Profile Info Section */}
      <View style={styles.profileHeaderSection}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.input, borderColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.text }]}>{getInitials(user?.fullName || '')}</Text>
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>{user?.fullName}</Text>
        <Text style={[styles.userUsername, { color: colors.textSecondary }]}>@{user?.username}</Text>
        <Text style={[styles.userEmail, { color: colors.textSecondary, opacity: 0.8 }]}>{user?.email}</Text>
      </View>

      {/* 2x2 Photo Grid Section */}
      <View style={styles.gallerySection}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t('myMoments')} ({myPhotos.length})
        </Text>
        
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="medium" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={myPhotos}
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
                <Text style={styles.emptyIcon}>⛰️</Text>
                <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                  {t('noMomentsShared')}
                </Text>
                <Text style={[styles.emptyDescription, { color: colors.textSecondary, opacity: 0.8 }]}>
                  {t('noMomentsSharedDesc')}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Settings Modal (Theme & Language Selectors) */}
      <Modal
        visible={showSettings}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settings')}</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Language Selector */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>{t('language')}</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.optionBtn,
                    language === 'en'
                      ? { backgroundColor: colors.accent }
                      : { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border }
                  ]}
                  onPress={() => setLanguage('en')}
                >
                  <Text style={[styles.optionText, language === 'en' ? { color: '#FFFFFF' } : { color: colors.text }]}>
                    English
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionBtn,
                    language === 'vi'
                      ? { backgroundColor: colors.accent }
                      : { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border }
                  ]}
                  onPress={() => setLanguage('vi')}
                >
                  <Text style={[styles.optionText, language === 'vi' ? { color: '#FFFFFF' } : { color: colors.text }]}>
                    Tiếng Việt
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Theme Selector */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>{t('theme')}</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.optionBtn,
                    theme === 'light'
                      ? { backgroundColor: colors.accent }
                      : { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border }
                  ]}
                  onPress={() => { if (theme !== 'light') toggleTheme(); }}
                >
                  <Text style={[styles.optionText, theme === 'light' ? { color: '#FFFFFF' } : { color: colors.text }]}>
                    {t('light')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionBtn,
                    theme === 'dark'
                      ? { backgroundColor: colors.accent }
                      : { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border }
                  ]}
                  onPress={() => { if (theme !== 'dark') toggleTheme(); }}
                >
                  <Text style={[styles.optionText, theme === 'dark' ? { color: '#FFFFFF' } : { color: colors.text }]}>
                    {t('dark')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  settingsIconBtn: {
    padding: 6,
    marginLeft: -6,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: -12,
  },
  logoutBtnText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '700',
  },
  profileHeaderSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '900',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
  },
  userUsername: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  gallerySection: {
    flex: 1,
    paddingHorizontal: GRID_PADDING,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 1.5,
  },
  scrollList: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: COLUMN_GAP,
  },
  gridPhotoWrapper: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  gridPhoto: {
    width: '100%',
    height: '100%',
  },
  captionBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  loaderContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  settingRow: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  optionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
