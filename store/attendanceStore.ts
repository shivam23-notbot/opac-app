import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AttendanceStatus, AttendanceRecord, SyncStatus } from '@/types';
import { todayISO } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';

export type { SyncStatus };

interface AttendanceState {
  records: Record<string, Record<string, AttendanceRecord>>;
  syncStatus: Record<string, SyncStatus>;
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  hydrate: () => Promise<void>;
  mark: (
    date: string,
    employeeId: string,
    status: AttendanceStatus,
    userId: string,
    userName: string,
    overtimeHours?: number
  ) => void;
  unmark: (date: string, employeeId: string) => void;
  toggleNight: (
    date: string,
    employeeId: string,
    userId: string,
    userName: string
  ) => void;
  getRecordsForDate: (date: string) => Record<string, AttendanceRecord>;
  getTodayRecords: () => Record<string, AttendanceRecord>;
  canEdit: (date: string, isAdmin: boolean) => boolean;
  getSyncStatus: (date: string, employeeId: string) => SyncStatus;
  retrySync: (date: string, employeeId: string) => void;
}

function syncKey(date: string, employeeId: string) {
  return `${date}:${employeeId}`;
}

async function upsertRecord(
  date: string,
  employeeId: string,
  status: AttendanceStatus,
  night: boolean,
  userName: string,
  recordedAt: string,
  overtimeHours?: number
) {
  // First try to delete any existing record, then insert fresh.
  // This avoids RLS UPDATE policy failures when a different user
  // originally recorded the row (the WITH CHECK on recorded_by
  // pins UPDATE to the original author, but any authenticated user
  // should be able to re-mark attendance).
  await supabase
    .from('attendance')
    .delete()
    .match({ date, employee_id: employeeId });

  const { error } = await supabase.from('attendance').insert({
    id: generateId(),
    date,
    employee_id: employeeId,
    status,
    night,
    overtime_hours: overtimeHours ?? null,
    recorded_by_name: userName,
    recorded_at: recordedAt,
  });

  if (error) {
    console.error(
      `[Attendance sync] Failed for ${date}:${employeeId}:`,
      error.message,
      error.code,
      error.details
    );
  }
  return error;
}

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set, get) => ({
      records: {},
      syncStatus: {},
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
            night: (row.night as boolean) ?? false,
            overtimeHours: row.overtime_hours != null ? Number(row.overtime_hours) : undefined,
            recordedBy: row.recorded_by as string,
            recordedByName: row.recorded_by_name as string | undefined,
            recordedAt: row.recorded_at as string,
          };
        }
        set({ records, _hasHydrated: true, syncStatus: {} });
      },

      mark: (date, employeeId, status, userId, userName, overtimeHours) => {
        const recordedAt = new Date().toISOString();
        const key = syncKey(date, employeeId);
        // When marking absent, clear night and overtime. Otherwise preserve existing night.
        const existingNight = status === 'absent' ? false : (get().records[date]?.[employeeId]?.night ?? false);
        const effectiveOvertime = status === 'absent' ? undefined : overtimeHours;

        set((state) => ({
          records: {
            ...state.records,
            [date]: {
              ...(state.records[date] ?? {}),
              [employeeId]: {
                employeeId,
                status,
                night: existingNight,
                overtimeHours: effectiveOvertime,
                recordedBy: userId,
                recordedByName: userName,
                recordedAt,
              },
            },
          },
          syncStatus: { ...state.syncStatus, [key]: 'syncing' },
        }));

        upsertRecord(date, employeeId, status, existingNight, userName, recordedAt, effectiveOvertime)
          .then((error) => {
            set((state) => ({
              syncStatus: { ...state.syncStatus, [key]: error ? 'error' : 'synced' },
            }));
          });
      },

      unmark: (date, employeeId) => {
        const key = syncKey(date, employeeId);
        set((state) => {
          const dateRecords = { ...(state.records[date] ?? {}) };
          delete dateRecords[employeeId];
          const newSync = { ...state.syncStatus };
          delete newSync[key];
          return { records: { ...state.records, [date]: dateRecords }, syncStatus: newSync };
        });
        supabase.from('attendance').delete().match({ date, employee_id: employeeId }).then(() => {});
      },

      toggleNight: (date, employeeId, userId, userName) => {
        const recordedAt = new Date().toISOString();
        const key = syncKey(date, employeeId);
        const existing = get().records[date]?.[employeeId];
        // Night is "on" if the night boolean is true OR if status === 'night' (night-only encoding)
        const wasNight = (existing?.night ?? false) || existing?.status === 'night';
        const newNight = !wasNight;

        // Preserve the day status (full / hours), but not 'absent' or 'night'.
        const rawStatus = existing?.status;
        const dayStatus: AttendanceStatus | undefined =
          rawStatus && rawStatus !== 'night' && rawStatus !== 'absent' ? rawStatus : undefined;
        const existingOvertime = existing?.overtimeHours;

        if (!newNight && !dayStatus) {
          // Night turned off and no day shift — unmark completely
          set((state) => {
            const dateRecords = { ...(state.records[date] ?? {}) };
            delete dateRecords[employeeId];
            const newSync = { ...state.syncStatus };
            delete newSync[key];
            return { records: { ...state.records, [date]: dateRecords }, syncStatus: newSync };
          });
          supabase.from('attendance').delete().match({ date, employee_id: employeeId }).then(() => {});
          return;
        }

        // Night-only: status='night', night=false (the boolean is redundant for night-only)
        // Day+night: dayStatus with night=true
        const newStatus: AttendanceStatus = dayStatus ?? 'night';
        // For night-only, night boolean is false (status carries the info). For day+night, night=true.
        const nightBool = dayStatus !== undefined ? newNight : false;

        set((state) => ({
          records: {
            ...state.records,
            [date]: {
              ...(state.records[date] ?? {}),
              [employeeId]: {
                employeeId,
                status: newStatus,
                night: nightBool,
                overtimeHours: existingOvertime,
                recordedBy: userId,
                recordedByName: userName,
                recordedAt,
              },
            },
          },
          syncStatus: { ...state.syncStatus, [key]: 'syncing' },
        }));

        upsertRecord(date, employeeId, newStatus, nightBool, userName, recordedAt, existingOvertime)
          .then((error) => {
            set((state) => ({
              syncStatus: { ...state.syncStatus, [key]: error ? 'error' : 'synced' },
            }));
          });
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
      getSyncStatus: (date, employeeId) => {
        return get().syncStatus[syncKey(date, employeeId)] ?? 'synced';
      },
      retrySync: (date, employeeId) => {
        const rec = get().records[date]?.[employeeId];
        if (!rec) return;
        const key = syncKey(date, employeeId);
        if (get().syncStatus[key] !== 'error') return;

        set((state) => ({
          syncStatus: { ...state.syncStatus, [key]: 'syncing' },
        }));

        upsertRecord(
          date,
          employeeId,
          rec.status,
          rec.night,
          rec.recordedByName ?? '',
          rec.recordedAt,
          rec.overtimeHours
        ).then((error) => {
          set((state) => ({
            syncStatus: {
              ...state.syncStatus,
              [key]: error ? 'error' : 'synced',
            },
          }));
        });
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
