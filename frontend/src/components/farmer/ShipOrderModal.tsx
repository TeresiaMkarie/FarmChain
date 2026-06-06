import { useState } from 'react';
import { shipOrder } from '../../lib/api';
import { markShipped } from '../../lib/soroban';
import { useWalletStore } from '../../store/walletStore';
import type { Order } from '../../types';

interface Props {
  order: Order;
  onClose: () => void;
  onShipped: () => void;
}

export default function ShipOrderModal({ order, onClose, onShipped }: Props) {
  const { publicKey } = useWalletStore();
  const [trackingInfo, setTrackingInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      if (order.onChainOrderId) {
        await markShipped(publicKey, order.onChainOrderId, trackingInfo || 'shipped');
      }
      await shipOrder(order.id, { trackingInfo: trackingInfo || null });
      onShipped();
    } catch (err: any) {
      setError(err.message ?? 'Failed to mark as shipped');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">Mark Order as Shipped</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5 text-sm text-gray-600 space-y-1">
          <p><span className="font-medium">Order:</span> #{order.id.slice(0, 8)}…</p>
          {order.productName && <p><span className="font-medium">Product:</span> {order.productName}</p>}
          <p><span className="font-medium">Buyer:</span> {order.buyerPk.slice(0, 6)}…{order.buyerPk.slice(-4)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tracking Info <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={trackingInfo}
              onChange={(e) => setTrackingInfo(e.target.value)}
              placeholder="e.g. Courier Express #TRK123456"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
              {loading ? 'Submitting…' : 'Confirm Shipped'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
