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
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { colors, theme, t, language, setLanguage } = useSettings();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');

    // Field checks
    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      setError(language === 'vi' ? 'Vui lòng điền đầy đủ tất cả các trường' : 'All fields are required');
      return;
    }

    // Username format check
    const cleanUsername = username.trim().toLowerCase();
    const usernameRegex = /^[a-z0-9_]{3,15}$/;
    if (!usernameRegex.test(cleanUsername)) {
      setError(
        language === 'vi' 
          ? 'Tên đăng nhập phải dài từ 3-15 ký tự, chỉ chứa chữ cái, số hoặc dấu gạch dưới' 
          : 'Username must be 3-15 chars, alphanumeric or underscores'
      );
      return;
    }

    // Email check
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError(language === 'vi' ? 'Vui lòng nhập địa chỉ email hợp lệ' : 'Please enter a valid email address');
      return;
    }

    // Password length check
    if (password.length < 6) {
      setError(language === 'vi' ? 'Mật khẩu phải dài tối thiểu 6 ký tự' : 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await register(cleanUsername, cleanEmail, password, fullName.trim());
      if (!result.success) {
        setError(result.message);
      } else {
        router.replace('/(tabs)');
      }
    } catch (e) {
      setError(language === 'vi' ? 'Có lỗi xảy ra trong quá trình đăng ký. Vui lòng thử lại.' : 'An unexpected error occurred. Please try again.');
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
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <TouchableOpacity 
              style={[styles.backButton, { backgroundColor: colors.input }]} 
              onPress={() => router.back()}
            >
              <Text style={[styles.backIcon, { color: colors.text }]}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{t('register')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {language === 'vi' ? 'Đăng ký để chia sẻ ảnh khoảnh khắc với bạn bè' : 'Sign up to start sharing live photos on Locket'}
            </Text>
          </View>

          <View style={styles.formContainer}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('fullName')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder={t('enterFullName')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('username')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder={t('enterUsername')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('emailAddress')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder={t('enterEmail')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('password')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder={t('minPassword')}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={[styles.registerButton, { backgroundColor: colors.accent }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>{t('register')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footerContainer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t('alreadyHaveAccount')}</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.footerLink, { color: colors.accent }]}>{t('login')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 10,
    position: 'relative',
    width: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 50,
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
    marginBottom: 16,
    borderWidth: 1,
  },
  registerButton: {
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  registerButtonText: {
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
