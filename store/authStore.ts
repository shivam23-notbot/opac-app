import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, UserRole } from '@/types';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  _hasHydrated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      _hasHydrated: false,
      login: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error || !data.user) return false;
        const { data: row, error: rowErr } = await supabase
          .from('app_users')
          .select('id, name, role, email')
          .eq('auth_user_id', data.user.id)
          .single();
        if (rowErr || !row) {
          await supabase.auth.signOut();
          return false;
        }
        set({
          user: {
            id: row.id as string,
            email: row.email as string,
            name: row.name as string,
            role: row.role as UserRole,
          },
          role: row.role as UserRole,
        });
        return true;
      },
      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, role: null });
      },
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
