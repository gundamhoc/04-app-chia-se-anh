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

export default function RegisterScreen() {
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
    if (!form.username.trim()) newErrors.username = 'Vui lòng nhập username';
    else if (form.username.length < 3) newErrors.username = 'Username phải có ít nhất 3 ký tự';
    else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) newErrors.username = 'Username chỉ chứa chữ, số, dấu _';

    if (!form.email.trim()) newErrors.email = 'Vui lòng nhập email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Email không hợp lệ';

    if (!form.password) newErrors.password = 'Vui lòng nhập mật khẩu';
    else if (form.password.length < 6) newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';

    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';

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
      showToast('success', 'Đăng ký tài khoản thành công!');
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);
    } catch (error: any) {
      const msg =
        error?.message ||
        error?.response?.data?.message ||
        'Đăng ký thất bại. Vui lòng thử lại.';
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
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>MXH</Text>
          </View>
          <Text style={styles.title}>Tạo tài khoản</Text>
          <Text style={styles.subtitle}>Tham gia cộng đồng ngay hôm nay</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {renderField('full_name', 'Tên hiển thị (tùy chọn)', 'Nguyễn Văn A', { autoCapitalize: 'words' })}
          {renderField('username', 'Username *', 'ten_nguoi_dung')}
          {renderField('email', 'Email *', 'you@example.com', { keyboardType: 'email-address' })}
          {renderField('password', 'Mật khẩu *', '••••••••', { secure: true })}
          {renderField('confirmPassword', 'Xác nhận mật khẩu *', '••••••••', { secure: true })}

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
              <Text style={styles.registerBtnText}>Tạo tài khoản</Text>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Đã có tài khoản? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.loginLink}>Đăng nhập</Text>
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
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: C.accent,
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
