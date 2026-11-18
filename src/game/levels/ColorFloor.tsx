import { useEffect, useMemo, useRef } from 'react';
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
import { broadcast, netMode, onNetMessage, sendToHost, useRoom } from '../../net/room';
import { NetSync, RemotePlayers, type PosEntry } from '../../net/remote';
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
type Ranking = { id: string; name: string; place: number }[];

export function ColorFloorLevel({ avatar, thumb }: { avatar: AvatarConfig; thumb?: ThumbShot }) {
  // solo = contra bots · host = anfitrión de la sala (manda) · guest = invitado (obedece)
  const mode = useMemo(() => (thumb ? 'solo' : netMode()), [thumb]);
  const platforms = useMemo(buildFloor, []);
  const engine = useRef<Engine | null>(null);
  const colors = useRef<number[]>(Array.from({ length: N * N }, (_, i) => (i * 7 + 3) % 4));
  const g = useRef({ phase: 'wait' as Phase, t: 1.2, dur: 1, round: 0, target: 0, fellThisRound: false, lastBar: -1 });
  const meOut = useRef(false);
  const outOrder = useRef<string[]>([]); // anfitrión: orden en que se fueron eliminando
  const humansOut = useRef(new Set<string>());

  const tiles = (): Solid[] => engine.current?.solids.slice(0, N * N) ?? [];
  const tileCenter = (i: number) => new THREE.Vector3(((i % N) - 2) * STEP, 0, (Math.floor(i / N) - 2) * STEP);
  const tileAt = (x: number, z: number): Solid | null => {
    const c = Math.round(x / STEP) + 2, r = Math.round(z / STEP) + 2;
    if (c < 0 || c >= N || r < 0 || r >= N) return null;
    return tiles()[r * N + c] ?? null;
  };
  // en sala cada quien aparece en un cuadro distinto
  const spawn = useMemo(() => (mode === 'solo' ? new THREE.Vector3(0, 0, 0) : tileCenter(Math.floor(Math.random() * N * N))), [mode]);

  // 🤖 bots (en solo: 7 al azar · anfitrión: los que eligió la sala · invitado: los ve como jugadores remotos)
  const playerName = useGame((s) => s.name);
  const bots = useMemo(() => {
    if (mode === 'guest') return [];
    const room = useRoom.getState();
    const count = mode === 'host' ? room.botPlayers.length : BOT_COUNT;
    const free = Array.from({ length: N * N }, (_, i) => i).filter((i) => i !== 12).sort(() => Math.random() - 0.5);
    const spots = free.map((i) => tileCenter(i).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6)));
    const list = makeBots(count, spots, playerName);
    if (mode === 'host') list.forEach((b, i) => Object.assign(b, { id: room.botPlayers[i].id, name: room.botPlayers[i].name, cfg: room.botPlayers[i].avatar }));
    if (thumb)
      list.forEach((b, i) => {
        b.anim.cheer = 999;
        b.facing = Math.atan2(thumb.cam[0] - b.pos.x, thumb.cam[2] - b.pos.z) + (i % 2 ? 0.3 : -0.3);
      });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const aliveBots = () => bots.filter((b) => !b.out).length;

  /** Anfitrión: cuántos siguen en juego (personas + bots) */
  const aliveCount = () => {
    const room = useRoom.getState();
    const humans = room.players.filter((p) => !humansOut.current.has(p.id)).length;
    return humans + aliveBots();
  };
  const nameOf = (id: string) => {
    const room = useRoom.getState();
    return [...room.players, ...room.botPlayers].find((p) => p.id === id)?.name ?? 'Alguien';
  };

  /** Anfitrión: alguien quedó fuera (persona o bot) */
  const markOut = (id: string, isBot: boolean) => {
    if (outOrder.current.includes(id)) return;
    outOrder.current.push(id);
    if (!isBot) humansOut.current.add(id);
    broadcast({ t: 'out', id });
    const n = aliveCount();
    useRun.getState().set({ players: n });
    broadcast({ t: 'alive', n });
  };

  /** Aplica una ronda (el anfitrión la inventa; los invitados la reciben) */
  const applyRound = (round: number, target: number, cs: number[], dur: number) => {
    const s = g.current;
    s.round = round;
    s.target = target;
    s.fellThisRound = false;
    colors.current = cs;
    s.dur = dur;
    s.t = dur;
    s.phase = 'show';
    tiles().forEach((t) => (t.active = true));
    useRun.getState().set({ round, banner: { name: COLORS[target].name, color: COLORS[target].hex }, bar: 1 });
    sfx.count();
  };

  const startRound = () => {
    const s = g.current;
    const round = s.round + 1;
    const k = Math.min(COLORS.length, 3 + Math.floor(round / 3));
    const target = Math.floor(Math.random() * k);
    const cs = Array.from({ length: N * N }, () => Math.floor(Math.random() * k));
    // asegurar varios cuadros del color correcto (más en sala porque hay más jugadores)
    const want = Math.max(mode === 'solo' ? 2 : 3, 5 - Math.floor(round / 4));
    let have = cs.filter((c) => c === target).length;
    while (have < want) {
      const i = Math.floor(Math.random() * cs.length);
      if (cs[i] !== target) {
        cs[i] = target;
        have++;
      }
    }
    const dur = Math.max(1.9, 4.6 - round * 0.2);
    applyRound(round, target, cs, dur);
    planBots(bots, round, target, cs, tileCenter);
    if (mode === 'host') broadcast({ t: 'round', round, target, colors: cs, dur });
  };

  const applyDrop = () => {
    const s = g.current;
    tiles().forEach((t, i) => (t.active = colors.current[i] === s.target));
    s.phase = 'drop';
    s.t = 1.9;
    sfx.fall();
    useRun.getState().set({ bar: 0 });
  };

  const applyRestore = () => {
    const s = g.current;
    tiles().forEach((t) => (t.active = true));
    const run = useRun.getState();
    if (!s.fellThisRound && !meOut.current) {
      run.addCoins(1);
      sfx.coin();
      const e = engine.current;
      if (e) burst(e.ctrl.pos.clone().setY(e.ctrl.pos.y + 2.4), '#ffd23f', 12);
    }
    if (s.round % 5 === 0) run.showToast(`¡Ronda ${s.round}! ¡Va más rápido! ⚡`);
    s.phase = 'rest';
    s.t = 0.7;
    run.set({ banner: null });
  };

  /** Mostrar el resultado con el lugar que me tocó */
  const showResult = (place: number, total: number) => {
    const s = g.current;
    if (s.phase === 'over') return;
    s.phase = 'over';
    const run = useRun.getState();
    const survived = meOut.current ? Math.max(0, s.round - 1) : s.round;
    const bonus = PLACE_BONUS[place - 1] ?? 0;
    if (bonus) run.addCoins(bonus);
    const record = useGame.getState().setBestColors(survived);
    if (engine.current) engine.current.anim.cheer = place <= 3 ? 999 : 2;
    bots.forEach((b) => !b.out && (b.anim.cheer = 999));
    tiles().forEach((t) => (t.active = true));
    sfx.win();
    const medal = ['🥇', '🥈', '🥉'][place - 1];
    run.set({
      status: 'done',
      banner: null,
      result: {
        emoji: medal ?? '🎨',
        title: place === 1 ? '¡Primer lugar!' : place === 2 ? '¡Segundo lugar!' : place === 3 ? '¡Tercer lugar!' : '¡Buen intento!',
        subtitle: `Lugar ${place} de ${total} • ${survived} ronda${survived === 1 ? '' : 's'}` + (bonus ? ` • +${bonus} de premio` : ''),
        coins: useRun.getState().coins,
        record,
      },
    });
  };

  /** Solo: terminó la partida contra bots */
  const finishSolo = (won: boolean) => showResult(won ? 1 : aliveBots() + 1, BOT_COUNT + 1);

  /** Anfitrión: calcula lugares y avisa a todos */
  const finishHost = () => {
    const room = useRoom.getState();
    const all = [...room.players.map((p) => p.id), ...bots.map((b) => b.id)];
    const alive = all.filter((id) => !outOrder.current.includes(id));
    const ranking: Ranking = [
      ...alive.map((id) => ({ id, name: nameOf(id), place: 1 })),
      ...[...outOrder.current].reverse().map((id) => ({ id, name: nameOf(id), place: 0 })),
    ];
    // ajustar lugares de los eliminados: después de los que siguen vivos
    let next = alive.length ? 2 : 1;
    ranking.forEach((r) => {
      if (!alive.includes(r.id)) r.place = next++;
    });
    broadcast({ t: 'end', ranking });
    const mine = ranking.find((r) => r.id === room.myId);
    showResult(mine?.place ?? ranking.length, ranking.length);
  };

  // 👫 Mensajes de la sala
  useEffect(() => {
    if (mode === 'solo') return;
    const room = useRoom.getState();
    useRun.getState().set({ players: room.players.length + room.botPlayers.length });
    return onNetMessage((m) => {
      if (mode === 'host') {
        if (m.t === 'out') {
          if (!outOrder.current.includes(m.id)) {
            useRun.getState().showToast(`💦 ¡${nameOf(m.id)} quedó fuera!`);
            markOut(m.id, false);
          }
        }
        return;
      }
      // invitado
      switch (m.t) {
        case 'round':
          applyRound(m.round, m.target, m.colors, m.dur);
          break;
        case 'drop':
          applyDrop();
          break;
        case 'restore':
          applyRestore();
          break;
        case 'out':
          if (m.id !== useRoom.getState().myId) useRun.getState().showToast(`💦 ¡${nameOf(m.id)} quedó fuera!`);
          break;
        case 'alive':
          useRun.getState().set({ players: m.n });
          break;
        case 'end': {
          const mine = m.ranking.find((r) => r.id === useRoom.getState().myId);
          showResult(mine?.place ?? m.ranking.length, m.ranking.length);
          break;
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const loseLife = () => {
    const run = useRun.getState();
    const lives = run.lives - 1;
    run.set({ lives: Math.max(0, lives) });
    if (lives > 0) {
      run.showToast(lives === 1 ? '¡Splash! Te queda 1 ❤️' : `¡Splash! Te quedan ${lives} ❤️`);
      return;
    }
    if (mode === 'solo') return finishSolo(false);
    // en sala: quedo fuera pero sigo mirando
    meOut.current = true;
    run.showToast('¡Quedaste fuera! 👀 Mira quién gana');
    const myId = useRoom.getState().myId;
    if (mode === 'host') markOut(myId, false);
    else sendToHost({ t: 'out', id: myId });
  };

  const hooks = useRef<LevelHooks>({});
  hooks.current = {
    onFall: (e) => {
      const s = g.current;
      sfx.splash();
      burst(e.ctrl.pos.clone().setY(-3), '#7fd8ff', 20);
      // reaparecer sobre un cuadro que siga arriba
      const safe = tiles().filter((t) => t.active);
      const spot = safe.length ? safe[Math.floor(Math.random() * safe.length)] : tiles()[12];
      e.ctrl.reset(new THREE.Vector3(spot.center.x, 0.01, spot.center.z), e.ctrl.facing);
      if (s.phase === 'over' || thumb || meOut.current) return;
      s.fellThisRound = true;
      loseLife();
    },
    onTick: (e, dt) => {
      const s = g.current;
      if (thumb) return;
      const playing = useRun.getState().status === 'playing';

      // bots (solo y anfitrión)
      if (mode !== 'guest' && (playing || s.phase === 'over')) {
        const splashed = updateBots(bots, dt, tileAt, HALF_GRID - 0.9);
        if (splashed.length) {
          splashed.forEach((b) => burst(b.pos.clone().setY(-3.5), '#7fd8ff', 14));
          sfx.splash();
          const run = useRun.getState();
          if (mode === 'host') splashed.forEach((b) => markOut(b.id, true));
          else run.set({ players: aliveBots() + 1 });
          run.showToast(splashed.length === 1 ? `💦 ¡${splashed[0].name} se cayó!` : `💦 ¡Se cayeron ${splashed.length}!`);
        }
      }
      if (s.phase === 'over') return;
      // en sala el juego sigue aunque abras el menú
      if (!playing && mode === 'solo') return;
      s.t -= dt;

      if (s.phase === 'show') {
        const bar = Math.max(0, s.t / s.dur);
        if (Math.abs(bar - s.lastBar) > 0.04) {
          s.lastBar = bar;
          useRun.getState().set({ bar });
        }
      }
      if (mode === 'guest') return; // el invitado solo obedece al anfitrión

      if (s.phase === 'wait' || s.phase === 'rest') {
        if (s.t <= 0) startRound();
      } else if (s.phase === 'show') {
        if (s.t <= 0) {
          applyDrop();
          if (mode === 'host') broadcast({ t: 'drop' });
        }
      } else if (s.phase === 'drop' && s.t <= 0) {
        if (mode === 'host') {
          broadcast({ t: 'restore' });
          applyRestore();
          if (s.round >= COLOR_ROUNDS || aliveCount() <= 1) finishHost();
        } else {
          if (s.round >= COLOR_ROUNDS || aliveBots() === 0) {
            tiles().forEach((t) => (t.active = true));
            return finishSolo(true);
          }
          applyRestore();
        }
      }
    },
  };

  const botEntries = (): PosEntry[] =>
    bots.map((b) => [b.id, Math.round(b.pos.x * 100) / 100, Math.round(b.pos.y * 100) / 100, Math.round(b.pos.z * 100) / 100, Math.round(b.facing * 100) / 100, b.anim.speed, b.anim.grounded ? 1 : 0, b.out ? 1 : 0]);

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
      {mode !== 'solo' && (
        <>
          <NetSync engine={engine} isOut={() => meOut.current} extra={mode === 'host' ? botEntries : undefined} />
          <RemotePlayers />
        </>
      )}
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
