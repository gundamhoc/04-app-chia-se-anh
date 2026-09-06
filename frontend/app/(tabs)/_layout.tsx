import { Tabs } from 'expo-router';
import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../../constants/Colors';

const C = Colors.dark;

// Icon đơn giản dạng emoji/text (không cần icon library giai đoạn này)
function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={styles.iconText}>{icon}</Text>
      {focused && <View style={styles.dot} />}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.tabIconDefault,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: C.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Hồ sơ',
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" label="Profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: C.card,
    borderTopColor: C.border,
    borderTopWidth: 1,
    height: 70,
    paddingBottom: 10,
    paddingTop: 8,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 44,
    borderRadius: 12,
  },
  tabIconFocused: {
    backgroundColor: `${Colors.dark.primary}20`,
  },
  iconText: {
    fontSize: 22,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.primary,
    marginTop: 2,
  },
});
