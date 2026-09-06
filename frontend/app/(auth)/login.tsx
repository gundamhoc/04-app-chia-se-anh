import React, { useState } from 'react';
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
import { Colors } from '../../constants/Colors';

const C = Colors.dark;

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Vui lòng nhập email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Email không hợp lệ';
    if (!password) newErrors.password = 'Vui lòng nhập mật khẩu';
    else if (password.length < 6) newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      await login({ email: email.trim(), password });
      showToast('success', 'Đăng nhập thành công!');
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);
    } catch (error: any) {
      const msg =
        error?.message ||
        error?.response?.data?.message ||
        'Đăng nhập thất bại. Vui lòng thử lại.';
      console.warn('[LoginScreen] login error:', msg);
      showToast('error', msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>MXH</Text>
          </View>
          <Text style={styles.title}>Chào mừng trở lại</Text>
          <Text style={styles.subtitle}>Đăng nhập để tiếp tục</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Email</Text>
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
            <Text style={styles.label}>Mật khẩu</Text>
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
              <Text style={styles.loginBtnText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>

          {/* Register link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Chưa có tài khoản? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.registerLink}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
      <ToastComponent />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  logoText: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
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
  },
  loginBtn: {
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
    marginTop: 16,
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
});
