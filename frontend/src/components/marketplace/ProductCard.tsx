import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { stroopsToXlm } from '../../lib/stellar';
import StatusBadge from '../shared/StatusBadge';
import { useWalletStore } from '../../store/walletStore';
import { useWishlistStore } from '../../store/wishlistStore';

const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100%25" height="100%25" viewBox="0 0 400 176"%3E%3Crect fill="%23f0fdf4" width="400" height="176"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="40" fill="%2386efac"%3E🌿%3C/text%3E%3C/svg%3E';

export default function ProductCard({ product }: { product: Product }) {
  const { connected, role } = useWalletStore();
  const { has, toggle, load, loaded } = useWishlistStore();
  const isBuyer = connected && role === 'Buyer';

  useEffect(() => {
    if (isBuyer && !loaded) load();
  }, [isBuyer, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const image = product.imageCids?.[0]
    ? `https://ipfs.io/ipfs/${product.imageCids[0]}`
    : FALLBACK_IMAGE;

  const wishlisted = has(String(product.id));

  return (
    <div className="bg-white rounded-2xl shadow hover:shadow-md transition overflow-hidden flex flex-col relative">
      {/* Wishlist heart */}
      {isBuyer && (
        <button
          onClick={(e) => { e.preventDefault(); toggle(String(product.id)); }}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:scale-110 transition-transform"
          aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <svg className={`w-5 h-5 ${wishlisted ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      )}

      <Link to={`/marketplace/${product.id}`} className="flex flex-col flex-1">
        <img
          src={image}
          alt={product.name}
          className="h-44 w-full object-cover"
          onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
        />
        <div className="p-4 flex flex-col gap-2 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 truncate">{product.name}</h3>
            <StatusBadge status={product.status} />
          </div>
          <p className="text-sm text-gray-500 capitalize">{product.category}</p>
          <p className="text-sm text-gray-600">{product.quantity} {product.unit}</p>
          <p className="mt-auto text-green-700 font-bold text-lg">
            {stroopsToXlm(product.priceXlm).toFixed(2)} XLM / {product.unit}
          </p>
          {product.farmerName && <p className="text-xs text-gray-400">by {product.farmerName}</p>}
          {product.location && <p className="text-xs text-gray-400">{product.location}</p>}
        </div>
      </Link>
    </div>
  );
}
