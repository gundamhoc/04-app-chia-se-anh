import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useSocket } from '../../hooks/useSocket';
import { messageService } from '../../services/messageService';
import { friendService } from '../../services/friendService';
import { groupService } from '../../services/groupService';
import { Conversation, Friend, Group } from '../../types';
import { CreateGroupModal } from '../../components/CreateGroupModal';

const C = Colors.dark;

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isConnected, socket } = useSocket();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'groups'>('all');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Modal thao tác nhanh khi nhấn giữ (Ghim & Bật/tắt thông báo)
  const [actionTarget, setActionTarget] = useState<{
    type: 'direct' | 'group';
    id: number;
    name: string;
    avatar?: string | null;
    is_pinned?: boolean;
    is_muted?: boolean;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Xử lý bật/tắt ghim
  const handleTogglePinTarget = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      if (actionTarget.type === 'direct') {
        const newPinned = await messageService.togglePin(actionTarget.id, !actionTarget.is_pinned);
        setConversations((prev) =>
          prev.map((c) => (c.friend_id === actionTarget.id ? { ...c, is_pinned: newPinned } : c))
        );
      } else {
        const newPinned = await groupService.toggleGroupPin(actionTarget.id, !actionTarget.is_pinned);
        setGroups((prev) =>
          prev.map((g) => (g.id === actionTarget.id ? { ...g, is_pinned: newPinned } : g))
        );
      }
    } catch (err) {
      console.warn('Lỗi ghim:', err);
    } finally {
      setActionLoading(false);
      setActionTarget(null);
    }
  };

  // Xử lý bật/tắt thông báo
  const handleToggleMuteTarget = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      if (actionTarget.type === 'direct') {
        const newMuted = await messageService.toggleMute(actionTarget.id, !actionTarget.is_muted);
        setConversations((prev) =>
          prev.map((c) => (c.friend_id === actionTarget.id ? { ...c, is_muted: newMuted } : c))
        );
      } else {
        const newMuted = await groupService.toggleGroupMute(actionTarget.id, !actionTarget.is_muted);
        setGroups((prev) =>
          prev.map((g) => (g.id === actionTarget.id ? { ...g, is_muted: newMuted } : g))
        );
      }
    } catch (err) {
      console.warn('Lỗi đổi thông báo:', err);
    } finally {
      setActionLoading(false);
      setActionTarget(null);
    }
  };

  // Tải danh sách hội thoại, bạn bè & nhóm
  const loadData = async () => {
    try {
      const [convs, friendsList, groupsList] = await Promise.all([
        messageService.getConversations(),
        friendService.getFriendsList(),
        groupService.getMyGroups(),
      ]);
      setConversations(convs);
      setFriends(friendsList);
      setGroups(groupsList);
    } catch (e) {
      console.warn('Lỗi tải danh sách tin nhắn:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload mỗi khi tab được focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Lắng nghe realtime qua Socket.io khi có tin nhắn mới hoặc sự kiện nhóm
  useEffect(() => {
    if (!socket) return;

    const handleDataReload = () => {
      loadData();
    };

    socket.on('new_direct_message', handleDataReload);
    socket.on('messages_marked_read', handleDataReload);
    socket.on('new_group_message', handleDataReload);
    socket.on('invited_to_group', handleDataReload);
    socket.on('group_updated', handleDataReload);
    socket.on('group_members_updated', handleDataReload);

    return () => {
      socket.off('new_direct_message', handleDataReload);
      socket.off('messages_marked_read', handleDataReload);
      socket.off('new_group_message', handleDataReload);
      socket.off('invited_to_group', handleDataReload);
      socket.off('group_updated', handleDataReload);
      socket.off('group_members_updated', handleDataReload);
    };
  }, [socket]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openChat = (friendId: number, friendName: string, avatarUrl?: string | null) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: friendId.toString(),
        name: friendName,
        avatar: avatarUrl || '',
      },
    });
  };

  const openGroupChat = (groupId: number) => {
    router.push({
      pathname: '/group-chat/[id]',
      params: { id: groupId.toString() },
    });
  };

  // Format thời gian hiển thị tương đối
  const formatTime = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins}p`;
      if (diffHours < 24) return `${diffHours}h`;
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  // Lọc danh sách hội thoại cá nhân
  const filteredConversations = conversations.filter((c) =>
    (c.friend_name || c.friend_username).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Lọc danh sách nhóm
  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sắp xếp ưu tiên Ghim lên đầu
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (Boolean(b.is_pinned) !== Boolean(a.is_pinned)) {
      return b.is_pinned ? 1 : -1;
    }
    return 0;
  });

  const sortedGroups = [...filteredGroups].sort((a, b) => {
    if (Boolean(b.is_pinned) !== Boolean(a.is_pinned)) {
      return b.is_pinned ? 1 : -1;
    }
    return 0;
  });

  // Render từng hội thoại cá nhân 1-1
  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const avatarUri = item.friend_avatar
      ? { uri: item.friend_avatar }
      : require('../../assets/splash-icon.png');

    const isUnread = item.unread_count > 0;

    let previewText = 'Bắt đầu cuộc trò chuyện...';
    if (item.last_message_image) {
      previewText = '📷 [Hình ảnh]';
    } else if (item.last_message_file_name) {
      previewText = `📁 ${item.last_message_file_name}`;
    } else if (item.last_message_text) {
      previewText = item.last_message_text;
    }

    return (
      <TouchableOpacity
        style={[
          styles.convItem,
          isUnread && styles.convItemUnread,
          item.is_pinned && styles.convItemPinned,
        ]}
        activeOpacity={0.7}
        onPress={() => openChat(item.friend_id, item.friend_name, item.friend_avatar)}
        onLongPress={() =>
          setActionTarget({
            type: 'direct',
            id: item.friend_id,
            name: item.friend_name || item.friend_username,
            avatar: item.friend_avatar,
            is_pinned: Boolean(item.is_pinned),
            is_muted: Boolean(item.is_muted),
          })
        }
      >
        <View style={styles.avatarWrapper}>
          <Image
            source={avatarUri}
            style={styles.avatar}
            {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
          />
          {isConnected && <View style={styles.onlineBadge} />}
        </View>

        <View style={styles.convDetails}>
          <View style={styles.convTopRow}>
            <View style={styles.nameWithBadges}>
              {item.is_pinned && <Text style={styles.pinIcon}>📌</Text>}
              <Text style={[styles.friendName, isUnread && styles.friendNameBold]} numberOfLines={1}>
                {item.friend_name || item.friend_username}
              </Text>
              {item.is_muted && <Text style={styles.muteIcon}>🔕</Text>}
            </View>
            {item.last_message_time && (
              <Text style={styles.timeText}>{formatTime(item.last_message_time)}</Text>
            )}
          </View>

          <View style={styles.convBottomRow}>
            <Text
              style={[styles.previewText, isUnread && styles.previewTextUnread]}
              numberOfLines={1}
            >
              {previewText}
            </Text>
            {isUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {item.unread_count > 9 ? '9+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render từng nhóm trò chuyện
  const renderGroupItem = ({ item }: { item: Group }) => {
    const avatarUri = item.avatar_url
      ? { uri: item.avatar_url }
      : require('../../assets/splash-icon.png');

    let previewText = 'Chưa có tin nhắn nào...';
    if (item.last_message) {
      const sender = item.last_message.sender_name || 'Thành viên';
      if (item.last_message.image_url) {
        previewText = `${sender}: 📷 [Hình ảnh]`;
      } else if (item.last_message.file_name) {
        previewText = `${sender}: 📁 ${item.last_message.file_name}`;
      } else if (item.last_message.text) {
        previewText = `${sender}: ${item.last_message.text}`;
      }
    }

    return (
      <TouchableOpacity
        style={[styles.convItem, item.is_pinned && styles.convItemPinned]}
        activeOpacity={0.7}
        onPress={() => openGroupChat(item.id)}
        onLongPress={() =>
          setActionTarget({
            type: 'group',
            id: item.id,
            name: item.name,
            avatar: item.avatar_url,
            is_pinned: Boolean(item.is_pinned),
            is_muted: Boolean(item.is_muted),
          })
        }
      >
        <View style={styles.avatarWrapper}>
          <Image
            source={avatarUri}
            style={styles.avatar}
            {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
          />
          <View style={styles.groupIconBadge}>
            <Text style={styles.groupIconEmoji}>👥</Text>
          </View>
        </View>

        <View style={styles.convDetails}>
          <View style={styles.convTopRow}>
            <View style={styles.nameWithBadges}>
              {item.is_pinned && <Text style={styles.pinIcon}>📌</Text>}
              <Text style={styles.friendName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.is_muted && <Text style={styles.muteIcon}>🔕</Text>}
            </View>
            {item.last_message?.time && (
              <Text style={styles.timeText}>{formatTime(item.last_message.time)}</Text>
            )}
          </View>

          <View style={styles.convBottomRow}>
            <Text style={styles.previewText} numberOfLines={1}>
              {previewText}
            </Text>
            <View style={styles.memberCountBadge}>
              <Text style={styles.memberCountText}>{item.member_count} tv</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarTitleBox}>
          <Text style={styles.appName}>Trò chuyện 💬</Text>
        </View>

        <View style={styles.appBarRightBox}>
          <TouchableOpacity
            style={styles.createGroupBtn}
            onPress={() => setShowCreateGroupModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.createGroupBtnText}>👥＋ Tạo nhóm</Text>
          </TouchableOpacity>

          <View style={[styles.socketBadge, isConnected ? styles.socketOn : styles.socketOff]}>
            <View style={[styles.socketDot, isConnected ? styles.dotOn : styles.dotOff]} />
            <Text style={styles.socketText}>{isConnected ? 'Trực tuyến' : 'Ngoại tuyến'}</Text>
          </View>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm bạn bè, nhóm hoặc tin nhắn..."
          placeholderTextColor={C.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Filter: Tất cả | Cá nhân | Nhóm */}
      <View style={styles.tabFilterRow}>
        <TouchableOpacity
          style={[styles.tabFilterItem, activeTab === 'all' && styles.tabFilterItemActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabFilterText, activeTab === 'all' && styles.tabFilterTextActive]}>
            Tất cả
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabFilterItem, activeTab === 'direct' && styles.tabFilterItemActive]}
          onPress={() => setActiveTab('direct')}
        >
          <Text style={[styles.tabFilterText, activeTab === 'direct' && styles.tabFilterTextActive]}>
            Cá nhân ({filteredConversations.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabFilterItem, activeTab === 'groups' && styles.tabFilterItemActive]}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabFilterText, activeTab === 'groups' && styles.tabFilterTextActive]}>
            Nhóm ({filteredGroups.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Thanh bạn bè lướt ngang để nhắn tin nhanh */}
      {friends.length > 0 && activeTab !== 'groups' && (
        <View style={styles.quickFriendsSection}>
          <Text style={styles.sectionHeader}>Bạn bè</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickFriendsList}
          >
            {friends.map((f) => {
              const friendAvatar = f.avatar_url
                ? { uri: f.avatar_url }
                : require('../../assets/splash-icon.png');
              return (
                <TouchableOpacity
                  key={f.id}
                  style={styles.quickFriendItem}
                  onPress={() => openChat(f.id, f.full_name || f.username, f.avatar_url)}
                  activeOpacity={0.7}
                >
                  <View style={styles.quickAvatarBox}>
                    <Image
                      source={friendAvatar}
                      style={styles.quickAvatar}
                      {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
                    />
                    {isConnected && <View style={styles.quickOnlineDot} />}
                  </View>
                  <Text style={styles.quickFriendName} numberOfLines={1}>
                    {f.full_name || f.username}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Danh sách cuộc trò chuyện */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
        </View>
      ) : activeTab === 'groups' ? (
        <FlatList
          data={sortedGroups}
          keyExtractor={(item) => `group_${item.id}`}
          renderItem={renderGroupItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>👥✨</Text>
              <Text style={styles.emptyTitle}>Chưa tham gia nhóm nào</Text>
              <Text style={styles.emptyDesc}>Bấm nút "Tạo nhóm" ở trên để tạo phòng chat chung với bạn bè!</Text>
            </View>
          }
        />
      ) : activeTab === 'direct' ? (
        <FlatList
          data={sortedConversations}
          keyExtractor={(item) => `direct_${item.friend_id}`}
          renderItem={renderConversationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>💬✨</Text>
              <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện nào</Text>
              <Text style={styles.emptyDesc}>Chọn bạn bè ở trên để bắt đầu trò chuyện nhé!</Text>
            </View>
          }
        />
      ) : (
        /* Tab Tất cả */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />
          }
        >
          {sortedGroups.length > 0 && (
            <View style={styles.groupSectionBlock}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionBlockTitle}>Nhóm trò chuyện 👥</Text>
                <Text style={styles.sectionBlockCount}>{sortedGroups.length}</Text>
              </View>
              {sortedGroups.map((g) => (
                <View key={`all_group_${g.id}`}>
                  {renderGroupItem({ item: g })}
                </View>
              ))}
            </View>
          )}

          {sortedConversations.length > 0 && (
            <View style={styles.groupSectionBlock}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionBlockTitle}>Cá nhân (1-1) 💬</Text>
                <Text style={styles.sectionBlockCount}>{sortedConversations.length}</Text>
              </View>
              {sortedConversations.map((c) => (
                <View key={`all_direct_${c.friend_id}`}>
                  {renderConversationItem({ item: c })}
                </View>
              ))}
            </View>
          )}

          {sortedGroups.length === 0 && sortedConversations.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>💬✨</Text>
              <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện nào</Text>
              <Text style={styles.emptyDesc}>Bắt đầu trò chuyện với bạn bè hoặc tạo nhóm mới ngay!</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal Tạo nhóm mới */}
      <CreateGroupModal
        visible={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onGroupCreated={(newGroup) => {
          loadData();
          openGroupChat(newGroup.id);
        }}
      />

      {/* Modal Tùy chọn Nhanh khi nhấn giữ: Ghim & Bật/Tắt thông báo */}
      <Modal
        visible={actionTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionTarget(null)}
      >
        <TouchableOpacity
          style={styles.actionModalOverlay}
          activeOpacity={1}
          onPress={() => setActionTarget(null)}
        >
          <View style={styles.actionModalCard}>
            <Text style={styles.actionModalTitle} numberOfLines={1}>
              {actionTarget?.name}
            </Text>

            {/* Nút Ghim / Bỏ ghim */}
            <TouchableOpacity
              style={styles.actionModalRow}
              onPress={handleTogglePinTarget}
              disabled={actionLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.actionModalRowIcon}>📌</Text>
              <Text style={styles.actionModalRowText}>
                {actionTarget?.is_pinned ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim lên đầu danh sách'}
              </Text>
            </TouchableOpacity>

            {/* Nút Bật / Tắt thông báo */}
            <TouchableOpacity
              style={styles.actionModalRow}
              onPress={handleToggleMuteTarget}
              disabled={actionLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.actionModalRowIcon}>
                {actionTarget?.is_muted ? '🔔' : '🔕'}
              </Text>
              <Text style={styles.actionModalRowText}>
                {actionTarget?.is_muted ? 'Bật thông báo' : 'Tắt thông báo'}
              </Text>
            </TouchableOpacity>

            {/* Nút Mở chat */}
            <TouchableOpacity
              style={styles.actionModalRow}
              onPress={() => {
                if (!actionTarget) return;
                const target = actionTarget;
                setActionTarget(null);
                if (target.type === 'direct') {
                  openChat(target.id, target.name, target.avatar);
                } else {
                  openGroupChat(target.id);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.actionModalRowIcon}>💬</Text>
              <Text style={styles.actionModalRowText}>Mở cuộc trò chuyện</Text>
            </TouchableOpacity>

            {/* Nút Hủy */}
            <TouchableOpacity
              style={styles.actionModalCancelBtn}
              onPress={() => setActionTarget(null)}
            >
              <Text style={styles.actionModalCancelText}>Hủy bỏ</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#202030',
  },
  appBarTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  appBarRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createGroupBtn: {
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    borderWidth: 1,
    borderColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  createGroupBtnText: {
    color: '#B0A8FF',
    fontSize: 12,
    fontWeight: '700',
  },
  socketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  socketOn: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
  },
  socketOff: {
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
  },
  socketDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotOn: {
    backgroundColor: '#00E676',
  },
  dotOff: {
    backgroundColor: '#FF5252',
  },
  socketText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#C0C0D0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E2D',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },
  clearSearch: {
    color: C.textMuted,
    fontSize: 14,
    paddingHorizontal: 4,
  },
  tabFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    gap: 8,
  },
  tabFilterItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#1E1E2D',
  },
  tabFilterItemActive: {
    backgroundColor: C.primary,
  },
  tabFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A9E',
  },
  tabFilterTextActive: {
    color: '#FFFFFF',
  },
  quickFriendsSection: {
    marginTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A28',
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.textMuted,
    marginLeft: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickFriendsList: {
    paddingHorizontal: 12,
    gap: 12,
  },
  quickFriendItem: {
    alignItems: 'center',
    width: 60,
  },
  quickAvatarBox: {
    position: 'relative',
  },
  quickAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: C.primary,
  },
  quickOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00E676',
    borderWidth: 2,
    borderColor: C.background,
  },
  quickFriendName: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.text,
    marginTop: 4,
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  groupSectionBlock: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2D',
    marginBottom: 6,
  },
  sectionBlockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9C95FF',
    textTransform: 'uppercase',
  },
  sectionBlockCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A8A9E',
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#181826',
  },
  convItemUnread: {
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2A2A3E',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00E676',
    borderWidth: 2,
    borderColor: C.background,
  },
  groupIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: C.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIconEmoji: {
    fontSize: 10,
  },
  convDetails: {
    flex: 1,
  },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  friendName: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: C.text,
    flex: 1,
    marginRight: 8,
  },
  friendNameBold: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  convBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    flex: 1,
    marginRight: 8,
  },
  previewTextUnread: {
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  unreadBadge: {
    backgroundColor: C.primary,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  memberCountBadge: {
    backgroundColor: '#252538',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  memberCountText: {
    color: '#A0A0B2',
    fontSize: 10,
    fontWeight: '600',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: C.textMuted,
    fontSize: 14,
  },
  emptyBox: {
    paddingTop: 60,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  convItemPinned: {
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
  },
  nameWithBadges: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinIcon: {
    fontSize: 12,
  },
  muteIcon: {
    fontSize: 12,
    marginLeft: 2,
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  actionModalCard: {
    backgroundColor: '#1E1E2D',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2E2E42',
    gap: 8,
  },
  actionModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  actionModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#262638',
    gap: 12,
  },
  actionModalRowIcon: {
    fontSize: 18,
  },
  actionModalRowText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  actionModalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  actionModalCancelText: {
    fontSize: 14,
    color: '#8A8A9E',
    fontWeight: '600',
  },
});
