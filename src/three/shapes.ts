import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Cachés para no crear geometrías/materiales repetidos (mejor rendimiento en iPad)
const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();

export function rbox(w: number, h: number, d: number, r = 0.06): THREE.BufferGeometry {
  const k = `rb${w}|${h}|${d}|${r}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
    geoCache.set(k, g);
  }
  return g;
}

export function mat(color: string, opts: { emissive?: number; rough?: number; metal?: number; opacity?: number } = {}) {
  const k = `${color}|${opts.emissive ?? 0}|${opts.rough ?? 0.65}|${opts.metal ?? 0}|${opts.opacity ?? 1}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.65,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ? new THREE.Color(color) : new THREE.Color(0x000000),
      emissiveIntensity: opts.emissive ?? 0,
      transparent: (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
      side: THREE.DoubleSide,
    });
    matCache.set(k, m);
  }
  return m;
}

function cached(k: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(k);
  if (!g) {
    g = make();
    geoCache.set(k, g);
  }
  return g;
}

const extrude = (shape: THREE.Shape, depth = 0.05) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });

export const heartGeo = () =>
  cached('heart', () => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(-0.15, -0.3, -0.55, -0.1, -0.5, 0.2);
    s.bezierCurveTo(-0.45, 0.5, -0.1, 0.55, 0, 0.25);
    s.bezierCurveTo(0.1, 0.55, 0.45, 0.5, 0.5, 0.2);
    s.bezierCurveTo(0.55, -0.1, 0.15, -0.3, 0, -0.5);
    const g = extrude(s, 0.08);
    g.center();
    return g;
  });

export function starShape(outer = 0.5, inner = 0.22, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export const starGeo = () =>
  cached('star', () => {
    const g = new THREE.ExtrudeGeometry(starShape(), {
      depth: 0.16, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2,
    });
    g.center();
    return g;
  });

const poly = (pts: [number, number][]) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
};

export const angelWingGeo = () =>
  cached('angel', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.2, 0.45, 0.7, 0.7, 1.05, 0.55);
    s.lineTo(0.9, 0.35);
    s.lineTo(1.0, 0.2);
    s.lineTo(0.8, 0.05);
    s.lineTo(0.85, -0.12);
    s.lineTo(0.6, -0.2);
    s.lineTo(0.6, -0.38);
    s.bezierCurveTo(0.35, -0.35, 0.1, -0.2, 0, 0);
    return extrude(s, 0.04);
  });

export const dragonWingGeo = () =>
  cached('dragon', () =>
    extrude(
      poly([[0, 0], [0.35, 0.5], [1.15, 0.65], [1.0, 0.3], [0.85, 0.35], [0.75, 0.0], [0.6, 0.1], [0.5, -0.2], [0.3, -0.08]]),
      0.03,
    ),
  );

export const butterflyUpperGeo = () =>
  cached('bfu', () => {
    const s = new THREE.Shape();
    s.absellipse(0.42, 0.22, 0.42, 0.32, 0, Math.PI * 2, false, 0.3);
    return extrude(s, 0.03);
  });
export const butterflyLowerGeo = () =>
  cached('bfl', () => {
    const s = new THREE.Shape();
    s.absellipse(0.28, -0.22, 0.26, 0.22, 0, Math.PI * 2, false, -0.4);
    return extrude(s, 0.03);
  });
