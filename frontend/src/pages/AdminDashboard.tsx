import { useState, useEffect } from 'react';
import api from '../lib/api';
import { stroopsToXlm, shortAddress } from '../lib/stellar';
import StatusBadge from '../components/shared/StatusBadge';

interface Dispute {
  id: string;
  order_id: string;
  raised_by: string;
  reason: string | null;
  status: string;
  buyer_pk: string;
  farmer_pk: string;
  buyer_name: string;
  farmer_name: string;
  product_name: string | null;
  amount: number;
  created_at: string;
}

interface AdminUser {
  public_key: string;
  name: string;
  role: string;
  kyc_status: string;
  chain_verified: boolean;
  suspended_at: string | null;
  created_at: string;
}

interface Stats {
  users: { role: string; total: string }[];
  orders: { status: string; total: string }[];
  disputes: { status: string; total: string }[];
  gmvStroops: string;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<'overview' | 'disputes' | 'users'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [farmerBps, setFarmerBps] = useState<Record<string, number>>({});
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'disputes') {
      api.get('/admin/disputes').then((r) => setDisputes(r.data.disputes)).catch(() => {});
    }
    if (tab === 'users') {
      api.get('/admin/users', { params: search ? { search } : {} })
        .then((r) => setUsers(r.data.users)).catch(() => {});
    }
  }, [tab, search]);

  const resolveDispute = async (orderId: string) => {
    const bps = farmerBps[orderId] ?? 0;
    const res = resolution[orderId] ?? '';
    setResolvingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/resolve`, { farmerBps: bps, resolution: res });
      setDisputes((prev) => prev.filter((d) => d.order_id !== orderId));
      setToast('Dispute resolved.');
    } catch {
      setToast('Failed to resolve dispute.');
    } finally {
      setResolvingId(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const suspendUser = async (pk: string, suspend: boolean, reason?: string) => {
    try {
      await api.patch(`/admin/users/${pk}/suspend`, { suspend, reason });
      setUsers((prev) => prev.map((u) => u.public_key === pk ? { ...u, suspended_at: suspend ? new Date().toISOString() : null } : u));
      setToast(suspend ? 'User suspended.' : 'User unsuspended.');
    } catch {
      setToast('Failed to update user.');
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const verifyUser = async (pk: string) => {
    try {
      await api.patch(`/admin/users/${pk}/verify`);
      setUsers((prev) => prev.map((u) => u.public_key === pk ? { ...u, chain_verified: true, kyc_status: 'verified' } : u));
      setToast('User verified.');
    } catch {
      setToast('Failed to verify user.');
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const totalUsers = stats?.users.reduce((s, r) => s + parseInt(r.total, 10), 0) ?? 0;
  const totalOrders = stats?.orders.reduce((s, r) => s + parseInt(r.total, 10), 0) ?? 0;
  const openDisputes = stats?.disputes.find((d) => d.status === 'open');

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-green-800 mb-2">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-8">
        {(['overview', 'disputes', 'users'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'border-b-2 border-green-700 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
            {t === 'disputes' && openDisputes && parseInt(openDisputes.total, 10) > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {openDisputes.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow p-5 text-center">
              <p className="text-3xl font-bold text-green-700">{totalUsers}</p>
              <p className="text-gray-500 text-sm mt-1">Total Users</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-5 text-center">
              <p className="text-3xl font-bold text-blue-700">{totalOrders}</p>
              <p className="text-gray-500 text-sm mt-1">Total Orders</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-5 text-center">
              <p className="text-3xl font-bold text-red-600">{openDisputes?.total ?? 0}</p>
              <p className="text-gray-500 text-sm mt-1">Open Disputes</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-5 text-center">
              <p className="text-3xl font-bold text-green-700">{stroopsToXlm(Number(stats.gmvStroops)).toFixed(0)}</p>
              <p className="text-gray-500 text-sm mt-1">GMV (XLM)</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow p-5">
              <p className="font-semibold text-gray-700 mb-3">Users by Role</p>
              {stats.users.map((r) => (
                <div key={r.role} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600">{r.role}</span>
                  <span className="font-semibold">{r.total}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow p-5">
              <p className="font-semibold text-gray-700 mb-3">Orders by Status</p>
              {stats.orders.map((r) => (
                <div key={r.status} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                  <span className="capitalize text-gray-600">{r.status}</span>
                  <span className="font-semibold">{r.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Disputes */}
      {tab === 'disputes' && (
        <div className="space-y-4">
          {disputes.length === 0 && <p className="text-gray-400 text-center py-12">No open disputes.</p>}
          {disputes.map((d) => (
            <div key={d.id} className="bg-white rounded-xl shadow p-5 space-y-3">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-gray-800">{d.product_name ?? 'Unknown product'}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">Order {d.order_id.slice(0, 8)}…</p>
                </div>
                <StatusBadge status={d.status} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p className="text-gray-400 text-xs">Buyer</p><p className="font-mono text-xs">{shortAddress(d.buyer_pk)}</p><p className="text-gray-600">{d.buyer_name}</p></div>
                <div><p className="text-gray-400 text-xs">Farmer</p><p className="font-mono text-xs">{shortAddress(d.farmer_pk)}</p><p className="text-gray-600">{d.farmer_name}</p></div>
                <div><p className="text-gray-400 text-xs">Amount</p><p className="font-semibold">{stroopsToXlm(Number(d.amount)).toFixed(2)} XLM</p></div>
                <div><p className="text-gray-400 text-xs">Raised</p><p>{new Date(d.created_at).toLocaleDateString()}</p></div>
              </div>
              {d.reason && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">"{d.reason}"</p>}
              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium text-gray-700">Resolve: farmer gets what % of funds?</p>
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="number" min={0} max={100}
                    placeholder="% to farmer (0–100)"
                    value={farmerBps[d.order_id] !== undefined ? farmerBps[d.order_id] / 100 : ''}
                    onChange={(e) => setFarmerBps((p) => ({ ...p, [d.order_id]: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-44"
                  />
                  <input
                    type="text"
                    placeholder="Resolution note…"
                    value={resolution[d.order_id] ?? ''}
                    onChange={(e) => setResolution((p) => ({ ...p, [d.order_id]: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => resolveDispute(d.order_id)}
                    disabled={resolvingId === d.order_id}
                    className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                  >
                    {resolvingId === d.order_id ? 'Resolving…' : 'Resolve'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div>
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or public key…"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-6"
          />
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.public_key} className="bg-white rounded-xl shadow p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium text-gray-800">{u.name} <span className="text-xs text-gray-400">({u.role})</span></p>
                  <p className="font-mono text-xs text-gray-400">{shortAddress(u.public_key)}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {u.chain_verified && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Verified</span>}
                    {u.suspended_at && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Suspended</span>}
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{u.kyc_status}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {!u.chain_verified && (
                    <button onClick={() => verifyUser(u.public_key)} className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      Verify
                    </button>
                  )}
                  {u.suspended_at ? (
                    <button onClick={() => suspendUser(u.public_key, false)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                      Unsuspend
                    </button>
                  ) : (
                    <button onClick={() => suspendUser(u.public_key, true, 'Admin action')} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                      Suspend
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white px-4 py-2.5 rounded-xl text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
