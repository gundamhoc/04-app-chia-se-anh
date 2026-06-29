import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { mockStore, Photo } from '../constants/mock-store';
import BottomNav from '../components/bottom-nav';

export default function FeedScreen() {
  const [photos, setPhotos] = useState<Photo[]>([]);

  // Đồng bộ hóa dữ liệu thời gian thực
  useEffect(() => {
    setPhotos(mockStore.getPhotos());
    const unsubscribe = mockStore.subscribe(() => {
      setPhotos(mockStore.getPhotos());
    });
    return unsubscribe;
  }, []);

  const renderCard = ({ item }: { item: Photo }) => {
    // Tính toán thời gian tương đối thân thiện
    const timeDiff = Date.now() - new Date(item.createdAt).getTime();
    let timeString = 'Vừa xong';
    if (timeDiff > 1000 * 60 * 60 * 24) {
      timeString = `${Math.floor(timeDiff / (1000 * 60 * 60 * 24))} ngày trước`;
    } else if (timeDiff > 1000 * 60 * 60) {
      timeString = `${Math.floor(timeDiff / (1000 * 60 * 60))} giờ trước`;
    } else if (timeDiff > 1000 * 60) {
      timeString = `${Math.floor(timeDiff / (1000 * 60))} phút trước`;
    }

    return (
      <View style={styles.card}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.url }} style={styles.cardImage} />
          {/* Avatar bong bóng đè lên góc trái ảnh */}
          <View style={styles.avatarOverlay}>
            <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
          </View>
        </View>
        
        {/* Hộp văn bản thông tin chia sẻ bên dưới */}
        <View style={styles.infoContainer}>
          <View style={styles.senderRow}>
            <Text style={styles.senderText}>Shared by {item.sender}</Text>
            <Text style={styles.timeText}>{timeString}</Text>
          </View>
          {item.caption ? (
            <Text style={styles.captionText}>{item.caption}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.replace('/')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Locket</Text>
        <TouchableOpacity style={styles.headerButton} activeOpacity={0.7}>
          <Feather name="more-horizontal" size={24} color="#1F2937" />
        </TouchableOpacity>
      </View>

      {/* Danh sách thẻ dọc */}
      <FlatList
        data={photos}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="layers" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Chưa có hoạt động chia sẻ nào.</Text>
          </View>
        }
      />

      {/* Điều hướng chân trang */}
      <BottomNav activeTab="feed" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Màu xám nhạt nền cho nổi các Card trắng
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1, // Ảnh vuông
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  infoContainer: {
    padding: 18,
    backgroundColor: '#FFFFFF',
  },
  senderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  senderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  captionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 22,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    gap: 12,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 15,
  },
});
