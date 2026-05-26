import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product, MaterialUsage } from '@/types';
import { todayISO } from '@/lib/date';
import { generateId } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface UpdateStockPayload {
  closingBags: number;
  materialsUsed: MaterialUsage[];
  notes?: string;
  recordedBy?: string;
  date?: string; // omit for today; past dates add history without updating currentBags
}

interface NewProductPayload {
  id: string;
  code: string;
  name: string;
  polymer: import('@/types').PolymerType;
  currentBags: number;
  entryDate?: string;
  recordedBy?: string;
}

interface InventoryState {
  products: Product[];
  hydrate: () => Promise<void>;
  updateStock: (productId: string, payload: UpdateStockPayload) => void;
  decrementStock: (productId: string, bags: number, dispatchDate?: string) => void;
  restoreStock: (productId: string, bags: number, dispatchDate?: string) => void;
  getProduct: (productId: string) => Product | undefined;
  getProductionToday: (productId: string) => number;
  addProduct: (payload: NewProductPayload) => void;
  deleteStockEntry: (productId: string, entryId: string) => void;
  retireProduct: (productId: string) => void;
  unretireProduct: (productId: string) => void;
  getActiveProducts: () => Product[];
  getRetiredProducts: () => Product[];
}

async function buildProducts(): Promise<Product[]> {
  const [{ data: prods }, { data: history }] = await Promise.all([
    supabase.from('products').select('*'),
    supabase.from('stock_history').select('*'),
  ]);
  if (!prods) return [];
  return prods.map((p) => ({
    id: p.id as string,
    code: p.code as string,
    name: p.name as string,
    polymer: p.polymer as Product['polymer'],
    currentBags: Number(p.current_bags),
    active: p.active as boolean,
    lastUpdated: p.last_updated as string,
    stockHistory: (history ?? [])
      .filter((h) => h.product_id === p.id)
      .map((h) => ({
        id: h.id as string,
        date: h.date as string,
        openingBags: Number(h.opening_bags),
        closingBags: Number(h.closing_bags),
        materialsUsed: h.materials_used as MaterialUsage[],
        notes: h.notes as string | undefined,
        recordedBy: h.recorded_by as string,
        recordedAt: h.recorded_at as string,
      })),
  }));
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      products: [],

      hydrate: async () => {
        const products = await buildProducts();
        set({ products });
      },

      updateStock: (productId, { closingBags, materialsUsed, notes, recordedBy, date }) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const today = todayISO();
            const entryDate = date ?? today;
            const isToday = entryDate === today;
            const existingIdx = p.stockHistory.findIndex((e) => e.date === entryDate);
            const now = new Date().toISOString();
            const openingBags =
              existingIdx >= 0
                ? p.stockHistory[existingIdx].openingBags
                : isToday
                  ? p.currentBags
                  : 0;
            const entry = {
              id: existingIdx >= 0 ? p.stockHistory[existingIdx].id : generateId(),
              date: entryDate,
              openingBags,
              closingBags,
              materialsUsed,
              notes,
              recordedBy: recordedBy ?? 'unknown',
              recordedAt: now,
            };
            const newHistory =
              existingIdx >= 0
                ? p.stockHistory.map((e, i) => (i === existingIdx ? entry : e))
                : [...p.stockHistory, entry];
            // recorded_by is filled by the DB default (auth.uid()::text).
            supabase.from('stock_history').upsert(
              {
                id: entry.id,
                product_id: productId,
                date: entryDate,
                opening_bags: openingBags,
                closing_bags: closingBags,
                materials_used: materialsUsed,
                notes,
                recorded_at: now,
              },
              { onConflict: 'product_id,date' }
            ).then(() => {});
            if (isToday) {
              supabase
                .from('products')
                .update({ current_bags: closingBags, last_updated: now })
                .eq('id', productId).then(() => {});
              return { ...p, currentBags: closingBags, lastUpdated: now, stockHistory: newHistory };
            }
            return { ...p, lastUpdated: now, stockHistory: newHistory };
          }),
        }));
      },

      decrementStock: (productId, bags, dispatchDate?) => {
        const now = new Date().toISOString();
        const currentProduct = get().products.find((p) => p.id === productId);
        // Pre-compute which stock_history entries need openingBags adjusted.
        // A dispatch on dispatchDate reduces the opening stock for all production
        // entries recorded AFTER that date (strict), because those entries captured
        // their openingBags before this dispatch was known.
        const historyUpdates: Record<string, number> = {};
        if (dispatchDate && currentProduct) {
          currentProduct.stockHistory.forEach((h) => {
            if (h.date > dispatchDate) {
              historyUpdates[h.id] = Math.max(0, h.openingBags - bags);
            }
          });
        }
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const newHistory =
              Object.keys(historyUpdates).length > 0
                ? p.stockHistory.map((h) =>
                    historyUpdates[h.id] !== undefined
                      ? { ...h, openingBags: historyUpdates[h.id] }
                      : h
                  )
                : p.stockHistory;
            return { ...p, currentBags: Math.max(0, p.currentBags - bags), lastUpdated: now, stockHistory: newHistory };
          }),
        }));
        const product = get().products.find((p) => p.id === productId);
        if (product) {
          supabase
            .from('products')
            .update({ current_bags: product.currentBags, last_updated: now })
            .eq('id', productId).then(() => {});
        }
        Object.entries(historyUpdates).forEach(([id, newOpeningBags]) => {
          supabase.from('stock_history').update({ opening_bags: newOpeningBags }).eq('id', id).then(() => {});
        });
      },

      restoreStock: (productId, bags, dispatchDate?) => {
        const now = new Date().toISOString();
        const currentProduct = get().products.find((p) => p.id === productId);
        const historyUpdates: Record<string, number> = {};
        if (dispatchDate && currentProduct) {
          currentProduct.stockHistory.forEach((h) => {
            if (h.date > dispatchDate) {
              historyUpdates[h.id] = h.openingBags + bags;
            }
          });
        }
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const newHistory =
              Object.keys(historyUpdates).length > 0
                ? p.stockHistory.map((h) =>
                    historyUpdates[h.id] !== undefined
                      ? { ...h, openingBags: historyUpdates[h.id] }
                      : h
                  )
                : p.stockHistory;
            return { ...p, currentBags: p.currentBags + bags, lastUpdated: now, stockHistory: newHistory };
          }),
        }));
        const product = get().products.find((p) => p.id === productId);
        if (product) {
          supabase
            .from('products')
            .update({ current_bags: product.currentBags, last_updated: now })
            .eq('id', productId).then(() => {});
        }
        Object.entries(historyUpdates).forEach(([id, newOpeningBags]) => {
          supabase.from('stock_history').update({ opening_bags: newOpeningBags }).eq('id', id).then(() => {});
        });
      },

      getProduct: (productId) => get().products.find((p) => p.id === productId),
      getProductionToday: (productId) => {
        const p = get().products.find((pr) => pr.id === productId);
        if (!p) return 0;
        const entry = p.stockHistory.find((e) => e.date === todayISO());
        if (!entry) return 0;
        return entry.closingBags - entry.openingBags;
      },

      addProduct: ({ id, code, name, polymer, currentBags, entryDate, recordedBy }) => {
        const date = entryDate ?? todayISO();
        const now = new Date().toISOString();
        const initialEntry =
          currentBags > 0
            ? [
                {
                  id: generateId(),
                  date,
                  openingBags: 0,
                  closingBags: currentBags,
                  materialsUsed: [],
                  notes: 'Opening stock',
                  recordedBy: recordedBy ?? 'unknown',
                  recordedAt: now,
                },
              ]
            : [];
        const product: Product = {
          id,
          code,
          name,
          polymer,
          currentBags,
          active: true,
          lastUpdated: now,
          stockHistory: initialEntry,
        };
        set((state) => ({ products: [...state.products, product] }));
        supabase.from('products').insert({
          id,
          code,
          name,
          polymer,
          current_bags: currentBags,
          active: true,
          last_updated: now,
        }).then(() => {});
        if (initialEntry.length > 0) {
          // recorded_by is filled by the DB default (auth.uid()::text).
          supabase.from('stock_history').insert({
            id: initialEntry[0].id,
            product_id: id,
            date,
            opening_bags: 0,
            closing_bags: currentBags,
            materials_used: [],
            notes: 'Opening stock',
            recorded_at: now,
          }).then(() => {});
        }
      },

      deleteStockEntry: (productId, entryId) => {
        const currentProduct = get().products.find((p) => p.id === productId);
        if (!currentProduct) return;
        const entry = currentProduct.stockHistory.find((e) => e.id === entryId);
        if (!entry) return;

        const productionDelta = entry.closingBags - entry.openingBags;
        const now = new Date().toISOString();
        const latestDate = currentProduct.stockHistory.reduce(
          (max, e) => (e.date > max ? e.date : max),
          ''
        );
        const isLatest = entry.date === latestDate;

        // Subsequent production entries had their openingBags set assuming this
        // day's production existed. Remove its contribution.
        const historyUpdates: Record<string, number> = {};
        if (productionDelta !== 0) {
          currentProduct.stockHistory.forEach((h) => {
            if (h.date > entry.date) {
              historyUpdates[h.id] = Math.max(0, h.openingBags - productionDelta);
            }
          });
        }

        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const remaining = p.stockHistory.filter((e) => e.id !== entryId);
            const finalBags = isLatest ? entry.openingBags : p.currentBags;
            const finalHistory = remaining.map((h) =>
              historyUpdates[h.id] !== undefined
                ? { ...h, openingBags: historyUpdates[h.id] }
                : h
            );
            return { ...p, currentBags: finalBags, stockHistory: finalHistory, lastUpdated: now };
          }),
        }));

        supabase.from('stock_history').delete().eq('id', entryId).then(() => {});
        if (isLatest) {
          supabase
            .from('products')
            .update({ current_bags: entry.openingBags, last_updated: now })
            .eq('id', productId).then(() => {});
        }
        Object.entries(historyUpdates).forEach(([id, newOpeningBags]) => {
          supabase.from('stock_history').update({ opening_bags: newOpeningBags }).eq('id', id).then(() => {});
        });
      },

      retireProduct: (productId) => {
        set((state) => ({
          products: state.products.map((p) => (p.id === productId ? { ...p, active: false } : p)),
        }));
        supabase.from('products').update({ active: false }).eq('id', productId).then(() => {});
      },

      unretireProduct: (productId) => {
        set((state) => ({
          products: state.products.map((p) => (p.id === productId ? { ...p, active: true } : p)),
        }));
        supabase.from('products').update({ active: true }).eq('id', productId).then(() => {});
      },

      getActiveProducts: () => get().products.filter((p) => p.active !== false),
      getRetiredProducts: () => get().products.filter((p) => p.active === false),
    }),
    {
      name: 'opac-inventory-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
