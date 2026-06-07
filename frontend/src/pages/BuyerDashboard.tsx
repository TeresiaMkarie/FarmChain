import { Link } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { useOrders } from '../hooks/useOrders';
import StatusBadge from '../components/shared/StatusBadge';
import { shortAddress, stroopsToXlm } from '../lib/stellar';

export default function BuyerDashboard() {
  const { publicKey } = useWalletStore();
  const { orders, loading, error } = useOrders();

  const myOrders = orders.filter((o) => o.buyerPk === publicKey);
  const totalSpent = myOrders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + o.amount, 0);
  const activeOrders = myOrders.filter(
    (o) => !['completed', 'refunded'].includes(o.status),
  ).length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-green-800">Buyer Dashboard</h1>
          <p className="text-gray-500 font-mono text-sm mt-1">
            {shortAddress(publicKey ?? '')}
          </p>
        </div>
        <Link
          to="/marketplace"
          className="bg-green-700 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold"
        >
          Browse Marketplace
        </Link>
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
                <Link to={`/orders/${o.id}`} className="block text-center text-xs text-green-700 font-medium border border-green-200 rounded-lg py-1.5 hover:bg-green-50">
                  View Order
                </Link>
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
                      <Link to={`/orders/${o.id}`} className="text-green-700 hover:underline text-xs font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
