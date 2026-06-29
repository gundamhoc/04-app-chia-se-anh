import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { mockStore } from '../constants/mock-store';
import BottomNav from '../components/bottom-nav';

export default function CreateScreen() {
  const [caption, setCaption] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cameraFlash, setCameraFlash] = useState(false);

  // Gọi camera thật để chụp ảnh
  const handleCameraPress = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS === 'web') {
          alert('Chúng tôi cần quyền truy cập camera để chụp ảnh!');
        } else {
          Alert.alert('Quyền truy cập', 'Chúng tôi cần quyền truy cập camera để chụp ảnh!');
        }
        return;
      }

      setCameraFlash(true);
      setTimeout(async () => {
        setCameraFlash(false);
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          setSelectedImage(result.assets[0].uri);
        }
      }, 200);
    } catch (error) {
      console.error('Lỗi khi mở camera:', error);
      if (Platform.OS === 'web') {
        alert('Không thể mở camera trên trình duyệt web của bạn.');
      }
    }
  };

  // Mở thư viện ảnh của điện thoại thật
  const handleGalleryPress = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS === 'web') {
          alert('Chúng tôi cần quyền truy cập thư viện để chọn ảnh!');
        } else {
          Alert.alert('Quyền truy cập', 'Chúng tôi cần quyền truy cập thư viện để chọn ảnh!');
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Lỗi khi mở thư viện ảnh:', error);
    }
  };

  // Chia sẻ ảnh lên feed Locket
  const handleShare = () => {
    if (!selectedImage) {
      if (Platform.OS === 'web') {
        alert('Vui lòng chọn hoặc chụp ảnh trước!');
      } else {
        Alert.alert('Thông báo', 'Vui lòng chọn hoặc chụp ảnh trước!');
      }
      return;
    }

    mockStore.addPhoto(selectedImage, caption);
    
    // Reset trạng thái
    setSelectedImage(null);
    setCaption('');
    
    // Điều hướng quay lại màn hình chính
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Hiệu ứng chớp Flash camera */}
      {cameraFlash && <View style={styles.flashOverlay} />}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Locket</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Nội dung chính */}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {selectedImage ? (
          // Giao diện sau khi đã chọn/chụp được ảnh thật
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            
            {/* Hộp nhập Caption */}
            <TextInput
              style={styles.captionInput}
              placeholder="Viết một dòng mô tả..."
              placeholderTextColor="#9CA3AF"
              value={caption}
              onChangeText={setCaption}
              maxLength={120}
              multiline
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSelectedImage(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Chọn lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Text style={styles.shareBtnText}>Gửi ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Giao diện menu tròn chọn camera/thư viện giống hệt Demo
          <View style={styles.menuContainer}>
            <Text style={styles.title}>Locket</Text>

            <View style={styles.optionsRow}>
              {/* Nút Chụp ảnh thật */}
              <View style={styles.optionWrapper}>
                <TouchableOpacity
                  style={styles.circleButtonBlue}
                  onPress={handleCameraPress}
                  activeOpacity={0.85}
                >
                  <Feather name="camera" size={32} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.optionLabel}>Take New Photo</Text>
              </View>

              {/* Nút Chọn từ thư viện thật */}
              <View style={styles.optionWrapper}>
                <TouchableOpacity
                  style={styles.circleButtonWhite}
                  onPress={handleGalleryPress}
                  activeOpacity={0.85}
                >
                  <Feather name="image" size={32} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.optionLabel}>Select from Gallery</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Điều hướng chân trang */}
      <BottomNav activeTab="create" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 90,
  },
  menuContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#1F2937',
    letterSpacing: -1.5,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 32,
    justifyContent: 'center',
    width: '100%',
  },
  optionWrapper: {
    alignItems: 'center',
    gap: 12,
  },
  circleButtonBlue: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  circleButtonWhite: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  // Preview Style
  previewContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 32,
    resizeMode: 'cover',
  },
  captionInput: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4B5563',
  },
  shareBtn: {
    flex: 2,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
