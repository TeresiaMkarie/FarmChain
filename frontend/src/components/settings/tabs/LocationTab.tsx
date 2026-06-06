import { useState, useEffect, useRef } from 'react';
import FormField from '../../shared/FormField';
import { updateMe } from '../../../lib/api';
import { parseError } from '../../../lib/errors';
import type { UserProfile } from '../../../types';

interface Props {
  user: UserProfile | null;
  onUserUpdate: (u: UserProfile) => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    country?: string;
    state?: string;
    county?: string;
    state_district?: string;
    region?: string;
    city?: string;
    town?: string;
    municipality?: string;
    village?: string;
    suburb?: string;
    house_number?: string;
    road?: string;
    pedestrian?: string;
    footway?: string;
  };
}

export default function LocationTab({ user, onUserUpdate }: Props) {
  const [country, setCountry]         = useState(user?.country ?? '');
  const [county, setCounty]           = useState(user?.county ?? '');
  const [city, setCity]               = useState(user?.city ?? '');
  const [addressLine, setAddressLine] = useState(user?.address_line ?? user?.location ?? '');
  const [latitude, setLatitude]       = useState(user?.latitude  ? String(user.latitude)  : '');
  const [longitude, setLongitude]     = useState(user?.longitude ? String(user.longitude) : '');
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Location search state
  const [query, setQuery]             = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching]     = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef                     = useRef<HTMLDivElement>(null);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Debounced Nominatim forward search — only fires when query is long enough
  useEffect(() => {
    if (query.trim().length < 3) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`,
          { headers: { 'Accept-Language': 'en' } },
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function applyResult(result: NominatimResult) {
    const addr = result.address;
    setLatitude(parseFloat(result.lat).toFixed(6));
    setLongitude(parseFloat(result.lon).toFixed(6));
    setCountry(addr.country ?? '');
    setCounty(addr.state ?? addr.county ?? addr.state_district ?? addr.region ?? '');
    setCity(addr.city ?? addr.town ?? addr.municipality ?? addr.village ?? addr.suburb ?? '');
    const road = [addr.house_number, addr.road ?? addr.pedestrian ?? addr.footway]
      .filter(Boolean).join(' ');
    setAddressLine(road || result.display_name);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
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
        location: addressLine,
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

      {/* Location search */}
      <div ref={searchRef} className="relative">
        <label className="text-sm font-medium text-gray-700 block mb-1">Search your location</label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (val.trim().length < 3) { setSuggestions([]); setShowSuggestions(false); }
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Type your street, town, or city…"
            autoComplete="off"
            className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-300 text-sm text-gray-800
              focus:outline-none focus:ring-2 focus:ring-green-600 bg-white"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            {searching ? (
              <span className="inline-block w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            ) : '🔍'}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">Results come from OpenStreetMap — works on any device.</p>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg
            overflow-hidden max-h-64 overflow-y-auto">
            {suggestions.map((s) => (
              <li key={s.place_id}>
                <button
                  type="button"
                  onClick={() => applyResult(s)}
                  className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-green-50
                    hover:text-green-900 transition-colors border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium">{s.display_name.split(',')[0]}</span>
                  <span className="block text-xs text-gray-400 truncate mt-0.5">
                    {s.display_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Coordinates badge */}
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

      {/* Editable fields — pre-filled by search, editable manually */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Country" placeholder="e.g. Kenya"
          value={country} onChange={(e) => setCountry(e.target.value)} />
        <FormField label="County / State" placeholder="e.g. Nairobi County, Lagos State"
          value={county} onChange={(e) => setCounty(e.target.value)} />
        <FormField label="City / Town" placeholder="e.g. Nairobi, Kampala, Accra"
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
