interface Props {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent
          transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-1
          ${checked ? 'bg-green-700' : 'bg-gray-200'}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm
            transform transition-transform duration-200
            ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}
