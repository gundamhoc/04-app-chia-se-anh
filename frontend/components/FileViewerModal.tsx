import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/Colors';
import { messageService } from '../services/messageService';
import { useToast } from '../hooks/useToast';

const C = Colors.dark;

interface FileViewerModalProps {
  visible: boolean;
  messageId: number | null;
  fileName: string | null;
  fileSize?: number | null;
  fileUrl?: string | null;
  onClose: () => void;
  onDownload: (fileUrl: string, fileName: string) => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  visible,
  messageId,
  fileName,
  fileSize,
  fileUrl,
  onClose,
  onDownload,
}) => {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tải nội dung text/code từ máy chủ
  useEffect(() => {
    if (!visible || !messageId) {
      setContent('');
      setError(null);
      setCopied(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    messageService
      .getFileContent(messageId)
      .then((data) => {
        if (isMounted) {
          setContent(data.content);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Lỗi đọc nội dung file:', err);
          setError('Không thể đọc nội dung tệp tin này hoặc định dạng không hỗ trợ.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [visible, messageId]);

  // Sao chép toàn bộ nội dung
  const handleCopy = async () => {
    if (!content) return;
    try {
      await Clipboard.setStringAsync(content);
      setCopied(true);
      showToast('success', 'Đã sao chép toàn bộ nội dung vào bộ nhớ tạm!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('error', 'Không thể sao chép nội dung.');
    }
  };

  // Định dạng dung lượng
  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!visible) return null;

  const lines = content ? content.split('\n') : [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBox}>
              <Text style={styles.fileIcon}>📄</Text>
            </View>
            <View style={styles.titleBox}>
              <Text style={styles.fileName} numberOfLines={1}>
                {fileName || 'Tệp tin'}
              </Text>
              <Text style={styles.fileSub}>
                {formatFileSize(fileSize)} {lines.length > 0 ? `• ${lines.length} dòng` : ''}
              </Text>
            </View>
          </View>

          {/* Action buttons: Copy, Download, Close */}
          <View style={styles.headerActions}>
            {content.length > 0 && (
              <TouchableOpacity
                style={[styles.actionBtn, copied && styles.actionBtnCopied]}
                onPress={handleCopy}
                activeOpacity={0.7}
              >
                <Text style={styles.actionBtnText}>{copied ? '✓ Đã chép' : '📋 Chép'}</Text>
              </TouchableOpacity>
            )}

            {fileUrl && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onDownload(fileUrl, fileName || 'download')}
                activeOpacity={0.7}
              >
                <Text style={styles.actionBtnText}>⬇️ Tải</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Viewer */}
        <View style={styles.editorArea}>
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.loadingText}>Đang đọc tệp tin...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
              {fileUrl && (
                <TouchableOpacity
                  style={styles.errorDownloadBtn}
                  onPress={() => onDownload(fileUrl, fileName || 'download')}
                >
                  <Text style={styles.errorDownloadText}>⬇️ Tải tệp về thiết bị để mở</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView
              style={styles.verticalScroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                contentContainerStyle={styles.horizontalContent}
              >
                <View style={styles.codeContainer}>
                  {/* Cột số dòng */}
                  <View style={styles.gutter}>
                    {lines.map((_, index) => (
                      <Text key={index} style={styles.lineNumber}>
                        {index + 1}
                      </Text>
                    ))}
                  </View>

                  {/* Cột mã nguồn / văn bản */}
                  <View style={styles.codeLines}>
                    {lines.map((line, index) => (
                      <Text
                        key={index}
                        style={styles.codeText}
                        selectable
                      >
                        {line || ' '}
                      </Text>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#161B22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fileIcon: {
    fontSize: 18,
  },
  titleBox: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#F0F6FC',
  },
  fileSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#8B949E',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#21262D',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  actionBtnCopied: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderColor: '#00E676',
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#E6EDF3',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#21262D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#8B949E',
    fontWeight: 'bold',
  },
  editorArea: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8B949E',
    fontFamily: 'Inter_400Regular',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#F85149',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  errorDownloadBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.primary,
    borderRadius: 10,
  },
  errorDownloadText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  verticalScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  horizontalContent: {
    minWidth: '100%',
  },
  codeContainer: {
    flexDirection: 'row',
  },
  gutter: {
    paddingLeft: 12,
    paddingRight: 14,
    borderRightWidth: 1,
    borderRightColor: '#21262D',
    alignItems: 'flex-end',
    userSelect: 'none',
  },
  lineNumber: {
    fontSize: 12,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#484F58',
  },
  codeLines: {
    paddingLeft: 14,
    paddingRight: 24,
    flex: 1,
  },
  codeText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#C9D1D9',
  },
});
