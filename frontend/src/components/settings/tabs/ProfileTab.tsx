import { useState, useRef } from 'react';
import FormField from '../../shared/FormField';
import WalletAvatar from '../../wallet/WalletAvatar';
import { updateMe, uploadAvatar } from '../../../lib/api';
import { parseError } from '../../../lib/errors';
import type { UserProfile } from '../../../types';

interface Props {
  publicKey: string;
  user: UserProfile | null;
  onUserUpdate: (u: UserProfile) => void;
}

export default function ProfileTab({ publicKey, user, onUserUpdate }: Props) {
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await updateMe({ name, phone, email });
      onUserUpdate(res.data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload to IPFS via backend
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const res = await uploadAvatar(file);
      setAvatarPreview(res.data.avatarUrl);
      onUserUpdate(res.data.user);
    } catch (err) {
      setAvatarError(parseError(err));
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-green-800">Profile Information</h2>
        <p className="text-sm text-gray-500 mt-1">Update how you appear across the marketplace.</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {avatarPreview ? (
            <img src={avatarPreview} alt="avatar"
              className="w-16 h-16 rounded-full object-cover ring-2 ring-green-700" />
          ) : (
            <WalletAvatar publicKey={publicKey} size={64} />
          )}
          {avatarUploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={avatarUploading}
            className="px-3.5 py-1.5 text-xs font-semibold border border-green-700 text-green-700
              hover:bg-green-50 rounded-xl transition disabled:opacity-50"
          >
            {avatarUploading ? 'Uploading…' : 'Upload photo'}
          </button>
          <p className="text-xs text-gray-400 mt-0.5">JPG, PNG or WebP · max 2 MB</p>
          {avatarError && <p className="text-xs text-red-600 mt-0.5">{avatarError}</p>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden" onChange={handleAvatarChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Full Name" placeholder="Hillary Ombi"
          value={name} onChange={(e) => setName(e.target.value)} required />
        <FormField label="Phone Number" placeholder="+254712345678" type="tel"
          value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="sm:col-span-2">
          <FormField label="Email Address" placeholder="you@example.com" type="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            hint="Optional — used for notifications." />
        </div>
      </div>

      {/* Read-only wallet address */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Wallet Address</label>
        <div className="px-3 py-2 rounded-xl border border-green-100 bg-green-50
          text-xs font-mono text-green-800 break-all select-all">
          {publicKey}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving}
          className="px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white text-sm
            font-semibold rounded-xl transition disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-green-700 font-medium">✓ Saved</span>}
      </div>
    </form>
  );
}
