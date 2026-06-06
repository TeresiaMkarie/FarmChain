import { useState, useEffect } from 'react';
import { getProducts, getProduct } from '../lib/api';
import type { Product } from '../types';

export function useProducts(params?: Record<string, string>) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable cache key so the effect only re-runs when params actually change
  const paramsKey = params ? JSON.stringify(params) : '';

  useEffect(() => {
    setLoading(true);
    setError(null);
    getProducts(params)
      .then((res) => setProducts(res.data.products ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { products, loading, error, setProducts };
}

export function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getProduct(id)
      .then((res) => setProduct(res.data.product))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return { product, loading, error };
}
