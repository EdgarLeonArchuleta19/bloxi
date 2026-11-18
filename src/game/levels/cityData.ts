import type { PlatformSpec } from '../physics';

// 🏙️ Mapa de la Mini Ciudad: calles en cuadrícula, cuadras con casa, tiendas, parque y edificios.

export const CITY_HALF = 70; // la ciudad va de -70 a 70
export const ROADS = [-36, 0, 36]; // calles en x y en z
export const ROAD_W = 9;

export type ShopId = 'house' | 'icecream' | 'pizza' | 'balloons' | 'clothes' | 'fountain';

export interface Shop {
  id: ShopId;
  name: string;
  emoji: string;
  /** dónde pararse para la acción */
  spot: [number, number];
  sign: { pos: [number, number, number]; rotY: number; color: string };
}

export interface VehicleSpec {
  kind: 'car' | 'moto';
  color: string;
  pos: [number, number];
  heading: number;
}

/** cajas sólidas (paredes, edificios, troncos) */
export function buildCity(): { platforms: PlatformSpec[]; apartments: { x: number; z: number; w: number; d: number; h: number; color: string }[] } {
  const P: PlatformSpec[] = [];
  // piso de pasto
  P.push({ p: [0, -0.5, 0], s: [CITY_HALF * 2 + 10, 1, CITY_HALF * 2 + 10], color: '#86df8c' });
  // barda invisible alrededor
  const W = CITY_HALF + 1;
  P.push({ p: [0, 2, W], s: [W * 2, 6, 1], color: '#fff', hidden: true });
  P.push({ p: [0, 2, -W], s: [W * 2, 6, 1], color: '#fff', hidden: true });
  P.push({ p: [W, 2, 0], s: [1, 6, W * 2], color: '#fff', hidden: true });
  P.push({ p: [-W, 2, 0], s: [1, 6, W * 2], color: '#fff', hidden: true });

  const box = (x: number, z: number, w: number, d: number, h: number, color: string, extra: Partial<PlatformSpec> = {}) =>
    P.push({ p: [x, h / 2, z], s: [w, h, d], color, ...extra });

  // 🏠 Tu casita (cuadra -18,-18) con la puerta hacia la calle de z=0
  box(-18, -21, 10, 8, 4.6, '#ffb3d1');
  // 🍦 Heladería y 🍕 Pizzería (cuadra 18,-18)
  box(12.5, -21, 8, 7, 4, '#fff1a8');
  box(23.5, -21, 8, 7, 4, '#ffcf9e');
  // 🎈 kiosko de globos en el parque
  box(-9.5, 10.5, 3, 2, 1.1, '#ffffff');
  // ⛲ fuente del parque (cuadra -18,18)
  box(-18, 18, 5.4, 5.4, 0.8, '#c9e8ff');
  // 👗 Tienda de ropa (cuadra 18,18) con la puerta hacia z=0
  box(18, 22, 13, 8, 5, '#d9c8ff');

  // 🏢 edificios de las cuadras de afuera
  const apartments: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [];
  const palette = ['#ffd1e6', '#cde9ff', '#fff0b3', '#d9ffe4', '#e6d9ff', '#ffe0cc'];
  let k = 0;
  for (const bx of [-54, -18, 18, 54]) {
    for (const bz of [-54, -18, 18, 54]) {
      const inner = Math.abs(bx) < 30 && Math.abs(bz) < 30;
      if (inner) continue; // las cuadras de en medio ya tienen tiendas
      const h = 7 + ((k * 37) % 9);
      const w = 9 + (k % 3) * 2;
      const d = 9 + ((k + 1) % 3) * 2;
      // un poco hacia adentro de la cuadra para que quede banqueta
      const ox = Math.sign(bx) * 4;
      const oz = Math.sign(bz) * 4;
      const color = palette[k % palette.length];
      apartments.push({ x: bx + ox, z: bz + oz, w, d, h, color });
      box(bx + ox, bz + oz, w, d, h, color);
      k++;
    }
  }
  // troncos de los árboles (sólidos)
  for (const [x, z] of TREES) box(x, z, 0.7, 0.7, 2.2, '#a86b3c', { hidden: true });
  return { platforms: P, apartments };
}

export const TREES: [number, number][] = [
  // parque
  [-26, 10], [-26, 26], [-10, 26], [-12, 22], [-24, 18], [-14, 12], [-22, 28],
  // junto a la casa
  [-28, -12], [-27, -27],
  // banquetas
  [6, -27], [30, -10], [-30, 6], [27, 10], [9, 28], [-6, 44], [44, -6], [-44, 8], [10, 46], [46, 26],
  [-46, -28], [28, -46], [-28, 48], [60, 8], [-60, -8], [8, -60], [-8, 60],
];

export const SHOPS: Shop[] = [
  { id: 'house', name: 'Mi casita', emoji: '🏠', spot: [-18, -14.5], sign: { pos: [-18, 5.2, -16.9], rotY: 0, color: '#ff5fa2' } },
  { id: 'icecream', name: 'Heladería', emoji: '🍦', spot: [12.5, -15], sign: { pos: [12.5, 4.6, -17.4], rotY: 0, color: '#3cb7f5' } },
  { id: 'pizza', name: 'Pizzería', emoji: '🍕', spot: [23.5, -15], sign: { pos: [23.5, 4.6, -17.4], rotY: 0, color: '#ff4d4d' } },
  { id: 'balloons', name: 'Globos', emoji: '🎈', spot: [-9.5, 8], sign: { pos: [-9.5, 2.6, 9.4], rotY: Math.PI, color: '#ff7ab6' } },
  { id: 'clothes', name: 'Tienda de ropa', emoji: '👗', spot: [18, 15], sign: { pos: [18, 5.7, 17.9], rotY: Math.PI, color: '#8b5cf6' } },
  { id: 'fountain', name: 'Fuente de los deseos', emoji: '⛲', spot: [-18, 14], sign: { pos: [-18, 3.4, 18], rotY: Math.PI, color: '#2fd39a' } },
];

export const VEHICLES: VehicleSpec[] = [
  { kind: 'car', color: '#ff7ab6', pos: [-9, -6.8], heading: Math.PI / 2 },
  { kind: 'car', color: '#ffd23f', pos: [24, 6.8], heading: -Math.PI / 2 },
  { kind: 'car', color: '#3cb7f5', pos: [-30, 41], heading: 0 },
  { kind: 'moto', color: '#9b6bff', pos: [4, -10], heading: Math.PI / 2 },
  { kind: 'moto', color: '#2fd39a', pos: [-6.8, 22], heading: Math.PI },
];

/** dónde aparece la niña: frente a su casa */
export const CITY_SPAWN: [number, number, number] = [-18, 0, -11];
