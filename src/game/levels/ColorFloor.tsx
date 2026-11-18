import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '../../data/items';
import { sfx } from '../../lib/sound';
import { useGame } from '../../store';
import { mat, rbox } from '../../three/shapes';
import { Bursts, Cloud, burst } from '../fx';
import type { PlatformSpec, Solid } from '../physics';
import { PlayWorld, type Engine, type LevelHooks, type ThumbShot } from '../PlayWorld';
import { useRun } from '../runStore';
import { BotsView, makeBots, planBots, updateBots } from './colorBots';

// 🎨 Piso de Colores: sale un color y tienes que pararte en él antes de que los demás cuadros se caigan.

export const COLOR_ROUNDS = 15;
export const BOT_COUNT = 7;
const PLACE_BONUS = [10, 6, 4];
const COLORS = [
  { name: 'ROSA', hex: '#ff5fa2' },
  { name: 'AMARILLO', hex: '#ffd23f' },
  { name: 'AZUL', hex: '#3cb7f5' },
  { name: 'VERDE', hex: '#2fd39a' },
  { name: 'MORADO', hex: '#9b6bff' },
  { name: 'NARANJA', hex: '#ff8a2a' },
];
const N = 5;
const TILE = 4;
const STEP = TILE + 0.35;
const HALF_GRID = (N * STEP) / 2;

function buildFloor(): PlatformSpec[] {
  const P: PlatformSpec[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) P.push({ p: [(c - 2) * STEP, -0.5, (r - 2) * STEP], s: [TILE, 1, TILE], color: '#ffffff', hidden: true });
  // barandal invisible para no caerse por la orilla
  const w = HALF_GRID + 0.5;
  P.push({ p: [0, 1, w], s: [w * 2 + 1, 4, 1], color: '#fff', hidden: true });
  P.push({ p: [0, 1, -w], s: [w * 2 + 1, 4, 1], color: '#fff', hidden: true });
  P.push({ p: [w, 1, 0], s: [1, 4, w * 2 + 1], color: '#fff', hidden: true });
  P.push({ p: [-w, 1, 0], s: [1, 4, w * 2 + 1], color: '#fff', hidden: true });
  return P;
}

type Phase = 'wait' | 'show' | 'drop' | 'rest' | 'over';

export function ColorFloorLevel({ avatar, thumb }: { avatar: AvatarConfig; thumb?: ThumbShot }) {
  const platforms = useMemo(buildFloor, []);
  const spawn = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const engine = useRef<Engine | null>(null);
  const colors = useRef<number[]>(Array.from({ length: N * N }, (_, i) => (i * 7 + 3) % 4));
  const g = useRef({ phase: 'wait' as Phase, t: 1.2, dur: 1, round: 0, target: 0, fellThisRound: false, lastBar: -1 });

  const tiles = (): Solid[] => engine.current?.solids.slice(0, N * N) ?? [];
  const tileCenter = (i: number) => new THREE.Vector3(((i % N) - 2) * STEP, 0, (Math.floor(i / N) - 2) * STEP);
  const tileAt = (x: number, z: number): Solid | null => {
    const c = Math.round(x / STEP) + 2, r = Math.round(z / STEP) + 2;
    if (c < 0 || c >= N || r < 0 || r >= N) return null;
    return tiles()[r * N + c] ?? null;
  };

  // 🤖 otros jugadores
  const playerName = useGame((s) => s.name);
  const bots = useMemo(() => {
    const free = Array.from({ length: N * N }, (_, i) => i).filter((i) => i !== 12).sort(() => Math.random() - 0.5);
    const spots = free.map((i) => tileCenter(i).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6)));
    const list = makeBots(BOT_COUNT, spots, playerName);
    if (thumb) list.forEach((b, i) => {
      b.anim.cheer = 999;
      b.facing = Math.atan2(thumb.cam[0] - b.pos.x, thumb.cam[2] - b.pos.z) + (i % 2 ? 0.3 : -0.3);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const aliveBots = () => bots.filter((b) => !b.out).length;

  const startRound = () => {
    const s = g.current;
    s.round += 1;
    s.fellThisRound = false;
    const k = Math.min(COLORS.length, 3 + Math.floor(s.round / 3));
    s.target = Math.floor(Math.random() * k);
    const cs = Array.from({ length: N * N }, () => Math.floor(Math.random() * k));
    // asegurar 2-4 cuadros del color correcto, repartidos
    const want = Math.max(2, 5 - Math.floor(s.round / 4));
    let have = cs.filter((c) => c === s.target).length;
    while (have < want) {
      const i = Math.floor(Math.random() * cs.length);
      if (cs[i] !== s.target) {
        cs[i] = s.target;
        have++;
      }
    }
    colors.current = cs;
    s.dur = Math.max(1.9, 4.6 - s.round * 0.2);
    s.t = s.dur;
    s.phase = 'show';
    planBots(bots, s.round, s.target, cs, tileCenter);
    useRun.getState().set({ round: s.round, banner: { name: COLORS[s.target].name, color: COLORS[s.target].hex }, bar: 1 });
    sfx.count();
  };

  const finish = (won: boolean) => {
    const s = g.current;
    s.phase = 'over';
    const run = useRun.getState();
    const survived = won ? s.round : Math.max(0, s.round - 1);
    // lugar: si perdió, quedan delante los bots que siguen vivos
    const place = won ? 1 : aliveBots() + 1;
    const bonus = PLACE_BONUS[place - 1] ?? 0;
    if (bonus) run.addCoins(bonus);
    const record = useGame.getState().setBestColors(survived);
    if (engine.current) engine.current.anim.cheer = place <= 3 ? 999 : 2;
    bots.forEach((b) => !b.out && !won && (b.anim.cheer = 999));
    sfx.win();
    const medal = ['🥇', '🥈', '🥉'][place - 1];
    run.set({
      status: 'done',
      banner: null,
      result: {
        emoji: medal ?? '🎨',
        title: place === 1 ? '¡Primer lugar!' : place === 2 ? '¡Segundo lugar!' : place === 3 ? '¡Tercer lugar!' : '¡Buen intento!',
        subtitle:
          (place === 1 && aliveBots() === 0 ? '¡Fuiste la última en pie! ' : '') +
          `Lugar ${place} de ${BOT_COUNT + 1} • ${survived} ronda${survived === 1 ? '' : 's'}` +
          (bonus ? ` • +${bonus} de premio` : ''),
        coins: useRun.getState().coins,
        record,
      },
    });
  };

  const hooks = useRef<LevelHooks>({});
  hooks.current = {
    onFall: (e) => {
      const s = g.current;
      const run = useRun.getState();
      sfx.splash();
      burst(e.ctrl.pos.clone().setY(-3), '#7fd8ff', 20);
      // reaparecer sobre un cuadro que siga arriba
      const safe = tiles().filter((t) => t.active);
      const spot = safe.length ? safe[Math.floor(Math.random() * safe.length)] : tiles()[12];
      e.ctrl.reset(new THREE.Vector3(spot.center.x, 0.01, spot.center.z), e.ctrl.facing);
      if (s.phase === 'over' || thumb) return;
      s.fellThisRound = true;
      const lives = run.lives - 1;
      run.set({ lives });
      if (lives <= 0) finish(false);
      else run.showToast(lives === 1 ? '¡Splash! Te queda 1 ❤️' : `¡Splash! Te quedan ${lives} ❤️`);
    },
    onTick: (e, dt) => {
      const s = g.current;
      if (thumb) return;
      if (useRun.getState().status === 'playing' || s.phase === 'over') {
        const splashed = updateBots(bots, dt, tileAt, HALF_GRID - 0.9);
        if (splashed.length) {
          splashed.forEach((b) => burst(b.pos.clone().setY(-3.5), '#7fd8ff', 14));
          sfx.splash();
          const run = useRun.getState();
          run.set({ players: aliveBots() + 1 });
          run.showToast(splashed.length === 1 ? `💦 ¡${splashed[0].name} se cayó!` : `💦 ¡Se cayeron ${splashed.length}!`);
        }
      }
      if (s.phase === 'over' || useRun.getState().status !== 'playing') return;
      s.t -= dt;
      if (s.phase === 'wait' || s.phase === 'rest') {
        if (s.t <= 0) startRound();
      } else if (s.phase === 'show') {
        const bar = Math.max(0, s.t / s.dur);
        if (Math.abs(bar - s.lastBar) > 0.04) {
          s.lastBar = bar;
          useRun.getState().set({ bar });
        }
        if (s.t <= 0) {
          // ¡se caen los cuadros que no son del color!
          tiles().forEach((t, i) => (t.active = colors.current[i] === s.target));
          s.phase = 'drop';
          s.t = 1.9;
          sfx.fall();
          useRun.getState().set({ bar: 0 });
        }
      } else if (s.phase === 'drop' && s.t <= 0) {
        tiles().forEach((t) => (t.active = true));
        const run = useRun.getState();
        if (!s.fellThisRound) {
          run.addCoins(1);
          sfx.coin();
          burst(e.ctrl.pos.clone().setY(e.ctrl.pos.y + 2.4), '#ffd23f', 12);
        }
        if (s.round >= COLOR_ROUNDS || aliveBots() === 0) return finish(true);
        if (s.round % 5 === 0) run.showToast(`¡Ronda ${s.round}! ¡Va más rápido! ⚡`);
        s.phase = 'rest';
        s.t = 0.7;
        run.set({ banner: null });
      }
    },
  };

  return (
    <>
      <fog attach="fog" args={['#ffe3f1', 40, 110]} />
      <PlayWorld
        platforms={platforms}
        spawn={spawn}
        yaw={Math.PI * 0.25}
        killY={-4}
        avatar={avatar}
        hooks={hooks}
        thumb={thumb}
        onEngine={(e) => (engine.current = e)}
      />
      <Tiles engine={engine} colors={colors} target={g} />
      <BotsView bots={bots} />
      <Bursts />
      <Pool />
      <Balloons />
      <Rails />
      {[[-34, 10, -30, 2.6], [32, 14, -26, 2.4], [-36, 8, 28, 2.2], [34, 12, 30, 2.8], [0, 18, -44, 3]].map(([x, y, z, sc], i) => (
        <Cloud key={i} position={[x, y, z]} scale={sc} />
      ))}
    </>
  );
}

function Tiles({
  engine, colors, target,
}: {
  engine: React.RefObject<Engine | null>;
  colors: React.RefObject<number[]>;
  target: React.RefObject<{ phase: Phase; target: number; t: number }>;
}) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const mats = useMemo(() => COLORS.map((c) => mat(c.hex, { rough: 0.45 })), []);
  const tops = useMemo(() => COLORS.map((c) => mat('#' + new THREE.Color(c.hex).lerp(new THREE.Color('#ffffff'), 0.12).getHexString())), []);
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const solids = engine.current?.solids;
    if (!solids) return;
    const g = target.current;
    for (let i = 0; i < N * N; i++) {
      const o = refs.current[i];
      const s = solids[i];
      if (!o || !s) continue;
      const ci = colors.current[i];
      const body = o.children[0] as THREE.Mesh;
      const top = o.children[1] as THREE.Mesh;
      body.material = mats[ci];
      top.material = tops[ci];
      const goalY = s.active ? s.center.y : s.center.y - 14;
      o.position.y += (goalY - o.position.y) * (1 - Math.exp(-(s.active ? 10 : 3) * dt));
      // en la parte final del aviso, los cuadros correctos brincan un poquito
      const hint = s.active && g.phase === 'show' && ci === g.target ? Math.abs(Math.sin(st.clock.elapsedTime * 6)) * 0.12 : 0;
      o.position.y += hint * 0.2;
    }
  });
  return (
    <>
      {Array.from({ length: N * N }, (_, i) => {
        const r = Math.floor(i / N), c = i % N;
        return (
          <group key={i} ref={(o) => void (refs.current[i] = o)} position={[(c - 2) * STEP, -0.5, (r - 2) * STEP]}>
            <mesh castShadow receiveShadow geometry={rbox(TILE, 1, TILE, 0.14)} material={mats[0]} />
            <mesh receiveShadow geometry={rbox(TILE + 0.04, 0.16, TILE + 0.04, 0.07)} material={tops[0]} position={[0, 0.43, 0]} />
          </group>
        );
      })}
    </>
  );
}

function Pool() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) ref.current.position.y = -6 + Math.sin(s.clock.elapsedTime) * 0.1;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, 0]}>
      <planeGeometry args={[300, 300]} />
      <meshLambertMaterial color="#6fd6ff" />
    </mesh>
  );
}

function Rails() {
  const w = HALF_GRID + 0.4;
  const posts = useMemo(() => {
    const out: [number, number][] = [];
    for (let k = -6; k <= 6; k += 2) {
      const v = (k / 6) * w;
      out.push([v, w], [v, -w], [w, v], [-w, v]);
    }
    return out;
  }, [w]);
  return (
    <>
      {posts.map(([x, z], i) => (
        <mesh key={i} material={mat(['#ff5fa2', '#ffd23f', '#3cb7f5', '#2fd39a'][i % 4])} position={[x, 0.6, z]}>
          <sphereGeometry args={[0.35, 12, 10]} />
        </mesh>
      ))}
    </>
  );
}

function Balloons() {
  const ref = useRef<THREE.Group>(null);
  const list = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const r = 18 + (i % 3) * 4;
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 3 + (i % 4) * 2, c: COLORS[i % COLORS.length].hex, ph: i };
      }),
    [],
  );
  useFrame((s) => {
    ref.current?.children.forEach((c, i) => {
      const b = list[i];
      c.position.y = b.y + Math.sin(s.clock.elapsedTime * 1.3 + b.ph) * 0.5;
    });
  });
  return (
    <group ref={ref}>
      {list.map((b, i) => (
        <group key={i} position={[b.x, b.y, b.z]}>
          <mesh material={mat(b.c, { rough: 0.25 })} scale={[1, 1.2, 1]}>
            <sphereGeometry args={[0.9, 16, 14]} />
          </mesh>
          <mesh material={mat('#ffffff')} position={[0, -2, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 2.2, 4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
