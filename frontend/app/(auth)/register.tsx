import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Colors, ColorScheme } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../utils/i18n';

export default function RegisterScreen() {
  const { colors: C, isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);
  const { register, isLoading } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.username.trim()) newErrors.username = t('enter_username');
    else if (form.username.length < 3) newErrors.username = t('username_min_length');
    else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) newErrors.username = t('username_invalid_chars');

    if (!form.email.trim()) newErrors.email = t('enter_email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = t('invalid_email');

    if (!form.password) newErrors.password = t('enter_password');
    else if (form.password.length < 6) newErrors.password = t('password_min_length');

    if (form.password !== form.confirmPassword) newErrors.confirmPassword = t('password_mismatch');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    try {
      await register({
        username: form.username.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        full_name: form.full_name.trim() || undefined,
      });
      showToast('success', t('register_success'));
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);
    } catch (error: any) {
      const msg =
        error?.message ||
        error?.response?.data?.message ||
        t('register_failed');
      console.warn('[RegisterScreen] register error:', msg);
      showToast('error', msg);
    }
  };

  const renderField = (
    key: keyof typeof form,
    label: string,
    placeholder: string,
    options?: {
      keyboardType?: 'default' | 'email-address';
      autoCapitalize?: 'none' | 'words';
      secure?: boolean;
    }
  ) => (
    <View style={styles.fieldWrapper} key={key}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, errors[key] ? styles.inputError : null]}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          keyboardType={options?.keyboardType || 'default'}
          autoCapitalize={options?.autoCapitalize || 'none'}
          autoCorrect={false}
          secureTextEntry={options?.secure && !showPassword}
          value={form[key]}
          onChangeText={(v) => updateField(key, v)}
        />
        {options?.secure && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>MXH</Text>
          </View>
          <Text style={styles.title}>{t('register_btn')}</Text>
          <Text style={styles.subtitle}>{t('join_community')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {renderField('full_name', t('display_name'), 'Alex', { autoCapitalize: 'words' })}
          {renderField('username', `${t('username_label')} *`, 'user_name')}
          {renderField('email', `${t('email_label')} *`, 'you@example.com', { keyboardType: 'email-address' })}
          {renderField('password', `${t('password_label')} *`, '••••••••', { secure: true })}
          {renderField('confirmPassword', `${t('confirm_password_label')} *`, '••••••••', { secure: true })}

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerBtn, isLoading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            accessibilityLabel="register-button"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.registerBtnText}>{t('register_btn')}</Text>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>{t('already_have_account')} </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.loginLink}>{t('login_btn')}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
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
    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 12,
    },
    logoText: {
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      color: '#fff',
      letterSpacing: 1,
    },
    title: {
      fontSize: 26,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    form: {
      gap: 14,
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
    inputError: {
      borderColor: C.error,
    },
    input: {
      fontSize: 16,
      fontFamily: 'Inter_400Regular',
      color: C.text,
    },
    eyeBtn: { paddingLeft: 8 },
    eyeText: { fontSize: 18 },
    errorText: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.error,
    },
    registerBtn: {
      height: 54,
      borderRadius: 14,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    btnDisabled: { opacity: 0.7 },
    registerBtnText: {
      fontSize: 17,
      fontFamily: 'Inter_600SemiBold',
      color: '#fff',
      letterSpacing: 0.5,
    },
    loginRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 16,
    },
    loginText: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    loginLink: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.primary,
    },
  });
