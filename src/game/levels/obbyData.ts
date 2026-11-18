import type { PlatformSpec } from '../physics';

// Diseño del Obby en las Nubes (datos puros, sin React, para poder probarlo con el bot)
// 7 etapas separadas por checkpoints 🚩

const PASTEL = ['#ff9ecb', '#ffcf6b', '#7fd8ff', '#9ff0b8', '#c9b6ff', '#ffb38a'];
const RAINBOW = ['#ff6b6b', '#ffa24c', '#ffd84a', '#5fe08a', '#4cc0ff', '#9b7bff'];

function pad(x: number, top: number, z: number, w: number, d: number, i: number, extra: Partial<PlatformSpec> = {}): PlatformSpec {
  return { p: [x, top - 0.5, z], s: [w, 1, d], color: PASTEL[i % PASTEL.length], ...extra };
}

export const OBBY_STAGES = [
  { name: 'Escalones', emoji: '🪜' },
  { name: 'Plataformas locas', emoji: '↔️' },
  { name: 'Trampolines', emoji: '🦘' },
  { name: 'Puente angosto', emoji: '🌉' },
  { name: 'Desaparecen', emoji: '👻' },
  { name: 'Piso de lava', emoji: '🔥' },
  { name: 'Escalera al cielo', emoji: '☁️' },
  { name: 'Final arcoíris', emoji: '🌈' },
];

export function buildObby() {
  const P: PlatformSpec[] = [];
  const coins: [number, number, number][] = [];
  let i = 0;
  const add = (spec: PlatformSpec, coin = true) => {
    P.push(spec);
    if (coin && spec.kind !== 'bounce' && spec.kind !== 'lava') coins.push([spec.p[0], spec.p[1] + spec.s[1] / 2 + 1.1, spec.p[2]]);
  };
  const checkpoint = (top: number, z: number, index: number) =>
    add(pad(0, top, z, 7, 7, 0, { kind: 'checkpoint', index, color: '#ffffff' }), false);

  add(pad(0, 0, 0, 10, 10, 0, { color: '#c9b6ff' }), false);
  coins.push([0, 1.1, 2.5], [-2, 1.1, 2.5], [2, 1.1, 2.5]);

  // Etapa 1: escalones fáciles
  add(pad(0, 0.5, 8, 3.5, 3.5, i++));
  add(pad(0, 1, 13.5, 3.5, 3.5, i++));
  add(pad(2.5, 1.5, 19, 3.5, 3.5, i++));
  add(pad(-0.5, 2, 24.5, 3.5, 3.5, i++));
  add(pad(1, 2.5, 30, 3.5, 3.5, i++));
  checkpoint(3, 37, 1);

  // Etapa 2: plataformas que se mueven
  add(pad(0, 3, 45, 4, 4, i++, { move: { axis: 'x', amp: 3, speed: 1.2 } }));
  add(pad(0, 3, 51.5, 4, 4, i++, { move: { axis: 'x', amp: 3, speed: 1.2, phase: Math.PI } }));
  add(pad(0, 3, 58, 4, 4, i++, { move: { axis: 'y', amp: 0.8, speed: 1.5 } }));
  checkpoint(3.5, 66, 2);

  // Etapa 3: ¡trampolines!
  add(pad(0, 3.7, 74, 3, 3, 0, { kind: 'bounce' }));
  add(pad(0, 8, 82, 5, 5, i++));
  add(pad(0, 8.2, 89.5, 3, 3, 0, { kind: 'bounce' }));
  add(pad(0, 12.5, 97, 5, 5, i++));
  checkpoint(13, 105.5, 3);

  // Etapa 4: puente angosto y zigzag
  add(pad(0, 13, 116, 2, 10, i++), false);
  coins.push([0, 14.1, 113], [0, 14.1, 116], [0, 14.1, 119]);
  add(pad(3, 13.5, 125, 3, 3, i++));
  add(pad(-1, 14, 130.5, 3, 3, i++));
  add(pad(2, 14.5, 136, 3, 3, i++));
  checkpoint(15, 145, 4);

  // Etapa 5: plataformas que desaparecen 👻 (¡no te quedes parada!)
  [[0, 152], [1.5, 157.5], [-1, 163], [0.5, 168.5]].forEach(([x, z]) =>
    add(pad(x, 15, z, 3, 3, 0, { kind: 'fade', color: '#bfe9ff' })),
  );
  checkpoint(15.5, 176, 5);

  // Etapa 6: piedritas sobre lava 🔥
  add({ p: [0, 12.7, 191.5], s: [16, 1, 23], color: '#ff6a2b', kind: 'lava' }, false);
  add(pad(0, 15.5, 182, 3, 3, 5, { color: '#a3917f' }));
  add(pad(1.5, 15.5, 186.5, 3, 3, 5, { color: '#a3917f' }));
  add(pad(0, 15.5, 191, 3, 3, 5, { color: '#a3917f', move: { axis: 'x', amp: 2, speed: 1.1 } }));
  add(pad(-1.5, 15.5, 195.5, 3, 3, 5, { color: '#a3917f' }));
  add(pad(0, 15.5, 200, 3, 3, 5, { color: '#a3917f' }));
  checkpoint(16, 207, 6);

  // Etapa 7: escalera al cielo con elevador y trampolín
  add(pad(0, 17, 213.5, 3, 3, i++));
  add(pad(-2, 18, 218.5, 3, 3, i++));
  add(pad(1, 19, 223.5, 3, 3, i++));
  add(pad(0, 19, 229, 3.5, 3.5, i++, { move: { axis: 'y', amp: 1.5, speed: 1.1 } }));
  add(pad(0, 21.5, 234.5, 4, 4, i++));
  add(pad(0, 21.7, 240, 3, 3, 0, { kind: 'bounce' }));
  add(pad(0, 26, 247, 5, 5, i++));
  checkpoint(26.5, 254, 7);

  // Etapa 8: final arcoíris 🌈
  add(pad(0, 27, 260, 2.6, 2.6, 0, { color: RAINBOW[0] }));
  add(pad(2.5, 27.5, 265, 2.6, 2.6, 0, { color: RAINBOW[1] }));
  add(pad(0, 28, 270, 2.6, 2.6, 0, { color: RAINBOW[2] }));
  add(pad(-2.5, 28.5, 275, 2.6, 2.6, 0, { color: RAINBOW[3] }));
  add(pad(0, 29, 280, 2.6, 2.6, 0, { color: RAINBOW[4] }));
  add(pad(0, 29, 285.5, 3, 3, 0, { color: RAINBOW[5], move: { axis: 'x', amp: 2.5, speed: 1.2 } }));
  add(pad(0, 29.5, 291, 3, 3, 0, { kind: 'fade', color: '#bfe9ff' }));
  add(pad(0, 29.7, 296.5, 3, 3, 0, { kind: 'bounce' }));

  // Meta 🏆
  add(pad(0, 33, 305, 10, 10, 0, { kind: 'finish', color: '#ffd84a' }), false);

  return { platforms: P, coins };
}

export const OBBY_CHECKPOINTS = 7;
