interface Props {
  status: 'pending' | 'success' | 'error';
  message?: string;
  onClose: () => void;
}

export default function TxStatusToast({ status, message, onClose }: Props) {
  const colours = {
    pending: 'bg-blue-600',
    success: 'bg-green-600',
    error:   'bg-red-600',
  };

  const icons = { pending: '⏳', success: '✅', error: '❌' };

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-white ${colours[status]}`}>
      <span className="text-lg">{icons[status]}</span>
      <span className="text-sm font-medium">
        {message ?? (status === 'pending' ? 'Transaction pending…' : status === 'success' ? 'Transaction confirmed' : 'Transaction failed')}
      </span>
      <button onClick={onClose} className="ml-3 text-white/70 hover:text-white text-xs">✕</button>
    </div>
  );
}
