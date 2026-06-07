import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '../types';

interface WalletState {
  publicKey: string | null;
  role: UserRole | null;
  token: string | null;
  connected: boolean;
  balanceXlm: string | null;
  balanceFetchedAt: number | null;
  setWallet: (publicKey: string, role: UserRole, token: string) => void;
  disconnect: () => void;
  setBalance: (xlm: string) => void;
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      publicKey: null,
      role: null,
      token: null,
      connected: false,
      balanceXlm: null,
      balanceFetchedAt: null,
      setWallet: (publicKey, role, token) => {
        localStorage.setItem('fc_token', token);
        set({ publicKey, role, token, connected: true, balanceXlm: null, balanceFetchedAt: null });
      },
      disconnect: () => {
        localStorage.removeItem('fc_token');
        set({ publicKey: null, role: null, token: null, connected: false, balanceXlm: null, balanceFetchedAt: null });
      },
      setBalance: (xlm) => set({ balanceXlm: xlm, balanceFetchedAt: Date.now() }),
    }),
    {
      name: 'farmchain-wallet',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.token && isTokenExpired(state.token)) {
          state.disconnect();
        } else if (state.token) {
          localStorage.setItem('fc_token', state.token);
        }
      },
    },
  ),
);
