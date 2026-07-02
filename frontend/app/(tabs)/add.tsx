import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../constants/config';

import { useSettings } from '../../context/SettingsContext';

const { width } = Dimensions.get('window');
const PREVIEW_WIDTH = width - 56;

export default function AddScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors, theme, t } = useSettings();

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasGalleryPermission, setHasGalleryPermission] = useState<boolean | null>(null);
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(cameraStatus.status === 'granted');

      const galleryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasGalleryPermission(galleryStatus.status === 'granted');
    })();
  }, []);

  // Launch Expo Camera picker
  const takePhoto = async () => {
    if (!hasCameraPermission) {
      const status = await Camera.requestCameraPermissionsAsync();
      if (status.status !== 'granted') {
        Alert.alert(t('permissionRequired'), t('cameraPermissionDesc'));
        return;
      }
      setHasCameraPermission(true);
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera capture error:', error);
      Alert.alert('Error', 'Failed to launch camera.');
    }
  };

  // Select photo from library
  const selectFromGallery = async () => {
    if (!hasGalleryPermission) {
      const status = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status.status !== 'granted') {
        Alert.alert(t('permissionRequired'), t('galleryPermissionDesc'));
        return;
      }
      setHasGalleryPermission(true);
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Gallery pick error:', error);
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  // Compress & Upload Photo
  const handleUpload = async () => {
    if (!selectedImage || !token) return;

    setUploading(true);
    try {
      // 1. Resize and Compress Image to reduce server loading
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        selectedImage,
        [{ resize: { width: 1080 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // 2. Prepare FormData
      const formData = new FormData();
      
      const fileUri = manipulatedImage.uri;
      const fileName = fileUri.split('/').pop() || 'photo.jpg';
      
      if (Platform.OS === 'web') {
        // Fetch the local blob URL in browser and convert to real binary blob
        const response = await fetch(fileUri);
        const blob = await response.blob();
        formData.append('photo', blob, fileName);
      } else {
        // Construct native file attachment for Android/iOS
        formData.append('photo', {
          uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
          type: 'image/jpeg',
          name: fileName,
        } as any);
      }

      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      // 3. POST request
      const response = await fetch(`${API_URL}/photos/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          // Do NOT set Content-Type header. Fetch does it automatically with boundary for FormData.
        },
        body: formData,
      });

      const json = await response.json();

      if (json.success) {
        Alert.alert('Success', 'Photo shared successfully!');
        // Reset state & redirect to feed
        setSelectedImage(null);
        setCaption('');
        router.replace('/(tabs)');
      } else {
        Alert.alert('Upload Failed', json.message || 'Something went wrong.');
      }

    } catch (error) {
      console.error('Upload request failed:', error);
      Alert.alert('Upload Error', 'Could not send photo to the server.');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedImage(null);
    setCaption('');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          {selectedImage ? (
            // Preview & Upload Screen
            <View style={styles.previewContainer}>
              <View style={styles.previewHeader}>
                <TouchableOpacity style={styles.backBtn} onPress={handleCancel}>
                  <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.previewTitle, { color: colors.text }]}>{t('shareMoment')}</Text>
                <View style={{ width: 24 }} />
              </View>

              <View style={[styles.imagePreviewWrapper, { borderColor: colors.border, backgroundColor: colors.input }]}>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
              </View>

              <View style={styles.formSection}>
                <TextInput
                  style={[styles.captionInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  placeholder={t('writeCaption')}
                  placeholderTextColor={colors.textSecondary}
                  value={caption}
                  onChangeText={setCaption}
                  maxLength={100}
                  multiline
                />

                <TouchableOpacity
                  style={[styles.uploadBtn, { backgroundColor: colors.accent }, uploading && styles.disabledBtn]}
                  onPress={handleUpload}
                  disabled={uploading}
                  activeOpacity={0.8}
                >
                  {uploading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.uploadBtnText}>{t('uploadMoment')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Selection Screen (Mockup Image 3 Align)
            <View style={styles.selectorContainer}>
              <Text style={[styles.logoTitle, { color: colors.text }]}>Locket</Text>
              
              <View style={styles.buttonsContainer}>
                {/* Take Photo Circle */}
                <View style={styles.circleButtonWrapper}>
                  <TouchableOpacity
                    style={[styles.circleButton, styles.cameraButton, { backgroundColor: colors.accent }]}
                    onPress={takePhoto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={36} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={[styles.buttonLabel, { color: colors.textSecondary }]}>{t('takeNewPhoto')}</Text>
                </View>

                {/* Select Gallery Circle */}
                <View style={styles.circleButtonWrapper}>
                  <TouchableOpacity
                    style={[styles.circleButton, styles.galleryButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={selectFromGallery}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images" size={34} color={colors.accent} />
                  </TouchableOpacity>
                  <Text style={[styles.buttonLabel, { color: colors.textSecondary }]}>{t('selectGallery')}</Text>
                </View>
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  selectorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 40,
  },
  logoTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -1.5,
    marginBottom: 60,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 10,
  },
  circleButtonWrapper: {
    alignItems: 'center',
  },
  circleButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cameraButton: {
    backgroundColor: '#0066FF',
    shadowColor: '#0066FF',
    shadowOpacity: 0.15,
  },
  galleryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555555',
  },
  previewContainer: {
    width: '100%',
    paddingVertical: 20,
    alignItems: 'center',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  backBtn: {
    padding: 6,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
  },
  imagePreviewWrapper: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_WIDTH,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  formSection: {
    width: '100%',
    marginTop: 24,
  },
  captionInput: {
    backgroundColor: '#F2F2F7',
    color: '#000000',
    borderRadius: 16,
    height: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    textAlignVertical: 'top',
  },
  uploadBtn: {
    backgroundColor: '#0066FF',
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
