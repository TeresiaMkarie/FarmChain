interface Props {
  publicKey: string;
  size?: number;
}

function getHue(pk: string): number {
  let hash = 0;
  for (const ch of pk) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return hash % 360;
}

export default function WalletAvatar({ publicKey, size = 40 }: Props) {
  const hue = getHue(publicKey);
  return (
    <div
      style={{
        background: `hsl(${hue}, 55%, 38%)`,
        width: size,
        height: size,
        minWidth: size,
        fontSize: size * 0.35,
      }}
      className="rounded-full flex items-center justify-center text-white font-bold select-none"
    >
      {publicKey.slice(0, 2).toUpperCase()}
    </div>
  );
}
