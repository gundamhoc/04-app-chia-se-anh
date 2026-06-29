import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { mockStore, Photo } from '../constants/mock-store';
import BottomNav from '../components/bottom-nav';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2; // Spacing 16px ở viền và giữa

export default function HomeScreen() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // Đồng bộ hóa trạng thái ảnh thời gian thực từ store
  useEffect(() => {
    setPhotos(mockStore.getPhotos());
    const unsubscribe = mockStore.subscribe(() => {
      setPhotos(mockStore.getPhotos());
    });
    return unsubscribe;
  }, []);

  const renderItem = ({ item }: { item: Photo }) => (
    <TouchableOpacity
      style={styles.gridItem}
      activeOpacity={0.9}
      onPress={() => setSelectedPhoto(item)}
    >
      <Image source={{ uri: item.url }} style={styles.photo} />
      {/* Avatar người gửi ở góc nhỏ */}
      <View style={styles.senderContainer}>
        <Image source={{ uri: item.avatar }} style={styles.senderAvatar} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.placeholder} />
        <Text style={styles.headerTitle}>Locket</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/profile')}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150' }}
            style={styles.headerAvatar}
          />
          {/* Huy hiệu đỏ báo thông báo */}
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      {/* Lưới ảnh */}
      <FlatList
        data={photos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="image" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Chưa có ảnh nào được chia sẻ.</Text>
          </View>
        }
      />

      {/* Màn hình Xem chi tiết ảnh (Modal) */}
      <Modal
        visible={selectedPhoto !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedPhoto(null)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalUser}>
                <Image source={{ uri: selectedPhoto?.avatar }} style={styles.modalAvatar} />
                <View>
                  <Text style={styles.modalUsername}>{selectedPhoto?.sender}</Text>
                  <Text style={styles.modalTime}>
                    {selectedPhoto ? new Date(selectedPhoto.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelectedPhoto(null)}>
                <Feather name="x" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <Image source={{ uri: selectedPhoto?.url }} style={styles.modalImage} />

            {selectedPhoto?.caption ? (
              <View style={styles.modalCaptionContainer}>
                <Text style={styles.modalCaption}>{selectedPhoto.caption}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Thanh điều hướng chân trang */}
      <BottomNav activeTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  profileButton: {
    width: 40,
    height: 40,
    position: 'relative',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FAFAFA',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90, // Để không bị đè bởi BottomNav
  },
  gridItem: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH * 1.3, // Tỷ lệ dọc nhẹ giống Demo
    margin: 8,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  senderContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  senderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 15,
  },
  // Modal Style
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    overflow: 'hidden',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  modalUsername: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  modalImage: {
    width: '100%',
    aspectRatio: 1, // Ảnh vuông to
    borderRadius: 24,
    resizeMode: 'cover',
  },
  modalCaptionContainer: {
    marginTop: 16,
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 16,
  },
  modalCaption: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 20,
    fontWeight: '500',
  },
});
