import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { mockStore, Photo } from '../constants/mock-store';
import BottomNav from '../components/bottom-nav';

const { width } = Dimensions.get('window');
// Tính toán chiều rộng cho lưới 2x2 bên trong Card trắng
const CARD_INNER_WIDTH = width - 48 - 32; // Khung chính trừ lề màn hình và lề bên trong card
const GRID_ITEM_WIDTH = (CARD_INNER_WIDTH - 12) / 2;

export default function ProfileScreen() {
  const [profilePhotos, setProfilePhotos] = useState<Photo[]>([]);

  // Lắng nghe thay đổi dữ liệu thời gian thực
  useEffect(() => {
    setProfilePhotos(mockStore.getProfilePhotos());
    const unsubscribe = mockStore.subscribe(() => {
      setProfilePhotos(mockStore.getProfilePhotos());
    });
    return unsubscribe;
  }, []);

  const renderPhotoItem = ({ item }: { item: Photo }) => (
    <View style={styles.gridItem}>
      <Image source={{ uri: item.url }} style={styles.photo} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.replace('/')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
        >
          <Feather name="settings" size={24} color="#1F2937" />
        </TouchableOpacity>
      </View>

      {/* Thông tin Profile cá nhân */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarBorder}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150' }}
            style={styles.avatarImage}
          />
        </View>
        <Text style={styles.profileName}>Locket</Text>
      </View>

      {/* White Card hiển thị danh sách ảnh 2x2 */}
      <View style={styles.whiteCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Profile</Text>
          <View style={styles.cardDesignNotes}>
            <Text style={styles.notesText}>#F5F5F5  #333333</Text>
          </View>
        </View>

        <FlatList
          data={profilePhotos}
          renderItem={renderPhotoItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
          scrollEnabled={true}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="image" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>Chưa chia sẻ bức ảnh nào.</Text>
            </View>
          }
        />
      </View>

      {/* Điều hướng chân trang */}
      <BottomNav activeTab="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5E7EB', // Nền màu xám trung tính giống mockup profile
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    height: 50,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: 12,
    gap: 12,
  },
  avatarBorder: {
    padding: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 65,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  whiteCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 90, // Khoảng trống cho BottomNav
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  cardDesignNotes: {
    flexDirection: 'row',
  },
  notesText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  gridContainer: {
    paddingBottom: 20,
  },
  gridItem: {
    width: GRID_ITEM_WIDTH,
    height: GRID_ITEM_WIDTH, // Ảnh vuông 1:1
    margin: 6,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
