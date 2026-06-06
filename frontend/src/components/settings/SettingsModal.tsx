import { useEffect, useState } from 'react';
import { getMe } from '../../lib/api';
import type { UserProfile } from '../../types';
import ProfileTab from './tabs/ProfileTab';
import LocationTab from './tabs/LocationTab';
import SecurityTab from './tabs/SecurityTab';
import NotificationsTab from './tabs/NotificationsTab';
import PrivacyTab from './tabs/PrivacyTab';
import MarketplaceTab from './tabs/MarketplaceTab';

type Tab = 'profile' | 'location' | 'security' | 'notifications' | 'privacy' | 'marketplace';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'profile',       icon: '👤', label: 'Profile' },
  { key: 'location',      icon: '📍', label: 'Location' },
  { key: 'security',      icon: '🔒', label: 'Security' },
  { key: 'notifications', icon: '🔔', label: 'Notifications' },
  { key: 'privacy',       icon: '🛡',  label: 'Privacy' },
  { key: 'marketplace',   icon: '🛒', label: 'Marketplace' },
];

interface Props {
  publicKey: string;
  role?: string;
  onClose: () => void;
}

export default function SettingsModal({ publicKey, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((res) => setUser(res.data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-3xl bg-white sm:rounded-2xl shadow-2xl
          flex flex-col overflow-hidden h-[95dvh] sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0 bg-white">
          <h1 className="text-base font-semibold text-gray-900">Settings</h1>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400
              hover:text-gray-700 hover:bg-gray-100 transition-colors text-sm"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Desktop sidebar */}
          <aside className="hidden sm:flex flex-col w-44 shrink-0 border-r border-gray-100 py-2 bg-gray-50/60">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors
                  ${activeTab === tab.key
                    ? 'bg-green-700 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </aside>

          {/* Mobile tab bar */}
          <div className="sm:hidden w-full border-b border-gray-100 overflow-x-auto shrink-0 absolute top-[57px] left-0 bg-white z-10 flex">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium shrink-0
                  border-b-2 transition-colors
                  ${activeTab === tab.key
                    ? 'border-green-700 text-green-700'
                    : 'border-transparent text-gray-500'
                  }`}
              >
                <span className="text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-5 sm:p-6 mt-[57px] sm:mt-0">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-6 h-6 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {activeTab === 'profile'       && <ProfileTab user={user} publicKey={publicKey} onUserUpdate={setUser} />}
                {activeTab === 'location'      && <LocationTab user={user} onUserUpdate={setUser} />}
                {activeTab === 'security'      && <SecurityTab publicKey={publicKey} />}
                {activeTab === 'notifications' && <NotificationsTab />}
                {activeTab === 'privacy'       && <PrivacyTab />}
                {activeTab === 'marketplace'   && <MarketplaceTab user={user} onUserUpdate={setUser} />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
