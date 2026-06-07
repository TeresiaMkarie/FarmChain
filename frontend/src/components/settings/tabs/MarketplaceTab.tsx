import { useState } from 'react';
import { updateMe } from '../../../lib/api';
import { parseError } from '../../../lib/errors';
import type { UserProfile } from '../../../types';

interface Props {
  user: UserProfile | null;
  onUserUpdate: (u: UserProfile) => void;
}

export default function MarketplaceTab({ user, onUserUpdate }: Props) {
  const [payoutWallet, setPayoutWallet]           = useState(user?.payout_wallet ?? '');
  const [preferredCurrency, setPreferredCurrency] = useState(user?.preferred_currency ?? 'XLM');
  const [preferredLanguage, setPreferredLanguage] = useState(user?.preferred_language ?? 'en');
  const [deliveryRadius, setDeliveryRadius]       = useState('50');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await updateMe({
        payout_wallet: payoutWallet,
        preferred_currency: preferredCurrency,
        preferred_language: preferredLanguage,
      });
      onUserUpdate(res.data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Marketplace Preferences</h2>
        <p className="text-sm text-gray-500 mt-1">Configure your buying and selling defaults.</p>
      </div>

      {/* Payout wallet */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Default Payout Wallet</label>
        <input
          type="text"
          value={payoutWallet}
          onChange={(e) => setPayoutWallet(e.target.value)}
          placeholder="G... (leave blank to use connected wallet)"
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono
            focus:outline-none focus:ring-2 focus:ring-green-600 bg-white"
        />
        <p className="text-xs text-gray-400">
          Earnings are sent to this Stellar address. Defaults to your connected wallet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Preferred Currency</label>
          <select
            value={preferredCurrency}
            onChange={(e) => setPreferredCurrency(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm
              focus:outline-none focus:ring-2 focus:ring-green-600 bg-white text-gray-800"
          >
            <option value="XLM">XLM — Stellar Lumens</option>
            <option value="KES">KES — Kenyan Shilling</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
          </select>
          <p className="text-xs text-gray-400">For price display only. Payments always settle in XLM.</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Language</label>
          <select
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm
              focus:outline-none focus:ring-2 focus:ring-green-600 bg-white text-gray-800"
          >
            <option value="en">English</option>
            <option value="sw">Swahili</option>
            <option value="fr">French</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-gray-700">
            Delivery Search Radius —{' '}
            <span className="text-green-700 font-semibold">{deliveryRadius} km</span>
          </label>
          <input
            type="range" min="10" max="500" step="10"
            value={deliveryRadius}
            onChange={(e) => setDeliveryRadius(e.target.value)}
            className="w-full accent-green-700"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>10 km</span>
            <span>500 km</span>
          </div>
          <p className="text-xs text-gray-400">
            Marketplace prioritises products within this radius of your saved location.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving}
          className="px-5 py-2 bg-green-700 hover:bg-green-800 text-white text-sm
            font-semibold rounded-xl transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
        {saved && <span className="text-sm text-green-700 font-medium">✓ Saved</span>}
      </div>
    </form>
  );
}
