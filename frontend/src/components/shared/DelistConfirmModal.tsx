interface Props {
  productName: string;
  isActive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DelistConfirmModal({ productName, isActive, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-green-800">Delist Product?</h2>
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

        {/* What will happen */}
        <div className="bg-green-50 rounded-xl p-4 space-y-2.5 text-sm">
          <p className="font-semibold text-green-800 text-xs uppercase tracking-wide">What happens</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-gray-700">
              <span className="text-red-500 font-bold shrink-0 mt-px">✕</span>
              Removed from the marketplace — buyers can no longer find or purchase it.
            </li>
            {isActive && (
              <li className="flex items-start gap-2 text-gray-700">
                <span className="text-amber-500 font-bold shrink-0 mt-px">!</span>
                Requires a Stellar transaction to update the on-chain listing status.
              </li>
            )}
            <li className="flex items-start gap-2 text-gray-700">
              <span className="text-green-600 font-bold shrink-0 mt-px">✓</span>
              Any funded or shipped orders continue unaffected.
            </li>
            <li className="flex items-start gap-2 text-gray-700">
              <span className="text-green-600 font-bold shrink-0 mt-px">✓</span>
              You can re-list this product from your dashboard at any time.
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-green-700 text-green-700 hover:bg-green-50 py-2.5 rounded-xl font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-green-900 hover:bg-green-950 text-white py-2.5 rounded-xl font-semibold text-sm transition"
          >
            Yes, delist it
          </button>
        </div>

      </div>
    </div>
  );
}
