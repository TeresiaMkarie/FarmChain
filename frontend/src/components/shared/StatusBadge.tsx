const colours: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  funded:    'bg-blue-100 text-blue-800',
  active:    'bg-green-100 text-green-800',
  shipped:   'bg-purple-100 text-purple-800',
  delivered: 'bg-teal-100 text-teal-800',
  completed: 'bg-green-200 text-green-900',
  disputed:  'bg-red-100 text-red-800',
  refunded:  'bg-gray-100 text-gray-700',
  sold:      'bg-gray-200 text-gray-700',
};

export default function StatusBadge({ status }: { status: string }) {
  const cls = colours[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}
