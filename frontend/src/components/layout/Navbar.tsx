import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../../hooks/useWallet';
import { useDropdown } from '../../hooks/useDropdown';
import { shortAddress } from '../../lib/stellar';
import WalletDropdown from '../wallet/WalletDropdown';
import WalletAvatar from '../wallet/WalletAvatar';
import SettingsModal from '../settings/SettingsModal';
import api from '../../lib/api';
import { useCartStore } from '../../store/cartStore';

export default function Navbar() {
  const { publicKey, role, connected, disconnect } = useWallet();
  const cartCount = useCartStore((s) => s.count());
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { open, setOpen, ref } = useDropdown();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; type: string; payload: Record<string, string>; read: boolean; created_at: string }[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!connected) return;
    const fetchCount = () =>
      api.get('/notifications/unread-count').then((r) => setUnreadCount(r.data.count)).catch(() => {});
    fetchCount();
    const t = setInterval(fetchCount, 30_000);
    return () => clearInterval(t);
  }, [connected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openNotifications = () => {
    if (!notifOpen) {
      api.get('/notifications').then((r) => setNotifications(r.data.notifications)).catch(() => {});
      api.patch('/notifications/read-all').then(() => setUnreadCount(0)).catch(() => {});
    }
    setNotifOpen((o) => !o);
  };

  const NOTIF_LABELS: Record<string, string> = {
    order_funded: 'New order placed',
    order_shipped: 'Your order has shipped',
    order_completed: 'Order completed — payment released',
    dispute_raised: 'A dispute has been raised',
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleDisconnect() {
    disconnect();
    navigate('/');
  }

  return (
    <>
      <nav
        className={`sticky top-0 z-40 w-full transition-all duration-300
          ${scrolled
            ? 'bg-green-950/90 backdrop-blur-md border-b border-white/5 shadow-xl'
            : 'bg-green-950/60 backdrop-blur-sm'
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-8">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center text-sm">
              🌾
            </div>
            <span className="text-white font-bold text-base tracking-wide">FarmChain</span>
          </Link>

          {/* Centre nav links */}
          <div className="hidden md:flex items-center gap-6 text-sm text-green-200/80">
            <Link to="/marketplace" className="hover:text-white transition-colors">
              Marketplace
            </Link>

            {connected && role === 'Farmer' && (
              <>
                <Link to="/farmer/dashboard" className="hover:text-white transition-colors">
                  Dashboard
                </Link>
                <Link to="/farmer/list-product" className="hover:text-white transition-colors">
                  List Product
                </Link>
              </>
            )}

            {connected && role === 'Buyer' && (
              <Link to="/buyer/dashboard" className="hover:text-white transition-colors">
                Dashboard
              </Link>
            )}

            {connected && role === 'Admin' && (
              <Link to="/admin" className="hover:text-white transition-colors">
                Admin
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Cart icon — only for buyers */}
            {connected && role === 'Buyer' && (
              <Link
                to="/cart"
                className="relative p-1.5 rounded-full hover:bg-white/10 transition-colors text-green-200"
                aria-label="Cart"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
            )}

            {/* Notification bell */}
            {connected && (
              <div ref={notifRef} className="relative">
                <button
                  onClick={openNotifications}
                  className="relative p-1.5 rounded-full hover:bg-white/10 transition-colors text-green-200"
                  aria-label="Notifications"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                      <p className="font-semibold text-gray-800 text-sm">Notifications</p>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                      {notifications.length === 0 && (
                        <p className="text-gray-400 text-sm text-center py-8">No notifications yet.</p>
                      )}
                      {notifications.map((n) => (
                        <div key={n.id} className={`px-4 py-3 text-sm ${n.read ? 'text-gray-500' : 'text-gray-800 bg-green-50/50'}`}>
                          <p className="font-medium">{NOTIF_LABELS[n.type] ?? n.type}</p>
                          {n.payload?.orderId && (
                            <Link to={`/orders/${n.payload.orderId}`} onClick={() => setNotifOpen(false)} className="text-xs text-green-700 hover:underline">
                              View order →
                            </Link>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {connected && publicKey ? (
              <div ref={ref} className="relative">
                {/* Wallet chip — dropdown trigger */}
                <button
                  onClick={() => setOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-full
                    px-3 py-1.5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <WalletAvatar publicKey={publicKey} size={22} />
                  <span className="hidden sm:block text-green-100 font-mono text-xs tracking-wide">
                    {shortAddress(publicKey)}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                </button>

                {/* Dropdown */}
                {open && (
                  <WalletDropdown
                    publicKey={publicKey}
                    role={role ?? 'User'}
                    onDisconnect={handleDisconnect}
                    onClose={() => setOpen(false)}
                    onOpenSettings={() => setSettingsOpen(true)}
                  />
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                className="bg-green-500 hover:bg-green-400 text-white text-sm font-semibold
                  px-5 py-1.5 rounded-full transition-colors shadow-lg shadow-green-900/40"
              >
                Connect Wallet
              </Link>
            )}
          </div>

        </div>
      </nav>

      {/* Settings modal — rendered outside nav so it overlays everything */}
      {settingsOpen && publicKey && (
        <SettingsModal
          publicKey={publicKey}
          role={role ?? 'User'}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
