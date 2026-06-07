import { useState } from 'react';
import Toggle from '../../shared/Toggle';

export default function PrivacyTab() {
  const [profileVisible, setProfileVisible] = useState(true);
  const [showWallet, setShowWallet]         = useState(true);
  const [marketing, setMarketing]           = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState('');
  const [deleteStep, setDeleteStep]         = useState<'idle' | 'confirm' | 'requested'>('idle');

  async function handleExport() {
    alert('Data export requested. You will receive a download link via email.');
  }

  async function handleDeleteRequest() {
    if (deleteConfirm !== 'DELETE') return;
    setDeleteStep('requested');
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold text-green-800">Privacy & Data</h2>
        <p className="text-sm text-gray-500 mt-1">Control your data and how others see your profile.</p>
      </div>

      {/* Visibility */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold text-green-800 uppercase tracking-wider">Profile Visibility</h3>
        <div className="bg-green-50 rounded-xl divide-y divide-green-100 border border-green-100 overflow-hidden">
          {[
            {
              label: 'Show profile on marketplace',
              desc:  'Buyers can see your name and general location on product listings.',
              value: profileVisible,
              set:   setProfileVisible,
            },
            {
              label: 'Show wallet address publicly',
              desc:  'Visible on your public marketplace profile page.',
              value: showWallet,
              set:   setShowWallet,
            },
            {
              label: 'Allow marketing communications',
              desc:  'Receive product news and promotions from FarmChain.',
              value: marketing,
              set:   setMarketing,
            },
          ].map(({ label, desc, value, set }) => (
            <div key={label} className="flex items-start justify-between gap-4 px-4 py-3.5 bg-white">
              <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              <Toggle checked={value} onChange={set} />
            </div>
          ))}
        </div>
      </section>

      {/* Data export */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-green-800 uppercase tracking-wider">Your Data</h3>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-green-900">Download your data</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Orders, products, and profile — delivered as a file to your email.
            </p>
          </div>
          <button
            onClick={handleExport}
            className="shrink-0 px-3.5 py-1.5 text-xs font-semibold border border-green-700 text-green-700 hover:bg-green-100 rounded-xl transition"
          >
            Export data
          </button>
        </div>
      </section>

      {/* Account deletion */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-green-800 uppercase tracking-wider">Delete Account</h3>
        <p className="text-sm text-gray-600">
          Permanently delete your FarmChain account and all associated data. Active orders must be
          resolved before deletion can proceed.
        </p>

        {deleteStep === 'idle' && (
          <button
            onClick={() => setDeleteStep('confirm')}
            className="px-3.5 py-1.5 text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl transition"
          >
            Request account deletion
          </button>
        )}

        {deleteStep === 'confirm' && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-green-900">Are you sure?</p>
            <p className="text-xs text-gray-500">
              Type <strong className="font-mono text-green-900">DELETE</strong> to confirm. This cannot be undone.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-green-700 bg-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteStep('idle'); setDeleteConfirm(''); }}
                className="flex-1 px-3.5 py-2 text-sm font-semibold border border-green-700 text-green-700 hover:bg-green-50 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRequest}
                disabled={deleteConfirm !== 'DELETE'}
                className="flex-1 px-3.5 py-2 text-sm font-semibold text-white bg-green-900 hover:bg-green-950 rounded-xl transition disabled:opacity-40"
              >
                Confirm deletion
              </button>
            </div>
          </div>
        )}

        {deleteStep === 'requested' && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-800 font-medium">
              ✓ Deletion request submitted. Our team will process it within 30 days.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
