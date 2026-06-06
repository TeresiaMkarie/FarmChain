import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useOrder } from '../hooks/useOrders';
import { useWalletStore } from '../store/walletStore';
import { markShipped, confirmDelivery, raiseDispute } from '../lib/soroban';
import { shipOrder, completeOrder, disputeOrder } from '../lib/api';
import { stroopsToXlm, shortAddress } from '../lib/stellar';
import StatusBadge from '../components/shared/StatusBadge';
import TxStatusToast from '../components/shared/TxStatusToast';
import { parseError } from '../lib/errors';

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { order, loading, setOrder } = useOrder(id!);
  const { publicKey } = useWalletStore();
  const [toast, setToast] = useState<{ status: 'pending' | 'success' | 'error'; message?: string } | null>(null);
  const [trackingInfo, setTrackingInfo] = useState('');

  const isFarmer = publicKey === order?.farmerPk;
  const isBuyer = publicKey === order?.buyerPk;

  const handleShip = async () => {
    if (!order || !publicKey) return;
    setToast({ status: 'pending', message: 'Signing shipment transaction…' });
    try {
      const { txHash } = await markShipped(publicKey, order.onChainOrderId!, trackingInfo);
      await shipOrder(order.id, { trackingInfo, txHash });
      setOrder({ ...order, status: 'shipped' });
      setToast({ status: 'success', message: 'Order marked as shipped!' });
    } catch (err: any) {
      setToast({ status: 'error', message: parseError(err) });
    }
  };

  const handleConfirm = async () => {
    if (!order || !publicKey) return;
    setToast({ status: 'pending', message: 'Confirming delivery and releasing funds…' });
    try {
      const { txHash } = await confirmDelivery(publicKey, order.onChainOrderId!);
      await completeOrder(order.id, { txHash });
      setOrder({ ...order, status: 'completed' });
      setToast({ status: 'success', message: 'Delivery confirmed! Payment released to farmer.' });
    } catch (err: any) {
      setToast({ status: 'error', message: parseError(err) });
    }
  };

  const handleDispute = async () => {
    if (!order || !publicKey) return;
    setToast({ status: 'pending', message: 'Raising dispute…' });
    try {
      await raiseDispute(publicKey, order.onChainOrderId!);
      await disputeOrder(order.id, {});
      setOrder({ ...order, status: 'disputed' });
      setToast({ status: 'success', message: 'Dispute raised. Admin will review.' });
    } catch (err: any) {
      setToast({ status: 'error', message: parseError(err) });
    }
  };

  if (loading) return <p className="p-10 text-gray-400">Loading order…</p>;
  if (!order) return <p className="p-10 text-red-500">Order not found.</p>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-green-800 mb-6">Order Detail</h1>

      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="font-mono text-xs text-gray-400">{order.id}</span>
          <StatusBadge status={order.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Farmer</p>
            <p className="font-mono">{shortAddress(order.farmerPk)}</p>
          </div>
          <div>
            <p className="text-gray-500">Buyer</p>
            <p className="font-mono">{shortAddress(order.buyerPk)}</p>
          </div>
          <div>
            <p className="text-gray-500">Amount</p>
            <p className="font-bold text-green-700">{stroopsToXlm(order.amount).toFixed(2)} XLM</p>
          </div>
          <div>
            <p className="text-gray-500">Created</p>
            <p>{new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {order.trackingInfo && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="text-gray-500 mb-1">Tracking Info</p>
            <p>{order.trackingInfo}</p>
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 space-y-3">
          {isFarmer && order.status === 'funded' && (
            <>
              <input
                value={trackingInfo}
                onChange={(e) => setTrackingInfo(e.target.value)}
                placeholder="Tracking number or note…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={handleShip}
                disabled={!trackingInfo.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold"
              >
                Mark as Shipped
              </button>
            </>
          )}

          {isBuyer && order.status === 'shipped' && (
            <button
              onClick={handleConfirm}
              className="w-full bg-green-700 hover:bg-green-600 text-white py-2.5 rounded-xl font-semibold"
            >
              Confirm Delivery & Release Payment
            </button>
          )}

          {isBuyer && ['funded', 'shipped'].includes(order.status) && (
            <button
              onClick={handleDispute}
              className="w-full border border-red-500 text-red-600 hover:bg-red-50 py-2.5 rounded-xl font-semibold"
            >
              Raise Dispute
            </button>
          )}

          {isBuyer && order.status === 'completed' && order.productId && (
            <Link
              to={`/marketplace/${order.productId}`}
              className="block text-center w-full bg-green-50 hover:bg-green-100 text-green-700 py-2.5 rounded-xl font-semibold text-sm"
            >
              Buy Again
            </Link>
          )}
        </div>
      </div>

      {toast && <TxStatusToast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
