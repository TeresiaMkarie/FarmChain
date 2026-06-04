#!/usr/bin/env bash
# Build and deploy all three Soroban contracts to testnet
set -e

source "$(dirname "$0")/../.env" 2>/dev/null || true

NETWORK=${STELLAR_NETWORK:-testnet}
SECRET=${DEPLOYER_SECRET_KEY:?Set DEPLOYER_SECRET_KEY in .env}

echo "==> Building contracts..."
cd "$(dirname "$0")/../contracts"
stellar contract build

echo ""
echo "==> Deploying Registry contract..."
REGISTRY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/registry.wasm \
  --source "$SECRET" \
  --network "$NETWORK" 2>&1 | tail -1)
echo "REGISTRY_CONTRACT_ID=$REGISTRY_ID"

echo ""
echo "==> Deploying Marketplace contract..."
MARKETPLACE_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/marketplace.wasm \
  --source "$SECRET" \
  --network "$NETWORK" 2>&1 | tail -1)
echo "MARKETPLACE_CONTRACT_ID=$MARKETPLACE_ID"

echo ""
echo "==> Deploying Escrow contract..."
ESCROW_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/escrow.wasm \
  --source "$SECRET" \
  --network "$NETWORK" 2>&1 | tail -1)
echo "ESCROW_CONTRACT_ID=$ESCROW_ID"

echo ""
echo "==> Paste these into your .env files:"
echo "REGISTRY_CONTRACT_ID=$REGISTRY_ID"
echo "MARKETPLACE_CONTRACT_ID=$MARKETPLACE_ID"
echo "ESCROW_CONTRACT_ID=$ESCROW_ID"
