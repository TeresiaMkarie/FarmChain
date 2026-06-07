import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useWalletStore } from '../store/walletStore';
import { useOrders } from '../hooks/useOrders';
import { exportOrders, getRecurringOrders, createRecurringOrder, pauseResumeRecurring, deleteRecurringOrder } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import RecurringOrderModal from '../components/shared/RecurringOrderModal';
import { shortAddress, stroopsToXlm } from '../lib/stellar';
import type { Order } from '../types';

interface RecurringOrder {
  id: string;
  product_name: string;
  quantity: number;
  frequency: string;
  next_due_at: string;
  active: boolean;
}

export default function BuyerDashboard() {
  const { publicKey } = useWalletStore();
  const { orders, loading, error } = useOrders();
  const [recurring, setRecurring] = useState<RecurringOrder[]>([]);
  const [recurringModal, setRecurringModal] = useState<Order | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  useEffect(() => {
    getRecurringOrders().then((r) => setRecurring(r.data.recurring)).catch(() => {});
  }, []);

  const myOrders = orders.filter((o) => o.buyerPk === publicKey);
  const totalSpent = myOrders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + o.amount, 0);
  const activeOrders = myOrders.filter(
    (o) => !['completed', 'refunded'].includes(o.status),
  ).length;

  const handleSetupRecurring = async (
    freq: 'weekly' | 'fortnightly' | 'monthly',
    quantity: number,
    deliveryAddress: string,
  ) => {
    if (!recurringModal) return;
    const r = await createRecurringOrder({
      productId: recurringModal.productId,
      quantity,
      frequency: freq,
      deliveryAddress,
    });
    setRecurring((prev) => [...prev, r.data.recurring]);
    setRecurringModal(null);
  };

  const handleTogglePause = async (r: RecurringOrder) => {
    await pauseResumeRecurring(r.id, !r.active);
    setRecurring((prev) => prev.map((x) => x.id === r.id ? { ...x, active: !x.active } : x));
  };

  const handleCancelRecurring = async (id: string) => {
    await deleteRecurringOrder(id);
    setRecurring((prev) => prev.filter((x) => x.id !== id));
    setCancelConfirmId(null);
  };

  const isRecurring = (order: Order) =>
    recurring.some((r) => r.id === order.id);

  const FrequencyBadge = ({ freq, active }: { freq: string; active: boolean }) => (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
      {active ? 'Active' : 'Paused'} · <span className="capitalize">{freq}</span>
    </span>
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-green-800">Buyer Dashboard</h1>
          <p className="text-gray-500 font-mono text-sm mt-1">
            {shortAddress(publicKey ?? '')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportOrders().then((r) => {
              const url = URL.createObjectURL(r.data);
              const a = document.createElement('a');
              a.href = url; a.download = 'my-orders.csv'; a.click();
              URL.revokeObjectURL(url);
            })}
            className="border border-green-600 text-green-700 hover:bg-green-50 px-4 py-2 rounded-xl text-sm font-medium"
          >
            Export CSV
          </button>
          <Link
            to="/marketplace"
            className="bg-green-700 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold"
          >
            Browse Marketplace
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: 'Total Orders', value: myOrders.length },
          { label: 'Active Orders', value: activeOrders },
          { label: 'Total Spent (XLM)', value: stroopsToXlm(totalSpent).toFixed(2) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl shadow p-5 text-center">
            <p className="text-3xl font-bold text-green-700">{value}</p>
            <p className="text-gray-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Orders */}
      <section>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">My Orders</h2>

        {loading && <p className="text-gray-400">Loading…</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!loading && myOrders.length === 0 && (
          <p className="text-gray-400 text-center py-12">
            No orders yet.{' '}
            <Link to="/marketplace" className="text-green-700 underline">Browse the marketplace</Link>{' '}
            to get started.
          </p>
        )}

        {/* Mobile cards */}
        {!loading && myOrders.length > 0 && (
          <div className="sm:hidden space-y-3">
            {myOrders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl shadow p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-gray-800 text-sm">{o.product?.name ?? `#${o.productId?.slice(0,8)}`}</p>
                  <StatusBadge status={o.status} />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span className="font-mono">{o.id.slice(0, 8)}…</span>
                  <span className="font-semibold text-green-700">{stroopsToXlm(o.amount).toFixed(2)} XLM</span>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/orders/${o.id}`}
                    className="flex-1 text-center text-xs text-green-700 font-medium border border-green-200 rounded-lg py-1.5 hover:bg-green-50"
                  >
                    View Order
                  </Link>
                  {o.status === 'completed' && o.productId && !isRecurring(o) && (
                    <button
                      onClick={() => setRecurringModal(o)}
                      className="flex-1 text-center text-xs text-green-700 font-medium border border-green-200 rounded-lg py-1.5 hover:bg-green-50"
                    >
                      Repeat order
                    </button>
                  )}
                  {isRecurring(o) && (
                    <span className="flex-1 text-center text-xs text-green-600 font-medium border border-green-200 rounded-lg py-1.5 bg-green-50">
                      Recurring ✓
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop table */}
        {!loading && myOrders.length > 0 && (
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm bg-white rounded-xl shadow overflow-hidden">
              <thead className="bg-green-50 text-gray-600">
                <tr>
                  {['Order ID', 'Product', 'Amount (XLM)', 'Status', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myOrders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-gray-700">{o.product?.name ?? `#${o.productId}`}</td>
                    <td className="px-4 py-3">{stroopsToXlm(o.amount).toFixed(2)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link to={`/orders/${o.id}`} className="text-green-700 hover:underline text-xs font-medium">
                          View
                        </Link>
                        {o.status === 'completed' && o.productId && !isRecurring(o) && (
                          <button
                            onClick={() => setRecurringModal(o)}
                            className="text-xs text-green-700 hover:underline font-medium"
                          >
                            Repeat order
                          </button>
                        )}
                        {isRecurring(o) && (
                          <span className="text-xs text-green-600 font-medium">Recurring ✓</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recurring orders */}
      {recurring.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Recurring Orders</h2>
          <div className="space-y-3">
            {recurring.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl shadow p-5 space-y-3">
                {/* Top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{r.product_name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Qty {r.quantity} · Next due{' '}
                      <span className="font-medium text-gray-700">
                        {new Date(r.next_due_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </p>
                  </div>
                  <FrequencyBadge freq={r.frequency} active={r.active} />
                </div>

                {/* Cancel confirmation inline */}
                {cancelConfirmId === r.id ? (
                  <div className="bg-green-50 rounded-xl p-4 space-y-3">
                    <p className="text-sm text-green-800 font-medium">Cancel this recurring order?</p>
                    <p className="text-xs text-gray-500">
                      This will stop future reminders for {r.product_name}. Your existing orders are unaffected.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCancelConfirmId(null)}
                        className="flex-1 border border-green-700 text-green-700 hover:bg-green-100 py-2 rounded-xl text-sm font-semibold transition"
                      >
                        Keep it
                      </button>
                      <button
                        onClick={() => handleCancelRecurring(r.id)}
                        className="flex-1 bg-green-900 hover:bg-green-950 text-white py-2 rounded-xl text-sm font-semibold transition"
                      >
                        Yes, cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Action buttons */
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleTogglePause(r)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${
                        r.active
                          ? 'border-green-700 text-green-700 hover:bg-green-50'
                          : 'bg-green-700 hover:bg-green-600 text-white border-transparent'
                      }`}
                    >
                      {r.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => setCancelConfirmId(r.id)}
                      className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 rounded-xl text-sm font-semibold transition"
                    >
                      Cancel recurring
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recurring setup modal */}
      {recurringModal && (
        <RecurringOrderModal
          productName={recurringModal.product?.name ?? 'this product'}
          defaultQuantity={1}
          onConfirm={handleSetupRecurring}
          onCancel={() => setRecurringModal(null)}
        />
      )}
    </div>
  );
}
