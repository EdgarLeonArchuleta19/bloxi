import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { sfx } from '../lib/sound';

export type Tone = 'candy' | 'grape' | 'sun' | 'mint' | 'sky' | 'white';

const TONES: Record<Tone, { bg: string; shade: string; text?: string }> = {
  candy: { bg: 'linear-gradient(180deg,#ff7ab6,#ff4f98)', shade: '#d93d82' },
  grape: { bg: 'linear-gradient(180deg,#a17bff,#7d4ff0)', shade: '#5f37c9' },
  sun: { bg: 'linear-gradient(180deg,#ffdc5c,#ffc21a)', shade: '#d99b00', text: '#5a3b00' },
  mint: { bg: 'linear-gradient(180deg,#4fe3ad,#22c487)', shade: '#139768' },
  sky: { bg: 'linear-gradient(180deg,#5fcaff,#2aa8ec)', shade: '#1784c2' },
  white: { bg: '#ffffff', shade: '#d9d0ea', text: '#33264d' },
};

export function CandyButton({
  tone = 'candy',
  className = '',
  onClick,
  disabled,
  children,
  silent,
}: {
  tone?: Tone;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  silent?: boolean;
}) {
  const t = TONES[tone];
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.94 }}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (!silent) sfx.tap();
        onClick?.();
      }}
      className={`candy flex items-center justify-center gap-2 ${disabled ? 'opacity-50 grayscale' : ''} ${className}`}
      style={{ background: t.bg, color: t.text ?? 'white', ['--shade' as string]: t.shade, textShadow: t.text ? 'none' : undefined }}
    >
      {children}
    </motion.button>
  );
}

export function CoinIcon({ size = 26 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        background: 'radial-gradient(circle at 35% 30%, #fff3a8, #ffcf33 45%, #e0a800)',
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.15), 0 2px 0 #b98700',
        color: '#8a5a00',
      }}
    >
      ★
    </span>
  );
}

/** Pastilla de monedas que rebota cuando cambia la cantidad */
export function CoinPill({ amount, className = '' }: { amount: number; className?: string }) {
  const prev = useRef(amount);
  const [bump, setBump] = useState(0);
  const shown = useCountUp(amount);
  useEffect(() => {
    if (amount !== prev.current) setBump((b) => b + 1);
    prev.current = amount;
  }, [amount]);
  return (
    <motion.div
      key={bump}
      initial={{ scale: bump ? 1.25 : 1 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      className={`flex shrink-0 items-center gap-2 rounded-full bg-white/95 pl-1.5 pr-4 py-1.5 text-xl font-bold shadow-[0_4px_0_rgba(51,38,77,0.1)] ${className}`}
    >
      <CoinIcon size={30} />
      <span className="tabular-nums">{shown}</span>
    </motion.div>
  );
}

export function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(a + (target - a) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, ms]);
  return v;
}

export function Modal({ open, onClose, children }: { open: boolean; onClose?: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 short:p-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[#33264d]/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="card no-scrollbar relative max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto p-6 text-center short:max-w-xl short:p-4"
            initial={{ scale: 0.6, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Lluvia de confeti en DOM */
export function Confetti({ count = 60 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.8 + Math.random() * 1.4,
        rot: Math.random() * 720 - 360,
        color: ['#ff5fa2', '#ffcf33', '#3cb7f5', '#2fd39a', '#b07cff', '#ff9a3c'][i % 6],
        w: 8 + Math.random() * 8,
        round: Math.random() < 0.3,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p, i) => (
        <motion.div
          key={i}
          className="absolute top-0"
          style={{
            left: `${p.x}%`,
            width: p.w,
            height: p.round ? p.w : p.w * 0.5,
            background: p.color,
            borderRadius: p.round ? 999 : 3,
          }}
          initial={{ y: -30, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: p.rot, opacity: [1, 1, 0.8] }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

/** Cielo de fondo con nubes que pasan */
export function SkyBackground() {
  const clouds = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        top: 4 + i * 14 + Math.random() * 6,
        dur: 50 + Math.random() * 40,
        delay: -Math.random() * 80,
        scale: 0.6 + Math.random() * 0.8,
        opacity: 0.55 + Math.random() * 0.35,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#a9dcff] via-[#d3ecff] to-[#ffe0f0]" />
      <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-[#ffd1ea] opacity-60 blur-3xl" />
      <div className="absolute -right-16 bottom-10 h-96 w-96 rounded-full bg-[#d8ccff] opacity-60 blur-3xl" />
      {clouds.map((c, i) => (
        <div
          key={i}
          className="absolute left-0"
          style={{
            top: `${c.top}%`,
            animation: `drift ${c.dur}s linear ${c.delay}s infinite`,
            opacity: c.opacity,
          }}
        >
          <CloudShape scale={c.scale} />
        </div>
      ))}
    </div>
  );
}

function CloudShape({ scale }: { scale: number }) {
  return (
    <svg width={180 * scale} height={80 * scale} viewBox="0 0 180 80">
      <g fill="white">
        <circle cx="50" cy="50" r="28" />
        <circle cx="90" cy="38" r="36" />
        <circle cx="130" cy="52" r="26" />
        <rect x="30" y="50" width="120" height="28" rx="14" />
      </g>
    </svg>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={() => {
        sfx.tap();
        onChange();
      }}
      className={`relative h-10 w-[72px] rounded-full transition-colors ${on ? 'bg-mint' : 'bg-[#d9d0ea]'}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 h-8 w-8 rounded-full bg-white shadow"
        style={{ left: on ? 36 : 4 }}
      />
    </button>
  );
}
