import { useEffect, useRef } from 'react';

interface Props {
  status: 'pending' | 'success' | 'error';
  message?: string;
  duration?: number; // ms — 0 means no auto-close
  onClose: () => void;
}

const COLOURS = {
  pending: { bg: 'bg-blue-600',  bar: 'bg-blue-400' },
  success: { bg: 'bg-green-600', bar: 'bg-green-400' },
  error:   { bg: 'bg-red-600',   bar: 'bg-red-400'   },
};

const ICONS = { success: '✅', error: '❌' };

const DEFAULT_DURATION = 4500;

export default function TxStatusToast({ status, message, duration, onClose }: Props) {
  const ms = duration ?? (status === 'pending' ? 0 : DEFAULT_DURATION);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ms) return;
    timerRef.current = setTimeout(onClose, ms);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [ms, onClose]);

  const { bg, bar } = COLOURS[status];

  return (
    <div className={`fixed bottom-6 right-6 z-50 rounded-xl shadow-lg text-white overflow-hidden min-w-64 max-w-sm ${bg}`}>
      <div className="flex items-center gap-3 px-5 py-3">
        {status === 'pending' ? (
          <svg
            className="animate-spin h-5 w-5 shrink-0 text-white"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <span className="text-lg shrink-0">{ICONS[status]}</span>
        )}
        <span className="text-sm font-medium flex-1">
          {message ?? (
            status === 'pending' ? 'Transaction pending…'
            : status === 'success' ? 'Transaction confirmed'
            : 'Transaction failed'
          )}
        </span>
        <button
          onClick={onClose}
          className="ml-2 text-white/70 hover:text-white text-xs shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Timer bar — only shown when auto-close is active */}
      {ms > 0 && (
        <div className="h-0.5 w-full bg-white/20">
          <div
            className={`h-full ${bar} origin-left`}
            style={{
              animation: `shrink ${ms}ms linear forwards`,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}
