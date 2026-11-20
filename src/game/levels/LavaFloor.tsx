import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '../../data/items';
import { sfx } from '../../lib/sound';
import { useGame } from '../../store';
import { mat, rbox } from '../../three/shapes';
import { Bursts, burst } from '../fx';
import type { PlatformSpec, Solid } from '../physics';
import { PlayWorld, type Engine, type LevelHooks, type ThumbShot } from '../PlayWorld';
import { useRun } from '../runStore';
import { BotsView, makeBots, type Bot } from './colorBots';
import { broadcast, netMode, onNetMessage, sendToHost, useRoom } from '../../net/room';
import { NetSync, RemotePlayers, type PosEntry } from '../../net/remote';
import { nameInRoom } from '../../net/places';

// 🌋 El piso es lava: cuando suena la alarma, ¡súbete a un mueble antes de que el piso se vuelva lava!

export const LAVA_ROUNDS = 10;
const LAVA_BOTS = 7;
const PLACE_BONUS = [10, 6, 4];
const HALF = 17;

type Furni = [x: number, z: number, w: number, d: number, top: number, color: string, kind?: 'bounce'];
const FURNITURE: Furni[] = [
  [0, -12, 8, 3, 1.0, '#ff9ecb'], // sofá
  [0, -13.3, 8, 0.8, 2.0, '#ff7ab6'], // respaldo del sofá
  [6, 0, 4, 3, 1.4, '#c98a4b'], // mesa
  [-10, 10, 5, 7, 1.1, '#c9b6ff'], // cama
  [-14.5, -6, 2, 6, 2.6, '#a86b3c'], // librero
  [-11.5, -5, 2, 2, 1.2, '#e8c58e'], // caja
  [10, 9, 2.2, 2.2, 0.9, '#e8c58e'], // caja
  [12, -10, 2.4, 2.4, 1.6, '#e8c58e'], // caja grande
  [3, 8, 2.2, 2.2, 0.7, '#7fe0b4'], // cojín
  [-4, 3, 2.2, 2.2, 0.8, '#7fd8ff'], // cojín
  [2, -5, 1.8, 1.8, 1.0, '#ffd23f'], // silla
  [-14, 14, 2, 2, 1.2, '#ffb38a'], // mesita
  [12, 3, 4, 2.2, 1.5, '#33264d'], // piano
  [8, -14, 3, 2.5, 0.9, '#ffcf6b'], // baúl de juguetes
  [-5, -10, 2.6, 2.6, 0.5, '#ff5fa2', 'bounce'], // trampolín
];

function buildRoom(): PlatformSpec[] {
  const P: PlatformSpec[] = [];
  P.push({ p: [0, -0.5, 0], s: [HALF * 2, 1, HALF * 2], color: '#f3d9b1', hidden: true }); // piso (lo dibujamos aparte)
  const w = HALF + 0.5;
  P.push({ p: [0, 3, w], s: [w * 2 + 1, 8, 1], color: '#fff', hidden: true });
  P.push({ p: [0, 3, -w], s: [w * 2 + 1, 8, 1], color: '#fff', hidden: true });
  P.push({ p: [w, 3, 0], s: [1, 8, w * 2 + 1], color: '#fff', hidden: true });
  P.push({ p: [-w, 3, 0], s: [1, 8, w * 2 + 1], color: '#fff', hidden: true });
  for (const [x, z, fw, fd, top, color, kind] of FURNITURE) P.push({ p: [x, top / 2, z], s: [fw, top, fd], color, kind });
  return P;
}
const FIRST_FURNI = 5; // índice del primer mueble en los sólidos

type Phase = 'wait' | 'safe' | 'warn' | 'lava' | 'over';
type Ranking = { id: string; name: string; place: number }[];

export function LavaLevel({ avatar, thumb }: { avatar: AvatarConfig; thumb?: ThumbShot }) {
  // solo = contra bots · host = anfitrión de la sala (manda las alarmas) · guest = invitado (obedece)
  const mode = useMemo(() => (thumb ? 'solo' : netMode()), [thumb]);
  const platforms = useMemo(buildRoom, []);
  const engine = useRef<Engine | null>(null);
  // en sala cada quien aparece en un lugar distinto de la sala
  const spawn = useMemo(
    () => (mode === 'solo' ? new THREE.Vector3(0, 0, 6) : new THREE.Vector3((Math.random() - 0.5) * 16, 0, (Math.random() - 0.5) * 12 + 3)),
    [mode],
  );
  const g = useRef({ phase: (thumb ? 'lava' : 'wait') as Phase, t: 1.5, dur: 1, round: 0, burnedThisRound: false, safeT: 0, lastBar: -1 });
  const playerName = useGame((s) => s.name);
  const meOut = useRef(false);
  const outOrder = useRef<string[]>([]); // anfitrión: orden en que se fueron eliminando
  const humansOut = useRef(new Set<string>());

  const furniture = (): Solid[] => engine.current?.solids.slice(FIRST_FURNI) ?? [];
  const floor = (): Solid | undefined => engine.current?.solids[0];
  const topAt = (x: number, z: number) => {
    let top = 0;
    for (const s of furniture()) if (s.active && x > s.min.x - 0.1 && x < s.max.x + 0.1 && z > s.min.z - 0.1 && z < s.max.z + 0.1) top = Math.max(top, s.max.y);
    return top;
  };

  // 🤖 bots (solo: 7 al azar · anfitrión: los de la sala · invitado: los ve como jugadores remotos)
  const bots = useMemo<Bot[]>(() => {
    if (mode === 'guest') return [];
    const room = useRoom.getState();
    const count = mode === 'host' ? room.botPlayers.length : LAVA_BOTS;
    const spots = Array.from({ length: Math.max(1, count) }, (_, i) => new THREE.Vector3(Math.cos(i * 0.9) * 9, 0, Math.sin(i * 0.9) * 9 + 2));
    const list = makeBots(count, spots, playerName);
    if (mode === 'host') list.forEach((b, i) => Object.assign(b, { id: room.botPlayers[i].id, name: room.botPlayers[i].name, cfg: room.botPlayers[i].avatar }));
    if (thumb) {
      const tops: [number, number, number][] = [[0, 1.0, -11.6], [6, 1.4, 0], [-4, 0.8, 3], [3, 0.7, 8], [12, 1.5, 3], [-10, 1.1, 10], [2, 1.0, -5]];
      list.forEach((b, i) => {
        b.pos.set(...tops[i]);
        b.anim.cheer = 999;
        b.facing = Math.atan2(thumb.cam[0] - b.pos.x, thumb.cam[2] - b.pos.z);
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const botGoal = useRef(new Map<string, { x: number; z: number; react: number }>());
  const aliveBots = () => bots.filter((b) => !b.out && !b.falling).length;

  /** Anfitrión: cuántos siguen en juego (personas + bots) */
  const aliveCount = () => {
    const room = useRoom.getState();
    return room.players.filter((p) => !humansOut.current.has(p.id)).length + aliveBots();
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

  /** Al sonar la alarma: cada bot elige a qué mueble correr (y a veces se equivoca) */
  const planBots = (round: number) => {
    const list = furniture().filter((s) => s.active);
    for (const b of bots) {
      if (b.out) continue;
      const ok = Math.random() < Math.max(0.45, b.skill - round * 0.035);
      let s = list[Math.floor(Math.random() * list.length)];
      if (ok) {
        s = list.reduce((best, f) => (f.center.distanceTo(b.pos) < best.center.distanceTo(b.pos) ? f : best), list[0]);
      }
      const jitter = ok ? 0.6 : 2.5;
      botGoal.current.set(b.id, {
        x: s.center.x + (Math.random() - 0.5) * Math.min(jitter, s.half.x * 1.4),
        z: s.center.z + (Math.random() - 0.5) * Math.min(jitter, s.half.z * 1.4),
        react: 0.15 + Math.random() * (ok ? 0.7 : 1.6),
      });
    }
  };
  /** En calma: bajan a pasear por el piso */
  const wanderBots = () => {
    for (const b of bots) {
      if (b.out) continue;
      botGoal.current.set(b.id, { x: (Math.random() - 0.5) * (HALF * 2 - 6), z: (Math.random() - 0.5) * (HALF * 2 - 6), react: Math.random() * 0.8 });
    }
  };

  const updateLavaBots = (dt: number) => {
    const s = g.current;
    for (const b of bots) {
      if (b.out) continue;
      if (b.falling) {
        // se quemó: brinca y desaparece
        b.vy -= 30 * dt;
        b.pos.y += b.vy * dt;
        if (b.pos.y < -3) b.out = true;
        continue;
      }
      const goal = botGoal.current.get(b.id);
      let moving = false;
      if (goal) {
        if (goal.react > 0) goal.react -= dt;
        else {
          const dx = goal.x - b.pos.x, dz = goal.z - b.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.2) {
            const step = Math.min(d, b.speed * 1.15 * dt);
            b.pos.x += (dx / d) * step;
            b.pos.z += (dz / d) * step;
            let df = Math.atan2(dx, dz) - b.facing;
            df = Math.atan2(Math.sin(df), Math.cos(df));
            b.facing += df * (1 - Math.exp(-10 * dt));
            moving = true;
          }
        }
      }
      // subir/bajar de los muebles con un brinquito
      const want = topAt(b.pos.x, b.pos.z);
      b.pos.y += (want - b.pos.y) * (1 - Math.exp(-(want > b.pos.y ? 9 : 12) * dt));
      b.anim.speed = moving ? 1 : 0;
      b.anim.grounded = Math.abs(want - b.pos.y) < 0.12;
      // ¡en la lava!
      if (s.phase === 'lava' && b.pos.y < 0.15) {
        b.falling = true;
        b.vy = 9;
        sfx.splash();
        burst(b.pos.clone().setY(0.5), '#ff6a2b', 16);
        useRun.getState().showToast(`🔥 ¡${b.name} tocó la lava!`);
        if (mode === 'host') markOut(b.id, true);
      }
    }
    // cuántos siguen en juego (bots + tú) — en sala lo cuenta el anfitrión
    if (mode === 'solo') {
      const alive = aliveBots() + 1;
      if (useRun.getState().players !== alive) useRun.getState().set({ players: alive });
    }
  };

  /** Mostrar el resultado con el lugar que me tocó */
  const showResult = (place: number, total: number) => {
    const s = g.current;
    if (s.phase === 'over') return;
    const lost = meOut.current || useRun.getState().lives <= 0;
    s.phase = 'over';
    const run = useRun.getState();
    const survived = lost ? Math.max(0, s.round - 1) : s.round;
    const bonus = PLACE_BONUS[place - 1] ?? 0;
    if (bonus) run.addCoins(bonus);
    const e = engine.current;
    if (e) e.anim.cheer = place <= 3 ? 999 : 2;
    bots.forEach((b) => !b.out && !b.falling && (b.anim.cheer = 999));
    sfx.win();
    const medal = ['🥇', '🥈', '🥉'][place - 1];
    run.set({
      status: 'done',
      banner: null,
      bar: 0,
      result: {
        emoji: medal ?? '🌋',
        title: place === 1 ? '¡Sobreviviste a la lava!' : place === 2 ? '¡Segundo lugar!' : place === 3 ? '¡Tercer lugar!' : '¡Buen intento!',
        subtitle: `Lugar ${place} de ${total} • ${survived} ronda${survived === 1 ? '' : 's'}` + (bonus ? ` • +${bonus} de premio` : ''),
        coins: useRun.getState().coins,
        record: false,
      },
    });
  };

  /** Solo: terminó la partida contra bots */
  const finishSolo = (won: boolean) => showResult(won ? 1 : aliveBots() + 1, LAVA_BOTS + 1);

  /** Anfitrión: calcula lugares y avisa a todos */
  const finishHost = () => {
    const room = useRoom.getState();
    const all = [...room.players.map((p) => p.id), ...bots.map((b) => b.id)];
    const alive = all.filter((id) => !outOrder.current.includes(id));
    const ranking: Ranking = [
      ...alive.map((id) => ({ id, name: nameInRoom(id), place: 1 })),
      ...[...outOrder.current].reverse().map((id) => ({ id, name: nameInRoom(id), place: 0 })),
    ];
    // los que siguen vivos empatan en 1°; los eliminados, del último que cayó al primero
    let next = alive.length ? 2 : 1;
    ranking.forEach((r) => {
      if (!alive.includes(r.id)) r.place = next++;
    });
    broadcast({ t: 'end', ranking });
    const mine = ranking.find((r) => r.id === room.myId);
    showResult(mine?.place ?? ranking.length, ranking.length);
  };

  /* ---- Fases de la ronda (el anfitrión las decide; el invitado las recibe) ---- */
  const applyWarn = (round: number, dur: number) => {
    const s = g.current;
    s.round = round;
    s.burnedThisRound = false;
    s.phase = 'warn';
    s.dur = s.t = dur;
    sfx.count();
    useRun.getState().set({ round, banner: { name: '', color: '#ff6a2b', text: '🔥 ¡EL PISO ES LAVA!' }, bar: 1 });
  };
  const applyLava = (dur: number) => {
    const s = g.current;
    s.phase = 'lava';
    s.dur = s.t = dur;
    sfx.fall();
    useRun.getState().set({ banner: { name: '', color: '#ff3d1f', text: '🌋 ¡No toques el piso!' }, bar: 1 });
  };
  /** La lava se enfría (y a veces se hunde un mueble) */
  const applySafe = (sink: number, wait: number) => {
    const s = g.current;
    const run = useRun.getState();
    const e = engine.current;
    if (!s.burnedThisRound && !meOut.current && e) {
      run.addCoins(1);
      sfx.coin();
      burst(e.ctrl.pos.clone().setY(e.ctrl.pos.y + 2.4), '#ffd23f', 12);
    }
    const f = furniture()[sink];
    if (f) {
      f.active = false;
      run.showToast('😱 ¡Se hundió un mueble!');
    } else if (s.round % 3 === 0) run.showToast(`¡Ronda ${s.round}! ¡Más rápido! ⚡`);
    s.phase = 'safe';
    s.dur = 0;
    s.t = wait;
    run.set({ banner: null, bar: 0 });
  };

  // 👫 Mensajes de la sala
  useEffect(() => {
    if (mode === 'solo') return;
    const room = useRoom.getState();
    useRun.getState().set({ players: room.players.length + room.botPlayers.length });
    return onNetMessage((m) => {
      if (mode === 'host') {
        if (m.t === 'out' && !outOrder.current.includes(m.id)) {
          useRun.getState().showToast(`🔥 ¡${nameInRoom(m.id)} quedó fuera!`);
          markOut(m.id, false);
        }
        return;
      }
      switch (m.t) {
        case 'lava':
          if (m.ph === 'warn') applyWarn(m.round, m.dur);
          else if (m.ph === 'lava') applyLava(m.dur);
          else applySafe(m.sink, m.dur);
          break;
        case 'out':
          if (m.id !== useRoom.getState().myId) useRun.getState().showToast(`🔥 ¡${nameInRoom(m.id)} tocó la lava!`);
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

  const respawnOnFurniture = (e: Engine) => {
    const list = furniture().filter((s) => s.active && s.kind !== 'bounce');
    const s = list[Math.floor(Math.random() * list.length)] ?? furniture()[0];
    e.ctrl.reset(new THREE.Vector3(s.center.x, s.max.y + 0.02, s.center.z), e.ctrl.facing);
  };

  const loseLife = (e: Engine) => {
    const run = useRun.getState();
    const lives = run.lives - 1;
    run.set({ lives: Math.max(0, lives) });
    if (lives > 0) {
      run.showToast(lives === 1 ? '🔥 ¡Quema! Te queda 1 ❤️' : `🔥 ¡Quema! Te quedan ${lives} ❤️`);
      respawnOnFurniture(e);
      return;
    }
    if (mode === 'solo') return finishSolo(false);
    // en sala: quedo fuera pero sigo mirando
    meOut.current = true;
    respawnOnFurniture(e);
    run.showToast('¡Quedaste fuera! 👀 Mira quién gana');
    const myId = useRoom.getState().myId;
    if (mode === 'host') markOut(myId, false);
    else sendToHost({ t: 'out', id: myId });
  };

  const hooks = useRef<LevelHooks>({});
  hooks.current = {
    onFall: (e) => respawnOnFurniture(e),
    onTick: (e, dt) => {
      const s = g.current;
      if (thumb) return;
      const run = useRun.getState();
      const playing = run.status === 'playing';
      if (mode !== 'guest' && (playing || s.phase === 'over')) updateLavaBots(dt);
      // muebles hundidos bajan poco a poco
      for (const f of furniture()) {
        if (!f.obj) continue;
        const want = f.active ? f.center.y : f.center.y - 6;
        f.obj.position.y += (want - f.obj.position.y) * (1 - Math.exp(-2.5 * dt));
      }
      if (s.safeT > 0) s.safeT -= dt;
      if (s.phase === 'over') return;
      // en sala el juego sigue aunque abras el menú
      if (!playing && mode === 'solo') return;
      s.t -= dt;

      // ¿estás tocando la lava?
      if (s.phase === 'lava' && s.safeT <= 0 && !meOut.current && playing) {
        const onFloor = (e.ctrl.grounded && e.ctrl.ground === floor()) || e.ctrl.pos.y < 0.05;
        if (onFloor) {
          s.burnedThisRound = true;
          s.safeT = 1.5;
          sfx.fall();
          burst(e.ctrl.pos.clone().setY(0.6), '#ff6a2b', 22);
          loseLife(e);
          if (g.current.phase === 'over') return;
        }
      }

      const bar = s.dur > 0 ? Math.max(0, s.t / s.dur) : 0;
      if ((s.phase === 'warn' || s.phase === 'lava') && Math.abs(bar - s.lastBar) > 0.04) {
        s.lastBar = bar;
        run.set({ bar });
      }

      if (mode === 'guest' || s.t > 0) return; // el invitado solo obedece al anfitrión
      if (s.phase === 'wait' || s.phase === 'safe') {
        // 🚨 ¡alarma!
        const round = s.round + 1;
        const dur = Math.max(2.2, 4.2 - round * 0.2);
        applyWarn(round, dur);
        planBots(round);
        if (mode === 'host') broadcast({ t: 'lava', ph: 'warn', round, dur, sink: -1 });
      } else if (s.phase === 'warn') {
        applyLava(4);
        if (mode === 'host') broadcast({ t: 'lava', ph: 'lava', round: s.round, dur: 4, sink: -1 });
      } else if (s.phase === 'lava') {
        if (mode === 'solo' && (s.round >= LAVA_ROUNDS || aliveBots() === 0)) {
          applySafe(-1, 0);
          return finishSolo(true);
        }
        // se hunde un mueble (más difícil)
        let sink = -1;
        if (s.round >= 2) {
          const all = furniture();
          const active = all.filter((f) => f.active);
          if (active.length > 6) sink = all.indexOf(active[Math.floor(Math.random() * active.length)]);
        }
        const wait = 3 + Math.random() * 1.5;
        if (mode === 'host') {
          // se acaba al terminar las rondas o cuando queda uno solo (si eran varios)
          const total = useRoom.getState().players.length + bots.length;
          const over = s.round >= LAVA_ROUNDS || aliveCount() <= (total > 1 ? 1 : 0);
          if (over) sink = -1;
          broadcast({ t: 'lava', ph: 'safe', round: s.round, dur: wait, sink });
          applySafe(sink, wait);
          if (over) return finishHost();
        } else applySafe(sink, wait);
        wanderBots();
      }
    },
  };

  const botEntries = (): PosEntry[] =>
    bots.map((b) => [b.id, Math.round(b.pos.x * 100) / 100, Math.round(b.pos.y * 100) / 100, Math.round(b.pos.z * 100) / 100, Math.round(b.facing * 100) / 100, b.anim.speed, b.anim.grounded ? 1 : 0, b.out ? 1 : 0]);

  return (
    <>
      <fog attach="fog" args={['#ffe8d6', 40, 110]} />
      <PlayWorld platforms={platforms} spawn={spawn} yaw={0} killY={-4} avatar={avatar} hooks={hooks} thumb={thumb} onEngine={(e) => (engine.current = e)} />
      <Floor phase={g} />
      <RoomDecor />
      <BotsView bots={bots} />
      {mode !== 'solo' && (
        <>
          <NetSync engine={engine} isOut={() => meOut.current} extra={mode === 'host' ? botEntries : undefined} />
          <RemotePlayers />
        </>
      )}
      <Bursts />
    </>
  );
}

/* ---------- Piso que se vuelve lava ---------- */
/** Textura de lava con manchas (dibujada con canvas) */
function lavaTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#ff4d1a';
  c.fillRect(0, 0, 256, 256);
  const blob = (color: string, n: number, rMin: number, rMax: number) => {
    c.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = rMin + Math.random() * (rMax - rMin);
      for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
        c.beginPath();
        c.ellipse(x + ox, y + oy, r, r * (0.6 + Math.random() * 0.5), Math.random() * 3, 0, Math.PI * 2);
        c.fill();
      }
    }
  };
  blob('#c41f0a', 14, 14, 34);
  blob('#ff8a1f', 18, 10, 26);
  blob('#ffd23f', 16, 4, 11);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  return t;
}

function Floor({ phase }: { phase: React.RefObject<{ phase: Phase; t: number }> }) {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f3d9b1', roughness: 0.8, emissive: '#000000' }), []);
  const lavaMat = useMemo(() => new THREE.MeshBasicMaterial({ map: lavaTexture(), transparent: true, opacity: 0, depthWrite: false }), []);
  const bubbles = useRef<THREE.Group>(null);
  const wood = useMemo(() => new THREE.Color('#f3d9b1'), []);
  const lava = useMemo(() => new THREE.Color('#ff5a1f'), []);
  const glow = useMemo(() => new THREE.Color('#ff7a1a'), []);
  const data = useMemo(() => Array.from({ length: 26 }, () => ({ x: (Math.random() - 0.5) * 32, z: (Math.random() - 0.5) * 32, t: Math.random() * 2 })), []);
  const heat = useRef(0);
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = phase.current.phase;
    // calor: 0 madera · 1 lava; en la alarma parpadea
    const want = p === 'lava' ? 1 : p === 'warn' ? 0.25 + Math.abs(Math.sin(st.clock.elapsedTime * 7)) * 0.35 : 0;
    heat.current += (want - heat.current) * (1 - Math.exp(-6 * dt));
    m.color.copy(wood).lerp(lava, Math.min(1, heat.current * 1.2));
    m.emissive.copy(glow);
    m.emissiveIntensity = heat.current * 0.5;
    // la lava "fluye" despacito
    lavaMat.opacity = Math.max(0, (heat.current - 0.35) / 0.65);
    lavaMat.map!.offset.set(Math.sin(st.clock.elapsedTime * 0.15) * 0.3, st.clock.elapsedTime * 0.03);
    bubbles.current?.children.forEach((c, i) => {
      const b = data[i];
      b.t = (b.t + dt) % 2;
      c.visible = heat.current > 0.6;
      c.position.set(b.x, 0.05 + b.t * 0.25, b.z);
      c.scale.setScalar((Math.sin((b.t / 2) * Math.PI) * 0.8 + 0.1) * heat.current);
    });
  });
  return (
    <>
      <mesh receiveShadow position={[0, -0.5, 0]} material={m}>
        <boxGeometry args={[HALF * 2, 1, HALF * 2]} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={lavaMat}>
        <planeGeometry args={[HALF * 2, HALF * 2]} />
      </mesh>
      {/* líneas de duela */}
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} position={[-HALF + 3 + i * 3, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, HALF * 2]} />
          <meshBasicMaterial color="#d9b88a" transparent opacity={0.5} />
        </mesh>
      ))}
      <group ref={bubbles}>
        {data.map((_, i) => (
          <mesh key={i} material={mat('#ffb23f', { emissive: 0.9 })}>
            <sphereGeometry args={[0.35, 10, 8]} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/* ---------- Paredes y detalles de la sala ---------- */
function RoomDecor() {
  return (
    <>
      {/* bardas bajitas alrededor */}
      {[
        [0, HALF + 0.3, HALF * 2 + 1, 0.6],
        [0, -HALF - 0.3, HALF * 2 + 1, 0.6],
        [HALF + 0.3, 0, 0.6, HALF * 2 + 1],
        [-HALF - 0.3, 0, 0.6, HALF * 2 + 1],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} castShadow receiveShadow geometry={rbox(w, 1.6, d, 0.2)} material={mat(['#ffd1e6', '#cde9ff', '#fff0b3', '#d9ffe4'][i])} position={[x, 0.8, z]} />
      ))}
      {/* almohadas de la cama */}
      <mesh geometry={rbox(3.6, 0.4, 1.2, 0.18)} material={mat('#ffffff')} position={[-10, 1.3, 12.6]} />
      {/* teclas del piano */}
      <mesh geometry={rbox(3.6, 0.08, 0.6, 0.03)} material={mat('#ffffff')} position={[12, 1.54, 2.1]} />
      {/* libros */}
      {['#ff5fa2', '#3cb7f5', '#ffd23f', '#2fd39a', '#b07cff'].map((c, i) => (
        <mesh key={c} geometry={rbox(0.5, 0.7, 0.3, 0.05)} material={mat(c)} position={[-14.5, 2.95, -8 + i * 0.9]} />
      ))}
      {/* tapete */}
      <mesh position={[-2, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4, 36]} />
        <meshStandardMaterial color="#b07cff" roughness={0.9} transparent opacity={0.55} />
      </mesh>
    </>
  );
}
