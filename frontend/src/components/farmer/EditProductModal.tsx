import { useState } from 'react';
import { updateProduct } from '../../lib/api';
import { stroopsToXlm } from '../../lib/stellar';
import type { Product } from '../../types';

interface Props {
  product: Product;
  onClose: () => void;
  onUpdated: (raw: any) => void;
}

export default function EditProductModal({ product, onClose, onUpdated }: Props) {
  const [priceXlm, setPriceXlm] = useState(stroopsToXlm(product.priceXlm).toFixed(2));
  const [quantity, setQuantity] = useState(String(product.quantity));
  const [description, setDescription] = useState(product.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await updateProduct(String(product.id), {
        priceXlm: parseFloat(priceXlm),
        quantity: parseInt(quantity, 10),
        description: description || null,
      });
      onUpdated(res.data.product);
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">Edit Product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-2 mb-5 capitalize">
          {product.name} · {product.category} · {product.unit}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (XLM / {product.unit})</label>
              <input
                type="number" step="0.01" min="0.01"
                value={priceXlm}
                onChange={(e) => setPriceXlm(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({product.unit})</label>
              <input
                type="number" min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Update product description…"
              className={inputCls}
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition"
            >
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
