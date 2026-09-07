/**
 * Toast.tsx — Cross-platform toast notification
 *
 * - Mobile: dùng Modal native
 * - Web:    dùng View với position:'fixed' (tránh Modal white-screen trên RNW)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  type?: ToastType;
  message: string;
  onHide?: () => void;
  duration?: number;
}

const INIT_Y = -110;
// useNativeDriver: false trên web (không hỗ trợ), true trên native
const ND = Platform.OS !== 'web';

const Toast: React.FC<ToastProps> = ({
  visible,
  type = 'info',
  message,
  onHide,
  duration = 3000,
}) => {
  const translateY = useRef(new Animated.Value(INIT_Y)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const timerRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animRef    = useRef<Animated.CompositeAnimation | null>(null);
  const [show, setShow] = useState(false);

  const getBackground = () => {
    switch (type) {
      case 'success': return '#10B981';
      case 'error':   return '#EF4444';
      case 'warning': return '#F59E0B';
      default:        return '#6C63FF';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error':   return '❌';
      case 'warning': return '⚠️';
      default:        return 'ℹ️';
    }
  };

  const animateOut = () => {
    clearTimeout(timerRef.current);
    animRef.current?.stop();
    animRef.current = Animated.parallel([
      Animated.timing(translateY, {
        toValue: INIT_Y,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: ND,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: ND,
      }),
    ]);
    animRef.current.start(() => {
      setShow(false);
      onHide?.();
    });
  };

  // Phase 1: Khi visible thay đổi → reset giá trị, mount component
  useEffect(() => {
    if (visible) {
      translateY.setValue(INIT_Y);
      opacity.setValue(0);
      setShow(true);
    }
    // Không animate out ở đây — để timer trong Phase 2 xử lý
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 2: Sau khi show=true (component đã mount), bắt animation
  useEffect(() => {
    if (!show) return;

    // requestAnimationFrame đảm bảo DOM/native node đã ready
    const rafId = requestAnimationFrame(() => {
      animRef.current?.stop();
      animRef.current = Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: ND,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: ND,
        }),
      ]);
      animRef.current.start();

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(animateOut, duration);
    });

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerRef.current);
    };
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  const toastContent = (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: getBackground(),
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Pressable onPress={animateOut} style={styles.pressable}>
        <Text style={styles.icon}>{getIcon()}</Text>
        <Text style={styles.text} numberOfLines={3}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );

  /* ─── Web: position fixed — tránh Modal white-screen ────────────── */
  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          // @ts-ignore – position:'fixed' valid trên React Native Web
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          paddingTop: 52,
          paddingHorizontal: 16,
          alignItems: 'center',
          // @ts-ignore
          pointerEvents: 'box-none',
        }}
      >
        {toastContent}
      </View>
    );
  }

  /* ─── Mobile: Modal native overlay ────────────────────────────────── */
  return (
    <Modal
      visible={show}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={animateOut}
    >
      <View style={styles.overlay}>
        {toastContent}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingTop: 52,
    paddingHorizontal: 16,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  toast: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 18,
  },
  text: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 20,
  },
});

export default Toast;
