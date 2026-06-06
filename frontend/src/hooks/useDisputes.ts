import { useState, useEffect } from 'react';
import { getDisputes } from '../lib/api';
import type { Dispute } from '../types';

function toDispute(raw: any): Dispute {
  return {
    id: raw.id,
    orderId: raw.order_id,
    raisedBy: raw.raised_by,
    reason: raw.reason,
    status: raw.status,
    resolution: raw.resolution,
    createdAt: raw.created_at,
    productId: raw.product_id,
    buyerPk: raw.buyer_pk,
    farmerPk: raw.farmer_pk,
    amount: Number(raw.amount),
    productName: raw.product_name,
  };
}

export function useDisputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    getDisputes()
      .then((res) => setDisputes((res.data.disputes ?? []).map(toDispute)))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  return { disputes, loading, refresh };
}
