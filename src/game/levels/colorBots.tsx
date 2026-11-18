import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_AVATAR, HAIR_COLORS, ITEMS, SKIN_COLORS, type AvatarConfig, type Category } from '../../data/items';
import { Avatar, makeAnim, type AvatarAnim } from '../../three/Avatar';
import type { Solid } from '../physics';

// 🤖 Jugadores de mentiritas para Piso de Colores (todo pasa en el dispositivo, nadie real)

const NAMES = [
  'LunaStar', 'MateoPro', 'ValeRainbow', 'LeoDino', 'MiaCookie', 'NicoBlox', 'EmmaPanda', 'TomiRocket',
  'AbiUnicorn', 'SantiNinja', 'ZoeGalaxy', 'DaniPizza', 'RegiCandy', 'MaxiShark', 'CamiFlower', 'BrunoBloxi',
];

export interface Bot {
  id: string;
  name: string;
  cfg: AvatarConfig;
  anim: AvatarAnim;
  pos: THREE.Vector3;
  vy: number;
  facing: number;
  skill: number; // 0..1 qué tan buena es
  speed: number;
  goal: THREE.Vector3 | null;
  react: number; // segundos antes de empezar a correr
  falling: boolean;
  out: boolean;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const idsOf = (cat: Category) => ITEMS.filter((i) => i.cat === cat).map((i) => i.id);

export function randomAvatar(): AvatarConfig {
  const outfits = idsOf('outfit').filter((x) => x !== 'none');
  return {
    ...DEFAULT_AVATAR,
    skin: pick(SKIN_COLORS.slice(0, 6)),
    hairColor: pick(HAIR_COLORS),
    outfit: Math.random() < 0.28 ? pick(outfits) : 'none',
    top: pick(idsOf('top')),
    bottom: pick(idsOf('bottom')),
    shoes: pick(idsOf('shoes')),
    face: pick(idsOf('face')),
    hair: pick(idsOf('hair').filter((x) => x !== 'none')),
    hat: Math.random() < 0.45 ? pick(idsOf('hat')) : 'none',
    glasses: Math.random() < 0.25 ? pick(idsOf('glasses')) : 'none',
    back: Math.random() < 0.3 ? pick(idsOf('back')) : 'none',
  };
}

export function makeBots(count: number, spots: THREE.Vector3[], playerName: string): Bot[] {
  const names = NAMES.filter((n) => !n.toLowerCase().startsWith(playerName.toLowerCase().slice(0, 3))).sort(() => Math.random() - 0.5);
  return Array.from({ length: count }, (_, i) => ({
    id: `bot${i}`,
    name: names[i % names.length],
    cfg: randomAvatar(),
    anim: makeAnim(),
    pos: spots[i % spots.length].clone(),
    vy: 0,
    facing: Math.random() * Math.PI * 2,
    skill: 0.72 + Math.random() * 0.24,
    speed: 4.6 + Math.random() * 1.8,
    goal: null,
    react: 0,
    falling: false,
    out: false,
  }));
}

/** Al salir un color nuevo: cada bot decide a dónde correr (y a veces se equivoca 😅) */
export function planBots(bots: Bot[], round: number, target: number, colors: number[], tileCenter: (i: number) => THREE.Vector3) {
  const good = colors.map((c, i) => (c === target ? i : -1)).filter((i) => i >= 0);
  const bad = colors.map((c, i) => (c !== target ? i : -1)).filter((i) => i >= 0);
  for (const b of bots) {
    if (b.out) continue;
    const ok = Math.random() < Math.max(0.35, Math.min(0.97, b.skill - round * 0.028));
    let tile: number;
    if (ok || !bad.length) {
      // el cuadro bueno más cercano
      tile = good.reduce((best, i) => (tileCenter(i).distanceTo(b.pos) < tileCenter(best).distanceTo(b.pos) ? i : best), good[0]);
    } else {
      tile = pick(bad);
    }
    const c = tileCenter(tile);
    b.goal = new THREE.Vector3(c.x + (Math.random() - 0.5) * 2.2, 0, c.z + (Math.random() - 0.5) * 2.2);
    b.react = 0.2 + Math.random() * (ok ? 0.7 : 1.2);
  }
}

/** Mueve a los bots. Regresa los que se acaban de caer al agua. */
export function updateBots(bots: Bot[], dt: number, tileAt: (x: number, z: number) => Solid | null, limit: number): Bot[] {
  const splashed: Bot[] = [];
  for (const b of bots) {
    if (b.out) continue;
    if (b.falling) {
      b.vy -= 30 * dt;
      b.pos.y += b.vy * dt;
      b.anim.grounded = false;
      if (b.pos.y < -5) {
        b.out = true;
        splashed.push(b);
      }
      continue;
    }
    let moving = false;
    if (b.goal) {
      if (b.react > 0) b.react -= dt;
      else {
        const dx = b.goal.x - b.pos.x, dz = b.goal.z - b.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.15) {
          const step = Math.min(d, b.speed * dt);
          b.pos.x += (dx / d) * step;
          b.pos.z += (dz / d) * step;
          const target = Math.atan2(dx, dz);
          let df = target - b.facing;
          df = Math.atan2(Math.sin(df), Math.cos(df));
          b.facing += df * (1 - Math.exp(-12 * dt));
          moving = true;
        } else b.goal = null;
      }
    }
    // a veces brincan de gusto
    if (b.pos.y <= 0 && b.vy <= 0 && Math.random() < dt * (moving ? 0.35 : 0.15)) b.vy = 8.5;
    b.pos.x = Math.max(-limit, Math.min(limit, b.pos.x));
    b.pos.z = Math.max(-limit, Math.min(limit, b.pos.z));
    if (b.pos.y > 0 || b.vy > 0) {
      b.vy -= 30 * dt;
      b.pos.y += b.vy * dt;
    }
    const under = tileAt(b.pos.x, b.pos.z);
    if (b.pos.y <= 0) {
      if (under && under.active) {
        b.pos.y = 0;
        b.vy = 0;
      } else {
        b.falling = true;
      }
    }
    b.anim.speed = moving ? 1 : 0;
    b.anim.grounded = b.pos.y <= 0.01;
  }
  return splashed;
}

/** Revive a todos (al reiniciar) */
export function resetBots(bots: Bot[], spots: THREE.Vector3[]) {
  bots.forEach((b, i) => {
    b.pos.copy(spots[i % spots.length]);
    b.vy = 0;
    b.falling = b.out = false;
    b.goal = null;
  });
}

export function nameTag(name: string) {
  const cv = document.createElement('canvas');
  cv.width = 320;
  cv.height = 80;
  const c = cv.getContext('2d')!;
  c.font = 'bold 40px Fredoka, ui-rounded, system-ui, sans-serif';
  const w = Math.min(310, c.measureText(name).width + 40);
  c.fillStyle = 'rgba(51,38,77,0.72)';
  c.beginPath();
  c.roundRect((320 - w) / 2, 10, w, 60, 30);
  c.fill();
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(name, 160, 42);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  // tamaño fijo en pantalla (no se hace gigante si el bot está cerca)
  return new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true, sizeAttenuation: false });
}

// ⚡ sombrita redonda (mucho más ligera que sombras reales para muchos personajes)
const blobGeo = new THREE.CircleGeometry(0.62, 20);
blobGeo.rotateX(-Math.PI / 2);
const blobMat = new THREE.MeshBasicMaterial({ color: '#33264d', transparent: true, opacity: 0.18, depthWrite: false });
export function BlobShadow() {
  return <mesh geometry={blobGeo} material={blobMat} position={[0, 0.03, 0]} renderOrder={-1} />;
}

/** Los personajes extra no proyectan sombra real (solo la sombrita) */
export function useNoShadows(groups: React.RefObject<(THREE.Object3D | null)[] | THREE.Object3D | null>) {
  useLayoutEffect(() => {
    const g = groups.current;
    const list = Array.isArray(g) ? g : [g];
    list.forEach((o) => o?.traverse((c) => (c.castShadow = false)));
  });
}

export function BotsView({ bots }: { bots: Bot[] }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const tags = useMemo(() => bots.map((b) => nameTag(b.name)), [bots]);
  useNoShadows(refs);
  useFrame(() => {
    bots.forEach((b, i) => {
      const o = refs.current[i];
      if (!o) return;
      o.visible = !b.out;
      o.position.copy(b.pos);
      o.rotation.y = b.facing;
    });
  });
  return (
    <>
      {bots.map((b, i) => (
        <group key={i} ref={(o) => void (refs.current[i] = o)} position={b.pos}>
          <Avatar config={b.cfg} anim={b.anim} />
          <BlobShadow />
          <sprite material={tags[i]} position={[0, 2.95, 0]} scale={[0.15, 0.0375, 1]} />
        </group>
      ))}
    </>
  );
}
