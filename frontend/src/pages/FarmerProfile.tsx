import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getUser } from '../lib/api';
import api from '../lib/api';
import { useProducts } from '../hooks/useProducts';
import { shortAddress } from '../lib/stellar';
import ProductCard from '../components/marketplace/ProductCard';

interface FarmerUser {
  public_key: string;
  name: string;
  bio: string | null;
  location: string | null;
  country: string | null;
  city: string | null;
  chain_verified: boolean;
  created_at: string;
  role: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  buyer_name: string;
  created_at: string;
}

export default function FarmerProfile() {
  const { publicKey } = useParams<{ publicKey: string }>();
  const [farmer, setFarmer] = useState<FarmerUser | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);

  // Derived — avoids synchronous setState inside the effect body
  const userLoading = fetchedKey !== publicKey;

  const { products, loading: productsLoading } = useProducts(
    publicKey ? { farmer: publicKey } : undefined,
  );
  const activeProducts = products.filter((p) => p.status === 'active');

  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    if (!activeProducts.length) return;
    // Fetch reviews for all active products and aggregate
    Promise.all(activeProducts.map((p) => api.get('/reviews', { params: { productId: p.id } })))
      .then((results) => {
        const all: Review[] = results.flatMap((r) => r.data.reviews);
        setReviews(all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10));
        const ratings = results.flatMap((r) => r.data.reviews.map((rv: Review) => rv.rating));
        if (ratings.length) setAvgRating(parseFloat((ratings.reduce((s: number, v: number) => s + v, 0) / ratings.length).toFixed(1)));
      })
      .catch(() => {});
  }, [activeProducts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;

    getUser(publicKey)
      .then((res) => {
        if (cancelled) return;
        setFarmer(res.data.user);
        setUserError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setUserError('Farmer not found.');
      })
      .finally(() => {
        if (!cancelled) setFetchedKey(publicKey);
      });

    return () => { cancelled = true; };
  }, [publicKey]);

  if (userLoading) return <p className="p-10 text-gray-400">Loading…</p>;
  if (userError || !farmer) return (
    <p className="p-10 text-red-500">
      {userError}{' '}
      <Link to="/marketplace" className="text-green-700 underline">Back to marketplace</Link>
    </p>
  );

  const locationStr = [farmer.city, farmer.country ?? farmer.location].filter(Boolean).join(', ');

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link to="/marketplace" className="text-sm text-green-700 hover:underline mb-6 block">
        ← Back to Marketplace
      </Link>

      {/* Farmer card */}
      <div className="bg-white rounded-2xl shadow p-6 mb-8 flex items-start gap-5">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xl flex-shrink-0">
          {farmer.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-800">{farmer.name}</h1>
            {farmer.chain_verified && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                ✓ Chain Verified
              </span>
            )}
          </div>
          {locationStr && <p className="text-sm text-gray-500 mt-1">{locationStr}</p>}
          <p className="text-xs text-gray-400 mt-1 font-mono">{shortAddress(farmer.public_key)}</p>
          <p className="text-xs text-gray-400 mt-1">
            Member since {new Date(farmer.created_at).toLocaleDateString()}
          </p>
          {avgRating !== null && (
            <div className="flex items-center gap-1 mt-2">
              {[1,2,3,4,5].map((s) => (
                <span key={s} className={s <= Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-300'}>★</span>
              ))}
              <span className="text-xs text-gray-500 ml-1">{avgRating} ({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
            </div>
          )}
        </div>
      </div>

      {farmer.bio && (
        <div className="bg-white rounded-2xl shadow p-6 mb-8">
          <h2 className="text-base font-semibold text-gray-700 mb-2">About this Farmer</h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{farmer.bio}</p>
        </div>
      )}

      {/* Listings */}
      <h2 className="text-xl font-semibold text-gray-700 mb-4">
        Active Listings{' '}
        <span className="text-base font-normal text-gray-400">({activeProducts.length})</span>
      </h2>

      {productsLoading && <p className="text-gray-400">Loading products…</p>}

      {!productsLoading && activeProducts.length === 0 && (
        <p className="text-gray-400 py-8 text-center">This farmer has no active listings right now.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeProducts.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>

      {reviews.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Recent Reviews</h2>
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center gap-2 mb-1">
                  {[1,2,3,4,5].map((s) => (
                    <span key={s} className={s <= r.rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                  ))}
                  <span className="text-xs text-gray-400 ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
                <p className="text-xs text-gray-400 mt-1">— {r.buyer_name}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
