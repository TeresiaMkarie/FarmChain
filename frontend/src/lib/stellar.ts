import {
  getAddress,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';
import { Networks } from '@stellar/stellar-sdk';

export const NETWORK = import.meta.env.VITE_STELLAR_NETWORK === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET;

export const RPC_URL = import.meta.env.VITE_RPC_URL as string;

export async function getFreighterPublicKey(): Promise<string | null> {
  try {
    const { isConnected: connected } = await isConnected();
    if (!connected) return null;
    const { address: requested } = await requestAccess();
    if (requested) return requested;
    const { address } = await getAddress();
    return address || null;
  } catch {
    return null;
  }
}

export async function signTx(xdr: string): Promise<string> {
  let result: Awaited<ReturnType<typeof signTransaction>>;
  try {
    result = await signTransaction(xdr, { networkPassphrase: NETWORK });
  } catch (err: any) {
    // Chrome extension runtime throws non-Error objects when its message channel closes
    const raw: string = err?.message ?? String(err);
    if (/message channel closed|listener indicated an asynchronous/i.test(raw)) {
      throw new Error('Freighter closed before signing. Please try again and keep the popup open.');
    }
    throw err;
  }

  if (result.error) {
    const msg = String(result.error);
    if (/user.*(declined|rejected|cancel)|cancel/i.test(msg)) {
      throw new Error('Transaction cancelled.');
    }
    throw new Error(`Freighter: ${msg}`);
  }
  return result.signedTxXdr;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function stroopsToXlm(stroops: number): number {
  return stroops / 10_000_000;
}

export function xlmToStroops(xlm: number): number {
  return Math.round(xlm * 10_000_000);
}

const EXPLORER_BASE = import.meta.env.VITE_STELLAR_NETWORK === 'mainnet'
  ? 'https://stellar.expert/explorer/public'
  : 'https://stellar.expert/explorer/testnet';

export function explorerTxUrl(txHash: string): string {
  return `${EXPLORER_BASE}/tx/${txHash}`;
}

export function explorerAccountUrl(address: string): string {
  return `${EXPLORER_BASE}/account/${address}`;
}
