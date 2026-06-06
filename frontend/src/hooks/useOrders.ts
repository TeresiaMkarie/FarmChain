import { useState, useEffect } from 'react';
import { getOrders, getOrder } from '../lib/api';
import { parseError } from '../lib/errors';
import type { Order } from '../types';

function toOrder(raw: any): Order {
  return {
    id: raw.id,
    productId: raw.product_id,
    onChainOrderId: raw.on_chain_order_id,
    escrowId: raw.escrow_id,
    farmerPk: raw.farmer_pk,
    buyerPk: raw.buyer_pk,
    amount: raw.amount,
    status: raw.status,
    trackingHash: raw.tracking_hash,
    trackingInfo: raw.tracking_info,
    txHash: raw.tx_hash,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    product: raw.product,
    productName: raw.product_name,
  };
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    getOrders()
      .then((res) => setOrders((res.data.orders ?? []).map(toOrder)))
      .catch((err) => setError(parseError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);
  return { orders, loading, error, refresh };
}

export function useOrder(id: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrder(id)
      .then((res) => setOrder(toOrder(res.data.order)))
      .catch((err) => setError(parseError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  return { order, loading, error, setOrder };
}
