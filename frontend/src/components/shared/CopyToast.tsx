interface Props {
  visible: boolean;
  message?: string;
}

export default function CopyToast({ visible, message = 'Address copied!' }: Props) {
  return (
    <div
      className={`fixed top-20 right-6 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl
        bg-green-950 text-green-100 text-sm font-medium shadow-xl border border-white/10
        transition-all duration-200
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
      aria-live="polite"
    >
      <span className="text-green-400">✓</span>
      {message}
    </div>
  );
}
