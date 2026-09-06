import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  Platform,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/Colors';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { UserPrivacySettings } from '../types';

const C = Colors.dark;

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

type DetailModalType =
  | 'account_detail'
  | 'privacy_detail'
  | 'security_detail'
  | 'accessibility_detail'
  | 'help_center'
  | 'privacy_center'
  | 'terms_policies'
  | 'app_version'
  | null;

/**
 * Hàm mã hóa / che giấu email: chỉ hiện 2 chữ đầu, @ và đuôi domain (.com, .ru, .vn...)
 * Ví dụ: gundamhoc20@gmail.com -> gu***@***.com
 */
export const maskEmail = (email?: string | null): string => {
  if (!email || !email.includes('@')) return email || '-';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return email;

  const [username, domain] = parts;
  const userPrefix = username.slice(0, 2);

  const dotIndex = domain.lastIndexOf('.');
  if (dotIndex !== -1) {
    const ext = domain.slice(dotIndex); // .com, .ru, .vn...
    return `${userPrefix}***@***${ext}`;
  }

  return `${userPrefix}***@***.com`;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const { updateUser } = useAuthStore();
  const { showToast } = useToast();

  // Switch states for Display & Content
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyPosts, setNotifyPosts] = useState(true);
  const [notifyInteractions, setNotifyInteractions] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'vi' | 'en'>('vi');

  // Sub-detail modal
  const [activeDetail, setActiveDetail] = useState<DetailModalType>(null);

  // Tab inside account_detail: 'username' | 'email' | 'password'
  const [accountTab, setAccountTab] = useState<'username' | 'email' | 'password'>('username');

  // Username form state
  const [editUsername, setEditUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  // Email form state
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Password form state
  const [registeredEmailForPass, setRegisteredEmailForPass] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Privacy Settings states
  const [privacySettings, setPrivacySettings] = useState<UserPrivacySettings>({
    is_private_account: false,
    allow_suggest_account: true,
    searchable_by_name: true,
    searchable_by_username: true,
    searchable_by_email: true,
  });
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);
  const [updatingPrivacyKey, setUpdatingPrivacyKey] = useState<string | null>(null);

  useEffect(() => {
    if (visible || activeDetail === 'privacy_detail') {
      fetchPrivacySettings();
    }
  }, [visible, activeDetail]);

  const fetchPrivacySettings = async () => {
    try {
      setLoadingPrivacy(true);
      const res = await authService.getPrivacySettings();
      if (res && res.success && res.data) {
        setPrivacySettings(res.data);
      }
    } catch (err) {
      console.warn('Lỗi tải cài đặt riêng tư:', err);
    } finally {
      setLoadingPrivacy(false);
    }
  };

  const handleTogglePrivacy = async (key: keyof UserPrivacySettings, value: boolean) => {
    const previous = { ...privacySettings };
    setPrivacySettings((prev) => ({ ...prev, [key]: value }));
    setUpdatingPrivacyKey(key);
    try {
      const res = await authService.updatePrivacySettings({ [key]: value });
      if (res && res.success && res.data) {
        setPrivacySettings(res.data);
        showToast('success', res.message || 'Đã cập nhật quyền riêng tư! 🔒');
      }
    } catch (err: any) {
      setPrivacySettings(previous);
      showToast('error', err.response?.data?.message || 'Không thể cập nhật quyền riêng tư.');
    } finally {
      setUpdatingPrivacyKey(null);
    }
  };

  useEffect(() => {
    if (user) {
      setEditUsername(user.username || '');
    }
  }, [user, activeDetail]);

  // 1. Chia sẻ hồ sơ
  const handleShareProfile = async () => {
    try {
      const profileLink = `https://masita.app/u/${user?.username || 'me'}`;
      await Clipboard.setStringAsync(profileLink);
      showToast('success', 'Đã sao chép liên kết hồ sơ của bạn vào khay nhớ tạm! 📋');
    } catch {
      showToast('info', `Liên kết hồ sơ của bạn: https://masita.app/u/${user?.username || 'me'}`);
    }
  };

  // 2. Lưu Username mới
  const handleSaveUsername = async () => {
    const trimmed = editUsername.trim();
    if (!trimmed) {
      showToast('error', 'Vui lòng nhập username mới.');
      return;
    }
    if (trimmed === user?.username) {
      showToast('info', 'Username không có thay đổi.');
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 30) {
      showToast('error', 'Username phải có từ 3 đến 30 ký tự.');
      return;
    }
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(trimmed)) {
      showToast('error', 'Username chỉ được chứa chữ cái, số và dấu gạch dưới (_).');
      return;
    }

    setSavingUsername(true);
    try {
      const res = await authService.updateUsername(trimmed);
      updateUser({ username: res.data?.username || trimmed });
      showToast('success', res.message || 'Cập nhật username thành công! 🎉');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || err.message || 'Cập nhật username thất bại.');
    } finally {
      setSavingUsername(false);
    }
  };

  // 3. Đổi Email đăng ký (Yêu cầu mật khẩu đúng)
  const handleSaveEmail = async () => {
    const trimmedEmail = newEmail.trim().toLowerCase();
    const pass = emailCurrentPassword.trim();

    if (!trimmedEmail) {
      showToast('error', 'Vui lòng nhập email mới.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showToast('error', 'Định dạng email mới không hợp lệ.');
      return;
    }
    if (trimmedEmail === user?.email?.toLowerCase()) {
      showToast('error', 'Email mới phải khác với email hiện tại.');
      return;
    }
    if (!pass) {
      showToast('error', 'Bạn phải nhập đúng mật khẩu hiện tại để đổi email.');
      return;
    }

    setSavingEmail(true);
    try {
      const res = await authService.updateEmail(trimmedEmail, pass);
      updateUser({ email: res.data?.email || trimmedEmail });
      showToast('success', res.message || 'Cập nhật email đăng ký thành công! 📧');
      setNewEmail('');
      setEmailCurrentPassword('');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || err.message || 'Cập nhật email thất bại.');
    } finally {
      setSavingEmail(false);
    }
  };

  // 4. Đổi Mật khẩu (Yêu cầu nhập đúng email đăng ký)
  const handleChangePassword = async () => {
    const enteredEmail = registeredEmailForPass.trim().toLowerCase();
    const newPass = newPassword.trim();
    const confirmPass = confirmPassword.trim();

    if (!enteredEmail) {
      showToast('error', 'Vui lòng nhập đúng email đăng ký để xác thực.');
      return;
    }
    if (!newPass || newPass.length < 6) {
      showToast('error', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPass !== confirmPass) {
      showToast('error', 'Mật khẩu xác nhận không khớp.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await authService.changePassword(enteredEmail, newPass);
      showToast('success', res.message || 'Đổi mật khẩu thành công! 🔑');
      setRegisteredEmailForPass('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || err.message || 'Đổi mật khẩu thất bại.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Render detail contents
  const renderDetailContent = () => {
    switch (activeDetail) {
      case 'account_detail':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>👤 Quản lý tài khoản</Text>

            {/* Segmented Tab Selector */}
            <View style={styles.accountTabsRow}>
              <TouchableOpacity
                style={[styles.accountTabBtn, accountTab === 'username' && styles.accountTabBtnActive]}
                onPress={() => setAccountTab('username')}
                activeOpacity={0.7}
              >
                <Text style={[styles.accountTabText, accountTab === 'username' && styles.accountTabTextActive]}>
                  👤 Username
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.accountTabBtn, accountTab === 'email' && styles.accountTabBtnActive]}
                onPress={() => setAccountTab('email')}
                activeOpacity={0.7}
              >
                <Text style={[styles.accountTabText, accountTab === 'email' && styles.accountTabTextActive]}>
                  📧 Email
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.accountTabBtn, accountTab === 'password' && styles.accountTabBtnActive]}
                onPress={() => setAccountTab('password')}
                activeOpacity={0.7}
              >
                <Text style={[styles.accountTabText, accountTab === 'password' && styles.accountTabTextActive]}>
                  🔑 Mật khẩu
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: CHỈNH SỬA USERNAME */}
            {accountTab === 'username' && (
              <View style={styles.tabContentBox}>
                <View style={styles.currentValRow}>
                  <Text style={styles.currentValLabel}>Username hiện tại:</Text>
                  <Text style={styles.currentValText}>@{user?.username}</Text>
                </View>

                <Text style={styles.inputLabel}>Nhập username mới:</Text>
                <TextInput
                  style={styles.textInputStyle}
                  placeholder="Ví dụ: nam_tran99"
                  placeholderTextColor={C.textMuted}
                  value={editUsername}
                  onChangeText={setEditUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                />
                <Text style={styles.fieldHint}>
                  Chỉ gồm chữ cái, số và dấu gạch dưới (_), độ dài từ 3 đến 30 ký tự.
                </Text>

                <TouchableOpacity
                  style={[styles.submitActionBtn, savingUsername && styles.submitActionBtnDisabled]}
                  onPress={handleSaveUsername}
                  disabled={savingUsername}
                  activeOpacity={0.8}
                >
                  {savingUsername ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitActionBtnText}>Lưu thay đổi Username</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 2: EMAIL ĐĂNG KÝ (CẦN MẬT KHẨU ĐÚNG) */}
            {accountTab === 'email' && (
              <View style={styles.tabContentBox}>
                <View style={styles.infoNoticeBadge}>
                  <Text style={styles.infoNoticeText}>
                    🔒 Để đổi email đăng ký, bạn phải nhập đúng mật khẩu hiện tại để xác thực an toàn.
                  </Text>
                </View>

                <View style={styles.currentValRow}>
                  <Text style={styles.currentValLabel}>Email hiện tại:</Text>
                  <Text style={styles.currentValText}>{maskEmail(user?.email)}</Text>
                </View>

                <Text style={styles.inputLabel}>Email đăng ký mới:</Text>
                <TextInput
                  style={styles.textInputStyle}
                  placeholder="name@example.com"
                  placeholderTextColor={C.textMuted}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />

                <Text style={styles.inputLabel}>Mật khẩu hiện tại của bạn:</Text>
                <TextInput
                  style={styles.textInputStyle}
                  placeholder="Nhập mật khẩu hiện tại..."
                  placeholderTextColor={C.textMuted}
                  value={emailCurrentPassword}
                  onChangeText={setEmailCurrentPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={[styles.submitActionBtn, savingEmail && styles.submitActionBtnDisabled]}
                  onPress={handleSaveEmail}
                  disabled={savingEmail}
                  activeOpacity={0.8}
                >
                  {savingEmail ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitActionBtnText}>Xác nhận đổi Email</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 3: ĐỔI MẬT KHẨU (CẦN EMAIL ĐĂNG KÝ ĐÚNG) */}
            {accountTab === 'password' && (
              <View style={styles.tabContentBox}>
                <View style={styles.infoNoticeBadge}>
                  <Text style={styles.infoNoticeText}>
                    🛡️ Để đổi mật khẩu, bạn phải nhập chính xác địa chỉ email đã đăng ký tài khoản này.
                  </Text>
                </View>

                <Text style={styles.inputLabel}>Email đăng ký để xác nhận:</Text>
                <TextInput
                  style={styles.textInputStyle}
                  placeholder="Nhập email đăng ký của bạn..."
                  placeholderTextColor={C.textMuted}
                  value={registeredEmailForPass}
                  onChangeText={setRegisteredEmailForPass}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />

                <Text style={styles.inputLabel}>Mật khẩu mới (tối thiểu 6 ký tự):</Text>
                <TextInput
                  style={styles.textInputStyle}
                  placeholder="Nhập mật khẩu mới..."
                  placeholderTextColor={C.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>Xác nhận mật khẩu mới:</Text>
                <TextInput
                  style={styles.textInputStyle}
                  placeholder="Nhập lại mật khẩu mới..."
                  placeholderTextColor={C.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={[styles.submitActionBtn, savingPassword && styles.submitActionBtnDisabled]}
                  onPress={handleChangePassword}
                  disabled={savingPassword}
                  activeOpacity={0.8}
                >
                  {savingPassword ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitActionBtnText}>Xác nhận đổi Mật khẩu</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      case 'privacy_detail':
        return (
          <View style={styles.detailCard}>
            <View style={styles.privacyHeaderRow}>
              <Text style={styles.detailTitle}>🔒 Cài đặt quyền riêng tư</Text>
              {loadingPrivacy && <ActivityIndicator size="small" color={C.primary} />}
            </View>
            <Text style={styles.detailDesc}>
              Kiểm soát phạm vi hiển thị tài khoản, tính năng đề xuất và cách người lạ có thể tìm kiếm bạn.
            </Text>

            {/* 1. Chế độ tài khoản */}
            <View style={styles.privacySectionGroup}>
              <Text style={styles.privacySectionTitle}>👤 CHẾ ĐỘ TÀI KHOẢN</Text>
              <View style={styles.privacySwitchRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.privacySwitchLabel}>
                    {privacySettings.is_private_account ? '🔒 Tài khoản riêng tư' : '🌐 Tài khoản công khai'}
                  </Text>
                  <Text style={styles.privacySwitchDesc}>
                    {privacySettings.is_private_account
                      ? 'Chỉ những người bạn chấp nhận mới xem được bài đăng của bạn. Các bài đăng công khai sẽ không hiển thị cho người lạ trên bảng tin khám phá.'
                      : 'Bất kỳ ai cũng có thể xem hồ sơ và các bài viết công khai của bạn trong mục Khám phá.'}
                  </Text>
                </View>
                <Switch
                  value={privacySettings.is_private_account}
                  onValueChange={(val) => handleTogglePrivacy('is_private_account', val)}
                  trackColor={{ false: '#2D3748', true: '#FFB800' }}
                  thumbColor="#FFFFFF"
                  disabled={updatingPrivacyKey === 'is_private_account'}
                />
              </View>
            </View>

            {/* 2. Đề xuất tài khoản */}
            <View style={styles.privacySectionGroup}>
              <Text style={styles.privacySectionTitle}>✨ ĐỀ XUẤT TÀI KHOẢN</Text>
              <View style={styles.privacySwitchRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.privacySwitchLabel}>Gợi ý tài khoản cho người khác</Text>
                  <Text style={styles.privacySwitchDesc}>
                    Cho phép hệ thống đề xuất tài khoản của bạn trong danh sách "Gợi ý kết bạn" cho những người dùng khác.
                  </Text>
                </View>
                <Switch
                  value={privacySettings.allow_suggest_account}
                  onValueChange={(val) => handleTogglePrivacy('allow_suggest_account', val)}
                  trackColor={{ false: '#2D3748', true: C.primary }}
                  thumbColor="#FFFFFF"
                  disabled={updatingPrivacyKey === 'allow_suggest_account'}
                />
              </View>
            </View>

            {/* 3. Người lạ tìm thấy bạn */}
            <View style={styles.privacySectionGroup}>
              <Text style={styles.privacySectionTitle}>🔍 NGƯỜI LẠ TÌM THẤY BẠN</Text>
              <Text style={styles.privacyGroupSubdesc}>
                Thiết lập xem người lạ (chưa kết bạn) có thể tìm kiếm ra bạn thông qua các thông tin nào:
              </Text>

              {/* Tên hiển thị */}
              <View style={styles.privacySwitchRowSub}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.privacySwitchLabel}>Bằng Tên hiển thị (Họ và tên)</Text>
                  <Text style={styles.privacySwitchDesc}>
                    Người lạ có thể gõ tên hiển thị ({user?.full_name || 'Họ và tên'}) để tìm thấy tài khoản của bạn.
                  </Text>
                </View>
                <Switch
                  value={privacySettings.searchable_by_name}
                  onValueChange={(val) => handleTogglePrivacy('searchable_by_name', val)}
                  trackColor={{ false: '#2D3748', true: C.primary }}
                  thumbColor="#FFFFFF"
                  disabled={updatingPrivacyKey === 'searchable_by_name'}
                />
              </View>

              {/* Username */}
              <View style={styles.privacySwitchRowSub}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.privacySwitchLabel}>Bằng Tên người dùng (Username)</Text>
                  <Text style={styles.privacySwitchDesc}>
                    Người lạ có thể gõ username (@{user?.username || 'username'}) để tìm kiếm tài khoản của bạn.
                  </Text>
                </View>
                <Switch
                  value={privacySettings.searchable_by_username}
                  onValueChange={(val) => handleTogglePrivacy('searchable_by_username', val)}
                  trackColor={{ false: '#2D3748', true: C.primary }}
                  thumbColor="#FFFFFF"
                  disabled={updatingPrivacyKey === 'searchable_by_username'}
                />
              </View>

              {/* Email */}
              <View style={styles.privacySwitchRowSub}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.privacySwitchLabel}>Bằng Địa chỉ Email</Text>
                  <Text style={styles.privacySwitchDesc}>
                    Người lạ có thể tìm kiếm bạn bằng địa chỉ email ({maskEmail(user?.email)}).
                  </Text>
                </View>
                <Switch
                  value={privacySettings.searchable_by_email}
                  onValueChange={(val) => handleTogglePrivacy('searchable_by_email', val)}
                  trackColor={{ false: '#2D3748', true: C.primary }}
                  thumbColor="#FFFFFF"
                  disabled={updatingPrivacyKey === 'searchable_by_email'}
                />
              </View>
            </View>
          </View>
        );

      case 'security_detail':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>🛡️ Bảo mật & Quyền ứng dụng</Text>
            <Text style={styles.detailDesc}>
              Bảo vệ thông tin tài khoản và kiểm soát các quyền truy cập trên thiết bị di động.
            </Text>
            <TouchableOpacity
              style={styles.securityActionCard}
              onPress={() => {
                setAccountTab('password');
                setActiveDetail('account_detail');
              }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.securityItemTitle}>🔑 Đổi mật khẩu tài khoản</Text>
                <Text style={styles.securityItemDesc}>Đổi mật khẩu với xác thực email đăng ký.</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.securityItem}>
              <Text style={styles.securityItemTitle}>📷 Quyền Máy ảnh & Bộ nhớ ảnh</Text>
              <Text style={styles.securityItemDesc}>
                Chỉ truy cập khi bạn thực hiện chụp ảnh hoặc đăng tải khoảnh khắc Locket.
              </Text>
            </View>
            <View style={styles.securityItem}>
              <Text style={styles.securityItemTitle}>📱 Phiên đăng nhập</Text>
              <Text style={styles.securityItemDesc}>Được lưu trữ an toàn bằng mã JWT qua SecureStore.</Text>
            </View>
          </View>
        );

      case 'accessibility_detail':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>♿ Cài đặt trợ năng</Text>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Độ tương phản cao</Text>
                <Text style={styles.switchSub}>Tăng độ rõ nét của chữ và biểu tượng</Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={setHighContrast}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.separator} />
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Giảm hiệu ứng chuyển động</Text>
                <Text style={styles.switchSub}>Tối ưu tốc độ tải và giảm hoạt cảnh</Text>
              </View>
              <Switch
                value={reduceMotion}
                onValueChange={setReduceMotion}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        );

      case 'help_center':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>❓ Trung tâm trợ giúp</Text>
            <Text style={styles.detailDesc}>
              Giải đáp thắc mắc và hỗ trợ người dùng ứng dụng mạng xã hội Masita.
            </Text>
            <View style={styles.faqItem}>
              <Text style={styles.faqQ}>1. Làm sao để chia sẻ khoảnh khắc với bạn bè?</Text>
              <Text style={styles.faqA}>Nhấn nút dấu (+) trên thanh điều hướng để chụp ảnh hoặc chọn ảnh đăng tải.</Text>
            </View>
            <View style={styles.faqItem}>
              <Text style={styles.faqQ}>2. Làm sao để kết bạn mới?</Text>
              <Text style={styles.faqA}>Vào tab Bạn bè, xem mục Gợi ý kết bạn hoặc sử dụng thanh tìm kiếm để kết nối.</Text>
            </View>
            <View style={styles.faqItem}>
              <Text style={styles.faqQ}>3. Làm sao để đổi ảnh nền cuộc trò chuyện?</Text>
              <Text style={styles.faqA}>Vào phòng chat, nhấn nút bánh răng cài đặt và chọn "Đổi chủ đề chat".</Text>
            </View>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => showToast('info', 'Liên hệ hỗ trợ: support@masita.app')}
            >
              <Text style={styles.contactBtnText}>📧 Liên hệ đội ngũ hỗ trợ</Text>
            </TouchableOpacity>
          </View>
        );

      case 'privacy_center':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>🛡️ Trung tâm quyền riêng tư</Text>
            <Text style={styles.detailDesc}>
              Masita cam kết bảo vệ dữ liệu cá nhân của bạn với các tiêu chuẩn an toàn cao nhất:
            </Text>
            <Text style={styles.bulletPoint}>• Tin nhắn cá nhân được mã hóa và chỉ lưu trữ bảo mật.</Text>
            <Text style={styles.bulletPoint}>• Hình ảnh và khoảnh khắc riêng tư không bao giờ được chia sẻ ra ngoài.</Text>
            <Text style={styles.bulletPoint}>• Bạn hoàn toàn kiểm soát ai có thể xem bài viết và gửi tin nhắn cho bạn.</Text>
            <Text style={styles.bulletPoint}>• Bạn có quyền xóa vĩnh viễn bài đăng hoặc tài khoản bất cứ lúc nào.</Text>
          </View>
        );

      case 'terms_policies':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>📜 Điều khoản và chính sách</Text>
            <Text style={styles.detailDesc}>
              Các quy định khi tham gia cộng đồng mạng xã hội Masita:
            </Text>
            <Text style={styles.bulletPoint}>1. Tôn trọng người khác: Không đăng tải nội dung quấy rối, xúc phạm.</Text>
            <Text style={styles.bulletPoint}>2. Bảo vệ bản quyền: Không chia sẻ hình ảnh vi phạm pháp luật.</Text>
            <Text style={styles.bulletPoint}>3. Tính xác thực: Không tạo tài khoản giả mạo người khác.</Text>
            <Text style={styles.bulletPoint}>4. Bảo vệ cộng đồng: Báo cáo các hành vi vi phạm chuẩn mực đạo đức.</Text>
          </View>
        );

      case 'app_version':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>🚀 Phiên bản cập nhật</Text>
            <View style={styles.versionHeader}>
              <Text style={styles.versionNumber}>Masita v1.2.0</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionBadgeText}>Bản mới nhất ✓</Text>
              </View>
            </View>
            <Text style={styles.detailDesc}>
              Bản phát hành chính thức tích hợp chia sẻ khoảnh khắc Locket, tin nhắn realtime, chat nhóm, tùy chỉnh chủ đề và phân quyền bài viết 3 cấp độ.
            </Text>
            <TouchableOpacity
              style={styles.checkUpdateBtn}
              onPress={() => showToast('success', 'Ứng dụng của bạn đang ở phiên bản mới nhất! ✨')}
            >
              <Text style={styles.checkUpdateBtnText}>Kiểm tra cập nhật</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cài đặt</Text>
          <View style={styles.headerRightSpacer} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ================= SECTION 1: TÀI KHOẢN ================= */}
          <Text style={styles.sectionHeader}>Tài khoản</Text>
          <View style={styles.card}>
            {/* 1. Tài khoản */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => {
                setAccountTab('username');
                setActiveDetail('account_detail');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(108, 99, 255, 0.15)' }]}>
                <Text style={styles.itemIcon}>👤</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Tài khoản</Text>
                <Text style={styles.itemSub}>Chỉnh sửa username, email & mật khẩu</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 2. Quyền riêng tư */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('privacy_detail')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
                <Text style={styles.itemIcon}>🔒</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Quyền riêng tư</Text>
                <Text style={styles.itemSub}>
                  {privacySettings.is_private_account ? 'Tài khoản riêng tư' : 'Tài khoản công khai'} • Đề xuất & Tìm kiếm
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 3. Bảo mật và quyền */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('security_detail')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(255, 149, 0, 0.15)' }]}>
                <Text style={styles.itemIcon}>🛡️</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Bảo mật và quyền</Text>
                <Text style={styles.itemSub}>Mật khẩu, quyền máy ảnh & bộ nhớ</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 4. Chia sẻ hồ sơ */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={handleShareProfile}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(0, 199, 190, 0.15)' }]}>
                <Text style={styles.itemIcon}>🔗</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Chia sẻ hồ sơ</Text>
                <Text style={styles.itemSub}>Sao chép liên kết trang cá nhân</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* ================= SECTION 2: NỘI DUNG HIỂN THỊ ================= */}
          <Text style={styles.sectionHeader}>Nội dung hiển thị</Text>
          <View style={styles.card}>
            {/* 1. Thông báo */}
            <View style={styles.itemRow}>
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(255, 45, 85, 0.15)' }]}>
                <Text style={styles.itemIcon}>🔔</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Thông báo</Text>
                <Text style={styles.itemSub}>Nhận thông báo tin nhắn & bài viết mới</Text>
              </View>
              <Switch
                value={notifyMessages}
                onValueChange={(val) => {
                  setNotifyMessages(val);
                  showToast('info', val ? 'Đã bật thông báo' : 'Đã tắt thông báo');
                }}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.separator} />

            {/* 2. Hiển thị */}
            <View style={styles.itemRow}>
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(175, 82, 222, 0.15)' }]}>
                <Text style={styles.itemIcon}>🌓</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Hiển thị</Text>
                <Text style={styles.itemSub}>Giao diện tối ưu (Chế độ tối)</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={(val) => {
                  setDarkMode(val);
                  showToast('info', 'Ứng dụng đang tối ưu giao diện Dark Mode');
                }}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.separator} />

            {/* 3. Ngôn ngữ */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => {
                const next = currentLanguage === 'vi' ? 'en' : 'vi';
                setCurrentLanguage(next);
                showToast('success', next === 'vi' ? 'Đã chọn Tiếng Việt' : 'Selected English');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(88, 86, 214, 0.15)' }]}>
                <Text style={styles.itemIcon}>🌐</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Ngôn ngữ</Text>
                <Text style={styles.itemSub}>
                  {currentLanguage === 'vi' ? 'Tiếng Việt (Mặc định)' : 'English'}
                </Text>
              </View>
              <View style={styles.langBadge}>
                <Text style={styles.langBadgeText}>{currentLanguage.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 4. Trợ năng */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('accessibility_detail')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(50, 173, 230, 0.15)' }]}>
                <Text style={styles.itemIcon}>♿</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Trợ năng</Text>
                <Text style={styles.itemSub}>Tương phản cao, giảm hiệu ứng chuyển động</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* ================= SECTION 3: HỖ TRỢ GIỚI THIỆU ================= */}
          <Text style={styles.sectionHeader}>Hỗ trợ giới thiệu</Text>
          <View style={styles.card}>
            {/* 1. Trung tâm trợ giúp */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('help_center')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(255, 204, 0, 0.15)' }]}>
                <Text style={styles.itemIcon}>❓</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Trung tâm trợ giúp</Text>
                <Text style={styles.itemSub}>FAQ, hướng dẫn sử dụng & liên hệ</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 2. Trung tâm quyền riêng tư */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('privacy_center')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
                <Text style={styles.itemIcon}>🛡️</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Trung tâm quyền riêng tư</Text>
                <Text style={styles.itemSub}>Cam kết bảo mật dữ liệu người dùng</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 3. Điều khoản và chính sách */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('terms_policies')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(142, 142, 147, 0.15)' }]}>
                <Text style={styles.itemIcon}>📜</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Điều khoản và chính sách</Text>
                <Text style={styles.itemSub}>Quy chuẩn cộng đồng và dịch vụ</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 4. Phiên bản cập nhật */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('app_version')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(108, 99, 255, 0.15)' }]}>
                <Text style={styles.itemIcon}>🚀</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Phiên bản cập nhật</Text>
                <Text style={styles.itemSub}>Masita Mobile v1.2.0 (Mới nhất)</Text>
              </View>
              <View style={styles.versionPill}>
                <Text style={styles.versionPillText}>v1.2.0</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Detail Bottom Modal with KeyboardAvoidingView */}
        <Modal
          visible={!!activeDetail}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveDetail(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.detailOverlay}
          >
            <TouchableOpacity
              style={styles.detailBackdrop}
              activeOpacity={1}
              onPress={() => setActiveDetail(null)}
            />
            <View style={styles.detailModalBox}>
              <View style={styles.detailDragBar} />
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                {renderDetailContent()}
              </ScrollView>
              <TouchableOpacity
                style={styles.detailCloseBtn}
                onPress={() => setActiveDetail(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.detailCloseBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: C.text,
  },
  headerRightSpacer: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: C.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  itemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIcon: {
    fontSize: 20,
  },
  itemTextBox: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  chevron: {
    fontSize: 20,
    color: C.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: 68,
  },
  langBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: `${C.primary}25`,
    borderWidth: 1,
    borderColor: `${C.primary}50`,
  },
  langBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: C.primaryLight,
  },
  versionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  versionPillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#34C759',
  },

  // Sub-detail modal
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  detailBackdrop: {
    flex: 1,
  },
  detailModalBox: {
    backgroundColor: '#181826',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
  },
  detailDragBar: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailCard: {
    marginBottom: 10,
  },
  detailTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  detailDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },

  // Account Tabs and Forms
  accountTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  accountTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  accountTabBtnActive: {
    backgroundColor: C.primary,
    borderColor: C.primaryLight,
  },
  accountTabText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: C.textMuted,
  },
  accountTabTextActive: {
    color: '#FFFFFF',
  },
  tabContentBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  infoNoticeBadge: {
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    borderWidth: 1,
    borderColor: `${C.primary}35`,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  infoNoticeText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.primaryLight,
    lineHeight: 18,
  },
  currentValRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  currentValLabel: {
    fontSize: 12,
    color: C.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  currentValText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 6,
    marginTop: 8,
  },
  textInputStyle: {
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  fieldHint: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 4,
    marginBottom: 6,
  },
  submitActionBtn: {
    backgroundColor: C.primary,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitActionBtnDisabled: {
    opacity: 0.6,
  },
  submitActionBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },

  // Privacy & Security Details
  privacyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  privacySectionGroup: {
    marginTop: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  privacySectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: C.primaryLight,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  privacyGroupSubdesc: {
    fontSize: 12,
    color: C.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  privacySwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  privacySwitchRowSub: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  privacySwitchLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  privacySwitchDesc: {
    fontSize: 12,
    color: C.textMuted,
    lineHeight: 17,
  },
  securityActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: `${C.primary}35`,
  },
  securityItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  securityItemTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  securityItemDesc: {
    fontSize: 12,
    color: C.textMuted,
    lineHeight: 18,
  },

  // Other Details
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  switchSub: {
    fontSize: 12,
    color: C.textMuted,
  },
  faqItem: {
    marginBottom: 12,
  },
  faqQ: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.primaryLight,
    marginBottom: 2,
  },
  faqA: {
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
  },
  contactBtn: {
    marginTop: 10,
    paddingVertical: 10,
    backgroundColor: `${C.primary}20`,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${C.primary}45`,
    alignItems: 'center',
  },
  contactBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.primaryLight,
  },
  bulletPoint: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 22,
    marginBottom: 4,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  versionNumber: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  versionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  versionBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#34C759',
  },
  checkUpdateBtn: {
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: C.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkUpdateBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  detailCloseBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  detailCloseBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
});
