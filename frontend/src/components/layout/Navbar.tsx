import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../../hooks/useWallet';
import { useDropdown } from '../../hooks/useDropdown';
import { shortAddress } from '../../lib/stellar';
import WalletDropdown from '../wallet/WalletDropdown';
import WalletAvatar from '../wallet/WalletAvatar';
import SettingsModal from '../settings/SettingsModal';

export default function Navbar() {
  const { publicKey, role, connected, disconnect } = useWallet();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { open, setOpen, ref } = useDropdown();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
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
