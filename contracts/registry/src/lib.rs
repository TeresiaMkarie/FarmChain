#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol,
};

mod test;

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    User(Address),
    Admin,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub struct UserRecord {
    pub address: Address,
    pub role: Symbol,          // "Farmer" or "Buyer"
    pub metadata_hash: BytesN<32>,
    pub registered_at: u64,
    pub active: bool,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    // Must be called once after deploy to set the admin
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn register_user(
        env: Env,
        address: Address,
        role: Symbol,
        metadata_hash: BytesN<32>,
    ) {
        address.require_auth();

        assert!(
            role == symbol_short!("Farmer") || role == symbol_short!("Buyer"),
            "role must be Farmer or Buyer"
        );

        assert!(
            !env.storage().persistent().has(&DataKey::User(address.clone())),
            "already registered"
        );

        let record = UserRecord {
            address: address.clone(),
            role,
            metadata_hash,
            registered_at: env.ledger().timestamp(),
            active: true,
        };

        env.storage()
            .persistent()
            .set(&DataKey::User(address), &record);
    }

    pub fn get_user(env: Env, address: Address) -> UserRecord {
        env.storage()
            .persistent()
            .get(&DataKey::User(address))
            .expect("user not found")
    }

    pub fn is_registered(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::User(address))
    }

    pub fn update_metadata(env: Env, address: Address, new_hash: BytesN<32>) {
        address.require_auth();

        let mut record: UserRecord = env
            .storage()
            .persistent()
            .get(&DataKey::User(address.clone()))
            .expect("user not found");

        record.metadata_hash = new_hash;
        env.storage()
            .persistent()
            .set(&DataKey::User(address), &record);
    }

    pub fn deactivate_user(env: Env, address: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialised");
        admin.require_auth();

        let mut record: UserRecord = env
            .storage()
            .persistent()
            .get(&DataKey::User(address.clone()))
            .expect("user not found");

        record.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::User(address), &record);
    }

    pub fn activate_user(env: Env, address: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialised");
        admin.require_auth();

        let mut record: UserRecord = env
            .storage()
            .persistent()
            .get(&DataKey::User(address.clone()))
            .expect("user not found");

        record.active = true;
        env.storage()
            .persistent()
            .set(&DataKey::User(address), &record);
    }
}
