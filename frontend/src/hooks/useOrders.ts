import { useState, useEffect, useRef } from 'react';
import { getOrders, getOrder } from '../lib/api';
import { parseError } from '../lib/errors';
import type { Order, OrderDispute } from '../types';

const MUTABLE_STATUSES = new Set(['funded', 'shipped', 'disputed']);

function toDispute(raw: any): OrderDispute | null {
  if (!raw.dispute_id) return null;
  return {
    id: raw.dispute_id,
    raisedBy: raw.dispute_raised_by,
    reason: raw.dispute_reason,
    status: raw.dispute_status,
    resolution: raw.dispute_resolution,
    createdAt: raw.dispute_created_at,
  };
}

function toOrder(raw: any): Order {
  return {
    id: raw.id,
    productId: raw.product_id,
    onChainOrderId: raw.on_chain_order_id,
    escrowId: raw.escrow_id,
    farmerPk: raw.farmer_pk,
    buyerPk: raw.buyer_pk,
    amount: raw.amount,
    quantity: raw.quantity,
    deliveryAddress: raw.delivery_address,
    status: raw.status,
    trackingHash: raw.tracking_hash,
    trackingInfo: raw.tracking_info,
    txHash: raw.tx_hash,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    product: raw.product,
    productName: raw.product_name,
    imageCids: raw.image_cids ?? [],
    dispute: toDispute(raw),
  };
}

export function useOrders(statusFilter?: string[]) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const refresh = (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    if (reset) setOffset(0);
    setLoading(true);

    const params: Record<string, string> = { limit: String(LIMIT), offset: String(currentOffset) };
    if (statusFilter && statusFilter.length > 0) params.status = statusFilter.join(',');

    getOrders(params)
      .then((res) => {
        const mapped = (res.data.orders ?? []).map(toOrder);
        setOrders(reset || currentOffset === 0 ? mapped : (prev) => [...prev, ...mapped]);
        setTotal(res.data.total ?? mapped.length);
      })
      .catch((err) => setError(parseError(err)))
      .finally(() => setLoading(false));
  };

  const loadMore = () => {
    const next = offset + LIMIT;
    setOffset(next);
  };

  useEffect(() => { refresh(true); }, [JSON.stringify(statusFilter)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (offset > 0) refresh(); }, [offset]); // eslint-disable-line react-hooks/exhaustive-deps

  return { orders, loading, error, total, hasMore: orders.length < total, loadMore, refresh: () => refresh(true) };
}

export function useOrder(id: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = () =>
    getOrder(id)
      .then((res) => setOrder(toOrder(res.data.order)))
      .catch((err) => setError(parseError(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchOrder();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 15 s while order is in a mutable state
  useEffect(() => {
    if (!order) return;
    if (MUTABLE_STATUSES.has(order.status)) {
      intervalRef.current = setInterval(fetchOrder, 15_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [order?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return { order, loading, error, setOrder, refetch: fetchOrder };
}
