import { useState, useEffect, useCallback } from 'react';
import { getProducts, getProduct } from '../lib/api';
import { parseError } from '../lib/errors';
import type { Product } from '../types';

function toProduct(raw: any): Product {
  return {
    id: raw.id,
    onChainId: raw.on_chain_id,
    farmerPk: raw.farmer_pk,
    name: raw.name,
    category: raw.category,
    quantity: raw.quantity,
    unit: raw.unit,
    priceXlm: raw.price_xlm,
    imageCids: raw.image_cids ?? [],
    metadataHash: raw.metadata_hash,
    description: raw.description,
    status: raw.status,
    createdAt: raw.created_at,
    farmerName: raw.farmer_name,
    location: raw.location,
  };
}

export function useProducts(params?: Record<string, string>) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = params ? JSON.stringify(params) : '';

  const refresh = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProducts(params)
      .then((res) => { if (!cancelled) setProducts((res.data.products ?? []).map(toProduct)); })
      .catch((err) => { if (!cancelled) setError(parseError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => refresh(), [refresh]);

  return { products, loading, error, setProducts, refresh };
}

export function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProduct(id)
      .then((res) => { if (!cancelled) setProduct(toProduct(res.data.product)); })
      .catch((err) => { if (!cancelled) setError(parseError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  return { product, loading, error };
}
