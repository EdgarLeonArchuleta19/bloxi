import { useId } from 'react';
import { motion } from 'motion/react';

/** Cubito con carita inclinado: la "O" de BLOXI y el ícono de la app */
export function LogoCube({ size = 100, tilt = -12 }: { size?: number; tilt?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7ab6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <g transform={`rotate(${tilt} 60 60)`}>
        {/* sombra 3D */}
        <rect x="16" y="22" width="88" height="88" rx="20" fill="#33264d" />
        <rect x="16" y="14" width="88" height="88" rx="20" fill={`url(#g${id})`} stroke="#33264d" strokeWidth="7" />
        <path d="M30 26 h46" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="7" strokeLinecap="round" />
        {/* carita */}
        <ellipse cx="45" cy="54" rx="7" ry="9" fill="#33264d" />
        <ellipse cx="75" cy="54" rx="7" ry="9" fill="#33264d" />
        <circle cx="43" cy="50.5" r="2.6" fill="#ffffff" />
        <circle cx="73" cy="50.5" r="2.6" fill="#ffffff" />
        <ellipse cx="34" cy="68" rx="6" ry="4" fill="#ffd1e6" opacity="0.8" />
        <ellipse cx="86" cy="68" rx="6" ry="4" fill="#ffd1e6" opacity="0.8" />
        <path d="M47 70 Q60 82 73 70" fill="none" stroke="#33264d" strokeWidth="5.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Logo de BLOXI: letras de bloque gruesas con el cubito como "O" */
export function Logo({ height = 90, animated = true }: { height?: number; animated?: boolean }) {
  const letter = (t: string, x: number, anchor: 'start' | 'end') => (
    <>
      <text x={x} y={108} textAnchor={anchor} className="logo-letters" fill="#33264d">
        {t}
      </text>
      <text
        x={x}
        y={100}
        textAnchor={anchor}
        className="logo-letters"
        fill="#ffffff"
        stroke="#33264d"
        strokeWidth={13}
        strokeLinejoin="round"
        paintOrder="stroke fill"
      >
        {t}
      </text>
    </>
  );
  return (
    <motion.div
      className="inline-flex"
      initial={animated ? { scale: 0.6, opacity: 0, rotate: -6 } : false}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 14 }}
    >
      <svg height={height} viewBox="0 0 470 130" style={{ overflow: 'visible' }}>
        <style>{`.logo-letters{font-family:Fredoka,ui-rounded,"SF Pro Rounded",system-ui,sans-serif;font-weight:700;font-size:112px;letter-spacing:-2px}`}</style>
        {letter('BL', 190, 'end')}
        <motion.g
          animate={animated ? { y: [0, -8, 0], rotate: [0, -4, 0] } : undefined}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '247px 62px' }}
        >
          <foreignObject x={186} y={2} width={122} height={122}>
            <LogoCube size={122} />
          </foreignObject>
        </motion.g>
        {letter('XI', 304, 'start')}
      </svg>
    </motion.div>
  );
}
