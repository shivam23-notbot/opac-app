import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Worker, AdvancePayment } from '@/types';
import { generateId } from '@/lib/utils';
import { todayISO } from '@/lib/date';
import { supabase } from '@/lib/supabase';

interface WorkersState {
  workers: Worker[];
  advances: AdvancePayment[];
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  hydrate: () => Promise<void>;
  addWorker: (
    data: { name: string; dailyWage: number; previousBalance: number; createdAt?: string },
    userId: string
  ) => Promise<string>;
  removeWorker: (id: string) => void;
  settleWorker: (id: string) => void;
  unsettleWorker: (id: string) => void;
  addAdvance: (
    data: { workerId: string; amount: number; date: string; note?: string },
    userId: string
  ) => void;
  getActiveWorkers: () => Worker[];
  getWorkersForDate: (date: string) => Worker[];
  getWorkerAdvances: (workerId: string) => AdvancePayment[];
  getTotalAdvances: (workerId: string, upToDate?: string) => number;
}

function rowToWorker(row: Record<string, unknown>): Worker {
  return {
    id: row.id as string,
    name: row.name as string,
    dailyWage: Number(row.daily_wage),
    previousBalance: Number(row.previous_balance),
    active: row.active as boolean,
    settled: row.settled as boolean | undefined,
    settledAt: row.settled_at as string | undefined,
    removedAt: row.removed_at as string | undefined,
    createdAt: row.created_at as string,
  };
}

function rowToAdvance(row: Record<string, unknown>): AdvancePayment {
  return {
    id: row.id as string,
    workerId: row.worker_id as string,
    amount: Number(row.amount),
    date: row.date as string,
    note: row.note as string | undefined,
    recordedBy: row.recorded_by as string,
  };
}

export const useWorkersStore = create<WorkersState>()(
  persist(
    (set, get) => ({
      workers: [],
      advances: [],
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      hydrate: async () => {
        const [{ data: wData }, { data: aData }] = await Promise.all([
          supabase.from('workers').select('*'),
          supabase.from('advances').select('*'),
        ]);
        set({
          workers: (wData ?? []).map(rowToWorker),
          advances: (aData ?? []).map(rowToAdvance),
          _hasHydrated: true,
        });
      },

      addWorker: async ({ name, dailyWage, previousBalance, createdAt: rawDate }, _userId) => {
        const id = generateId();
        const createdAt = (rawDate && rawDate <= todayISO()) ? rawDate : todayISO();
        const w: Worker = { id, name, dailyWage, previousBalance, active: true, createdAt };
        set((s) => ({ workers: [...s.workers, w] }));
        await supabase.from('workers').insert({
          id,
          name,
          daily_wage: dailyWage,
          previous_balance: previousBalance,
          active: true,
          settled: false,
          created_at: createdAt,
        });
        return id;
      },

      removeWorker: (id) => {
        const removedAt = new Date().toISOString();
        set((s) => ({
          workers: s.workers.map((w) => (w.id === id ? { ...w, active: false, removedAt } : w)),
        }));
        supabase.from('workers').update({ active: false, removed_at: removedAt }).eq('id', id).then(() => {});
      },

      settleWorker: (id) => {
        const settledAt = new Date().toISOString();
        set((s) => ({
          workers: s.workers.map((w) => (w.id === id ? { ...w, settled: true, settledAt } : w)),
        }));
        supabase.from('workers').update({ settled: true, settled_at: settledAt }).eq('id', id).then(() => {});
      },

      unsettleWorker: (id) => {
        set((s) => ({
          workers: s.workers.map((w) =>
            w.id === id ? { ...w, settled: false, settledAt: undefined } : w
          ),
        }));
        supabase
          .from('workers')
          .update({ settled: false, settled_at: null })
          .eq('id', id).then(() => {});
      },

      addAdvance: ({ workerId, amount, date, note }, userId) => {
        const id = generateId();
        const advance: AdvancePayment = { id, workerId, amount, date, note, recordedBy: userId };
        set((s) => ({ advances: [...s.advances, advance] }));
        // recorded_by is filled by the DB default (auth.uid()::text).
        supabase.from('advances').insert({
          id,
          worker_id: workerId,
          amount,
          date,
          note,
        }).then(() => {});
      },

      getActiveWorkers: () => get().workers.filter((w) => w.active),
      getWorkersForDate: (date) =>
        get().workers.filter((w) => {
          if (w.createdAt > date) return false;
          if (w.active) return true;
          const removedDate = w.removedAt ? w.removedAt.slice(0, 10) : null;
          return !!(removedDate && removedDate > date);
        }),
      getWorkerAdvances: (workerId) => get().advances.filter((a) => a.workerId === workerId),
      getTotalAdvances: (workerId, upToDate) =>
        get()
          .advances.filter((a) => {
            if (a.workerId !== workerId) return false;
            if (upToDate) return a.date <= upToDate;
            return true;
          })
          .reduce((sum, a) => sum + a.amount, 0),
    }),
    {
      name: 'opac-workers-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ workers: state.workers, advances: state.advances }),
    }
  )
);
