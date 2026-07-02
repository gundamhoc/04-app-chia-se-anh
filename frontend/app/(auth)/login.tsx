import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { colors, theme, t, language, setLanguage } = useSettings();

  const [loginKey, setLoginKey] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    
    // Validations
    if (!loginKey.trim()) {
      setError(language === 'vi' ? 'Vui lòng nhập Username hoặc Email' : 'Username or Email is required');
      return;
    }
    if (!password) {
      setError(language === 'vi' ? 'Vui lòng nhập Mật khẩu' : 'Password is required');
      return;
    }

    setLoading(true);
    try {
      const result = await login(loginKey.trim(), password);
      if (!result.success) {
        setError(result.message);
      } else {
        router.replace('/(tabs)');
      }
    } catch (e) {
      setError(language === 'vi' ? 'Có lỗi bất ngờ xảy ra. Vui lòng thử lại.' : 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Top Language Toggle for Auth Pages */}
      <View style={styles.langHeader}>
        <TouchableOpacity 
          onPress={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
          style={[styles.langToggleBtn, { backgroundColor: colors.input, borderColor: colors.border }]}
        >
          <Text style={[styles.langToggleText, { color: colors.text }]}>
            {language === 'vi' ? '🇬🇧 English' : '🇻🇳 Tiếng Việt'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.innerContainer}>
          {/* Logo / Title */}
          <View style={styles.headerContainer}>
            <View style={[styles.logoBadge, { backgroundColor: colors.input, borderColor: colors.accent }]}>
              <Text style={styles.logoIcon}>📸</Text>
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>Locket</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {language === 'vi' ? 'Đăng nhập để xem khoảnh khắc của bạn bè' : "Sign in to view your friends' moments"}
            </Text>
          </View>

          {/* Form container */}
          <View style={styles.formContainer}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('usernameOrEmail')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder={t('enterUsernameOrEmail')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              value={loginKey}
              onChangeText={setLoginKey}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('password')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder={t('enterPassword')}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: colors.accent }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>{t('login')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Link */}
          <View style={styles.footerContainer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t('newToLocket')}</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={[styles.footerLink, { color: colors.accent }]}>{t('register')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  langHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 28,
    paddingTop: 10,
  },
  langToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  langToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  keyboardView: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
  },
  logoIcon: {
    fontSize: 32,
  },
  appName: {
    fontSize: 38,
    fontWeight: '950',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    marginVertical: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 1.5,
  },
  input: {
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 20,
    borderWidth: 1,
  },
  loginButton: {
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  errorBox: {
    backgroundColor: '#FFE5E5',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
