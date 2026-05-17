import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserRole } from '@/types';
import { supabase } from '@/lib/supabase';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface UsersState {
  users: AppUser[];
  _synced: boolean;
  hydrate: () => Promise<void>;
  addUser: (data: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
  }) => Promise<{ ok: boolean; error?: string; id?: string }>;
  updateUser: (
    id: string,
    patch: Partial<Pick<AppUser, 'email' | 'name' | 'role'>>
  ) => Promise<{ ok: boolean; error?: string }>;
  removeUser: (id: string) => Promise<{ ok: boolean; error?: string }>;
  sendPasswordReset: (id: string) => Promise<{ ok: boolean; error?: string }>;
  displayNameFor: (id: string) => string;
}

function rowToUser(row: Record<string, unknown>): AppUser {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as UserRole,
  };
}

export const useUsersStore = create<UsersState>()(
  persist(
    (set, get) => ({
      users: [],
      _synced: false,

      hydrate: async () => {
        const { data, error } = await supabase
          .from('app_users')
          .select('id, email, name, role');
        if (error || !data) return;
        set({ users: data.map(rowToUser), _synced: true });
      },

      addUser: async ({ email, password, name, role }) => {
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !password || !name.trim())
          return { ok: false, error: 'All fields are required' };
        if (get().users.some((u) => u.email === trimmedEmail))
          return { ok: false, error: 'A user with this email already exists' };

        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: { action: 'create', email: trimmedEmail, password, name: name.trim(), role },
        });
        if (error || !data?.ok) {
          return { ok: false, error: error?.message ?? data?.error ?? 'Could not add user' };
        }
        const created = rowToUser(data.user);
        set((s) => ({ users: [...s.users, created] }));
        return { ok: true, id: created.id };
      },

      updateUser: async (id, patch) => {
        const users = get().users;
        const target = users.find((u) => u.id === id);
        if (!target) return { ok: false, error: 'User not found' };
        const nextEmail =
          patch.email !== undefined ? patch.email.trim().toLowerCase() : target.email;
        if (!nextEmail) return { ok: false, error: 'Email is required' };
        if (patch.email !== undefined && users.some((u) => u.id !== id && u.email === nextEmail))
          return { ok: false, error: 'Another user already has this email' };
        if (patch.role && patch.role !== 'admin' && target.role === 'admin') {
          const adminCount = users.filter((u) => u.role === 'admin').length;
          if (adminCount <= 1) return { ok: false, error: 'At least one admin must remain' };
        }
        const updated: AppUser = {
          ...target,
          email: nextEmail,
          name: patch.name !== undefined ? patch.name.trim() : target.name,
          role: patch.role ?? target.role,
        };
        set((s) => ({ users: s.users.map((u) => (u.id === id ? updated : u)) }));
        const { error } = await supabase
          .from('app_users')
          .update({
            email: updated.email,
            name: updated.name,
            role: updated.role,
          })
          .eq('id', id);
        if (error) {
          set((s) => ({ users: s.users.map((u) => (u.id === id ? target : u)) }));
          return { ok: false, error: error.message };
        }
        return { ok: true };
      },

      removeUser: async (id) => {
        const users = get().users;
        const target = users.find((u) => u.id === id);
        if (!target) return { ok: false, error: 'User not found' };
        if (target.role === 'admin') {
          const adminCount = users.filter((u) => u.role === 'admin').length;
          if (adminCount <= 1) return { ok: false, error: 'Cannot delete the last admin' };
        }
        set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: { action: 'delete', id },
        });
        if (error || !data?.ok) {
          set((s) => ({ users: [...s.users, target] }));
          return { ok: false, error: error?.message ?? 'Could not remove user' };
        }
        return { ok: true };
      },

      sendPasswordReset: async (id) => {
        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: { action: 'reset_password', id },
        });
        if (error || !data?.ok) {
          return { ok: false, error: error?.message ?? 'Could not send reset email' };
        }
        return { ok: true };
      },

      displayNameFor: (id) => {
        const user = get().users.find((u) => u.id === id);
        return user ? user.name : id;
      },
    }),
    {
      name: 'opac-users-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: () => ({}),
    }
  )
);
