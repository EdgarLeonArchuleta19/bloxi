// Sonidos generados con WebAudio: cero archivos, funciona sin internet.
import { useGame } from '../store';
import { haptic } from './native';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!useGame.getState().sound) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// iOS solo deja sonar audio después de un toque
const unlock = () => {
  const c = ac();
  if (c) {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  }
  window.removeEventListener('pointerdown', unlock);
};
window.addEventListener('pointerdown', unlock);

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; delay?: number; slide?: number } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t0 + dur);
  const v = opts.vol ?? 0.18;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  tap: () => {
    haptic();
    tone(660, 0.08, { type: 'triangle', vol: 0.12 });
  },
  coin: () => {
    tone(988, 0.08, { type: 'square', vol: 0.06 });
    tone(1319, 0.18, { type: 'square', vol: 0.06, delay: 0.07 });
  },
  star: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.12, delay: i * 0.05 })),
  jump: () => tone(300, 0.18, { type: 'square', vol: 0.05, slide: 620 }),
  bounce: () => tone(200, 0.35, { type: 'sine', vol: 0.2, slide: 900 }),
  checkpoint: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.14, delay: i * 0.08 })),
  fall: () => tone(600, 0.5, { type: 'sine', vol: 0.15, slide: 120 }),
  splash: () => tone(400, 0.4, { type: 'sawtooth', vol: 0.05, slide: 80 }),
  win: () =>
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
      tone(f, i === 5 ? 0.5 : 0.14, { type: 'triangle', vol: 0.15, delay: i * 0.12 }),
    ),
  buy: () => [880, 1109, 1319, 1760].forEach((f, i) => tone(f, 0.1, { type: 'square', vol: 0.06, delay: i * 0.06 })),
  error: () => tone(220, 0.25, { type: 'square', vol: 0.06, slide: 150 }),
  count: () => tone(523, 0.15, { type: 'triangle', vol: 0.15 }),
  go: () => tone(1047, 0.35, { type: 'triangle', vol: 0.17 }),
  equip: () => tone(784, 0.1, { type: 'triangle', vol: 0.12, slide: 1175 }),
};
