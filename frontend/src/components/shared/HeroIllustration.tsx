export default function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 560 460"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto max-w-lg drop-shadow-2xl"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="100%" stopColor="#f0fdf4" />
        </linearGradient>
        <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Sky */}
      <rect width="560" height="460" rx="24" fill="url(#sky)" />

      {/* Clouds */}
      <ellipse cx="80" cy="70" rx="45" ry="18" fill="white" opacity="0.9" />
      <ellipse cx="110" cy="60" rx="35" ry="20" fill="white" opacity="0.9" />
      <ellipse cx="50" cy="65" rx="30" ry="16" fill="white" opacity="0.9" />

      <ellipse cx="420" cy="55" rx="38" ry="15" fill="white" opacity="0.7" />
      <ellipse cx="448" cy="46" rx="28" ry="17" fill="white" opacity="0.7" />
      <ellipse cx="394" cy="52" rx="26" ry="14" fill="white" opacity="0.7" />

      {/* Sun */}
      <circle cx="480" cy="90" r="38" fill="#fef08a" opacity="0.5" />
      <circle cx="480" cy="90" r="28" fill="#fde047" opacity="0.85" />
      {[0,40,80,120,160,200,240,280,320].map((deg) => {
        const r = deg * Math.PI / 180;
        return (
          <line
            key={deg}
            x1={480 + Math.cos(r) * 32} y1={90 + Math.sin(r) * 32}
            x2={480 + Math.cos(r) * 44} y2={90 + Math.sin(r) * 44}
            stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"
          />
        );
      })}

      {/* Far hill */}
      <ellipse cx="280" cy="380" rx="340" ry="130" fill="#86efac" />

      {/* Mid ground */}
      <path d="M0 310 Q100 270 200 295 Q300 315 400 285 Q480 265 560 290 L560 460 L0 460Z" fill="url(#hill1)" />

      {/* Foreground ground */}
      <path d="M0 360 Q120 330 260 350 Q380 368 560 345 L560 460 L0 460Z" fill="url(#hill2)" />

      {/* ── Barn ── */}
      {/* Barn body */}
      <rect x="155" y="220" width="110" height="100" rx="3" fill="#dc2626" />
      {/* Barn shadow */}
      <rect x="220" y="220" width="45" height="100" rx="3" fill="#b91c1c" />
      {/* Barn roof */}
      <polygon points="142,222 210,155 278,222" fill="#991b1b" />
      <polygon points="210,155 278,222 265,222 210,168" fill="#7f1d1d" />
      {/* Barn door */}
      <rect x="188" y="277" width="28" height="43" rx="3" fill="#7f1d1d" />
      <line x1="202" y1="277" x2="202" y2="320" stroke="#991b1b" strokeWidth="1.5" />
      {/* Barn windows */}
      <rect x="162" y="238" width="22" height="22" rx="3" fill="#fef9c3" />
      <line x1="173" y1="238" x2="173" y2="260" stroke="#d97706" strokeWidth="1" />
      <line x1="162" y1="249" x2="184" y2="249" stroke="#d97706" strokeWidth="1" />
      <rect x="236" y="238" width="22" height="22" rx="3" fill="#fef9c3" />
      <line x1="247" y1="238" x2="247" y2="260" stroke="#d97706" strokeWidth="1" />
      <line x1="236" y1="249" x2="258" y2="249" stroke="#d97706" strokeWidth="1" />

      {/* ── Silo ── */}
      <rect x="278" y="240" width="34" height="80" rx="5" fill="#e5e7eb" />
      <ellipse cx="295" cy="240" rx="17" ry="9" fill="#d1d5db" />
      <ellipse cx="295" cy="240" rx="17" ry="9" fill="none" stroke="#9ca3af" strokeWidth="1" />
      {[255,265,275,285,295,305,315].map((y) => (
        <line key={y} x1="278" y1={y} x2="312" y2={y} stroke="#d1d5db" strokeWidth="0.8" />
      ))}

      {/* ── Crop rows ── */}
      {[0,1,2,3,4,5].map((i) => (
        <g key={`crop-l-${i}`}>
          <rect x={52 + i * 16} y="320" width="7" height="22" rx="3" fill="#166534" />
          <ellipse cx={55 + i * 16} cy="317" rx="7" ry="10" fill="#15803d" />
          <ellipse cx={55 + i * 16} cy="314" rx="4" ry="5" fill="#16a34a" />
        </g>
      ))}
      {[0,1,2,3,4,5,6].map((i) => (
        <g key={`crop-r-${i}`}>
          <rect x={338 + i * 20} y="312" width="7" height="25" rx="3" fill="#166534" />
          <ellipse cx={341 + i * 20} cy="308" rx="8" ry="11" fill="#15803d" />
          <ellipse cx={341 + i * 20} cy="305" rx="5" ry="6" fill="#22c55e" />
        </g>
      ))}

      {/* ── Fence ── */}
      {[130,150,170,190,210,230,250,270,290,310,330,350,370,390].map((x) => (
        <rect key={x} x={x} y="353" width="5" height="18" rx="2" fill="#d97706" />
      ))}
      <line x1="132" y1="358" x2="392" y2="358" stroke="#d97706" strokeWidth="2" />
      <line x1="132" y1="364" x2="392" y2="364" stroke="#d97706" strokeWidth="2" />

      {/* ── Blockchain network ── */}
      {/* Connection lines (dashed) */}
      <line x1="110" y1="148" x2="232" y2="108" stroke="#4ade80" strokeWidth="2"
        strokeDasharray="7,5" opacity="0.8" />
      <line x1="328" y1="108" x2="450" y2="148" stroke="#4ade80" strokeWidth="2"
        strokeDasharray="7,5" opacity="0.8" />
      {/* Animated dots on lines */}
      <circle cx="160" cy="132" r="4" fill="#4ade80" opacity="0.9" />
      <circle cx="395" cy="132" r="4" fill="#4ade80" opacity="0.9" />

      {/* Node: Farmer */}
      <circle cx="80" cy="160" r="34" fill="white" fillOpacity="0.15" />
      <circle cx="80" cy="160" r="30" fill="white" stroke="#4ade80" strokeWidth="2.5" />
      <text x="80" y="154" textAnchor="middle" fontSize="20">🌾</text>
      <text x="80" y="170" textAnchor="middle" fontSize="9" fill="#166534" fontWeight="bold" fontFamily="system-ui">FARMER</text>

      {/* Node: Escrow */}
      <circle cx="280" cy="95" r="38" fill="#16a34a" fillOpacity="0.2" />
      <circle cx="280" cy="95" r="32" fill="white" stroke="#16a34a" strokeWidth="3" filter="url(#glow)" />
      <text x="280" y="88" textAnchor="middle" fontSize="20">🔒</text>
      <text x="280" y="105" textAnchor="middle" fontSize="9" fill="#166534" fontWeight="bold" fontFamily="system-ui">ESCROW</text>

      {/* XLM badge under escrow node */}
      <rect x="250" y="133" width="60" height="20" rx="10" fill="#16a34a" />
      <text x="280" y="148" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold" fontFamily="system-ui">✦ XLM</text>

      {/* Node: Buyer */}
      <circle cx="480" cy="160" r="34" fill="white" fillOpacity="0.15" />
      <circle cx="480" cy="160" r="30" fill="white" stroke="#4ade80" strokeWidth="2.5" />
      <text x="480" y="154" textAnchor="middle" fontSize="20">🛒</text>
      <text x="480" y="170" textAnchor="middle" fontSize="9" fill="#166534" fontWeight="bold" fontFamily="system-ui">BUYER</text>

      {/* Arrow heads on lines */}
      <polygon points="232,108 220,103 222,115" fill="#4ade80" opacity="0.8" />
      <polygon points="450,148 440,140 438,152" fill="#4ade80" opacity="0.8" />
    </svg>
  );
}
