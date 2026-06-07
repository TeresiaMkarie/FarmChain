import { useEffect, useState } from 'react';
import Toggle from '../../shared/Toggle';
import { getMyNotifications, updateMyNotifications } from '../../../lib/api';
import { parseError } from '../../../lib/errors';

type Channel = 'inapp' | 'email' | 'sms';
type EventKey = 'txn' | 'wallet' | 'marketplace' | 'payment' | 'dispute' | 'promo';

interface NotifPrefs {
  [event: string]: Record<Channel, boolean>;
}

const EVENTS: { key: EventKey; label: string; description: string }[] = [
  { key: 'txn',         label: 'Transaction Alerts',    description: 'Order created, escrow funded' },
  { key: 'wallet',      label: 'Wallet Activity',        description: 'Incoming XLM, balance changes' },
  { key: 'marketplace', label: 'Marketplace Updates',    description: 'New products, price changes' },
  { key: 'payment',     label: 'Payment Confirmations',  description: 'Payment received or released' },
  { key: 'dispute',     label: 'Dispute Notifications',  description: 'Dispute opened or resolved' },
  { key: 'promo',       label: 'Promotions & News',      description: 'FarmChain updates and offers' },
];

const DEFAULT_PREFS: NotifPrefs = {
  txn:         { inapp: true,  email: true,  sms: false },
  wallet:      { inapp: true,  email: false, sms: false },
  marketplace: { inapp: true,  email: true,  sms: false },
  payment:     { inapp: true,  email: true,  sms: true  },
  dispute:     { inapp: true,  email: true,  sms: true  },
  promo:       { inapp: false, email: false, sms: false },
};

function dbToPrefs(row: Record<string, boolean>): NotifPrefs {
  const p: NotifPrefs = {};
  for (const ev of EVENTS) {
    p[ev.key] = {
      inapp: row[`${ev.key}_inapp`] ?? DEFAULT_PREFS[ev.key].inapp,
      email: row[`${ev.key}_email`] ?? DEFAULT_PREFS[ev.key].email,
      sms:   row[`${ev.key}_sms`]   ?? DEFAULT_PREFS[ev.key].sms,
    };
  }
  return p;
}

function prefsToDb(p: NotifPrefs): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const ev of EVENTS) {
    out[`${ev.key}_inapp`] = p[ev.key].inapp;
    out[`${ev.key}_email`] = p[ev.key].email;
    out[`${ev.key}_sms`]   = p[ev.key].sms;
  }
  return out;
}

export default function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyNotifications()
      .then((res) => setPrefs(dbToPrefs(res.data.notifications)))
      .catch(() => { /* fall back to defaults */ })
      .finally(() => setLoading(false));
  }, []);

  function toggle(event: EventKey, channel: Channel) {
    setPrefs((p) => ({
      ...p,
      [event]: { ...p[event], [channel]: !p[event][channel] },
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await updateMyNotifications(prefsToDb(prefs));
      setPrefs(dbToPrefs(res.data.notifications));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
        Loading preferences…
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-green-800">Notification Preferences</h2>
        <p className="text-sm text-gray-500 mt-1">Choose how and where you want to be notified.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-green-50 text-xs text-green-800 uppercase tracking-wider border-b border-green-100">
              <th className="text-left px-4 py-3 font-medium">Event</th>
              <th className="text-center px-4 py-3 font-medium">In-app</th>
              <th className="text-center px-4 py-3 font-medium">Email</th>
              <th className="text-center px-4 py-3 font-medium">SMS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {EVENTS.map(({ key, label, description }) => (
              <tr key={key}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                </td>
                {(['inapp', 'email', 'sms'] as Channel[]).map((ch) => (
                  <td key={ch} className="text-center px-4 py-3">
                    <div className="flex justify-center">
                      <Toggle
                        checked={prefs[key][ch]}
                        onChange={() => toggle(key, ch)}
                        disabled={ch === 'sms'}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">SMS notifications require phone verification (coming soon).</p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving}
          className="px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white text-sm
            font-semibold rounded-xl transition disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
        {saved && <span className="text-sm text-green-700 font-medium">✓ Saved</span>}
      </div>
    </form>
  );
}
