// Sonidos generados con WebAudio: cero archivos, funciona sin internet.
import { useGame } from '../store';
import { haptic } from './native';

let ctx: AudioContext | null = null;

// 1) iPhone/iPad: pedir sesión de audio tipo "reproducción" para que suene
//    aunque el switch de silencio esté activado (Safari 17+).
try {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) nav.audioSession.type = 'playback';
} catch {
  /* nada */
}

function ac(): AudioContext | null {
  if (!useGame.getState().sound) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // iOS a veces deja el audio "suspended" o "interrupted": lo despertamos
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

// 2) Truco para iOS viejito: un <audio> en silencio y en loop pone el teléfono
//    en modo "reproducción", y así WebAudio suena aunque esté en silencio.
let silentEl: HTMLAudioElement | null = null;
function silentWavUrl() {
  const rate = 8000, n = rate / 2; // medio segundo de silencio
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function startSilentLoop() {
  try {
    if (!silentEl) {
      silentEl = document.createElement('audio');
      silentEl.src = silentWavUrl();
      silentEl.loop = true;
      silentEl.setAttribute('playsinline', '');
      silentEl.setAttribute('x-webkit-airplay', 'deny');
      silentEl.preload = 'auto';
    }
    if (silentEl.paused) silentEl.play().catch(() => {});
  } catch {
    /* nada */
  }
}

// 3) iOS solo deja sonar después de un toque: lo intentamos en CADA toque
//    hasta que el audio esté corriendo (antes solo se intentaba una vez).
const unlock = () => {
  if (!useGame.getState().sound) return;
  startSilentLoop();
  const c = ac();
  if (!c) return;
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b;
  s.connect(c.destination);
  s.start(0);
};
for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) {
  window.addEventListener(ev, () => {
    if (!ctx || ctx.state !== 'running' || !silentEl || silentEl.paused) unlock();
  }, { passive: true });
}

// 4) Al salir de la app se pausa todo; al regresar se reactiva solo
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    silentEl?.pause();
  } else if (useGame.getState().sound) {
    ctx?.resume().catch(() => {});
  }
});

/** Al prender el sonido en Ajustes, despertar el audio de inmediato */
export function wakeAudio() {
  unlock();
}

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
  horn: () => {
    tone(440, 0.16, { type: 'square', vol: 0.08 });
    tone(440, 0.22, { type: 'square', vol: 0.08, delay: 0.2 });
  },
  bump: () => tone(140, 0.18, { type: 'sine', vol: 0.25, slide: 80 }),
  engine: () => tone(110, 0.25, { type: 'sawtooth', vol: 0.04, slide: 220 }),
  hello: () => [660, 880].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.12, delay: i * 0.09 })),
  alarm: () => [880, 660, 880, 660].forEach((f, i) => tone(f, 0.17, { type: 'square', vol: 0.06, delay: i * 0.18 })),
  equip: () => tone(784, 0.1, { type: 'triangle', vol: 0.12, slide: 1175 }),
};

// Si apagan el sonido en Ajustes, apagamos también el truco de iOS
useGame.subscribe((s, prev) => {
  if (s.sound === prev.sound) return;
  if (!s.sound) {
    silentEl?.pause();
    ctx?.suspend().catch(() => {});
  }
});
