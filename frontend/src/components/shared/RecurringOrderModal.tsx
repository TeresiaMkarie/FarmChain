import { useState } from 'react';

type Frequency = 'weekly' | 'fortnightly' | 'monthly';

interface Props {
  productName: string;
  defaultQuantity?: number;
  onConfirm: (freq: Frequency, quantity: number, deliveryAddress: string) => Promise<void>;
  onCancel: () => void;
}

const FREQUENCIES: { value: Frequency; label: string; description: string }[] = [
  { value: 'weekly',      label: 'Weekly',      description: 'Every 7 days' },
  { value: 'fortnightly', label: 'Fortnightly',  description: 'Every 14 days' },
  { value: 'monthly',     label: 'Monthly',      description: 'Every 30 days' },
];

export default function RecurringOrderModal({ productName, defaultQuantity = 1, onConfirm, onCancel }: Props) {
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [quantity, setQuantity] = useState(defaultQuantity);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!deliveryAddress.trim()) return;
    setSaving(true);
    try {
      await onConfirm(frequency, quantity, deliveryAddress);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-green-800">Set Up Recurring Order</h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">"{productName}"</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-green-50 rounded-xl px-4 py-3 text-sm text-green-800">
          We'll remind you to reorder this product on your chosen schedule. You stay in control — pause or cancel anytime.
        </div>

        {/* Frequency picker */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">How often?</p>
          <div className="grid grid-cols-3 gap-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                onClick={() => setFrequency(f.value)}
                className={`rounded-xl border-2 px-3 py-3 text-center transition ${
                  frequency === f.value
                    ? 'border-green-700 bg-green-50 text-green-800'
                    : 'border-gray-200 hover:border-green-300 text-gray-600'
                }`}
              >
                <p className="font-semibold text-sm">{f.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{f.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Quantity</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-9 h-9 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-lg flex items-center justify-center"
            >
              −
            </button>
            <span className="w-10 text-center font-semibold text-gray-800">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-9 h-9 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-lg flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Delivery address */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Delivery address</label>
          <textarea
            rows={2}
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Enter your delivery or pick-up address…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
          {!deliveryAddress.trim() && (
            <p className="text-xs text-amber-600">Address is required to set up a recurring order.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 border border-green-700 text-green-700 hover:bg-green-50 py-2.5 rounded-xl font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !deliveryAddress.trim()}
            className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm transition"
          >
            {saving ? 'Saving…' : 'Set up recurring'}
          </button>
        </div>

      </div>
    </div>
  );
}
