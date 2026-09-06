import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Photo } from '../types';

const C = Colors.dark;

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
  if (!photo) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheetCard}>
          {/* Header Drag Bar & Title */}
          <View style={styles.header}>
            <View style={styles.dragBar} />
            <Text style={styles.headerTitle}>Tùy chọn bài viết</Text>
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
                <Text style={styles.optionTitle}>Chỉnh sửa bài đăng</Text>
                <Text style={styles.optionSubtitle}>Thay đổi chú thích, mô tả khoảnh khắc</Text>
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
                <Text style={[styles.optionTitle, { color: C.error }]}>Xóa bài đăng</Text>
                <Text style={styles.optionSubtitle}>Gỡ bức ảnh khoảnh khắc này khỏi bảng tin</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Nút Đóng */}
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
