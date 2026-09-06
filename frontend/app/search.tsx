import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { friendService } from '../services/friendService';
import { UserSearchResult, FriendshipStatus } from '../types';
import { useToast } from '../hooks/useToast';

const C = Colors.dark;

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      handleSearch(query.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = async (searchTerm: string) => {
    setLoading(true);
    try {
      const data = await friendService.searchUsers(searchTerm);
      setResults(data);
    } catch (error: any) {
      console.warn('Search error:', error);
      showToast('error', error.response?.data?.message || 'Không thể thực hiện tìm kiếm.');
    } finally {
      setLoading(false);
    }
  };

  // Thao tác gửi lời mời / chấp nhận / hủy kết bạn
  const handleAction = async (user: UserSearchResult) => {
    setActionLoadingId(user.id);
    try {
      let msg = '';
      let newStatus: FriendshipStatus = user.friendship_status;

      if (user.friendship_status === 'none') {
        msg = await friendService.sendFriendRequest(user.id);
        newStatus = 'pending_sent';
        showToast('success', msg);
      } else if (user.friendship_status === 'pending_received') {
        msg = await friendService.acceptFriendRequest(user.id);
        newStatus = 'accepted';
        showToast('success', msg);
      } else if (user.friendship_status === 'pending_sent') {
        msg = await friendService.rejectOrCancelRequest(user.id);
        newStatus = 'none';
        showToast('info', 'Đã hủy lời mời kết bạn.');
      } else if (user.friendship_status === 'accepted') {
        msg = await friendService.rejectOrCancelRequest(user.id);
        newStatus = 'none';
        showToast('info', 'Đã hủy kết bạn.');
      }

      // Update local item status
      setResults((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, friendship_status: newStatus } : u))
      );
    } catch (error: any) {
      console.warn('Action error:', error);
      showToast('error', error.response?.data?.message || 'Thao tác thất bại.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderActionButton = (user: UserSearchResult) => {
    const isBusy = actionLoadingId === user.id;

    if (isBusy) {
      return (
        <View style={styles.btnLoading}>
          <ActivityIndicator size="small" color={C.primary} />
        </View>
      );
    }

    switch (user.friendship_status) {
      case 'none':
        return (
          <TouchableOpacity style={styles.btnPrimary} onPress={() => handleAction(user)}>
            <Text style={styles.btnPrimaryText}>+ Kết bạn</Text>
          </TouchableOpacity>
        );
      case 'pending_sent':
        return (
          <TouchableOpacity style={styles.btnOutline} onPress={() => handleAction(user)}>
            <Text style={styles.btnOutlineText}>Đã gửi</Text>
          </TouchableOpacity>
        );
      case 'pending_received':
        return (
          <TouchableOpacity style={styles.btnSuccess} onPress={() => handleAction(user)}>
            <Text style={styles.btnSuccessText}>Chấp nhận</Text>
          </TouchableOpacity>
        );
      case 'accepted':
        return (
          <View style={styles.acceptedRow}>
            <TouchableOpacity
              style={styles.btnChatSmall}
              onPress={() => router.push(`/chat/${user.id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.btnChatSmallText}>💬 Nhắn</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnAccepted} onPress={() => handleAction(user)}>
              <Text style={styles.btnAcceptedText}>Bạn bè ✓</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  const renderUserItem = ({ item }: { item: UserSearchResult }) => {
    const avatarUri = item.avatar_url
      ? { uri: item.avatar_url }
      : require('../assets/splash-icon.png');

    return (
      <View style={styles.userCard}>
        <Image source={avatarUri} style={styles.avatar} />
        <View style={styles.userInfo}>
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
        <View style={styles.actionContainer}>{renderActionButton(item)}</View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên, @username, email..."
            placeholderTextColor={C.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Đang tìm kiếm...</Text>
        </View>
      ) : query.trim().length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.hintIcon}>🔎</Text>
          <Text style={styles.hintTitle}>Tìm kiếm người dùng</Text>
          <Text style={styles.hintSub}>
            Nhập tên người dùng hoặc email để kết nối bạn bè mới.
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.hintIcon}>🤷</Text>
          <Text style={styles.hintTitle}>Không tìm thấy kết quả</Text>
          <Text style={styles.hintSub}>Không có người dùng nào khớp với "{query}".</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Nhóm 1: Người bạn đã kết bạn */}
          {results.filter((u) => u.friendship_status === 'accepted').length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>
                👥 Bạn bè của bạn ({results.filter((u) => u.friendship_status === 'accepted').length})
              </Text>
              {results
                .filter((u) => u.friendship_status === 'accepted')
                .map((item) => (
                  <View key={`friend-${item.id}`}>{renderUserItem({ item })}</View>
                ))}
            </View>
          )}

          {/* Nhóm 2: Tìm kết bạn mới */}
          {results.filter((u) => u.friendship_status !== 'accepted').length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>
                ➕ Tìm kết bạn mới ({results.filter((u) => u.friendship_status !== 'accepted').length})
              </Text>
              {results
                .filter((u) => u.friendship_status !== 'accepted')
                .map((item) => (
                  <View key={`new-${item.id}`}>{renderUserItem({ item })}</View>
                ))}
            </View>
          )}
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  backText: {
    fontSize: 24,
    color: C.text,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  clearBtn: {
    padding: 4,
  },
  clearText: {
    color: C.textMuted,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  userCard: {
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
  userInfo: {
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
  actionContainer: {
    minWidth: 90,
    alignItems: 'flex-end',
  },
  btnLoading: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  btnPrimary: {
    backgroundColor: C.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  btnOutlineText: {
    color: C.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  btnSuccess: {
    backgroundColor: C.success,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  btnSuccessText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  btnAccepted: {
    backgroundColor: `${C.primary}20`,
    borderWidth: 1,
    borderColor: C.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  btnAcceptedText: {
    color: C.primaryLight,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: C.textMuted,
    fontSize: 14,
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
  },
  hintIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  hintTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  hintSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: C.primaryLight || C.primary,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  acceptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnChatSmall: {
    backgroundColor: `${C.primary}25`,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${C.primary}60`,
  },
  btnChatSmallText: {
    color: C.primary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
