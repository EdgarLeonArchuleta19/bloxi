import { useId } from 'react';
import type { ClothLook, Item } from '../data/items';

// Dibujo de la prenda con SU color y patrón (para distinguir cada short, playera, etc.)
const INK = '#33264d';

const SHAPES: Record<string, string> = {
  tee: 'M30 18 L42 12 Q50 21 58 12 L70 18 L88 34 L78 46 L70 40 L70 88 L30 88 L30 40 L22 46 L12 34 Z',
  tank: 'M35 10 L43 10 Q50 24 57 10 L65 10 L66 30 Q73 38 73 50 L73 88 L27 88 L27 50 Q27 38 34 30 Z',
  long: 'M30 18 L42 12 Q50 21 58 12 L70 18 L90 72 L79 76 L70 46 L70 88 L30 88 L30 46 L21 76 L10 72 Z',
  hoodie: 'M30 20 Q34 6 50 6 Q66 6 70 20 L90 72 L79 76 L70 46 L70 88 L30 88 L30 46 L21 76 L10 72 Z',
  pants: 'M27 10 L73 10 L77 90 L56 90 L50 40 L44 90 L23 90 Z',
  shorts: 'M24 24 L76 24 L83 68 L56 72 L50 48 L44 72 L17 68 Z',
  skirt: 'M33 22 L67 22 L86 80 L14 80 Z',
  tutu: 'M36 30 L64 30 L92 56 Q82 68 71 58 Q61 70 50 58 Q39 70 29 58 Q18 68 8 56 Z',
  sneaker: 'M12 46 L38 46 Q46 60 64 60 L84 64 Q92 68 90 76 L12 76 Z',
  light: 'M12 46 L38 46 Q46 60 64 60 L84 64 Q92 68 90 76 L12 76 Z',
  flat: 'M10 62 Q38 50 68 56 L86 62 Q92 70 86 76 L10 76 Z',
  boot: 'M26 12 L52 12 L52 54 L80 60 Q90 64 88 78 L26 78 Z',
  bunny: 'M10 54 Q14 40 40 42 Q70 42 86 56 Q92 66 86 76 L14 76 Q8 66 10 54 Z',
};

function PatternDef({ id, look }: { id: string; look: ClothLook }) {
  const a = look.accent ?? '#ffffff';
  const base = <rect width="100" height="100" fill={look.color} />;
  switch (look.pattern) {
    case 'stripes':
    case 'legstripes':
      return (
        <pattern id={id} width="100" height="14" patternUnits="userSpaceOnUse">
          <rect width="100" height="14" fill={look.color} />
          <rect y="2" width="100" height="6" fill={a} />
        </pattern>
      );
    case 'rainbowstripes':
      return (
        <pattern id={id} width="100" height="36" patternUnits="userSpaceOnUse">
          {['#ff5f5f', '#ffa24c', '#ffd84a', '#5fe08a', '#4cc0ff', '#9b7bff'].map((c, i) => (
            <rect key={c} y={i * 6} width="100" height="6" fill={c} />
          ))}
        </pattern>
      );
    case 'dots':
      return (
        <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill={look.color} />
          <circle cx="5" cy="5" r="3.5" fill="#ff3d5a" />
          <circle cx="15" cy="15" r="3.5" fill="#3cb7f5" />
        </pattern>
      );
    case 'polka':
      return (
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill={look.color} />
          <circle cx="4" cy="4" r="2.4" fill={a} />
          <circle cx="11" cy="11" r="2.4" fill={a} />
        </pattern>
      );
    case 'denim':
      return (
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={look.color} />
          <path d="M0 6 L6 0" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.2" />
        </pattern>
      );
    case 'sidestripe':
      return (
        <pattern id={id} width="100" height="100" patternUnits="userSpaceOnUse">
          {base}
          <rect x="14" width="5" height="100" fill={a} />
          <rect x="81" width="5" height="100" fill={a} />
        </pattern>
      );
    case 'stars':
      return (
        <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill={look.color} />
          <path d="M6 2 L7.4 5 L10.5 5.3 L8.1 7.3 L8.9 10.4 L6 8.7 L3.1 10.4 L3.9 7.3 L1.5 5.3 L4.6 5 Z" fill={a} />
          <circle cx="16" cy="16" r="1.6" fill={a} />
        </pattern>
      );
    case 'camo':
      return (
        <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill={look.color} />
          <ellipse cx="10" cy="10" rx="9" ry="5" fill="#3b4a2a" />
          <ellipse cx="30" cy="22" rx="8" ry="6" fill="#a3b57a" />
          <ellipse cx="12" cy="32" rx="7" ry="4" fill="#4f6b3a" />
        </pattern>
      );
    case 'plaid':
      return (
        <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill={look.color} />
          <rect x="4" width="5" height="20" fill="rgba(40,20,40,0.35)" />
          <rect y="4" width="20" height="5" fill="rgba(40,20,40,0.35)" />
          <rect x="14" width="1" height="20" fill="rgba(255,255,255,0.6)" />
          <rect y="14" width="20" height="1" fill="rgba(255,255,255,0.6)" />
        </pattern>
      );
    case 'hearts':
      return (
        <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill={look.color} />
          <path d="M6 9 C2 6 3 2 6 4 C9 2 10 6 6 9 Z" fill={a} />
          <path d="M15 18 C11 15 12 11 15 13 C18 11 19 15 15 18 Z" fill={a} />
        </pattern>
      );
  }
  return null;
}

const DECAL_EMOJI: Record<string, string> = {
  star: '⭐', heart: '💖', smile: '😃', bolt: '⚡', rainbow: '🌈', dinoprint: '🦕', catface: '🐱', ten: '10', tie: '👔',
};

export function ClothIcon({ item, size = 64 }: { item: Item; size?: number | string }) {
  const uid = useId().replace(/:/g, '');
  const look = item.look!;
  const d = SHAPES[look.shape] ?? SHAPES.tee;
  const hasPattern = !!look.pattern;
  const fill = hasPattern ? `url(#p${uid})` : look.color;
  const decal = look.decal ? DECAL_EMOJI[look.decal] : null;
  const isShoe = item.cat === 'shoes';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="drop-shadow-[0_3px_0_rgba(51,38,77,0.12)]">
      <defs>{hasPattern && <PatternDef id={`p${uid}`} look={look} />}</defs>
      <path d={d} fill={fill} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      {look.shape === 'hoodie' && <rect x="38" y="60" width="24" height="12" rx="4" fill="none" stroke={INK} strokeWidth="2.5" />}
      {(look.shape === 'skirt' || look.shape === 'tutu') && (
        <rect x={look.shape === 'tutu' ? 34 : 31} y={look.shape === 'tutu' ? 26 : 18} width={look.shape === 'tutu' ? 32 : 38} height="7" rx="3" fill={look.accent ?? '#ffffff'} stroke={INK} strokeWidth="2.5" />
      )}
      {isShoe && look.shape !== 'flat' && (
        <rect x="11" y="72" width="80" height="8" rx="4" fill={look.accent ?? '#e6e1f0'} stroke={INK} strokeWidth="2.5" />
      )}
      {look.shape === 'bunny' && (
        <>
          <ellipse cx="62" cy="30" rx="6" ry="15" fill="#ffffff" stroke={INK} strokeWidth="2.5" transform="rotate(-15 62 30)" />
          <ellipse cx="76" cy="32" rx="6" ry="15" fill="#ffffff" stroke={INK} strokeWidth="2.5" transform="rotate(15 76 32)" />
          <circle cx="80" cy="60" r="2.5" fill={INK} />
        </>
      )}
      {look.shape === 'light' && <rect x="11" y="72" width="80" height="8" rx="4" fill={look.accent} opacity="0.9" />}
      {decal && (
        <text x="50" y={decal === '10' ? 64 : 62} textAnchor="middle" fontSize={decal === '10' ? 26 : 24} fontWeight="bold" fill="#ffffff" stroke={decal === '10' ? INK : 'none'} strokeWidth="1">
          {decal}
        </text>
      )}
    </svg>
  );
}
