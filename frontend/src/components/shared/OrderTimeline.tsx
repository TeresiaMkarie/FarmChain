import type { OrderStatus } from '../../types';

interface Props {
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  trackingInfo?: string;
}

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'created', label: 'Order Created' },
  { key: 'funded', label: 'Funds Locked in Escrow' },
  { key: 'shipped', label: 'Shipped by Farmer' },
  { key: 'completed', label: 'Delivery Confirmed' },
];

const STEP_ORDER: OrderStatus[] = ['created', 'funded', 'shipped', 'completed'];

function stepIndex(status: OrderStatus): number {
  const i = STEP_ORDER.indexOf(status);
  if (status === 'disputed') return 2; // between shipped and completed
  if (status === 'refunded' || status === 'resolved' || status === 'cancelled') return 3;
  return i === -1 ? 0 : i;
}

export default function OrderTimeline({ status, createdAt, updatedAt, trackingInfo }: Props) {
  const current = stepIndex(status);
  const isTerminal = ['completed', 'refunded', 'resolved', 'cancelled'].includes(status);
  const isDisputed = status === 'disputed';

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">Order Progress</h3>
      <ol className="relative border-l border-gray-200 ml-3 space-y-5">
        {STEPS.map((step, i) => {
          const done = i < current || (isTerminal && i <= current);
          const active = i === current && !isTerminal;

          return (
            <li key={step.key} className="ml-4">
              <span
                className={`absolute -left-1.5 mt-0.5 w-3 h-3 rounded-full border-2 ${
                  done
                    ? 'bg-green-600 border-green-600'
                    : active
                    ? 'bg-white border-green-600 animate-pulse'
                    : 'bg-white border-gray-300'
                }`}
              />
              <p className={`text-sm font-medium ${done || active ? 'text-gray-800' : 'text-gray-400'}`}>
                {step.label}
                {i === 2 && trackingInfo && done && (
                  <span className="ml-2 text-xs text-gray-500 font-normal">— {trackingInfo}</span>
                )}
              </p>
              {i === 0 && (
                <p className="text-xs text-gray-400">{new Date(createdAt).toLocaleString()}</p>
              )}
              {i === current && (
                <p className="text-xs text-gray-400">{new Date(updatedAt).toLocaleString()}</p>
              )}
            </li>
          );
        })}

        {isDisputed && (
          <li className="ml-4">
            <span className="absolute -left-1.5 mt-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-red-500" />
            <p className="text-sm font-medium text-red-600">Dispute Raised</p>
            <p className="text-xs text-gray-400">{new Date(updatedAt).toLocaleString()}</p>
          </li>
        )}

        {(status === 'refunded' || status === 'resolved') && (
          <li className="ml-4">
            <span className="absolute -left-1.5 mt-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-500" />
            <p className="text-sm font-medium text-blue-700">
              {status === 'refunded' ? 'Refunded to Buyer' : 'Dispute Resolved'}
            </p>
          </li>
        )}

        {status === 'cancelled' && (
          <li className="ml-4">
            <span className="absolute -left-1.5 mt-0.5 w-3 h-3 rounded-full bg-gray-400 border-2 border-gray-400" />
            <p className="text-sm font-medium text-gray-500">Order Cancelled</p>
          </li>
        )}
      </ol>
    </div>
  );
}
