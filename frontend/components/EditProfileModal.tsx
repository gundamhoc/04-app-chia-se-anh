import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ColorScheme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { useToast } from '../hooks/useToast';
import { useI18n } from '../utils/i18n';
import { BASE_URL } from '../services/api';
import { WebCameraModal } from './WebCameraModal';
import { User } from '../types';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (updatedUser: User) => void;
}

const getAvatarUrl = (avatarUrl?: string | null): string | null => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  const base = BASE_URL.replace(/\/api\/?$/, '');
  return `${base}${avatarUrl}`;
};

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { user, updateUser } = useAuthStore();
  const { colors: C, isDark } = useTheme();
  const { t } = useI18n();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleNameFocus = () => {
    // Cuộn nhẹ để đưa ô Tên hiển thị vào tầm nhìn tối ưu trên bàn phím
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 120, animated: true });
    }, 120);
  };

  const handleBioFocus = () => {
    // Cuộn xuống cuối để toàn bộ ô Bio và bộ đếm ký tự nổi lên trên bàn phím
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [newAvatarUri, setNewAvatarUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showWebCamera, setShowWebCamera] = useState(false);

  // Khởi tạo lại giá trị khi modal mở
  useEffect(() => {
    if (visible && user) {
      setFullName(user.full_name || '');
      setBio(user.bio || '');
      setNewAvatarUri(null);
    }
  }, [visible, user]);

  // Chọn ảnh từ thư viện
  const pickFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast('warning', 'Quyền truy cập thư viện ảnh bị từ chối.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.warn('Pick avatar error:', error);
      showToast('error', 'Không thể chọn ảnh từ thiết bị.');
    }
  };

  // Mở camera chụp ảnh
  const takeWithCamera = async () => {
    if (Platform.OS === 'web') {
      setShowWebCamera(true);
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast('warning', 'Quyền truy cập máy ảnh bị từ chối.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.warn('Camera avatar error:', error);
      showToast('error', 'Không thể khởi động máy ảnh.');
    }
  };

  // Lưu thông tin
  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      let finalAvatarUrl = user?.avatar_url || null;

      // 1. Cập nhật Avatar nếu người dùng có chọn ảnh mới
      if (newAvatarUri) {
        const avatarRes = await authService.updateAvatar(newAvatarUri);
        if (avatarRes?.avatar_url) {
          finalAvatarUrl = avatarRes.avatar_url;
        }
      }

      // 2. Cập nhật Full Name & Bio
      const profileRes = await authService.updateProfile(fullName.trim(), bio.trim());
      const updatedUser: User = {
        ...(profileRes?.user || user),
        avatar_url: finalAvatarUrl,
      };

      // Cập nhật Zustand auth store
      updateUser(updatedUser);

      showToast('success', 'Cập nhật hồ sơ thành công! ✨');
      if (onSuccess) {
        onSuccess(updatedUser);
      }
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Cập nhật hồ sơ thất bại.';
      showToast('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalBox, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t('edit_profile') || 'Chỉnh sửa hồ sơ'}</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={submitting}
              >
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Avatar Section */}
              <View style={styles.avatarSection}>
                <View style={styles.avatarWrapper}>
                  {newAvatarUri ? (
                    <Image source={{ uri: newAvatarUri }} style={styles.avatarImg} />
                  ) : (() => {
                    const avatarUri = getAvatarUrl(user?.avatar_url);
                    return avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitial}>
                          {(fullName || user?.username || 'U')[0]?.toUpperCase()}
                        </Text>
                      </View>
                    );
                  })()}

                  <TouchableOpacity
                    style={styles.cameraIconBadge}
                    onPress={pickFromLibrary}
                    activeOpacity={0.8}
                    disabled={submitting}
                  >
                    <Text style={styles.cameraBadgeText}>📷</Text>
                  </TouchableOpacity>
                </View>

                {/* Avatar Action Pills */}
                <View style={styles.avatarActionsRow}>
                  <TouchableOpacity
                    style={styles.avatarActionPill}
                    onPress={takeWithCamera}
                    disabled={submitting}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.avatarActionPillIcon}>📷</Text>
                    <Text style={styles.avatarActionPillText}>Chụp ảnh</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.avatarActionPill}
                    onPress={pickFromLibrary}
                    disabled={submitting}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.avatarActionPillIcon}>🖼️</Text>
                    <Text style={styles.avatarActionPillText}>Thư viện</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Form Fields */}
              <View style={styles.formCard}>
                {/* Full Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tên hiển thị</Text>
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Nhập tên hiển thị của bạn..."
                    placeholderTextColor={C.textMuted}
                    maxLength={100}
                    editable={!submitting}
                    onFocus={handleNameFocus}
                  />
                </View>

                {/* Username (Read-only) */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelWithBadge}>
                    <Text style={styles.fieldLabel}>Tên người dùng (@username)</Text>
                    <Text style={styles.badgeReadonly}>Cố định</Text>
                  </View>
                  <View style={[styles.input, styles.inputDisabled]}>
                    <Text style={styles.disabledInputText}>@{user?.username}</Text>
                  </View>
                  <Text style={styles.fieldHelper}>
                    Có thể đổi username trong Cài đặt &gt; Tài khoản.
                  </Text>
                </View>

                {/* Bio */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelWithBadge}>
                    <Text style={styles.fieldLabel}>Tiểu sử (Bio)</Text>
                    <Text style={styles.charCounter}>{bio.length}/150</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.bioInput]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Mô tả ngắn về bạn, châm ngôn hoặc sở thích..."
                    placeholderTextColor={C.textMuted}
                    multiline
                    numberOfLines={3}
                    maxLength={150}
                    editable={!submitting}
                    onFocus={handleBioFocus}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, submitting && styles.btnDisabled]}
                onPress={handleSave}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        {/* Web Camera Modal */}
        {Platform.OS === 'web' && (
          <WebCameraModal
            visible={showWebCamera}
            onClose={() => setShowWebCamera(false)}
            onCapture={(capturedUri) => {
              setNewAvatarUri(capturedUri);
              setShowWebCamera(false);
            }}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (C: ColorScheme, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    modalBox: {
      backgroundColor: C.background,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      maxHeight: '90%',
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: isDark ? 0.35 : 0.1,
      shadowRadius: 16,
      elevation: 10,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: 'Inter_700Bold',
      color: C.text,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    closeIcon: {
      fontSize: 14,
      color: C.textSecondary,
      fontWeight: 'bold',
    },
    scrollView: {
      flexShrink: 1,
      maxHeight: 520,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 32,
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    avatarWrapper: {
      position: 'relative',
      marginBottom: 14,
    },
    avatarImg: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 3,
      borderColor: C.primary,
    },
    avatarPlaceholder: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    avatarInitial: {
      fontSize: 36,
      fontFamily: 'Inter_700Bold',
      color: '#fff',
    },
    cameraIconBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: C.background,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    cameraBadgeText: {
      fontSize: 15,
    },
    avatarActionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    avatarActionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
    },
    avatarActionPillIcon: {
      fontSize: 14,
    },
    avatarActionPillText: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
    },
    formCard: {
      backgroundColor: C.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      gap: 16,
    },
    fieldGroup: {
      gap: 6,
    },
    labelWithBadge: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    fieldLabel: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
    },
    badgeReadonly: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: C.textMuted,
      backgroundColor: C.surface,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    charCounter: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textMuted,
    },
    input: {
      backgroundColor: C.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      color: C.text,
      borderWidth: 1,
      borderColor: C.border,
    },
    inputDisabled: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
      justifyContent: 'center',
    },
    disabledInputText: {
      fontSize: 15,
      fontFamily: 'Inter_500Medium',
      color: C.textMuted,
    },
    fieldHelper: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textMuted,
      marginTop: 2,
    },
    bioInput: {
      minHeight: 74,
      textAlignVertical: 'top',
      paddingTop: 10,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingTop: 14,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    cancelBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      backgroundColor: C.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    cancelBtnText: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
    },
    saveBtn: {
      flex: 1.6,
      height: 48,
      borderRadius: 14,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    saveBtnText: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: '#FFFFFF',
    },
  });
