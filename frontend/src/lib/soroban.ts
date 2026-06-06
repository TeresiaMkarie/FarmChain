import { Buffer } from 'buffer';
import {
  Contract,
  rpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';
import { signTx, NETWORK, RPC_URL } from './stellar';

const server = new rpc.Server(RPC_URL);

const REGISTRY_ID = import.meta.env.VITE_REGISTRY_CONTRACT_ID as string;
const MARKETPLACE_ID = import.meta.env.VITE_MARKETPLACE_CONTRACT_ID as string;
const ESCROW_ID = import.meta.env.VITE_ESCROW_CONTRACT_ID as string;

function bytesVal(hex: string): xdr.ScVal {
  const padded = hex.padEnd(64, '0').slice(0, 64);
  return xdr.ScVal.scvBytes(Buffer.from(padded, 'hex'));
}

async function pollTransaction(hash: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = await server.getTransaction(hash);
    if (result.status === 'SUCCESS') return result;
    if (result.status === 'FAILED') throw new Error('Transaction failed on-chain');
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Transaction confirmation timed out after 30 s');
}

async function invoke(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourcePublicKey: string,
): Promise<{ txHash: string; returnValue?: xdr.ScVal }> {
  const account = await server.getAccount(sourcePublicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signed = await signTx(prepared.toXDR());

  const sendResp = await server.sendTransaction(
    TransactionBuilder.fromXDR(signed, NETWORK),
  );

  if (sendResp.status === 'ERROR') {
    throw new Error(`Transaction rejected: ${JSON.stringify((sendResp as any).errorResult ?? sendResp)}`);
  }

  const txHash = sendResp.hash;
  const confirmed = await pollTransaction(txHash);
  return { txHash, returnValue: (confirmed as any).returnValue };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const registerUser = (publicKey: string, role: string, metadataHash: string) =>
  invoke(REGISTRY_ID, 'register_user', [
    new Address(publicKey).toScVal(),
    xdr.ScVal.scvSymbol(role),
    bytesVal(metadataHash),
  ], publicKey);

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

export const listProduct = async (
  farmerKey: string,
  priceStroops: bigint,
  qty: bigint,
  hash: string,
): Promise<{ txHash: string; onChainId: number }> => {
  const { txHash, returnValue } = await invoke(
    MARKETPLACE_ID,
    'list_product',
    [
      new Address(farmerKey).toScVal(),
      nativeToScVal(priceStroops, { type: 'i128' }),
      nativeToScVal(qty, { type: 'u64' }),
      bytesVal(hash),
    ],
    farmerKey,
  );
  const onChainId = returnValue ? Number(scValToNative(returnValue) as bigint) : 0;
  return { txHash, onChainId };
};

export const getProduct = async (productId: number, callerKey: string) => {
  const contract = new Contract(MARKETPLACE_ID);
  const account = await server.getAccount(callerKey);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(contract.call('get_product', nativeToScVal(BigInt(productId), { type: 'u64' })))
    .setTimeout(30)
    .build();
  const simResult = await server.simulateTransaction(tx);
  if ('error' in simResult) throw new Error(`Simulation failed: ${simResult.error}`);
  const retval = (simResult as any).result?.retval as xdr.ScVal | undefined;
  return retval ? scValToNative(retval) : null;
};

// ---------------------------------------------------------------------------
// Escrow
// ---------------------------------------------------------------------------

export const createOrder = (
  buyerKey: string,
  orderId: number,
  productId: number,
  farmerKey: string,
  amountStroops: bigint,
): Promise<{ txHash: string; returnValue?: xdr.ScVal }> =>
  invoke(ESCROW_ID, 'create_order', [
    nativeToScVal(BigInt(orderId), { type: 'u64' }),
    nativeToScVal(BigInt(productId), { type: 'u64' }),
    new Address(farmerKey).toScVal(),
    new Address(buyerKey).toScVal(),
    nativeToScVal(amountStroops, { type: 'i128' }),
  ], buyerKey);

export const markShipped = async (
  farmerKey: string,
  orderId: number,
  trackingInfo: string,
): Promise<{ txHash: string; returnValue?: xdr.ScVal }> => {
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(trackingInfo));
  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return invoke(ESCROW_ID, 'mark_shipped', [
    nativeToScVal(BigInt(orderId), { type: 'u64' }),
    new Address(farmerKey).toScVal(),
    bytesVal(hashHex),
  ], farmerKey);
};

export const confirmDelivery = (
  buyerKey: string,
  orderId: number,
): Promise<{ txHash: string; returnValue?: xdr.ScVal }> =>
  invoke(ESCROW_ID, 'confirm_delivery', [
    nativeToScVal(BigInt(orderId), { type: 'u64' }),
    new Address(buyerKey).toScVal(),
  ], buyerKey);

export const raiseDispute = (
  callerKey: string,
  orderId: number,
): Promise<{ txHash: string; returnValue?: xdr.ScVal }> =>
  invoke(ESCROW_ID, 'raise_dispute', [
    nativeToScVal(BigInt(orderId), { type: 'u64' }),
    new Address(callerKey).toScVal(),
  ], callerKey);
