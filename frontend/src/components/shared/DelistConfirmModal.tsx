interface Props {
  productName: string;
  isActive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DelistConfirmModal({ productName, isActive, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-800">Delist "{productName}"?</h2>
          <p className="text-sm text-gray-500 mt-1">This action cannot be undone immediately.</p>
        </div>

        {/* What will happen */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-600">
          <p className="font-semibold text-gray-700 mb-1">What happens when you delist:</p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">✕</span>
              <span>The listing is removed from the marketplace immediately — buyers can no longer find or purchase it.</span>
            </li>
            {isActive && (
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">⚠</span>
                <span>The product will be marked <strong>delisted</strong> on the Stellar blockchain via a signed transaction.</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>Any existing funded or shipped orders are <strong>not affected</strong> — they continue normally.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>You can re-list the product later from your dashboard.</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 py-2.5 rounded-xl font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-semibold text-sm transition"
          >
            Yes, delist it
          </button>
        </div>
      </div>
    </div>
  );
}
