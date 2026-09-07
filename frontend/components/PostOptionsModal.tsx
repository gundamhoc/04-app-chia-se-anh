import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { ColorScheme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { Photo } from '../types';
import { useI18n } from '../utils/i18n';

interface PostOptionsModalProps {
  visible: boolean;
  photo: Photo | null;
  onClose: () => void;
  onEdit: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
}

export const PostOptionsModal: React.FC<PostOptionsModalProps> = ({
  visible,
  photo,
  onClose,
  onEdit,
  onDelete,
}) => {
  const { colors: C, isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  if (!photo) return null;

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
            {/* 1. Chỉnh sửa bài đăng */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                onClose();
                onEdit(photo);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(108, 99, 255, 0.15)' }]}>
                <Text style={styles.optionIcon}>✏️</Text>
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>{t('edit_post')}</Text>
                <Text style={styles.optionSubtitle}>{t('edit_post_desc')}</Text>
              </View>
            </TouchableOpacity>

            {/* 2. Xóa bài đăng */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                onClose();
                onDelete(photo);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(255, 82, 82, 0.15)' }]}>
                <Text style={styles.optionIcon}>🗑️</Text>
              </View>
              <View style={styles.optionTextBox}>
                <Text style={[styles.optionTitle, { color: C.error }]}>{t('delete_post')}</Text>
                <Text style={styles.optionSubtitle}>{t('delete_post_desc')}</Text>
              </View>
            </TouchableOpacity>
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
