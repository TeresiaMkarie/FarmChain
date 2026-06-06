import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { stroopsToXlm } from '../../lib/stellar';
import StatusBadge from '../shared/StatusBadge';

const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100%25" height="100%25" viewBox="0 0 400 176"%3E%3Crect fill="%23f0fdf4" width="400" height="176"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="40" fill="%2386efac"%3E🌿%3C/text%3E%3C/svg%3E';

export default function ProductCard({ product }: { product: Product }) {
  const image = product.imageCids?.[0]
    ? `https://ipfs.io/ipfs/${product.imageCids[0]}`
    : FALLBACK_IMAGE;

  return (
    <Link
      to={`/marketplace/${product.id}`}
      className="bg-white rounded-2xl shadow hover:shadow-md transition overflow-hidden flex flex-col"
    >
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
        <p className="text-sm text-gray-600">
          {product.quantity} {product.unit}
        </p>
        <p className="mt-auto text-green-700 font-bold text-lg">
          {stroopsToXlm(product.priceXlm).toFixed(2)} XLM / {product.unit}
        </p>
        {product.farmerName && (
          <p className="text-xs text-gray-400">by {product.farmerName}</p>
        )}
        {product.location && (
          <p className="text-xs text-gray-400">{product.location}</p>
        )}
      </div>
    </Link>
  );
}
