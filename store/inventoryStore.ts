import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product, MaterialUsage } from '@/types';
import { todayISO } from '@/lib/date';
import { generateId } from '@/lib/utils';
import { supabase, fetchAll } from '@/lib/supabase';

interface AddProductionPayload {
  bagsProduced: number;
  materialsUsed: MaterialUsage[];
  notes?: string;
  date?: string;
}

interface EditProductionPayload {
  bagsProduced: number;
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
    fetchAll('products'),
    fetchAll('stock_history'),
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
        bagsProduced: Number(h.bags_produced),
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

      addProductionEntry: (productId, { bagsProduced, materialsUsed, notes, date }) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const today = todayISO();
            const entryDate = date ?? today;
            const now = new Date().toISOString();

            const sorted = sortedHistory(p.stockHistory);
            const prev = [...sorted].reverse().find((e) => e.date <= entryDate);
            // If there's a dispatch, it might have lowered currentBags. 
            // Wait, openingBags of an entry is strictly derived from the PREVIOUS entry's closingBags, EXCEPT when dispatches happen.
            // Dispatches reduce the openingBags of all subsequent entries. So using prev.closingBags is WRONG if a dispatch happened AFTER prev but BEFORE this new entry!
            // Actually, in the current system, dispatches don't record a time or order relative to production entries on the same day. 
            // The existing code did: "Today -> use currentBags. Past -> use prev closingBags."
            let openingBags: number;
            if (entryDate === today && !date) {
              openingBags = p.currentBags;
            } else {
              openingBags = prev?.closingBags ?? 0;
            }
            
            const closingBags = openingBags + bagsProduced;

            const entry = {
              id: generateId(),
              date: entryDate,
              bagsProduced,
              openingBags,
              closingBags,
              materialsUsed,
              notes,
              recordedBy: 'unknown',
              recordedAt: now,
            };

            supabase.from('stock_history').insert({
              id: entry.id,
              product_id: productId,
              date: entryDate,
              bags_produced: bagsProduced,
              opening_bags: openingBags,
              closing_bags: closingBags,
              materials_used: materialsUsed,
              notes,
              recorded_at: now,
            }).then(() => {});

            const newHistory = [...p.stockHistory, entry];
            const newlySorted = sortedHistory(newHistory);
            const idx = newlySorted.findIndex(e => e.id === entry.id);
            const subsequent = newlySorted.slice(idx + 1);
            
            const historyUpdates: Record<string, { openingBags: number, closingBags: number }> = {};
            let currentClosing = closingBags;
            subsequent.forEach((e) => {
              // the original code propagated a fixed delta to all subsequent openings. 
              // we can just add bagsProduced to all subsequent openings and closings!
              const newOpen = e.openingBags + bagsProduced;
              const newClose = e.closingBags + bagsProduced;
              historyUpdates[e.id] = { openingBags: newOpen, closingBags: newClose };
              currentClosing = newClose; // not strictly needed since we just add delta
            });

            const finalHistory = newHistory.map((h) => 
              historyUpdates[h.id] ? { ...h, openingBags: historyUpdates[h.id].openingBags, closingBags: historyUpdates[h.id].closingBags } : h
            );

            Object.entries(historyUpdates).forEach(([id, vals]) => {
              supabase.from('stock_history').update({
                opening_bags: vals.openingBags,
                closing_bags: vals.closingBags
              }).eq('id', id).then(() => {});
            });

            const newCurrentBags = p.currentBags + bagsProduced;

            supabase
              .from('products')
              .update({ current_bags: newCurrentBags, last_updated: now })
              .eq('id', productId).then(() => {});

            return { ...p, currentBags: newCurrentBags, lastUpdated: now, stockHistory: finalHistory };
          }),
        }));
      },

      editProductionEntry: (productId, entryId, { bagsProduced, materialsUsed, notes }) => {
        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const entry = p.stockHistory.find((e) => e.id === entryId);
            if (!entry) return p;

            const delta = bagsProduced - entry.bagsProduced;
            const closingBags = entry.openingBags + bagsProduced;
            const now = new Date().toISOString();

            const sorted = sortedHistory(p.stockHistory);
            const idx = sorted.findIndex((e) => e.id === entryId);
            const subsequent = sorted.slice(idx + 1);
            
            const historyUpdates: Record<string, { openingBags: number, closingBags: number }> = {};
            subsequent.forEach((e) => {
              historyUpdates[e.id] = { openingBags: e.openingBags + delta, closingBags: e.closingBags + delta };
            });

            const newHistory = p.stockHistory.map((e) => {
              if (e.id === entryId) return { ...e, bagsProduced, closingBags, materialsUsed, notes };
              if (historyUpdates[e.id]) return { ...e, openingBags: historyUpdates[e.id].openingBags, closingBags: historyUpdates[e.id].closingBags };
              return e;
            });

            supabase.from('stock_history').update({
              bags_produced: bagsProduced,
              closing_bags: closingBags,
              materials_used: materialsUsed,
              notes,
            }).eq('id', entryId).then(() => {});

            Object.entries(historyUpdates).forEach(([id, vals]) => {
              supabase.from('stock_history').update({
                opening_bags: vals.openingBags,
                closing_bags: vals.closingBags
              }).eq('id', id).then(() => {});
            });

            const newCurrentBags = p.currentBags + delta;
            
            supabase
              .from('products')
              .update({ current_bags: newCurrentBags, last_updated: now })
              .eq('id', productId).then(() => {});
            
            return { ...p, currentBags: newCurrentBags, lastUpdated: now, stockHistory: newHistory };
          }),
        }));
      },

      decrementStock: (productId, bags, dispatchDate?) => {
        const now = new Date().toISOString();
        const currentProduct = get().products.find((p) => p.id === productId);
        const historyUpdates: Record<string, { openingBags: number, closingBags: number }> = {};
        if (dispatchDate && currentProduct) {
          currentProduct.stockHistory.forEach((h) => {
            if (h.date > dispatchDate) {
              const newOpen = Math.max(0, h.openingBags - bags);
              historyUpdates[h.id] = { openingBags: newOpen, closingBags: newOpen + h.bagsProduced };
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
                      ? { ...h, openingBags: historyUpdates[h.id].openingBags, closingBags: historyUpdates[h.id].closingBags }
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
        Object.entries(historyUpdates).forEach(([id, vals]) => {
          supabase.from('stock_history').update({ opening_bags: vals.openingBags, closing_bags: vals.closingBags }).eq('id', id).then(() => {});
        });
      },

      restoreStock: (productId, bags, dispatchDate?) => {
        const now = new Date().toISOString();
        const currentProduct = get().products.find((p) => p.id === productId);
        const historyUpdates: Record<string, { openingBags: number, closingBags: number }> = {};
        if (dispatchDate && currentProduct) {
          currentProduct.stockHistory.forEach((h) => {
            if (h.date > dispatchDate) {
              const newOpen = h.openingBags + bags;
              historyUpdates[h.id] = { openingBags: newOpen, closingBags: newOpen + h.bagsProduced };
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
                      ? { ...h, openingBags: historyUpdates[h.id].openingBags, closingBags: historyUpdates[h.id].closingBags }
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
        Object.entries(historyUpdates).forEach(([id, vals]) => {
          supabase.from('stock_history').update({ opening_bags: vals.openingBags, closing_bags: vals.closingBags }).eq('id', id).then(() => {});
        });
      },

      getProduct: (productId) => get().products.find((p) => p.id === productId),

      getProductionToday: (productId) => {
        const p = get().products.find((pr) => pr.id === productId);
        if (!p) return 0;
        return p.stockHistory
          .filter((e) => e.date === todayISO())
          .reduce((s, e) => s + e.bagsProduced, 0);
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
                  bagsProduced: currentBags,
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
            bags_produced: currentBags,
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

        const productionDelta = entry.bagsProduced;
        const now = new Date().toISOString();

        const sorted = sortedHistory(currentProduct.stockHistory);
        const idx = sorted.findIndex((e) => e.id === entryId);
        const subsequent = sorted.slice(idx + 1);

        const historyUpdates: Record<string, { openingBags: number, closingBags: number }> = {};
        subsequent.forEach((e) => {
          historyUpdates[e.id] = { openingBags: Math.max(0, e.openingBags - productionDelta), closingBags: Math.max(0, e.closingBags - productionDelta) };
        });

        set((state) => ({
          products: state.products.map((p) => {
            if (p.id !== productId) return p;
            const remaining = p.stockHistory.filter((e) => e.id !== entryId);

            const finalHistory = remaining.map((h) =>
              historyUpdates[h.id] !== undefined
                ? { ...h, openingBags: historyUpdates[h.id].openingBags, closingBags: historyUpdates[h.id].closingBags }
                : h
            );

            const finalBags = Math.max(0, p.currentBags - productionDelta);

            return { ...p, currentBags: finalBags, stockHistory: finalHistory, lastUpdated: now };
          }),
        }));

        supabase.from('stock_history').delete().eq('id', entryId).then(() => {});

        const updatedProduct = get().products.find((p) => p.id === productId);
        if (updatedProduct) {
          supabase
            .from('products')
            .update({ current_bags: updatedProduct.currentBags, last_updated: now })
            .eq('id', productId).then(() => {});
        }

        Object.entries(historyUpdates).forEach(([id, vals]) => {
          supabase.from('stock_history').update({ opening_bags: vals.openingBags, closing_bags: vals.closingBags }).eq('id', id).then(() => {});
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
