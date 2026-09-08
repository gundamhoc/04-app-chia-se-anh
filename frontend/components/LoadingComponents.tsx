import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../utils/i18n';

interface PulseBlockProps {
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
}

/**
 * Khối khung xương nhấp nháy chuyển động ánh sáng mượt mà (Shimmer / Breathing Pulse)
 */
export const PulseBlock: React.FC<PulseBlockProps> = ({ style, borderRadius = 8 }) => {
  const { isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  const baseBg = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <Animated.View
      style={[
        {
          backgroundColor: baseBg,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton Loader dành riêng cho Bảng tin Locket Feed (index.tsx)
 * Mô phỏng chính xác layout thẻ bài đăng: Header người dùng -> Khung ảnh 1:1 -> Thanh tương tác
 */
export const FeedSkeleton: React.FC = () => {
  const { colors: C, isDark } = useTheme();

  return (
    <View style={styles.feedSkeletonContainer}>
      {[1, 2].map((key) => (
        <View
          key={key}
          style={[
            styles.feedSkeletonCard,
            {
              backgroundColor: isDark ? '#161626' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
            },
          ]}
        >
          {/* Header tác giả */}
          <View style={styles.feedSkeletonHeader}>
            <PulseBlock style={styles.feedSkeletonAvatar} borderRadius={22} />
            <View style={styles.feedSkeletonHeaderText}>
              <PulseBlock style={{ width: 130, height: 15, marginBottom: 6 }} borderRadius={4} />
              <PulseBlock style={{ width: 80, height: 11 }} borderRadius={4} />
            </View>
            <PulseBlock style={{ width: 55, height: 22, marginLeft: 'auto' }} borderRadius={11} />
          </View>

          {/* Khung ảnh vuông 1:1 */}
          <PulseBlock style={styles.feedSkeletonImageBox} borderRadius={20} />

          {/* Caption placeholder */}
          <View style={{ marginTop: 12, paddingHorizontal: 4 }}>
            <PulseBlock style={{ width: '85%', height: 14, marginBottom: 6 }} borderRadius={4} />
            <PulseBlock style={{ width: '50%', height: 14 }} borderRadius={4} />
          </View>

          {/* Thanh 3 nút hành động (Thích, Bình luận, Chia sẻ) */}
          <View style={styles.feedSkeletonActionsRow}>
            <PulseBlock style={{ flex: 1, height: 38 }} borderRadius={12} />
            <PulseBlock style={{ flex: 1, height: 38 }} borderRadius={12} />
            <PulseBlock style={{ flex: 1, height: 38 }} borderRadius={12} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton Loader dành riêng cho Danh sách trò chuyện (messages.tsx)
 * Mô phỏng hàng hội thoại: Avatar tròn -> Tên & tin nhắn gần nhất -> Thời gian
 */
export const ConversationSkeleton: React.FC = () => {
  const { colors: C, isDark } = useTheme();

  return (
    <View style={styles.convSkeletonContainer}>
      {[1, 2, 3, 4, 5, 6].map((key) => (
        <View
          key={key}
          style={[
            styles.convSkeletonRow,
            {
              borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6',
            },
          ]}
        >
          <PulseBlock style={styles.convSkeletonAvatar} borderRadius={26} />
          <View style={styles.convSkeletonContent}>
            <View style={styles.convSkeletonTopRow}>
              <PulseBlock style={{ width: 120, height: 15 }} borderRadius={4} />
              <PulseBlock style={{ width: 45, height: 11 }} borderRadius={4} />
            </View>
            <PulseBlock style={{ width: '75%', height: 12, marginTop: 8 }} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
};

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  subMessage?: string;
}

/**
 * Lớp phủ Loading toàn màn hình (Modal Glassmorphism Overlay)
 * Chặn bấm nhiều lần (double-submit) khi thực hiện các tác vụ nặng:
 * Đăng ảnh lên Google Drive, Lưu thay đổi tài khoản, Khôi phục dữ liệu
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message,
  subMessage,
}) => {
  const { colors: C, isDark } = useTheme();
  const { t, language } = useI18n();

  if (!visible) return null;

  const defaultMsg = language === 'vi' ? 'Đang xử lý, vui lòng chờ...' : 'Processing, please wait...';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlayBackdrop}>
        <View
          style={[
            styles.overlayBox,
            {
              backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
            },
          ]}
        >
          <View style={[styles.spinnerCircle, { backgroundColor: isDark ? 'rgba(108, 99, 255, 0.15)' : 'rgba(108, 99, 255, 0.1)' }]}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
          <Text style={[styles.overlayTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
            {message || defaultMsg}
          </Text>
          {subMessage ? (
            <Text style={[styles.overlaySub, { color: isDark ? C.textMuted : '#6B7280' }]}>
              {subMessage}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Feed Skeleton
  feedSkeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  feedSkeletonCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  feedSkeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedSkeletonAvatar: {
    width: 44,
    height: 44,
  },
  feedSkeletonHeaderText: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  feedSkeletonImageBox: {
    width: '100%',
    aspectRatio: 1,
  },
  feedSkeletonActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  // Conversation Skeleton
  convSkeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  convSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  convSkeletonAvatar: {
    width: 52,
    height: 52,
  },
  convSkeletonContent: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  convSkeletonTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Action Loading Overlay
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayBox: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  spinnerCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  overlayTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    lineHeight: 22,
  },
  overlaySub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
