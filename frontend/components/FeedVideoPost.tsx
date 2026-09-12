import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { Photo } from '../types';
import { photoService } from '../services/photoService';
import { useAuth } from '../hooks/useAuth';

// expo-video chỉ hoạt động trên iOS/Android — trên Web dùng thẻ <video> HTML5 thuần
let useVideoPlayer: any;
let VideoView: any;
if (Platform.OS !== 'web') {
  const expoVideo = require('expo-video');
  useVideoPlayer = expoVideo.useVideoPlayer;
  VideoView = expoVideo.VideoView;
}

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

/** Trình phát video HTML5 cho Web — thẻ <video> thuần, không dùng expo-video */
const WebVideoPlayer: React.FC<{ sourceUrl: string; isMuted: boolean }> = ({ sourceUrl, isMuted }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  return (
    <video
      ref={videoRef as any}
      src={sourceUrl}
      autoPlay
      loop
      muted={isMuted}
      playsInline
      controls={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        display: 'block',
        backgroundColor: 'transparent',
      }}
    />
  );
};

/**
 * Component trình phát video chuyên dụng khi bài đăng ĐANG ACTIVE trên màn hình.
 * - Web: dùng <video> HTML5 thuần
 * - iOS/Android: dùng expo-video VideoView
 */
const ActiveVideoPlayer: React.FC<{ sourceUrl: string; isMuted: boolean }> = ({
  sourceUrl,
  isMuted,
}) => {
  // Web path
  if (Platform.OS === 'web') {
    return <WebVideoPlayer sourceUrl={sourceUrl} isMuted={isMuted} />;
  }

  // Native path (iOS / Android)
  const player = useVideoPlayer(sourceUrl, (p: any) => {
    p.loop = true;
    p.muted = isMuted;
    try {
      p.play();
    } catch (err) {
      console.warn('Auto play video error:', err);
    }
  });

  // Đồng bộ âm lượng mute/unmute khi người dùng ấn nút loa
  useEffect(() => {
    if (player) {
      try {
        player.muted = isMuted;
      } catch {
        // Ignored
      }
    }
  }, [player, isMuted]);

  return (
    <VideoView
      style={styles.videoPlayer}
      player={player}
      contentFit="contain"
      nativeControls={false}
    />
  );
};

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

  // Xác định URL video (Luôn sử dụng stream HTTP 206 backend cho Google Drive & nội bộ)
  const videoSourceUrl = useMemo(() => {
    if (!post.video_url && post.media_type !== 'video') return '';
    // Nếu là direct link mp4 ngoài không phải google drive
    if (
      post.video_url &&
      post.video_url.startsWith('http') &&
      !post.video_url.includes('googleusercontent.com') &&
      !post.video_url.includes('drive.google.com')
    ) {
      return post.video_url;
    }
    return photoService.getPhotoVideoStreamUrl(post.id, token);
  }, [post.id, post.video_url, post.media_type, token]);

  const shouldPlay = isActive && isScreenFocused && !isModalOpen && Boolean(videoSourceUrl);
  const thumbnailUrl = post.image_url;

  return (
    <View style={styles.container}>
      {/* 1. Lớp nền mờ Ambient (Blurred Backdrop) hoặc Nền Poster Điện Ảnh khi chưa có thumbnail */}
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          blurRadius={Platform.OS === 'ios' ? 25 : 18}
          resizeMode="cover"
          {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as any) : {})}
        />
      ) : (
        <View style={styles.defaultAmbientBackdrop}>
          <View style={styles.defaultAmbientGlow} />
          <View style={styles.defaultAmbientGlowSecondary} />
        </View>
      )}

      {/* Lớp phủ tương phản tối */}
      <View style={styles.backdropDarkOverlay} />

      {/* 2. Trình phát Video chính hoặc Poster / Thumbnail khi chưa phát */}
      <TouchableOpacity
        style={styles.mediaTouchArea}
        activeOpacity={0.96}
        onPress={onExpand}
      >
        <View style={styles.videoPlayerWrapper}>
          {/* Lớp Poster / Thumbnail nền (luôn hiển thị để chống chớp đen trong lúc video đang nạp) */}
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.thumbnailImage}
              resizeMode="contain"
              {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as any) : {})}
            />
          ) : (
            <View style={styles.defaultPosterCard}>
              <View style={styles.defaultPosterIconBox}>
                <Text style={styles.defaultPosterIcon}>🎬</Text>
              </View>
              <Text style={styles.defaultPosterTitle}>Khoảnh khắc Video</Text>
            </View>
          )}

          {/* Khi kích hoạt tự phát: hiển thị trình phát video đè lên */}
          {shouldPlay && videoSourceUrl ? (
            <ActiveVideoPlayer sourceUrl={videoSourceUrl} isMuted={isMuted} />
          ) : (
            /* Nút Play trung tâm phong cách Glassmorphism khi video chưa active */
            <View style={styles.centerPlayOverlay}>
              <View style={styles.centerPlayCircle}>
                <Text style={styles.centerPlayIcon}>▶</Text>
              </View>
              <View style={styles.centerPlayPill}>
                <Text style={styles.centerPlayHint}>Chạm để xem • Cuộn để phát</Text>
              </View>
            </View>
          )}
        </View>
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
    maxWidth: 680,
    alignSelf: 'center',
    height: 380,
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
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  defaultAmbientBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0c0a18',
    overflow: 'hidden',
  },
  defaultAmbientGlow: {
    position: 'absolute',
    top: -60,
    left: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(108, 99, 255, 0.28)',
  },
  defaultAmbientGlowSecondary: {
    position: 'absolute',
    bottom: -50,
    right: -30,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
  },
  defaultPosterCard: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121124',
  },
  defaultPosterIconBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(108, 99, 255, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  defaultPosterIcon: {
    fontSize: 34,
  },
  defaultPosterTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#D1D5DB',
    letterSpacing: 0.3,
  },
  mediaTouchArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  thumbnailImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  centerPlayCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  centerPlayIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    marginLeft: 4,
  },
  centerPlayPill: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  centerPlayHint: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
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
