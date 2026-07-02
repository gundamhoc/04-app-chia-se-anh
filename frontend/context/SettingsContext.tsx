import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type Theme = 'light' | 'dark';
type Language = 'en' | 'vi';

interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  input: string;
  accent: string;
}

interface SettingsContextType {
  theme: Theme;
  language: Language;
  colors: ThemeColors;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const THEME_KEY = 'app_theme';
const LANG_KEY = 'app_lang';

const colorsMap: Record<Theme, ThemeColors> = {
  light: {
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#E5E5EA',
    input: '#F2F2F7',
    accent: '#0066FF', // Electric Blue
  },
  dark: {
    background: '#121212',
    card: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#AEAEB2',
    border: '#2C2C2E',
    input: '#1C1C1E',
    accent: '#FFCC00', // Classic Locket Gold/Yellow for Dark Mode
  },
};

const translations = {
  en: {
    // Auth
    login: 'Sign In',
    register: 'Create Account',
    usernameOrEmail: 'USERNAME OR EMAIL',
    password: 'PASSWORD',
    fullName: 'FULL NAME',
    emailAddress: 'EMAIL ADDRESS',
    enterUsernameOrEmail: 'Enter your username or email',
    enterPassword: 'Enter your password',
    enterFullName: 'e.g. John Doe',
    enterUsername: 'e.g. johndoe',
    enterEmail: 'e.g. johndoe@gmail.com',
    minPassword: 'Min. 6 characters',
    newToLocket: 'New to Locket?',
    alreadyHaveAccount: 'Already have an account?',
    // Feed
    feedTitle: 'Locket',
    noMoments: 'No Moments Yet',
    noMomentsDesc: "Photos taken by your friends and you will show up in this feed grid. Add friends or take your first photo!",
    findFriends: 'Find Friends',
    takePhoto: 'Take Photo',
    justNow: 'Just now',
    minsAgo: 'm ago',
    hoursAgo: 'h ago',
    daysAgo: 'd ago',
    // Explore
    searchTitle: 'Find Friends',
    searchPlaceholder: 'Search by username or name...',
    searchResults: 'SEARCH RESULTS',
    noUsersFound: 'No users found for',
    incomingRequests: 'INCOMING REQUESTS',
    sentRequests: 'SENT REQUESTS',
    noIncoming: 'No pending incoming requests',
    noOutgoing: 'No outgoing requests',
    accept: 'Accept',
    decline: 'Decline',
    friends: 'Friends',
    sent: 'Sent',
    add: 'Add',
    pending: 'Pending',
    // Add
    shareMoment: 'Share Moment',
    writeCaption: 'Write a caption...',
    uploadMoment: 'Upload Moment',
    takeNewPhoto: 'Take New Photo',
    selectGallery: 'Select from Gallery',
    permissionRequired: 'Permission Required',
    cameraPermissionDesc: 'Camera access is required to take new photos.',
    galleryPermissionDesc: 'Gallery access is required to choose photos.',
    // Profile
    profileTitle: 'Profile',
    myMoments: 'MY MOMENTS',
    noMomentsShared: 'No Moments Shared',
    noMomentsSharedDesc: 'Your personal shared photos will be shown here as a 2x2 memories grid.',
    logout: 'Log Out',
    settings: 'SETTINGS',
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
  },
  vi: {
    // Auth
    login: 'Đăng nhập',
    register: 'Tạo tài khoản',
    usernameOrEmail: 'TÊN ĐĂNG NHẬP HOẶC EMAIL',
    password: 'MẬT KHẨU',
    fullName: 'HỌ VÀ TÊN',
    emailAddress: 'ĐỊA CHỈ EMAIL',
    enterUsernameOrEmail: 'Nhập tên đăng nhập hoặc email',
    enterPassword: 'Nhập mật khẩu',
    enterFullName: 'Ví dụ: Nguyễn Văn A',
    enterUsername: 'Ví dụ: nguyenvana',
    enterEmail: 'Ví dụ: nguyenvana@gmail.com',
    minPassword: 'Tối thiểu 6 ký tự',
    newToLocket: 'Chưa có tài khoản?',
    alreadyHaveAccount: 'Đã có tài khoản?',
    // Feed
    feedTitle: 'Locket',
    noMoments: 'Chưa có khoảnh khắc nào',
    noMomentsDesc: 'Ảnh do bạn và bạn bè chụp sẽ xuất hiện tại đây. Hãy kết bạn hoặc chụp bức ảnh đầu tiên nhé!',
    findFriends: 'Tìm bạn bè',
    takePhoto: 'Chụp ảnh',
    justNow: 'Vừa xong',
    minsAgo: 'phút trước',
    hoursAgo: 'giờ trước',
    daysAgo: 'ngày trước',
    // Explore
    searchTitle: 'Tìm bạn bè',
    searchPlaceholder: 'Tìm kiếm theo tên đăng nhập hoặc họ tên...',
    searchResults: 'KẾT QUẢ TÌM KIẾM',
    noUsersFound: 'Không tìm thấy người dùng nào phù hợp với',
    incomingRequests: 'YÊU CẦU ĐÃ NHẬN',
    sentRequests: 'YÊU CẦU ĐÃ GỬI',
    noIncoming: 'Không có yêu cầu kết bạn nào đang chờ',
    noOutgoing: 'Không có yêu cầu gửi đi',
    accept: 'Chấp nhận',
    decline: 'Từ chối',
    friends: 'Bạn bè',
    sent: 'Đã gửi',
    add: 'Thêm',
    pending: 'Đang chờ',
    // Add
    shareMoment: 'Chia sẻ khoảnh khắc',
    writeCaption: 'Viết chú thích...',
    uploadMoment: 'Đăng khoảnh khắc',
    takeNewPhoto: 'Chụp ảnh mới',
    selectGallery: 'Chọn từ thư viện',
    permissionRequired: 'Yêu cầu quyền truy cập',
    cameraPermissionDesc: 'Cần quyền truy cập máy ảnh để chụp ảnh mới.',
    galleryPermissionDesc: 'Cần quyền truy cập thư viện để chọn ảnh.',
    // Profile
    profileTitle: 'Trang cá nhân',
    myMoments: 'KHOẢNH KHẮC CỦA TÔI',
    noMomentsShared: 'Chưa chia sẻ khoảnh khắc nào',
    noMomentsSharedDesc: 'Ảnh bạn đã chia sẻ sẽ hiển thị ở đây theo dạng lưới kỷ niệm 2x2.',
    logout: 'Đăng xuất',
    settings: 'CÀI ĐẶT',
    language: 'Ngôn ngữ',
    theme: 'Giao diện',
    light: 'Sáng',
    dark: 'Tối',
  }
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [language, setLanguageState] = useState<Language>('vi'); // Default to Vietnamese for the project

  useEffect(() => {
    // Load stored settings on bootstrap
    const loadSettings = async () => {
      try {
        if (Platform.OS === 'web') {
          const savedTheme = localStorage.getItem(THEME_KEY) as Theme;
          const savedLang = localStorage.getItem(LANG_KEY) as Language;
          if (savedTheme) setThemeState(savedTheme);
          if (savedLang) setLanguageState(savedLang);
        } else {
          const savedTheme = await SecureStore.getItemAsync(THEME_KEY) as Theme;
          const savedLang = await SecureStore.getItemAsync(LANG_KEY) as Language;
          if (savedTheme) setThemeState(savedTheme);
          if (savedLang) setLanguageState(savedLang);
        }
      } catch (e) {
        console.log('Error loading settings', e);
      }
    };
    loadSettings();
  }, []);

  const toggleTheme = async () => {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setThemeState(nextTheme);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(THEME_KEY, nextTheme);
      } else {
        await SecureStore.setItemAsync(THEME_KEY, nextTheme);
      }
    } catch (e) {
      console.log('Error saving theme', e);
    }
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(LANG_KEY, lang);
      } else {
        await SecureStore.setItemAsync(LANG_KEY, lang);
      }
    } catch (e) {
      console.log('Error saving language', e);
    }
  };

  const t = (key: string): string => {
    const langDict = translations[language];
    return (langDict as any)[key] || key;
  };

  const colors = colorsMap[theme];

  return (
    <SettingsContext.Provider value={{ theme, language, colors, toggleTheme, setLanguage, t }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
