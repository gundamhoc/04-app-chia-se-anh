import React, { useState } from 'react';
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
import { Colors } from '../constants/Colors';
import { Photo } from '../types';
import { useToast } from '../hooks/useToast';
import { savePhotoToDevice } from '../utils/mediaSaver';

const C = Colors.dark;

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheetCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.dragBar} />
            <Text style={styles.headerTitle}>Chia sẻ khoảnh khắc 📤</Text>
          </View>

          {/* Options List */}
          <View style={styles.optionsList}>
            {/* Tùy chọn 1: Lưu ảnh */}
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
                <Text style={styles.optionTitle}>Lưu ảnh về máy</Text>
                <Text style={styles.optionSubtitle}>Tải và lưu ảnh vào bộ sưu tập thiết bị</Text>
              </View>
            </TouchableOpacity>

            {/* Tùy chọn 2: Sao chép đường link */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleCopyLink}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(108, 99, 255, 0.15)' }]}>
                <Text style={styles.optionIcon}>🔗</Text>
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>Sao chép đường link</Text>
                <Text style={styles.optionSubtitle}>Lấy liên kết bài viết để gửi bạn bè</Text>
              </View>
            </TouchableOpacity>

            {/* Tùy chọn 3: Chia sẻ qua ứng dụng khác */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleShareToApps}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(255, 101, 132, 0.15)' }]}>
                <Text style={styles.optionIcon}>📱</Text>
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>Chia sẻ qua ứng dụng khác</Text>
                <Text style={styles.optionSubtitle}>Gửi qua Zalo, Messenger, Telegram, Facebook...</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheetCard: {
    backgroundColor: '#181828',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  cancelBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
});
