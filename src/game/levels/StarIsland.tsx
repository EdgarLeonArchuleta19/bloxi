import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '../../data/items';
import { sfx } from '../../lib/sound';
import { useGame } from '../../store';
import { mat } from '../../three/shapes';
import { Bursts, Cloud, burst } from '../fx';
import type { PlatformSpec } from '../physics';
import { broadcast, netMode, onNetMessage, sendToHost, useRoom } from '../../net/room';
import { NetSync, RemotePlayers, type PosEntry } from '../../net/remote';
import { PlayWorld, type Engine, type LevelHooks, type ThumbShot } from '../PlayWorld';
import { BotsView, makeBots } from './colorBots';
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

type StarWire = [number, number, number, number, number]; // x, y, z, activa, arcoíris

export function StarIslandLevel({ avatar, thumb }: { avatar: AvatarConfig; thumb?: ThumbShot }) {
  // solo · host (reparte estrellas y maneja bots) · guest (recibe estrellas)
  const mode = useMemo(() => (thumb ? 'solo' : netMode()), [thumb]);
  const platforms = useMemo(buildIsland, []);
  const engine = useRef<Engine | null>(null);
  const spawn = useMemo(() => (mode === 'solo' ? new THREE.Vector3(0, 0, 4) : new THREE.Vector3((Math.random() - 0.5) * 10, 0, 4 + Math.random() * 4)), [mode]);
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
  const scores = useRef(new Map<string, number>());
  const dirty = useRef(true);
  const sendAcc = useRef(0);
  const over = useRef(false);

  /** Altura del piso en un punto (para estrellas y bots) */
  const groundTop = (x: number, z: number, pad = 0.6) => {
    let top = 0;
    for (const p of platforms) {
      if (Math.abs(x - p.p[0]) < p.s[0] / 2 + pad && Math.abs(z - p.p[2]) < p.s[2] / 2 + pad) top = Math.max(top, p.p[1] + p.s[1] / 2);
    }
    return top;
  };

  // 🤖 bots del anfitrión
  const bots = useMemo(() => {
    if (mode !== 'host') return [];
    const room = useRoom.getState();
    const spots = room.botPlayers.map((_, i) => new THREE.Vector3(Math.cos(i * 1.7) * 6, 0, Math.sin(i * 1.7) * 6));
    const list = makeBots(room.botPlayers.length, spots, '');
    list.forEach((b, i) => Object.assign(b, { id: room.botPlayers[i].id, name: room.botPlayers[i].name, cfg: room.botPlayers[i].avatar, speed: 4.3 + Math.random() * 1.3 }));
    return list;
  }, [mode]);
  const botTarget = useRef(new Map<string, number>());

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
      const top = groundTop(x, z);
      if (Math.hypot(x - player.x, z - player.z) < 4) continue;
      if (slots.some((s) => s !== slot && s.active && Math.hypot(s.pos.x - x, s.pos.z - z) < 3)) continue;
      slot.pos.set(x, top + 1.2, z);
      slot.active = true;
      slot.rainbow = Math.random() < 0.12;
      slot.age = 0;
      dirty.current = true;
      return;
    }
  };

  /** Me tocaron estrellas (sumar monedas y puntos) */
  const award = (v: number, at: THREE.Vector3, rainbow: boolean) => {
    const run = useRun.getState();
    sfx.star();
    burst(at, rainbow ? '#ff5fa2' : '#ffd23f', rainbow ? 30 : 14);
    run.addCoins(v);
    run.set({ stars: useRun.getState().stars + v });
    if (rainbow) run.showToast('¡Estrella arcoíris! +3 🌈');
  };

  const nameOf = (id: string) => {
    const room = useRoom.getState();
    return [...room.players, ...room.botPlayers].find((p) => p.id === id)?.name ?? 'Alguien';
  };

  /** Anfitrión: alguien agarró la estrella i (el primero que llega se la queda) */
  const hostGrab = (id: string, i: number) => {
    const s = slots[i];
    if (!s?.active) return;
    const v = s.rainbow ? 3 : 1;
    s.active = false;
    dirty.current = true;
    const total = (scores.current.get(id) ?? 0) + v;
    scores.current.set(id, total);
    broadcast({ t: 'score', id, i, v, total });
    if (id === useRoom.getState().myId) award(v, s.pos, s.rainbow);
    else {
      burst(s.pos, s.rainbow ? '#ff5fa2' : '#ffd23f', 10);
      if (s.rainbow) useRun.getState().showToast(`🌈 ¡${nameOf(id)} atrapó la arcoíris!`);
    }
  };

  /** Lugares por estrellas (empates comparten lugar) */
  const ranking = () => {
    const room = useRoom.getState();
    const ids = [...room.players.map((p) => p.id), ...bots.map((b) => b.id)];
    const list = ids.map((id) => ({ id, name: nameOf(id), score: scores.current.get(id) ?? 0 })).sort((a, b) => b.score - a.score);
    return list.map((r) => ({ id: r.id, name: r.name, place: list.findIndex((x) => x.score === r.score) + 1 }));
  };

  const showResult = (place?: number, total?: number) => {
    if (over.current) return;
    over.current = true;
    const run = useRun.getState();
    const stars = run.stars;
    const record = useGame.getState().setBestStars(stars);
    const bonus = place ? [10, 6, 4][place - 1] ?? 0 : 0;
    if (bonus) run.addCoins(bonus);
    const e = engine.current;
    if (e) {
      e.anim.cheer = 999;
      burst(e.ctrl.pos.clone().setY(e.ctrl.pos.y + 2.5), '#ffd23f', 40);
    }
    sfx.win();
    const medal = place ? ['🥇', '🥈', '🥉'][place - 1] : undefined;
    run.set({
      status: 'done',
      time: 0,
      result: {
        emoji: medal ?? '⭐',
        title: place ? (place === 1 ? '¡Ganaste!' : `¡Lugar ${place}!`) : '¡Se acabó el tiempo!',
        subtitle:
          `Atrapaste ${stars} estrella${stars === 1 ? '' : 's'}` +
          (place ? ` • Lugar ${place} de ${total}` : '') +
          (bonus ? ` • +${bonus} de premio` : ''),
        coins: useRun.getState().coins,
        record,
      },
    });
  };

  // 👫 mensajes de la sala
  useEffect(() => {
    if (mode === 'solo') return;
    return onNetMessage((m, from) => {
      if (mode === 'host') {
        if (m.t === 'grab') hostGrab(from, m.i);
        return;
      }
      if (m.t === 'stars') {
        m.s.forEach((w, i) => {
          const s = slots[i];
          if (!s) return;
          const wasActive = s.active;
          s.pos.set(w[0], w[1], w[2]);
          s.active = w[3] === 1;
          s.rainbow = w[4] === 1;
          if (s.active && !wasActive) s.age = 0;
        });
      } else if (m.t === 'score') {
        const s = slots[m.i];
        if (m.id === useRoom.getState().myId) award(m.v, s?.pos ?? new THREE.Vector3(), m.v === 3);
        else {
          if (s) burst(s.pos, m.v === 3 ? '#ff5fa2' : '#ffd23f', 10);
          if (m.v === 3) useRun.getState().showToast(`🌈 ¡${nameOf(m.id)} atrapó la arcoíris!`);
        }
        if (s) s.active = false;
      } else if (m.t === 'end') {
        const mine = m.ranking.find((r) => r.id === useRoom.getState().myId);
        showResult(mine?.place, m.ranking.length);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /** Bots: van por la estrella más cercana y brincan si está alta */
  const updateStarBots = (dt: number) => {
    for (const b of bots) {
      let ti = botTarget.current.get(b.id) ?? -1;
      if (ti < 0 || !slots[ti]?.active || Math.random() < dt * 0.4) {
        let best = -1, bd = Infinity;
        slots.forEach((s, i) => {
          if (!s.active) return;
          const d = Math.hypot(s.pos.x - b.pos.x, s.pos.z - b.pos.z) * (0.8 + Math.random() * 0.4);
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        ti = best;
        botTarget.current.set(b.id, ti);
      }
      const s = slots[ti];
      let moving = false;
      if (s?.active) {
        const dx = s.pos.x - b.pos.x, dz = s.pos.z - b.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.3) {
          const step = Math.min(d, b.speed * dt);
          b.pos.x += (dx / d) * step;
          b.pos.z += (dz / d) * step;
          let df = Math.atan2(dx, dz) - b.facing;
          df = Math.atan2(Math.sin(df), Math.cos(df));
          b.facing += df * (1 - Math.exp(-10 * dt));
          moving = true;
        }
        // brincar si la estrella está arriba
        const ground = groundTop(b.pos.x, b.pos.z, 0.2);
        const wantY = d < 1.8 && s.pos.y - 1.1 > ground + 0.5 ? s.pos.y - 1.1 : ground;
        b.pos.y += (wantY - b.pos.y) * (1 - Math.exp(-(wantY > b.pos.y ? 7 : 10) * dt));
        if (b.pos.distanceTo(new THREE.Vector3(s.pos.x, s.pos.y - 1.1, s.pos.z)) < 1.5) hostGrab(b.id, ti);
      }
      b.anim.speed = moving ? 1 : 0;
      b.anim.grounded = Math.abs(b.pos.y - groundTop(b.pos.x, b.pos.z, 0.2)) < 0.15;
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
      if (mode !== 'guest') for (const s of slots) if (!s.active) placeStar(s, e.ctrl.pos);
      if (mode === 'host') {
        updateStarBots(dt);
        sendAcc.current += dt;
        if (dirty.current && sendAcc.current > 0.15) {
          sendAcc.current = 0;
          dirty.current = false;
          broadcast({ t: 'stars', s: slots.map((s): StarWire => [Math.round(s.pos.x * 100) / 100, Math.round(s.pos.y * 100) / 100, Math.round(s.pos.z * 100) / 100, s.active ? 1 : 0, s.rainbow ? 1 : 0]) });
        }
      }

      if (run.status !== 'playing' || over.current) return;
      timeLeft.current = Math.max(0, timeLeft.current - dt);
      if (Math.ceil(timeLeft.current) !== Math.ceil(run.time)) run.set({ time: timeLeft.current });
      const sec = Math.ceil(timeLeft.current);
      if (sec <= 5 && sec > 0 && sec !== lastBeep.current) {
        lastBeep.current = sec;
        sfx.count();
      }

      const c = e.ctrl.pos.clone();
      c.y += 1.1;
      slots.forEach((s, i) => {
        if (!s.active || s.pos.distanceTo(c) >= 1.5) return;
        if (mode === 'solo') {
          s.active = false;
          award(s.rainbow ? 3 : 1, s.pos, s.rainbow);
        } else if (mode === 'host') hostGrab(useRoom.getState().myId, i);
        else {
          // invitado: la escondo ya y le pregunto al anfitrión si fui la primera
          s.active = false;
          sendToHost({ t: 'grab', i });
        }
      });

      if (timeLeft.current <= 0) {
        if (mode === 'solo') showResult();
        else if (mode === 'host') {
          const r = ranking();
          broadcast({ t: 'end', ranking: r });
          const mine = r.find((x) => x.id === useRoom.getState().myId);
          showResult(mine?.place, r.length);
        } else run.set({ time: 0 }); // el invitado espera los lugares del anfitrión
      }
    },
  };

  const botEntries = (): PosEntry[] =>
    bots.map((b) => [b.id, Math.round(b.pos.x * 100) / 100, Math.round(b.pos.y * 100) / 100, Math.round(b.pos.z * 100) / 100, Math.round(b.facing * 100) / 100, b.anim.speed, b.anim.grounded ? 1 : 0, 0]);

  return (
    <>
      <fog attach="fog" args={['#d7eeff', 50, 130]} />
      <PlayWorld platforms={platforms} spawn={spawn} yaw={0} killY={-2.5} avatar={avatar} hooks={hooks} thumb={thumb} onEngine={(e) => (engine.current = e)} />
      <Stars slots={slots} />
      {mode === 'host' && <BotsView bots={bots} />}
      {mode !== 'solo' && (
        <>
          <NetSync engine={engine} extra={mode === 'host' ? botEntries : undefined} />
          <RemotePlayers />
        </>
      )}
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

/** ⚡ 60 florecitas dibujadas de un jalón (InstancedMesh) */
function Flowers() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const cs = ['#ff7ab6', '#ffffff', '#ffcf33', '#b07cff'].map((c) => new THREE.Color(c));
    const d = new THREE.Object3D();
    for (let i = 0; i < 60; i++) {
      d.position.set((Math.random() - 0.5) * 44, 0.1, (Math.random() - 0.5) * 44);
      d.scale.set(1, 0.5, 1);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, cs[i % cs.length]);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 60]}>
      <sphereGeometry args={[0.12, 8, 6]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}
