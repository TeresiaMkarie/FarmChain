#![cfg(test)]
use super::*;
use soroban_sdk::{symbol_short, testutils::Address as _, Address, BytesN, Env};

fn setup() -> (Env, Address, RegistryContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RegistryContract, ());
    let client = RegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.init(&admin);

    (env, admin, client)
}

#[test]
fn test_register_farmer() {
    let (env, _admin, client) = setup();

    let farmer = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[1u8; 32]);

    client.register_user(&farmer, &symbol_short!("Farmer"), &hash);

    let record = client.get_user(&farmer);
    assert_eq!(record.role, symbol_short!("Farmer"));
    assert!(record.active);
}

#[test]
fn test_register_buyer() {
    let (env, _admin, client) = setup();

    let buyer = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[2u8; 32]);

    client.register_user(&buyer, &symbol_short!("Buyer"), &hash);

    assert!(client.is_registered(&buyer));
}

#[test]
#[should_panic(expected = "already registered")]
fn test_duplicate_registration_fails() {
    let (env, _admin, client) = setup();

    let user = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[3u8; 32]);

    client.register_user(&user, &symbol_short!("Farmer"), &hash);
    client.register_user(&user, &symbol_short!("Farmer"), &hash);
}

#[test]
fn test_update_metadata() {
    let (env, _admin, client) = setup();

    let user = Address::generate(&env);
    let hash1 = BytesN::from_array(&env, &[1u8; 32]);
    let hash2 = BytesN::from_array(&env, &[2u8; 32]);

    client.register_user(&user, &symbol_short!("Farmer"), &hash1);
    client.update_metadata(&user, &hash2);

    let record = client.get_user(&user);
    assert_eq!(record.metadata_hash, hash2);
}

#[test]
fn test_deactivate_user() {
    let (env, _admin, client) = setup();

    let user = Address::generate(&env);
    let hash = BytesN::from_array(&env, &[1u8; 32]);
    client.register_user(&user, &symbol_short!("Buyer"), &hash);

    client.deactivate_user(&user);

    let record = client.get_user(&user);
    assert!(!record.active);
}
