import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

interface BottomNavProps {
  activeTab: 'home' | 'feed' | 'create' | 'search' | 'profile';
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const navigateTo = (route: string) => {
    // Tránh push lặp màn hình hiện tại
    router.replace(route as any);
  };

  return (
    <View style={styles.container}>
      {/* Nút Grid (Trang chủ lưới ảnh) */}
      <TouchableOpacity
        style={styles.tabButton}
        onPress={() => navigateTo('/')}
        activeOpacity={0.7}
      >
        <Feather
          name="grid"
          size={24}
          color={activeTab === 'home' ? '#007AFF' : '#9CA3AF'}
        />
      </TouchableOpacity>

      {/* Nút Feed (Dòng thời gian dọc) */}
      <TouchableOpacity
        style={styles.tabButton}
        onPress={() => navigateTo('/feed')}
        activeOpacity={0.7}
      >
        <Feather
          name="list"
          size={24}
          color={activeTab === 'feed' ? '#007AFF' : '#9CA3AF'}
        />
      </TouchableOpacity>

      {/* Nút Tạo ảnh mới (Chụp/Chọn ảnh) - Nút chính màu xanh nổi bật */}
      <TouchableOpacity
        style={styles.centerButtonContainer}
        onPress={() => navigateTo('/create')}
        activeOpacity={0.8}
      >
        <View style={styles.centerButton}>
          <Feather name="plus" size={30} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* Nút Tìm kiếm */}
      <TouchableOpacity
        style={styles.tabButton}
        onPress={() => navigateTo('/search')}
        activeOpacity={0.7}
      >
        <Feather
          name="search"
          size={24}
          color={activeTab === 'search' ? '#007AFF' : '#9CA3AF'}
        />
      </TouchableOpacity>

      {/* Nút Profile */}
      <TouchableOpacity
        style={styles.tabButton}
        onPress={() => navigateTo('/profile')}
        activeOpacity={0.7}
      >
        <Feather
          name="user"
          size={24}
          color={activeTab === 'profile' ? '#007AFF' : '#9CA3AF'}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 70,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
  },
  centerButtonContainer: {
    top: -15, // Đẩy nút nhô lên trên một chút giống thiết kế locket
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF', // Màu xanh dương locket chính
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
