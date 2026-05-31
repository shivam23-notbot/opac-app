import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product, MaterialUsage } from '@/types';
import { todayISO } from '@/lib/date';
import { generateId } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface AddProductionPayload {
  closingBags: number;
  materialsUsed: MaterialUsage[];
  notes?: string;
  date?: string; // omit for today; past dates add history without changing currentBags
}

interface EditProductionPayload {
  closingBags: number;
  materialsUsed: MaterialUsage[];
  notes?: string;
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
  addProductionEntry: (productId: string, payload: AddProductionPayload) => void;
  editProductionEntry: (productId: string, entryId: string, payload: EditProductionPayload) => void;
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

// Sort a history array by (date asc, recordedAt asc) — establishes the production chain order.
function sortedHistory(history: Product['stockHistory']) {
  return [...history].sort((a, b) =>
    a.date !== b.date
      ? a.date.localeCompare(b.date)
      : a.recordedAt.localeCompare(b.recordedAt)
  );
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

      addProductionEntry: (productId, { closingBags, materialsUsed, notes, date }) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const today = todayISO();
            const entryDate = date ?? today;
            const isToday = entryDate === today;
            const now = new Date().toISOString();

            // Compute openingBags:
            // Today → use currentBags (already accounts for prior production + dispatches).
            // Past date → use the closing of the last entry on or before entryDate.
            let openingBags: number;
            if (isToday) {
              openingBags = p.currentBags;
            } else {
              const sorted = sortedHistory(p.stockHistory);
              const prev = [...sorted].reverse().find((e) => e.date <= entryDate);
              openingBags = prev?.closingBags ?? 0;
            }

            const entry = {
              id: generateId(),
              date: entryDate,
              openingBags,
              closingBags,
              materialsUsed,
              notes,
              recordedBy: 'unknown',
              recordedAt: now,
            };

            // INSERT (never upsert by date — multiple entries per day are allowed).
            supabase.from('stock_history').insert({
              id: entry.id,
              product_id: productId,
              date: entryDate,
              opening_bags: openingBags,
              closing_bags: closingBags,
              materials_used: materialsUsed,
              notes,
              recorded_at: now,
            }).then(() => {});

            const newHistory = [...p.stockHistory, entry];

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

      editProductionEntry: (productId, entryId, { closingBags, materialsUsed, notes }) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const entry = p.stockHistory.find((e) => e.id === entryId);
            if (!entry) return p;

            const delta = closingBags - entry.closingBags;
            const now = new Date().toISOString();

            // Find the immediately next entry in chain order to propagate the delta.
            const sorted = sortedHistory(p.stockHistory);
            const idx = sorted.findIndex((e) => e.id === entryId);
            const nextEntry = idx >= 0 ? sorted[idx + 1] : undefined;
            const isLast = !nextEntry;

            const newHistory = p.stockHistory.map((e) => {
              if (e.id === entryId) return { ...e, closingBags, materialsUsed, notes };
              if (nextEntry && e.id === nextEntry.id) return { ...e, openingBags: e.openingBags + delta };
              return e;
            });

            // Supabase: update the edited entry.
            supabase.from('stock_history').update({
              closing_bags: closingBags,
              materials_used: materialsUsed,
              notes,
            }).eq('id', entryId).then(() => {});

            // Propagate delta to the immediate next entry's opening.
            if (nextEntry) {
              supabase.from('stock_history').update({
                opening_bags: nextEntry.openingBags + delta,
              }).eq('id', nextEntry.id).then(() => {});
            }

            if (isLast) {
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
        return p.stockHistory
          .filter((e) => e.date === todayISO())
          .reduce((s, e) => s + Math.max(0, e.closingBags - e.openingBags), 0);
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

        // Find immediate next entry in chain order.
        const sorted = sortedHistory(currentProduct.stockHistory);
        const idx = sorted.findIndex((e) => e.id === entryId);
        const nextEntry = idx >= 0 ? sorted[idx + 1] : undefined;
        const isLast = !nextEntry;

        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const remaining = p.stockHistory.filter((e) => e.id !== entryId);

            // Shift only the immediate next entry's opening by -productionDelta.
            const finalHistory = nextEntry
              ? remaining.map((h) =>
                  h.id === nextEntry.id
                    ? { ...h, openingBags: Math.max(0, h.openingBags - productionDelta) }
                    : h
                )
              : remaining;

            // If deleting the last entry, roll currentBags back by productionDelta.
            const finalBags = isLast
              ? Math.max(0, p.currentBags - productionDelta)
              : p.currentBags;

            return { ...p, currentBags: finalBags, stockHistory: finalHistory, lastUpdated: now };
          }),
        }));

        supabase.from('stock_history').delete().eq('id', entryId).then(() => {});

        if (isLast) {
          const updatedProduct = get().products.find((p) => p.id === productId);
          if (updatedProduct) {
            supabase
              .from('products')
              .update({ current_bags: updatedProduct.currentBags, last_updated: now })
              .eq('id', productId).then(() => {});
          }
        }

        if (nextEntry) {
          const newOpeningBags = Math.max(0, nextEntry.openingBags - productionDelta);
          supabase.from('stock_history').update({ opening_bags: newOpeningBags }).eq('id', nextEntry.id).then(() => {});
        }
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
