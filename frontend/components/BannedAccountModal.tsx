import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

const { width } = Dimensions.get('window');

export const BannedAccountModal: React.FC = () => {
  const router = useRouter();
  const banInfo = useAuthStore((s) => s.banInfo);
  const dismissBanModal = useAuthStore((s) => s.dismissBanModal);

  if (!banInfo || !banInfo.visible) {
    return null;
  }

  const handleConfirm = () => {
    dismissBanModal();
    try {
      router.replace('/(auth)/login');
    } catch {
      // ignore
    }
  };

  const isTemporary = banInfo.type === 'temporary' && !!banInfo.banned_until;
  let expiryDisplay = '';
  if (isTemporary && banInfo.banned_until) {
    try {
      const d = new Date(banInfo.banned_until);
      expiryDisplay = d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      expiryDisplay = banInfo.banned_until;
    }
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={banInfo.visible}
      statusBarTranslucent
      onRequestClose={handleConfirm}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Icon cảnh báo vi phạm */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>⛔</Text>
          </View>

          {/* Tiêu đề */}
          <Text style={styles.title}>Tài khoản đã bị khóa</Text>
          <Text style={styles.subtitle}>
            Quản trị viên đã tạm ngừng quyền truy cập của tài khoản này trên hệ thống Masita.
          </Text>

          {/* Box chi tiết hình thức & lý do */}
          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Hình thức:</Text>
              <View style={[styles.badge, isTemporary ? styles.badgeWarning : styles.badgeDanger]}>
                <Text style={[styles.badgeText, isTemporary ? styles.badgeTextWarning : styles.badgeTextDanger]}>
                  {isTemporary ? '⏳ Khóa có thời hạn' : '⛔ Khóa vĩnh viễn'}
                </Text>
              </View>
            </View>

            {isTemporary && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Thời hạn đến:</Text>
                <Text style={styles.detailValueHighlight}>{expiryDisplay}</Text>
              </View>
            )}

            <View style={[styles.detailRow, { alignItems: 'flex-start', marginTop: 4 }]}>
              <Text style={styles.detailLabel}>Lý do:</Text>
              <Text style={styles.reasonText}>
                {banInfo.reason || 'Vi phạm tiêu chuẩn cộng đồng'}
              </Text>
            </View>
          </View>

          <Text style={styles.note}>
            {isTemporary
              ? 'Tài khoản sẽ tự động được mở khóa khi hết thời hạn trên. Sau thời gian này bạn có thể đăng nhập bình thường.'
              : 'Tài khoản bị cấm vĩnh viễn do vi phạm nghiêm trọng quy định cộng đồng.'}
          </Text>

          {/* Nút hành động */}
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.8}
            onPress={handleConfirm}
          >
            <Text style={styles.actionBtnText}>Đã hiểu & Về trang đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999,
  },
  card: {
    width: Math.min(width - 48, 400),
    backgroundColor: '#161626',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
      },
      default: {
        elevation: 10,
      },
    }),
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  detailsBox: {
    width: '100%',
    backgroundColor: '#0F0F1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26263A',
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#8B8B9E',
  },
  detailValueHighlight: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#60A5FA',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  badgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },

  badgeTextWarning: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#F59E0B',
  },
  badgeDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeTextDanger: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#EF4444',
  },
  reasonText: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#F87171',
    marginLeft: 8,
  },
  note: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  actionBtn: {
    width: '100%',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
export default BannedAccountModal;
