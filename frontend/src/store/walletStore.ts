import { create } from 'zustand';
import type { UserRole } from '../types';

interface WalletState {
  publicKey: string | null;
  role: UserRole | null;
  token: string | null;
  connected: boolean;
  setWallet: (publicKey: string, role: UserRole, token: string) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  publicKey: null,
  role: null,
  token: null,
  connected: false,
  setWallet: (publicKey, role, token) =>
    set({ publicKey, role, token, connected: true }),
  disconnect: () =>
    set({ publicKey: null, role: null, token: null, connected: false }),
}));
