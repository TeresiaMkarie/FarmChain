import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProduct } from '../hooks/useProducts';
import { useWalletStore } from '../store/walletStore';
import { createOrder as createOrderApi, fundOrder } from '../lib/api';
import { createOrder as createOrderChain } from '../lib/soroban';
import { stroopsToXlm } from '../lib/stellar';
import StatusBadge from '../components/shared/StatusBadge';
import TxStatusToast from '../components/shared/TxStatusToast';
import { parseError } from '../lib/errors';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { product, loading, error } = useProduct(id!);
  const { publicKey } = useWalletStore();
  const navigate = useNavigate();

  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState<{ status: 'pending' | 'success' | 'error'; message?: string } | null>(null);
  const [buying, setBuying] = useState(false);

  const handleBuy = async () => {
    if (!publicKey) {
      navigate('/auth');
      return;
    }
    if (!product) return;
    setBuying(true);
    setToast({ status: 'pending', message: 'Creating order…' });

    try {
      // 1. Create order record in DB
      const orderRes = await createOrderApi({ productId: product.id, quantity });
      const { orderId } = orderRes.data;

      // 2. Use a timestamp as a unique on-chain order ID (fits u64)
      const onChainOrderId = Date.now();
      const amountStroops = BigInt(product.priceXlm) * BigInt(quantity);

      setToast({ status: 'pending', message: 'Signing escrow transaction…' });

      // 3. Lock funds in the escrow contract
      const { txHash } = await createOrderChain(
        publicKey,
        onChainOrderId,
        product.onChainId ?? 0,
        product.farmerPk,
        amountStroops,
      );

      // 4. Mark order as funded in DB with on-chain details
      await fundOrder(orderId, {
        onChainOrderId,
        txHash,
        escrowId: import.meta.env.VITE_ESCROW_CONTRACT_ID,
      });

      setToast({ status: 'success', message: 'Order placed! Funds locked in escrow.' });
      setTimeout(() => navigate(`/orders/${orderId}`), 1500);
    } catch (err: any) {
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
  const isBuyer = publicKey && publicKey !== product.farmerPk;

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
              <p>{product.farmerName}</p>
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
            <button
              onClick={handleBuy}
              disabled={buying}
              className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition"
            >
              {buying ? 'Processing…' : `Buy for ${totalXlm} XLM`}
            </button>
          </div>
        )}

        {product.status === 'active' && !publicKey && (
          <div className="border-t pt-6">
            <Link
              to="/auth"
              className="block w-full text-center bg-green-700 hover:bg-green-600 text-white py-3 rounded-xl font-semibold transition"
            >
              Connect Wallet to Buy
            </Link>
          </div>
        )}

        {product.status !== 'active' && (
          <p className="text-sm text-gray-400 border-t pt-4 italic">
            This product is no longer available.
          </p>
        )}
      </div>

      {toast && <TxStatusToast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
