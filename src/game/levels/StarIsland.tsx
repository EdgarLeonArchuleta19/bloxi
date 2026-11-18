import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '../../data/items';
import { sfx } from '../../lib/sound';
import { useGame } from '../../store';
import { mat } from '../../three/shapes';
import { Bursts, Cloud, burst } from '../fx';
import type { PlatformSpec } from '../physics';
import { PlayWorld, type LevelHooks, type ThumbShot } from '../PlayWorld';
import { useRun } from '../runStore';
import { Stars, type StarSlot } from './pickups';

export const STAR_TIME = 60;
const SLOTS = 8;
const COLORS = ['#ff9ecb', '#ffcf6b', '#7fd8ff', '#c9b6ff', '#ffb38a', '#9ff0b8'];

function buildIsland() {
  const P: PlatformSpec[] = [];
  const box = (x: number, z: number, w: number, d: number, top: number, color: string, h?: number, extra: Partial<PlatformSpec> = {}) => {
    const hh = h ?? top + 1;
    P.push({ p: [x, top - hh / 2, z], s: [w, hh, d], color, ...extra });
  };
  // suelo
  box(0, 0, 50, 50, -0.3, '#ffe3a3', 1);
  box(0, 0, 46, 46, 0, '#6fd97c', 1);

  // torres de bloques
  const towers: [number, number, number][] = [
    [-10, -8, 2], [12, -10, 3], [-14, 10, 1.5], [7, 13, 2.5], [16, 4, 1.2], [-4, 16, 1.5], [-17, -2, 3.5], [3, -17, 2],
  ];
  towers.forEach(([x, z, h], i) => box(x, z, 3, 3, h, COLORS[i % COLORS.length]));

  // escalera a una plataforma alta
  for (let k = 0; k < 4; k++) box(-15 + k * 2.2, -16, 2.2, 3, 1 + k, COLORS[k % COLORS.length]);
  box(-5.5, -16, 4, 4, 5, '#c9b6ff');

  // árboles (se puede subir a la copa)
  const trees: [number, number][] = [[-6, 5], [10, -2], [-12, -12], [17, 16], [-18, 18], [14, -17]];
  for (const [x, z] of trees) {
    box(x, z, 0.8, 0.8, 2.4, '#a86b3c');
    box(x, z, 3, 3, 4.4, '#3fbf5a', 2);
  }

  // trampolines
  box(0, -7, 2.6, 2.6, 0.5, '', 0.5, { kind: 'bounce' });
  box(-9, 12, 2.6, 2.6, 0.5, '', 0.5, { kind: 'bounce' });
  box(15, 10, 2.6, 2.6, 0.5, '', 0.5, { kind: 'bounce' });
  box(20, -6, 2.6, 2.6, 0.5, '', 0.5, { kind: 'bounce' });

  return P;
}

export function StarIslandLevel({ avatar, thumb }: { avatar: AvatarConfig; thumb?: ThumbShot }) {
  const platforms = useMemo(buildIsland, []);
  const spawn = useMemo(() => new THREE.Vector3(0, 0, 4), []);
  const slots = useMemo<StarSlot[]>(
    () => {
      const list = Array.from({ length: SLOTS }, () => ({ pos: new THREE.Vector3(), active: false, rainbow: false, age: 0 }));
      if (thumb) {
        // estrellas acomodadas para la foto
        const spots: [number, number, number, boolean][] = [[-2.6, 2.2, 8.5, false], [2.8, 2.8, 8, true], [-4.5, 1.6, 4, false], [4.2, 1.5, 3.5, false], [0.5, 3.6, 2, false], [-1, 1.4, -3, false], [7, 3.2, -4, false], [-7, 3.5, -5, false]];
        list.forEach((s, i) => {
          s.pos.set(spots[i][0], spots[i][1], spots[i][2]);
          s.active = true;
          s.rainbow = spots[i][3];
          s.age = 5;
        });
      }
      return list;
    },
    [thumb],
  );
  const timeLeft = useRef(STAR_TIME);
  const lastBeep = useRef(99);

  const placeStar = (slot: StarSlot, player: THREE.Vector3) => {
    for (let tries = 0; tries < 30; tries++) {
      let x: number, z: number;
      const onTop = Math.random() < 0.3;
      if (onTop) {
        const p = platforms[2 + Math.floor(Math.random() * (platforms.length - 2))];
        if (p.kind === 'bounce') continue;
        x = p.p[0];
        z = p.p[2];
      } else {
        x = (Math.random() - 0.5) * 42;
        z = (Math.random() - 0.5) * 42;
      }
      let top = 0;
      for (const p of platforms) {
        if (Math.abs(x - p.p[0]) < p.s[0] / 2 + 0.6 && Math.abs(z - p.p[2]) < p.s[2] / 2 + 0.6) {
          top = Math.max(top, p.p[1] + p.s[1] / 2);
        }
      }
      if (Math.hypot(x - player.x, z - player.z) < 4) continue;
      if (slots.some((s) => s !== slot && s.active && Math.hypot(s.pos.x - x, s.pos.z - z) < 3)) continue;
      slot.pos.set(x, top + 1.2, z);
      slot.active = true;
      slot.rainbow = Math.random() < 0.12;
      slot.age = 0;
      return;
    }
  };

  const hooks = useRef<LevelHooks>({});
  hooks.current = {
    onFall: (e) => {
      sfx.splash();
      useRun.getState().showToast('¡Splash! 💦');
      burst(e.ctrl.pos.clone().setY(-1), '#7fd8ff', 20);
      e.ctrl.reset(spawn, e.ctrl.facing);
    },
    onTick: (e, dt) => {
      const run = useRun.getState();
      for (const s of slots) if (!s.active) placeStar(s, e.ctrl.pos);

      if (run.status !== 'playing') return;
      timeLeft.current = Math.max(0, timeLeft.current - dt);
      if (Math.ceil(timeLeft.current) !== Math.ceil(run.time)) run.set({ time: timeLeft.current });
      const sec = Math.ceil(timeLeft.current);
      if (sec <= 5 && sec > 0 && sec !== lastBeep.current) {
        lastBeep.current = sec;
        sfx.count();
      }

      const c = e.ctrl.pos.clone();
      c.y += 1.1;
      for (const s of slots) {
        if (s.active && s.pos.distanceTo(c) < 1.5) {
          s.active = false;
          const v = s.rainbow ? 3 : 1;
          sfx.star();
          burst(s.pos, s.rainbow ? '#ff5fa2' : '#ffd23f', s.rainbow ? 30 : 14);
          run.addCoins(v);
          run.set({ stars: useRun.getState().stars + v });
          if (s.rainbow) run.showToast('¡Estrella arcoíris! +3 🌈');
        }
      }

      if (timeLeft.current <= 0) {
        const stars = useRun.getState().stars;
        const record = useGame.getState().setBestStars(stars);
        e.anim.cheer = 999;
        sfx.win();
        burst(e.ctrl.pos.clone().setY(e.ctrl.pos.y + 2.5), '#ffd23f', 40);
        run.set({
          status: 'done',
          time: 0,
          result: {
            emoji: '⭐',
            title: '¡Se acabó el tiempo!',
            subtitle: `Atrapaste ${stars} estrella${stars === 1 ? '' : 's'}`,
            coins: useRun.getState().coins,
            record,
          },
        });
      }
    },
  };

  return (
    <>
      <fog attach="fog" args={['#d7eeff', 50, 130]} />
      <PlayWorld platforms={platforms} spawn={spawn} yaw={0} killY={-2.5} avatar={avatar} hooks={hooks} thumb={thumb} />
      <Stars slots={slots} />
      <Bursts />
      <Water />
      <Flowers />
      {CLOUDS.map((c, i) => (
        <Cloud key={i} position={c} scale={2.2} />
      ))}
    </>
  );
}

const CLOUDS: [number, number, number][] = [
  [-30, 16, -30], [30, 18, -25], [-35, 14, 25], [35, 20, 30], [0, 22, -45], [5, 18, 45],
];

function Water() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) ref.current.position.y = -1.1 + Math.sin(s.clock.elapsedTime) * 0.08;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.1, 0]} receiveShadow>
      <planeGeometry args={[400, 400]} />
      <meshLambertMaterial color="#5ccfff" transparent opacity={0.92} />
    </mesh>
  );
}

function Flowers() {
  const list = useMemo(() => {
    const out: { x: number; z: number; c: string }[] = [];
    const cs = ['#ff7ab6', '#ffffff', '#ffcf33', '#b07cff'];
    for (let i = 0; i < 60; i++) {
      out.push({ x: (Math.random() - 0.5) * 44, z: (Math.random() - 0.5) * 44, c: cs[i % cs.length] });
    }
    return out;
  }, []);
  return (
    <>
      {list.map((f, i) => (
        <mesh key={i} material={mat(f.c)} position={[f.x, 0.1, f.z]} scale={[1, 0.5, 1]}>
          <sphereGeometry args={[0.12, 8, 6]} />
        </mesh>
      ))}
    </>
  );
}
