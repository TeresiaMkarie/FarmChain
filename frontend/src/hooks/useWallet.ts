import { useState, useCallback } from 'react';
import { isConnected, getAddress } from '@stellar/freighter-api';
import { useWalletStore } from '../store/walletStore';
import { login, register } from '../lib/api';
import type { UserRole } from '../types';

export function useWallet() {
  const { publicKey, role, connected, setWallet, disconnect } = useWalletStore();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (userRole?: UserRole, name?: string) => {
    setConnecting(true);
    setError(null);
    try {
      const { isConnected: connected } = await isConnected();
      if (!connected) {
        setError('Freighter wallet not found. Please install it from freighter.app');
        return null;
      }

      const { address: pk } = await getAddress();
      if (!pk) throw new Error('Could not get public key');

      // Try login first, fall back to register
      let token: string;
      let resolvedRole: UserRole;
      try {
        const res = await login({ publicKey: pk });
        token = res.data.token;
        resolvedRole = res.data.user.role;
      } catch {
        if (!userRole || !name) throw new Error('New user — provide role and name');
        const res = await register({ publicKey: pk, role: userRole, name });
        token = res.data.token;
        resolvedRole = userRole;
      }

      localStorage.setItem('fc_token', token);
      setWallet(pk, resolvedRole, token);
      return pk;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      return null;
    } finally {
      setConnecting(false);
    }
  }, [setWallet]);

  const handleDisconnect = useCallback(() => {
    localStorage.removeItem('fc_token');
    disconnect();
  }, [disconnect]);

  return { publicKey, role, connected, connecting, error, connect, disconnect: handleDisconnect };
}
