import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { ColorScheme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { photoService } from '../services/photoService';
import { friendService } from '../services/friendService';
import { Friend, PhotoPrivacy } from '../types';
import { useToast } from '../hooks/useToast';
import { WebCameraModal } from '../components/WebCameraModal';
import { LoadingOverlay } from '../components/LoadingComponents';
import { useI18n } from '../utils/i18n';

export default function AddPhotoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { colors: C, isDark } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<PhotoPrivacy>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [showWebCamera, setShowWebCamera] = useState(false);

  // Load danh sách bạn bè (không tự động mở camera)
  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const data = await friendService.getFriendsList();
      setFriends(data);
    } catch (e) {
      console.warn('Fetch friends error:', e);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Mở thư viện ảnh
  const pickFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast('warning', 'Quyền truy cập thư viện ảnh bị từ chối.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.warn('Image picker error:', error);
    }
  };

  // Mở Camera chụp ảnh trực tiếp
  const takeWithCamera = async () => {
    if (Platform.OS === 'web') {
      // Trên Web: Mở Web Camera Modal với live stream và chụp ảnh
      setShowWebCamera(true);
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast('warning', 'Quyền truy cập Máy ảnh (Camera) bị từ chối.');
        return;
      }

      // allowsEditing: false BẮT BUỘC trên Android để mở trực tiếp Camera native của điện thoại,
      // tránh Android chuyển hướng sang bộ chọn tệp / crop
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        cameraType: ImagePicker.CameraType.back,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.warn('Camera error:', error);
      showToast('error', t('camera_error'));
    }
  };

  // Thực hiện đăng bài
  const handleUpload = async () => {
    if (!imageUri) {
      showToast('warning', t('select_photo_first'));
      return;
    }

    setSubmitting(true);
    try {
      await photoService.uploadPhoto(imageUri, caption, selectedRecipientId, privacy);
      showToast('success', t('post_success'));
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);
    } catch (error: unknown) {
      console.warn('Upload photo failed:', error);
      let errMsg = t('upload_photo_failed');
      if (error && typeof error === 'object') {
        const axErr = error as { response?: { data?: { message?: string } }; message?: string };
        if (axErr.response?.data?.message) {
          errMsg = axErr.response.data.message;
        } else if (axErr.message) {
          errMsg = axErr.message;
        }
      }
      showToast('error', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('new_moment')} 📸</Text>
        <TouchableOpacity
          style={[styles.btnPost, (!imageUri || submitting) && styles.btnPostDisabled]}
          onPress={handleUpload}
          disabled={!imageUri || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.btnPostText}>{t('share')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Preview & Choice Container */}
        <View style={styles.imagePreviewContainer}>
          {imageUri ? (
            <View style={styles.previewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.changePhotoBtn}
                onPress={() => setImageUri(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.changePhotoText}>🔄 {t('change_photo')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderIcon}>📸</Text>
              <Text style={styles.placeholderTitle}>{t('add_moment_title')}</Text>
              <Text style={styles.placeholderSub}>
                {t('add_moment_sub')}
              </Text>

              <View style={styles.choiceButtonsContainer}>
                <TouchableOpacity
                  style={styles.choiceBtn}
                  onPress={takeWithCamera}
                  activeOpacity={0.8}
                >
                  <View style={[styles.choiceIconBox, { backgroundColor: 'rgba(108, 99, 255, 0.2)' }]}>
                    <Text style={styles.choiceIcon}>📷</Text>
                  </View>
                  <View style={styles.choiceTextBox}>
                    <Text style={styles.choiceTitle}>{t('take_new_photo')}</Text>
                    <Text style={styles.choiceDesc}>{t('take_new_photo_desc')}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.choiceBtn}
                  onPress={pickFromLibrary}
                  activeOpacity={0.8}
                >
                  <View style={[styles.choiceIconBox, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
                    <Text style={styles.choiceIcon}>🖼️</Text>
                  </View>
                  <View style={styles.choiceTextBox}>
                    <Text style={styles.choiceTitle}>{t('choose_from_library')}</Text>
                    <Text style={styles.choiceDesc}>{t('choose_from_library_desc')}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {imageUri && (
          <View style={styles.photoPickerBar}>
            <TouchableOpacity style={styles.pickerBtn} onPress={takeWithCamera}>
              <Text style={styles.pickerIcon}>📷</Text>
              <Text style={styles.pickerText}>{t('retake_photo')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pickerBtn} onPress={pickFromLibrary}>
              <Text style={styles.pickerIcon}>🖼️</Text>
              <Text style={styles.pickerText}>{t('change_photo')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Caption Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('caption_label')}</Text>
          <TextInput
            style={styles.captionInput}
            placeholder={t('caption_placeholder')}
            placeholderTextColor={C.textMuted}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={200}
          />
        </View>

        {/* Quyền riêng tư bài viết */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('post_privacy')}</Text>
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

        {/* Audience / Recipient Selector */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('send_private_to_friends')}</Text>
          {loadingFriends ? (
            <ActivityIndicator size="small" color={C.primary} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipientList}>
              <TouchableOpacity
                style={[
                  styles.recipientChip,
                  selectedRecipientId === null && styles.recipientChipActive,
                ]}
                onPress={() => setSelectedRecipientId(null)}
              >
                <Text
                  style={[
                    styles.recipientText,
                    selectedRecipientId === null && styles.recipientTextActive,
                  ]}
                >
                  👥 {t('all_friends')}
                </Text>
              </TouchableOpacity>

              {friends.map((f) => {
                const isSelected = selectedRecipientId === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.recipientChip, isSelected && styles.recipientChipActive]}
                    onPress={() => setSelectedRecipientId(f.id)}
                  >
                    <Text
                      style={[styles.recipientText, isSelected && styles.recipientTextActive]}
                    >
                      👤 {f.full_name || f.username}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Web Camera Modal cho môi trường Web browser */}
      <WebCameraModal
        visible={showWebCamera}
        onClose={() => setShowWebCamera(false)}
        onCapture={(capturedUri) => {
          setImageUri(capturedUri);
          setShowWebCamera(false);
        }}
      />

      {/* Loading Overlay khi đang tải ảnh lên Google Drive */}
      <LoadingOverlay
        visible={submitting}
        message={language === 'vi' ? 'Đang tải khoảnh khắc lên... 📸' : 'Uploading moment... 📸'}
        subMessage={language === 'vi' ? 'Đang đồng bộ ảnh lên kho lưu trữ đám mây' : 'Syncing photo to cloud storage'}
      />
    </View>
  );
}

const createStyles = (C: ColorScheme, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  closeBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 20,
    color: C.text,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  btnPost: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 72,
    alignItems: 'center',
  },
  btnPostDisabled: {
    opacity: 0.5,
  },
  btnPostText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  content: {
    padding: 20,
  },
  imagePreviewContainer: {
    width: '100%',
    minHeight: 310,
    borderRadius: 24,
    backgroundColor: C.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
    justifyContent: 'center',
  },
  previewWrapper: {
    width: '100%',
    height: 320,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: isDark ? 'rgba(15, 15, 26, 0.88)' : 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
  },
  changePhotoText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  placeholderContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 38,
    marginBottom: 8,
  },
  placeholderTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    marginBottom: 4,
  },
  placeholderSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    marginBottom: 18,
  },
  choiceButtonsContainer: {
    width: '100%',
    gap: 12,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  choiceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  choiceIcon: {
    fontSize: 22,
  },
  choiceTextBox: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 2,
  },
  choiceDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  photoPickerBar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  pickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  pickerIcon: {
    fontSize: 18,
  },
  pickerText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: C.text,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 8,
  },
  captionInput: {
    backgroundColor: C.inputBg,
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  recipientList: {
    flexDirection: 'row',
  },
  recipientChip: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  recipientChipActive: {
    backgroundColor: `${C.primary}20`,
    borderColor: C.primary,
  },
  recipientText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: C.textMuted,
  },
  recipientTextActive: {
    color: C.primaryLight,
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
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 6,
  },
  privacyOptionActive: {
    backgroundColor: `${C.primary}20`,
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
