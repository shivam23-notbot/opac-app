import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DispatchEntry, SyncStatus } from '@/types';
import { todayISO } from '@/lib/date';
import { useInventoryStore } from './inventoryStore';
import { supabase } from '@/lib/supabase';

export type { SyncStatus };

interface DispatchState {
  entries: DispatchEntry[];
  syncStatus: Record<string, SyncStatus>;
  hydrate: () => Promise<void>;
  record: (entry: DispatchEntry) => void;
  editEntry: (id: string, patch: Partial<DispatchEntry>) => void;
  deleteEntry: (id: string) => void;
  getTodayEntries: () => DispatchEntry[];
  getEntriesForDate: (date: string) => DispatchEntry[];
  getDispatchesByProduct: (productId: string) => DispatchEntry[];
  retrySync: (id: string) => void;
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

function entryToRow(entry: DispatchEntry) {
  return {
    id: entry.id,
    date: entry.date,
    time: entry.time,
    product_id: entry.productId,
    product_code: entry.productCode,
    bags: entry.bags,
    recipient: entry.recipient,
    vehicle_number: entry.vehicleNumber,
    notes: entry.notes,
  };
}

export const useDispatchStore = create<DispatchState>()(
  persist(
    (set, get) => ({
      entries: [],
      syncStatus: {},

      hydrate: async () => {
        const { data } = await supabase.from('dispatch_entries').select('*');
        if (!data) return;
        set({ entries: data.map(rowToEntry), syncStatus: {} });
      },

      record: (entry) => {
        const inv = useInventoryStore.getState();
        const product = inv.getProduct(entry.productId);
        if (!product || product.currentBags < entry.bags) return;

        set((state) => ({
          entries: [...state.entries, entry],
          syncStatus: { ...state.syncStatus, [entry.id]: 'syncing' },
        }));
        inv.decrementStock(entry.productId, entry.bags, entry.date);

        supabase
          .from('dispatch_entries')
          .insert(entryToRow(entry))
          .then(({ error }) => {
            set((state) => ({
              syncStatus: { ...state.syncStatus, [entry.id]: error ? 'error' : 'synced' },
            }));
          });
      },

      editEntry: (id, patch) => {
        const prev = get().entries.find((e) => e.id === id);
        if (!prev) return;
        const updated = { ...prev, ...patch };

        const newProductId = patch.productId ?? prev.productId;
        const newBags = patch.bags ?? prev.bags;
        const inv = useInventoryStore.getState();

        // currentBags is already decremented by prev.bags, so effective ceiling = currentBags + prev.bags
        if (newProductId === prev.productId) {
          const availableStock = (inv.getProduct(prev.productId)?.currentBags ?? 0) + prev.bags;
          if (newBags > availableStock) return;
        } else {
          const availableStock = inv.getProduct(newProductId)?.currentBags ?? 0;
          if (newBags > availableStock) return;
        }

        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? updated : e)),
          syncStatus: { ...state.syncStatus, [id]: 'syncing' },
        }));

        if (newProductId === prev.productId) {
          const delta = newBags - prev.bags;
          if (delta > 0) inv.decrementStock(prev.productId, delta, updated.date);
          else if (delta < 0) inv.restoreStock(prev.productId, -delta, updated.date);
        } else {
          inv.restoreStock(prev.productId, prev.bags, prev.date);
          inv.decrementStock(newProductId, newBags, updated.date);
        }

        supabase
          .from('dispatch_entries')
          .update({
            product_id: updated.productId,
            product_code: updated.productCode,
            bags: updated.bags,
            recipient: updated.recipient,
            vehicle_number: updated.vehicleNumber,
            notes: updated.notes,
          })
          .eq('id', id)
          .then(({ error }) => {
            set((state) => ({
              syncStatus: { ...state.syncStatus, [id]: error ? 'error' : 'synced' },
            }));
          });
      },

      deleteEntry: (id) => {
        const entry = get().entries.find((e) => e.id === id);
        if (entry) {
          useInventoryStore.getState().restoreStock(entry.productId, entry.bags, entry.date);
        }
        set((state) => {
          const newSync = { ...state.syncStatus };
          delete newSync[id];
          return {
            entries: state.entries.filter((e) => e.id !== id),
            syncStatus: newSync,
          };
        });
        supabase.from('dispatch_entries').delete().eq('id', id).then(() => {});
      },

      getTodayEntries: () => get().entries.filter((e) => e.date === todayISO()),
      getEntriesForDate: (date) => get().entries.filter((e) => e.date === date),
      getDispatchesByProduct: (productId) =>
        get().entries.filter((e) => e.productId === productId),

      retrySync: (id) => {
        const { entries, syncStatus } = get();
        const entry = entries.find((e) => e.id === id);
        if (!entry || syncStatus[id] !== 'error') return;

        set((state) => ({
          syncStatus: { ...state.syncStatus, [id]: 'syncing' },
        }));

        // Upsert handles both "never reached server" and "partially applied" cases.
        // The same user is retrying their own entry so RLS update check passes.
        supabase
          .from('dispatch_entries')
          .upsert(entryToRow(entry), { onConflict: 'id' })
          .then(({ error }) => {
            set((state) => ({
              syncStatus: { ...state.syncStatus, [id]: error ? 'error' : 'synced' },
            }));
          });
      },
    }),
    {
      name: 'opac-dispatch-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ entries: state.entries }),
    }
  )
);
