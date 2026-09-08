import { Tabs } from 'expo-router';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../utils/i18n';

// Icon đơn giản dạng emoji/text
function TabIcon({
  icon,
  focused,
  primaryColor,
}: {
  icon: string;
  focused: boolean;
  primaryColor: string;
}) {
  return (
    <View style={[styles.tabIcon, focused && { backgroundColor: `${primaryColor}22` }]}>
      <Text style={styles.iconText}>{icon}</Text>
      {focused && <View style={[styles.dot, { backgroundColor: primaryColor }]} />}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useI18n();

  // Đảm bảo khoảng đệm an toàn chuẩn xác:
  // - Android: 3 nút điều hướng hệ thống (||| O <) hoặc thanh vuốt cử chỉ (insets.bottom)
  // - iOS: Home indicator bar (insets.bottom)
  const bottomInset = insets.bottom;
  const bottomPadding = bottomInset > 0 ? bottomInset + 2 : (Platform.OS === 'android' ? 10 : 8);
  const tabHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.3 : 0.05,
          shadowRadius: 4,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏠" focused={focused} primaryColor={colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t('friends'),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👥" focused={focused} primaryColor={colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('messages'),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="💬" focused={focused} primaryColor={colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👤" focused={focused} primaryColor={colors.primary} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 44,
    borderRadius: 12,
  },
  iconText: {
    fontSize: 22,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});

