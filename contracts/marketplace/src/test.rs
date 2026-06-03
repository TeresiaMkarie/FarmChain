#![cfg(test)]
use super::*;
use soroban_sdk::{symbol_short, testutils::Address as _, Address, BytesN, Env};

fn setup() -> (Env, Address, MarketplaceContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(MarketplaceContract, ());
    let client = MarketplaceContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.init(&admin);

    (env, admin, client)
}

#[test]
fn test_list_product() {
    let (env, _admin, client) = setup();

    let farmer = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[1u8; 32]);

    let id = client.list_product(&farmer, &1_000_000i128, &100u64, &hash);
    assert_eq!(id, 0);

    let product = client.get_product(&id);
    assert_eq!(product.farmer, farmer);
    assert_eq!(product.price, 1_000_000);
    assert_eq!(product.status, symbol_short!("Active"));
}

#[test]
fn test_multiple_products_increment_id() {
    let (env, _admin, client) = setup();

    let farmer = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[1u8; 32]);

    let id0 = client.list_product(&farmer, &1_000_000i128, &10u64, &hash);
    let id1 = client.list_product(&farmer, &2_000_000i128, &20u64, &hash);

    assert_eq!(id0, 0);
    assert_eq!(id1, 1);
}

#[test]
fn test_update_product() {
    let (env, _admin, client) = setup();

    let farmer = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[1u8; 32]);

    let id = client.list_product(&farmer, &1_000_000i128, &100u64, &hash);
    client.update_product(&farmer, &id, &2_000_000i128, &50u64);

    let product = client.get_product(&id);
    assert_eq!(product.price, 2_000_000);
    assert_eq!(product.quantity, 50);
}

#[test]
fn test_delist_product() {
    let (env, _admin, client) = setup();

    let farmer = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[1u8; 32]);

    let id = client.list_product(&farmer, &1_000_000i128, &100u64, &hash);
    client.delist_product(&farmer, &id);

    let product = client.get_product(&id);
    assert_eq!(product.status, symbol_short!("Delisted"));
}

#[test]
fn test_get_farmer_products() {
    let (env, _admin, client) = setup();

    let farmer = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[1u8; 32]);

    client.list_product(&farmer, &1_000_000i128, &10u64, &hash);
    client.list_product(&farmer, &2_000_000i128, &20u64, &hash);

    let ids = client.get_farmer_products(&farmer);
    assert_eq!(ids.len(), 2);
}
