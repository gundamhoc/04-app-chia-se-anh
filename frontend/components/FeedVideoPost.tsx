import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Photo } from '../types';
import { photoService } from '../services/photoService';
import { useAuth } from '../hooks/useAuth';

interface FeedVideoPostProps {
  post: Photo;
  isActive: boolean;
  isScreenFocused: boolean;
  isModalOpen: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onExpand: () => void;
  top2Reactions?: Array<{ emoji: string; count: number }>;
  totalReactionsCount?: number;
}

export const FeedVideoPost: React.FC<FeedVideoPostProps> = ({
  post,
  isActive,
  isScreenFocused,
  isModalOpen,
  isMuted,
  onToggleMute,
  onExpand,
  top2Reactions = [],
  totalReactionsCount = 0,
}) => {
  const { token } = useAuth();

  // Xác định URL video (Stream HTTP 206 hoặc direct URL)
  const videoSourceUrl = useMemo(() => {
    if (!post.video_url) return '';
    if (post.video_url.startsWith('http')) {
      return post.video_url;
    }
    return photoService.getPhotoVideoStreamUrl(post.id, token);
  }, [post.id, post.video_url, token]);

  const shouldPlay = isActive && isScreenFocused && !isModalOpen;

  // Khởi tạo trình phát expo-video
  const player = useVideoPlayer(videoSourceUrl, (p) => {
    p.loop = true;
    p.muted = isMuted;
  });

  // Đồng bộ âm lượng mute/unmute
  useEffect(() => {
    if (player) {
      try {
        player.muted = isMuted;
      } catch (e) {
        // Ignored
      }
    }
  }, [isMuted, player]);

  // Điều khiển phát / tạm dừng tự động theo tầm nhìn màn hình
  useEffect(() => {
    if (!player) return;
    try {
      if (shouldPlay) {
        player.play();
      } else {
        player.pause();
      }
    } catch (e) {
      console.warn('Feed video autoplay error:', e);
    }
  }, [shouldPlay, player]);

  const thumbnailUrl = post.image_url;

  return (
    <View style={styles.container}>
      {/* 1. Lớp nền mờ Ambient (Blurred Backdrop) tự động tương thích tỉ lệ khung hình */}
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          blurRadius={Platform.OS === 'ios' ? 25 : 18}
          resizeMode="cover"
          {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as any) : {})}
        />
      ) : null}

      {/* Lớp phủ tương phản tối */}
      <View style={styles.backdropDarkOverlay} />

      {/* 2. Trình phát Video chính hoặc Thumbnail khi chưa phát */}
      <TouchableOpacity
        style={styles.mediaTouchArea}
        activeOpacity={0.96}
        onPress={onExpand}
      >
        {shouldPlay ? (
          <VideoView
            style={styles.videoPlayer}
            player={player}
            contentFit="contain"
            nativeControls={false}
          />
        ) : (
          thumbnailUrl && (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.thumbnailImage}
              resizeMode="contain"
              {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as any) : {})}
            />
          )
        )}

        {/* Nút Play trung tâm khi video chưa active */}
        {!shouldPlay && (
          <View style={styles.centerPlayOverlay}>
            <View style={styles.centerPlayCircle}>
              <Text style={styles.centerPlayIcon}>▶</Text>
            </View>
            <Text style={styles.centerPlayHint}>Lướt tới để tự phát</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 3. Huy hiệu Video góc trên bên trái */}
      <View style={[styles.topLeftBadge, shouldPlay && styles.topLeftBadgeActive]}>
        <Text style={styles.topLeftBadgeText}>
          {shouldPlay ? '🟢 📹 Đang phát' : '📹 Video'}
        </Text>
      </View>

      {/* 4. Nút phóng to toàn màn hình góc trên bên phải */}
      <TouchableOpacity
        style={styles.expandBtn}
        onPress={onExpand}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.expandIcon}>⛶</Text>
      </TouchableOpacity>

      {/* 5. Nút Bật / Tắt âm lượng góc dưới bên phải (Facebook-style Mute/Unmute) */}
      <TouchableOpacity
        style={styles.muteBtn}
        onPress={onToggleMute}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.muteIcon}>{isMuted ? '🔇' : '🔊'}</Text>
      </TouchableOpacity>

      {/* 6. Biểu tượng góc bên phải: hiện số lượt thả emoji nhiều nhất */}
      {top2Reactions.length > 0 && (
        <View style={styles.topEmojiFloatBadge}>
          <Text style={styles.topEmojiFloatIcons}>
            {top2Reactions.map((r) => r.emoji).join(' ')}
          </Text>
          <Text style={styles.topEmojiFloatCount}>{totalReactionsCount}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#0a0a0e',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropDarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  mediaTouchArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  centerPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  centerPlayCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(15, 16, 26, 0.78)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  centerPlayIcon: {
    fontSize: 26,
    color: '#FFFFFF',
    marginLeft: 3,
  },
  centerPlayHint: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topLeftBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 10,
  },
  topLeftBadgeActive: {
    backgroundColor: 'rgba(10, 25, 45, 0.85)',
    borderColor: 'rgba(74, 144, 226, 0.6)',
  },
  topLeftBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  expandBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  expandIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  muteBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  muteIcon: {
    fontSize: 17,
  },
  topEmojiFloatBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 10,
  },
  topEmojiFloatIcons: {
    fontSize: 14,
    marginRight: 4,
  },
  topEmojiFloatCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
