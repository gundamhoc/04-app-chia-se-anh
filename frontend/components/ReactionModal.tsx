import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ColorScheme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { Photo, ReactionUserInfo } from '../types';
import { useToast } from '../hooks/useToast';
import { useI18n } from '../utils/i18n';
import { photoService } from '../services/photoService';

interface ReactionModalProps {
  visible: boolean;
  photoId: number | null;
  initialEmoji?: string;
  onClose: () => void;
}

export const ReactionModal: React.FC<ReactionModalProps> = ({
  visible,
  photoId,
  initialEmoji,
  onClose,
}) => {
  const { showToast } = useToast();
  const { colors: C, isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  const [reactions, setReactions] = useState<Record<string, ReactionUserInfo[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [expandedEmojis, setExpandedEmojis] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible && photoId) {
      loadReactions();
    } else {
      setReactions({});
      setSelectedEmoji(null);
      setExpandedEmojis(new Set());
    }
  }, [visible, photoId]);

  useEffect(() => {
    if (initialEmoji && reactions[initialEmoji]) {
      setSelectedEmoji(initialEmoji);
      setExpandedEmojis((prev) => new Set(prev).add(initialEmoji));
    }
  }, [initialEmoji, reactions]);

  const loadReactions = async () => {
    if (!photoId) return;
    setLoading(true);
    try {
      const data = await photoService.getPhotoReactions(photoId);
      setReactions(data);
      // Mặc định mở rộng emoji đầu tiên hoặc initialEmoji
      if (initialEmoji && data[initialEmoji]) {
        setExpandedEmojis(new Set([initialEmoji]));
      } else {
        const firstEmoji = Object.keys(data)[0];
        if (firstEmoji) {
          setExpandedEmojis(new Set([firstEmoji]));
        }
      }
    } catch (error) {
      console.warn('Load reactions error:', error);
      showToast('error', 'Không thể tải danh sách cảm xúc.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandEmoji = (emoji: string) => {
    setExpandedEmojis((prev) => {
      const next = new Set(prev);
      if (next.has(emoji)) {
        next.delete(emoji);
      } else {
        next.add(emoji);
      }
      return next;
    });
  };

  const emojiList = Object.keys(reactions).sort((a, b) => {
    // Sắp xếp theo số lượng giảm dần
    return reactions[b].length - reactions[a].length;
  });

  const totalReactions = Object.values(reactions).reduce((sum, arr) => sum + arr.length, 0);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheetCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.dragBar} />
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>{t('reactions_title')}</Text>
              <Text style={styles.headerSubtitle}>
                {totalReactions} {t('people_reacted')}
              </Text>
            </View>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.loadingText}>{t('loading')}</Text>
            </View>
          ) : totalReactions === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>😐</Text>
              <Text style={styles.emptyText}>{t('no_reactions_yet')}</Text>
            </View>
          ) : (
            <FlatList
              data={emojiList}
              keyExtractor={(item) => item}
              renderItem={({ item: emoji }) => {
                const users = reactions[emoji];
                const isExpanded = expandedEmojis.has(emoji);
                return (
                  <View style={styles.emojiSection}>
                    {/* Emoji Header */}
                    <TouchableOpacity
                      style={styles.emojiHeader}
                      onPress={() => toggleExpandEmoji(emoji)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.emojiInfo}>
                        <Text style={styles.emojiIcon}>{emoji}</Text>
                        <View style={styles.emojiStats}>
                          <Text style={styles.emojiCount}>
                            {users.length} {users.length === 1 ? t('person') : t('people')}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.emojiRight}>
                        {selectedEmoji === emoji ? (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.selectedBadgeText}>✓ {t('selected')}</Text>
                          </View>
                        ) : null}
                        <Text style={[
                          styles.expandIcon,
                          isExpanded && styles.expandIconRotated,
                        ]}>
                          ▼
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* User List */}
                    {isExpanded && (
                      <View style={styles.userList}>
                        {users.map((user) => (
                          <TouchableOpacity
                            key={user.user_id}
                            style={styles.userItem}
                            onPress={() => {
                              // TODO: Navigate to user profile
                              onClose();
                            }}
                            activeOpacity={0.7}
                          >
                            <Image
                              source={
                                user.avatar_url
                                  ? { uri: user.avatar_url }
                                  : require('../assets/splash-icon.png')
                              }
                              style={styles.userAvatar}
                            />
                            <View style={styles.userInfo}>
                              <Text style={styles.userName} numberOfLines={1}>
                                {user.full_name || user.username}
                              </Text>
                              <Text style={styles.userUsername} numberOfLines={1}>
                                @{user.username}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (C: ColorScheme, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheetCard: {
    backgroundColor: C.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
    borderWidth: 1,
    borderColor: C.border,
    maxHeight: '85%',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 8,
  },
  dragBar: {
    width: 36,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    marginBottom: 10,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: C.textMuted,
  },
  listContent: {
    paddingBottom: 20,
    gap: 8,
  },
  separator: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: -20,
  },
  emojiSection: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  emojiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  emojiInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emojiIcon: {
    fontSize: 28,
  },
  emojiStats: {
    gap: 2,
  },
  emojiCount: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  emojiRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedBadge: {
    backgroundColor: `${C.primary}20`,
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: C.primary,
  },
  expandIcon: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: C.textMuted,
    transform: [{ rotate: '0deg' }],
  },
  expandIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  userList: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.separator,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  userUsername: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
});