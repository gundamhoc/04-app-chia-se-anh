import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '../components/Toast';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{
    visible: boolean;
    type: ToastType;
    message: string;
    duration: number;
  }>({
    visible: false,
    type: 'info',
    message: '',
    duration: 3000,
  });

  // Ref để track xem toast đang show không, giúp re-trigger đúng cách
  const isShowingRef = useRef(false);

  const showToast = useCallback((type: ToastType, message: string, duration: number = 3000) => {
    if (isShowingRef.current) {
      // Nếu đang show toast khác: tắt trước, rồi bật toast mới sau 1 frame
      setToast((prev) => ({ ...prev, visible: false }));
      requestAnimationFrame(() => {
        setToast({ visible: true, type, message, duration });
        isShowingRef.current = true;
      });
    } else {
      setToast({ visible: true, type, message, duration });
      isShowingRef.current = true;
    }
  }, []);

  const hideToast = useCallback(() => {
    isShowingRef.current = false;
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onHide={hideToast}
        duration={toast.duration}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
