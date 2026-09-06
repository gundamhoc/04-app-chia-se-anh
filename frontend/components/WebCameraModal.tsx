import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../constants/Colors';

const C = Colors.dark;

interface WebCameraModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (imageUri: string) => void;
}

export const WebCameraModal: React.FC<WebCameraModalProps> = ({
  visible,
  onClose,
  onCapture,
}) => {
  if (Platform.OS !== 'web') {
    return null;
  }

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Khởi tạo camera khi modal mở
  useEffect(() => {
    if (!visible) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [visible, facingMode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setErrorMsg(null);
    setLoading(true);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập camera trực tiếp.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          console.warn('Lỗi play video stream:', err);
        });
      }
      setLoading(false);
    } catch (err: any) {
      console.warn('Web camera error:', err);
      setLoading(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Bạn đã chặn quyền truy cập Camera. Vui lòng cấp quyền trong cài đặt trình duyệt.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMsg('Không tìm thấy thiết bị Camera nào trên máy tính / thiết bị.');
      } else {
        setErrorMsg(err.message || 'Không thể khởi động camera.');
      }
    }
  };

  // Đổi camera trước / sau
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Chụp ảnh từ khung hình video hiện tại
  const capturePhoto = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Lật ảnh gương nếu là camera trước (selfie)
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      stopCamera();
      onCapture(dataUrl);
      onClose();
    } catch (e: any) {
      console.warn('Lỗi khi chụp ảnh từ video:', e);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Máy ảnh Masita 📸</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Camera Viewfinder */}
          <View style={styles.viewfinderContainer}>
            {loading && (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={styles.hintText}>Đang kết nối camera...</Text>
              </View>
            )}

            {errorMsg ? (
              <View style={styles.centerBox}>
                <Text style={styles.errorEmoji}>📷⚠️</Text>
                <Text style={styles.errorTitle}>Không thể mở Camera</Text>
                <Text style={styles.errorText}>{errorMsg}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={startCamera}>
                  <Text style={styles.retryText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: loading ? 'none' : 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#000',
                  overflow: 'hidden',
                  borderRadius: 16,
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                  }}
                />
              </div>
            )}
          </View>

          {/* Controls Bar */}
          {!errorMsg && (
            <View style={styles.controlsBar}>
              <TouchableOpacity style={styles.iconBtn} onPress={toggleFacingMode} disabled={loading}>
                <Text style={styles.iconBtnText}>🔄</Text>
                <Text style={styles.iconBtnLabel}>Đổi cam</Text>
              </TouchableOpacity>

              {/* Nút chụp tròn phong cách máy ảnh */}
              <TouchableOpacity
                style={[styles.shutterBtn, loading && styles.shutterBtnDisabled]}
                onPress={capturePhoto}
                disabled={loading}
                activeOpacity={0.7}
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconBtn} onPress={handleClose}>
                <Text style={styles.iconBtnText}>📁</Text>
                <Text style={styles.iconBtnLabel}>Đóng</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#161622',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewfinderContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0A0A10',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  centerBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    marginTop: 12,
    color: C.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  errorEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FF5252',
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: C.primary,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  iconBtnText: {
    fontSize: 22,
  },
  iconBtnLabel: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 4,
  },
  shutterBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  shutterBtnDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF3366',
  },
});
