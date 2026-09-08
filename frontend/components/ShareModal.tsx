import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Share,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ColorScheme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { Photo } from '../types';
import { useToast } from '../hooks/useToast';
import { savePhotoToDevice } from '../utils/mediaSaver';
import { useI18n } from '../utils/i18n';

import { photoService } from '../services/photoService';

interface ShareModalProps {
  visible: boolean;
  photo: Photo | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  visible,
  photo,
  onClose,
}) => {
  const { showToast } = useToast();
  const { colors: C, isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);
  const [saving, setSaving] = useState(false);

  if (!photo) return null;

  // 1. Lưu ảnh về thiết bị
  const handleSavePhoto = async () => {
    setSaving(true);
    try {
      if (Platform.OS !== 'web') {
        showToast('info', 'Đang tải và lưu ảnh vào máy...');
      }

      const filename = `masita_${photo.id || Date.now()}.jpg`;
      const result = await savePhotoToDevice(photo.image_url, filename);

      if (result.success) {
        showToast('success', result.message);
        onClose();
      } else {
        showToast('error', result.message);
      }
    } catch (err) {
      console.warn('Lỗi lưu ảnh:', err);
      const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định';
      showToast('error', 'Lưu ảnh thất bại: ' + errMsg);
    } finally {
      setSaving(false);
    }
  };

  // 2. Sao chép đường link
  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(photo.image_url);
      showToast('success', 'Đã sao chép liên kết vào bộ nhớ tạm! 📋');
      onClose();
    } catch (err) {
      console.warn('Lỗi copy link:', err);
      showToast('error', 'Không thể sao chép liên kết.');
    }
  };

  // 3. Chia sẻ qua các ứng dụng khác
  const handleShareToApps = async () => {
    try {
      const message = `${photo.author_name} chia sẻ khoảnh khắc trên Masita: ${photo.caption || ''}\n${photo.image_url}`;

      await Share.share({
        title: 'Khoảnh khắc Masita 📸',
        message,
        url: photo.image_url,
      });

      onClose();
    } catch (err) {
      console.warn('Lỗi chia sẻ:', err);
    }
  };

  // 4. Lưu bài viết (Bookmark trên Masita)
  const handleToggleSave = async () => {
    try {
      const res = await photoService.toggleSavePhoto(photo.id);
      showToast(
        'success',
        res.is_saved ? 'Đã lưu bài viết vào mục "Lưu bài viết"! 🔖' : 'Đã bỏ lưu bài viết.'
      );
      onClose();
    } catch (err) {
      console.warn('Lỗi lưu bài viết:', err);
      showToast('error', 'Không thể lưu bài viết.');
    }
  };

  // 5. Đăng lại (Repost trên Masita)
  const handleToggleRepost = async () => {
    try {
      const res = await photoService.toggleRepost(photo.id);
      showToast(
        'success',
        res.is_reposted ? 'Đã đăng lại bài viết lên trang cá nhân! 🔁' : 'Đã hủy đăng lại.'
      );
      onClose();
    } catch (err) {
      console.warn('Lỗi đăng lại:', err);
      showToast('error', 'Không thể đăng lại bài viết.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheetCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.dragBar} />
            <Text style={styles.headerTitle}>{t('share_moment')}</Text>
          </View>

          {/* Options List */}
          <View style={styles.optionsList}>
            {/* Tùy chọn 1: Lưu bài viết trên Masita */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleToggleSave}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(255, 193, 7, 0.15)' }]}>
                <Text style={styles.optionIcon}>🔖</Text>
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>Lưu bài viết</Text>
                <Text style={styles.optionSubtitle}>Lưu vào mục "Lưu bài viết" trên trang cá nhân</Text>
              </View>
            </TouchableOpacity>

            {/* Tùy chọn 2: Đăng lại trên Masita */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleToggleRepost}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(33, 150, 243, 0.15)' }]}>
                <Text style={styles.optionIcon}>🔁</Text>
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>Đăng lại</Text>
                <Text style={styles.optionSubtitle}>Chia sẻ lại khoảnh khắc lên trang cá nhân của bạn</Text>
              </View>
            </TouchableOpacity>

            {/* Tùy chọn 3: Lưu ảnh về máy */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleSavePhoto}
              disabled={saving}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
                {saving ? (
                  <ActivityIndicator size="small" color="#4CAF50" />
                ) : (
                  <Text style={styles.optionIcon}>📥</Text>
                )}
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>{t('save_to_device')}</Text>
                <Text style={styles.optionSubtitle}>{t('save_to_device_desc')}</Text>
              </View>
            </TouchableOpacity>

            {/* Tùy chọn 4: Sao chép đường link */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleCopyLink}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(108, 99, 255, 0.15)' }]}>
                <Text style={styles.optionIcon}>🔗</Text>
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>{t('copy_link')}</Text>
                <Text style={styles.optionSubtitle}>{t('copy_link_desc')}</Text>
              </View>
            </TouchableOpacity>

            {/* Tùy chọn 5: Chia sẻ qua ứng dụng khác */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleShareToApps}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(255, 101, 132, 0.15)' }]}>
                <Text style={styles.optionIcon}>📱</Text>
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>{t('share_other_apps')}</Text>
                <Text style={styles.optionSubtitle}>{t('share_other_apps_desc')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>{t('close')}</Text>
          </TouchableOpacity>
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
    paddingVertical: 8,
    gap: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
  optionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  cancelBtn: {
    marginTop: 10,
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
