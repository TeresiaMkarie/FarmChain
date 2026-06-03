import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../../hooks/useWallet';
import { shortAddress } from '../../lib/stellar';

export default function Navbar() {
  const { publicKey, role, connected, disconnect } = useWallet();
  const navigate = useNavigate();

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  return (
    <nav className="bg-green-800 text-white px-6 py-3 flex items-center justify-between shadow-md">
      <Link to="/" className="text-xl font-bold tracking-wide">
        🌾 FarmChain
      </Link>

      <div className="flex items-center gap-4 text-sm">
        <Link to="/marketplace" className="hover:text-green-300">Marketplace</Link>
        {connected && role === 'Farmer' && (
          <>
            <Link to="/farmer/dashboard" className="hover:text-green-300">Dashboard</Link>
            <Link to="/farmer/list-product" className="hover:text-green-300">List Product</Link>
          </>
        )}
        {connected && role === 'Buyer' && (
          <Link to="/buyer/dashboard" className="hover:text-green-300">Dashboard</Link>
        )}

        {connected && publicKey ? (
          <div className="flex items-center gap-2">
            <span className="bg-green-700 px-3 py-1 rounded-full font-mono text-xs">
              {shortAddress(publicKey)}
            </span>
            <button
              onClick={handleDisconnect}
              className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            className="bg-green-600 hover:bg-green-500 px-4 py-1.5 rounded font-semibold"
          >
            Connect Wallet
          </Link>
        )}
      </div>
    </nav>
  );
}
