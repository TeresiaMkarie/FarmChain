import { useState, useCallback } from 'react';
import { isConnected, requestAccess, getAddress } from '@stellar/freighter-api';
import { signTx } from '../lib/stellar';
import { useWalletStore } from '../store/walletStore';
import { getChallenge, login, register } from '../lib/api';
import { parseError } from '../lib/errors';
import type { UserRole } from '../types';

export function useWallet() {
  const { publicKey, role, connected, setWallet, disconnect } = useWalletStore();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (userRole?: UserRole, name?: string) => {
    setConnecting(true);
    setError(null);
    try {
      // 1. Check Freighter is installed
      const { isConnected: hasExtension } = await isConnected();
      if (!hasExtension) {
        setError('Freighter wallet not found. Install it from freighter.app');
        return null;
      }

      // 2. Get the public key from Freighter
      let pk: string | undefined;
      const { address: requested, error: accessErr } = await requestAccess();
      if (accessErr) throw new Error((accessErr as any).message ?? 'Freighter access denied');
      if (requested) {
        pk = requested;
      } else {
        const { address: existing } = await getAddress();
        pk = existing;
      }
      if (!pk) throw new Error('Could not get public key from Freighter');

      // 3. Fetch challenge (transaction XDR) from backend, sign it with Freighter
      const challengeRes = await getChallenge(pk);
      const { challenge: challengeXDR, token: challengeToken } = challengeRes.data;

      // signTx calls Freighter's signTransaction with the correct network passphrase
      const signedXDR = await signTx(challengeXDR);

      // 4. Login (existing user) or register (new user)
      let token: string;
      let resolvedRole: UserRole;
      try {
        const res = await login({ publicKey: pk, signature: signedXDR, token: challengeToken });
        token = res.data.token;
        resolvedRole = res.data.user.role as UserRole;
      } catch (loginErr: any) {
        if (loginErr?.response?.status === 404) {
          if (!userRole || !name) throw new Error('New user — provide your role and name');
          const res = await register({ publicKey: pk, role: userRole, name, signature: signedXDR, token: challengeToken });
          token = res.data.token;
          resolvedRole = userRole;
        } else {
          throw loginErr;
        }
      }

      setWallet(pk, resolvedRole, token);
      return { pk, role: resolvedRole };
    } catch (err: unknown) {
      setError(parseError(err));
      return null;
    } finally {
      setConnecting(false);
    }
  }, [setWallet]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  return { publicKey, role, connected, connecting, error, connect, disconnect: handleDisconnect };
}
