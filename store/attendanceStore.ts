import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AttendanceStatus, AttendanceRecord } from '@/types';
import { todayISO } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';

interface AttendanceState {
  records: Record<string, Record<string, AttendanceRecord>>;
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  hydrate: () => Promise<void>;
  mark: (
    date: string,
    employeeId: string,
    status: AttendanceStatus,
    userId: string,
    userName: string
  ) => void;
  getRecordsForDate: (date: string) => Record<string, AttendanceRecord>;
  getTodayRecords: () => Record<string, AttendanceRecord>;
  canEdit: (date: string, isAdmin: boolean) => boolean;
}

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set, get) => ({
      records: {},
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      hydrate: async () => {
        const { data } = await supabase.from('attendance').select('*');
        if (!data) return;
        const records: Record<string, Record<string, AttendanceRecord>> = {};
        for (const row of data) {
          const date = row.date as string;
          const empId = row.employee_id as string;
          if (!records[date]) records[date] = {};
          records[date][empId] = {
            employeeId: empId,
            status: row.status as AttendanceStatus,
            recordedBy: row.recorded_by as string,
            recordedAt: row.recorded_at as string,
          };
        }
        set({ records, _hasHydrated: true });
      },

      mark: (date, employeeId, status, userId, _userName) => {
        const recordedAt = new Date().toISOString();
        // Optimistic
        set((state) => ({
          records: {
            ...state.records,
            [date]: {
              ...(state.records[date] ?? {}),
              [employeeId]: { employeeId, status, recordedBy: userId, recordedAt },
            },
          },
        }));
        // recorded_by is filled by the DB default (auth.uid()::text).
        supabase.from('attendance').upsert(
          {
            id: generateId(),
            date,
            employee_id: employeeId,
            status: JSON.stringify(status),
            recorded_at: recordedAt,
          },
          { onConflict: 'date,employee_id' }
        ).then(() => {});
      },

      getRecordsForDate: (date) => get().records[date] ?? {},
      getTodayRecords: () => get().records[todayISO()] ?? {},
      canEdit: (date, isAdmin) => {
        if (isAdmin) return true;
        const today = new Date();
        const target = new Date(date + 'T00:00:00');
        const diffDays = Math.floor((today.getTime() - target.getTime()) / 86400000);
        return diffDays <= 3;
      },
    }),
    {
      name: 'opac-attendance-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ records: state.records }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
