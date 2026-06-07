/**
 * init-contracts.mjs
 *
 * Initializes the Registry and Escrow Soroban contracts on testnet.
 * The Marketplace already has NextId set and does not need re-init.
 *
 * Usage:
 *   DEPLOYER_SECRET_KEY=S... node scripts/init-contracts.mjs
 *
 * Or add DEPLOYER_SECRET_KEY to backend/.env and run without the prefix.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  Keypair, Contract, TransactionBuilder, BASE_FEE,
  Networks, rpc as SorobanRpc, Address, Asset,
  xdr, nativeToScVal,
} from '@stellar/stellar-sdk';

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Load .env
try {
  const env = readFileSync(join(ROOT, 'backend', '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length && !process.env[k.trim()]) {
      process.env[k.trim()] = v.join('=').trim();
    }
  }
} catch { /* no .env — rely on environment */ }

// Load frontend .env for contract IDs
try {
  const fenv = readFileSync(join(ROOT, 'frontend', '.env'), 'utf8');
  for (const line of fenv.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length && !process.env[k.trim()]) {
      process.env[k.trim()] = v.join('=').trim();
    }
  }
} catch { /* no frontend .env */ }

const SECRET = process.env.DEPLOYER_SECRET_KEY;
if (!SECRET) {
  console.error('ERROR: Set DEPLOYER_SECRET_KEY in backend/.env or as an environment variable.');
  console.error('  export DEPLOYER_SECRET_KEY=S...');
  process.exit(1);
}

const keypair = Keypair.fromSecret(SECRET);
const ADMIN_ADDRESS = keypair.publicKey();

const REGISTRY_ID  = process.env.VITE_REGISTRY_CONTRACT_ID;
const MARKETPLACE_ID = process.env.VITE_MARKETPLACE_CONTRACT_ID;
const ESCROW_ID    = process.env.VITE_ESCROW_CONTRACT_ID;
const RPC_URL      = process.env.VITE_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK      = process.env.VITE_STELLAR_NETWORK === 'mainnet'
  ? Networks.PUBLIC : Networks.TESTNET;

// XLM native contract address (derived from network passphrase)
const XLM_CONTRACT = Asset.native().contractId(NETWORK);

const server = new SorobanRpc.Server(RPC_URL);

console.log('=== FarmChain Contract Initializer ===');
console.log('Admin address :', ADMIN_ADDRESS);
console.log('Network       :', NETWORK === Networks.TESTNET ? 'testnet' : 'mainnet');
console.log('XLM contract  :', XLM_CONTRACT);
console.log('');

// ── Helper ────────────────────────────────────────────────────────────────────

async function invoke(contractId, method, args) {
  console.log(`  Calling ${method} on ${contractId.slice(0, 10)}...`);
  const account = await server.getAccount(ADMIN_ADDRESS);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(keypair);

  const sendResp = await server.sendTransaction(prepared);
  if (sendResp.status === 'ERROR') {
    throw new Error(`Send failed: ${JSON.stringify(sendResp.errorResult ?? sendResp)}`);
  }

  const hash = sendResp.hash;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = await server.getTransaction(hash);
    if (result.status === 'SUCCESS') {
      console.log(`  ✓ ${method} succeeded (tx: ${hash.slice(0, 16)}...)`);
      return result;
    }
    if (result.status === 'FAILED') throw new Error(`${method} failed on-chain`);
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`${method} timed out`);
}

async function isInitialized(contractId) {
  try {
    const key = xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
      contract: new Contract(contractId).address().toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    }));
    const res = await server.getLedgerEntries(key);
    if (!res.entries?.length) return false;
    const storage = res.entries[0].val.contractData().val().instance().storage();
    return storage && storage.length > 0;
  } catch {
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Initialize Registry
  console.log('--- Registry ---');
  if (await isInitialized(REGISTRY_ID)) {
    console.log('  Already initialized, skipping.');
  } else {
    await invoke(REGISTRY_ID, 'init', [
      new Address(ADMIN_ADDRESS).toScVal(),
    ]);
  }
  console.log('');

  // 2. Marketplace — only re-init if Admin key is missing
  console.log('--- Marketplace ---');
  if (await isInitialized(MARKETPLACE_ID)) {
    console.log('  Already initialized (NextId set), skipping.');
    console.log('  NOTE: If Admin key expired, run marketplace init manually.');
  } else {
    await invoke(MARKETPLACE_ID, 'init', [
      new Address(ADMIN_ADDRESS).toScVal(),
    ]);
  }
  console.log('');

  // 3. Initialize Escrow (requires admin + XLM token address)
  console.log('--- Escrow ---');
  if (await isInitialized(ESCROW_ID)) {
    console.log('  Already initialized, skipping.');
  } else {
    await invoke(ESCROW_ID, 'init', [
      new Address(ADMIN_ADDRESS).toScVal(),
      new Address(XLM_CONTRACT).toScVal(),
    ]);
  }
  console.log('');

  console.log('=== All contracts initialized. Buyers can now place orders. ===');
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
