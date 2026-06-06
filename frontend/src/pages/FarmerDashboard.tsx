import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { useProducts } from '../hooks/useProducts';
import { useOrders } from '../hooks/useOrders';
import { useDisputes } from '../hooks/useDisputes';
import StatusBadge from '../components/shared/StatusBadge';
import TxStatusToast from '../components/shared/TxStatusToast';
import ShipOrderModal from '../components/farmer/ShipOrderModal';
import EditProductModal, { type RawProductUpdate } from '../components/farmer/EditProductModal';
import { shortAddress, stroopsToXlm } from '../lib/stellar';
import { delistProduct as delistProductApi, activateProduct } from '../lib/api';
import { listProduct, delistProduct as delistProductChain } from '../lib/soroban';
import { parseError } from '../lib/errors';
import type { Order, Product } from '../types';

type Toast = { status: 'pending' | 'success' | 'error'; message?: string };

export default function FarmerDashboard() {
  const { publicKey } = useWalletStore();

  const { products, loading: pLoading, setProducts } = useProducts(
    publicKey ? { farmer: publicKey } : undefined,
  );
  const { orders, loading: oLoading, refresh: refreshOrders } = useOrders();
  const { disputes, loading: dLoading } = useDisputes();

  const [shipModal, setShipModal] = useState<Order | null>(null);
  const [editModal, setEditModal] = useState<Product | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [confirmDelistId, setConfirmDelistId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // ── Financial summary ────────────────────────────────────────────────────
  const completedEarnings = orders
    .filter((o) => o.status === 'completed')
    .reduce((s, o) => s + Number(o.amount), 0);
  const inEscrow = orders
    .filter((o) => ['funded', 'shipped'].includes(o.status))
    .reduce((s, o) => s + Number(o.amount), 0);
  const atRisk = orders
    .filter((o) => o.status === 'disputed')
    .reduce((s, o) => s + Number(o.amount), 0);

  // ── Action inbox items ────────────────────────────────────────────────────
  const fundedOrders = orders.filter((o) => o.status === 'funded');
  const pendingProducts = products.filter((p) => p.status === 'pending');
  const disputedOrders = orders.filter((o) => o.status === 'disputed');
  const inboxCount = fundedOrders.length + pendingProducts.length + disputedOrders.length;

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleActivate = async (product: Product) => {
    if (!publicKey || !product.metadataHash) return;
    const id = String(product.id);
    setActivatingId(id);
    setToast({ status: 'pending', message: `Activating ${product.name}…` });
    try {
      const { txHash, onChainId } = await listProduct(
        publicKey,
        BigInt(product.priceXlm),
        BigInt(product.quantity),
        product.metadataHash,
      );
      await activateProduct(id, { onChainId, txHash });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: 'active' as const } : p)),
      );
      setToast({ status: 'success', message: `${product.name} is now live!` });
    } catch (err) {
      setToast({ status: 'error', message: parseError(err) });
    } finally {
      setActivatingId(null);
    }
  };

  const handleDelist = async (product: Product) => {
    setConfirmDelistId(null);
    setToast({ status: 'pending', message: `Delisting ${product.name}…` });
    try {
      // Remove from on-chain marketplace if the product was activated
      if (product.onChainId && publicKey) {
        await delistProductChain(publicKey, product.onChainId);
      }
      await delistProductApi(String(product.id));
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: 'cancelled' as const } : p)),
      );
      setToast({ status: 'success', message: `${product.name} has been delisted.` });
    } catch (err) {
      setToast({ status: 'error', message: parseError(err) });
    }
  };

  const handleShipped = () => {
    setShipModal(null);
    refreshOrders();
    setToast({ status: 'success', message: 'Order marked as shipped.' });
  };

  const handleProductUpdated = (raw: RawProductUpdate) => {
    setProducts((prev) =>
      prev.map((p) =>
        String(p.id) === String(raw.id)
          ? { ...p, priceXlm: raw.price_xlm, quantity: raw.quantity, description: raw.description ?? undefined }
          : p,
      ),
    );
    setEditModal(null);
    setToast({ status: 'success', message: 'Product updated.' });
  };

  const btnSm = 'px-2.5 py-1 rounded-lg text-xs font-medium transition';

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-green-800">Farmer Dashboard</h1>
          <p className="text-gray-500 font-mono text-sm mt-1">{shortAddress(publicKey ?? '')}</p>
        </div>
        <Link
          to="/farmer/list-product"
          className="bg-green-700 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition"
        >
          + List Product
        </Link>
      </div>

      {/* ── Earnings panel ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Completed Earnings', value: completedEarnings, colour: 'text-green-700', bg: 'bg-green-50' },
          { label: 'In Escrow', value: inEscrow, colour: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Disputed / At Risk', value: atRisk, colour: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, colour, bg }) => (
          <div key={label} className={`rounded-2xl shadow p-5 text-center ${bg}`}>
            <p className={`text-2xl font-bold ${colour}`}>{stroopsToXlm(value).toFixed(2)} XLM</p>
            <p className="text-gray-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Action Inbox ── */}
      {inboxCount > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-3 flex items-center gap-2">
            Action Inbox
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {inboxCount}
            </span>
          </h2>
          <div className="space-y-2">
            {fundedOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between bg-white border-l-4 border-orange-400 rounded-xl shadow-sm px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    New order — {shortAddress(o.buyerPk)} bought{' '}
                    {o.productName ? <span className="font-semibold">{o.productName}</span> : 'a product'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {stroopsToXlm(Number(o.amount)).toFixed(2)} XLM · #{o.id.slice(0, 8)}
                  </p>
                </div>
                <button
                  onClick={() => setShipModal(o)}
                  className={`${btnSm} bg-orange-500 hover:bg-orange-400 text-white`}
                >
                  Ship
                </button>
              </div>
            ))}

            {pendingProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-white border-l-4 border-yellow-400 rounded-xl shadow-sm px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    <span className="font-semibold">{p.name}</span> is not yet live on-chain
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{p.category} · {p.quantity} {p.unit}</p>
                </div>
                <button
                  onClick={() => handleActivate(p)}
                  disabled={activatingId === String(p.id)}
                  className={`${btnSm} bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-white`}
                >
                  {activatingId === String(p.id) ? 'Activating…' : 'Activate'}
                </button>
              </div>
            ))}

            {disputedOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between bg-white border-l-4 border-red-400 rounded-xl shadow-sm px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Dispute on order <span className="font-semibold">#{o.id.slice(0, 8)}</span>
                    {o.productName && <> — {o.productName}</>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Awaiting admin resolution</p>
                </div>
                <Link
                  to={`/orders/${o.id}`}
                  className={`${btnSm} bg-red-100 hover:bg-red-200 text-red-700`}
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── My Listings ── */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">My Listings</h2>
        {pLoading ? (
          <p className="text-gray-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white rounded-xl shadow overflow-hidden">
              <thead className="bg-green-50 text-gray-600">
                <tr>
                  {['Product', 'Category', 'Stock', 'Price (XLM)', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const lowStock = p.status === 'active' && p.quantity > 0 && p.quantity <= 10;
                  return (
                    <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 capitalize">{p.category}</td>
                      <td className="px-4 py-3">
                        {p.quantity} {p.unit}
                        {lowStock && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">
                            Low
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{stroopsToXlm(p.priceXlm).toFixed(2)}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {p.status === 'pending' && (
                            <button
                              onClick={() => handleActivate(p)}
                              disabled={activatingId === String(p.id)}
                              className={`${btnSm} bg-yellow-100 hover:bg-yellow-200 disabled:opacity-50 text-yellow-800`}
                            >
                              {activatingId === String(p.id) ? '…' : 'Activate'}
                            </button>
                          )}
                          {(p.status === 'active' || p.status === 'pending') && (
                            <button
                              onClick={() => setEditModal(p)}
                              className={`${btnSm} bg-blue-50 hover:bg-blue-100 text-blue-700`}
                            >
                              Edit
                            </button>
                          )}
                          {(p.status === 'active' || p.status === 'pending') && (
                            confirmDelistId === String(p.id) ? (
                              <>
                                <button
                                  onClick={() => handleDelist(p)}
                                  className={`${btnSm} bg-red-600 hover:bg-red-700 text-white`}
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDelistId(null)}
                                  className={`${btnSm} bg-gray-100 hover:bg-gray-200 text-gray-600`}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmDelistId(String(p.id))}
                                className={`${btnSm} bg-red-50 hover:bg-red-100 text-red-600`}
                              >
                                Delist
                              </button>
                            )
                          )}
                          {(p.status === 'sold' || p.status === 'cancelled') && (
                            <Link
                              to="/farmer/list-product"
                              className={`${btnSm} bg-gray-100 hover:bg-gray-200 text-gray-600`}
                            >
                              Re-list
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No products listed yet.{' '}
                      <Link to="/farmer/list-product" className="text-green-700 underline">
                        List your first product
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Incoming Orders ── */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Incoming Orders</h2>
        {oLoading ? (
          <p className="text-gray-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white rounded-xl shadow overflow-hidden">
              <thead className="bg-green-50 text-gray-600">
                <tr>
                  {['Order ID', 'Product', 'Buyer', 'Amount (XLM)', 'Status', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-gray-700">{o.productName ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{shortAddress(o.buyerPk)}</td>
                    <td className="px-4 py-3">{stroopsToXlm(Number(o.amount)).toFixed(2)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3">
                      {o.status === 'funded' && (
                        <button
                          onClick={() => setShipModal(o)}
                          className={`${btnSm} bg-green-100 hover:bg-green-200 text-green-700`}
                        >
                          Ship
                        </button>
                      )}
                      {o.status === 'disputed' && (
                        <Link
                          to={`/orders/${o.id}`}
                          className={`${btnSm} bg-red-50 hover:bg-red-100 text-red-600`}
                        >
                          Dispute
                        </Link>
                      )}
                      {!['funded', 'disputed'].includes(o.status) && (
                        <Link
                          to={`/orders/${o.id}`}
                          className={`${btnSm} bg-gray-100 hover:bg-gray-200 text-gray-600`}
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Open Disputes ── */}
      {!dLoading && disputes.filter((d) => d.status === 'open').length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            Open Disputes
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {disputes.filter((d) => d.status === 'open').length}
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white rounded-xl shadow overflow-hidden">
              <thead className="bg-red-50 text-gray-600">
                <tr>
                  {['Order', 'Product', 'Buyer', 'Amount (XLM)', 'Reason', 'Date', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {disputes
                  .filter((d) => d.status === 'open')
                  .map((d) => (
                    <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{d.orderId.slice(0, 8)}…</td>
                      <td className="px-4 py-3">{d.productName ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{shortAddress(d.buyerPk)}</td>
                      <td className="px-4 py-3">{stroopsToXlm(Number(d.amount)).toFixed(2)}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-500">{d.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/orders/${d.orderId}`}
                          className={`${btnSm} bg-red-50 hover:bg-red-100 text-red-600`}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Modals ── */}
      {shipModal && (
        <ShipOrderModal
          order={shipModal}
          onClose={() => setShipModal(null)}
          onShipped={handleShipped}
        />
      )}
      {editModal && (
        <EditProductModal
          product={editModal}
          onClose={() => setEditModal(null)}
          onUpdated={handleProductUpdated}
        />
      )}
      {toast && <TxStatusToast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
