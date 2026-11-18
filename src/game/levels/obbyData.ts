import type { PlatformSpec } from '../physics';

// Diseño del Obby en las Nubes (datos puros, sin React, para poder probarlo)

const PASTEL = ['#ff9ecb', '#ffcf6b', '#7fd8ff', '#9ff0b8', '#c9b6ff', '#ffb38a'];

function pad(x: number, top: number, z: number, w: number, d: number, i: number, extra: Partial<PlatformSpec> = {}): PlatformSpec {
  return { p: [x, top - 0.5, z], s: [w, 1, d], color: PASTEL[i % PASTEL.length], ...extra };
}

export function buildObby() {
  const P: PlatformSpec[] = [];
  const coins: [number, number, number][] = [];
  let i = 0;
  const add = (spec: PlatformSpec, coin = true) => {
    P.push(spec);
    if (coin && spec.kind !== 'bounce') coins.push([spec.p[0], spec.p[1] + 0.5 + 1.1, spec.p[2]]);
  };

  add(pad(0, 0, 0, 10, 10, 0, { color: '#c9b6ff' }), false);
  coins.push([0, 1.1, 2.5], [-2, 1.1, 2.5], [2, 1.1, 2.5]);

  // Sección 1: escalones fáciles
  add(pad(0, 0.5, 8, 3.5, 3.5, i++));
  add(pad(0, 1, 13.5, 3.5, 3.5, i++));
  add(pad(2.5, 1.5, 19, 3.5, 3.5, i++));
  add(pad(-0.5, 2, 24.5, 3.5, 3.5, i++));
  add(pad(1, 2.5, 30, 3.5, 3.5, i++));
  add(pad(0, 3, 37, 7, 7, 0, { kind: 'checkpoint', index: 1, color: '#ffffff' }), false);

  // Sección 2: plataformas que se mueven
  add(pad(0, 3, 45, 4, 4, i++, { move: { axis: 'x', amp: 3, speed: 1.2 } }));
  add(pad(0, 3, 51.5, 4, 4, i++, { move: { axis: 'x', amp: 3, speed: 1.2, phase: Math.PI } }));
  add(pad(0, 3, 58, 4, 4, i++, { move: { axis: 'y', amp: 0.8, speed: 1.5 } }));
  add(pad(0, 3.5, 66, 7, 7, 0, { kind: 'checkpoint', index: 2, color: '#ffffff' }), false);

  // Sección 3: ¡trampolines!
  add(pad(0, 3.7, 74, 3, 3, 0, { kind: 'bounce' }));
  add(pad(0, 8, 82, 5, 5, i++));
  add(pad(0, 8.2, 89.5, 3, 3, 0, { kind: 'bounce' }));
  add(pad(0, 12.5, 97, 5, 5, i++));
  add(pad(0, 13, 105.5, 7, 7, 0, { kind: 'checkpoint', index: 3, color: '#ffffff' }), false);

  // Sección 4: puente angosto y zigzag
  add(pad(0, 13, 116, 2, 10, i++), false);
  coins.push([0, 14.1, 113], [0, 14.1, 116], [0, 14.1, 119]);
  add(pad(3, 13.5, 125, 3, 3, i++));
  add(pad(-1, 14, 130.5, 3, 3, i++));
  add(pad(2, 14.5, 136, 3, 3, i++));

  // Meta
  add(pad(0, 15, 145, 10, 10, 0, { kind: 'finish', color: '#ffd84a' }), false);

  return { platforms: P, coins };
}
