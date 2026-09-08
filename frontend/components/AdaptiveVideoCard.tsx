import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { Message } from '../types';

interface AdaptiveVideoCardProps {
  message: Message;
  onPress: () => void;
  onDownload?: (url: string, name: string) => void;
  isDark?: boolean;
}

export const AdaptiveVideoCard: React.FC<AdaptiveVideoCardProps> = ({
  message,
  onPress,
  onDownload,
}) => {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    if (message.image_url) {
      Image.getSize(
        message.image_url,
        (width, height) => {
          if (width > 0 && height > 0) {
            setAspectRatio(width / height);
          }
        },
        (error) => {
          console.warn('Cannot get video thumbnail size:', error);
        }
      );
    }
  }, [message.image_url]);

  // Tính toán kích thước thích ứng chuẩn theo tỷ lệ video
  let cardWidth = 245;
  let cardHeight = 150;

  if (aspectRatio) {
    if (aspectRatio < 0.85) {
      // Dạng đứng (9:16 / 4:5 - TikTok, Shorts, Reels)
      cardWidth = 210;
      cardHeight = Math.min(Math.round(cardWidth / aspectRatio), 305);
    } else if (aspectRatio > 1.25) {
      // Dạng ngang (16:9 / 4:3 - YouTube, Widescreen)
      cardWidth = 250;
      cardHeight = Math.max(Math.round(cardWidth / aspectRatio), 142);
    } else {
      // Dạng vuông (1:1)
      cardWidth = 220;
      cardHeight = 220;
    }
  }

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasThumbnail = Boolean(message.image_url);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.container, { width: cardWidth, height: cardHeight }]}
    >
      {/* 1. LỚP NỀN MỜ NGHỆ THUẬT (Blurred Backdrop phủ kín toàn bộ khung) */}
      {hasThumbnail ? (
        <Image
          source={{ uri: message.image_url! }}
          style={StyleSheet.absoluteFill}
          blurRadius={Platform.OS === 'android' ? 18 : 26}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallbackBackground]} />
      )}

      {/* Lớp phủ tối màu làm dịu ánh sáng nền */}
      <View style={styles.backdropOverlay} />

      {/* 3. NÚT PLAY GLASSMORPHISM Ở CHÍNH GIỮA */}
      <View style={styles.playButtonCircle}>
        <Text style={styles.playIconText}>▶</Text>
      </View>

      {/* 4. THANH THÔNG TIN BÊN DƯỚI (Tên file, Dung lượng MB, Nút tải về) */}
      <View style={styles.bottomBar}>
        <View style={styles.infoLeft}>
          <Text style={styles.videoTitle} numberOfLines={1}>
            {message.file_name || 'Video'}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.tapToPlayText}>▶ Phát ngay</Text>
            {message.file_size ? (
              <Text style={styles.fileSizeText}>• {formatFileSize(message.file_size)}</Text>
            ) : null}
          </View>
        </View>

        {onDownload && message.file_url && (
          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={(e) => {
              e.stopPropagation();
              onDownload(message.file_url!, message.file_name || 'video.mp4');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={styles.downloadIcon}>⬇️</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F0F1A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackBackground: {
    backgroundColor: '#1E1E2E',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  centerIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerEmoji: {
    fontSize: 28,
  },
  playButtonCircle: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  playIconText: {
    color: '#ffffff',
    fontSize: 20,
    marginLeft: 3, // Cân đối biểu tượng Play
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  infoLeft: {
    flex: 1,
    marginRight: 8,
  },
  videoTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_500Medium',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  tapToPlayText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '500',
  },
  fileSizeText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10,
  },
  downloadBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadIcon: {
    fontSize: 13,
  },
});
