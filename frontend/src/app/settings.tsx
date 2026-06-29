import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import BottomNav from '../components/bottom-nav';

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Bạn có chắc chắn muốn đăng xuất không?');
      if (confirmLogout) {
        router.replace('/');
      }
    } else {
      Alert.alert(
        'Đăng xuất',
        'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Đăng xuất', style: 'destructive', onPress: () => router.replace('/') },
        ]
      );
    }
  };

  const handlePrivacyPress = () => {
    if (Platform.OS === 'web') {
      alert('Quyền riêng tư đang ở chế độ: Chỉ bạn bè (Friends Only)');
    } else {
      Alert.alert('Quyền riêng tư', 'Tất cả các bức ảnh của bạn hiện chỉ chia sẻ trực tiếp với bạn bè đã kết nối.');
    }
  };

  const handleChangePassword = () => {
    if (Platform.OS === 'web') {
      alert('Chức năng Đổi mật khẩu giả lập!');
    } else {
      Alert.alert('Thông báo', 'Hệ thống đã gửi link đổi mật khẩu qua email đăng ký của bạn.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="align-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Locket</Text>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
          <Feather name="search" size={22} color="#1F2937" />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.mainTitle}>Settings</Text>
      </View>

      {/* Bảng Cài đặt */}
      <View style={styles.settingsContent}>
        {/* Card 1: Notifications */}
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconWrapper, { backgroundColor: '#EFF6FF' }]}>
                <Feather name="bell" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.settingLabel}>Notifications</Text>
            </View>
            <Switch
              trackColor={{ false: '#D1D5DB', true: '#10B981' }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#F3F4F6'}
              ios_backgroundColor="#3E3E3E"
              onValueChange={setNotificationsEnabled}
              value={notificationsEnabled}
            />
          </View>
        </View>

        {/* Card 2: Privacy */}
        <TouchableOpacity
          style={styles.card}
          onPress={handlePrivacyPress}
          activeOpacity={0.8}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconWrapper, { backgroundColor: '#EEF2F6' }]}>
                <Feather name="lock" size={20} color="#64748B" />
              </View>
              <View>
                <Text style={styles.settingLabel}>Privacy</Text>
                <Text style={styles.settingSubLabel}>Who can see your photos</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        {/* Card 3: Account Management */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrapper, { backgroundColor: '#F0FDF4' }]}>
              <Feather name="user" size={20} color="#16A34A" />
            </View>
            <Text style={styles.cardTitle}>Account Management</Text>
          </View>

          {/* Option: Đổi mật khẩu */}
          <TouchableOpacity
            style={styles.optionRow}
            onPress={handleChangePassword}
            activeOpacity={0.7}
          >
            <Text style={styles.optionText}>Change password</Text>
            <Feather name="chevron-right" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Đường gạch ngang nhỏ phân cách */}
          <View style={styles.divider} />

          {/* Option: Đăng xuất */}
          <TouchableOpacity
            style={styles.optionRow}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={[styles.optionText, { color: '#EF4444' }]}>Log out</Text>
            <Feather name="log-out" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Điều hướng chân trang */}
      <BottomNav activeTab="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    height: 50,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  titleContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.75,
  },
  settingsContent: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  settingSubLabel: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 54, // Đẩy sang phải để thẳng hàng với icon tiêu đề card
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
    marginLeft: 54,
  },
});
