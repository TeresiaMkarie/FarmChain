import { Contract, SorobanRpc, TransactionBuilder, BASE_FEE, Networks, xdr } from '@stellar/stellar-sdk';
import { signTx, NETWORK, RPC_URL } from './stellar';

const server = new SorobanRpc.Server(RPC_URL);

const REGISTRY_ID = import.meta.env.VITE_REGISTRY_CONTRACT_ID as string;
const MARKETPLACE_ID = import.meta.env.VITE_MARKETPLACE_CONTRACT_ID as string;
const ESCROW_ID = import.meta.env.VITE_ESCROW_CONTRACT_ID as string;

async function invoke(contractId: string, method: string, args: xdr.ScVal[], sourcePublicKey: string) {
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

  const { SorobanRpc: RpcResponse } = await server.sendTransaction(
    TransactionBuilder.fromXDR(signed, NETWORK)
  );

  return RpcResponse;
}

// Registry
export const registerUser = (publicKey: string, role: string, metadataHash: string) =>
  invoke(REGISTRY_ID, 'register_user', [], publicKey);

// Marketplace
export const listProduct = (farmerKey: string, priceStroops: bigint, qty: bigint, hash: string) =>
  invoke(MARKETPLACE_ID, 'list_product', [], farmerKey);

export const getProduct = async (productId: number) => {
  const contract = new Contract(MARKETPLACE_ID);
  // Read-only — use simulateTransaction
  const account = await server.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN');
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(contract.call('get_product', xdr.ScVal.scvU64(xdr.Uint64.fromString(String(productId)))))
    .setTimeout(30)
    .build();
  return server.simulateTransaction(tx);
};

// Escrow
export const createOrder = (
  buyerKey: string,
  orderId: number,
  productId: number,
  farmerKey: string,
  amountStroops: bigint,
) => invoke(ESCROW_ID, 'create_order', [], buyerKey);

export const markShipped = (farmerKey: string, orderId: number, trackingHash: string) =>
  invoke(ESCROW_ID, 'mark_shipped', [], farmerKey);

export const confirmDelivery = (buyerKey: string, orderId: number) =>
  invoke(ESCROW_ID, 'confirm_delivery', [], buyerKey);

export const raiseDispute = (callerKey: string, orderId: number) =>
  invoke(ESCROW_ID, 'raise_dispute', [], callerKey);
