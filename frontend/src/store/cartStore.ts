import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: number;
  name: string;
  priceXlm: number;
  unit: string;
  farmerPk: string;
  onChainId: number;
  quantity: number;
  maxQuantity: number;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  remove: (productId: number) => void;
  setQty: (productId: number, qty: number) => void;
  clear: () => void;
  count: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (item, qty = 1) => {
        const existing = get().items.find((i) => i.productId === item.productId);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: Math.min(i.quantity + qty, i.maxQuantity) }
                : i,
            ),
          });
        } else {
          set({ items: [...get().items, { ...item, quantity: Math.min(qty, item.maxQuantity) }] });
        }
      },

      remove: (productId) =>
        set({ items: get().items.filter((i) => i.productId !== productId) }),

      setQty: (productId, qty) =>
        set({
          items: get().items.map((i) =>
            i.productId === productId
              ? { ...i, quantity: Math.max(1, Math.min(qty, i.maxQuantity)) }
              : i,
          ),
        }),

      clear: () => set({ items: [] }),

      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'fc-cart' },
  ),
);
