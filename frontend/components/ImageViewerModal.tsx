import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  PanResponder,
  Animated,
  useWindowDimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Photo } from '../types';

interface ImageViewerModalProps {
  visible: boolean;
  photo: Photo | null;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  photo,
  onClose,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [currentZoomLevel, setCurrentZoomLevel] = useState(1);
  const [showControls, setShowControls] = useState(true);

  // Animated values
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Trackers cho gesture
  const currentScaleRef = useRef(1);
  const currentPanRef = useRef({ x: 0, y: 0 });
  const initialDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);
  const lastTapRef = useRef<number>(0);

  // Reset trạng thái khi modal mở hoặc đổi ảnh
  useEffect(() => {
    if (visible) {
      resetZoom(false);
      setShowControls(true);
    }
  }, [visible, photo?.id]);

  // Đồng bộ giá trị Animated với Ref
  useEffect(() => {
    const scaleListenerId = scale.addListener(({ value }) => {
      currentScaleRef.current = value;
      setCurrentZoomLevel(Math.round(value * 100) / 100);
    });

    const panListenerId = pan.addListener((value) => {
      currentPanRef.current = value;
    });

    return () => {
      scale.removeListener(scaleListenerId);
      pan.removeListener(panListenerId);
    };
  }, [scale, pan]);

  // Hỗ trợ chuột lăn (wheel) và phím Esc trên Web Browser
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;
      const targetScale = Math.min(Math.max(currentScaleRef.current * zoomFactor, 1), 4);
      animateTo(targetScale, targetScale === 1 ? { x: 0, y: 0 } : currentPanRef.current);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  const animateTo = (targetScale: number, targetPan = { x: 0, y: 0 }) => {
    // Giới hạn vùng pan để ảnh không bị bay ra khỏi màn hình
    const maxPanX = ((targetScale - 1) * windowWidth) / 2;
    const maxPanY = ((targetScale - 1) * windowHeight) / 2;
    const clampedX = Math.min(Math.max(targetPan.x, -maxPanX), maxPanX);
    const clampedY = Math.min(Math.max(targetPan.y, -maxPanY), maxPanY);

    Animated.parallel([
      Animated.spring(scale, {
        toValue: targetScale,
        useNativeDriver: true,
        bounciness: 2,
      }),
      Animated.spring(pan, {
        toValue: targetScale === 1 ? { x: 0, y: 0 } : { x: clampedX, y: clampedY },
        useNativeDriver: true,
        bounciness: 2,
      }),
    ]).start();
  };

  const resetZoom = (animated = true) => {
    if (animated) {
      animateTo(1, { x: 0, y: 0 });
    } else {
      scale.setValue(1);
      pan.setValue({ x: 0, y: 0 });
      currentScaleRef.current = 1;
      currentPanRef.current = { x: 0, y: 0 };
      setCurrentZoomLevel(1);
    }
  };

  const handleDoubleTap = () => {
    if (currentScaleRef.current > 1) {
      resetZoom(true);
    } else {
      animateTo(2.5, { x: 0, y: 0 });
    }
  };

  const handleZoomIn = () => {
    const next = Math.min(currentScaleRef.current + 0.5, 4);
    animateTo(next, currentPanRef.current);
  };

  const handleZoomOut = () => {
    const next = Math.max(currentScaleRef.current - 0.5, 1);
    animateTo(next, next === 1 ? { x: 0, y: 0 } : currentPanRef.current);
  };

  // Tính khoảng cách giữa 2 điểm chạm
  const calcDistance = (
    touch0: { pageX: number; pageY: number },
    touch1: { pageX: number; pageY: number }
  ) => {
    const dx = touch0.pageX - touch1.pageX;
    const dy = touch0.pageY - touch1.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // PanResponder bắt cử chỉ Pinch-to-zoom và Pan / Swipe
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (_evt, gestureState) => {
        // Kiểm tra double tap
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          handleDoubleTap();
          lastTapRef.current = 0;
          return;
        }
        lastTapRef.current = now;

        initialScaleRef.current = currentScaleRef.current;
        initialDistanceRef.current = null;
      },

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        // 1. Cử chỉ 2 ngón tay: Co giãn Pinch-to-zoom
        if (touches && touches.length >= 2) {
          const dist = calcDistance(touches[0], touches[1]);
          if (!initialDistanceRef.current) {
            initialDistanceRef.current = dist;
            initialScaleRef.current = currentScaleRef.current;
          } else {
            const factor = dist / initialDistanceRef.current;
            const newScale = Math.min(Math.max(initialScaleRef.current * factor, 0.9), 4.5);
            scale.setValue(newScale);
          }
          return;
        }

        // 2. Cử chỉ 1 ngón tay khi đang zoom (> 1x): Kéo di chuyển ảnh (Pan)
        if (currentScaleRef.current > 1.05) {
          const newX = currentPanRef.current.x + gestureState.dx * 0.4;
          const newY = currentPanRef.current.y + gestureState.dy * 0.4;
          pan.setValue({ x: newX, y: newY });
          return;
        }

        // 3. Cử chỉ 1 ngón tay khi ảnh ở 1x: Kéo xuống để đóng (Swipe down to dismiss)
        if (gestureState.dy > 0 && currentScaleRef.current <= 1.05) {
          pan.setValue({ x: 0, y: gestureState.dy });
        }
      },

      onPanResponderRelease: (_evt, gestureState) => {
        initialDistanceRef.current = null;

        // Nếu zoom < 1x thì đàn hồi về 1x
        if (currentScaleRef.current < 1) {
          resetZoom(true);
          return;
        }

        // Nếu zoom > 4x thì đàn hồi về 4x
        if (currentScaleRef.current > 4) {
          animateTo(4, currentPanRef.current);
          return;
        }

        // Nếu đang ở 1x và vuốt xuống quá 120px ➔ Đóng ảnh
        if (currentScaleRef.current <= 1.05) {
          if (gestureState.dy > 120) {
            onClose();
            return;
          }
          // Ngược lại trả về vị trí gốc
          resetZoom(true);
          return;
        }

        // Nếu đang zoom (> 1x), giữ nguyên và kiểm tra biên pan
        animateTo(currentScaleRef.current, currentPanRef.current);
      },
    })
  ).current;

  if (!photo) return null;

  const authorAvatarUri = photo.author_avatar
    ? { uri: photo.author_avatar }
    : require('../assets/splash-icon.png');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar hidden />

        {/* Backdrop chạm để ẩn/hiện thanh công cụ */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setShowControls((prev) => !prev)}
        />

        {/* Top Header Bar */}
        {showControls && (
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            {/* Tác giả */}
            <View style={styles.authorHeader}>
              <Image source={authorAvatarUri} style={styles.authorAvatar} />
              <View>
                <Text style={styles.authorName} numberOfLines={1}>
                  {photo.author_name}
                </Text>
                <Text style={styles.zoomText}>
                  {currentZoomLevel > 1 ? `Zoom: ${Math.round(currentZoomLevel * 100)}%` : 'Chạm đúp để phóng to'}
                </Text>
              </View>
            </View>

            {/* Nút đóng */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Khung chứa ảnh có cử chỉ Zoom và Pan */}
        <View style={styles.imageViewport} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.imageWrapper,
              {
                transform: [
                  { translateX: pan.x },
                  { translateY: pan.y },
                  { scale: scale },
                ],
              },
            ]}
          >
            <Image
              source={{ uri: photo.image_url }}
              style={[styles.mainImage, { width: windowWidth, height: windowHeight * 0.75 }]}
              resizeMode="contain"
              {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
            />
          </Animated.View>
        </View>

        {/* Bottom Bar: Chú thích & Nút điều khiển Zoom nhanh */}
        {showControls && (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
            {photo.caption ? (
              <View style={styles.captionBox}>
                <Text style={styles.captionText}>{photo.caption}</Text>
              </View>
            ) : null}

            {/* Zoom Controls Bar */}
            <View style={styles.controlsBar}>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={handleZoomOut}
                disabled={currentZoomLevel <= 1}
              >
                <Text style={[styles.zoomBtnText, currentZoomLevel <= 1 && styles.btnDisabled]}>
                  ➖
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.resetBtn} onPress={() => resetZoom(true)}>
                <Text style={styles.resetBtnText}>
                  {Math.round(currentZoomLevel * 100)}%
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={handleZoomIn}
                disabled={currentZoomLevel >= 4}
              >
                <Text style={[styles.zoomBtnText, currentZoomLevel >= 4 && styles.btnDisabled]}>
                  ➕
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 10, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(15, 15, 26, 0.75)',
  },
  authorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2A2A3E',
  },
  authorName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  zoomText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#A0A0B2',
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  closeIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageViewport: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImage: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: 'rgba(15, 15, 26, 0.75)',
    alignItems: 'center',
  },
  captionBox: {
    width: '100%',
    marginBottom: 12,
    maxHeight: 80,
  },
  captionText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
    lineHeight: 20,
    textAlign: 'center',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 8,
  },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomBtnText: {
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.3,
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(108, 99, 255, 0.25)',
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
