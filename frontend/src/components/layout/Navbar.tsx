import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../../hooks/useWallet';
import { shortAddress } from '../../lib/stellar';

export default function Navbar() {
  const { publicKey, role, connected, disconnect } = useWallet();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  return (
    <nav
      className={`sticky top-0 z-50 w-full transition-all duration-300
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
            <>
              {/* Address pill */}
              <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-100 font-mono text-xs tracking-wide">
                  {shortAddress(publicKey)}
                </span>
              </div>

              {/* Disconnect */}
              <button
                onClick={handleDisconnect}
                className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="bg-green-500 hover:bg-green-400 text-white text-sm font-semibold px-5 py-1.5 rounded-full transition-colors shadow-lg shadow-green-900/40"
            >
              Connect Wallet
            </Link>
          )}
        </div>

      </div>
    </nav>
  );
}
