import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { useWalletStore } from '../store/walletStore';
import { useBalance } from '../hooks/useBalance';
import { stroopsToXlm } from '../lib/stellar';
import { createOrder as createOrderApi, fundOrder, cancelOrder, getUser } from '../lib/api';
import { createOrder as createOrderChain } from '../lib/soroban';
import { parseError } from '../lib/errors';
import TxStatusToast from '../components/shared/TxStatusToast';

function buildAddressFromProfile(u: {
  address_line?: string | null;
  city?: string | null;
  county?: string | null;
  country?: string | null;
  location?: string | null;
}): string {
  const parts = [u.address_line, u.city, u.county, u.country].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return u.location ?? '';
}

export default function CartPage() {
  const { items, remove, setQty, clear, count } = useCartStore();
  const { publicKey } = useWalletStore();
  const navigate = useNavigate();
  const { xlm: balanceXlm } = useBalance(publicKey ?? '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [toast, setToast] = useState<{ status: 'pending' | 'success' | 'error'; message?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    getUser(publicKey)
      .then((res) => {
        const saved = buildAddressFromProfile(res.data.user ?? {});
        if (saved) setDeliveryAddress(saved);
      })
      .catch(() => {});
  }, [publicKey]);

  const totalStroops = items.reduce(
    (sum, item) => sum + BigInt(item.priceXlm) * BigInt(item.quantity),
    BigInt(0),
  );
  const totalXlm = stroopsToXlm(Number(totalStroops)).toFixed(2);
  const insufficientBalance =
    balanceXlm !== null && parseFloat(totalXlm) > parseFloat(balanceXlm) - 1;

  const handleCheckout = async () => {
    if (!publicKey || items.length === 0) return;
    setChecking(true);
    setProgress({ done: 0, total: items.length });

    const placedOrderIds: string[] = [];

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setToast({ status: 'pending', message: `Processing ${item.name} (${i + 1}/${items.length})…` });

        let orderId: string | null = null;
        try {
          const orderRes = await createOrderApi({
            productId: item.productId,
            quantity: item.quantity,
            deliveryAddress,
          });
          orderId = orderRes.data.orderId;

          const onChainOrderId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
          const amountStroops = BigInt(item.priceXlm) * BigInt(item.quantity);

          setToast({ status: 'pending', message: `Sign transaction for ${item.name}…` });

          const { txHash } = await createOrderChain(
            publicKey,
            onChainOrderId,
            item.onChainId,
            item.farmerPk,
            amountStroops,
          );

          await fundOrder(orderId!, {
            onChainOrderId,
            txHash,
            escrowId: import.meta.env.VITE_ESCROW_CONTRACT_ID,
          });

          placedOrderIds.push(orderId!);
          setProgress({ done: i + 1, total: items.length });
        } catch (err) {
          if (orderId) await cancelOrder(orderId).catch(() => {});
          throw new Error(`Failed on "${item.name}": ${parseError(err)}`);
        }
      }

      clear();
      setToast({ status: 'success', message: `${placedOrderIds.length} order(s) placed successfully!` });
      setTimeout(() => navigate('/buyer/dashboard'), 1800);
    } catch (err: unknown) {
      setToast({ status: 'error', message: parseError(err) });
      setChecking(false);
      setProgress(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-6xl mb-4">🛒</p>
        <p className="text-gray-500 text-lg mb-6">Your cart is empty.</p>
        <Link to="/marketplace" className="bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-semibold">
          Browse Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-green-700 hover:underline mb-6">
        ← Continue Shopping
      </Link>
      <h1 className="text-2xl font-bold text-green-800 mb-6">Your Cart ({count()} items)</h1>

      <div className="space-y-3 mb-6">
        {items.map((item) => {
          const lineXlm = stroopsToXlm(Number(BigInt(item.priceXlm) * BigInt(item.quantity))).toFixed(2);
          return (
            <div key={item.productId} className="bg-white rounded-2xl shadow p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                <p className="text-sm text-gray-500">
                  {stroopsToXlm(item.priceXlm).toFixed(2)} XLM / {item.unit}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQty(item.productId, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 font-bold flex items-center justify-center text-lg"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                <button
                  onClick={() => setQty(item.productId, item.quantity + 1)}
                  disabled={item.quantity >= item.maxQuantity}
                  className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 font-bold flex items-center justify-center text-lg"
                >
                  +
                </button>
              </div>

              <p className="font-bold text-green-700 w-24 text-right">{lineXlm} XLM</p>

              <button
                onClick={() => remove(item.productId)}
                className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Delivery address</label>
          <textarea
            rows={2}
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Enter your delivery or pick-up address…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        <div className="flex justify-between items-center border-t pt-4">
          <span className="font-semibold text-gray-700">Total</span>
          <span className="text-xl font-bold text-green-700">{totalXlm} XLM</span>
        </div>

        {insufficientBalance && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            Insufficient balance. You have {balanceXlm} XLM but need at least{' '}
            {(parseFloat(totalXlm) + 1).toFixed(2)} XLM.
          </p>
        )}

        {progress && (
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={checking || !deliveryAddress.trim() || insufficientBalance}
          className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold"
        >
          {checking ? `Placing orders… (${progress?.done ?? 0}/${progress?.total ?? items.length})` : `Place ${items.length > 1 ? `${items.length} Orders` : 'Order'} · ${totalXlm} XLM`}
        </button>

        <button
          onClick={() => { if (window.confirm('Clear your cart?')) clear(); }}
          className="w-full text-sm text-gray-400 hover:text-red-500 py-1"
        >
          Clear cart
        </button>
      </div>

      {toast && <TxStatusToast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
