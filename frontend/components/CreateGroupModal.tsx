import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ColorScheme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { friendService } from '../services/friendService';
import { groupService } from '../services/groupService';
import { Friend, Group } from '../types';
import { useI18n } from '../utils/i18n';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: (group: Group) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  onClose,
  onGroupCreated,
}) => {
  const { colors: C, isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarActionVisible, setAvatarActionVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setGroupName('');
      setSelectedFriendIds([]);
      setSearchQuery('');
      setErrorText('');
      setAvatarUri(null);
      loadFriends();
    }
  }, [visible]);

  const handlePickAvatar = async (source: 'camera' | 'library') => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Lỗi chọn ảnh avatar nhóm:', e);
    }
  };

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const list = await friendService.getFriendsList();
      setFriends(list);
    } catch (e) {
      console.warn('Lỗi tải danh sách bạn bè:', e);
    } finally {
      setLoadingFriends(false);
    }
  };

  const toggleSelectFriend = (friendId: number) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || groupName.trim().length < 2) {
      setErrorText('Tên nhóm phải có ít nhất 2 ký tự.');
      return;
    }

    setCreating(true);
    setErrorText('');
    try {
      const newGroup = await groupService.createGroup(
        groupName.trim(),
        selectedFriendIds,
        avatarUri || undefined
      );
      onGroupCreated(newGroup);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tạo nhóm lúc này.';
      setErrorText(msg);
    } finally {
      setCreating(false);
    }
  };

  const filteredFriends = friends.filter((f) =>
    (f.full_name || f.username).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('create_group_title')} 👥</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Group Avatar Selection */}
          <View style={styles.avatarPickerContainer}>
            <TouchableOpacity
              style={styles.avatarPickerBtn}
              onPress={() => setAvatarActionVisible(true)}
              activeOpacity={0.8}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderIcon}>📷</Text>
                  <Text style={styles.avatarPlaceholderText}>＋</Text>
                </View>
              )}
              <View style={styles.avatarCameraBadge}>
                <Text style={{ fontSize: 10 }}>✏️</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>{t('create_group_hint')}</Text>
          </View>

          {/* Group Name Input */}
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>{t('group_name_label')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('group_name_placeholder')}
              placeholderTextColor="#8A8A9E"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
            />
          </View>

          {/* Search Friends */}
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t('search_friends_add')}
              placeholderTextColor="#8A8A9E"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Selected Counter */}
          <View style={styles.selectedCountBar}>
            <Text style={styles.selectedCountText}>
              {t('selected_friends')}: <Text style={styles.selectedCountHighlight}>{selectedFriendIds.length}</Text> {t('friends')}
            </Text>
          </View>

          {/* Friends List */}
          {loadingFriends ? (
            <ActivityIndicator size="small" color={C.primary} style={{ marginVertical: 20 }} />
          ) : (
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.id.toString()}
              style={styles.friendsList}
              contentContainerStyle={{ paddingBottom: 12 }}
              ListEmptyComponent={
                <View style={styles.emptyFriendsBox}>
                  <Text style={styles.emptyFriendsText}>
                    {searchQuery ? t('no_results_for_query') : t('no_friends_to_add')}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedFriendIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.friendItem, isSelected && styles.friendItemSelected]}
                    onPress={() => toggleSelectFriend(item.id)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={
                        item.avatar_url
                            ? { uri: item.avatar_url }
                          : require('../assets/splash-icon.png')
                      }
                      style={styles.friendAvatar}
                      {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
                    />
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{item.full_name || item.username}</Text>
                      <Text style={styles.friendUsername}>@{item.username}</Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Error notice */}
          {Boolean(errorText) && <Text style={styles.errorBanner}>{errorText}</Text>}

          {/* Actions */}
          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={creating}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, (!groupName.trim() || creating) && styles.submitBtnDisabled]}
              onPress={handleCreateGroup}
              disabled={!groupName.trim() || creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>{t('create_group_action')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Modal chọn nguồn ảnh avatar nhóm */}
      <Modal visible={avatarActionVisible} transparent animationType="fade" onRequestClose={() => setAvatarActionVisible(false)}>
        <TouchableOpacity style={styles.actionSheetOverlay} activeOpacity={1} onPress={() => setAvatarActionVisible(false)}>
          <View style={styles.actionSheetCard}>
            <Text style={styles.actionSheetTitle}>{t('change_group_avatar')}</Text>
            <TouchableOpacity
              style={styles.actionSheetBtn}
              onPress={() => {
                setAvatarActionVisible(false);
                handlePickAvatar('camera');
              }}
            >
              <Text style={styles.actionSheetBtnIcon}>📷</Text>
              <Text style={styles.actionSheetBtnText}>{t('take_new_photo')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetBtn}
              onPress={() => {
                setAvatarActionVisible(false);
                handlePickAvatar('library');
              }}
            >
              <Text style={styles.actionSheetBtnIcon}>🖼️</Text>
              <Text style={styles.actionSheetBtnText}>{t('choose_from_library')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionSheetBtn, { borderTopWidth: 1, borderColor: '#2E2E42', marginTop: 4, justifyContent: 'center' }]}
              onPress={() => setAvatarActionVisible(false)}
            >
              <Text style={{ color: '#8A8A9E', fontSize: 14, fontWeight: '600' }}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

const createStyles = (C: ColorScheme, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: C.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  closeBtnText: {
    color: C.textMuted,
    fontSize: 20,
    paddingHorizontal: 8,
  },
  inputBox: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    padding: 0,
  },
  selectedCountBar: {
    marginBottom: 8,
  },
  selectedCountText: {
    fontSize: 12,
    color: C.textMuted,
  },
  selectedCountHighlight: {
    color: C.primary,
    fontWeight: '700',
  },
  friendsList: {
    maxHeight: 260,
  },
  emptyFriendsBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyFriendsText: {
    color: C.textMuted,
    fontSize: 13,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  friendItemSelected: {
    backgroundColor: `${C.primary}20`,
    borderWidth: 1,
    borderColor: C.primary,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.separator,
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },
  friendUsername: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  errorBanner: {
    color: C.error,
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  avatarPickerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPickerBtn: {
    position: 'relative',
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.surface,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderIcon: {
    fontSize: 22,
  },
  avatarPlaceholderText: {
    fontSize: 10,
    color: C.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  avatarCameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: C.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.card,
  },
  avatarHint: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 6,
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  actionSheetCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  actionSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    gap: 12,
  },
  actionSheetBtnIcon: {
    fontSize: 20,
  },
  actionSheetBtnText: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
