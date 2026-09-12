import React, { useState, useRef } from 'react';
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
import * as Linking from 'expo-linking';
import { saveVideoToDevice } from '../utils/mediaSaver';
import { useToast } from '../hooks/useToast';

// expo-video không hỗ trợ Web — chỉ import trên Native
let useVideoPlayer: any;
let VideoView: any;
if (Platform.OS !== 'web') {
  const expoVideo = require('expo-video');
  useVideoPlayer = expoVideo.useVideoPlayer;
  VideoView = expoVideo.VideoView;
}

interface VideoPlayerModalProps {
  visible: boolean;
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  fileName?: string;
  fileSize?: number;
  onClose: () => void;
}

/** Trình phát HTML5 <video> thuần cho Web */
const WebModalVideoPlayer: React.FC<{ videoUrl: string }> = ({ videoUrl }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  return (
    <video
      ref={videoRef as any}
      src={videoUrl}
      autoPlay
      controls
      playsInline
      loop={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        display: 'block',
        backgroundColor: '#000',
      }}
    />
  );
};

/**
 * Trình phát video chuyên biệt gắn liền với vòng đời modal mở/đóng.
 * Tránh tạo player rỗng khi modal chưa hiển thị và ngăn ngừa lỗi SharedObject released trên Android.
 */
const ModalVideoPlayer: React.FC<{ videoUrl: string }> = ({ videoUrl }) => {
  // Web: dùng <video> HTML5 thuần
  if (Platform.OS === 'web') {
    return <WebModalVideoPlayer videoUrl={videoUrl} />;
  }

  // Native: expo-video
  const player = useVideoPlayer(videoUrl, (p: any) => {
    p.loop = false;
    try {
      p.play();
    } catch {
      // Ignored
    }
  });

  return (
    <VideoView
      style={styles.videoPlayer}
      player={player}
      contentFit="contain"
      nativeControls={true}
    />
  );
};

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
      const cleanName = fileName ? fileName.replace(/[^a-zA-Z0-9._-]/g, '_') : '';
      const safeFilename = cleanName
        ? (cleanName.endsWith('.mp4') ? cleanName : `${cleanName}.mp4`)
        : `masita_video_${Date.now()}.mp4`;

      const res = await saveVideoToDevice(videoUrl, safeFilename);
      if (res.success) {
        showToast('success', res.message);
      } else {
        if (Platform.OS !== 'web') {
          // Fallback mở link ngoài nếu quyền lưu trữ không cho phép
          await Linking.openURL(videoUrl);
        } else {
          showToast('error', res.message);
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
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="black" />

        {/* Thanh Header điều khiển trên cùng */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
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

          <ModalVideoPlayer videoUrl={videoUrl} />
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
