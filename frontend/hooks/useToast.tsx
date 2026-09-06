import { useToast as useGlobalToast, ToastType } from '../context/ToastContext';

export const useToast = () => {
  const { showToast, hideToast } = useGlobalToast();

  // Component rỗng để duy trì tương thích ngược với code cũ nếu có gọi <ToastComponent />
  const ToastComponent = () => null;

  return {
    showToast,
    hideToast,
    ToastComponent,
  };
};

export type { ToastType };

