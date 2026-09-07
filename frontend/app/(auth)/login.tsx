import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Colors, ColorScheme } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { storage } from '../../utils/storage';
import { authService } from '../../services/authService';
import { useI18n } from '../../utils/i18n';

// URL Logo từ người dùng cung cấp
const APP_LOGO_URL =
  'https://media.discordapp.net/attachments/1530179133471064206/1530183010635485245/2023-09-18_thong.tri.dream_7280027751271140626_0000000000000000000011.jpeg?ex=6a9ea77b&is=6a9d55fb&hm=f13c882df25077f5cacba18c373b1564490262ee70d69db868f0feffedbcfbae&=&format=webp&width=640&height=640';

export default function LoginScreen() {
  const { colors: C, isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  const { login, isLoading } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Trạng thái Quên mật khẩu
  const [forgotPasswordModalVisible, setForgotPasswordModalVisible] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState<string | null>(null);

  // Tự động tải lại email đã lưu trước đó nếu người dùng đã tích "Lưu tài khoản"
  useEffect(() => {
    const loadRememberedAccount = async () => {
      try {
        const savedEmail = await storage.getItem('remembered_email');
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (e) {
        console.warn('[LoginScreen] loadRememberedAccount error:', e);
      }
    };
    loadRememberedAccount();
  }, []);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = t('enter_email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = t('invalid_email');
    if (!password) newErrors.password = t('enter_password');
    else if (password.length < 6) newErrors.password = t('password_min_length');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      const cleanEmail = email.trim();
      await login({ email: cleanEmail, password });

      // Lưu hoặc xóa email trong storage theo trạng thái "Lưu tài khoản"
      if (rememberMe) {
        await storage.setItem('remembered_email', cleanEmail);
      } else {
        await storage.deleteItem('remembered_email');
      }

      showToast('success', t('login_success'));
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);
    } catch (error: any) {
      const msg =
        error?.message ||
        error?.response?.data?.message ||
        t('login_failed');
      console.warn('[LoginScreen] login error:', msg);
      showToast('error', msg);
    }
  };

  // Xử lý gửi yêu cầu Quên mật khẩu
  const handleForgotPasswordSubmit = async () => {
    const emailToReset = forgotPasswordEmail.trim();
    if (!emailToReset) {
      setForgotPasswordError(t('enter_gmail'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToReset)) {
      setForgotPasswordError(t('invalid_gmail'));
      return;
    }

    setForgotPasswordLoading(true);
    setForgotPasswordError(null);
    setForgotPasswordSuccess(null);

    try {
      const res = await authService.forgotPassword(emailToReset);
      const successMsg = res.message || t('forgot_password_success');
      setForgotPasswordSuccess(successMsg);
      showToast('success', successMsg);
      setTimeout(() => {
        setForgotPasswordModalVisible(false);
        setForgotPasswordSuccess(null);
      }, 2500);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        t('gmail_not_found');
      setForgotPasswordError(errorMsg);
      showToast('error', errorMsg);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header với Logo Anime và Tên App */}
        <View style={styles.header}>
          <View style={styles.logoCircleWrapper}>
            <Image
              source={{ uri: APP_LOGO_URL }}
              defaultSource={require('../../assets/app_logo.webp')}
              style={styles.logoImage}
              resizeMode="cover"
              {...(Platform.OS === 'web' ? ({ referrerPolicy: 'no-referrer' } as unknown as object) : {})}
            />
          </View>
          <Text style={styles.appName}>Masita</Text>
          <Text style={styles.title}>{t('welcome_back')}</Text>
          <Text style={styles.subtitle}>{t('login_to_continue')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>{t('email_label')}</Text>
            <View style={[styles.inputWrapper, errors.email ? styles.inputError : null]}>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={C.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>{t('password_label')}</Text>
            <View style={[styles.inputWrapper, errors.password ? styles.inputError : null]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                accessibilityLabel="toggle-password-visibility"
              >
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          {/* Tùy chọn: Lưu tài khoản & Quên mật khẩu */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberMeBtn}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberMeText}>{t('remember_me')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setForgotPasswordEmail(email.trim());
                setForgotPasswordError(null);
                setForgotPasswordSuccess(null);
                setForgotPasswordModalVisible(true);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.forgotPasswordLink}>{t('forgot_password')}</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            accessibilityLabel="login-button"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>{t('login_btn')}</Text>
            )}
          </TouchableOpacity>

          {/* Register link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>{t('no_account')} </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.registerLink}>{t('register_now')}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>

      {/* Modal Quên mật khẩu */}
      <Modal
        visible={forgotPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalWrapper}
          >
            <View style={styles.forgotModalCard}>
              <View style={styles.forgotModalHeader}>
                <View style={styles.keyIconCircle}>
                  <Text style={styles.keyIconText}>🔑</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setForgotPasswordModalVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.forgotModalTitle}>{t('forgot_password')}</Text>
              <Text style={styles.forgotModalSubtitle}>
                {t('forgot_password_desc')}
              </Text>

              {/* Ô điền Gmail */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.label}>{t('email_label')}</Text>
                <View style={[styles.inputWrapper, forgotPasswordError ? styles.inputError : null]}>
                  <Text style={styles.inputPrefixIcon}>✉️</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="example@gmail.com"
                    placeholderTextColor={C.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={forgotPasswordEmail}
                    onChangeText={(v) => {
                      setForgotPasswordEmail(v);
                      setForgotPasswordError(null);
                    }}
                  />
                </View>
                {forgotPasswordError ? (
                  <Text style={styles.errorText}>{forgotPasswordError}</Text>
                ) : null}
                {forgotPasswordSuccess ? (
                  <Text style={styles.successText}>{forgotPasswordSuccess}</Text>
                ) : null}
              </View>

              {/* Nút gửi yêu cầu */}
              <View style={styles.forgotModalActions}>
                <TouchableOpacity
                  style={[
                    styles.submitResetBtn,
                    forgotPasswordLoading && styles.loginBtnDisabled,
                  ]}
                  onPress={handleForgotPasswordSubmit}
                  disabled={forgotPasswordLoading}
                >
                  {forgotPasswordLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitResetBtnText}>{t('send_request')}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setForgotPasswordModalVisible(false)}
                  disabled={forgotPasswordLoading}
                >
                  <Text style={styles.cancelBtnText}>{t('back_to_login')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ToastComponent />
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: ColorScheme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 28,
      paddingTop: 60,
      paddingBottom: 40,
    },
    header: {
      alignItems: 'center',
      marginBottom: 36,
    },
    logoCircleWrapper: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: isDark ? '#1E1E2E' : '#EDE9FE',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      borderWidth: 2,
      borderColor: C.primary,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 12,
      overflow: 'hidden',
    },
    logoImage: {
      width: 90,
      height: 90,
      borderRadius: 45,
    },
    appName: {
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      color: isDark ? '#B0AAFF' : C.primary,
      letterSpacing: 1.5,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 26,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    form: {
      gap: 16,
    },
    fieldWrapper: {
      gap: 6,
    },
    label: {
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.inputBg,
      borderWidth: 1.5,
      borderColor: C.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      height: 52,
    },
    inputPrefixIcon: {
      fontSize: 16,
      marginRight: 8,
    },
    inputError: {
      borderColor: C.error,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontFamily: 'Inter_400Regular',
      color: C.text,
    },
    eyeBtn: {
      paddingLeft: 8,
    },
    eyeText: {
      fontSize: 18,
    },
    errorText: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.error,
      marginTop: 2,
    },
    successText: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: '#4CAF50',
      marginTop: 4,
    },
    optionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
    },
    rememberMeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: isDark ? '#4A4A62' : '#CBD5E1',
      backgroundColor: isDark ? '#1E1E2E' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
    checkmark: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    rememberMeText: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    forgotPasswordLink: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: isDark ? '#A29BFE' : C.primary,
    },
    loginBtn: {
      height: 54,
      borderRadius: 14,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 6,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    loginBtnDisabled: {
      opacity: 0.7,
    },
    loginBtnText: {
      fontSize: 17,
      fontFamily: 'Inter_600SemiBold',
      color: '#fff',
      letterSpacing: 0.5,
    },
    registerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 14,
    },
    registerText: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    registerLink: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.primary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalWrapper: {
      width: '100%',
      maxWidth: 400,
    },
    forgotModalCard: {
      backgroundColor: C.card,
      borderRadius: 22,
      padding: 24,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.5 : 0.15,
      shadowRadius: 20,
      elevation: 16,
    },
    forgotModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    keyIconCircle: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: isDark ? 'rgba(108, 99, 255, 0.15)' : 'rgba(108, 99, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(108, 99, 255, 0.3)' : 'rgba(108, 99, 255, 0.2)',
    },
    keyIconText: {
      fontSize: 22,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCloseText: {
      color: C.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    forgotModalTitle: {
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginBottom: 6,
    },
    forgotModalSubtitle: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: C.textMuted,
      lineHeight: 19,
      marginBottom: 20,
    },
    forgotModalActions: {
      gap: 12,
      marginTop: 20,
    },
    submitResetBtn: {
      height: 50,
      borderRadius: 14,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },
    submitResetBtnText: {
      fontSize: 16,
      fontFamily: 'Inter_600SemiBold',
      color: '#FFFFFF',
    },
    cancelBtn: {
      height: 44,
      borderRadius: 12,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelBtnText: {
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: C.textMuted,
    },
  });

