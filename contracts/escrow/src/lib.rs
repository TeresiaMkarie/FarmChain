#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, Symbol,
};

mod test;

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    Order(u64),
    Admin,
    Token, // XLM token address
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub struct Order {
    pub id: u64,
    pub product_id: u64,
    pub farmer: Address,
    pub buyer: Address,
    pub amount: i128,
    pub status: Symbol,        // "Funded" "Shipped" "Delivered" "Disputed" "Complete" "Refunded"
    pub tracking_hash: BytesN<32>,
    pub created_at: u64,
    pub updated_at: u64,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contracttype]
pub enum Event {
    OrderCreated,
    OrderShipped,
    OrderDelivered,
    OrderComplete,
    OrderDisputed,
    OrderResolved,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn init(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
    }

    // Buyer calls this — transfers `amount` from buyer to this contract
    pub fn create_order(
        env: Env,
        order_id: u64,
        product_id: u64,
        farmer: Address,
        buyer: Address,
        amount: i128,
    ) {
        buyer.require_auth();

        assert!(
            !env.storage().persistent().has(&DataKey::Order(order_id)),
            "order already exists"
        );
        assert!(amount > 0, "amount must be positive");

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialised");

        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&buyer, &env.current_contract_address(), &amount);

        let empty_hash = BytesN::from_array(&env, &[0u8; 32]);
        let now = env.ledger().timestamp();

        let order = Order {
            id: order_id,
            product_id,
            farmer,
            buyer,
            amount,
            status: symbol_short!("Funded"),
            tracking_hash: empty_hash,
            created_at: now,
            updated_at: now,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Order(order_id), &order);

        env.events().publish(
            (symbol_short!("order"), symbol_short!("created")),
            order_id,
        );
    }

    // Farmer marks order as shipped
    pub fn mark_shipped(env: Env, order_id: u64, farmer: Address, tracking_hash: BytesN<32>) {
        farmer.require_auth();

        let mut order: Order = env
            .storage()
            .persistent()
            .get(&DataKey::Order(order_id))
            .expect("order not found");

        assert!(order.farmer == farmer, "not your order");
        assert!(order.status == symbol_short!("Funded"), "invalid status");

        order.status = symbol_short!("Shipped");
        order.tracking_hash = tracking_hash;
        order.updated_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Order(order_id), &order);

        env.events().publish(
            (symbol_short!("order"), symbol_short!("shipped")),
            order_id,
        );
    }

    // Buyer confirms delivery — releases funds to farmer
    pub fn confirm_delivery(env: Env, order_id: u64, buyer: Address) {
        buyer.require_auth();

        let mut order: Order = env
            .storage()
            .persistent()
            .get(&DataKey::Order(order_id))
            .expect("order not found");

        assert!(order.buyer == buyer, "not your order");
        assert!(order.status == symbol_short!("Shipped"), "invalid status");

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialised");

        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &order.farmer, &order.amount);

        order.status = symbol_short!("Complete");
        order.updated_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Order(order_id), &order);

        env.events().publish(
            (symbol_short!("order"), symbol_short!("complete")),
            order_id,
        );
    }

    // Buyer or farmer raises a dispute
    pub fn raise_dispute(env: Env, order_id: u64, caller: Address) {
        caller.require_auth();

        let mut order: Order = env
            .storage()
            .persistent()
            .get(&DataKey::Order(order_id))
            .expect("order not found");

        assert!(
            order.buyer == caller || order.farmer == caller,
            "not a party"
        );
        assert!(
            order.status == symbol_short!("Funded")
                || order.status == symbol_short!("Shipped"),
            "cannot dispute at this stage"
        );

        order.status = symbol_short!("Disputed");
        order.updated_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Order(order_id), &order);

        env.events().publish(
            (symbol_short!("order"), symbol_short!("disputed")),
            order_id,
        );
    }

    // Admin resolves dispute — farmer_bps: 0-10000 (basis points to farmer)
    pub fn resolve_dispute(env: Env, order_id: u64, farmer_bps: u32) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialised");
        admin.require_auth();

        assert!(farmer_bps <= 10_000, "farmer_bps out of range");

        let mut order: Order = env
            .storage()
            .persistent()
            .get(&DataKey::Order(order_id))
            .expect("order not found");

        assert!(order.status == symbol_short!("Disputed"), "not disputed");

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialised");

        let token_client = token::Client::new(&env, &token_addr);
        let contract = env.current_contract_address();

        let farmer_amount = (order.amount * farmer_bps as i128) / 10_000;
        let buyer_amount = order.amount - farmer_amount;

        if farmer_amount > 0 {
            token_client.transfer(&contract, &order.farmer, &farmer_amount);
        }
        if buyer_amount > 0 {
            token_client.transfer(&contract, &order.buyer, &buyer_amount);
        }

        order.status = symbol_short!("Resolved");
        order.updated_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Order(order_id), &order);

        env.events().publish(
            (symbol_short!("order"), symbol_short!("resolved")),
            (order_id, farmer_bps),
        );
    }

    // Anyone can call this after 14 days if the order is still Funded — refunds the buyer.
    // Protects buyers from farmers who never ship.
    pub fn timeout_order(env: Env, order_id: u64) {
        const TIMEOUT_SECS: u64 = 14 * 24 * 60 * 60; // 14 days

        let mut order: Order = env
            .storage()
            .persistent()
            .get(&DataKey::Order(order_id))
            .expect("order not found");

        assert!(order.status == symbol_short!("Funded"), "order is not in Funded state");
        assert!(
            env.ledger().timestamp() >= order.created_at + TIMEOUT_SECS,
            "timeout period has not elapsed"
        );

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialised");

        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &order.buyer, &order.amount);

        order.status = symbol_short!("Refunded");
        order.updated_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Order(order_id), &order);

        env.events().publish(
            (symbol_short!("order"), symbol_short!("refunded")),
            order_id,
        );
    }

    pub fn get_order(env: Env, order_id: u64) -> Order {
        env.storage()
            .persistent()
            .get(&DataKey::Order(order_id))
            .expect("order not found")
    }
}
