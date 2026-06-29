import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Modal,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { mockStore } from '../constants/mock-store';
import BottomNav from '../components/bottom-nav';

// Các ảnh mẫu cực đẹp để người dùng chọn làm demo
const STOCK_PHOTOS = [
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800',
];

export default function CreateScreen() {
  const [caption, setCaption] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [cameraFlash, setCameraFlash] = useState(false);

  // Giả lập chụp ảnh mới (Chớp màn hình và tự chọn ngẫu nhiên 1 ảnh đẹp)
  const handleCameraPress = () => {
    setCameraFlash(true);
    setTimeout(() => {
      setCameraFlash(false);
      const randomIndex = Math.floor(Math.random() * STOCK_PHOTOS.length);
      setSelectedImage(STOCK_PHOTOS[randomIndex]);
    }, 300);
  };

  // Chia sẻ ảnh
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
    
    // Reset state
    setSelectedImage(null);
    setCaption('');
    
    // Quay lại màn hình chính
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
          // Giao diện sau khi đã chọn được ảnh
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
          // Giao diện chọn hành động ban đầu giống hệt thiết kế
          <View style={styles.menuContainer}>
            <Text style={styles.title}>Locket</Text>

            <View style={styles.optionsRow}>
              {/* Nút Chụp ảnh mới */}
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

              {/* Nút Chọn từ thư viện */}
              <View style={styles.optionWrapper}>
                <TouchableOpacity
                  style={styles.circleButtonWhite}
                  onPress={() => setIsGalleryOpen(true)}
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

      {/* Modal thư viện ảnh giả lập */}
      <Modal visible={isGalleryOpen} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn ảnh từ thư viện</Text>
              <TouchableOpacity onPress={() => setIsGalleryOpen(false)}>
                <Feather name="x" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.galleryGrid}>
              {STOCK_PHOTOS.map((url, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.galleryItem}
                  onPress={() => {
                    setSelectedImage(url);
                    setIsGalleryOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: url }} style={styles.galleryImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  // Modal Style
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  galleryItem: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
