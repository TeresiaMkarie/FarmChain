import { useNavigate } from 'react-router-dom';
import { shortAddress } from '../../lib/stellar';
import { useClipboard } from '../../hooks/useClipboard';
import { useBalance } from '../../hooks/useBalance';
import WalletAvatar from './WalletAvatar';
import CopyToast from '../shared/CopyToast';

interface Props {
  publicKey: string;
  role: string;
  onDisconnect: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
}

export default function WalletDropdown({ publicKey, role, onDisconnect, onClose, onOpenSettings }: Props) {
  const navigate = useNavigate();
  const { copied, copy } = useClipboard();
  const { xlm, loading: balanceLoading, error: balanceError } = useBalance(publicKey);

  function handleDisconnect() {
    onDisconnect();
    onClose();
    navigate('/');
  }

  function handleSettings() {
    onOpenSettings();
    onClose();
  }

  return (
    <>
      <CopyToast visible={copied} />

      {/* Dropdown panel — dark to match the navbar */}
      <div
        className="absolute top-full right-0 mt-2 w-72 z-50
          bg-green-950 rounded-2xl shadow-2xl border border-white/10
          overflow-hidden"
        role="menu"
        aria-label="Wallet account menu"
      >
        {/* Account header */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <WalletAvatar publicKey={publicKey} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white capitalize">{role}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-green-300 font-mono truncate">{shortAddress(publicKey)}</p>
                <button
                  onClick={() => copy(publicKey)}
                  title="Copy full address"
                  role="menuitem"
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-md font-medium transition-colors
                    ${copied
                      ? 'bg-green-700 text-white'
                      : 'bg-white/10 text-green-200 hover:bg-white/20 hover:text-white'
                    }`}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* XLM Balance */}
          <div className="mt-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-sm font-bold">✦</span>
              <span className="text-xs text-green-300 font-medium">XLM Balance</span>
            </div>
            {balanceLoading ? (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border border-green-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-green-400">Loading…</span>
              </div>
            ) : balanceError === 'unfunded' ? (
              <span className="text-xs text-amber-400 font-medium">Unfunded account</span>
            ) : balanceError ? (
              <span className="text-xs text-white/30">Unavailable</span>
            ) : (
              <span className="text-sm font-bold text-white tabular-nums">{xlm} <span className="text-xs font-normal text-green-300">XLM</span></span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="py-1">
          <MenuItem icon="⚙" label="Settings" onClick={handleSettings} />
          <MenuItem icon="↔" label="Switch Account" onClick={onClose} disabled hint="Coming soon" />
          <MenuItem icon="＋" label="Import Account" onClick={onClose} disabled hint="Coming soon" />
        </div>

        {/* Disconnect */}
        <div className="border-t border-white/10 py-1">
          <button
            onClick={handleDisconnect}
            role="menuitem"
            className="w-full flex items-center gap-3 px-4 py-2.5
              text-sm font-medium text-red-400 hover:bg-white/5 hover:text-red-300
              transition-colors text-left"
          >
            <span className="text-base w-5 text-center">⏏</span>
            Disconnect Wallet
          </button>
        </div>
      </div>
    </>
  );
}

interface MenuItemProps {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}

function MenuItem({ icon, label, onClick, disabled, hint }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors
        ${disabled
          ? 'text-white/25 cursor-not-allowed'
          : 'text-green-100 hover:bg-white/5 hover:text-white'
        }`}
    >
      <span className="text-base w-5 text-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-white/25">{hint}</span>}
    </button>
  );
}
