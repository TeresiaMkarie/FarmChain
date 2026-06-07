import { create } from 'zustand';
import api from '../lib/api';

interface WishlistState {
  ids: Set<string>;
  loaded: boolean;
  load: () => Promise<void>;
  toggle: (productId: string) => Promise<void>;
  has: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  ids: new Set(),
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    try {
      const res = await api.get('/wishlist');
      const ids = new Set<string>(res.data.wishlist.map((w: { product_id: string }) => w.product_id));
      set({ ids, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  toggle: async (productId: string) => {
    const { ids } = get();
    const isIn = ids.has(productId);
    // Optimistic update
    const next = new Set(ids);
    isIn ? next.delete(productId) : next.add(productId);
    set({ ids: next });
    try {
      if (isIn) {
        await api.delete(`/wishlist/${productId}`);
      } else {
        await api.post(`/wishlist/${productId}`);
      }
    } catch {
      // Revert on failure
      set({ ids });
    }
  },

  has: (productId: string) => get().ids.has(productId),
}));
