import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export default function FormField({ label, error, hint, id, ...rest }: Props) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={fieldId}
        className={`px-3 py-2 rounded-lg border text-sm text-gray-800 bg-white
          focus:outline-none focus:ring-2 focus:ring-green-700 transition
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
