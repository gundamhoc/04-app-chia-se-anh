import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Linking from 'expo-linking';
import { saveVideoToDevice } from '../utils/mediaSaver';
import { useToast } from '../hooks/useToast';

interface VideoPlayerModalProps {
  visible: boolean;
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  fileName?: string;
  fileSize?: number;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  visible,
  videoUrl,
  thumbnailUrl,
  fileName,
  fileSize,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [downloading, setDownloading] = useState(false);

  // Khởi tạo trình phát video native của expo-video
  const player = useVideoPlayer(videoUrl || '', (p) => {
    p.loop = false;
    p.play();
  });

  const handleClose = () => {
    try {
      player.pause();
    } catch {
      // Ignored
    }
    onClose();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownload = async () => {
    if (!videoUrl) return;
    setDownloading(true);
    showToast('info', 'Đang tải video về máy...');

    try {
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = fileName || 'video.mp4';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('success', 'Đã bắt đầu tải video!');
      } else {
        const res = await saveVideoToDevice(videoUrl, fileName || `masita_${Date.now()}.mp4`);
        if (res.success) {
          showToast('success', res.message);
        } else {
          // Fallback mở link ngoài nếu quyền lưu trữ không cho phép
          await Linking.openURL(videoUrl);
        }
      }
    } catch (e) {
      console.warn('Download video error:', e);
      showToast('error', 'Không thể tải video về máy.');
    } finally {
      setDownloading(false);
    }
  };

  if (!visible || !videoUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="black" />

        {/* Thanh Header điều khiển trên cùng */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.titleBox}>
            <Text style={styles.titleText} numberOfLines={1}>
              {fileName || 'Video'}
            </Text>
            {fileSize ? (
              <Text style={styles.sizeText}>{formatFileSize(fileSize)}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.8}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.downloadContent}>
                <Text style={styles.downloadIcon}>⬇️</Text>
                <Text style={styles.downloadText}>Tải về</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Khung phát video trung tâm với nền mờ ambient thích ứng */}
        <View style={styles.playerWrapper}>
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={StyleSheet.absoluteFill}
              blurRadius={Platform.OS === 'android' ? 20 : 30}
              resizeMode="cover"
            />
          ) : null}
          {thumbnailUrl ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.45)' }]} />
          ) : null}

          <VideoView
            style={styles.videoPlayer}
            player={player}
            contentFit="contain"
            nativeControls={true}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 10,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  titleBox: {
    flex: 1,
    marginHorizontal: 12,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  sizeText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    marginTop: 2,
  },
  downloadBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  downloadContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadIcon: {
    fontSize: 13,
  },
  downloadText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  playerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
});
