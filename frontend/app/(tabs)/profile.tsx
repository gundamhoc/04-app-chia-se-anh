import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../hooks/useAuth';
import { BASE_URL } from '../../services/api';

const C = Colors.dark;

const getAvatarUrl = (avatarUrl?: string | null): string | null => {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  const base = BASE_URL.replace(/\/api\/?$/, '');
  return `${base}${avatarUrl}`;
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // Web không hỗ trợ Alert.alert — dùng Modal tự custom
      setShowLogoutModal(true);
    } else {
      Alert.alert(
        'Đăng xuất',
        'Bạn có chắc chắn muốn đăng xuất?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Đăng xuất',
            style: 'destructive',
            onPress: async () => {
              await logout();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    }
  };

  const doLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <StatusBar style="light" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Text style={styles.pageTitle}>Hồ sơ</Text>

        {/* Avatar + Info */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            {(() => {
              const avatarUri = getAvatarUrl(user?.avatar_url);
              return avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {(user?.full_name || user?.username || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              );
            })()}
          </View>

          <Text style={styles.displayName}>{user?.full_name || user?.username}</Text>
          <Text style={styles.username}>@{user?.username}</Text>
          {user?.bio && <Text style={styles.bio}>{user.bio}</Text>}
        </View>

        {/* Info rows */}
        <View style={styles.infoCard}>
          <InfoRow icon="📧" label="Email" value={user?.email || '-'} />
          <View style={styles.separator} />
          <InfoRow icon="👤" label="Username" value={`@${user?.username}`} />
        </View>

        {/* Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Tài khoản</Text>

          <TouchableOpacity style={styles.actionItem} disabled>
            <Text style={styles.actionIcon}>✏️</Text>
            <Text style={styles.actionLabel}>Chỉnh sửa hồ sơ</Text>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.actionItem} disabled>
            <Text style={styles.actionIcon}>🔒</Text>
            <Text style={styles.actionLabel}>Đổi mật khẩu</Text>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          accessibilityLabel="logout-button"
        >
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Web Logout Confirm Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Đăng xuất</Text>
            <Text style={styles.modalMessage}>Bạn có chắc chắn muốn đăng xuất?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={doLogout}
              >
                <Text style={styles.modalBtnConfirmText}>Đăng xuất</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scrollView: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  pageTitle: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    paddingVertical: 16,
    marginBottom: 8,
  },
  profileCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  avatarWrapper: { marginBottom: 14 },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarInitial: { fontSize: 32, fontFamily: 'Inter_700Bold', color: '#fff' },
  displayName: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  infoIcon: { fontSize: 20 },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: C.text,
  },
  separator: { height: 1, backgroundColor: C.separator, marginVertical: 4 },
  actionsCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    opacity: 0.6,
  },
  actionIcon: { fontSize: 20 },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: C.text,
  },
  actionChevron: {
    fontSize: 20,
    color: C.textMuted,
  },
  logoutBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: C.error,
  },
  // ---- Web Logout Modal ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
  modalBtnConfirm: {
    backgroundColor: C.error,
  },
  modalBtnConfirmText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
