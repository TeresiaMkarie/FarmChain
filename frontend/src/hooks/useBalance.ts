import { useEffect, useState } from 'react';

const HORIZON_URL =
  import.meta.env.VITE_STELLAR_NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';

interface BalanceState {
  xlm: string | null;   // formatted to 2 dp, e.g. "142.50"
  loading: boolean;
  error: string | null;
}

export function useBalance(publicKey: string): BalanceState {
  const [state, setState] = useState<BalanceState>({ xlm: null, loading: true, error: null });

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    setState({ xlm: null, loading: true, error: null });

    fetch(`${HORIZON_URL}/accounts/${publicKey}`)
      .then((res) => {
        if (res.status === 404) throw new Error('unfunded');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const native = data.balances?.find((b: { asset_type: string }) => b.asset_type === 'native');
        const raw = parseFloat(native?.balance ?? '0');
        setState({ xlm: raw.toFixed(2), loading: false, error: null });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        const msg = err.message === 'unfunded' ? 'unfunded' : 'unavailable';
        setState({ xlm: null, loading: false, error: msg });
      });

    return () => { cancelled = true; };
  }, [publicKey]);

  return state;
}
