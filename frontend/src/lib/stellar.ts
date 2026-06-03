import {
  getAddress,
  isConnected,
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
    const { address } = await getAddress();
    return address ?? null;
  } catch {
    return null;
  }
}

export async function signTx(xdr: string): Promise<string> {
  const result = await signTransaction(xdr, {
    networkPassphrase: NETWORK,
  });
  if (result.error) throw new Error(result.error);
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
