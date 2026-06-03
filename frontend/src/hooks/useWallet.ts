import { useState, useCallback } from 'react';
import { isConnected, requestAccess, getAddress } from '@stellar/freighter-api';
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
      // 1. Check extension is installed
      const { isConnected: hasExtension } = await isConnected();
      if (!hasExtension) {
        setError('Freighter wallet not found. Install it from freighter.app');
        return null;
      }

      // 2. requestAccess triggers the Freighter popup and grants site permission.
      //    getAddress alone returns empty string when the site has no permission yet.
      let pk: string | undefined;
      const { address: requested, error: accessErr } = await requestAccess();
      if (accessErr) throw new Error(accessErr.message ?? 'Freighter access denied');

      if (requested) {
        pk = requested;
      } else {
        // Already allowed — pull address directly
        const { address: existing } = await getAddress();
        pk = existing;
      }

      if (!pk) throw new Error('Could not get public key from Freighter');

      // 3. Try login first, fall back to register for new users
      let token: string;
      let resolvedRole: UserRole;
      try {
        const res = await login({ publicKey: pk });
        token = res.data.token;
        resolvedRole = res.data.user.role;
      } catch {
        if (!userRole || !name) throw new Error('New user — provide your role and name');
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
