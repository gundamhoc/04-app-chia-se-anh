import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { friendService } from '../../services/friendService';
import { Friend, FriendRequest } from '../../types';
import { useToast } from '../../hooks/useToast';

const C = Colors.dark;

type TabType = 'friends' | 'requests';

export default function FriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [friendsData, requestsData] = await Promise.all([
        friendService.getFriendsList(),
        friendService.getPendingRequests(),
      ]);
      setFriends(friendsData);
      setRequests(requestsData);
    } catch (error: any) {
      console.warn('Fetch friends error:', error);
      showToast('error', 'Không thể tải dữ liệu bạn bè.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Chấp nhận lời mời kết bạn
  const handleAcceptRequest = async (request: FriendRequest) => {
    setActionLoadingId(request.requester_id);
    try {
      const msg = await friendService.acceptFriendRequest(request.requester_id);
      showToast('success', msg);
      // Reload danh sách
      fetchData();
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Chấp nhận lời mời thất bại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Từ chối lời mời
  const handleRejectRequest = async (request: FriendRequest) => {
    setActionLoadingId(request.requester_id);
    try {
      const msg = await friendService.rejectOrCancelRequest(request.requester_id);
      showToast('info', 'Đã từ chối lời mời kết bạn.');
      setRequests((prev) => prev.filter((r) => r.requester_id !== request.requester_id));
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Thao tác thất bại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Hủy kết bạn
  const handleUnfriend = async (friend: Friend) => {
    setActionLoadingId(friend.id);
    try {
      await friendService.rejectOrCancelRequest(friend.id);
      showToast('info', `Đã hủy kết bạn với ${friend.full_name || friend.username}.`);
      setFriends((prev) => prev.filter((f) => f.id !== friend.id));
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Hủy kết bạn thất bại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Render từng item bạn bè
  const renderFriendItem = ({ item }: { item: Friend }) => {
    const avatarUri = item.avatar_url
      ? { uri: item.avatar_url }
      : require('../../assets/splash-icon.png');

    const isBusy = actionLoadingId === item.id;

    return (
      <View style={styles.card}>
        <Image source={avatarUri} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.fullName} numberOfLines={1}>
            {item.full_name || item.username}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{item.username}
          </Text>
          {item.bio ? (
            <Text style={styles.bio} numberOfLines={1}>
              {item.bio}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.btnUnfriend}
          onPress={() => handleUnfriend(item)}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={C.textMuted} />
          ) : (
            <Text style={styles.btnUnfriendText}>Hủy kết bạn</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Render từng item lời mời kết bạn
  const renderRequestItem = ({ item }: { item: FriendRequest }) => {
    const avatarUri = item.avatar_url
      ? { uri: item.avatar_url }
      : require('../../assets/splash-icon.png');

    const isBusy = actionLoadingId === item.requester_id;

    return (
      <View style={styles.card}>
        <Image source={avatarUri} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.fullName} numberOfLines={1}>
            {item.full_name || item.username}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{item.username}
          </Text>
          <Text style={styles.timeText}>
            {new Date(item.request_time).toLocaleDateString('vi-VN')}
          </Text>
        </View>
        {isBusy ? (
          <ActivityIndicator size="small" color={C.primary} style={{ marginHorizontal: 16 }} />
        ) : (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={styles.btnAccept}
              onPress={() => handleAcceptRequest(item)}
            >
              <Text style={styles.btnAcceptText}>Chấp nhận</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnReject}
              onPress={() => handleRejectRequest(item)}
            >
              <Text style={styles.btnRejectText}>Xóa</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bạn bè 👥</Text>
        <TouchableOpacity
          style={styles.searchIconBtn}
          onPress={() => router.push('/search')}
        >
          <Text style={styles.searchIconText}>🔍 Tìm bạn</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-Tabs Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'friends' && styles.tabBtnActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text
            style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}
          >
            Bạn bè ({friends.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'requests' && styles.tabBtnActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text
            style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}
          >
            Lời mời {requests.length > 0 ? `(${requests.length})` : ''}
          </Text>
          {requests.length > 0 && <View style={styles.badgeDot} />}
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : activeTab === 'friends' ? (
        friends.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>Chưa có bạn bè nào</Text>
            <Text style={styles.emptySub}>
              Hãy bấm "Tìm bạn" ở góc trên để tìm kiếm và kết nối với bạn bè mới.
            </Text>
            <TouchableOpacity
              style={styles.btnGoSearch}
              onPress={() => router.push('/search')}
            >
              <Text style={styles.btnGoSearchText}>🔍 Tìm bạn bè ngay</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderFriendItem}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
            }
          />
        )
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📩</Text>
          <Text style={styles.emptyTitle}>Không có lời mời kết bạn nào</Text>
          <Text style={styles.emptySub}>
            Các lời mời kết bạn mới gửi đến bạn sẽ hiển thị tại đây.
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.friendship_id.toString()}
          renderItem={renderRequestItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: C.text,
  },
  searchIconBtn: {
    backgroundColor: `${C.primary}20`,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.primary,
  },
  searchIconText: {
    color: C.primaryLight,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  tabSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabBtn: {
    paddingVertical: 10,
    marginRight: 24,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: C.primary,
  },
  tabText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.textMuted,
  },
  tabTextActive: {
    color: C.primary,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.error,
    marginLeft: 6,
  },
  listContainer: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.separator,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  fullName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  username: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    marginTop: 2,
  },
  bio: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    marginTop: 4,
  },
  btnUnfriend: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: `${C.border}50`,
  },
  btnUnfriendText: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnAccept: {
    backgroundColor: C.success,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginRight: 8,
  },
  btnAcceptText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  btnReject: {
    backgroundColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  btnRejectText: {
    color: C.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  btnGoSearch: {
    backgroundColor: C.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  btnGoSearchText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
