import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DispatchEntry } from '@/types';
import { todayISO } from '@/lib/date';
import { useInventoryStore } from './inventoryStore';
import { supabase } from '@/lib/supabase';

interface DispatchState {
  entries: DispatchEntry[];
  hydrate: () => Promise<void>;
  record: (entry: DispatchEntry) => void;
  editEntry: (id: string, patch: Partial<DispatchEntry>) => void;
  deleteEntry: (id: string) => void;
  getTodayEntries: () => DispatchEntry[];
  getEntriesForDate: (date: string) => DispatchEntry[];
  getDispatchesByProduct: (productId: string) => DispatchEntry[];
}

function rowToEntry(row: Record<string, unknown>): DispatchEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    time: row.time as string,
    productId: row.product_id as string,
    productCode: row.product_code as string,
    bags: Number(row.bags),
    recipient: row.recipient as string,
    vehicleNumber: row.vehicle_number as string | undefined,
    notes: row.notes as string | undefined,
    recordedBy: row.recorded_by as string,
  };
}

export const useDispatchStore = create<DispatchState>()(
  persist(
    (set, get) => ({
      entries: [],

      hydrate: async () => {
        const { data } = await supabase.from('dispatch_entries').select('*');
        if (!data) return;
        set({ entries: data.map(rowToEntry) });
      },

      record: (entry) => {
        set((state) => ({ entries: [...state.entries, entry] }));
        useInventoryStore.getState().decrementStock(entry.productId, entry.bags);
        // recorded_by is filled by the DB default (auth.uid()::text).
        supabase.from('dispatch_entries').insert({
          id: entry.id,
          date: entry.date,
          time: entry.time,
          product_id: entry.productId,
          product_code: entry.productCode,
          bags: entry.bags,
          recipient: entry.recipient,
          vehicle_number: entry.vehicleNumber,
          notes: entry.notes,
        }).then(() => {});
      },

      editEntry: (id, patch) => {
        const prev = get().entries.find((e) => e.id === id);
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }));
        if (!prev) return;
        const newProductId = patch.productId ?? prev.productId;
        const newBags = patch.bags ?? prev.bags;
        const inv = useInventoryStore.getState();
        if (newProductId === prev.productId) {
          const delta = newBags - prev.bags;
          if (delta > 0) inv.decrementStock(prev.productId, delta);
          else if (delta < 0) inv.restoreStock(prev.productId, -delta);
        } else {
          inv.restoreStock(prev.productId, prev.bags);
          inv.decrementStock(newProductId, newBags);
        }
        supabase
          .from('dispatch_entries')
          .update({
            product_id: newProductId,
            product_code: patch.productCode ?? prev.productCode,
            bags: newBags,
            recipient: patch.recipient ?? prev.recipient,
            vehicle_number: patch.vehicleNumber ?? prev.vehicleNumber,
            notes: patch.notes ?? prev.notes,
          })
          .eq('id', id).then(() => {});
      },

      deleteEntry: (id) => {
        const entry = get().entries.find((e) => e.id === id);
        if (entry) {
          useInventoryStore.getState().restoreStock(entry.productId, entry.bags);
        }
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
        supabase.from('dispatch_entries').delete().eq('id', id).then(() => {});
      },

      getTodayEntries: () => get().entries.filter((e) => e.date === todayISO()),
      getEntriesForDate: (date) => get().entries.filter((e) => e.date === date),
      getDispatchesByProduct: (productId) =>
        get().entries.filter((e) => e.productId === productId),
    }),
    {
      name: 'opac-dispatch-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
