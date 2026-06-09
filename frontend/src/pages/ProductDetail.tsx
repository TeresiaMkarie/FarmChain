import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProduct } from '../hooks/useProducts';
import { useWalletStore } from '../store/walletStore';
import { useBalance } from '../hooks/useBalance';
import { createOrder as createOrderApi, fundOrder, cancelOrder, abortOrder, getUser } from '../lib/api';
import { createOrder as createOrderChain } from '../lib/soroban';
import { stroopsToXlm } from '../lib/stellar';
import StatusBadge from '../components/shared/StatusBadge';
import TxStatusToast from '../components/shared/TxStatusToast';
import { parseError } from '../lib/errors';
import { useCartStore } from '../store/cartStore';

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

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { product, loading, error } = useProduct(id!);
  const { publicKey, role } = useWalletStore();
  const navigate = useNavigate();
  const { add: addToCart } = useCartStore();

  const [quantity, setQuantity] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [toast, setToast] = useState<{ status: 'pending' | 'success' | 'error'; message?: string } | null>(null);
  const [buying, setBuying] = useState(false);

  const { xlm: balanceXlm } = useBalance(publicKey ?? '');

  useEffect(() => {
    if (!publicKey || addressLoaded) return;
    getUser(publicKey)
      .then((res) => {
        const saved = buildAddressFromProfile(res.data.user ?? {});
        if (saved) setDeliveryAddress(saved);
      })
      .catch(() => {})
      .finally(() => setAddressLoaded(true));
  }, [publicKey, addressLoaded]);

  const handleBuy = async () => {
    if (role === 'Farmer') {
    alert('Farmers cannot purchase products. Please create a Buyer account.')
    return
  }
    if (!publicKey) {
      navigate('/auth');
      return;
    }
    if (!product) return;
    setBuying(true);
    setToast({ status: 'pending', message: 'Creating order…' });

    let orderId: string | null = null;

    try {
      // 1. Create order record in DB
      let orderRes;
      try {
        orderRes = await createOrderApi({ productId: product.id, quantity, deliveryAddress });
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number; data?: { available?: number } } })?.response?.status;
        if (status === 409) {
          const available = (err as { response: { data?: { available?: number } } }).response.data?.available ?? 1;
          setQuantity(Math.min(quantity, available));
          throw new Error(`Only ${available} ${product.unit} available now. Quantity adjusted.`, { cause: err });
        }
        throw err;
      }
      orderId = orderRes.data.orderId;

      // 2. Random u64-safe order ID — avoids timestamp collisions
      const onChainOrderId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
      const amountStroops = BigInt(product.priceXlm) * BigInt(quantity);

      setToast({ status: 'pending', message: 'Waiting for Freighter signature…' });

      // 3. Lock funds in escrow — if this fails, roll back the DB order
      let txHash: string;
      try {
        ({ txHash } = await createOrderChain(
          publicKey,
          onChainOrderId,
          product.onChainId ?? 0,
          product.farmerPk,
          amountStroops,
        ));
      } catch (escrowErr) {
        // Hard-delete the pending DB order so it never shows as 'cancelled'
        await abortOrder(orderId!).catch(() => {});
        throw escrowErr;
      }

      // 4. Mark order as funded
      await fundOrder(orderId!, {
        onChainOrderId,
        txHash,
        escrowId: import.meta.env.VITE_ESCROW_CONTRACT_ID,
      });

      setToast({ status: 'success', message: 'Order placed! Funds locked in escrow.' });
      setTimeout(() => navigate(`/orders/${orderId}`), 1500);
    } catch (err: unknown) {
      setToast({ status: 'error', message: parseError(err) });
      setBuying(false);
    }
  };

  if (loading) return <p className="p-10 text-gray-400">Loading…</p>;
  if (error || !product) return (
    <p className="p-10 text-red-500">
      Product not found.{' '}
      <Link to="/marketplace" className="text-green-700 underline">Back to marketplace</Link>
    </p>
  );

  const totalXlm = stroopsToXlm(Number(BigInt(product.priceXlm) * BigInt(quantity))).toFixed(2);
  const isBuyer = publicKey && publicKey !== product.farmerPk && role !== 'Farmer';
  const insufficientBalance =
    balanceXlm !== null && parseFloat(totalXlm) > parseFloat(balanceXlm) - 1;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link to="/marketplace" className="text-sm text-green-700 hover:underline mb-6 block">
        ← Back to Marketplace
      </Link>

      {product.imageCids?.[0] && (
        <img
          src={`https://ipfs.io/ipfs/${product.imageCids[0]}`}
          alt={product.name}
          className="w-full h-64 object-cover rounded-2xl mb-6"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{product.name}</h1>
            <p className="text-sm text-gray-500 capitalize mt-1">{product.category}</p>
          </div>
          <StatusBadge status={product.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Price per unit</p>
            <p className="font-bold text-green-700 text-xl">
              {stroopsToXlm(product.priceXlm).toFixed(2)} XLM / {product.unit}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Available</p>
            <p className="font-medium text-base">{product.quantity} {product.unit}</p>
          </div>
          {product.farmerName && (
            <div>
              <p className="text-gray-500">Farmer</p>
              <Link
                to={`/farmers/${product.farmerPk}`}
                className="text-green-700 hover:underline font-medium"
              >
                {product.farmerName}
              </Link>
            </div>
          )}
          {product.location && (
            <div>
              <p className="text-gray-500">Location</p>
              <p>{product.location}</p>
            </div>
          )}
        </div>

        {product.description && (
          <p className="text-sm text-gray-600 border-t pt-4">{product.description}</p>
        )}

        {product.status === 'active' && isBuyer && (
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="text-sm font-medium text-gray-700">
                Quantity ({product.unit})
              </label>
              <input
                type="number"
                min={1}
                max={product.quantity}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Math.min(product.quantity, Number(e.target.value))))
                }
                className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-sm text-gray-600">
                Total:{' '}
                <strong className="text-green-700">{totalXlm} XLM</strong>
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Delivery / pick-up address
                </label>
                {deliveryAddress && (
                  <button
                    type="button"
                    onClick={() => setDeliveryAddress('')}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                rows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter your delivery or pick-up address…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
              {!deliveryAddress.trim() && (
                <p className="text-xs text-amber-600">
                  Address is required.{' '}
                  <Link to="/settings" className="underline">
                    Save one in your profile
                  </Link>{' '}
                  to auto-fill next time.
                </p>
              )}
            </div>

            {insufficientBalance && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                Insufficient balance. You have {balanceXlm} XLM but need at least{' '}
                {(parseFloat(totalXlm) + 1).toFixed(2)} XLM (including fees).
              </p>
            )}

            
             