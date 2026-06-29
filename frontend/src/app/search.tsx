import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { mockStore, Photo } from '../constants/mock-store';
import BottomNav from '../components/bottom-nav';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

// Danh sách bạn bè giả lập để hiển thị ở tab Friends
const MOCK_FRIENDS = [
  { id: 'f1', name: 'Nguyễn Anh Tuấn', username: 'tuan_nguyen', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', isFriend: true },
  { id: 'f2', name: 'Lê Minh Triết', username: 'triet_le', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', isFriend: false },
  { id: 'f3', name: 'Trần Thu Trang', username: 'trang_tran', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', isFriend: true },
  { id: 'f4', name: 'Phạm Hồng Nhung', username: 'nhung_pham', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', isFriend: false },
  { id: 'f5', name: 'Đỗ Hải Đăng', username: 'dang_do', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', isFriend: false },
];

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'trending' | 'friends'>('trending');
  const [friendsList, setFriendsList] = useState(MOCK_FRIENDS);

  const trendingPhotos = mockStore.getTrendingPhotos();

  // Lọc danh sách trending hoặc bạn bè dựa trên từ khóa tìm kiếm
  const filteredTrending = trendingPhotos.filter(
    (photo) =>
      photo.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      photo.caption.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFriends = friendsList.filter(
    (friend) =>
      friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle trạng thái kết bạn
  const toggleFriend = (id: string) => {
    setFriendsList(
      friendsList.map((friend) =>
        friend.id === id ? { ...friend, isFriend: !friend.isFriend } : friend
      )
    );
  };

  const renderTrendingItem = ({ item }: { item: Photo }) => (
    <View style={styles.gridItem}>
      <Image source={{ uri: item.url }} style={styles.photo} />
      <View style={styles.trendingBadge}>
        <Text style={styles.trendingBadgeText}>Trending</Text>
      </View>
      <View style={styles.photoInfo}>
        <Text style={styles.photoSender}>{item.sender}</Text>
      </View>
    </View>
  );

  const renderFriendItem = ({ item }: { item: typeof MOCK_FRIENDS[0] }) => (
    <View style={styles.friendItem}>
      <View style={styles.friendInfo}>
        <Image source={{ uri: item.avatar }} style={styles.friendAvatar} />
        <View>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendUsername}>@{item.username}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.friendBtn, item.isFriend ? styles.friendBtnRemove : styles.friendBtnAdd]}
        onPress={() => toggleFriend(item.id)}
        activeOpacity={0.7}
      >
        <Text style={[styles.friendBtnText, item.isFriend ? styles.friendBtnTextRemove : styles.friendBtnTextAdd]}>
          {item.isFriend ? 'Hủy kết bạn' : 'Kết bạn'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Locket</Text>
      </View>

      {/* Ô tìm kiếm */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends or photos"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Bộ chọn Tab */}
      <View style={styles.tabHeader}>
        <TouchableOpacity
          style={[styles.tabBtn, activeSubTab === 'trending' && styles.tabBtnActive]}
          onPress={() => setActiveSubTab('trending')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, activeSubTab === 'trending' && styles.tabBtnTextActive]}>
            Trending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeSubTab === 'friends' && styles.tabBtnActive]}
          onPress={() => setActiveSubTab('friends')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, activeSubTab === 'friends' && styles.tabBtnTextActive]}>
            Friends
          </Text>
        </TouchableOpacity>
      </View>

      {/* Nội dung danh sách */}
      {activeSubTab === 'trending' ? (
        <FlatList
          data={filteredTrending}
          renderItem={renderTrendingItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="eye-off" size={40} color="#9CA3AF" />
              <Text style={styles.emptyText}>Không tìm thấy ảnh thịnh hành nào.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredFriends}
          renderItem={renderFriendItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.friendsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="users" size={40} color="#9CA3AF" />
              <Text style={styles.emptyText}>Không tìm thấy bạn bè nào.</Text>
            </View>
          }
        />
      )}

      {/* Điều hướng chân trang */}
      <BottomNav activeTab="search" />
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
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.5,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
    padding: 0,
  },
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#FF6B6B', // Màu cam đỏ giống ảnh locket search
  },
  tabBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabBtnTextActive: {
    color: '#1F2937',
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  gridItem: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH, // Ảnh vuông giống trending search
    margin: 8,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  trendingBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#FF8A8A', // Màu cam đỏ gradient nhẹ
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  trendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  photoInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  photoSender: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Friends Tab Styles
  friendsList: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  friendUsername: {
    fontSize: 13,
    color: '#6B7280',
  },
  friendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendBtnAdd: {
    backgroundColor: '#007AFF',
  },
  friendBtnRemove: {
    backgroundColor: '#F3F4F6',
  },
  friendBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  friendBtnTextAdd: {
    color: '#FFFFFF',
  },
  friendBtnTextRemove: {
    color: '#EF4444',
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
