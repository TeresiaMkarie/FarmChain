#![cfg(test)]
use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::Address as _,
    token::StellarAssetClient,
    Address, BytesN, Env,
};

fn setup() -> (
    Env,
    Address,
    Address,
    Address,
    EscrowContractClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy a mock token (XLM stand-in)
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_asset_client = StellarAssetClient::new(&env, &token_id.address());

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.init(&admin, &token_id.address());

    let farmer = Address::generate(&env);
    let buyer = Address::generate(&env);

    // Mint tokens to buyer
    token_asset_client.mint(&buyer, &10_000_000i128);

    (env, admin, farmer, buyer, client)
}

#[test]
fn test_create_order_locks_funds() {
    let (_env, _admin, farmer, buyer, client) = setup();

    client.create_order(&0u64, &0u64, &farmer, &buyer, &1_000_000i128);

    let order = client.get_order(&0u64);
    assert_eq!(order.status, symbol_short!("Funded"));
    assert_eq!(order.amount, 1_000_000);
}

#[test]
fn test_full_happy_path() {
    let (env, _admin, farmer, buyer, client) = setup();
    let hash = BytesN::from_array(&env, &[1u8; 32]);

    client.create_order(&1u64, &0u64, &farmer, &buyer, &2_000_000i128);
    client.mark_shipped(&1u64, &farmer, &hash);

    let order = client.get_order(&1u64);
    assert_eq!(order.status, symbol_short!("Shipped"));

    client.confirm_delivery(&1u64, &buyer);

    let order = client.get_order(&1u64);
    assert_eq!(order.status, symbol_short!("Complete"));
}

#[test]
fn test_dispute_and_resolve_full_to_farmer() {
    let (_env, _admin, farmer, buyer, client) = setup();

    client.create_order(&2u64, &0u64, &farmer, &buyer, &3_000_000i128);
    client.raise_dispute(&2u64, &buyer);

    let order = client.get_order(&2u64);
    assert_eq!(order.status, symbol_short!("Disputed"));

    // 100% to farmer
    client.resolve_dispute(&2u64, &10_000u32);

    let order = client.get_order(&2u64);
    assert_eq!(order.status, symbol_short!("Resolved"));
}

#[test]
fn test_dispute_and_resolve_full_refund() {
    let (_env, _admin, farmer, buyer, client) = setup();

    client.create_order(&3u64, &0u64, &farmer, &buyer, &1_500_000i128);
    client.raise_dispute(&3u64, &farmer);
    // 0% to farmer = full refund to buyer
    client.resolve_dispute(&3u64, &0u32);

    let order = client.get_order(&3u64);
    assert_eq!(order.status, symbol_short!("Resolved"));
}
