import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useOrder } from '../hooks/useOrders';
import { useWalletStore } from '../store/walletStore';
import { markShipped, confirmDelivery, raiseDispute } from '../lib/soroban';
import { shipOrder, completeOrder, disputeOrder } from '../lib/api';
import api from '../lib/api';
import { stroopsToXlm, shortAddress, explorerTxUrl } from '../lib/stellar';
import StatusBadge from '../components/shared/StatusBadge';
import TxStatusToast from '../components/shared/TxStatusToast';
import OrderTimeline from '../components/shared/OrderTimeline';
import ReceiptModal from '../components/shared/ReceiptModal';
import MessageThread from '../components/shared/MessageThread';
import { parseError } from '../lib/errors';

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { order, loading, setOrder } = useOrder(id!);
  const { publicKey, role } = useWalletStore();
  const [toast, setToast] = useState<{ status: 'pending' | 'success' | 'error'; message?: string } | null>(null);
  const [trackingInfo, setTrackingInfo] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (!order || order.status !== 'completed' || !isBuyer) return;
    api.get('/reviews', { params: { productId: order.productId } })
      .then((r) => {
        const mine = r.data.reviews.find((rv: { buyer_pk: string }) => rv.buyer_pk === publicKey);
        if (mine) setReviewSubmitted(true);
      })
      .catch(() => {});
  }, [order?.id, order?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReview = async () => {
    if (!order || reviewRating === 0) return;
    setReviewLoading(true);
    try {
      await api.post('/reviews', { orderId: order.id, rating: reviewRating, comment: reviewComment.trim() || undefined });
      setReviewSubmitted(true);
      setToast({ status: 'success', message: 'Review submitted. Thank you!' });
    } catch {
      setToast({ status: 'error', message: 'Failed to submit review.' });
    } finally {
      setReviewLoading(false);
    }
  };

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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      setToast({ status: 'error', message: parseError(err) });
    }
  };

  if (loading) return <p className="p-10 text-gray-400">Loading order…</p>;
  if (!order) return <p className="p-10 text-red-500">Order not found.</p>;

  const backTo = role === 'Farmer' ? '/farmer/dashboard' : '/buyer/dashboard';

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-green-700 hover:underline mb-6">
        ← Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold text-green-800 mb-4">Order Detail</h1>

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
          {(order as any).deliveryDate && (
            <div>
              <p className="text-gray-500">Requested Delivery</p>
              <p>{new Date((order as any).deliveryDate).toLocaleDateString()}</p>
            </div>
          )}
          {order.txHash && (
            <div className="col-span-2">
              <p className="text-gray-500 mb-1">Transaction</p>
              <a
                href={explorerTxUrl(order.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-green-700 hover:underline break-all"
              >
                {order.txHash.slice(0, 16)}…{order.txHash.slice(-8)} ↗
              </a>
            </div>
          )}
        </div>

        {order.trackingInfo && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="text-gray-500 mb-1">Tracking Info</p>
            <p>{order.trackingInfo}</p>
          </div>
        )}

        <OrderTimeline
          status={order.status}
          createdAt={order.createdAt}
          updatedAt={order.updatedAt}
          trackingInfo={order.trackingInfo}
        />

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

          {(isBuyer || isFarmer) && order.status === 'completed' && (
            <button
              onClick={() => setShowReceipt(true)}
              className="w-full border border-green-600 text-green-700 hover:bg-green-50 py-2.5 rounded-xl font-semibold text-sm"
            >
              View Receipt
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

      {/* Review form — buyer, completed order, not yet reviewed */}
      {isBuyer && order.status === 'completed' && !reviewSubmitted && (
        <div className="bg-white rounded-2xl shadow p-6 mt-4">
          <h3 className="font-semibold text-gray-700 mb-3">Leave a Review</h3>
          <div className="flex gap-2 mb-3">
            {[1,2,3,4,5].map((s) => (
              <button key={s} onClick={() => setReviewRating(s)} className={`text-2xl ${s <= reviewRating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}>★</button>
            ))}
          </div>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Share your experience (optional)…"
            maxLength={1000}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none mb-3"
          />
          <button
            onClick={handleReview}
            disabled={reviewRating === 0 || reviewLoading}
            className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm"
          >
            {reviewLoading ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      )}
      {isBuyer && order.status === 'completed' && reviewSubmitted && (
        <p className="text-center text-sm text-gray-400 mt-4">You reviewed this order.</p>
      )}

      {(isBuyer || isFarmer) && publicKey && (
        <MessageThread orderId={order.id} myPublicKey={publicKey} />
      )}

      {showReceipt && (
        <ReceiptModal orderId={order.id} onClose={() => setShowReceipt(false)} />
      )}

      {toast && <TxStatusToast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
