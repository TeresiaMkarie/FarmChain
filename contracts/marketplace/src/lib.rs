#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol, Vec,
};

mod test;

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    Product(u64),
    FarmerProducts(Address),
    NextId,
    Admin,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub struct Product {
    pub id: u64,
    pub farmer: Address,
    pub price: i128,       // in stroops
    pub quantity: u64,
    pub metadata_hash: BytesN<32>,
    pub status: Symbol,    // "Active" | "Sold" | "Delisted"
    pub created_at: u64,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct MarketplaceContract;

#[contractimpl]
impl MarketplaceContract {
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextId, &0u64);
    }

    pub fn list_product(
        env: Env,
        farmer: Address,
        price: i128,
        quantity: u64,
        metadata_hash: BytesN<32>,
    ) -> u64 {
        farmer.require_auth();
        assert!(price > 0, "price must be positive");
        assert!(quantity > 0, "quantity must be positive");

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0);

        let product = Product {
            id,
            farmer: farmer.clone(),
            price,
            quantity,
            metadata_hash,
            status: symbol_short!("Active"),
            created_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Product(id), &product);

        // Append id to farmer's list
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::FarmerProducts(farmer.clone()))
            .unwrap_or(Vec::new(&env));
        ids.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::FarmerProducts(farmer), &ids);

        env.storage()
            .instance()
            .set(&DataKey::NextId, &(id + 1));

        id
    }

    pub fn update_product(
        env: Env,
        farmer: Address,
        product_id: u64,
        price: i128,
        quantity: u64,
    ) {
        farmer.require_auth();

        let mut product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id))
            .expect("product not found");

        assert!(product.farmer == farmer, "not your product");
        assert!(
            product.status == symbol_short!("Active"),
            "product not active"
        );

        product.price = price;
        product.quantity = quantity;
        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id), &product);
    }

    pub fn delist_product(env: Env, farmer: Address, product_id: u64) {
        farmer.require_auth();

        let mut product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id))
            .expect("product not found");

        assert!(product.farmer == farmer, "not your product");
        product.status = symbol_short!("Delisted");
        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id), &product);
    }

    pub fn mark_sold(env: Env, product_id: u64) {
        // Called by escrow contract after order confirmed
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialised");
        admin.require_auth();

        let mut product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id))
            .expect("product not found");

        product.status = symbol_short!("Sold");
        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id), &product);
    }

    pub fn get_product(env: Env, product_id: u64) -> Product {
        env.storage()
            .persistent()
            .get(&DataKey::Product(product_id))
            .expect("product not found")
    }

    pub fn get_farmer_products(env: Env, farmer: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::FarmerProducts(farmer))
            .unwrap_or(Vec::new(&env))
    }
}
