import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';

const C = Colors.dark;

export default function HomeScreen() {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <StatusBar style="light" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* App Bar */}
        <View style={styles.appBar}>
          <Text style={styles.appName}>Masita</Text>
          <View style={[styles.socketBadge, isConnected ? styles.socketOn : styles.socketOff]}>
            <View style={[styles.socketDot, isConnected ? styles.dotOn : styles.dotOff]} />
            <Text style={styles.socketText}>{isConnected ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeInner}>
            <Text style={styles.welcomeEmoji}>👋</Text>
            <Text style={styles.welcomeTitle}>
              Xin chào, {user?.full_name || user?.username}!
            </Text>
            <Text style={styles.welcomeSubtitle}>
              Nền tảng đã sẵn sàng. Tính năng sẽ sớm được thêm vào.
            </Text>
          </View>
        </View>

        {/* Status Cards */}
        <Text style={styles.sectionTitle}>Trạng thái hệ thống</Text>
        <View style={styles.statusGrid}>
          <StatusCard
            icon="⚡"
            label="API Backend"
            value="Kết nối"
            color={C.success}
          />
          <StatusCard
            icon="🔌"
            label="WebSocket"
            value={isConnected ? 'Online' : 'Offline'}
            color={isConnected ? C.success : C.error}
          />
          <StatusCard
            icon="🗄️"
            label="Database"
            value="MySQL"
            color={C.primary}
          />
          <StatusCard
            icon="📦"
            label="Storage"
            value="Multer"
            color={C.primaryLight}
          />
        </View>

        {/* Placeholder */}
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>🚀</Text>
          <Text style={styles.placeholderText}>
            Tính năng đang được phát triển...
          </Text>
          <Text style={styles.placeholderSub}>
            Posts · Comments · Likes · Follow · Chat
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

function StatusCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusIcon}>{icon}</Text>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  appName: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: C.primary,
    letterSpacing: 0.5,
  },
  socketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  socketOn: { backgroundColor: `${C.success}20` },
  socketOff: { backgroundColor: `${C.error}20` },
  socketDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOn: { backgroundColor: C.success },
  dotOff: { backgroundColor: C.error },
  socketText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
  },
  welcomeCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 28,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: `${C.primary}30`,
  },
  welcomeInner: {
    padding: 24,
    alignItems: 'center',
  },
  welcomeEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statusCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  statusIcon: { fontSize: 24, marginBottom: 4 },
  statusLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  statusValue: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  placeholder: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
  },
  placeholderIcon: { fontSize: 36, marginBottom: 12 },
  placeholderText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
    marginBottom: 6,
  },
  placeholderSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
    textAlign: 'center',
  },
});
