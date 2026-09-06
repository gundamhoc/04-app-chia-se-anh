import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Photo } from '../types';
import { photoService } from '../services/photoService';
import { useToast } from '../hooks/useToast';

const C = Colors.dark;

interface EditPostModalProps {
  visible: boolean;
  photo: Photo | null;
  onClose: () => void;
  onSuccess: (updatedPhoto: { id: number; caption: string }) => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  visible,
  photo,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (photo) {
      setCaption(photo.caption || '');
    }
  }, [photo]);

  if (!photo) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await photoService.updatePhoto(photo.id, caption);
      showToast('success', 'Đã cập nhật bài đăng thành công! ✨');
      onSuccess(updated);
      onClose();
    } catch (err) {
      console.warn('Lỗi cập nhật bài đăng:', err);
      const errMsg = err instanceof Error ? err.message : 'Không thể cập nhật bài đăng.';
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} disabled={loading} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Hủy</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Chỉnh sửa bài đăng</Text>

            <TouchableOpacity
              onPress={handleSave}
              disabled={loading}
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Lưu</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Ảnh thu nhỏ và tác giả */}
            <View style={styles.previewRow}>
              <Image source={{ uri: photo.image_url }} style={styles.previewImage} />
              <View style={styles.previewInfo}>
                <Text style={styles.previewAuthor}>{photo.author_name}</Text>
                <Text style={styles.previewHint}>Chỉnh sửa chú thích bài đăng khoảnh khắc</Text>
              </View>
            </View>

            {/* Ô nhập Caption */}
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="Viết chú thích mới cho khoảnh khắc..."
                placeholderTextColor={C.textMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={300}
                autoFocus
              />
              <Text style={styles.charCount}>{caption.length}/300</Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: '#181828',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  body: {
    padding: 16,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
    borderRadius: 16,
  },
  previewImage: {
    width: 54,
    height: 54,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: C.card,
  },
  previewInfo: {
    flex: 1,
  },
  previewAuthor: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  previewHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  inputBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    minHeight: 120,
  },
  textInput: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    marginTop: 6,
  },
});
