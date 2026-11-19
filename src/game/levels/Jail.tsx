import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOY_AVATAR, DEFAULT_AVATAR, type AvatarConfig } from '../../data/items';
import { sfx } from '../../lib/sound';
import { Avatar, makeAnim, type AvatarAnim } from '../../three/Avatar';
import { mat } from '../../three/shapes';
import { Bursts, Cloud, burst } from '../fx';
import type { PlatformSpec } from '../physics';
import { PlayWorld, type Engine, type LevelHooks, type ThumbShot } from '../PlayWorld';
import { useRun } from '../runStore';
import { bubbleMat } from './City';
import { signMat } from './cityModels';
import { nameTag } from './colorBots';
import { Coins, type CoinData } from './pickups';

// 🚔 Escapa de la Cárcel: llave → tarjeta (sin que te vean los guardias) → patio con reflectores → ¡al globo!

export const JAIL_STEPS = 4;
const FINISH_BONUS = 20;
const GOALS = [
  '🔑 Busca la llave de tu celda',
  '💳 Toma la tarjeta de la oficina ¡sin que te vean!',
  '🔦 Cruza el patio sin que te alumbren y trepa el muro',
  '🎈 ¡Corre al globo para escapar!',
];
const CHECKPOINTS: [number, number, number][] = [
  [0, 0, -4],
  [0, 0, 7],
  [0, 0, 43.5],
  [0, 0, 87],
];
const KEY_POS = new THREE.Vector3(3, 2.55, -7.3);
const CARD_POS = new THREE.Vector3(11, 1.35, 36);
const BALLOON = new THREE.Vector3(0, 0, 104);
const VIEW = 7.5; // qué tan lejos ven los guardias
const VIEW_ANG = 0.55; // medio ángulo de la linterna
const LIGHT_R = 3;

/* ---------- El mapa ---------- */
function buildJail() {
  const P: PlatformSpec[] = [];
  const add = (x: number, y: number, z: number, w: number, h: number, d: number, color: string, hidden = false) => {
    P.push({ p: [x, y, z], s: [w, h, d], color, hidden });
    return P.length - 1;
  };
  const W = '#c6cde3', CELL = '#aab3cf', YARD = '#d9b48f', CRATE = '#c98a4b';
  // pisos (se dibujan aparte)
  add(0, -0.5, 16, 30, 1, 48, '#e7e1f2', true);
  add(0, -0.5, 61, 40, 1, 42, '#8fd98f', true);
  add(0, -0.5, 98.5, 60, 1, 33, '#86df8c', true);
  // paredes de adentro
  add(0, 2.5, -8.5, 31, 5, 1, W);
  add(-15.5, 2.5, 16, 1, 5, 50, W);
  add(15.5, 2.5, 16, 1, 5, 50, W);
  add(-4.75, 2.5, -3, 0.5, 5, 10, CELL);
  add(4.75, 2.5, -3, 0.5, 5, 10, CELL);
  // rejas (se ven a través: no tapan a los guardias)
  const bars = [
    add(-9.75, 2.5, 2, 10, 5, 0.3, '#5d6173', true),
    add(9.75, 2.5, 2, 10, 5, 0.3, '#5d6173', true),
    add(-2.85, 2.5, 2, 3.3, 5, 0.3, '#5d6173', true),
    add(2.85, 2.5, 2, 3.3, 5, 0.3, '#5d6173', true),
  ];
  const door = add(0, 2.5, 2, 2.4, 5, 0.3, '#5d6173', true);
  // pared entre las celdas y el pasillo de guardias
  const walls = [add(-8.75, 2.5, 12, 12.5, 5, 1, W), add(8.75, 2.5, 12, 12.5, 5, 1, W)];
  // pared con la puerta al patio
  add(-11.25, 3.25, 40, 17.5, 6.5, 1, YARD);
  add(11.25, 3.25, 40, 17.5, 6.5, 1, YARD);
  const gate = add(0, 2.5, 40, 5, 5, 0.6, '#ffd23f', true);
  // muros del patio
  add(-20.5, 3.25, 61, 1, 6.5, 42, YARD);
  add(20.5, 3.25, 61, 1, 6.5, 42, YARD);
  add(0, 3, 81.5, 42, 6, 1, YARD);
  // cerca de afuera
  add(-30.5, 1, 98.5, 1, 2, 34, '#ffffff');
  add(30.5, 1, 98.5, 1, 2, 34, '#ffffff');
  add(0, 1, 115.5, 62, 2, 1, '#ffffff');
  // tu celda: cama, mueble (la llave está arriba) y escusado
  add(0.4, 0.35, -6.4, 2.4, 0.7, 3.2, '#ff9ecb');
  add(3, 1, -7.3, 2.4, 2, 1.2, '#a86b3c');
  add(3.2, 0.4, -3.4, 0.9, 0.8, 0.9, '#ffffff');
  // celdas vecinas
  add(-9.75, 0.35, -6.2, 2.4, 0.7, 3.4, '#7fd8ff');
  add(9.75, 0.35, -6.2, 2.4, 0.7, 3.4, '#7fe0b4');
  // cajas para esconderse de los guardias
  const crates: number[] = [...walls];
  for (const [x, z] of [[-9, 16], [-3, 22.5], [5, 17.5], [10, 25], [-11, 27], [-2.5, 30.5], [3.5, 34], [-7.5, 36], [7, 31]])
    crates.push(add(x, 0.7, z, 1.8, 1.4, 1.8, CRATE));
  // escritorio de la oficina
  crates.push(add(11, 0.5, 36, 3, 1, 1.6, '#8b6cf0'));
  // patio: cajas para trepar el muro
  [1.2, 2.4, 3.6, 4.8].forEach((top, i) => add(5 + i * 2.4, top / 2, 79.75, 2.4, top, 2.5, ['#ff9ecb', '#ffd23f', '#7fd8ff', '#7fe0b4'][i]));
  // canasta del globo
  add(BALLOON.x, 0.6, BALLOON.z, 2.6, 1.2, 2.6, '#c98a4b', true);
  return { P, bars, door, gate, crates };
}

interface Guard {
  a: THREE.Vector2;
  b: THREE.Vector2;
  pos: THREE.Vector3;
  facing: number;
  dir: 1 | -1;
  speed: number;
  wait: number;
  anim: AvatarAnim;
  bubble: string | null;
  bubbleT: number;
}

const GUARD_CFG: AvatarConfig = { ...BOY_AVATAR, top: 'tee-bolt', bottom: 'pants-sport', hat: 'cap', glasses: 'sun', hair: 'short' };
const BUDDY_CFG: AvatarConfig[] = [
  { ...DEFAULT_AVATAR, top: 'tee-sailor', bottom: 'pants-stripes', hair: 'pigtails' },
  { ...BOY_AVATAR, top: 'tee-sailor', bottom: 'jeans', hat: 'cap' },
];

/** ¿Cruza el segmento (a→b) alguna caja? (vista de arriba) */
function segHitsBox(ax: number, az: number, bx: number, bz: number, min: THREE.Vector3, max: THREE.Vector3) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, min.x, max.x], [az, dz, min.z, max.z]]) {
    if (Math.abs(d) < 1e-6) {
      if (p < lo || p > hi) return false;
      continue;
    }
    let u0 = (lo - p) / d, u1 = (hi - p) / d;
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0);
    t1 = Math.min(t1, u1);
    if (t0 > t1) return false;
  }
  return true;
}

const lightPos = (i: number, t: number, out: THREE.Vector3) => {
  const L = [
    { cz: 52, ax: 15, az: 3, sp: 0.55, ph: 0 },
    { cz: 63, ax: 15, az: 3, sp: 0.7, ph: 2 },
    { cz: 73, ax: 13, az: 2, sp: 0.5, ph: 4 },
  ][i];
  return out.set(Math.sin(t * L.sp + L.ph) * L.ax, 0, L.cz + Math.sin(t * L.sp * 1.7 + L.ph) * L.az);
};

export function JailLevel({ avatar, thumb }: { avatar: AvatarConfig; thumb?: ThumbShot }) {
  const world = useMemo(buildJail, []);
  const engine = useRef<Engine | null>(null);
  const spawn = useMemo(() => new THREE.Vector3(...CHECKPOINTS[0]), []);
  const g = useRef({ step: 0, hasKey: false, hasCard: false, doorOpen: 0, gateOpen: 0, caughtT: 0, goalT: 0, time: 0, t: 0, winT: 0, balloonY: 0 });

  const guards = useMemo<Guard[]>(
    () =>
      [
        [-12, 19.5, 12, 19.5, 2.6],
        [12, 28.5, -12, 28.5, 2.4],
        [13, 33, 13, 38.5, 1.4],
      ].map(([ax, az, bx, bz, speed], i): Guard => ({
        a: new THREE.Vector2(ax, az),
        b: new THREE.Vector2(bx, bz),
        pos: new THREE.Vector3(i === 1 ? 0 : ax, 0, az),
        facing: 0,
        dir: 1,
        speed,
        wait: 0,
        anim: makeAnim(),
        bubble: null,
        bubbleT: 0,
      })).map((gd, i) => {
        // 📸 portada: los guardias alumbrando con su linterna
        if (thumb) gd.facing = [Math.PI / 2, -Math.PI / 2, Math.PI][i];
        return gd;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const buddies = useMemo(() => BUDDY_CFG.map((cfg, i) => ({ cfg, anim: makeAnim(), pos: new THREE.Vector3(i ? 9.75 : -9.75, 0, -1.5), bubble: '' as string | null })), []);

  const coins = useMemo<CoinData[]>(
    () =>
      [
        [0.4, 1.6, -6.4], [0, 1, -1], [-6, 1, 7], [6, 1, 7], [0, 1, 10],
        [-9, 2.3, 16], [-12, 1, 22], [10, 2.3, 25], [0, 1, 26], [-11, 2.3, 27], [7, 2.3, 31], [-7.5, 2.3, 36],
        [-10, 1, 50], [10, 1, 58], [-6, 1, 68], [9.8, 4.6, 79.75], [12.2, 5.8, 79.75],
        [0, 1, 92], [-4, 1, 97], [4, 1, 97],
      ].map(([x, y, z]) => ({ pos: new THREE.Vector3(x, y, z), taken: false, t: 0 })),
    [],
  );

  const blockers = useMemo(() => world.crates, [world]);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__jail = { g, engine, guards, lightPos };

  const setGoal = (step: number) => {
    const run = useRun.getState();
    run.set({ checkpoint: step + 1, banner: { name: '', color: '#33264d', text: GOALS[step] }, bar: 0 });
    g.current.goalT = 4;
  };

  useLayoutEffect(() => {
    if (thumb) return;
    useRun.getState().set({ checkpoint: 1, time: 0 });
  }, [thumb]);

  const say = (who: Guard, text: string, t = 2.5) => {
    who.bubble = text;
    who.bubbleT = t;
  };

  const caught = (e: Engine, by: string, guard?: Guard) => {
    const s = g.current;
    s.caughtT = 2;
    sfx.alarm();
    if (guard) {
      guard.facing = Math.atan2(e.ctrl.pos.x - guard.pos.x, e.ctrl.pos.z - guard.pos.z);
      guard.wait = 1.5;
      say(guard, '¡Alto ahí! 👮', 2);
    }
    useRun.getState().showToast(`🚨 ¡${by}! Regresas e intentas otra vez`);
    const c = CHECKPOINTS[s.step];
    e.ctrl.reset(new THREE.Vector3(...c), 0);
    setGoal(s.step);
  };

  const finish = (e: Engine) => {
    const s = g.current;
    s.winT = 0.001;
    sfx.win();
    burst(BALLOON.clone().setY(3), '#ff7ab6', 50);
    e.anim.cheer = 999;
    useRun.getState().set({ banner: { name: '', color: '#ff5fa2', text: '🎈 ¡Adiós cárcel! ¡Eres libre!' }, bar: 0 });
  };

  const report = () => {
    const s = g.current;
    const run = useRun.getState();
    run.addCoins(FINISH_BONUS);
    const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
    run.set({
      status: 'done',
      banner: null,
      result: {
        emoji: '🎈',
        title: '¡Escapaste de la cárcel!',
        subtitle: `Tiempo: ${m}:${String(sec).padStart(2, '0')}  •  +${FINISH_BONUS} de premio`,
        coins: useRun.getState().coins,
        record: false,
      },
    });
  };

  const hooks = useRef<LevelHooks>({});
  hooks.current = {
    control: (e, dt) => {
      // 🎈 ¡a volar! la niña se va en el globo
      const s = g.current;
      if (s.winT <= 0) return false;
      s.winT += dt;
      s.balloonY = Math.min(40, s.winT * s.winT * 0.6);
      e.ctrl.pos.set(BALLOON.x, 1.2 + s.balloonY, BALLOON.z);
      e.ctrl.vel.set(0, 0, 0);
      e.cam.dist = 13;
      if (s.winT > 3 && useRun.getState().status === 'playing') report();
      return true;
    },
    onFall: (e) => e.ctrl.reset(new THREE.Vector3(...CHECKPOINTS[g.current.step]), 0),
    onTick: (e, dt) => {
      const s = g.current;
      const run = useRun.getState();
      s.t += dt;
      if (thumb || run.status !== 'playing' || s.winT > 0) return;
      s.time += dt;
      if (Math.floor(s.time * 10) !== Math.floor(run.time * 10)) run.set({ time: s.time });
      if (s.goalT === 0 && s.time > 0.3) setGoal(0);
      if (s.goalT > 0) {
        s.goalT -= dt;
        if (s.goalT <= 0) {
          s.goalT = -1;
          run.set({ banner: null });
        }
      }
      if (s.caughtT > 0) s.caughtT -= dt;
      const p = e.ctrl.pos;

      // 🔑 la llave
      if (!s.hasKey && p.distanceTo(KEY_POS) < 1.6) {
        s.hasKey = true;
        sfx.star();
        burst(KEY_POS, '#ffd23f', 20);
        run.showToast('🔑 ¡Tienes la llave! Abre la reja');
      }
      // 🚪 abrir la reja con la llave
      if (s.hasKey && s.step === 0 && Math.abs(p.x) < 2 && Math.abs(p.z - 2) < 2) {
        e.solids[world.door].active = false;
        s.step = 1;
        sfx.checkpoint();
        setGoal(1);
        buddies.forEach((b) => {
          b.anim.cheer = 2;
          b.bubble = '¡Corre, corre! 🏃';
        });
      }
      // 💳 la tarjeta
      if (!s.hasCard && p.distanceTo(CARD_POS) < 1.8) {
        s.hasCard = true;
        sfx.star();
        burst(CARD_POS, '#3cb7f5', 20);
        run.showToast('💳 ¡Tienes la tarjeta! Ve a la puerta amarilla');
      }
      if (s.hasCard && s.step === 1 && Math.abs(p.x) < 3 && Math.abs(p.z - 40) < 2.5) {
        e.solids[world.gate].active = false;
        s.step = 2;
        sfx.checkpoint();
        setGoal(2);
      }
      if (s.step === 1 && !s.hasCard && Math.abs(p.x) < 3 && Math.abs(p.z - 40) < 2) {
        if (!run.toast) run.showToast('🔒 Necesitas la tarjeta de la oficina 💳');
      }
      if (s.step === 2 && p.z > 83) {
        s.step = 3;
        sfx.checkpoint();
        setGoal(3);
      }
      if (s.step === 3 && Math.hypot(p.x - BALLOON.x, p.z - BALLOON.z) < 2.4) {
        finish(e);
        return;
      }
      s.doorOpen = Math.min(1, s.doorOpen + (s.step >= 1 ? dt * 1.5 : 0));
      s.gateOpen = Math.min(1, s.gateOpen + (s.step >= 2 ? dt * 1.2 : 0));

      // 👮 guardias
      for (const gd of guards) {
        if (gd.bubbleT > 0) {
          gd.bubbleT -= dt;
          if (gd.bubbleT <= 0) gd.bubble = null;
        }
        const to = gd.dir === 1 ? gd.b : gd.a;
        const dx = to.x - gd.pos.x, dz = to.y - gd.pos.z;
        const d = Math.hypot(dx, dz);
        if (gd.wait > 0) {
          gd.wait -= dt;
          gd.anim.speed = 0;
          gd.facing += Math.sin(s.t * 2.2) * dt * 1.4; // mira para todos lados
        } else if (d < 0.2) {
          gd.dir = gd.dir === 1 ? -1 : 1;
          gd.wait = 1.6;
        } else {
          const step = Math.min(d, gd.speed * dt);
          gd.pos.x += (dx / d) * step;
          gd.pos.z += (dz / d) * step;
          let df = Math.atan2(dx, dz) - gd.facing;
          df = Math.atan2(Math.sin(df), Math.cos(df));
          gd.facing += df * (1 - Math.exp(-6 * dt));
          gd.anim.speed = 0.45;
        }
        gd.anim.grounded = true;
        if (s.caughtT > 0 || s.step !== 1) continue;
        // ¿te ve?
        const px = p.x - gd.pos.x, pz = p.z - gd.pos.z;
        const pd = Math.hypot(px, pz);
        if (pd > VIEW || pd < 0.01) continue;
        let da = Math.atan2(px, pz) - gd.facing;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > VIEW_ANG && pd > 1.4) continue;
        let hidden = false;
        if (p.y < 1)
          for (const bi of blockers) {
            const b = e.solids[bi];
            if (segHitsBox(gd.pos.x, gd.pos.z, p.x, p.z, b.min, b.max)) {
              hidden = true;
              break;
            }
          }
        if (!hidden) caught(e, 'Te vio el guardia', gd);
      }
      // 🔦 reflectores del patio
      if (s.step === 2 && s.caughtT <= 0 && p.y < 2) {
        for (let i = 0; i < 3; i++) {
          const L = lightPos(i, s.t, tmpL);
          if (Math.hypot(p.x - L.x, p.z - L.z) < LIGHT_R) {
            caught(e, 'Te alumbró el reflector');
            break;
          }
        }
      }
      // 🪙 monedas
      coins.forEach((c) => {
        if (!c.taken && c.pos.distanceTo(tmpC.copy(p).setY(p.y + 1)) < 1.3) {
          c.taken = true;
          sfx.coin();
          run.addCoins(1);
        }
      });
      // compañeros de celda
      buddies.forEach((b) => {
        if (s.step === 0) b.bubble = p.distanceTo(b.pos) < 9 ? (b.pos.x < 0 ? '¡La llave está arriba del mueble! 🔑' : '¡Súbete a la cama y brinca! 🦘') : null;
        else if (p.z > 12) b.bubble = null;
      });
    },
  };

  const shot = thumb;
  return (
    <>
      <fog attach="fog" args={['#d7eeff', 55, 170]} />
      <PlayWorld
        platforms={world.P}
        spawn={spawn}
        yaw={0}
        killY={-10}
        avatar={avatar}
        hooks={hooks}
        thumb={shot}
        onEngine={(e) => (engine.current = e)}
        camCollide
      />
      <Floors />
      <BarWall x0={-14.75} x1={-4.75} z={2} />
      <BarWall x0={4.75} x1={14.75} z={2} />
      <BarWall x0={-4.5} x1={-1.2} z={2} />
      <BarWall x0={1.2} x1={4.5} z={2} />
      <DoorView g={g} />
      <GateView g={g} />
      <PickupView pos={KEY_POS} emoji="🔑" taken={() => g.current.hasKey} />
      <PickupView pos={CARD_POS} emoji="💳" taken={() => g.current.hasCard} />
      {guards.map((gd, i) => (
        <GuardView key={i} guard={gd} />
      ))}
      {buddies.map((b, i) => (
        <BuddyView key={i} buddy={b} />
      ))}
      <Searchlights g={g} />
      <Towers />
      <BalloonView g={g} />
      <Signs />
      <Coins coins={coins} />
      <Bursts />
      {[[-50, 24, 20, 3], [50, 26, 60, 2.6], [-40, 22, 110, 2.8], [40, 28, 120, 3], [0, 30, -40, 3.5]].map(([x, y, z, sc], i) => (
        <Cloud key={i} position={[x, y, z]} scale={sc} />
      ))}
    </>
  );
}
const tmpL = new THREE.Vector3();
const tmpC = new THREE.Vector3();

type G = React.RefObject<{ doorOpen: number; gateOpen: number; t: number; winT: number; balloonY: number }>;

/* ---------- Dibujos ---------- */
function Floors() {
  const tiles = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#e7e1f2';
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#d8d0ea';
    c.fillRect(0, 0, 64, 64);
    c.fillRect(64, 64, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(15, 24);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 16]}>
        <planeGeometry args={[30, 48]} />
        <meshStandardMaterial map={tiles} roughness={0.8} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 61]} material={mat('#8fd98f')}>
        <planeGeometry args={[40, 42]} />
      </mesh>
      {/* caminito de tierra */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 61]} material={mat('#e8c58e')}>
        <planeGeometry args={[4, 42]} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 98.5]} material={mat('#86df8c')}>
        <planeGeometry args={[60, 33]} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 95]} material={mat('#e8c58e')}>
        <planeGeometry args={[4, 18]} />
      </mesh>
      {/* pasto de alrededor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 50]} material={mat('#7fd47f')}>
        <planeGeometry args={[260, 260]} />
      </mesh>
    </>
  );
}

const barMat = mat('#5d6173', { metal: 0.5, rough: 0.35 });
const barGeo = new THREE.CylinderGeometry(0.07, 0.07, 5, 8);
function BarWall({ x0, x1, z }: { x0: number; x1: number; z: number }) {
  const n = Math.max(2, Math.round((x1 - x0) / 0.45));
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} geometry={barGeo} material={barMat} position={[x0 + ((i + 0.5) * (x1 - x0)) / n, 2.5, z]} />
      ))}
      {[0.15, 4.85].map((y) => (
        <mesh key={y} material={barMat} position={[(x0 + x1) / 2, y, z]}>
          <boxGeometry args={[x1 - x0, 0.25, 0.25]} />
        </mesh>
      ))}
    </group>
  );
}

function DoorView({ g }: { g: G }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.x = g.current.doorOpen * 2.3;
  });
  return (
    <group ref={ref}>
      <BarWall x0={-1.2} x1={1.2} z={2.15} />
      <mesh position={[0.9, 2.4, 2.3]} material={mat('#ffd23f', { metal: 0.4 })}>
        <boxGeometry args={[0.35, 0.5, 0.15]} />
      </mesh>
    </group>
  );
}

function GateView({ g }: { g: G }) {
  const ref = useRef<THREE.Group>(null);
  const tex = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#ffd23f';
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#33264d';
    for (let k = -128; k < 256; k += 40) {
      c.beginPath();
      c.moveTo(k, 0);
      c.lineTo(k + 20, 0);
      c.lineTo(k + 148, 128);
      c.lineTo(k + 128, 128);
      c.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useFrame(() => {
    if (ref.current) ref.current.position.y = 2.5 + g.current.gateOpen * 4.6;
  });
  return (
    <group ref={ref} position={[0, 2.5, 40]}>
      <mesh castShadow>
        <boxGeometry args={[5, 5, 0.6]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      {/* lector de tarjeta */}
      <mesh position={[3.2, -0.8, -0.6]} material={mat('#3cb7f5', { emissive: 0.5 })}>
        <boxGeometry args={[0.5, 0.7, 0.2]} />
      </mesh>
    </group>
  );
}

const emojiCache = new Map<string, THREE.SpriteMaterial>();
function emojiMat(e: string) {
  let m = emojiCache.get(e);
  if (!m) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d')!;
    c.font = '96px serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(e, 64, 72);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.SpriteMaterial({ map: t, depthWrite: false });
    emojiCache.set(e, m);
  }
  return m;
}

function PickupView({ pos, emoji, taken }: { pos: THREE.Vector3; emoji: string; taken: () => boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    const o = ref.current;
    if (!o) return;
    o.visible = !taken();
    o.position.set(pos.x, pos.y + Math.sin(s.clock.elapsedTime * 3) * 0.15, pos.z);
  });
  return (
    <group ref={ref}>
      <sprite material={emojiMat(emoji)} scale={[1.2, 1.2, 1]} />
      <mesh material={mat('#fff6b3', { emissive: 0.8, opacity: 0.35 })}>
        <sphereGeometry args={[0.75, 16, 12]} />
      </mesh>
    </group>
  );
}

const coneGeo = (() => {
  const geo = new THREE.CircleGeometry(VIEW, 20, -Math.PI / 2 - VIEW_ANG, VIEW_ANG * 2);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();
const coneMat = new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.45, depthWrite: false });

function GuardView({ guard }: { guard: Guard }) {
  const ref = useRef<THREE.Group>(null);
  const bubble = useRef<THREE.Sprite>(null);
  const tag = useMemo(() => nameTag('👮 Guardia'), []);
  useFrame(() => {
    const o = ref.current;
    if (!o) return;
    o.position.copy(guard.pos);
    o.rotation.y = guard.facing;
    if (bubble.current) {
      bubble.current.visible = !!guard.bubble;
      if (guard.bubble) bubble.current.material = bubbleMat(guard.bubble);
    }
  });
  return (
    <group ref={ref}>
      <Avatar config={GUARD_CFG} anim={guard.anim} />
      <mesh geometry={coneGeo} material={coneMat} position={[0, 0.06, 0]} />
      {/* linterna */}
      <mesh position={[0.45, 1.2, 0.45]} rotation={[Math.PI / 2, 0, 0]} material={mat('#ffd23f', { emissive: 0.8 })}>
        <cylinderGeometry args={[0.12, 0.08, 0.45, 10]} />
      </mesh>
      <sprite material={tag} position={[0, 2.95, 0]} scale={[0.15, 0.0375, 1]} />
      <sprite ref={bubble} position={[0, 3.55, 0]} scale={[0.28, 0.066, 1]} visible={false} />
    </group>
  );
}

function BuddyView({ buddy }: { buddy: { cfg: AvatarConfig; anim: AvatarAnim; pos: THREE.Vector3; bubble: string | null } }) {
  const bubble = useRef<THREE.Sprite>(null);
  useFrame((s) => {
    if (!buddy.anim.cheer && Math.sin(s.clock.elapsedTime * 0.8 + buddy.pos.x) > 0.97) buddy.anim.wave = 1.2;
    if (bubble.current) {
      bubble.current.visible = !!buddy.bubble;
      if (buddy.bubble) bubble.current.material = bubbleMat(buddy.bubble);
    }
  });
  return (
    <group position={buddy.pos}>
      <Avatar config={buddy.cfg} anim={buddy.anim} />
      <sprite ref={bubble} position={[0, 3.3, 0]} scale={[0.28, 0.066, 1]} visible={false} />
    </group>
  );
}

const beamMat = new THREE.MeshBasicMaterial({ color: '#fff6b3', transparent: true, opacity: 0.16, depthWrite: false });
const spotMat = new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.55, depthWrite: false });
const spotGeo = (() => {
  const geo = new THREE.CircleGeometry(LIGHT_R, 28);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();
function Searchlights({ g }: { g: G }) {
  const spots = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    spots.current.forEach((o, i) => {
      if (!o) return;
      lightPos(i, g.current.t, o.position);
    });
  });
  return (
    <>
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(o) => void (spots.current[i] = o)}>
          <mesh geometry={spotGeo} material={spotMat} position={[0, 0.05, 0]} />
          <mesh material={beamMat} position={[0, 8, 0]}>
            <cylinderGeometry args={[0.5, LIGHT_R, 16, 20, 1, true]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Towers() {
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 18.5, 0, 42.5]}>
          {[-1, 1].flatMap((a) =>
            [-1, 1].map((b) => (
              <mesh key={`${a}${b}`} castShadow material={mat('#a86b3c')} position={[a * 1.1, 4.5, b * 1.1]}>
                <boxGeometry args={[0.3, 9, 0.3]} />
              </mesh>
            )),
          )}
          <mesh castShadow material={mat('#c6cde3')} position={[0, 9.4, 0]}>
            <boxGeometry args={[3.2, 1.6, 3.2]} />
          </mesh>
          <mesh castShadow material={mat('#ff5fa2')} position={[0, 10.8, 0]}>
            <coneGeometry args={[2.6, 1.4, 4]} />
          </mesh>
          <mesh material={mat('#fff27a', { emissive: 1 })} position={[-s * 1.65, 9.4, 0.8]}>
            <sphereGeometry args={[0.4, 12, 10]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function BalloonView({ g }: { g: G }) {
  const ref = useRef<THREE.Group>(null);
  const stripes = ['#ff5fa2', '#ffd23f', '#3cb7f5', '#2fd39a', '#b07cff', '#ff9a3c'];
  useFrame((s) => {
    const o = ref.current;
    if (!o) return;
    o.position.y = g.current.balloonY + Math.sin(s.clock.elapsedTime * 1.4) * 0.15;
  });
  return (
    <group ref={ref} position={[BALLOON.x, 0, BALLOON.z]}>
      <group position={[0, 7, 0]}>
        {stripes.map((c, i) => (
          <mesh key={c} castShadow material={mat(c)}>
            <sphereGeometry args={[3.3, 24, 18, (i / stripes.length) * Math.PI * 2, (Math.PI * 2) / stripes.length]} />
          </mesh>
        ))}
        <mesh material={mat('#ff5fa2')} position={[0, -3.2, 0]}>
          <cylinderGeometry args={[1.2, 0.8, 1.1, 16]} />
        </mesh>
      </group>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
        <mesh key={i} material={mat('#8a6a4a')} position={[x * 1.05, 2.6, z * 1.05]}>
          <cylinderGeometry args={[0.05, 0.05, 2.9, 6]} />
        </mesh>
      ))}
      {/* canasta que sube con el globo (la de la física se queda abajo) */}
      <mesh castShadow material={mat('#c98a4b')} position={[0, 0.6, 0]}>
        <boxGeometry args={[2.62, 1.22, 2.62]} />
      </mesh>
    </group>
  );
}

function Signs() {
  return (
    <>
      <mesh position={[0, 4.2, -7.95]} material={signMat('🚔 Cárcel Bloxi', '#3cb7f5')}>
        <planeGeometry args={[7, 1.1]} />
      </mesh>
      <mesh position={[-6, 3.6, 11.45]} rotation={[0, Math.PI, 0]} material={signMat('👮 Solo guardias', '#ff5fa2')}>
        <planeGeometry args={[5, 0.9]} />
      </mesh>
      <mesh position={[11, 3, 39.45]} rotation={[0, Math.PI, 0]} material={signMat('🏢 Oficina', '#8b6cf0')}>
        <planeGeometry args={[4, 0.8]} />
      </mesh>
      <mesh position={[0, 5.6, 39.45]} rotation={[0, Math.PI, 0]} material={signMat('🔦 Patio', '#ff9a3c')}>
        <planeGeometry args={[4, 0.8]} />
      </mesh>
      <mesh position={[0, 4.6, 80.95]} rotation={[0, Math.PI, 0]} material={signMat('🎈 ¡Libertad por aquí!', '#2fd39a')}>
        <planeGeometry args={[7, 1.1]} />
      </mesh>
    </>
  );
}
