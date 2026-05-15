import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, UserRole } from '@/types';
import { useUsersStore } from './usersStore';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  _hasHydrated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      _hasHydrated: false,
      login: (email, password) => {
        const found = useUsersStore.getState().findByCredentials(email, password);
        if (!found) return false;
        const user: User = { id: found.id, email: found.email, name: found.name, role: found.role };
        set({ user, role: found.role });
        return true;
      },
      logout: () => set({ user: null, role: null }),
      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: 'opac-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user, role: state.role }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
