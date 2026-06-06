import { useState } from 'react';
import FormField from '../../shared/FormField';
import { updateMe } from '../../../lib/api';
import { parseError } from '../../../lib/errors';
import type { UserProfile } from '../../../types';

const COUNTRIES = [
  'Kenya', 'Uganda', 'Tanzania', 'Ethiopia', 'Rwanda',
  'Nigeria', 'Ghana', 'South Africa', 'Other',
];

interface Props {
  user: UserProfile | null;
  onUserUpdate: (u: UserProfile) => void;
}

export default function LocationTab({ user, onUserUpdate }: Props) {
  const [country, setCountry]       = useState(user?.country ?? 'Kenya');
  const [county, setCounty]         = useState(user?.county ?? '');
  const [city, setCity]             = useState(user?.city ?? '');
  const [addressLine, setAddressLine] = useState(user?.address_line ?? user?.location ?? '');
  const [latitude, setLatitude]     = useState(user?.latitude  ? String(user.latitude)  : '');
  const [longitude, setLongitude]   = useState(user?.longitude ? String(user.longitude) : '');
  const [locating, setLocating]     = useState(false);
  const [gpsError, setGpsError]     = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState<string | null>(null);

  function handleGPS() {
    setLocating(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'FarmChain/1.0' } },
          );
          const data = await res.json();
          const addr = data.address ?? {};
          if (addr.country)                                 setCountry(addr.country);
          if (addr.state ?? addr.county)                   setCounty(addr.state ?? addr.county);
          if (addr.city ?? addr.town ?? addr.village)      setCity(addr.city ?? addr.town ?? addr.village);
          if (data.display_name)                           setAddressLine(data.display_name);
        } catch { /* keep coords even if geocode fails */ }
        setLocating(false);
      },
      (err) => { setGpsError(err.message); setLocating(false); },
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await updateMe({
        country, county, city,
        address_line: addressLine,
        latitude:  latitude  ? parseFloat(latitude)  : null,
        longitude: longitude ? parseFloat(longitude) : null,
        location: addressLine,  // keep legacy field in sync
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
        <h2 className="text-base font-semibold text-gray-900">Location</h2>
        <p className="text-sm text-gray-500 mt-1">Used for deliveries, logistics, and marketplace listings.</p>
      </div>

      <button
        type="button"
        onClick={handleGPS}
        disabled={locating}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-green-200
          bg-green-50 text-green-800 text-sm font-medium hover:bg-green-100
          transition-colors disabled:opacity-50"
      >
        <span>📍</span>
        {locating ? 'Detecting location…' : 'Use My GPS Location'}
      </button>

      {gpsError && <p className="text-xs text-red-600">{gpsError}</p>}

      {latitude && longitude && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          <span className="font-medium">Coordinates:</span>{' '}
          {latitude}, {longitude}{' — '}
          <a
            href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`}
            target="_blank" rel="noopener noreferrer"
            className="underline hover:text-green-900"
          >
            View on map ↗
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Country</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-800
              focus:outline-none focus:ring-2 focus:ring-green-600 bg-white"
          >
            {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <FormField label="County / State" placeholder="Nairobi"
          value={county} onChange={(e) => setCounty(e.target.value)} />
        <FormField label="City / Town" placeholder="Nairobi"
          value={city} onChange={(e) => setCity(e.target.value)} />
        <div className="sm:col-span-2">
          <FormField label="Precise / Delivery Address" placeholder="123 Kimathi Street, CBD"
            value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving}
          className="px-5 py-2 bg-green-700 hover:bg-green-800 text-white text-sm
            font-semibold rounded-xl transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Location'}
        </button>
        {saved && <span className="text-sm text-green-700 font-medium">✓ Saved</span>}
      </div>
    </form>
  );
}
