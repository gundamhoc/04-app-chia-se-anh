import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/Colors';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const C = Colors.dark;

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

type DetailModalType =
  | 'account_detail'
  | 'privacy_detail'
  | 'security_detail'
  | 'accessibility_detail'
  | 'help_center'
  | 'privacy_center'
  | 'terms_policies'
  | 'app_version'
  | null;

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Switch states for Display & Content
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyPosts, setNotifyPosts] = useState(true);
  const [notifyInteractions, setNotifyInteractions] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'vi' | 'en'>('vi');

  // Sub-detail modal
  const [activeDetail, setActiveDetail] = useState<DetailModalType>(null);

  // 1. Chia sẻ hồ sơ
  const handleShareProfile = async () => {
    try {
      const profileLink = `https://masita.app/u/${user?.username || 'me'}`;
      await Clipboard.setStringAsync(profileLink);
      showToast('success', 'Đã sao chép liên kết hồ sơ của bạn vào khay nhớ tạm! 📋');
    } catch {
      showToast('info', `Liên kết hồ sơ của bạn: https://masita.app/u/${user?.username || 'me'}`);
    }
  };

  // Render detail contents
  const renderDetailContent = () => {
    switch (activeDetail) {
      case 'account_detail':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>👤 Thông tin tài khoản</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tên hiển thị:</Text>
              <Text style={styles.detailValue}>{user?.full_name || user?.username}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tên người dùng:</Text>
              <Text style={styles.detailValue}>@{user?.username}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email đăng ký:</Text>
              <Text style={styles.detailValue}>{user?.email || '-'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>ID tài khoản:</Text>
              <Text style={styles.detailValue}>#{user?.id}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Trạng thái:</Text>
              <Text style={[styles.detailValue, { color: '#34C759' }]}>Đang hoạt động ✓</Text>
            </View>
          </View>
        );

      case 'privacy_detail':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>🔒 Cài đặt quyền riêng tư</Text>
            <Text style={styles.detailDesc}>
              Quản lý phạm vi hiển thị các khoảnh khắc và bài đăng của bạn trên Masita.
            </Text>
            <View style={styles.privacyOption}>
              <Text style={styles.privacyOptionTitle}>🌐 Chế độ Công khai</Text>
              <Text style={styles.privacyOptionDesc}>
                Cho phép tất cả người dùng trong hệ thống (kể cả chưa kết bạn) xem bài đăng trong mục Khám phá.
              </Text>
            </View>
            <View style={styles.privacyOption}>
              <Text style={styles.privacyOptionTitle}>👥 Chế độ Bạn bè (Mặc định)</Text>
              <Text style={styles.privacyOptionDesc}>
                Chỉ những bạn bè đã được chấp nhận kết bạn mới thấy khoảnh khắc của bạn trên Bảng tin.
              </Text>
            </View>
            <View style={styles.privacyOption}>
              <Text style={styles.privacyOptionTitle}>🔒 Chế độ Riêng tư</Text>
              <Text style={styles.privacyOptionDesc}>
                Chỉ duy nhất một mình bạn có thể xem lại bài viết này, bạn bè và người lạ không thể xem.
              </Text>
            </View>
          </View>
        );

      case 'security_detail':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>🛡️ Bảo mật & Quyền ứng dụng</Text>
            <Text style={styles.detailDesc}>
              Bảo vệ thông tin tài khoản và kiểm soát các quyền truy cập trên thiết bị di động.
            </Text>
            <View style={styles.securityItem}>
              <Text style={styles.securityItemTitle}>🔑 Mật khẩu tài khoản</Text>
              <Text style={styles.securityItemDesc}>Mật khẩu được mã hóa an toàn bcrypt 10 rounds.</Text>
            </View>
            <View style={styles.securityItem}>
              <Text style={styles.securityItemTitle}>📷 Quyền Máy ảnh & Bộ nhớ ảnh</Text>
              <Text style={styles.securityItemDesc}>
                Chỉ truy cập khi bạn thực hiện chụp ảnh hoặc đăng tải khoảnh khắc Locket.
              </Text>
            </View>
            <View style={styles.securityItem}>
              <Text style={styles.securityItemTitle}>📱 Phiên đăng nhập</Text>
              <Text style={styles.securityItemDesc}>Được lưu trữ an toàn bằng mã JWT qua SecureStore.</Text>
            </View>
          </View>
        );

      case 'accessibility_detail':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>♿ Cài đặt trợ năng</Text>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Độ tương phản cao</Text>
                <Text style={styles.switchSub}>Tăng độ rõ nét của chữ và biểu tượng</Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={setHighContrast}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.separator} />
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Giảm hiệu ứng chuyển động</Text>
                <Text style={styles.switchSub}>Tối ưu tốc độ tải và giảm hoạt cảnh</Text>
              </View>
              <Switch
                value={reduceMotion}
                onValueChange={setReduceMotion}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        );

      case 'help_center':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>❓ Trung tâm trợ giúp</Text>
            <Text style={styles.detailDesc}>
              Giải đáp thắc mắc và hỗ trợ người dùng ứng dụng mạng xã hội Masita.
            </Text>
            <View style={styles.faqItem}>
              <Text style={styles.faqQ}>1. Làm sao để chia sẻ khoảnh khắc với bạn bè?</Text>
              <Text style={styles.faqA}>Nhấn nút dấu (+) trên thanh điều hướng để chụp ảnh hoặc chọn ảnh đăng tải.</Text>
            </View>
            <View style={styles.faqItem}>
              <Text style={styles.faqQ}>2. Làm sao để kết bạn mới?</Text>
              <Text style={styles.faqA}>Vào tab Bạn bè, xem mục Gợi ý kết bạn hoặc sử dụng thanh tìm kiếm để kết nối.</Text>
            </View>
            <View style={styles.faqItem}>
              <Text style={styles.faqQ}>3. Làm sao để đổi ảnh nền cuộc trò chuyện?</Text>
              <Text style={styles.faqA}>Vào phòng chat, nhấn nút bánh răng cài đặt và chọn "Đổi chủ đề chat".</Text>
            </View>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => showToast('info', 'Liên hệ hỗ trợ: support@masita.app')}
            >
              <Text style={styles.contactBtnText}>📧 Liên hệ đội ngũ hỗ trợ</Text>
            </TouchableOpacity>
          </View>
        );

      case 'privacy_center':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>🛡️ Trung tâm quyền riêng tư</Text>
            <Text style={styles.detailDesc}>
              Masita cam kết bảo vệ dữ liệu cá nhân của bạn với các tiêu chuẩn an toàn cao nhất:
            </Text>
            <Text style={styles.bulletPoint}>• Tin nhắn cá nhân được mã hóa và chỉ lưu trữ bảo mật.</Text>
            <Text style={styles.bulletPoint}>• Hình ảnh và khoảnh khắc riêng tư không bao giờ được chia sẻ ra ngoài.</Text>
            <Text style={styles.bulletPoint}>• Bạn hoàn toàn kiểm soát ai có thể xem bài viết và gửi tin nhắn cho bạn.</Text>
            <Text style={styles.bulletPoint}>• Bạn có quyền xóa vĩnh viễn bài đăng hoặc tài khoản bất cứ lúc nào.</Text>
          </View>
        );

      case 'terms_policies':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>📜 Điều khoản và chính sách</Text>
            <Text style={styles.detailDesc}>
              Các quy định khi tham gia cộng đồng mạng xã hội Masita:
            </Text>
            <Text style={styles.bulletPoint}>1. Tôn trọng người khác: Không đăng tải nội dung quấy rối, xúc phạm.</Text>
            <Text style={styles.bulletPoint}>2. Bảo vệ bản quyền: Không chia sẻ hình ảnh vi phạm pháp luật.</Text>
            <Text style={styles.bulletPoint}>3. Tính xác thực: Không tạo tài khoản giả mạo người khác.</Text>
            <Text style={styles.bulletPoint}>4. Bảo vệ cộng đồng: Báo cáo các hành vi vi phạm chuẩn mực đạo đức.</Text>
          </View>
        );

      case 'app_version':
        return (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>🚀 Phiên bản cập nhật</Text>
            <View style={styles.versionHeader}>
              <Text style={styles.versionNumber}>Masita v1.2.0</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionBadgeText}>Bản mới nhất ✓</Text>
              </View>
            </View>
            <Text style={styles.detailDesc}>
              Bản phát hành chính thức tích hợp chia sẻ khoảnh khắc Locket, tin nhắn realtime, chat nhóm, tùy chỉnh chủ đề và phân quyền bài viết 3 cấp độ.
            </Text>
            <TouchableOpacity
              style={styles.checkUpdateBtn}
              onPress={() => showToast('success', 'Ứng dụng của bạn đang ở phiên bản mới nhất! ✨')}
            >
              <Text style={styles.checkUpdateBtnText}>Kiểm tra cập nhật</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cài đặt</Text>
          <View style={styles.headerRightSpacer} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ================= SECTION 1: TÀI KHOẢN ================= */}
          <Text style={styles.sectionHeader}>Tài khoản</Text>
          <View style={styles.card}>
            {/* 1. Tài khoản */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('account_detail')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(108, 99, 255, 0.15)' }]}>
                <Text style={styles.itemIcon}>👤</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Tài khoản</Text>
                <Text style={styles.itemSub}>@{user?.username} • ID: #{user?.id}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 2. Quyền riêng tư */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('privacy_detail')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
                <Text style={styles.itemIcon}>🔒</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Quyền riêng tư</Text>
                <Text style={styles.itemSub}>Công khai, bạn bè, riêng tư</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 3. Bảo mật và quyền */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('security_detail')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(255, 149, 0, 0.15)' }]}>
                <Text style={styles.itemIcon}>🛡️</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Bảo mật và quyền</Text>
                <Text style={styles.itemSub}>Mật khẩu, quyền máy ảnh & bộ nhớ</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 4. Chia sẻ hồ sơ */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={handleShareProfile}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(0, 199, 190, 0.15)' }]}>
                <Text style={styles.itemIcon}>🔗</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Chia sẻ hồ sơ</Text>
                <Text style={styles.itemSub}>Sao chép liên kết trang cá nhân</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* ================= SECTION 2: NỘI DUNG HIỂN THỊ ================= */}
          <Text style={styles.sectionHeader}>Nội dung hiển thị</Text>
          <View style={styles.card}>
            {/* 1. Thông báo */}
            <View style={styles.itemRow}>
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(255, 45, 85, 0.15)' }]}>
                <Text style={styles.itemIcon}>🔔</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Thông báo</Text>
                <Text style={styles.itemSub}>Nhận thông báo tin nhắn & bài viết mới</Text>
              </View>
              <Switch
                value={notifyMessages}
                onValueChange={(val) => {
                  setNotifyMessages(val);
                  showToast('info', val ? 'Đã bật thông báo' : 'Đã tắt thông báo');
                }}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.separator} />

            {/* 2. Hiển thị */}
            <View style={styles.itemRow}>
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(175, 82, 222, 0.15)' }]}>
                <Text style={styles.itemIcon}>🌓</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Hiển thị</Text>
                <Text style={styles.itemSub}>Giao diện tối ưu (Chế độ tối)</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={(val) => {
                  setDarkMode(val);
                  showToast('info', 'Ứng dụng đang tối ưu giao diện Dark Mode');
                }}
                trackColor={{ false: '#3A3A4C', true: C.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.separator} />

            {/* 3. Ngôn ngữ */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => {
                const next = currentLanguage === 'vi' ? 'en' : 'vi';
                setCurrentLanguage(next);
                showToast('success', next === 'vi' ? 'Đã chọn Tiếng Việt' : 'Selected English');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(88, 86, 214, 0.15)' }]}>
                <Text style={styles.itemIcon}>🌐</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Ngôn ngữ</Text>
                <Text style={styles.itemSub}>
                  {currentLanguage === 'vi' ? 'Tiếng Việt (Mặc định)' : 'English'}
                </Text>
              </View>
              <View style={styles.langBadge}>
                <Text style={styles.langBadgeText}>{currentLanguage.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 4. Trợ năng */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('accessibility_detail')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(50, 173, 230, 0.15)' }]}>
                <Text style={styles.itemIcon}>♿</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Trợ năng</Text>
                <Text style={styles.itemSub}>Tương phản cao, giảm hiệu ứng chuyển động</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* ================= SECTION 3: HỖ TRỢ GIỚI THIỆU ================= */}
          <Text style={styles.sectionHeader}>Hỗ trợ giới thiệu</Text>
          <View style={styles.card}>
            {/* 1. Trung tâm trợ giúp */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('help_center')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(255, 204, 0, 0.15)' }]}>
                <Text style={styles.itemIcon}>❓</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Trung tâm trợ giúp</Text>
                <Text style={styles.itemSub}>FAQ, hướng dẫn sử dụng & liên hệ</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 2. Trung tâm quyền riêng tư */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('privacy_center')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
                <Text style={styles.itemIcon}>🛡️</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Trung tâm quyền riêng tư</Text>
                <Text style={styles.itemSub}>Cam kết bảo mật dữ liệu người dùng</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 3. Điều khoản và chính sách */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('terms_policies')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(142, 142, 147, 0.15)' }]}>
                <Text style={styles.itemIcon}>📜</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Điều khoản và chính sách</Text>
                <Text style={styles.itemSub}>Quy chuẩn cộng đồng và dịch vụ</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* 4. Phiên bản cập nhật */}
            <TouchableOpacity
              style={styles.itemRow}
              onPress={() => setActiveDetail('app_version')}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIconBox, { backgroundColor: 'rgba(108, 99, 255, 0.15)' }]}>
                <Text style={styles.itemIcon}>🚀</Text>
              </View>
              <View style={styles.itemTextBox}>
                <Text style={styles.itemTitle}>Phiên bản cập nhật</Text>
                <Text style={styles.itemSub}>Masita Mobile v1.2.0 (Mới nhất)</Text>
              </View>
              <View style={styles.versionPill}>
                <Text style={styles.versionPillText}>v1.2.0</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Detail Bottom Modal */}
        <Modal
          visible={!!activeDetail}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveDetail(null)}
        >
          <View style={styles.detailOverlay}>
            <TouchableOpacity
              style={styles.detailBackdrop}
              activeOpacity={1}
              onPress={() => setActiveDetail(null)}
            />
            <View style={styles.detailModalBox}>
              <View style={styles.detailDragBar} />
              {renderDetailContent()}
              <TouchableOpacity
                style={styles.detailCloseBtn}
                onPress={() => setActiveDetail(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.detailCloseBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: C.text,
  },
  headerRightSpacer: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: C.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  itemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIcon: {
    fontSize: 20,
  },
  itemTextBox: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textMuted,
  },
  chevron: {
    fontSize: 20,
    color: C.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: 68,
  },
  langBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: `${C.primary}25`,
    borderWidth: 1,
    borderColor: `${C.primary}50`,
  },
  langBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: C.primaryLight,
  },
  versionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  versionPillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#34C759',
  },
  // Sub-detail modal
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  detailBackdrop: {
    flex: 1,
  },
  detailModalBox: {
    backgroundColor: '#181826',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailDragBar: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailCard: {
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  detailDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  detailLabel: {
    fontSize: 13,
    color: C.textMuted,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  privacyOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  privacyOptionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  privacyOptionDesc: {
    fontSize: 12,
    color: C.textMuted,
    lineHeight: 18,
  },
  securityItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  securityItemTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  securityItemDesc: {
    fontSize: 12,
    color: C.textMuted,
    lineHeight: 18,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  switchSub: {
    fontSize: 12,
    color: C.textMuted,
  },
  faqItem: {
    marginBottom: 12,
  },
  faqQ: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.primaryLight,
    marginBottom: 2,
  },
  faqA: {
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
  },
  contactBtn: {
    marginTop: 10,
    paddingVertical: 10,
    backgroundColor: `${C.primary}20`,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${C.primary}45`,
    alignItems: 'center',
  },
  contactBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.primaryLight,
  },
  bulletPoint: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 22,
    marginBottom: 4,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  versionNumber: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  versionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  versionBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#34C759',
  },
  checkUpdateBtn: {
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: C.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkUpdateBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  detailCloseBtn: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  detailCloseBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
});
