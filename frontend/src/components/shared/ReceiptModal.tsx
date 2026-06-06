import { useEffect, useState } from 'react';
import { getReceipt } from '../../lib/api';
import { stroopsToXlm, shortAddress } from '../../lib/stellar';
import type { Receipt } from '../../types';

interface Props {
  orderId: string;
  onClose: () => void;
}

export default function ReceiptModal({ orderId, onClose }: Props) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReceipt(orderId)
      .then((res) => {
        const r = res.data.receipt;
        setReceipt({
          id: r.id,
          orderId: r.order_id,
          txHash: r.tx_hash,
          createdAt: r.created_at,
          buyerPk: r.buyer_pk,
          farmerPk: r.farmer_pk,
          amount: Number(r.amount),
          quantity: r.quantity ?? 1,
          productName: r.product_name,
          unit: r.unit,
          category: r.category,
        });
      })
      .catch(() => setError('Could not load receipt.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-green-800">Purchase Receipt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {loading && <p className="text-gray-400 text-sm">Loading…</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {receipt && (
          <div className="space-y-3 text-sm">
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-700">
                {stroopsToXlm(receipt.amount).toFixed(2)} XLM
              </p>
              <p className="text-gray-500 mt-1">
                {receipt.quantity} {receipt.unit ?? ''} of {receipt.productName ?? 'product'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-400">Buyer</p>
                <p className="font-mono">{shortAddress(receipt.buyerPk)}</p>
              </div>
              <div>
                <p className="text-gray-400">Farmer</p>
                <p className="font-mono">{shortAddress(receipt.farmerPk)}</p>
              </div>
              <div>
                <p className="text-gray-400">Completed</p>
                <p>{new Date(receipt.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Category</p>
                <p className="capitalize">{receipt.category ?? '—'}</p>
              </div>
            </div>

            {receipt.txHash && (
              <div>
                <p className="text-gray-400">Transaction Hash</p>
                <p className="font-mono text-xs break-all text-gray-700">{receipt.txHash}</p>
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="w-full border border-green-600 text-green-700 hover:bg-green-50 py-2 rounded-lg font-medium text-sm transition"
            >
              Print Receipt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
