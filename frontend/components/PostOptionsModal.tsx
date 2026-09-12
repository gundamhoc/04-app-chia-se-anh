import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ColorScheme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { Photo } from '../types';
import { useI18n } from '../utils/i18n';
import { useToast } from '../hooks/useToast';
import { photoService } from '../services/photoService';

interface PostOptionsModalProps {
  visible: boolean;
  photo: Photo | null;
  onClose: () => void;
  onEdit: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
  onUpdatePhoto?: (updatedPhoto: Photo) => void;
}

export const PostOptionsModal: React.FC<PostOptionsModalProps> = ({
  visible,
  photo,
  onClose,
  onEdit,
  onDelete,
  onUpdatePhoto,
}) => {
  const { colors: C, isDark } = useTheme();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!photo) return null;

  const isOwner = user?.id === photo.user_id;

  // 1. Lưu bài viết
  const handleSave = async () => {
    if (loadingAction) return;
    setLoadingAction('save');
    try {
      const res = await photoService.toggleSavePhoto(photo.id, 'save');
      showToast('success', 'Đã lưu bài viết vào mục Đã lưu! 🔖');
      onUpdatePhoto?.({ ...photo, is_saved: res.is_saved });
      onClose();
    } catch (err) {
      console.warn('Lỗi lưu bài viết:', err);
      const msg = err instanceof Error ? err.message : 'Không thể lưu bài viết.';
      showToast('error', msg);
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. Bỏ bài viết (Bỏ lưu)
  const handleUnsave = async () => {
    if (loadingAction) return;
    setLoadingAction('unsave');
    try {
      const res = await photoService.toggleSavePhoto(photo.id, 'unsave');
      showToast('info', 'Đã bỏ lưu bài viết khỏi mục Đã lưu.');
      onUpdatePhoto?.({ ...photo, is_saved: res.is_saved });
      onClose();
    } catch (err) {
      console.warn('Lỗi bỏ lưu bài viết:', err);
      const msg = err instanceof Error ? err.message : 'Không thể bỏ lưu bài viết.';
      showToast('error', msg);
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. Đăng lại (Toggle Repost)
  const handleToggleRepost = async () => {
    if (loadingAction) return;
    setLoadingAction('repost');
    try {
      const res = await photoService.toggleRepost(photo.id);
      showToast(
        'success',
        res.is_reposted
          ? 'Đã đăng lại bài viết lên trang cá nhân! 🔁'
          : 'Đã hủy đăng lại bài viết.'
      );
      onUpdatePhoto?.({ ...photo, is_reposted: res.is_reposted });
      onClose();
    } catch (err) {
      console.warn('Lỗi đăng lại bài viết:', err);
      const msg = err instanceof Error ? err.message : 'Không thể đăng lại bài viết.';
      showToast('error', msg);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheetCard}>
          {/* Header Drag Bar & Title */}
          <View style={styles.header}>
            <View style={styles.dragBar} />
            <Text style={styles.headerTitle}>{t('post_options')}</Text>
          </View>

          {/* Options List */}
          <View style={styles.optionsList}>
            {/* 1. Lưu bài viết */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleSave}
              disabled={Boolean(loadingAction)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                {loadingAction === 'save' ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <Text style={styles.optionIcon}>🔖</Text>
                )}
              </View>
              <View style={styles.optionTextBox}>
                <View style={styles.titleWithBadge}>
                  <Text style={styles.optionTitle}>{t('save_post')}</Text>
                  {photo.is_saved && (
                    <View style={styles.badgeActive}>
                      <Text style={styles.badgeActiveText}>Đã lưu ✓</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.optionSubtitle}>{t('save_post_desc')}</Text>
              </View>
            </TouchableOpacity>

            {/* 2. Bỏ bài viết (Bỏ lưu bài viết) */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleUnsave}
              disabled={Boolean(loadingAction)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                {loadingAction === 'unsave' ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Text style={styles.optionIcon}>🏷️</Text>
                )}
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>{t('unsave_post')}</Text>
                <Text style={styles.optionSubtitle}>{t('unsave_post_desc')}</Text>
              </View>
            </TouchableOpacity>

            {/* 3. Đăng lại */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleToggleRepost}
              disabled={Boolean(loadingAction)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                {loadingAction === 'repost' ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : (
                  <Text style={styles.optionIcon}>🔁</Text>
                )}
              </View>
              <View style={styles.optionTextBox}>
                <View style={styles.titleWithBadge}>
                  <Text style={styles.optionTitle}>
                    {photo.is_reposted ? t('unrepost_post') : t('repost_post')}
                  </Text>
                  {photo.is_reposted && (
                    <View style={styles.badgeActive}>
                      <Text style={styles.badgeActiveText}>Đã đăng lại ✓</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.optionSubtitle}>
                  {photo.is_reposted ? t('unrepost_post_desc') : t('repost_post_desc')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Phân tách giữa các hành động tương tác và quản trị bài viết của chủ sở hữu */}
            {isOwner && <View style={styles.divider} />}

            {/* 4. Chỉnh sửa bài đăng (chỉ chủ bài viết) */}
            {isOwner && (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  onClose();
                  onEdit(photo);
                }}
                disabled={Boolean(loadingAction)}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIconBox, { backgroundColor: 'rgba(108, 99, 255, 0.15)' }]}>
                  <Text style={styles.optionIcon}>✏️</Text>
                </View>
                <View style={styles.optionTextBox}>
                  <Text style={styles.optionTitle}>{t('edit_post')}</Text>
                  <Text style={styles.optionSubtitle}>
                    {t('edit_post_desc') || 'Thay đổi chú thích và quyền riêng tư bài viết'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 5. Xóa bài đăng (chỉ chủ bài viết) */}
            {isOwner && (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  onClose();
                  onDelete(photo);
                }}
                disabled={Boolean(loadingAction)}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIconBox, { backgroundColor: 'rgba(255, 82, 82, 0.15)' }]}>
                  <Text style={styles.optionIcon}>🗑️</Text>
                </View>
                <View style={styles.optionTextBox}>
                  <Text style={[styles.optionTitle, { color: C.error }]}>{t('delete_post')}</Text>
                  <Text style={styles.optionSubtitle}>
                    {t('delete_post_desc') || 'Gỡ bỏ vĩnh viễn bài đăng này khỏi hệ thống'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Nút Đóng */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>{t('close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (C: ColorScheme, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'flex-end',
    },
    backdrop: {
      flex: 1,
    },
    sheetCard: {
      width: '100%',
      maxWidth: 580,
      alignSelf: 'center',
      backgroundColor: C.card,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 32 : 18,
      borderWidth: 1,
      borderColor: C.border,
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
    headerTitle: {
      fontSize: 16,
      fontFamily: 'Inter_700Bold',
      color: C.text,
    },
    optionsList: {
      paddingVertical: 4,
      gap: 2,
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 16,
    },
    optionIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    optionIcon: {
      fontSize: 22,
    },
    optionTextBox: {
      flex: 1,
    },
    titleWithBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    optionTitle: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
    },
    badgeActive: {
      backgroundColor: 'rgba(108, 99, 255, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(108, 99, 255, 0.3)',
    },
    badgeActiveText: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: C.primary,
    },
    optionSubtitle: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textMuted,
    },
    divider: {
      height: 1,
      backgroundColor: C.border,
      marginVertical: 6,
      marginHorizontal: 8,
    },
    cancelBtn: {
      marginTop: 8,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 18,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
    },
  });
