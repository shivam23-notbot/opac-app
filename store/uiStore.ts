import { create } from 'zustand';
import type { ToastType } from '@/types';

interface Toast {
  type: ToastType;
  message: string;
}

interface UiState {
  toast: Toast | null;
  showToast: (type: ToastType, message: string) => void;
  hideToast: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  toast: null,
  showToast: (type, message) => set({ toast: { type, message } }),
  hideToast: () => set({ toast: null }),
}));
