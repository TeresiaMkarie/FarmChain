import { useEffect, useState } from 'react';
import { useWalletStore } from '../store/walletStore';

const HORIZON_URL =
  import.meta.env.VITE_STELLAR_NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';

const CACHE_TTL_MS = 30_000;

interface BalanceState {
  xlm: string | null;
  loading: boolean;
  error: string | null;
}

export function useBalance(publicKey: string): BalanceState {
  const { balanceXlm, balanceFetchedAt, setBalance } = useWalletStore();
  const [state, setState] = useState<BalanceState>({ xlm: balanceXlm, loading: false, error: null });

  useEffect(() => {
    if (!publicKey) return;

    // Serve from cache if fresh
    if (balanceXlm !== null && balanceFetchedAt !== null && Date.now() - balanceFetchedAt < CACHE_TTL_MS) {
      setState({ xlm: balanceXlm, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ xlm: balanceXlm, loading: true, error: null });

    fetch(`${HORIZON_URL}/accounts/${publicKey}`)
      .then((res) => {
        if (res.status === 404) throw new Error('unfunded');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const native = data.balances?.find((b: { asset_type: string }) => b.asset_type === 'native');
        const formatted = parseFloat(native?.balance ?? '0').toFixed(2);
        setBalance(formatted);
        setState({ xlm: formatted, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        const msg = err.message === 'unfunded' ? 'unfunded' : 'unavailable';
        setState({ xlm: null, loading: false, error: msg });
      });

    return () => { cancelled = true; };
  }, [publicKey, balanceFetchedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
