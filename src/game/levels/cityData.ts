import type { PlatformSpec } from '../physics';

// 🏙️ Mapa de la Mini Ciudad: 5 calles por lado, cuadras con casa, tiendas, parque, feria, lago, escuela y más.

export const CITY_HALF = 106; // la ciudad va de -106 a 106
export const ROADS = [-72, -36, 0, 36, 72]; // calles en x y en z
export const ROAD_W = 9;
const BLOCKS = [-90, -54, -18, 18, 54, 90]; // centros de las cuadras

export type ShopId = 'house' | 'icecream' | 'pizza' | 'balloons' | 'clothes' | 'fountain' | 'pets' | 'school' | 'wheel' | 'carousel';

export interface Shop {
  id: ShopId;
  name: string;
  emoji: string;
  /** dónde pararse para la acción */
  spot: [number, number];
  sign?: { pos: [number, number, number]; rotY: number; color: string };
}

export interface VehicleSpec {
  kind: 'car' | 'moto' | 'truck';
  color: string;
  pos: [number, number];
  heading: number;
}

export interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
}

/* Lugares especiales (centros) */
export const FAIR = { wheel: [-60, 24] as [number, number], carousel: [-46, 12] as [number, number] };
export const LAKE = { x: 54, z: 19, w: 22, d: 19 };

/** cajas sólidas (paredes, edificios, troncos) y edificios para dibujar instanciados */
export function buildCity(): { platforms: PlatformSpec[]; apartments: Building[] } {
  const P: PlatformSpec[] = [];
  // piso (lo dibujamos aparte como un plano para que las calles no parpadeen)
  P.push({ p: [0, -0.5, 0], s: [CITY_HALF * 2 + 10, 1, CITY_HALF * 2 + 10], color: '#86df8c', hidden: true });
  // barda invisible alrededor
  const W = CITY_HALF + 1;
  P.push({ p: [0, 2, W], s: [W * 2, 6, 1], color: '#fff', hidden: true });
  P.push({ p: [0, 2, -W], s: [W * 2, 6, 1], color: '#fff', hidden: true });
  P.push({ p: [W, 2, 0], s: [1, 6, W * 2], color: '#fff', hidden: true });
  P.push({ p: [-W, 2, 0], s: [1, 6, W * 2], color: '#fff', hidden: true });

  const box = (x: number, z: number, w: number, d: number, h: number, color: string, extra: Partial<PlatformSpec> = {}) =>
    P.push({ p: [x, h / 2, z], s: [w, h, d], color, ...extra });

  // 🏠 Tu casita · 🍦 Heladería · 🍕 Pizzería · 🎈 globos · ⛲ fuente · 👗 ropa (las 4 cuadras del centro)
  box(-18, -21, 10, 8, 4.6, '#ffb3d1');
  box(12.5, -21, 8, 7, 4, '#fff1a8');
  box(23.5, -21, 8, 7, 4, '#ffcf9e');
  box(-9.5, 10.5, 3, 2, 1.1, '#ffffff');
  box(-18, 18, 5.4, 5.4, 0.8, '#c9e8ff');
  box(18, 22, 13, 8, 5, '#d9c8ff');
  // 🐶 Tienda de mascotas
  box(-54, -22, 12, 8, 5, '#ffe0b3');
  // 🏫 Escuela
  box(54, -25, 18, 10, 7, '#ffd9a8');
  // 🚒 Bomberos
  box(18, -59, 14, 10, 6, '#ff6b6b');
  // 🎡 feria: base de la rueda y carrusel (bajito: se puede subir)
  box(FAIR.wheel[0], FAIR.wheel[1], 6, 3, 0.6, '#b07cff');
  box(FAIR.carousel[0], FAIR.carousel[1], 7, 7, 0.35, '#ffd23f');

  // 🏢 edificios de las demás cuadras (se dibujan todos de un jalón)
  const special = new Set(['-18,-18', '18,-18', '-18,18', '18,18', '-54,-18', '54,-18', '-54,18', '54,18', '18,-54']);
  const apartments: Building[] = [];
  const palette = ['#ffd1e6', '#cde9ff', '#fff0b3', '#d9ffe4', '#e6d9ff', '#ffe0cc', '#c8f1ff', '#ffd6f5'];
  let k = 0;
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      if (special.has(`${bx},${bz}`)) continue;
      const tall = Math.abs(bx) >= 54 || Math.abs(bz) >= 54;
      const h = (tall ? 8 : 6) + ((k * 37) % (tall ? 12 : 6));
      const w = 10 + (k % 3) * 2;
      const d = 10 + ((k + 1) % 3) * 2;
      const color = palette[k % palette.length];
      // dos edificios en las cuadras grandes de afuera
      if (Math.abs(bx) === 90 || Math.abs(bz) === 90) {
        for (const off of [-6.5, 6.5]) {
          const b = { x: bx + (Math.abs(bx) === 90 ? 0 : off), z: bz + (Math.abs(bx) === 90 ? off : 0), w: w * 0.8, d: d * 0.8, h: h + ((off > 0 ? 3 : 0)), color: palette[(k + (off > 0 ? 3 : 0)) % palette.length] };
          apartments.push(b);
          box(b.x, b.z, b.w, b.d, b.h, b.color, { hidden: true });
        }
      } else {
        const b = { x: bx, z: bz, w, d, h, color };
        apartments.push(b);
        box(b.x, b.z, b.w, b.d, b.h, b.color, { hidden: true });
      }
      k++;
    }
  }
  // troncos de los árboles (sólidos)
  for (const [x, z] of TREES) box(x, z, 0.7, 0.7, 2.2, '#a86b3c', { hidden: true });
  return { platforms: P, apartments };
}

/** ¿Este punto cae en una calle? */
export const onRoad = (x: number, z: number, pad = 0) => ROADS.some((r) => Math.abs(x - r) < ROAD_W / 2 + 2 + pad || Math.abs(z - r) < ROAD_W / 2 + 2 + pad);

/* Árboles: en las orillas de las cuadras, sin estorbar edificios ni lugares especiales */
function makeTrees(): [number, number][] {
  const out: [number, number][] = [
    // parque
    [-26, 10], [-26, 26], [-10, 26], [-12, 22], [-24, 18], [-14, 12], [-22, 28],
    // junto a la casa
    [-28, -12], [-27, -27],
  ];
  const avoid: [number, number, number][] = [
    [-18, -21, 9], [18, -21, 11], [18, 22, 10], [-54, -22, 9], [54, -25, 12], [18, -59, 10],
    [FAIR.wheel[0], FAIR.wheel[1], 10], [FAIR.carousel[0], FAIR.carousel[1], 7], [LAKE.x, LAKE.z, 14], [-18, 18, 14],
  ];
  for (const bx of BLOCKS)
    for (const bz of BLOCKS) {
      if (Math.abs(bx) < 30 && Math.abs(bz) < 30) continue;
      // cuatro esquinas de cada cuadra
      for (const [ox, oz] of [[-10.5, -10.5], [10.5, -10.5], [-10.5, 10.5], [10.5, 10.5]]) {
        const x = bx + ox, z = bz + oz;
        if (Math.abs(x) > CITY_HALF - 3 || Math.abs(z) > CITY_HALF - 3) continue;
        if (avoid.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r)) continue;
        out.push([x, z]);
      }
    }
  return out;
}
export const TREES: [number, number][] = makeTrees();
export const PALMS: [number, number][] = [[44, 8], [64, 8], [44, 30], [65, 30]];

export const SHOPS: Shop[] = [
  { id: 'house', name: 'Mi casita', emoji: '🏠', spot: [-18, -14.5], sign: { pos: [-18, 5.2, -16.9], rotY: 0, color: '#ff5fa2' } },
  { id: 'icecream', name: 'Heladería', emoji: '🍦', spot: [12.5, -15], sign: { pos: [12.5, 4.6, -17.4], rotY: 0, color: '#3cb7f5' } },
  { id: 'pizza', name: 'Pizzería', emoji: '🍕', spot: [23.5, -15], sign: { pos: [23.5, 4.6, -17.4], rotY: 0, color: '#ff4d4d' } },
  { id: 'balloons', name: 'Globos', emoji: '🎈', spot: [-9.5, 8], sign: { pos: [-9.5, 2.6, 9.4], rotY: Math.PI, color: '#ff7ab6' } },
  { id: 'clothes', name: 'Tienda de ropa', emoji: '👗', spot: [18, 15], sign: { pos: [18, 5.7, 17.9], rotY: Math.PI, color: '#8b5cf6' } },
  { id: 'fountain', name: 'Fuente de los deseos', emoji: '⛲', spot: [-18, 14], sign: { pos: [-18, 3.4, 18], rotY: Math.PI, color: '#2fd39a' } },
  { id: 'pets', name: 'Mascotas', emoji: '🐶', spot: [-54, -15], sign: { pos: [-54, 5.8, -17.9], rotY: 0, color: '#ff9a3c' } },
  { id: 'school', name: 'Escuela', emoji: '🏫', spot: [54, -17], sign: { pos: [54, 7.9, -19.9], rotY: 0, color: '#3cb7f5' } },
  { id: 'wheel', name: 'Feria', emoji: '🎡', spot: [FAIR.wheel[0] + 4.5, FAIR.wheel[1] - 3.5] },
  { id: 'carousel', name: 'Carrusel', emoji: '🎠', spot: [FAIR.carousel[0] + 4.8, FAIR.carousel[1] - 4.8] },
];

export const VEHICLES: VehicleSpec[] = [
  { kind: 'car', color: '#ff7ab6', pos: [-9, -6.8], heading: Math.PI / 2 },
  { kind: 'car', color: '#ffd23f', pos: [24, 6.8], heading: -Math.PI / 2 },
  { kind: 'car', color: '#3cb7f5', pos: [-30, 41], heading: 0 },
  { kind: 'car', color: '#2fd39a', pos: [46, 6.8], heading: -Math.PI / 2 },
  { kind: 'truck', color: '#ff3d3d', pos: [18, -50], heading: 0 },
  { kind: 'moto', color: '#9b6bff', pos: [4, -10], heading: Math.PI / 2 },
  { kind: 'moto', color: '#2fd39a', pos: [-6.8, 22], heading: Math.PI },
  { kind: 'moto', color: '#ff7ab6', pos: [-60, -8], heading: Math.PI / 2 },
];

/** Recorridos del tráfico (por las calles; manejan por su derecha) */
export const TRAFFIC_LOOPS: { path: [number, number][]; color: string; speed: number }[] = [
  { path: [[-36, -36], [36, -36], [36, 36], [-36, 36]], color: '#ff9a3c', speed: 9 },
  { path: [[72, 72], [-72, 72], [-72, -72], [72, -72]], color: '#7c6cf0', speed: 10 },
  { path: [[0, -72], [0, 72], [72, 72], [72, -72]], color: '#ffffff', speed: 8.5 },
];

/** dónde aparece la niña: frente a su casa */
export const CITY_SPAWN: [number, number, number] = [-18, 0, -11];
