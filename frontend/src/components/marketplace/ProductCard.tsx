import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { stroopsToXlm } from '../../lib/stellar';
import StatusBadge from '../shared/StatusBadge';

export default function ProductCard({ product }: { product: Product }) {
  const image = product.imageCids?.[0]
    ? `https://ipfs.io/ipfs/${product.imageCids[0]}`
    : '/placeholder-produce.jpg';

  return (
    <Link
      to={`/marketplace/${product.id}`}
      className="bg-white rounded-2xl shadow hover:shadow-md transition overflow-hidden flex flex-col"
    >
      <img src={image} alt={product.name} className="h-44 w-full object-cover" />
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
          {stroopsToXlm(product.priceXlm).toFixed(2)} XLM
        </p>
        {product.farmerName && (
          <p className="text-xs text-gray-400">by {product.farmerName}</p>
        )}
      </div>
    </Link>
  );
}
