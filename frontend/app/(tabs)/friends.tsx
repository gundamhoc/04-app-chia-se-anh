import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ColorScheme } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../utils/i18n';
import { friendService } from '../../services/friendService';
import { Friend, FriendRequest, UserSearchResult, FriendshipStatus } from '../../types';
import { useToast } from '../../hooks/useToast';
import { useSocket } from '../../hooks/useSocket';

type TabType = 'friends' | 'suggestions' | 'requests';

export default function FriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { isUserOnline } = useSocket();
  const { colors: C, isDark } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Search kết hợp: tìm bạn bè đã kết bạn & tìm kết bạn mới
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [friendsData, requestsData, suggestionsData] = await Promise.all([
        friendService.getFriendsList(),
        friendService.getPendingRequests(),
        friendService.getSuggestions(),
      ]);
      setFriends(friendsData);
      setRequests(requestsData);
      setSuggestions(suggestionsData);
    } catch (error: unknown) {
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

  // Debounced search khi người dùng nhập từ khóa tìm kiếm
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await friendService.searchUsers(searchQuery.trim());
        setSearchResults(data);
      } catch (err: unknown) {
        console.warn('Friends search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Nhắn tin với bạn bè
  const handleChat = (friend: Friend | UserSearchResult) => {
    const friendName = friend.full_name || friend.username;
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: friend.id.toString(),
        name: friendName,
        avatar: friend.avatar_url || '',
      },
    });
  };

  // Gửi lời mời kết bạn (dùng cho gợi ý hoặc tìm kiếm)
  const handleSendRequest = async (user: UserSearchResult) => {
    setActionLoadingId(user.id);
    try {
      const msg = await friendService.sendFriendRequest(user.id);
      showToast('success', msg);

      // Cập nhật trạng thái trong suggestions
      setSuggestions((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, friendship_status: 'pending_sent' } : u))
      );

      // Cập nhật trạng thái trong searchResults
      setSearchResults((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, friendship_status: 'pending_sent' } : u))
      );
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Gửi lời mời thất bại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Chấp nhận lời mời kết bạn
  const handleAcceptRequest = async (requesterId: number) => {
    setActionLoadingId(requesterId);
    try {
      const msg = await friendService.acceptFriendRequest(requesterId);
      showToast('success', msg);
      // Tải lại dữ liệu sau khi chấp nhận
      fetchData();
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Chấp nhận lời mời thất bại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Từ chối lời mời
  const handleRejectRequest = async (requesterId: number) => {
    setActionLoadingId(requesterId);
    try {
      await friendService.rejectOrCancelRequest(requesterId);
      showToast('info', 'Đã từ chối lời mời kết bạn.');
      setRequests((prev) => prev.filter((r) => r.requester_id !== requesterId));
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Thao tác thất bại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Hủy kết bạn
  const handleUnfriend = async (friendId: number, friendName: string) => {
    setActionLoadingId(friendId);
    try {
      await friendService.rejectOrCancelRequest(friendId);
      showToast('info', `Đã hủy kết bạn với ${friendName}.`);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      setSearchResults((prev) =>
        prev.map((u) => (u.id === friendId ? { ...u, friendship_status: 'none' } : u))
      );
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Hủy kết bạn thất bại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Phân loại kết quả tìm kiếm thành:
  // 1. Bạn bè của bạn (đã kết bạn)
  // 2. Tìm kết bạn mới (chưa kết bạn, đã gửi/nhận lời mời)
  const { matchedFriends, matchedNewUsers } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { matchedFriends: [], matchedNewUsers: [] };
    }
    const q = searchQuery.toLowerCase().trim();

    // Bạn bè trong state khớp từ khóa
    const localMatchedFriends = friends.filter(
      (f) =>
        (f.full_name && f.full_name.toLowerCase().includes(q)) ||
        (f.username && f.username.toLowerCase().includes(q)) ||
        (f.email && f.email.toLowerCase().includes(q))
    );

    // Người dùng từ API search
    const apiAcceptedFriends = searchResults.filter((u) => u.friendship_status === 'accepted');
    const apiNewUsers = searchResults.filter((u) => u.friendship_status !== 'accepted');

    // Hợp nhất danh sách bạn bè đã kết bạn (tránh trùng id)
    const friendMap = new Map<number, Friend | UserSearchResult>();
    localMatchedFriends.forEach((f) => friendMap.set(f.id, f));
    apiAcceptedFriends.forEach((f) => friendMap.set(f.id, f));

    return {
      matchedFriends: Array.from(friendMap.values()),
      matchedNewUsers: apiNewUsers,
    };
  }, [searchQuery, friends, searchResults]);

  // Render 1 item bạn bè đã kết bạn
  const renderFriendCard = (item: Friend | UserSearchResult) => {
    const avatarUri = item.avatar_url
      ? { uri: item.avatar_url }
      : require('../../assets/splash-icon.png');

    const isBusy = actionLoadingId === item.id;
    const displayName = item.full_name || item.username;

    return (
      <View key={`friend-${item.id}`} style={styles.card}>
        <TouchableOpacity
          style={styles.cardMainTouch}
          onPress={() =>
            router.push({
              pathname: '/user/[id]',
              params: { id: item.id.toString() },
            })
          }
          activeOpacity={0.7}
        >
          <View style={styles.avatarWrapper}>
            <Image source={avatarUri} style={styles.avatar} />
            {isUserOnline(item.id) && <View style={styles.onlineBadge} />}
          </View>
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.fullName} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.badgeFriend}>
                <Text style={styles.badgeFriendText}>{t('friends')}</Text>
              </View>
            </View>
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
            </Text>
            {item.bio ? (
              <Text style={styles.bio} numberOfLines={1}>
                {item.bio}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.friendActions}>
          <TouchableOpacity
            style={styles.btnChat}
            onPress={() => handleChat(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.btnChatText}>💬 {t('messages')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnUnfriend}
            onPress={() => handleUnfriend(item.id, displayName)}
            disabled={isBusy}
            activeOpacity={0.7}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={C.textMuted} />
            ) : (
              <Text style={styles.btnUnfriendText}>{t('unfriend')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render 1 item gợi ý kết bạn hoặc kết quả tìm kiếm người chưa kết bạn
  const renderSuggestionCard = (item: UserSearchResult) => {
    const avatarUri = item.avatar_url
      ? { uri: item.avatar_url }
      : require('../../assets/splash-icon.png');

    const isBusy = actionLoadingId === item.id;
    const displayName = item.full_name || item.username;

    return (
      <View key={`suggest-${item.id}`} style={styles.card}>
        <TouchableOpacity
          style={styles.cardMainTouch}
          onPress={() =>
            router.push({
              pathname: '/user/[id]',
              params: { id: item.id.toString() },
            })
          }
          activeOpacity={0.7}
        >
          <Image source={avatarUri} style={styles.avatar} />
          <View style={styles.info}>
            <Text style={styles.fullName} numberOfLines={1}>
              {displayName}
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
        </TouchableOpacity>

        {isBusy ? (
          <ActivityIndicator size="small" color={C.primary} style={{ marginHorizontal: 16 }} />
        ) : item.friendship_status === 'none' ? (
          <TouchableOpacity
            style={styles.btnAddFriend}
            onPress={() => handleSendRequest(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.btnAddFriendText}>+ {t('add_friend')}</Text>
          </TouchableOpacity>
        ) : item.friendship_status === 'pending_sent' ? (
          <View style={styles.badgeSent}>
            <Text style={styles.badgeSentText}>{t('request_sent')} ✓</Text>
          </View>
        ) : item.friendship_status === 'pending_received' ? (
          <TouchableOpacity
            style={styles.btnAccept}
            onPress={() => handleAcceptRequest(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.btnAcceptText}>{t('accept')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.badgeFriend}>
            <Text style={styles.badgeFriendText}>{t('friends')}</Text>
          </View>
        )}
      </View>
    );
  };

  // Render 1 item lời mời kết bạn nhận được
  const renderRequestCard = ({ item }: { item: FriendRequest }) => {
    const avatarUri = item.avatar_url
      ? { uri: item.avatar_url }
      : require('../../assets/splash-icon.png');

    const isBusy = actionLoadingId === item.requester_id;
    const displayName = item.full_name || item.username;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardMainTouch}
          onPress={() =>
            router.push({
              pathname: '/user/[id]',
              params: { id: item.requester_id.toString() },
            })
          }
          activeOpacity={0.7}
        >
          <Image source={avatarUri} style={styles.avatar} />
          <View style={styles.info}>
            <Text style={styles.fullName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
            </Text>
            <Text style={styles.timeText}>
              {new Date(item.request_time).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
            </Text>
          </View>
        </TouchableOpacity>
        {isBusy ? (
          <ActivityIndicator size="small" color={C.primary} style={{ marginHorizontal: 16 }} />
        ) : (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={styles.btnAccept}
              onPress={() => handleAcceptRequest(item.requester_id)}
            >
              <Text style={styles.btnAcceptText}>{t('accept')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnReject}
              onPress={() => handleRejectRequest(item.requester_id)}
            >
              <Text style={styles.btnRejectText}>{t('delete')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('friends')} 👥</Text>
      </View>

      {/* Thanh Tìm Kiếm Bạn Bè: Tìm kết bạn & người bạn đã kết bạn */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('search_friends_input')}
            placeholderTextColor={C.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={C.primary} style={{ marginRight: 6 }} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Nếu đang tìm kiếm: Hiển thị kết quả phân tách Bạn bè của bạn & Tìm kết bạn mới */}
      {searchQuery.trim().length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.searchResultContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {matchedFriends.length === 0 && matchedNewUsers.length === 0 && !isSearching ? (
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>🤷</Text>
              <Text style={styles.emptyTitle}>{t('no_results_for_query')}</Text>
              <Text style={styles.emptySub}>
                {t('no_users_match')} "{searchQuery}".
              </Text>
              <TouchableOpacity
                style={styles.btnResetSearch}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.btnResetSearchText}>✕ {t('clear_search')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* PHẦN 1: Người bạn đã kết bạn */}
              {matchedFriends.length > 0 && (
                <View style={styles.searchSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>
                      👥 {t('your_friends_section')} ({matchedFriends.length})
                    </Text>
                  </View>
                  {matchedFriends.map((f) => renderFriendCard(f))}
                </View>
              )}

              {/* PHẦN 2: Tìm kết bạn (người dùng mới) */}
              {matchedNewUsers.length > 0 && (
                <View style={styles.searchSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>
                      ➕ {t('find_friends_section')} ({matchedNewUsers.length})
                    </Text>
                  </View>
                  {matchedNewUsers.map((u) => renderSuggestionCard(u))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        /* Khi không tìm kiếm: Hiển thị 3 Sub-Tabs: Bạn bè, Gợi ý kết bạn, Lời mời */
        <>
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'friends' && styles.tabBtnActive]}
              onPress={() => setActiveTab('friends')}
            >
              <Text
                style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}
              >
                {t('friends')} ({friends.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'suggestions' && styles.tabBtnActive]}
              onPress={() => setActiveTab('suggestions')}
            >
              <Text
                style={[styles.tabText, activeTab === 'suggestions' && styles.tabTextActive]}
              >
                {t('tab_suggestions')} ({suggestions.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'requests' && styles.tabBtnActive]}
              onPress={() => setActiveTab('requests')}
            >
              <Text
                style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}
              >
                {t('tab_requests')} {requests.length > 0 ? `(${requests.length})` : ''}
              </Text>
              {requests.length > 0 && <View style={styles.badgeDot} />}
            </TouchableOpacity>
          </View>

          {/* Nội dung tương ứng theo từng Tab */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={C.primary} />
            </View>
          ) : activeTab === 'friends' ? (
            friends.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>{t('no_friends')}</Text>
                <Text style={styles.emptySub}>
                  {t('no_suggestions_desc')}
                </Text>
                <TouchableOpacity
                  style={styles.btnGoSuggestions}
                  onPress={() => setActiveTab('suggestions')}
                >
                  <Text style={styles.btnGoSuggestionsText}>✨ {t('see_suggestions')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => renderFriendCard(item)}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
                }
              />
            )
          ) : activeTab === 'suggestions' ? (
            suggestions.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyIcon}>✨</Text>
                <Text style={styles.emptyTitle}>{t('no_suggestions')}</Text>
                <Text style={styles.emptySub}>
                  {t('no_suggestions_desc')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => renderSuggestionCard(item)}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
                }
              />
            )
          ) : requests.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📩</Text>
              <Text style={styles.emptyTitle}>{t('no_requests')}</Text>
              <Text style={styles.emptySub}>
                {t('no_requests_desc')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={requests}
              keyExtractor={(item) => item.friendship_id.toString()}
              renderItem={renderRequestCard}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
              }
            />
          )}
        </>
      )}
    </View>
  );
}

const createStyles = (C: ColorScheme, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: C.text,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 42,
    borderWidth: 1,
    borderColor: `${C.primary}40`,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.text,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 14,
    color: C.textMuted,
  },
  searchResultContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  searchSection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: C.primaryLight || C.primary,
  },
  tabSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  tabBtn: {
    paddingVertical: 10,
    marginRight: 20,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: C.primary,
  },
  tabText: {
    fontSize: 14,
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 60,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardMainTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.separator,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: C.card,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fullName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  badgeFriend: {
    backgroundColor: `${C.success}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeFriendText: {
    color: C.success,
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  username: {
    fontSize: 12,
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
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnChat: {
    backgroundColor: `${C.primary}25`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${C.primary}60`,
  },
  btnChatText: {
    color: C.primary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  btnUnfriend: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: `${C.border}60`,
  },
  btnUnfriendText: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  btnAddFriend: {
    backgroundColor: C.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  btnAddFriendText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  badgeSent: {
    backgroundColor: `${C.primary}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${C.primary}50`,
  },
  badgeSentText: {
    color: C.primaryLight || C.primary,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnAccept: {
    backgroundColor: C.success,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 6,
  },
  btnAcceptText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  btnReject: {
    backgroundColor: C.border,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
  },
  btnRejectText: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  emptyIcon: {
    fontSize: 46,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  btnGoSuggestions: {
    backgroundColor: C.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  btnGoSuggestionsText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  btnResetSearch: {
    backgroundColor: `${C.border}60`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  btnResetSearchText: {
    color: C.text,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
