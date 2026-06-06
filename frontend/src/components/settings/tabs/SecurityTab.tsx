import { useEffect, useState } from 'react';
import { getMySessions, revokeSession, revokeAllOtherSessions } from '../../../lib/api';
import { shortAddress } from '../../../lib/stellar';
import { parseError } from '../../../lib/errors';

interface Session {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
  current: boolean;
}

export interface SecurityTabProps {
  publicKey: string;
}

function friendlyAgent(ua: string | null) {
  if (!ua) return 'Unknown device';
  if (/chrome/i.test(ua) && !/edg|opr/i.test(ua)) return ua.match(/\(([^)]+)\)/)?.[1]?.split(';')[0] + ' · Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  if (/edg/i.test(ua)) return 'Edge';
  return ua.slice(0, 40);
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SecurityTab({ publicKey }: SecurityTabProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMySessions()
      .then((res)  => { if (!cancelled) setSessions(res.data.sessions); })
      .catch((err) => { if (!cancelled) setError(parseError(err)); })
      .finally(()  => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      await revokeSession(id);
      setSessions((s) => s.filter((sess) => sess.id !== id));
    } catch (err) {
      setError(parseError(err));
    } finally {
      setRevoking(null);
    }
  }

  async function handleRevokeAll() {
    setRevoking('all');
    try {
      await revokeAllOtherSessions();
      setSessions((s) => s.filter((sess) => sess.current));
    } catch (err) {
      setError(parseError(err));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Security</h2>
        <p className="text-sm text-gray-500 mt-1">Manage active sessions and wallet recovery.</p>
      </div>

      {/* Active sessions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Active Sessions</h3>
          {sessions.length > 1 && (
            <button
              onClick={handleRevokeAll}
              disabled={revoking === 'all'}
              className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors disabled:opacity-50"
            >
              {revoking === 'all' ? 'Revoking…' : 'Revoke all others'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
            Loading sessions…
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No active sessions found.</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-white">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {friendlyAgent(s.user_agent)}
                    </p>
                    {s.current && (
                      <span className="shrink-0 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
                        current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.ip_address ?? 'Unknown IP'} · {relativeTime(s.last_seen_at)}
                  </p>
                </div>
                {!s.current && (
                  <button
                    onClick={() => handleRevoke(s.id)}
                    disabled={revoking === s.id}
                    className="ml-3 shrink-0 text-xs text-red-600 hover:text-red-800
                      font-medium transition-colors disabled:opacity-50"
                  >
                    {revoking === s.id ? '…' : 'Revoke'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </section>

      {/* Wallet recovery */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Wallet Recovery</h3>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900">Your wallet is secured by Freighter</p>
          <p className="text-sm text-amber-800">
            FarmChain never stores your private key. To back it up:
          </p>
          <ol className="list-decimal list-inside text-sm text-amber-800 space-y-1 pl-1">
            <li>Open the Freighter browser extension.</li>
            <li>Go to <strong>Settings → Security → Show Secret Key</strong>.</li>
            <li>Write your 12/24-word seed phrase and store it offline, never digitally.</li>
          </ol>
          <p className="text-xs text-amber-700 mt-1 font-mono">
            Connected: {shortAddress(publicKey)}
          </p>
        </div>
      </section>

      {/* 2FA */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Two-Factor Authentication</h3>
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <p className="text-sm text-green-800">
            Your Freighter wallet is your second factor. Every action requires signing with your
            secret key inside the extension — no TOTP app is needed.
          </p>
        </div>
      </section>
    </div>
  );
}
