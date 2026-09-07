import React, { useState, useEffect, useMemo } from 'react';
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
import { ColorScheme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { Photo, PhotoPrivacy } from '../types';
import { photoService } from '../services/photoService';
import { useToast } from '../hooks/useToast';
import { useI18n } from '../utils/i18n';

interface EditPostModalProps {
  visible: boolean;
  photo: Photo | null;
  onClose: () => void;
  onSuccess: (updatedPhoto: { id: number; caption: string; privacy?: PhotoPrivacy }) => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  visible,
  photo,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { colors: C, isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<PhotoPrivacy>('friends');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (photo) {
      setCaption(photo.caption || '');
      setPrivacy(photo.privacy || 'friends');
    }
  }, [photo]);

  if (!photo) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await photoService.updatePhoto(photo.id, caption, privacy);
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
              <Text style={styles.closeBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>

            <Text style={styles.title}>{t('edit_post')}</Text>

            <TouchableOpacity
              onPress={handleSave}
              disabled={loading}
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>{t('save')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Ảnh thu nhỏ và tác giả */}
            <View style={styles.previewRow}>
              <Image source={{ uri: photo.image_url }} style={styles.previewImage} />
              <View style={styles.previewInfo}>
                <Text style={styles.previewAuthor}>{photo.author_name}</Text>
                <Text style={styles.previewHint}>{t('edit_post_desc')}</Text>
              </View>
            </View>

            {/* Ô nhập Caption */}
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder={t('write_caption')}
                placeholderTextColor={C.textMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={300}
                autoFocus
              />
              <Text style={styles.charCount}>{caption.length}/300</Text>
            </View>

            {/* Bộ chọn quyền riêng tư bài viết */}
            <View style={styles.privacySection}>
              <Text style={styles.sectionLabel}>{t('post_privacy')}</Text>
              <View style={styles.privacyRow}>
                <TouchableOpacity
                  style={[
                    styles.privacyOption,
                    privacy === 'public' && styles.privacyOptionActive,
                  ]}
                  onPress={() => setPrivacy('public')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.privacyIcon}>🌐</Text>
                  <Text
                    style={[
                      styles.privacyText,
                      privacy === 'public' && styles.privacyTextActive,
                    ]}
                  >
                    {t('public')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.privacyOption,
                    privacy === 'friends' && styles.privacyOptionActive,
                  ]}
                  onPress={() => setPrivacy('friends')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.privacyIcon}>👥</Text>
                  <Text
                    style={[
                      styles.privacyText,
                      privacy === 'friends' && styles.privacyTextActive,
                    ]}
                  >
                    {t('friends_only')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.privacyOption,
                    privacy === 'private' && styles.privacyOptionActive,
                  ]}
                  onPress={() => setPrivacy('private')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.privacyIcon}>🔒</Text>
                  <Text
                    style={[
                      styles.privacyText,
                      privacy === 'private' && styles.privacyTextActive,
                    ]}
                  >
                    {t('private')}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.privacyDesc}>
                {privacy === 'public'
                  ? `🌐 ${t('public_desc')}`
                  : privacy === 'friends'
                  ? `👥 ${t('friends_desc')}`
                  : `🔒 ${t('private_desc')}`}
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  modalCard: {
    backgroundColor: C.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
    borderColor: C.border,
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
    color: C.text,
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
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    borderRadius: 16,
  },
  previewImage: {
    width: 54,
    height: 54,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: C.separator,
  },
  previewInfo: {
    flex: 1,
  },
  previewAuthor: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 3,
  },
  previewHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  inputBox: {
    backgroundColor: C.inputBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    minHeight: 120,
  },
  textInput: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: C.text,
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
  privacySection: {
    marginTop: 18,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 8,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  privacyOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    gap: 6,
  },
  privacyOptionActive: {
    backgroundColor: `${C.primary}25`,
    borderColor: C.primary,
  },
  privacyIcon: {
    fontSize: 15,
  },
  privacyText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: C.textMuted,
  },
  privacyTextActive: {
    color: C.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  privacyDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    marginTop: 4,
    lineHeight: 17,
  },
});
