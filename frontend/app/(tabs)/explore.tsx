import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../constants/config';

interface UserSearchResult {
  id: string;
  username: string;
  fullName: string;
  email: string;
  relationship: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS';
  requestId?: string | null;
}

interface PendingRequest {
  requestId: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
}

import { useSettings } from '../../context/SettingsContext';

interface UserSearchResult {
  id: string;
  username: string;
  fullName: string;
  email: string;
  relationship: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS';
  requestId?: string | null;
}

interface PendingRequest {
  requestId: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
}

export default function ExploreScreen() {
  const { token } = useAuth();
  const { colors, theme, t } = useSettings();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PendingRequest[]>([]);
  
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingPending, setLoadingPending] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPendingRequests = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/friends/pending`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const json = await response.json();
      if (json.success && json.data) {
        setIncomingRequests(json.data.incoming || []);
        setOutgoingRequests(json.data.outgoing || []);
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    } finally {
      setLoadingPending(false);
      setRefreshing(false);
    }
  }, [token]);

  const performSearch = useCallback(async (query: string) => {
    if (!token) return;
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    try {
      const response = await fetch(`${API_URL}/friends/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const json = await response.json();
      if (json.success && json.data) {
        setSearchResults(json.data);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoadingSearch(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, performSearch]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingRequests();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  const handleSendRequest = async (friendId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/friends/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ friendId }),
      });

      const json = await response.json();

      if (json.success) {
        Alert.alert('Success', 'Friend request sent!');
        setSearchResults(prev =>
          prev.map(user =>
            user.id === friendId
              ? { ...user, relationship: 'PENDING_SENT', requestId: json.data.id }
              : user
          )
        );
        fetchPendingRequests();
      } else {
        Alert.alert('Error', json.message || 'Could not send friend request');
      }
    } catch (error) {
      Alert.alert('Error', 'Connection error. Please try again.');
    }
  };

  const handleResponse = async (requestId: string, action: 'ACCEPT' | 'DECLINE') => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/friends/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, action }),
      });

      const json = await response.json();

      if (json.success) {
        Alert.alert('Success', action === 'ACCEPT' ? 'Friend request accepted!' : 'Friend request declined');
        
        setIncomingRequests(prev => prev.filter(req => req.requestId !== requestId));
        
        setSearchResults(prev =>
          prev.map(user =>
            user.requestId === requestId
              ? {
                  ...user,
                  relationship: action === 'ACCEPT' ? 'FRIENDS' : 'NONE',
                  requestId: null,
                }
              : user
          )
        );

        fetchPendingRequests();
      } else {
        Alert.alert('Error', json.message || 'Failed to respond to request');
      }
    } catch (error) {
      Alert.alert('Error', 'Connection error. Please try again.');
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const renderRelationshipButton = (item: UserSearchResult) => {
    switch (item.relationship) {
      case 'FRIENDS':
        return (
          <View style={[styles.actionBadge, { backgroundColor: colors.input }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{t('friends')}</Text>
          </View>
        );
      case 'PENDING_SENT':
        return (
          <View style={[styles.actionBadge, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{t('sent')}</Text>
          </View>
        );
      case 'PENDING_RECEIVED':
        return (
          <View style={styles.inlineActionContainer}>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: colors.accent }]}
              onPress={() => item.requestId && handleResponse(item.requestId, 'ACCEPT')}
            >
              <Text style={styles.smallBtnText}>{t('accept')}</Text>
            </TouchableOpacity>
          </View>
        );
      case 'NONE':
      default:
        return (
          <TouchableOpacity
            style={[styles.addFriendBtn, { backgroundColor: colors.accent }]}
            onPress={() => handleSendRequest(item.id)}
          >
            <Text style={styles.addFriendBtnText}>{t('add')}</Text>
          </TouchableOpacity>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('searchTitle')}</Text>
      </View>

      {/* Search Input Box */}
      <View style={styles.searchBarContainer}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery ? (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setSearchQuery('')}>
            <Text style={[styles.clearBtnText, { color: colors.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Main Content Area */}
      {searchQuery.trim().length > 0 ? (
        // Search Results List
        <View style={styles.contentList}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('searchResults')}</Text>
          {loadingSearch ? (
            <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.scrollList}
              renderItem={({ item }) => (
                <View style={[styles.userCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                    <Text style={styles.avatarText}>{getInitials(item.fullName)}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.fullName, { color: colors.text }]}>{item.fullName}</Text>
                    <Text style={[styles.username, { color: colors.textSecondary }]}>@{item.username}</Text>
                  </View>
                  {renderRelationshipButton(item)}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                    {t('noUsersFound')} "{searchQuery}"
                  </Text>
                </View>
              }
            />
          )}
        </View>
      ) : (
        // Pending Requests Lists
        <ScrollView
          style={styles.contentList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
          }
        >
          {/* 1. Incoming Requests Section */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('incomingRequests')} ({incomingRequests.length})
          </Text>
          {loadingPending ? (
            <ActivityIndicator size="small" color={colors.accent} style={styles.smallLoader} />
          ) : incomingRequests.length > 0 ? (
            incomingRequests.map((req) => (
              <View key={req.requestId} style={[styles.userCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                  <Text style={styles.avatarText}>{getInitials(req.user.fullName)}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.fullName, { color: colors.text }]}>{req.user.fullName}</Text>
                  <Text style={[styles.username, { color: colors.textSecondary }]}>@{req.user.username}</Text>
                </View>
                <View style={styles.actionContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptActionBtn, { backgroundColor: colors.accent }]}
                    onPress={() => handleResponse(req.requestId, 'ACCEPT')}
                  >
                    <Text style={styles.acceptActionText}>{t('accept')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.declineActionBtn, { backgroundColor: colors.input }]}
                    onPress={() => handleResponse(req.requestId, 'DECLINE')}
                  >
                    <Text style={[styles.declineActionText, { color: colors.text }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.emptyCardText, { color: colors.textSecondary }]}>{t('noIncoming')}</Text>
            </View>
          )}

          {/* 2. Outgoing Requests Section */}
          <Text style={[styles.sectionTitle, { marginTop: 24, color: colors.textSecondary }]}>
            {t('sentRequests')} ({outgoingRequests.length})
          </Text>
          {loadingPending ? (
            <ActivityIndicator size="small" color={colors.accent} style={styles.smallLoader} />
          ) : outgoingRequests.length > 0 ? (
            outgoingRequests.map((req) => (
              <View key={req.requestId} style={[styles.userCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: colors.input }]}>
                  <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                    {getInitials(req.user.fullName)}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.fullName, { color: colors.textSecondary }]}>{req.user.fullName}</Text>
                  <Text style={[styles.username, { color: colors.textSecondary }]}>@{req.user.username}</Text>
                </View>
                <View style={[styles.actionBadge, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{t('pending')}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.emptyCardText, { color: colors.textSecondary }]}>{t('noOutgoing')}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000000',
  },
  searchBarContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#F2F2F7',
    color: '#000000',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  clearBtn: {
    position: 'absolute',
    right: 36,
    top: 14,
  },
  clearBtnText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  contentList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  scrollList: {
    paddingBottom: 24,
  },
  loader: {
    marginTop: 40,
  },
  smallLoader: {
    marginVertical: 10,
    alignSelf: 'flex-start',
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  fullName: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  username: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addFriendBtn: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  addFriendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  actionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  friendsBadge: {
    backgroundColor: '#F2F2F7',
  },
  friendsBadgeText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  pendingSentBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  pendingSentText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineActionContainer: {
    flexDirection: 'row',
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  acceptBtn: {
    backgroundColor: '#0066FF',
  },
  smallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionButton: {
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptActionBtn: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 16,
  },
  acceptActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  declineActionBtn: {
    backgroundColor: '#F2F2F7',
    width: 36,
  },
  declineActionText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F2F2F7',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyCardText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyStateText: {
    color: '#8E8E93',
    fontSize: 14,
  },
});
