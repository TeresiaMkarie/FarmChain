import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import type { UserRole } from '../types';

export default function AuthPage() {
  const { connect, connecting, error } = useWallet();
  const navigate = useNavigate();
  const [isNew, setIsNew] = useState(false);
  const [role, setRole] = useState<UserRole>('Farmer');
  const [name, setName] = useState('');

  const handleConnect = async () => {
    const pk = await connect(isNew ? role : undefined, isNew ? name : undefined);
    if (!pk) return;

    const storedRole = role;
    if (storedRole === 'Farmer') navigate('/farmer/dashboard');
    else navigate('/buyer/dashboard');
  };

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-green-800 mb-2">Connect to FarmChain</h1>
        <p className="text-gray-500 text-sm mb-6">
          Use Freighter wallet to sign in. Install it at{' '}
          <a href="https://freighter.app" target="_blank" rel="noreferrer" className="text-green-700 underline">
            freighter.app
          </a>
        </p>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setIsNew(false)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${!isNew ? 'bg-green-700 text-white border-green-700' : 'border-gray-300 text-gray-600'}`}
          >
            Returning User
          </button>
          <button
            onClick={() => setIsNew(true)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${isNew ? 'bg-green-700 text-white border-green-700' : 'border-gray-300 text-gray-600'}`}
          >
            New User
          </button>
        </div>

        {isNew && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">I am a…</label>
              <div className="flex gap-3">
                {(['Farmer', 'Buyer'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${role === r ? 'bg-green-700 text-white border-green-700' : 'border-gray-300 text-gray-600'}`}
                  >
                    {r === 'Farmer' ? '🌾 Farmer' : '🛒 Buyer'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          onClick={handleConnect}
          disabled={connecting || (isNew && !name)}
          className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition"
        >
          {connecting ? 'Connecting…' : 'Connect Freighter Wallet'}
        </button>
      </div>
    </div>
  );
}
