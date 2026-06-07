import { useState } from 'react';
import Toggle from '../../shared/Toggle';

export default function PrivacyTab() {
  const [profileVisible, setProfileVisible] = useState(true);
  const [showWallet, setShowWallet]         = useState(true);
  const [marketing, setMarketing]           = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState('');
  const [deleteStep, setDeleteStep]         = useState<'idle' | 'confirm' | 'requested'>('idle');

  async function handleExport() {
    // TODO: POST /users/me/export when endpoint is wired
    alert('Data export requested. You will receive a download link via email.');
  }

  async function handleDeleteRequest() {
    if (deleteConfirm !== 'DELETE') return;
    // TODO: POST /users/me/delete
    setDeleteStep('requested');
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Privacy & Data</h2>
        <p className="text-sm text-gray-500 mt-1">Control your data and how others see your profile.</p>
      </div>

      {/* Visibility */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Profile Visibility</h3>
        <div className="space-y-4">
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
            <div key={label} className="flex items-start justify-between gap-4">
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
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Data</h3>
        <p className="text-sm text-gray-600">
          Download a copy of all data associated with your account — orders, products, and profile.
        </p>
        <button
          onClick={handleExport}
          className="px-4 py-2 text-sm font-medium text-green-700 border border-green-200
            rounded-xl hover:bg-green-50 transition-colors"
        >
          Request Data Export
        </button>
      </section>

      {/* Account deletion */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider">Delete Account</h3>
        <p className="text-sm text-gray-600">
          Permanently delete your FarmChain account and all associated data. Active orders must be
          resolved before deletion can proceed.
        </p>

        {deleteStep === 'idle' && (
          <button
            onClick={() => setDeleteStep('confirm')}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200
              rounded-xl hover:bg-red-50 transition-colors"
          >
            Request Account Deletion
          </button>
        )}

        {deleteStep === 'confirm' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
            <p className="text-sm font-medium text-red-700">
              Type <strong>DELETE</strong> to confirm your deletion request.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 rounded-lg border border-red-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteRequest}
                disabled={deleteConfirm !== 'DELETE'}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl
                  hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                Confirm Deletion Request
              </button>
              <button
                onClick={() => { setDeleteStep('idle'); setDeleteConfirm(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
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
