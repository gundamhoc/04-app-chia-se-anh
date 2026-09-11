import React, { useState, useEffect, useMemo } from 'react';
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
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Colors, ColorScheme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { UserPrivacySettings, SecurityStatus, LoginSession } from '../types';
import { useAppSettings } from '../store/appSettingsStore';
import { useI18n, formatRelativeTime as formatRelativeTimeI18n } from '../utils/i18n';
import { otaUpdateService, OtaUpdateInfo } from '../services/otaUpdateService';
import { supportService, SupportTicket } from '../services/supportService';
import {
  getApiBaseUrl,
  getApiOverride,
  applyApiBaseUrlOverride,
} from '../services/api';
import { disconnectSocket, connectSocket } from '../services/socketService';
import { SERVER_RENDER_URL, SERVER_NGROK_URL } from '../constants/servers';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

type DetailModalType =
  | 'account_detail'
  | 'privacy_detail'
  | 'security_detail'
  | 'accessibility_detail'
  | 'notify_detail'
  | 'language_detail'
  | 'help_center'
  | 'privacy_center'
  | 'terms_policies'
  | 'app_version'
  | 'developer'
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

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose, onLogout }) => {
  const { user, logout } = useAuth();
  const { updateUser } = useAuthStore();
  const { showToast } = useToast();
  const { t } = useI18n();

  // Trạng thái xác nhận Đăng xuất trên Web
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);

  const handleLogout = () => {
    if (onLogout) {
      onClose();
      onLogout();
      return;
    }

    if (Platform.OS === 'web') {
      setShowLogoutConfirmModal(true);
    } else {
      Alert.alert(
        t('logout'),
        t('logout_confirm_msg'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('logout'),
            style: 'destructive',
            onPress: performLogout,
          },
        ]
      );
    }
  };

  const performLogout = async () => {
    setShowLogoutConfirmModal(false);
    onClose();
    await logout();
    router.replace('/(auth)/login');
  };

  // Cài đặt hiển thị — lấy từ AppSettingsStore (persist vào SecureStore)
  const {
    themeMode, setThemeMode,
    notifyMessages, setNotifyMessages,
    notifyPosts, setNotifyPosts,
    notifyInteractions, setNotifyInteractions,
    language, setLanguage,
    highContrast, setHighContrast,
    reduceMotion, setReduceMotion,
    largeText, setLargeText,
    appVersion, setAppVersion,
    otaChannel, setOtaChannel,
    autoCheckOta, setAutoCheckOta,
    lastOtaCheckTime,
  } = useAppSettings();

  // Trạng thái OTA Updates
  const [otaLoading, setOtaLoading] = useState(false);
  const [otaInfo, setOtaInfo] = useState<OtaUpdateInfo | null>(null);
  const [otaDownloading, setOtaDownloading] = useState(false);
  const [otaProgress, setOtaProgress] = useState(0);
  const [otaDownloaded, setOtaDownloaded] = useState(false);
  const [otaChecked, setOtaChecked] = useState(false);

  // ===== Cau noi Developer: chon server backend luc chay (chi __DEV__) =====
  const [serverDisplay, setServerDisplay] = useState<string>(() => getApiBaseUrl());
  const [customServerInput, setCustomServerInput] = useState<string>('');

  const handleSwitchServer = async (rootUrl: string | null) => {
    try {
      const nextBase = await applyApiBaseUrlOverride(rootUrl);
      // Ket noi lai socket troi sang server moi (giu nguyen phien login neu server chia chung JWT/DB)
      const st = useAuthStore.getState();
      if (st.isAuthenticated && st.user?.id) {
        disconnectSocket();
        connectSocket(st.user.id, st.token);
      }
      setServerDisplay(nextBase);
      showToast(
        'success',
        language === 'vi'
          ? 'Đã chuyển máy chủ. Nếu dữ liệu không khớp, hãy đăng xuất rồi đăng nhập lại.'
          : 'Server switched. Log out and back in if data looks stale.'
      );
    } catch (e) {
      showToast('error', language === 'vi' ? 'Không đổi được máy chủ.' : 'Failed to switch server.');
    }
  };

  const handleApplyCustomServer = async () => {
    const val = customServerInput.trim();
    if (!/^https?:\/\//i.test(val)) {
      showToast('warning', language === 'vi' ? 'URL phải bắt đầu bằng http:// hoặc https://' : 'URL must start with http:// or https://');
      return;
    }
    await handleSwitchServer(val);
  };

  const currentOverride = getApiOverride();
  const isRenderActive = currentOverride === SERVER_RENDER_URL;
  const isNgrokActive = currentOverride === SERVER_NGROK_URL;
  const isDefaultActive = currentOverride === null;

  const handleCheckOta = async (simulate?: 'new_version' | 'up_to_date') => {
    setOtaLoading(true);
    setOtaDownloaded(false);
    setOtaProgress(0);
    try {
      const info = await otaUpdateService.checkForUpdate({
        channel: otaChannel,
        simulate,
      });
      setOtaInfo(info);
      setOtaChecked(true);
      if (info.is_update_available) {
        showToast('info', language === 'vi' ? `Có bản cập nhật OTA v${info.latest_version}!` : `New OTA update v${info.latest_version} available!`);
      } else {
        showToast('success', language === 'vi' ? 'Ứng dụng của bạn đang ở phiên bản mới nhất! ✨' : 'Your app is up to date! ✨');
      }
    } catch (e: any) {
      showToast('error', e.message || (language === 'vi' ? 'Lỗi kiểm tra cập nhật.' : 'Failed to check updates.'));
    } finally {
      setOtaLoading(false);
    }
  };

  const handleDownloadOta = async () => {
    if (!otaInfo) return;
    setOtaDownloading(true);
    setOtaProgress(0);
    try {
      await otaUpdateService.downloadUpdate(
        Boolean(otaInfo.is_native_expo_update),
        (p) => setOtaProgress(p)
      );
      setOtaDownloaded(true);
      showToast('success', language === 'vi' ? 'Đã tải xong gói cập nhật OTA! 🚀' : 'OTA update downloaded! 🚀');
    } catch (e: any) {
      showToast('error', e.message || (language === 'vi' ? 'Lỗi tải bản cập nhật.' : 'Download failed.'));
    } finally {
      setOtaDownloading(false);
    }
  };

  const handleApplyOta = async () => {
    if (!otaInfo) return;
    try {
      showToast('info', language === 'vi' ? 'Đang áp dụng và khởi động lại... ⏳' : 'Applying update and restarting... ⏳');
      await otaUpdateService.applyUpdateAndReload(otaInfo.latest_version, Boolean(otaInfo.is_native_expo_update));
      setOtaDownloaded(false);
      setOtaInfo(null);
      setOtaChecked(false);
    } catch (e: any) {
      showToast('error', e.message || 'Lỗi áp dụng bản cập nhật.');
    }
  };

  const { colors: C, isDark } = useTheme();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  // Sub-detail modal
  const [activeDetail, setActiveDetail] = useState<DetailModalType>(null);

  // Tự động kiểm tra OTA khi mở trang phiên bản nếu bật autoCheckOta
  useEffect(() => {
    if (activeDetail === 'app_version' && autoCheckOta && !otaChecked && !otaLoading) {
      handleCheckOta();
    }
  }, [activeDetail, autoCheckOta]);

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

  // Security Settings states
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [loginSessions, setLoginSessions] = useState<LoginSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [updatingTwoFactor, setUpdatingTwoFactor] = useState(false);
  const [updatingRememberLogin, setUpdatingRememberLogin] = useState(false);
  // 2FA OTP flow state
  const [otpStep, setOtpStep] = useState<'idle' | 'pending' | 'confirm'>('idle');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ─── Help Center / Support Tickets ───────────────────────────────────
  // Tab: 'faq' | 'submit' | 'history'
  const [helpTab, setHelpTab] = useState<'faq' | 'submit' | 'history'>('faq');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('general');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  useEffect(() => {
    if (activeDetail === 'help_center' && helpTab === 'history') {
      fetchMyTickets();
    }
  }, [activeDetail, helpTab]);

  const fetchMyTickets = async () => {
    try {
      setLoadingTickets(true);
      const tickets = await supportService.getMyTickets();
      setMyTickets(tickets);
    } catch (e: any) {
      showToast('error', language === 'vi' ? 'Không thể tải lịch sử thắc mắc.' : 'Failed to load ticket history.');
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleSubmitTicket = async () => {
    if (!ticketSubject.trim()) {
      showToast('error', language === 'vi' ? 'Vui lòng nhập tiêu đề thắc mắc.' : 'Please enter a subject.');
      return;
    }
    if (!ticketMessage.trim()) {
      showToast('error', language === 'vi' ? 'Vui lòng nhập nội dung chi tiết.' : 'Please describe your issue.');
      return;
    }
    try {
      setSubmittingTicket(true);
      await supportService.createTicket({
        subject: ticketSubject.trim(),
        category: ticketCategory,
        message: ticketMessage.trim(),
      });
      setTicketSubject('');
      setTicketMessage('');
      setTicketCategory('general');
      setTicketSubmitted(true);
      setTimeout(() => setTicketSubmitted(false), 4000);
      showToast('success', language === 'vi' ? '✅ Thắc mắc đã gửi! Admin/Nhân viên sẽ phản hồi sớm nhất.' : '✅ Question sent! Admin/Staff will reply shortly.');
    } catch (e: any) {
      showToast('error', e?.response?.data?.message || (language === 'vi' ? 'Gửi thắc mắc thất bại.' : 'Failed to submit.'));
    } finally {
      setSubmittingTicket(false);
    }
  };

  useEffect(() => {
    if (visible || activeDetail === 'privacy_detail') {
      fetchPrivacySettings();
    }
  }, [visible, activeDetail]);

  useEffect(() => {
    if (activeDetail === 'security_detail') {
      fetchSecurityStatus();
      fetchLoginSessions();
    }
  }, [activeDetail]);

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

  const fetchSecurityStatus = async () => {
    try {
      setLoadingSecurity(true);
      const res = await authService.getSecurityStatus();
      if (res && res.success && res.data) {
        setSecurityStatus(res.data);
      }
    } catch (err) {
      console.warn('Lỗi tải trạng thái bảo mật:', err);
    } finally {
      setLoadingSecurity(false);
    }
  };

  const fetchLoginSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await authService.getLoginSessions();
      if (res && res.success) {
        setLoginSessions(res.data || []);
      }
    } catch (err) {
      console.warn('Lỗi tải phiên đăng nhập:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleToggleTwoFactor = async (enabled: boolean) => {
    if (enabled) {
      // Khi bật: Sinh OTP giả lập để user xác nhận
      try {
        setOtpStep('pending');
        const res = await authService.generateOtp();
        if (res && res.success) {
          setGeneratedOtp(res.data.otp);
          setOtpStep('confirm');
          showToast('info', `Mã OTP của bạn là: ${res.data.otp} (Demo — hiệu lực 5 phút)`);
        }
      } catch {
        setOtpStep('idle');
        showToast('error', 'Không thể tạo OTP. Vui lòng thử lại.');
      }
    } else {
      // Khi tắt: Tắt ngay
      try {
        setUpdatingTwoFactor(true);
        const res = await authService.toggleTwoFactor(false);
        if (res.success) {
          setSecurityStatus((prev) => prev ? { ...prev, two_factor_enabled: false } : prev);
          showToast('success', res.message);
        }
      } catch (err: any) {
        showToast('error', err.response?.data?.message || 'Không thể tắt 2FA.');
      } finally {
        setUpdatingTwoFactor(false);
      }
    }
  };

  const handleConfirmOtp = async () => {
    if (enteredOtp.trim() !== generatedOtp) {
      showToast('error', 'Mã OTP không đúng. Vui lòng thử lại.');
      return;
    }
    try {
      setUpdatingTwoFactor(true);
      const res = await authService.toggleTwoFactor(true);
      if (res.success) {
        setSecurityStatus((prev) => prev ? { ...prev, two_factor_enabled: true } : prev);
        showToast('success', 'Đã bật xác minh 2 bước! 🔐');
        setOtpStep('idle');
        setEnteredOtp('');
        setGeneratedOtp('');
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Không thể bật 2FA.');
    } finally {
      setUpdatingTwoFactor(false);
    }
  };

  const handleToggleRememberLogin = async (enabled: boolean) => {
    try {
      setUpdatingRememberLogin(true);
      const res = await authService.toggleRememberLogin(enabled);
      if (res.success) {
        setSecurityStatus((prev) => prev ? { ...prev, remember_login: enabled } : prev);
        showToast('success', res.message);
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Không thể cập nhật.');
    } finally {
      setUpdatingRememberLogin(false);
    }
  };

  const handleRevokeSession = async (sessionId: number) => {
    try {
      const res = await authService.revokeSession(sessionId);
      if (res.success) {
        setLoginSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setSecurityStatus((prev) => prev ? { ...prev, active_session_count: Math.max(0, prev.active_session_count - 1) } : prev);
        showToast('success', 'Đã đăng xuất thiết bị này! 📱');
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Không thể đăng xuất thiết bị.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteEmail.trim() || !deletePassword.trim()) {
      showToast('error', 'Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    setDeletingAccount(true);
    try {
      const res = await authService.deleteAccount(deleteEmail.trim(), deletePassword.trim());
      if (res.success) {
        showToast('success', res.message || 'Tài khoản đã bị xóa.');
        setShowDeleteConfirm(false);
        setActiveDetail(null);
        // Đăng xuất
        await useAuthStore.getState().logout();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Không thể xóa tài khoản.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const formatRelativeTime = (dateStr: string): string => {
    return formatRelativeTimeI18n(dateStr, language);
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
          <View style={[styles.detailCard, { backgroundColor: isDark ? '#1A1A2E' : '#F8F7FF' }]}>
            <Text style={[styles.detailTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
              👤 {language === 'vi' ? 'Quản lý tài khoản' : 'Account Management'}
            </Text>

            {/* Segmented Tab Selector */}
            <View style={styles.accountTabsRow}>
              <TouchableOpacity
                style={[
                  styles.accountTabBtn,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB' },
                  accountTab === 'username' && styles.accountTabBtnActive,
                ]}
                onPress={() => setAccountTab('username')}
                activeOpacity={0.7}
              >
                <Text style={[styles.accountTabText, { color: isDark ? C.textMuted : '#6B7280' }, accountTab === 'username' && styles.accountTabTextActive]}>
                  👤 Username
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.accountTabBtn,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB' },
                  accountTab === 'email' && styles.accountTabBtnActive,
                ]}
                onPress={() => setAccountTab('email')}
                activeOpacity={0.7}
              >
                <Text style={[styles.accountTabText, { color: isDark ? C.textMuted : '#6B7280' }, accountTab === 'email' && styles.accountTabTextActive]}>
                  📧 Email
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.accountTabBtn,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB' },
                  accountTab === 'password' && styles.accountTabBtnActive,
                ]}
                onPress={() => setAccountTab('password')}
                activeOpacity={0.7}
              >
                <Text style={[styles.accountTabText, { color: isDark ? C.textMuted : '#6B7280' }, accountTab === 'password' && styles.accountTabTextActive]}>
                  🔑 {language === 'vi' ? 'Mật khẩu' : 'Password'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: CHỈNH SỬA USERNAME */}
            {accountTab === 'username' && (
              <View style={[styles.tabContentBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB', borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E5E7EB' }]}>
                <View style={styles.currentValRow}>
                  <Text style={[styles.currentValLabel, { color: isDark ? C.textMuted : '#6B7280' }]}>
                    {language === 'vi' ? 'Username hiện tại:' : 'Current username:'}
                  </Text>
                  <Text style={[styles.currentValText, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>@{user?.username}</Text>
                </View>

                <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  {language === 'vi' ? 'Nhập username mới:' : 'New username:'}
                </Text>
                <TextInput
                  style={[styles.textInputStyle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#1A1A2E', borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#D1D5DB' }]}
                  placeholder={language === 'vi' ? 'Ví dụ: nam_tran99' : 'e.g. nam_tran99'}
                  placeholderTextColor={C.textMuted}
                  value={editUsername}
                  onChangeText={setEditUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                />
                <Text style={[styles.fieldHint, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {language === 'vi'
                    ? 'Chỉ gồm chữ cái, số và dấu gạch dưới (_), độ dài từ 3 đến 30 ký tự.'
                    : 'Only letters, numbers, and underscores (_), length 3 to 30 chars.'}
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
                    <Text style={styles.submitActionBtnText}>
                      {language === 'vi' ? 'Lưu thay đổi Username' : 'Save Username'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 2: EMAIL ĐĂNG KÝ (CẦN MẬT KHẨU ĐÚNG) */}
            {accountTab === 'email' && (
              <View style={[styles.tabContentBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB', borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E5E7EB' }]}>
                <View style={styles.infoNoticeBadge}>
                  <Text style={styles.infoNoticeText}>
                    {language === 'vi'
                      ? '🔒 Để đổi email đăng ký, bạn phải nhập đúng mật khẩu hiện tại để xác thực an toàn.'
                      : '🔒 To change registered email, enter your current password for security verification.'}
                  </Text>
                </View>

                <View style={styles.currentValRow}>
                  <Text style={[styles.currentValLabel, { color: isDark ? C.textMuted : '#6B7280' }]}>
                    {language === 'vi' ? 'Email hiện tại:' : 'Current email:'}
                  </Text>
                  <Text style={[styles.currentValText, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>{maskEmail(user?.email)}</Text>
                </View>

                <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  {language === 'vi' ? 'Email đăng ký mới:' : 'New email address:'}
                </Text>
                <TextInput
                  style={[styles.textInputStyle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#1A1A2E', borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#D1D5DB' }]}
                  placeholder="name@example.com"
                  placeholderTextColor={C.textMuted}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />

                <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  {language === 'vi' ? 'Mật khẩu hiện tại của bạn:' : 'Current password:'}
                </Text>
                <TextInput
                  style={[styles.textInputStyle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#1A1A2E', borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#D1D5DB' }]}
                  placeholder={language === 'vi' ? 'Nhập mật khẩu hiện tại...' : 'Enter current password...'}
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
                    <Text style={styles.submitActionBtnText}>
                      {language === 'vi' ? 'Xác nhận đổi Email' : 'Confirm Change Email'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 3: ĐỔI MẬT KHẨU (CẦN EMAIL ĐĂNG KÝ ĐÚNG) */}
            {accountTab === 'password' && (
              <View style={[styles.tabContentBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB', borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E5E7EB' }]}>
                <View style={styles.infoNoticeBadge}>
                  <Text style={styles.infoNoticeText}>
                    {language === 'vi'
                      ? '🛡️ Để đổi mật khẩu, bạn phải nhập chính xác địa chỉ email đã đăng ký tài khoản này.'
                      : '🛡️ To change password, enter your registered email address correctly.'}
                  </Text>
                </View>

                <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  {language === 'vi' ? 'Email đăng ký để xác nhận:' : 'Registered email to verify:'}
                </Text>
                <TextInput
                  style={[styles.textInputStyle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#1A1A2E', borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#D1D5DB' }]}
                  placeholder={language === 'vi' ? 'Nhập email đăng ký của bạn...' : 'Enter your registered email...'}
                  placeholderTextColor={C.textMuted}
                  value={registeredEmailForPass}
                  onChangeText={setRegisteredEmailForPass}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />

                <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  {language === 'vi' ? 'Mật khẩu mới (tối thiểu 6 ký tự):' : 'New password (min 6 chars):'}
                </Text>
                <TextInput
                  style={[styles.textInputStyle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#1A1A2E', borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#D1D5DB' }]}
                  placeholder={language === 'vi' ? 'Nhập mật khẩu mới...' : 'Enter new password...'}
                  placeholderTextColor={C.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  {language === 'vi' ? 'Xác nhận mật khẩu mới:' : 'Confirm new password:'}
                </Text>
                <TextInput
                  style={[styles.textInputStyle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#1A1A2E', borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#D1D5DB' }]}
                  placeholder={language === 'vi' ? 'Nhập lại mật khẩu mới...' : 'Re-enter new password...'}
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
                    <Text style={styles.submitActionBtnText}>
                      {language === 'vi' ? 'Xác nhận đổi Mật khẩu' : 'Confirm Change Password'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      case 'privacy_detail':
        return (
          <View style={[styles.detailCard, { backgroundColor: isDark ? '#1A1A2E' : '#F8F7FF' }]}>
            <View style={styles.privacyHeaderRow}>
              <Text style={[styles.detailTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                🔒 {language === 'vi' ? 'Cài đặt quyền riêng tư' : 'Privacy Settings'}
              </Text>
              {loadingPrivacy && <ActivityIndicator size="small" color={C.primary} />}
            </View>
            <Text style={[styles.detailDesc, { color: isDark ? C.textSecondary : '#6B7280' }]}>
              {language === 'vi'
                ? 'Kiểm soát phạm vi hiển thị tài khoản, tính năng đề xuất và cách người lạ có thể tìm kiếm bạn.'
                : 'Control profile visibility, suggestion features, and how strangers can discover your account.'}
            </Text>

            {/* 1. Chế độ tài khoản */}
            <View style={[styles.privacySectionGroup, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB', borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E5E7EB' }]}>
              <Text style={styles.privacySectionTitle}>
                👤 {language === 'vi' ? 'CHẾ ĐỘ TÀI KHOẢN' : 'ACCOUNT PRIVACY MODE'}
              </Text>
              <View style={styles.privacySwitchRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.privacySwitchLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                    {privacySettings.is_private_account
                      ? (language === 'vi' ? '🔒 Tài khoản riêng tư' : '🔒 Private Account')
                      : (language === 'vi' ? '🌐 Tài khoản công khai' : '🌐 Public Account')}
                  </Text>
                  <Text style={[styles.privacySwitchDesc, { color: isDark ? C.textMuted : '#6B7280' }]}>
                    {privacySettings.is_private_account
                      ? (language === 'vi'
                          ? 'Chỉ những người bạn chấp nhận mới xem được bài đăng của bạn. Các bài đăng công khai sẽ không hiển thị cho người lạ trên bảng tin khám phá.'
                          : 'Only accepted friends can see your posts. Your posts will not appear to strangers on the discovery feed.')
                      : (language === 'vi'
                          ? 'Bất kỳ ai cũng có thể xem hồ sơ và các bài viết công khai của bạn trong mục Khám phá.'
                          : 'Anyone can view your profile and public moments on the explore feed.')}
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
            <View style={[styles.privacySectionGroup, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB', borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E5E7EB' }]}>
              <Text style={styles.privacySectionTitle}>
                ✨ {language === 'vi' ? 'ĐỀ XUẤT TÀI KHOẢN' : 'ACCOUNT SUGGESTIONS'}
              </Text>
              <View style={styles.privacySwitchRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.privacySwitchLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                    {language === 'vi' ? 'Gợi ý tài khoản cho người khác' : 'Suggest account to others'}
                  </Text>
                  <Text style={[styles.privacySwitchDesc, { color: isDark ? C.textMuted : '#6B7280' }]}>
                    {language === 'vi'
                      ? 'Cho phép hệ thống đề xuất tài khoản của bạn trong danh sách "Gợi ý kết bạn" cho những người dùng khác.'
                      : 'Allow Masita to suggest your profile to other users in their friend recommendation feed.'}
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
            <View style={[styles.privacySectionGroup, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB', borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E5E7EB' }]}>
              <Text style={styles.privacySectionTitle}>
                🔍 {language === 'vi' ? 'NGƯỜI LẠ TÌM THẤY BẠN' : 'DISCOVERABILITY BY STRANGERS'}
              </Text>
              <Text style={[styles.privacyGroupSubdesc, { color: isDark ? C.textSecondary : '#6B7280' }]}>
                {language === 'vi'
                  ? 'Thiết lập xem người lạ (chưa kết bạn) có thể tìm kiếm ra bạn thông qua các thông tin nào:'
                  : 'Choose how strangers (non-friends) are allowed to find your account:'}
              </Text>

              {/* Tên hiển thị */}
              <View style={styles.privacySwitchRowSub}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.privacySwitchLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                    {language === 'vi' ? 'Bằng Tên hiển thị (Họ và tên)' : 'By Display Name'}
                  </Text>
                  <Text style={[styles.privacySwitchDesc, { color: isDark ? C.textMuted : '#6B7280' }]}>
                    {language === 'vi'
                      ? `Người lạ có thể gõ tên hiển thị (${user?.full_name || 'Họ và tên'}) để tìm thấy tài khoản của bạn.`
                      : `Strangers can type your display name (${user?.full_name || 'Full Name'}) to find you.`}
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
                  <Text style={[styles.privacySwitchLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                    {language === 'vi' ? 'Bằng Tên người dùng (Username)' : 'By Username'}
                  </Text>
                  <Text style={[styles.privacySwitchDesc, { color: isDark ? C.textMuted : '#6B7280' }]}>
                    {language === 'vi'
                      ? `Người lạ có thể gõ username (@${user?.username || 'username'}) để tìm kiếm tài khoản của bạn.`
                      : `Strangers can search your username (@${user?.username || 'username'}).`}
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
                  <Text style={[styles.privacySwitchLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                    {language === 'vi' ? 'Bằng Địa chỉ Email' : 'By Email Address'}
                  </Text>
                  <Text style={[styles.privacySwitchDesc, { color: isDark ? C.textMuted : '#6B7280' }]}>
                    {language === 'vi'
                      ? `Người lạ có thể tìm kiếm bạn bằng địa chỉ email (${maskEmail(user?.email)}).`
                      : `Strangers can search you using email (${maskEmail(user?.email)}).`}
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
          <View style={[styles.detailCard, { backgroundColor: isDark ? '#1A1A2E' : '#F8F7FF' }]}>
            {/* Header */}
            <View style={styles.securityHeader}>
              <Text style={[styles.detailTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                🛡️ {language === 'vi' ? 'Bảo mật & Quyền' : 'Security & Permissions'}
              </Text>
              {loadingSecurity && <ActivityIndicator size="small" color={C.primary} />}
            </View>

            {/* 1. KIỂM TRA BẢO MẬT */}
            <View style={[styles.securityGroup, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB', borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E5E7EB' }]}>
              <Text style={styles.securityGroupTitle}>
                🔎 {language === 'vi' ? 'KIỂM TRA BẢO MẬT' : 'SECURITY CHECK'}
              </Text>
              {securityStatus ? (
                <>
                  <View style={styles.securityCheckRow}>
                    <Text style={styles.securityCheckIcon}>
                      {securityStatus.last_password_changed ? '✅' : '⚠️'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.securityCheckLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                        {language === 'vi' ? 'Mật khẩu' : 'Password'}
                      </Text>
                      <Text style={[styles.securityCheckValue, { color: isDark ? C.textMuted : '#6B7280' }]}>
                        {securityStatus.last_password_changed
                          ? (language === 'vi' ? `Đã đổi ${formatRelativeTime(securityStatus.last_password_changed)}` : `Changed ${formatRelativeTime(securityStatus.last_password_changed)}`)
                          : (language === 'vi' ? 'Chưa đổi mật khẩu lần nào' : 'Password never changed')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.securityCheckRow}>
                    <Text style={styles.securityCheckIcon}>✅</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.securityCheckLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                        {language === 'vi' ? 'Trạng thái tài khoản' : 'Account Status'}
                      </Text>
                      <Text style={[styles.securityCheckValue, { color: isDark ? C.textMuted : '#6B7280' }]}>
                        {language === 'vi' ? 'Hoạt động bình thường' : 'Normal / Good Standing'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.securityCheckRow}>
                    <Text style={styles.securityCheckIcon}>📅</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.securityCheckLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                        {language === 'vi' ? 'Ngày tạo tài khoản' : 'Account Created'}
                      </Text>
                      <Text style={[styles.securityCheckValue, { color: isDark ? C.textMuted : '#6B7280' }]}>
                        {new Date(securityStatus.created_at).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.securityCheckRow}>
                    <Text style={styles.securityCheckIcon}>📱</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.securityCheckLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                        {language === 'vi' ? 'Phiên đang hoạt động' : 'Active Sessions'}
                      </Text>
                      <Text style={[styles.securityCheckValue, { color: isDark ? C.textMuted : '#6B7280' }]}>
                        {securityStatus.active_session_count} {language === 'vi' ? 'thiết bị' : 'devices'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.securityActionCard}
                    onPress={() => {
                      setAccountTab('password');
                      setActiveDetail('account_detail');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.securityItemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                        🔑 {language === 'vi' ? 'Đổi mật khẩu tài khoản' : 'Change account password'}
                      </Text>
                      <Text style={[styles.securityItemDesc, { color: isDark ? C.textMuted : '#6B7280' }]}>
                        {language === 'vi' ? 'Đổi mật khẩu với xác thực email đăng ký.' : 'Change password with email verification.'}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.securityLoadingBox}>
                  <ActivityIndicator size="small" color={C.primary} />
                  <Text style={[styles.securityLoadingText, { color: isDark ? C.textMuted : '#6B7280' }]}>
                    {language === 'vi' ? 'Đang tải thông tin bảo mật...' : 'Loading security status...'}
                  </Text>
                </View>
              )}
            </View>

            {/* 2. THIẾT BỊ & PHIÊN ĐĂNG NHẬP */}
            <View style={[styles.securityGroup, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB', borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E5E7EB' }]}>
              <View style={styles.securityGroupHeader}>
                <Text style={styles.securityGroupTitle}>
                  📱 {language === 'vi' ? 'THIẾT BỊ & PHIÊN ĐĂNG NHẬP' : 'DEVICES & SESSIONS'}
                </Text>
                {loadingSessions && <ActivityIndicator size="small" color={C.primary} />}
              </View>
              {loginSessions.length === 0 ? (
                <Text style={[styles.securityEmptyText, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {loadingSessions
                    ? (language === 'vi' ? 'Đang tải...' : 'Loading...')
                    : (language === 'vi' ? 'Chưa có phiên đăng nhập nào được ghi lại.' : 'No sessions recorded.')}
                </Text>
              ) : (
                loginSessions.map((session) => (
                  <View key={session.id} style={styles.sessionCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sessionDeviceName, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                        {session.device_name}
                      </Text>
                      <Text style={[styles.sessionMeta, { color: isDark ? C.textMuted : '#6B7280' }]}>
                        {session.ip_address ? `IP: ${session.ip_address} · ` : ''}
                        {formatRelativeTime(session.last_active)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.sessionRevokeBtn}
                      onPress={() => handleRevokeSession(session.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.sessionRevokeBtnText}>
                        {language === 'vi' ? 'Đăng xuất' : 'Revoke'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* 3. BẢO MẬT ĐĂNG NHẬP (2FA + Remember Me) */}
            <View style={[styles.securityGroup, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB', borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E5E7EB' }]}>
              <Text style={styles.securityGroupTitle}>
                🔐 {language === 'vi' ? 'BẢO MẬT ĐĂNG NHẬP' : 'LOGIN SECURITY'}
              </Text>

              {/* Xác minh 2 bước */}
              <View style={styles.privacySwitchRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.privacySwitchLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                    {securityStatus?.two_factor_enabled
                      ? (language === 'vi' ? '🔐 Xác minh 2 bước: Bật' : '🔐 2-Step Verification: ON')
                      : (language === 'vi' ? '🔓 Xác minh 2 bước: Tắt' : '🔓 2-Step Verification: OFF')}
                  </Text>
                  <Text style={[styles.privacySwitchDesc, { color: isDark ? C.textMuted : '#6B7280' }]}>
                    {language === 'vi'
                      ? 'Khi bật, bạn cần nhập mã OTP (gửi qua email) mỗi lần đăng nhập mới.'
                      : 'When enabled, an OTP code is required via email for every new login.'}
                  </Text>
                </View>
                <Switch
                  value={securityStatus?.two_factor_enabled ?? false}
                  onValueChange={handleToggleTwoFactor}
                  trackColor={{ false: '#2D3748', true: C.primary }}
                  thumbColor="#FFFFFF"
                  disabled={updatingTwoFactor || otpStep !== 'idle'}
                />
              </View>

              {/* OTP Confirm step */}
              {otpStep === 'confirm' && (
                <View style={styles.otpBox}>
                  <Text style={[styles.otpTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                    🔢 {language === 'vi' ? 'Nhập mã OTP để xác nhận' : 'Enter OTP to confirm'}
                  </Text>
                  <Text style={[styles.otpHint, { color: isDark ? C.textSecondary : '#6B7280' }]}>
                    📩 {language === 'vi' ? 'Mã OTP (Demo): ' : 'Demo OTP Code: '}
                    <Text style={styles.otpCode}>{generatedOtp}</Text>
                  </Text>
                  <TextInput
                    style={[styles.textInputStyle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#1A1A2E', borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#D1D5DB' }]}
                    placeholder={language === 'vi' ? 'Nhập mã OTP 6 số...' : 'Enter 6-digit OTP...'}
                    placeholderTextColor={C.textMuted}
                    value={enteredOtp}
                    onChangeText={setEnteredOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <View style={styles.otpBtnRow}>
                    <TouchableOpacity
                      style={[styles.otpBtn, styles.otpBtnCancel]}
                      onPress={() => { setOtpStep('idle'); setEnteredOtp(''); setGeneratedOtp(''); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.otpBtnCancelText, { color: isDark ? C.textSecondary : '#6B7280' }]}>
                        {language === 'vi' ? 'Hủy' : 'Cancel'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.otpBtn, styles.otpBtnConfirm, updatingTwoFactor && styles.submitActionBtnDisabled]}
                      onPress={handleConfirmOtp}
                      disabled={updatingTwoFactor}
                      activeOpacity={0.8}
                    >
                      {updatingTwoFactor
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Text style={styles.otpBtnConfirmText}>
                            {language === 'vi' ? 'Xác nhận' : 'Confirm'}
                          </Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]} />

              {/* Lưu thông tin đăng nhập */}
              <View style={styles.privacySwitchRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.privacySwitchLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                    💾 {language === 'vi' ? 'Lưu thông tin đăng nhập' : 'Remember Login Info'}
                  </Text>
                  <Text style={[styles.privacySwitchDesc, { color: isDark ? C.textMuted : '#6B7280' }]}>
                    {language === 'vi'
                      ? 'Giữ phiên đăng nhập lâu hơn. Tắt để đăng xuất tự động sau khi đóng ứng dụng.'
                      : 'Stay signed in longer on this device. Disable to logout when app closes.'}
                  </Text>
                </View>
                <Switch
                  value={securityStatus?.remember_login ?? true}
                  onValueChange={handleToggleRememberLogin}
                  trackColor={{ false: '#2D3748', true: C.primary }}
                  thumbColor="#FFFFFF"
                  disabled={updatingRememberLogin}
                />
              </View>
            </View>

            {/* 4. XÓA TÀI KHOẢN */}
            <View style={[styles.securityGroup, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB', borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#E5E7EB' }]}>
              <Text style={styles.securityGroupTitle}>
                ⚠️ {language === 'vi' ? 'VÙNG NGUY HIỂM' : 'DANGER ZONE'}
              </Text>
              {!showDeleteConfirm ? (
                <TouchableOpacity
                  style={styles.deleteAccountBtn}
                  onPress={() => setShowDeleteConfirm(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteAccountBtnText}>
                    🗑️ {language === 'vi' ? 'Xóa tài khoản vĩnh viễn' : 'Delete Account Permanently'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.deleteConfirmBox}>
                  <Text style={styles.deleteConfirmTitle}>
                    ⚠️ {language === 'vi' ? 'Xác nhận xóa tài khoản' : 'Confirm Delete Account'}
                  </Text>
                  <Text style={[styles.deleteConfirmDesc, { color: isDark ? C.textSecondary : '#6B7280' }]}>
                    {language === 'vi'
                      ? 'Hành động này không thể hoàn tác. Tài khoản và toàn bộ dữ liệu sẽ bị xóa vĩnh viễn. Vui lòng nhập email và mật khẩu để xác nhận.'
                      : 'This action cannot be undone. Your account and all data will be permanently deleted. Please enter your email and password to confirm.'}
                  </Text>
                  <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                    {language === 'vi' ? 'Email đăng ký:' : 'Registered email:'}
                  </Text>
                  <TextInput
                    style={[styles.textInputStyle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#1A1A2E', borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#D1D5DB' }]}
                    placeholder={language === 'vi' ? 'Nhập email của bạn...' : 'Enter your email...'}
                    placeholderTextColor={C.textMuted}
                    value={deleteEmail}
                    onChangeText={setDeleteEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                  <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                    {language === 'vi' ? 'Mật khẩu xác nhận:' : 'Confirm password:'}
                  </Text>
                  <TextInput
                    style={[styles.textInputStyle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF', color: isDark ? '#FFFFFF' : '#1A1A2E', borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#D1D5DB' }]}
                    placeholder={language === 'vi' ? 'Nhập mật khẩu của bạn...' : 'Enter your password...'}
                    placeholderTextColor={C.textMuted}
                    value={deletePassword}
                    onChangeText={setDeletePassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <View style={styles.otpBtnRow}>
                    <TouchableOpacity
                      style={[styles.otpBtn, styles.otpBtnCancel]}
                      onPress={() => { setShowDeleteConfirm(false); setDeleteEmail(''); setDeletePassword(''); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.otpBtnCancelText, { color: isDark ? C.textSecondary : '#6B7280' }]}>
                        {language === 'vi' ? 'Hủy' : 'Cancel'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.deleteConfirmActionBtn, deletingAccount && styles.submitActionBtnDisabled]}
                      onPress={handleDeleteAccount}
                      disabled={deletingAccount}
                      activeOpacity={0.8}
                    >
                      {deletingAccount
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Text style={styles.deleteAccountBtnText}>
                            {language === 'vi' ? 'Xóa tài khoản' : 'Delete Account'}
                          </Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        );

      case 'accessibility_detail':
        return (
          <View style={[styles.detailCard, { backgroundColor: isDark ? '#1A1A2E' : '#F8F7FF' }]}>
            <Text style={[styles.detailTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>♿ {t('accessibility')}</Text>
            <Text style={[styles.detailDesc, { color: isDark ? C.textSecondary : '#6B7280' }]}>
              {language === 'vi'
                ? 'Điều chỉnh các cài đặt giúp trải nghiệm ứng dụng tốt hơn.'
                : 'Adjust settings to improve your app experience.'}
            </Text>

            {/* Độ tương phản cao */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  🎨 {t('high_contrast')}
                </Text>
                <Text style={[styles.switchSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {t('high_contrast_desc')}
                </Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={async (val) => {
                  await setHighContrast(val);
                  showToast('success', val
                    ? (language === 'vi' ? 'Đã bật độ tương phản cao ✨' : 'High contrast enabled ✨')
                    : (language === 'vi' ? 'Đã tắt độ tương phản cao' : 'High contrast disabled'));
                }}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.separator} />

            {/* Giảm hiệu ứng chuyển động */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  ⚡ {t('reduce_motion')}
                </Text>
                <Text style={[styles.switchSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {t('reduce_motion_desc')}
                </Text>
              </View>
              <Switch
                value={reduceMotion}
                onValueChange={async (val) => {
                  await setReduceMotion(val);
                  showToast('success', val
                    ? (language === 'vi' ? 'Đã bật giảm hiệu ứng chuyển động' : 'Reduce motion enabled')
                    : (language === 'vi' ? 'Đã tắt giảm hiệu ứng chuyển động' : 'Reduce motion disabled'));
                }}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.separator} />

            {/* Chữ lớn */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  🔤 {t('large_text')}
                </Text>
                <Text style={[styles.switchSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {t('large_text_desc')}
                </Text>
              </View>
              <Switch
                value={largeText}
                onValueChange={async (val) => {
                  await setLargeText(val);
                  showToast('success', val
                    ? (language === 'vi' ? 'Đã bật chữ lớn. Khởi động lại app để áp dụng.' : 'Large text enabled. Restart app to apply.')
                    : (language === 'vi' ? 'Đã tắt chữ lớn.' : 'Large text disabled.'));
                }}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Preview */}
            <View style={[styles.accessibilityPreview, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }]}>
              <Text style={[
                styles.accessibilityPreviewLabel,
                { color: isDark ? C.textMuted : '#9CA3AF' }
              ]}>
                {language === 'vi' ? 'Xem trước cỡ chữ:' : 'Text size preview:'}
              </Text>
              <Text style={[
                styles.accessibilityPreviewText,
                {
                  color: isDark ? '#FFFFFF' : '#1A1A2E',
                  fontSize: largeText ? 18 : 15,
                  fontWeight: highContrast ? '700' : '400',
                }
              ]}>
                {language === 'vi'
                  ? 'Masita — Kết nối khoảnh khắc cuộc sống'
                  : 'Masita — Connect life moments'}
              </Text>
            </View>
          </View>
        );

      case 'notify_detail':
        return (
          <View style={[styles.detailCard, { backgroundColor: isDark ? '#1A1A2E' : '#F8F7FF' }]}>
            <Text style={[styles.detailTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
              🔔 {t('notifications')}
            </Text>
            <Text style={[styles.detailDesc, { color: isDark ? C.textSecondary : '#6B7280' }]}>
              {language === 'vi'
                ? 'Quản lý các loại thông báo bạn muốn nhận.'
                : 'Manage which notifications you want to receive.'}
            </Text>

            {/* Tin nhắn mới */}
            <View style={[styles.notifyRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB' }]}>
              <View style={styles.notifyIconBox}>
                <Text style={styles.notifyIcon}>💬</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifyLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  {t('notify_messages')}
                </Text>
                <Text style={[styles.notifyDesc, { color: isDark ? C.textMuted : '#9CA3AF' }]}>
                  {t('notify_messages_desc')}
                </Text>
              </View>
              <Switch
                value={notifyMessages}
                onValueChange={async (val) => {
                  await setNotifyMessages(val);
                  showToast(val ? 'success' : 'info', val
                    ? (language === 'vi' ? '✅ Đã bật thông báo tin nhắn' : '✅ Message notifications on')
                    : (language === 'vi' ? 'Đã tắt thông báo tin nhắn' : 'Message notifications off'));
                }}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Bài viết mới */}
            <View style={[styles.notifyRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB' }]}>
              <View style={styles.notifyIconBox}>
                <Text style={styles.notifyIcon}>📸</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifyLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  {t('notify_posts')}
                </Text>
                <Text style={[styles.notifyDesc, { color: isDark ? C.textMuted : '#9CA3AF' }]}>
                  {t('notify_posts_desc')}
                </Text>
              </View>
              <Switch
                value={notifyPosts}
                onValueChange={async (val) => {
                  await setNotifyPosts(val);
                  showToast(val ? 'success' : 'info', val
                    ? (language === 'vi' ? '✅ Đã bật thông báo bài viết' : '✅ Post notifications on')
                    : (language === 'vi' ? 'Đã tắt thông báo bài viết' : 'Post notifications off'));
                }}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Tương tác */}
            <View style={[styles.notifyRow, { borderBottomColor: 'transparent' }]}>
              <View style={styles.notifyIconBox}>
                <Text style={styles.notifyIcon}>❤️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifyLabel, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  {t('notify_interactions')}
                </Text>
                <Text style={[styles.notifyDesc, { color: isDark ? C.textMuted : '#9CA3AF' }]}>
                  {t('notify_interactions_desc')}
                </Text>
              </View>
              <Switch
                value={notifyInteractions}
                onValueChange={async (val) => {
                  await setNotifyInteractions(val);
                  showToast(val ? 'success' : 'info', val
                    ? (language === 'vi' ? '✅ Đã bật thông báo tương tác' : '✅ Interaction notifications on')
                    : (language === 'vi' ? 'Đã tắt thông báo tương tác' : 'Interaction notifications off'));
                }}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Tắt tất cả */}
            <TouchableOpacity
              style={[styles.notifyAllOffBtn, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
              }]}
              onPress={async () => {
                const allOn = notifyMessages && notifyPosts && notifyInteractions;
                await setNotifyMessages(!allOn);
                await setNotifyPosts(!allOn);
                await setNotifyInteractions(!allOn);
                showToast(!allOn ? 'success' : 'info', !allOn
                  ? (language === 'vi' ? '✅ Đã bật tất cả thông báo' : '✅ All notifications on')
                  : (language === 'vi' ? 'Đã tắt tất cả thông báo' : 'All notifications off'));
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.notifyAllOffBtnText, { color: isDark ? C.primaryLight : C.primary }]}>
                {notifyMessages && notifyPosts && notifyInteractions
                  ? (language === 'vi' ? '🔕 Tắt tất cả thông báo' : '🔕 Turn off all notifications')
                  : (language === 'vi' ? '🔔 Bật tất cả thông báo' : '🔔 Turn on all notifications')}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'language_detail':
        return (
          <View style={[styles.detailCard, { backgroundColor: isDark ? '#1A1A2E' : '#F8F7FF' }]}>
            <Text style={[styles.detailTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
              🌐 {t('language')}
            </Text>
            <Text style={[styles.detailDesc, { color: isDark ? C.textSecondary : '#6B7280' }]}>
              {language === 'vi'
                ? 'Chọn ngôn ngữ hiển thị cho toàn bộ ứng dụng.'
                : 'Select the display language for the entire app.'}
            </Text>

            {/* Tiếng Việt */}
            <TouchableOpacity
              style={[styles.langOption, {
                backgroundColor: language === 'vi'
                  ? `${C.primary}18`
                  : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
                borderColor: language === 'vi' ? C.primary : (isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB'),
              }]}
              onPress={async () => {
                await setLanguage('vi');
                showToast('success', '✅ Đã chọn Tiếng Việt 🇻🇳');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.langOptionFlag}>🇻🇳</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.langOptionName, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  Tiếng Việt
                </Text>
                <Text style={[styles.langOptionDesc, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  Vietnamese
                </Text>
              </View>
              {language === 'vi' && (
                <View style={[styles.langOptionCheck, { backgroundColor: C.primary }]}>
                  <Text style={styles.langOptionCheckText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* English */}
            <TouchableOpacity
              style={[styles.langOption, {
                backgroundColor: language === 'en'
                  ? `${C.primary}18`
                  : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
                borderColor: language === 'en' ? C.primary : (isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB'),
              }]}
              onPress={async () => {
                await setLanguage('en');
                showToast('success', '✅ English selected 🇺🇸');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.langOptionFlag}>🇺🇸</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.langOptionName, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                  English
                </Text>
                <Text style={[styles.langOptionDesc, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  English (United States)
                </Text>
              </View>
              {language === 'en' && (
                <View style={[styles.langOptionCheck, { backgroundColor: C.primary }]}>
                  <Text style={styles.langOptionCheckText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        );

      case 'help_center':
        return (
          <View style={[styles.detailCard, { backgroundColor: isDark ? '#1A1A2E' : '#F8F7FF' }]}>
            <Text style={[styles.detailTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
              ❓ {language === 'vi' ? 'Trung tâm trợ giúp' : 'Help Center'}
            </Text>

            {/* ─── Tab bar ─────────────────────────────── */}
            <View style={{
              flexDirection: 'row',
              borderRadius: 12,
              backgroundColor: isDark ? '#0E0E1F' : '#EBEBF0',
              padding: 4,
              marginBottom: 18,
            }}>
              {(['faq', 'submit', 'history'] as const).map((tab) => {
                const isActive = helpTab === tab;
                const labels: Record<string, { vi: string; en: string }> = {
                  faq: { vi: '❓ FAQ', en: '❓ FAQ' },
                  submit: { vi: '✉️ Gửi', en: '✉️ Send' },
                  history: { vi: '📋 Lịch sử', en: '📋 History' },
                };
                return (
                  <TouchableOpacity
                    key={tab}
                    activeOpacity={0.7}
                    onPress={() => {
                      setHelpTab(tab);
                      if (tab === 'history') fetchMyTickets();
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 9,
                      alignItems: 'center',
                      backgroundColor: isActive ? (isDark ? '#6C63FF' : C.primary) : 'transparent',
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontFamily: isActive ? 'Inter_700Bold' : 'Inter_400Regular',
                      color: isActive ? '#FFF' : (isDark ? C.textMuted : '#6B7280'),
                    }}>
                      {language === 'vi' ? labels[tab].vi : labels[tab].en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ─── TAB: FAQ ─────────────────────────────── */}
            {helpTab === 'faq' && (
              <View>
                {[
                  {
                    q: language === 'vi' ? '1. Làm sao để chia sẻ khoảnh khắc với bạn bè?' : '1. How do I share moments with friends?',
                    a: language === 'vi'
                      ? 'Nhấn nút dấu (+) trên thanh điều hướng để chụp ảnh hoặc chọn ảnh đăng tải.'
                      : 'Tap the (+) button on the navigation bar to take a photo or select an image to post.',
                  },
                  {
                    q: language === 'vi' ? '2. Làm sao để kết bạn mới?' : '2. How do I make new friends?',
                    a: language === 'vi'
                      ? 'Vào tab Bạn bè, xem mục Gợi ý kết bạn hoặc sử dụng thanh tìm kiếm để kết nối.'
                      : 'Go to Friends tab, view Friend Suggestions or use the search bar to connect.',
                  },
                  {
                    q: language === 'vi' ? '3. Làm sao để đổi ảnh nền cuộc trò chuyện?' : '3. How do I change the chat background?',
                    a: language === 'vi'
                      ? 'Vào phòng chat, nhấn nút bánh răng cài đặt và chọn "Đổi chủ đề chat".'
                      : 'Open a chat room, tap the settings gear and choose "Change chat theme".',
                  },
                  {
                    q: language === 'vi' ? '4. Làm sao để báo cáo tài khoản vi phạm?' : '4. How do I report a violating account?',
                    a: language === 'vi'
                      ? 'Vào trang cá nhân của người đó, nhấn biểu tượng 3 chấm (...) và chọn "Báo cáo".'
                      : "Go to that person's profile, tap the 3-dot menu (...) and select \"Report\".",
                  },
                  {
                    q: language === 'vi' ? '5. Thắc mắc không có trong FAQ?' : '5. Question not in FAQ?',
                    a: language === 'vi'
                      ? 'Chuyển sang tab "✉️ Gửi" để gửi trực tiếp câu hỏi tới Admin/Nhân viên. Chúng tôi sẽ phản hồi sớm nhất!'
                      : 'Switch to the "✉️ Send" tab to send your question directly to Admin/Staff. We will reply as soon as possible!',
                  },
                ].map((item, i) => (
                  <View key={i} style={styles.faqItem}>
                    <Text style={[styles.faqQ, { color: isDark ? C.primaryLight : C.primary }]}>{item.q}</Text>
                    <Text style={[styles.faqA, { color: isDark ? C.textSecondary : '#4B5563' }]}>{item.a}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ─── TAB: SUBMIT TICKET ───────────────────── */}
            {helpTab === 'submit' && (
              <View>
                {ticketSubmitted ? (
                  <View style={{
                    alignItems: 'center',
                    paddingVertical: 30,
                    gap: 10,
                  }}>
                    <Text style={{ fontSize: 48 }}>✅</Text>
                    <Text style={{
                      fontSize: 16,
                      fontFamily: 'Inter_700Bold',
                      color: '#10B981',
                      textAlign: 'center',
                    }}>
                      {language === 'vi' ? 'Đã gửi thành công!' : 'Submitted successfully!'}
                    </Text>
                    <Text style={{
                      fontSize: 13,
                      fontFamily: 'Inter_400Regular',
                      color: isDark ? C.textSecondary : '#6B7280',
                      textAlign: 'center',
                      lineHeight: 20,
                    }}>
                      {language === 'vi'
                        ? 'Admin/Nhân viên sẽ giải đáp và bạn sẽ nhận thông báo khi có phản hồi.'
                        : 'Admin/Staff will reply and you will receive a notification when answered.'}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => { setTicketSubmitted(false); setHelpTab('history'); fetchMyTickets(); }}
                      style={{
                        marginTop: 8,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: isDark ? '#6C63FF20' : `${C.primary}15`,
                        borderWidth: 1,
                        borderColor: isDark ? '#6C63FF60' : `${C.primary}50`,
                      }}
                    >
                      <Text style={{ color: isDark ? '#6C63FF' : C.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                        {language === 'vi' ? '📋 Xem lịch sử thắc mắc' : '📋 View ticket history'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <Text style={[styles.detailDesc, { color: isDark ? C.textSecondary : '#6B7280', marginBottom: 4 }]}>
                      {language === 'vi'
                        ? 'Gửi câu hỏi hoặc báo cáo sự cố trực tiếp tới đội ngũ Admin/Nhân viên.'
                        : 'Send your question or report an issue directly to our Admin/Staff team.'}
                    </Text>

                    {/* Category picker */}
                    <Text style={[{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: isDark ? C.textMuted : '#6B7280', marginBottom: 2 }]}>
                      {language === 'vi' ? 'DANH MỤC' : 'CATEGORY'}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {[
                        { key: 'general', labelVi: '💬 Chung', labelEn: '💬 General' },
                        { key: 'account', labelVi: '👤 Tài khoản', labelEn: '👤 Account' },
                        { key: 'bug', labelVi: '🐛 Báo lỗi', labelEn: '🐛 Report Bug' },
                        { key: 'content', labelVi: '📝 Nội dung', labelEn: '📝 Content' },
                        { key: 'other', labelVi: '📌 Khác', labelEn: '📌 Other' },
                      ].map((cat) => (
                        <TouchableOpacity
                          key={cat.key}
                          activeOpacity={0.7}
                          onPress={() => setTicketCategory(cat.key)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: ticketCategory === cat.key ? C.primary : (isDark ? '#2E2E48' : '#D1D5DB'),
                            backgroundColor: ticketCategory === cat.key
                              ? (isDark ? `${C.primary}30` : `${C.primary}15`)
                              : (isDark ? '#131224' : '#FFFFFF'),
                          }}
                        >
                          <Text style={{
                            fontSize: 12,
                            fontFamily: ticketCategory === cat.key ? 'Inter_600SemiBold' : 'Inter_400Regular',
                            color: ticketCategory === cat.key ? C.primary : (isDark ? C.textSecondary : '#6B7280'),
                          }}>
                            {language === 'vi' ? cat.labelVi : cat.labelEn}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Subject */}
                    <Text style={[{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: isDark ? C.textMuted : '#6B7280', marginTop: 4, marginBottom: 2 }]}>
                      {language === 'vi' ? 'TIÊU ĐỀ *' : 'SUBJECT *'}
                    </Text>
                    <TextInput
                      value={ticketSubject}
                      onChangeText={setTicketSubject}
                      placeholder={language === 'vi' ? 'Nhập tiêu đề ngắn gọn...' : 'Enter a brief subject...'}
                      placeholderTextColor={isDark ? C.textMuted : '#9CA3AF'}
                      style={{
                        borderWidth: 1,
                        borderColor: isDark ? '#2E2E48' : '#D1D5DB',
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontFamily: 'Inter_400Regular',
                        color: isDark ? '#FFFFFF' : '#1A1A2E',
                        backgroundColor: isDark ? '#131224' : '#FFFFFF',
                      }}
                    />

                    {/* Message */}
                    <Text style={[{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: isDark ? C.textMuted : '#6B7280', marginTop: 4, marginBottom: 2 }]}>
                      {language === 'vi' ? 'NỘI DUNG CHI TIẾT *' : 'DETAILS *'}
                    </Text>
                    <TextInput
                      value={ticketMessage}
                      onChangeText={setTicketMessage}
                      placeholder={language === 'vi' ? 'Mô tả chi tiết thắc mắc hoặc sự cố bạn gặp phải...' : 'Describe your question or issue in detail...'}
                      placeholderTextColor={isDark ? C.textMuted : '#9CA3AF'}
                      multiline
                      numberOfLines={5}
                      textAlignVertical="top"
                      style={{
                        borderWidth: 1,
                        borderColor: isDark ? '#2E2E48' : '#D1D5DB',
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        fontFamily: 'Inter_400Regular',
                        color: isDark ? '#FFFFFF' : '#1A1A2E',
                        backgroundColor: isDark ? '#131224' : '#FFFFFF',
                        minHeight: 110,
                      }}
                    />

                    {/* Submit button */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleSubmitTicket}
                      disabled={submittingTicket}
                      style={{
                        paddingVertical: 13,
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor: C.primary,
                        opacity: submittingTicket ? 0.6 : 1,
                        marginTop: 4,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      {submittingTicket
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: '#FFF' }}>
                            {language === 'vi' ? '✉️ Gửi thắc mắc' : '✉️ Send Question'}
                          </Text>
                      }
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ─── TAB: TICKET HISTORY ─────────────────── */}
            {helpTab === 'history' && (
              <View>
                {loadingTickets ? (
                  <ActivityIndicator size="large" color={C.primary} style={{ marginVertical: 30 }} />
                ) : myTickets.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 30, gap: 8 }}>
                    <Text style={{ fontSize: 36 }}>📭</Text>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Inter_600SemiBold',
                      color: isDark ? C.textSecondary : '#6B7280',
                      textAlign: 'center',
                    }}>
                      {language === 'vi' ? 'Chưa có thắc mắc nào' : 'No tickets yet'}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      fontFamily: 'Inter_400Regular',
                      color: isDark ? C.textMuted : '#9CA3AF',
                      textAlign: 'center',
                    }}>
                      {language === 'vi' ? 'Gửi câu hỏi đầu tiên của bạn trong tab "✉️ Gửi".' : 'Send your first question in the "✉️ Send" tab.'}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setHelpTab('submit')}
                      style={{
                        marginTop: 8,
                        paddingHorizontal: 18,
                        paddingVertical: 9,
                        borderRadius: 10,
                        backgroundColor: isDark ? `${C.primary}20` : `${C.primary}15`,
                        borderWidth: 1,
                        borderColor: isDark ? `${C.primary}50` : `${C.primary}40`,
                      }}
                    >
                      <Text style={{ color: C.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                        {language === 'vi' ? '✉️ Gửi thắc mắc đầu tiên' : '✉️ Send First Question'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {myTickets.map((ticket) => {
                      const isAnswered = ticket.status === 'answered';
                      const statusColor = isAnswered ? '#10B981' : '#F59E0B';
                      const statusLabel = language === 'vi'
                        ? (isAnswered ? '✓ Đã được giải đáp' : '⏳ Đang chờ giải đáp')
                        : (isAnswered ? '✓ Answered' : '⏳ Pending');
                      return (
                        <View
                          key={ticket.id}
                          style={{
                            backgroundColor: isDark ? '#131224' : '#FFFFFF',
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: isAnswered
                              ? (isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)')
                              : (isDark ? '#2E2E48' : '#E5E7EB'),
                            padding: 14,
                            gap: 8,
                          }}
                        >
                          {/* Header row */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Text style={{
                              flex: 1,
                              fontSize: 14,
                              fontFamily: 'Inter_600SemiBold',
                              color: isDark ? '#FFFFFF' : '#1A1A2E',
                              marginRight: 8,
                            }} numberOfLines={2}>
                              {ticket.subject}
                            </Text>
                            <View style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 20,
                              backgroundColor: `${statusColor}20`,
                              borderWidth: 1,
                              borderColor: `${statusColor}40`,
                            }}>
                              <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: statusColor }}>
                                {statusLabel}
                              </Text>
                            </View>
                          </View>

                          {/* User message */}
                          <Text style={{
                            fontSize: 13,
                            fontFamily: 'Inter_400Regular',
                            color: isDark ? C.textSecondary : '#4B5563',
                            lineHeight: 19,
                          }} numberOfLines={3}>
                            {ticket.message}
                          </Text>

                          {/* Staff reply */}
                          {ticket.staff_reply && (
                            <View style={{
                              backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)',
                              borderRadius: 10,
                              padding: 12,
                              borderLeftWidth: 3,
                              borderLeftColor: '#10B981',
                              gap: 6,
                            }}>
                              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#10B981' }}>
                                {ticket.responder_name
                                  ? `${ticket.responder_role === 'admin' ? '👑 Admin' : '🛡️ Nhân viên'} — ${ticket.responder_name}`
                                  : (language === 'vi' ? '👑 Ban Quản Trị' : '👑 Admin Team')
                                }
                              </Text>
                              <Text style={{
                                fontSize: 13,
                                fontFamily: 'Inter_400Regular',
                                color: isDark ? '#D1FAE5' : '#065F46',
                                lineHeight: 19,
                              }}>
                                {ticket.staff_reply}
                              </Text>
                            </View>
                          )}

                          {/* Date */}
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: isDark ? C.textMuted : '#9CA3AF' }}>
                            {language === 'vi' ? 'Gửi lúc: ' : 'Sent: '}
                            {new Date(ticket.created_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                          </Text>
                        </View>
                      );
                    })}

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={fetchMyTickets}
                      style={{
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isDark ? '#2E2E48' : '#D1D5DB',
                        marginTop: 4,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: isDark ? C.textSecondary : '#6B7280' }}>
                        🔄 {language === 'vi' ? 'Tải lại' : 'Refresh'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        );

      case 'privacy_center':
        return (
          <View style={[styles.detailCard, { backgroundColor: isDark ? '#1A1A2E' : '#F8F7FF' }]}>
            <Text style={[styles.detailTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
              🛡️ {t('privacy_center')}
            </Text>
            <Text style={[styles.detailDesc, { color: isDark ? C.textSecondary : '#6B7280' }]}>
              {language === 'vi'
                ? 'Masita cam kết bảo vệ dữ liệu cá nhân của bạn với các tiêu chuẩn an toàn cao nhất:'
                : 'Masita is committed to protecting your personal data with the highest security standards:'}
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? C.textSecondary : '#4B5563' }]}>
              {language === 'vi' ? '• Tin nhắn cá nhân được mã hóa và chỉ lưu trữ bảo mật.' : '• Personal messages are encrypted and securely stored.'}
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? C.textSecondary : '#4B5563' }]}>
              {language === 'vi' ? '• Hình ảnh và khoảnh khắc riêng tư không bao giờ được chia sẻ ra ngoài.' : '• Private photos and moments are never shared externally.'}
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? C.textSecondary : '#4B5563' }]}>
              {language === 'vi' ? '• Bạn hoàn toàn kiểm soát ai có thể xem bài viết và gửi tin nhắn cho bạn.' : '• You have full control over who can view your posts and send you messages.'}
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? C.textSecondary : '#4B5563' }]}>
              {language === 'vi' ? '• Bạn có quyền xóa vĩnh viễn bài đăng hoặc tài khoản bất cứ lúc nào.' : '• You have the right to permanently delete posts or your account at any time.'}
            </Text>
          </View>
        );

      case 'terms_policies':
        return (
          <View style={[styles.detailCard, { backgroundColor: isDark ? '#1A1A2E' : '#F8F7FF' }]}>
            <Text style={[styles.detailTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
              📜 {t('terms')}
            </Text>
            <Text style={[styles.detailDesc, { color: isDark ? C.textSecondary : '#6B7280' }]}>
              {language === 'vi'
                ? 'Các quy định khi tham gia cộng đồng mạng xã hội Masita:'
                : 'Community guidelines and policies when using the Masita network:'}
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? C.textSecondary : '#4B5563' }]}>
              {language === 'vi' ? '1. Tôn trọng người khác: Không đăng tải nội dung quấy rối, xúc phạm.' : '1. Respect others: Do not post harassing or offensive content.'}
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? C.textSecondary : '#4B5563' }]}>
              {language === 'vi' ? '2. Bảo vệ bản quyền: Không chia sẻ hình ảnh vi phạm pháp luật.' : '2. Respect copyright: Do not share unlawful or pirated media.'}
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? C.textSecondary : '#4B5563' }]}>
              {language === 'vi' ? '3. Tính xác thực: Không tạo tài khoản giả mạo người khác.' : '3. Authenticity: Do not create misleading or impersonation accounts.'}
            </Text>
            <Text style={[styles.bulletPoint, { color: isDark ? C.textSecondary : '#4B5563' }]}>
              {language === 'vi' ? '4. Bảo vệ cộng đồng: Báo cáo các hành vi vi phạm chuẩn mực đạo đức.' : '4. Community safety: Report violations to our moderation team.'}
            </Text>
          </View>
        );

      case 'app_version': {
        const isUpToDate = otaChecked && otaInfo && !otaInfo.is_update_available;
        const hasUpdate = otaChecked && otaInfo && otaInfo.is_update_available;
        const changelog = otaInfo
          ? (language === 'vi' ? otaInfo.changelog_vi : otaInfo.changelog_en)
          : [];

        return (
          <View style={[styles.detailCard, { backgroundColor: isDark ? '#1A1A2E' : '#F8F7FF' }]}>
            <View style={styles.otaHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', marginBottom: 2 }]}>
                  🚀 {t('ota_title')}
                </Text>
                <Text style={[styles.otaSubText, { color: isDark ? C.textSecondary : '#6B7280' }]}>
                  {t('ota_subtitle')}
                </Text>
              </View>
              <View style={[
                styles.versionBadge,
                {
                  backgroundColor: hasUpdate ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  borderColor: hasUpdate ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                }
              ]}>
                <Text style={[styles.versionBadgeText, { color: hasUpdate ? '#F59E0B' : '#10B981' }]}>
                  {hasUpdate ? `${t('ota_update_available')} ⚡` : `${t('ota_up_to_date')} ✓`}
                </Text>
              </View>
            </View>

            {/* Version Overview Card */}
            <View style={[styles.otaInfoBox, { backgroundColor: isDark ? '#131224' : '#FFFFFF', borderColor: isDark ? '#2E2E48' : '#E5E7EB' }]}>
              <View style={styles.otaInfoRow}>
                <Text style={[styles.otaLabel, { color: isDark ? C.textSecondary : '#6B7280' }]}>
                  {t('ota_current_ver')}:
                </Text>
                <Text style={[styles.otaValue, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: 'bold' }]}>
                  v{appVersion}
                </Text>
              </View>

              <View style={styles.otaInfoRow}>
                <Text style={[styles.otaLabel, { color: isDark ? C.textSecondary : '#6B7280' }]}>
                  {t('ota_channel')}:
                </Text>
                <View style={styles.channelBadgeGroup}>
                  <TouchableOpacity
                    style={[
                      styles.channelChip,
                      otaChannel === 'production' && styles.channelChipActive,
                      { borderColor: isDark ? '#2E2E48' : '#E5E7EB' }
                    ]}
                    onPress={() => setOtaChannel('production')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.channelChipText,
                      otaChannel === 'production' && styles.channelChipTextActive,
                      { color: otaChannel === 'production' ? '#FFFFFF' : (isDark ? C.textSecondary : '#6B7280') }
                    ]}>
                      Production
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.channelChip,
                      otaChannel === 'beta' && styles.channelChipActive,
                      { borderColor: isDark ? '#2E2E48' : '#E5E7EB' }
                    ]}
                    onPress={() => setOtaChannel('beta')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.channelChipText,
                      otaChannel === 'beta' && styles.channelChipTextActive,
                      { color: otaChannel === 'beta' ? '#FFFFFF' : (isDark ? C.textSecondary : '#6B7280') }
                    ]}>
                      Beta 🧪
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {lastOtaCheckTime && (
                <View style={styles.otaInfoRow}>
                  <Text style={[styles.otaLabel, { color: isDark ? C.textSecondary : '#6B7280' }]}>
                    {language === 'vi' ? 'Kiểm tra lần cuối:' : 'Last checked:'}
                  </Text>
                  <Text style={[styles.otaValue, { color: isDark ? C.textSecondary : '#4B5563' }]}>
                    {formatRelativeTimeI18n(lastOtaCheckTime, language)}
                  </Text>
                </View>
              )}

              <View style={styles.otaInfoRow}>
                <Text style={[styles.otaLabel, { color: isDark ? C.textSecondary : '#6B7280' }]}>
                  {t('ota_auto_check')}:
                </Text>
                <Switch
                  value={autoCheckOta}
                  onValueChange={setAutoCheckOta}
                  trackColor={{ false: '#3E3E5A', true: C.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* State: Update Available Card */}
            {hasUpdate && (
              <View style={[styles.otaUpdateCard, { backgroundColor: isDark ? '#1C1936' : '#EEF2FF', borderColor: '#6C63FF' }]}>
                <View style={styles.updateCardHeader}>
                  <Text style={styles.updateCardTitle}>
                    🎉 {language === 'vi' ? 'Phiên bản mới' : 'New version'}: v{otaInfo?.latest_version}
                  </Text>
                  <Text style={styles.updateCardMeta}>
                    {otaInfo?.bundle_size} • {otaInfo?.release_date} • Channel: {otaInfo?.channel}
                  </Text>
                </View>

                {/* Changelog Bullets */}
                <Text style={[styles.changelogTitle, { color: isDark ? '#E0E7FF' : '#312E81' }]}>
                  📋 {t('ota_changelog')}:
                </Text>
                {changelog.map((line, idx) => (
                  <View key={idx} style={styles.changelogItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={[styles.changelogLine, { color: isDark ? C.textSecondary : '#4338CA' }]}>
                      {line}
                    </Text>
                  </View>
                ))}

                {/* Progress bar if downloading */}
                {otaDownloading && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBackground}>
                      <View style={[styles.progressBarFill, { width: `${otaProgress}%` }]} />
                    </View>
                    <Text style={[styles.progressText, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                      {t('ota_downloading')} {otaProgress}%
                    </Text>
                  </View>
                )}

                {/* Actions */}
                {!otaDownloaded ? (
                  <TouchableOpacity
                    style={[styles.btnDownloadOta, otaDownloading && styles.btnDisabled]}
                    onPress={handleDownloadOta}
                    disabled={otaDownloading}
                    activeOpacity={0.8}
                  >
                    {otaDownloading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.btnDownloadOtaText}>
                        📥 {t('ota_download_now')}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.btnApplyOta}
                    onPress={handleApplyOta}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnApplyOtaText}>
                      🔄 {t('ota_restart_apply')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* State: Up to date notice */}
            {isUpToDate && (
              <View style={[styles.upToDateBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5', borderColor: '#10B981' }]}>
                <Text style={styles.upToDateIcon}>✨</Text>
                <Text style={[styles.upToDateText, { color: isDark ? '#34D399' : '#065F46' }]}>
                  {t('ota_up_to_date')}
                </Text>
              </View>
            )}

            {/* Main Action Button */}
            <TouchableOpacity
              style={[styles.checkUpdateBtn, otaLoading && styles.btnDisabled]}
              onPress={() => handleCheckOta()}
              disabled={otaLoading || otaDownloading}
              activeOpacity={0.8}
            >
              {otaLoading ? (
                <View style={styles.checkingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={[styles.checkUpdateBtnText, { marginLeft: 8 }]}>
                    {t('ota_checking')}
                  </Text>
                </View>
              ) : (
                <Text style={styles.checkUpdateBtnText}>
                  🔄 {t('ota_check_now')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Simulator Tools for testing */}
            <View style={styles.simulatorDivider}>
              <Text style={[styles.simulatorDividerText, { color: isDark ? C.textMuted : '#9CA3AF' }]}>
                {language === 'vi' ? '— Công cụ thử nghiệm OTA —' : '— OTA Testing Sandbox —'}
              </Text>
            </View>

            <View style={styles.simulateButtonsRow}>
              <TouchableOpacity
                style={[styles.btnSimulate, { borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}
                onPress={() => handleCheckOta('new_version')}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnSimulateText, { color: isDark ? '#E0E7FF' : '#374151' }]}>
                  {t('ota_test_simulate_new')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSimulate, { borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}
                onPress={() => handleCheckOta('up_to_date')}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnSimulateText, { color: isDark ? '#E0E7FF' : '#374151' }]}>
                  {t('ota_test_simulate_uptodate')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      case 'developer':
        return (
          <View style={{ padding: 16 }}>
            <Text style={{ color: isDark ? '#FFFFFF' : '#1A1A2E', fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
              🧪 {language === 'vi' ? 'Máy chủ (Developer)' : 'Server (Developer)'}
            </Text>
            <Text style={{ color: isDark ? C.textMuted : '#6B7280', fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
              {language === 'vi'
                ? 'Chọn ngay nơi app kết nối để test, không cần sửa .env hay rebuild. Đang dùng:'
                : 'Pick where the app connects for testing, no .env edit or rebuild. Currently:'}
            </Text>
            <View
              style={{
                backgroundColor: isDark ? 'rgba(108,99,255,0.12)' : '#EEF2FF',
                borderRadius: 10,
                padding: 10,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: C.primary, fontSize: 12, fontFamily: 'monospace' }} selectable>
                {serverDisplay}
              </Text>
            </View>

            {(() => {
              const options: { active: boolean; icon: string; label: string; url: string | null }[] = [
                { active: isRenderActive, icon: '☁️', label: SERVER_RENDER_URL.replace('https://', ''), url: SERVER_RENDER_URL },
                { active: isNgrokActive, icon: '🚇', label: SERVER_NGROK_URL.replace('https://', ''), url: SERVER_NGROK_URL },
                { active: isDefaultActive, icon: '📶', label: language === 'vi' ? 'Mặc định (.env / LAN)' : 'Default (.env / LAN)', url: null },
              ];
              return options.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  activeOpacity={0.7}
                  onPress={() => handleSwitchServer(opt.url)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    marginBottom: 8,
                    borderWidth: 1.5,
                    borderColor: opt.active ? C.primary : isDark ? C.border : '#E2E8F0',
                    backgroundColor: opt.active ? 'rgba(108,99,255,0.12)' : isDark ? C.card : '#FFFFFF',
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
                  <Text
                    style={{
                      flex: 1,
                      color: isDark ? '#FFFFFF' : '#1A1A2E',
                      fontSize: 14,
                      fontFamily: 'monospace',
                    }}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  {opt.active && <Text style={{ color: C.primary, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              ));
            })()}

            <Text style={{ color: isDark ? '#FFFFFF' : '#1A1A2E', fontSize: 15, fontWeight: '600', marginTop: 18, marginBottom: 8 }}>
              {language === 'vi' ? 'Nhập URL tùy chỉnh' : 'Custom URL'}
            </Text>
            <TextInput
              value={customServerInput}
              onChangeText={setCustomServerInput}
              placeholder="https://ten-mien-cua-ban.onrender.com"
              placeholderTextColor={isDark ? C.textMuted : '#9CA3AF'}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: isDark ? C.card : '#F1F5F9',
                color: isDark ? '#FFFFFF' : '#1A1A2E',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isDark ? C.border : '#E2E8F0',
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
              }}
            />
            <TouchableOpacity
              onPress={handleApplyCustomServer}
              activeOpacity={0.7}
              style={{
                marginTop: 10,
                backgroundColor: C.primary,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                {language === 'vi' ? 'Áp dụng URL tùy chỉnh' : 'Apply custom URL'}
              </Text>
            </TouchableOpacity>

            <Text style={{ color: isDark ? C.textMuted : '#6B7280', fontSize: 12, marginTop: 16, lineHeight: 17 }}>
              {language === 'vi'
                ? '⚠️ Mỗi server có tài khoản / dữ liệu riêng. Sau khi đổi, nếu bị văng về đăng nhập là bình thường — hãy đăng nhập lại bằng tài khoản của server đó.'
                : '⚠️ Each server has its own accounts/data. If you get kicked to login after switching, just log in again on that server.'}
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: isDark ? '#0F0E17' : '#F8F7FF' }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: isDark ? C.card : '#FFFFFF', borderBottomColor: isDark ? C.border : '#E5E7EB' }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={{ color: isDark ? '#FFFFFF' : '#1A1A2E', fontSize: 16, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
            {t('settings')}
          </Text>
          <View style={styles.headerRightSpacer} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ================= SECTION 1: TÀI KHOẢN ================= */}
          <Text style={[styles.sectionHeader, { color: isDark ? C.primaryLight : C.primary }]}>
            {t('account')}
          </Text>
          <View style={[styles.card, {
            backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
            borderColor: isDark ? (highContrast ? '#FFFFFF' : C.border) : (highContrast ? '#000000' : '#E5E7EB'),
            borderWidth: highContrast ? 2 : 1,
          }]}>
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
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('account')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {language === 'vi' ? 'Chỉnh sửa username, email & mật khẩu' : 'Edit username, email & password'}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: isDark ? C.textMuted : '#9CA3AF' }]}>›</Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]} />

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
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('privacy')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {privacySettings.is_private_account
                    ? (language === 'vi' ? 'Tài khoản riêng tư' : 'Private account')
                    : (language === 'vi' ? 'Tài khoản công khai' : 'Public account')} • {language === 'vi' ? 'Đề xuất & Tìm kiếm' : 'Suggestions & Search'}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: isDark ? C.textMuted : '#9CA3AF' }]}>›</Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]} />

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
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('security')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {language === 'vi' ? 'Mật khẩu, quyền máy ảnh & bộ nhớ' : 'Password, camera & storage permissions'}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: isDark ? C.textMuted : '#9CA3AF' }]}>›</Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]} />

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
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('share_profile')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {language === 'vi' ? 'Sao chép liên kết trang cá nhân' : 'Copy profile link'}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: isDark ? C.textMuted : '#9CA3AF' }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* ================= SECTION 2: NỘI DUNG HIỂN THỊ ================= */}
          <Text style={[styles.sectionHeader, { color: isDark ? C.primaryLight : C.primary }]}>
            {t('display')}
          </Text>
          <View style={[styles.card, {
            backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
            borderColor: isDark ? (highContrast ? '#FFFFFF' : C.border) : (highContrast ? '#000000' : '#E5E7EB'),
            borderWidth: highContrast ? 2 : 1,
          }]}>

            {/* 1. Thông báo */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('notify_detail')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(255, 45, 85, 0.15)' }]}>
                <Text style={styles.itemIcon}>🔔</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('notifications')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {notifyMessages || notifyPosts || notifyInteractions
                    ? (language === 'vi' ? 'Đã bật thông báo' : 'Notifications on')
                    : (language === 'vi' ? 'Tất cả thông báo tắt' : 'All notifications off')}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: isDark ? C.textMuted : '#9CA3AF' }]}>›</Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]} />

            {/* 2. Hiển thị sáng/tối */}
            <View style={styles.itemRow}>
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(175, 82, 222, 0.15)' }]}>
                <Text style={styles.itemIcon}>{isDark ? '🌙' : '☀️'}</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('appearance')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {isDark ? t('theme_dark') : t('theme_light')}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={async (val) => {
                  await setThemeMode(val ? 'dark' : 'light');
                  showToast('success', val
                    ? (language === 'vi' ? '🌙 Đã bật Giao diện tối' : '🌙 Dark mode enabled')
                    : (language === 'vi' ? '☀️ Đã bật Giao diện sáng' : '☀️ Light mode enabled'));
                }}
                trackColor={{ false: '#D1D5DB', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]} />

            {/* 3. Ngôn ngữ */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('language_detail')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(88, 86, 214, 0.15)' }]}>
                <Text style={styles.itemIcon}>🌐</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('language')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {language === 'vi' ? '🇻🇳 Tiếng Việt' : '🇺🇸 English'}
                </Text>
              </View>
              <View style={styles.langBadge}>
                <Text style={styles.langBadgeText}>{language.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]} />

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
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('accessibility')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {[highContrast && (language === 'vi' ? 'Tương phản cao' : 'High contrast'),
                     reduceMotion && (language === 'vi' ? 'Giảm hiệu ứng' : 'Reduce motion'),
                     largeText && (language === 'vi' ? 'Chữ lớn' : 'Large text')].filter(Boolean).join(' • ')
                   || (language === 'vi' ? 'Chuẩn (Mặc định)' : 'Standard (Default)')}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: isDark ? C.textMuted : '#9CA3AF' }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* ================= SECTION 3: HỖ TRỢ GIỚI THIỆU ================= */}
          <Text style={[styles.sectionHeader, { color: isDark ? C.primaryLight : C.primary }]}>
            {t('support')}
          </Text>
          <View style={[styles.card, {
            backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
            borderColor: isDark ? (highContrast ? '#FFFFFF' : C.border) : (highContrast ? '#000000' : '#E5E7EB'),
            borderWidth: highContrast ? 2 : 1,
          }]}>
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
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('help_center')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {language === 'vi' ? 'FAQ, hướng dẫn sử dụng & liên hệ' : 'FAQ, guides & contact support'}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: isDark ? C.textMuted : '#9CA3AF' }]}>›</Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]} />

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
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('privacy_center')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {language === 'vi' ? 'Cam kết bảo mật dữ liệu người dùng' : 'User data privacy commitments'}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: isDark ? C.textMuted : '#9CA3AF' }]}>›</Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]} />

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
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('terms')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {language === 'vi' ? 'Quy chuẩn cộng đồng và dịch vụ' : 'Community rules and terms'}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: isDark ? C.textMuted : '#9CA3AF' }]}>›</Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]} />

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
                <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                  {t('version')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  {language === 'vi' ? `Masita Mobile v${appVersion} (${t('version')})` : `Masita Mobile v${appVersion} (${t('version')})`}
                </Text>
              </View>
              <View style={styles.versionPill}>
                <Text style={styles.versionPillText}>v{appVersion}</Text>
              </View>
            </TouchableOpacity>

            {/* 5. Cau noi Developer - chi hien khi __DEV__ */}
            {__DEV__ && (
              <>
                <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F3F4F6' }]} />
                <TouchableOpacity
                  style={styles.itemRow}
                  onPress={() => setActiveDetail('developer')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.itemIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Text style={styles.itemIcon}>🧪</Text>
                  </View>
                  <View style={styles.itemTextBox}>
                    <Text style={[styles.itemTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E', fontWeight: highContrast ? '700' : undefined }]}>
                      {language === 'vi' ? 'Máy chủ (Developer)' : 'Server (Developer)'}
                    </Text>
                    <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]} numberOfLines={1}>
                      {serverDisplay.replace(/^https?:\/\//, '').replace(/\/api$/, '')}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: isDark ? C.textMuted : '#9CA3AF' }]}>›</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ================= SECTION 4: ĐĂNG XUẤT (LOGOUT) ================= */}
          <View style={styles.logoutCardWrapper}>
            <TouchableOpacity
              style={[
                styles.logoutBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 82, 82, 0.08)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(255, 82, 82, 0.22)' : '#FECACA',
                },
              ]}
              onPress={handleLogout}
              activeOpacity={0.7}
              accessibilityLabel="settings-logout-btn"
            >
              <View style={[styles.logoutIconBox, { backgroundColor: isDark ? 'rgba(255, 82, 82, 0.18)' : 'rgba(239, 68, 68, 0.12)' }]}>
                <Text style={styles.logoutIcon}>🚪</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={[styles.logoutTitle, { color: isDark ? '#FF6B6B' : '#DC2626' }]}>
                  {t('logout')}
                </Text>
                <Text style={[styles.itemSub, { color: isDark ? C.textMuted : '#6B7280' }]}>
                  @{user?.username} ({maskEmail(user?.email)})
                </Text>
              </View>
              <Text style={[styles.chevron, { color: isDark ? '#FF6B6B' : '#DC2626' }]}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Detail Bottom Modal with KeyboardAvoidingView */}
        <Modal
          visible={!!activeDetail}
          transparent
          animationType={reduceMotion ? 'none' : 'fade'}
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
            <View style={[styles.detailModalBox, {
              backgroundColor: isDark ? '#181826' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
            }]}>
              <View style={[styles.detailDragBar, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' }]} />
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                {renderDetailContent()}
              </ScrollView>
              <TouchableOpacity
                style={[styles.detailCloseBtn, {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                }]}
                onPress={() => setActiveDetail(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.detailCloseBtnText, { color: isDark ? C.textSecondary : '#4B5563' }]}>
                  {t('close')}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Custom Web Logout Confirm Modal */}
        <Modal
          visible={showLogoutConfirmModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLogoutConfirmModal(false)}
        >
          <View style={styles.logoutModalOverlay}>
            <View style={[styles.logoutModalBox, {
              backgroundColor: isDark ? '#181826' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
            }]}>
              <View style={[styles.logoutModalIconBox, { backgroundColor: isDark ? 'rgba(255, 82, 82, 0.18)' : 'rgba(239, 68, 68, 0.12)' }]}>
                <Text style={{ fontSize: 24 }}>🚪</Text>
              </View>
              <Text style={[styles.logoutModalTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
                {t('logout')}
              </Text>
              <Text style={[styles.logoutModalMessage, { color: isDark ? C.textSecondary : '#4B5563' }]}>
                {t('logout_confirm_msg')}
              </Text>
              <View style={styles.logoutModalButtons}>
                <TouchableOpacity
                  style={[styles.logoutModalBtn, {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
                  }]}
                  onPress={() => setShowLogoutConfirmModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.logoutModalBtnCancelText, { color: isDark ? C.textSecondary : '#4B5563' }]}>
                    {t('cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.logoutModalBtn, { backgroundColor: '#EF4444' }]}
                  onPress={performLogout}
                  activeOpacity={0.7}
                >
                  <Text style={styles.logoutModalBtnConfirmText}>
                    {t('logout')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const createStyles = (C: ColorScheme, isDark: boolean) =>
  StyleSheet.create({
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
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    backBtnText: {
      color: C.text,
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
      backgroundColor: C.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      borderWidth: 1,
      borderColor: C.border,
      maxHeight: '85%',
    },
    detailDragBar: {
      width: 36,
      height: 4,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
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
      color: C.text,
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
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
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
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : C.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: C.border,
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
      borderBottomColor: C.border,
    },
    currentValLabel: {
      fontSize: 12,
      color: C.textMuted,
      fontFamily: 'Inter_400Regular',
    },
    currentValText: {
      fontSize: 14,
      color: C.text,
      fontFamily: 'Inter_600SemiBold',
    },
    inputLabel: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
      marginBottom: 6,
      marginTop: 8,
    },
    textInputStyle: {
      height: 44,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : C.inputBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: C.border,
      color: C.text,
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
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : C.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: C.border,
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
      borderTopColor: C.border,
    },
    privacySwitchLabel: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
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
      backgroundColor: `${C.primary}18`,
      padding: 12,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: `${C.primary}35`,
    },
    securityItem: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : C.surface,
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: C.border,
    },
    securityItemTitle: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
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
      color: C.text,
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
  otaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  otaSubText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    maxWidth: 240,
  },
  otaInfoBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
    gap: 10,
  },
  otaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  otaLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  otaValue: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  channelBadgeGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  channelChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  channelChipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  channelChipText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  channelChipTextActive: {
    color: '#FFFFFF',
  },
  otaUpdateCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  updateCardHeader: {
    marginBottom: 10,
  },
  updateCardTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#6C63FF',
    marginBottom: 4,
  },
  updateCardMeta: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
  },
  changelogTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  changelogItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 6,
  },
  bulletDot: {
    fontSize: 14,
    color: C.primary,
    lineHeight: 18,
  },
  changelogLine: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  progressContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 4,
    textAlign: 'right',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnDownloadOta: {
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: C.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDownloadOtaText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  btnApplyOta: {
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 12,
    alignItems: 'center',
  },
  btnApplyOtaText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  upToDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  upToDateIcon: {
    fontSize: 18,
  },
  upToDateText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulatorDivider: {
    marginTop: 16,
    marginBottom: 10,
    alignItems: 'center',
  },
  simulatorDividerText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
  simulateButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSimulate: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  btnSimulateText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
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
    color: C.text,
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
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  securityGroup: {
    marginTop: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  securityGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  securityGroupTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: C.primaryLight,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  securityCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
    gap: 10,
  },
  securityCheckIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  securityCheckLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 1,
  },
  securityCheckValue: {
    fontSize: 12,
    color: C.textMuted,
  },
  securityLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  securityLoadingText: {
    fontSize: 12,
    color: C.textMuted,
  },
  securityEmptyText: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  sessionDeviceName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  sessionMeta: {
    fontSize: 11,
    color: C.textMuted,
  },
  sessionRevokeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  sessionRevokeBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#EF4444',
  },
  otpBox: {
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `${C.primary}30`,
    marginTop: 10,
    marginBottom: 4,
  },
  otpTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  otpHint: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 10,
  },
  otpCode: {
    fontFamily: 'Inter_700Bold',
    color: C.primaryLight,
    letterSpacing: 2,
  },
  otpBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  otpBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  otpBtnCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  otpBtnCancelText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
  otpBtnConfirm: {
    backgroundColor: C.primary,
  },
  otpBtnConfirmText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  deleteAccountBtn: {
    paddingVertical: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
  },
  deleteAccountBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#EF4444',
  },
  deleteConfirmBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  deleteConfirmTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  deleteConfirmDesc: {
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  deleteConfirmActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#EF4444',
  },

  // Notification details styles
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  notifyIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyIcon: {
    fontSize: 18,
  },
  notifyLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  notifyDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  notifyAllOffBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  notifyAllOffBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },

  // Language selection styles
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  langOptionFlag: {
    fontSize: 26,
  },
  langOptionName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  langOptionDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  langOptionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langOptionCheckText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // Accessibility preview styles
  accessibilityPreview: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  accessibilityPreviewLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  accessibilityPreviewText: {
    lineHeight: 22,
  },

  // Logout section styles
  logoutCardWrapper: {
    marginTop: 20,
    marginBottom: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  logoutIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutIcon: {
    fontSize: 20,
  },
  logoutTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoutModalBox: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  logoutModalIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoutModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  logoutModalMessage: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutModalBtnCancelText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  logoutModalBtnConfirmText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
});
