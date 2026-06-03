#!/usr/bin/env bash
# Fund a Stellar testnet account via Friendbot
set -e

PUBLIC_KEY=${1:-$DEPLOYER_PUBLIC_KEY}

if [ -z "$PUBLIC_KEY" ]; then
  echo "Usage: $0 <public_key>"
  exit 1
fi

echo "Funding $PUBLIC_KEY on testnet..."
curl -s "https://friendbot.stellar.org?addr=$PUBLIC_KEY" | python3 -m json.tool
echo ""
echo "Done. Check balance with: stellar account balance $PUBLIC_KEY --network testnet"
