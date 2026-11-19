import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '../../data/items';
import { input } from '../../lib/input';
import { sfx } from '../../lib/sound';
import { useGame } from '../../store';
import { Avatar, makeAnim, type AvatarAnim } from '../../three/Avatar';
import { mat } from '../../three/shapes';
import { Bursts, Cloud, burst } from '../fx';
import type { PlatformSpec } from '../physics';
import { PlayWorld, type Engine, type LevelHooks, type ThumbShot } from '../PlayWorld';
import { useRun } from '../runStore';
import { CarModel, signMat } from './cityModels';
import { NAMES, nameTag, randomAvatar } from './colorBots';

// 🏎️ Carreritas: 3 vueltas contra 5 bots. Pedal verde = acelerar, joystick = girar (abajo = frenar).

export const RACE_LAPS = 3;
const BOTS = 5;
const N = 800; // puntos de la pista
const HALF_W = 8.5; // medio ancho de la pista (anchita para que sea fácil)
const MAX_V = 23;
const BOOST_V = 32;
const KART = 0.85;
const BOOST_PADS = [110, 290, 470, 640];
const KART_COLORS = ['#ff5fa2', '#3cb7f5', '#ffd23f', '#2fd39a', '#b07cff', '#ff9a3c'];

/* ---------- La pista ---------- */
function buildTrack() {
  const pts: [number, number][] = [
    [0, -70], [45, -72], [78, -50], [82, -10], [60, 15], [30, 10], [10, 35], [25, 62], [-5, 80],
    [-45, 70], [-70, 40], [-62, 5], [-80, -30], [-50, -62],
  ];
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const P: THREE.Vector3[] = [];
  const T: THREE.Vector3[] = [];
  const R: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).setY(0).normalize();
    P.push(p);
    T.push(tan);
    R.push(new THREE.Vector3(tan.z, 0, -tan.x)); // derecha
  }
  return { P, T, R };
}
type Track = ReturnType<typeof buildTrack>;

const wrap = (i: number) => ((i % N) + N) % N;

/** El punto de la pista más cercano (buscando cerca del último) */
function nearestIdx(track: Track, pos: THREE.Vector3, last: number) {
  let best = last, bd = Infinity;
  for (let k = -30; k <= 30; k++) {
    const i = wrap(last + k);
    const p = track.P[i];
    const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

interface Racer {
  id: string;
  name: string;
  cfg: AvatarConfig;
  anim: AvatarAnim;
  color: string;
  pos: THREE.Vector3;
  heading: number;
  v: number;
  idx: number;
  lap: number;
  finished: number; // 0 = no ha llegado · si no, orden de llegada
  boostT: number;
  lane: number;
  skill: number;
  rubber: number; // los bots aceleran si van atrás de ti
  steer: number; // volante suavizado
  isPlayer: boolean;
}

export function RaceLevel({ avatar, thumb }: { avatar: AvatarConfig; thumb?: ThumbShot }) {
  const track = useMemo(buildTrack, []);
  const engine = useRef<Engine | null>(null);
  const playerName = useGame((s) => s.name);
  const platforms = useMemo<PlatformSpec[]>(() => [{ p: [0, -0.5, 0], s: [400, 1, 400], color: '#86df8c', hidden: true }], []);

  // 🏁 parrilla de salida: atrás de la línea, de dos en dos
  const racers = useMemo<Racer[]>(() => {
    const names = NAMES.filter((n) => !playerName || !n.toLowerCase().startsWith(playerName.toLowerCase().slice(0, 3))).sort(() => Math.random() - 0.5);
    const list: Racer[] = [];
    for (let k = 0; k < BOTS + 1; k++) {
      const isPlayer = k === 3; // sales en 4° lugar: ¡a rebasar!
      const row = Math.floor(k / 2);
      const idx = wrap(-14 - row * 11);
      const lane = k % 2 ? 3 : -3;
      const p = track.P[idx].clone().addScaledVector(track.R[idx], lane);
      list.push({
        id: isPlayer ? 'me' : `bot${k}`,
        name: isPlayer ? playerName : names[k % names.length],
        cfg: isPlayer ? avatar : randomAvatar(),
        anim: makeAnim(),
        color: KART_COLORS[k % KART_COLORS.length],
        pos: p,
        heading: Math.atan2(track.T[idx].x, track.T[idx].z),
        v: 0,
        idx,
        lap: 0,
        finished: 0,
        boostT: 0,
        lane,
        skill: 0.8 + Math.random() * 0.08,
        rubber: 1,
        steer: 0,
        isPlayer,
      });
    }
    list.forEach((r) => (r.anim.sit = true));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const me = racers.find((r) => r.isPlayer)!;
  // 📸 portada: cámara adelante de la parrilla viendo a los karts
  const shot = useMemo<ThumbShot | undefined>(() => {
    if (!thumb) return undefined;
    const ci = wrap(me.idx + 16);
    const cam = track.P[ci].clone().addScaledVector(track.R[ci], -4.5);
    const seat = me.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(me.heading), 0, Math.cos(me.heading)), -0.35 * KART);
    return { player: [seat.x, 0.47 * KART, seat.z], cam: [cam.x, 4.2, cam.z], look: [me.pos.x - 1, 1.2, me.pos.z] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumb]);
  const finishCount = useRef(0);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__race = { racers, track, N };
  const hudAcc = useRef(0);
  const wrongT = useRef(0);
  const boostSfxT = useRef(0);

  const progress = (r: Racer) => r.lap * N + r.idx;

  /** Mueve un kart (jugador o bot) un paso */
  const drive = (r: Racer, dt: number, throttle: number, steer: number) => {
    const top = r.boostT > 0 ? BOOST_V : MAX_V * (r.isPlayer ? 1 : r.skill * r.rubber);
    if (r.boostT > 0) r.boostT -= dt;
    if (throttle > 0) r.v = Math.min(top, r.v + (r.isPlayer ? 17 : 14) * throttle * dt);
    else if (throttle < 0) r.v = Math.max(-6, r.v + 22 * throttle * dt);
    else r.v *= Math.exp(-0.7 * dt); // sin pedal: se va frenando solito
    if (r.v > top) r.v += (top - r.v) * (1 - Math.exp(-2 * dt));
    r.heading -= steer * (r.isPlayer ? 1.75 : 2.2) * Math.min(1, Math.abs(r.v) / 6) * (r.v < 0 ? -1 : 1) * dt;
    if (r.isPlayer && Math.abs(steer) < 0.15 && r.v > 3) {
      // 🤝 ayudita: si no giras, el kart se acomoda solito con la pista
      const T0 = track.T[r.idx];
      let dh = Math.atan2(T0.x, T0.z) - r.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      if (Math.abs(dh) < 0.9) r.heading += dh * (1 - Math.exp(-1.6 * dt));
    }
    r.pos.x += Math.sin(r.heading) * r.v * dt;
    r.pos.z += Math.cos(r.heading) * r.v * dt;
    // pista: no salirse de las orillas
    const prev = r.idx;
    r.idx = nearestIdx(track, r.pos, r.idx);
    const P = track.P[r.idx], Rt = track.R[r.idx];
    const lat = (r.pos.x - P.x) * Rt.x + (r.pos.z - P.z) * Rt.z;
    const lim = HALF_W - 0.9;
    if (Math.abs(lat) > lim) {
      r.pos.addScaledVector(Rt, Math.sign(lat) * lim - lat);
      r.v *= Math.exp(-(r.isPlayer ? 0.8 : 2.5) * dt);
      if (r.isPlayer) {
        // resbalar por la orilla en vez de atorarse
        const T0 = track.T[r.idx];
        let dh = Math.atan2(T0.x, T0.z) - r.heading;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        if (Math.abs(dh) < 1.4) r.heading += dh * (1 - Math.exp(-4 * dt));
      }
    }
    // vueltas: cruzar la línea de meta
    if (prev > N * 0.8 && r.idx < N * 0.2) r.lap++;
    else if (prev < N * 0.2 && r.idx > N * 0.8) r.lap--;
    // turbos
    for (const b of BOOST_PADS) {
      const d = Math.abs(r.idx - b);
      if (d < 4 && Math.abs(lat) < 3) {
        if (r.boostT <= 0 && r.isPlayer) {
          sfx.bounce();
          useRun.getState().showToast('⚡ ¡Turbo!');
        }
        r.boostT = 1.3;
      }
    }
  };

  /** Bots: siguen la pista con su carril; corren un poco más si van atrás de ti */
  const driveBot = (r: Racer, dt: number) => {
    const look = Math.floor(18 + r.v * 0.7);
    const ti = wrap(r.idx + look);
    const target = track.P[ti].clone().addScaledVector(track.R[ti], r.lane);
    const want = Math.atan2(target.x - r.pos.x, target.z - r.pos.z);
    let dh = want - r.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const steer = THREE.MathUtils.clamp(-dh * 2.2, -1, 1);
    // frenar un poquito en curvas cerradas
    const curve = track.T[r.idx].dot(track.T[wrap(r.idx + 45)]);
    // atrás de ti: un poquito más rápidos · muy adelante: un poquito más lentos
    const gap = progress(me) - progress(r);
    r.rubber = gap > 80 ? 1.05 : gap > 0 ? 1 : gap < -60 ? 0.82 : 0.92;
    const throttle = curve < 0.75 && r.v > MAX_V * 0.8 ? -0.1 : 1;
    // cambiar de carril para rebasar
    if (Math.random() < dt * 0.25) r.lane = THREE.MathUtils.clamp(r.lane + (Math.random() - 0.5) * 6, -4, 4);
    drive(r, dt, throttle, steer);
  };

  const finishFor = (r: Racer) => {
    finishCount.current += 1;
    r.finished = finishCount.current;
    if (!r.isPlayer) return;
    const place = r.finished;
    const bonus = [15, 10, 6][place - 1] ?? 3;
    const run = useRun.getState();
    run.addCoins(bonus);
    r.anim.cheer = 999;
    if (engine.current) engine.current.anim.cheer = 999;
    sfx.win();
    burst(r.pos.clone().setY(2.5), '#ffd23f', 40);
    const medal = ['🥇', '🥈', '🥉'][place - 1];
    run.set({
      status: 'done',
      banner: null,
      result: {
        emoji: medal ?? '🏁',
        title: place === 1 ? '¡Ganaste la carrera!' : `¡Llegaste en ${place}° lugar!`,
        subtitle: `${RACE_LAPS} vueltas • Lugar ${place} de ${BOTS + 1} • +${bonus} de premio`,
        coins: useRun.getState().coins,
        record: false,
      },
    });
  };

  useLayoutEffect(() => {
    useRun.getState().set({ round: 1, checkpoint: 4, players: BOTS + 1 });
    if (thumb) return;
    const t = setTimeout(() => useRun.getState().showToast('🟢 ¡Deja apretado el pedal verde para acelerar!'), 3600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hooks = useRef<LevelHooks>({});
  hooks.current = {
    control: (e, dt) => {
      const run = useRun.getState();
      const go = run.status === 'playing' || run.status === 'done';
      if (!thumb && go) {
        // jugador: pedal = acelerar · joystick a los lados = girar · abajo = frenar
        if (!me.finished) {
          const brake = input.moveY < -0.5;
          const gas = input.gas || input.jumpHeld || input.moveY > 0.5;
          // volante "grueso": zona muerta + curva suave, para que no gire de golpe
          const x = input.moveX, ax = Math.abs(x);
          const want = ax < 0.12 ? 0 : Math.sign(x) * Math.pow((ax - 0.12) / 0.88, 1.6);
          me.steer += (want - me.steer) * (1 - Math.exp(-7 * dt));
          drive(me, dt, brake ? -1 : gas && run.status === 'playing' ? 1 : 0, me.steer);
        } else drive(me, dt, 0.3, 0);
        for (const r of racers) if (!r.isPlayer) driveBot(r, dt);
        // choques suaves entre karts
        for (let i = 0; i < racers.length; i++)
          for (let j = i + 1; j < racers.length; j++) {
            const a = racers[i], b = racers[j];
            const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
            const d = Math.hypot(dx, dz);
            if (d < 2.3 && d > 0.01) {
              const push = (2.3 - d) / 2;
              a.pos.x -= (dx / d) * push;
              a.pos.z -= (dz / d) * push;
              b.pos.x += (dx / d) * push;
              b.pos.z += (dz / d) * push;
              if ((a.isPlayer || b.isPlayer) && Math.random() < 0.3) sfx.bump();
            }
          }
        // ¿quién ya llegó?
        for (const r of racers) if (!r.finished && r.lap > RACE_LAPS) finishFor(r);
        // vueltas del jugador
        if (run.status === 'playing') {
          const shownLap = Math.min(RACE_LAPS, Math.max(1, me.lap));
          if (shownLap !== run.round) {
            sfx.checkpoint();
            run.showToast(shownLap === RACE_LAPS ? '🔥 ¡Última vuelta!' : `🏁 ¡Vuelta ${shownLap}!`);
          }
          // ¿vas al revés?
          const fwd = Math.sin(me.heading) * track.T[me.idx].x + Math.cos(me.heading) * track.T[me.idx].z;
          wrongT.current = fwd < -0.3 && me.v > 2 ? wrongT.current + dt : 0;
          const wrong = wrongT.current > 1;
          if (wrong && !run.banner) run.set({ banner: { name: '', color: '#ff3d5a', text: '⬅️ ¡Vas al revés!' }, bar: 0 });
          if (!wrong && run.banner) run.set({ banner: null });
          // posición (cada 0.2 s)
          hudAcc.current += dt;
          if (hudAcc.current > 0.2 || shownLap !== run.round) {
            hudAcc.current = 0;
            const order = [...racers].sort((a, b) => (a.finished && b.finished ? a.finished - b.finished : a.finished ? -1 : b.finished ? 1 : progress(b) - progress(a)));
            run.set({ round: shownLap, checkpoint: order.indexOf(me) + 1 });
          }
          if (me.boostT > 0) {
            boostSfxT.current -= dt;
            if (boostSfxT.current <= 0) boostSfxT.current = 0.4;
          }
        }
      }
      // la niña va sentada en su kart
      const seatZ = -0.35 * KART;
      e.ctrl.pos.set(me.pos.x + Math.sin(me.heading) * seatZ, 0.47 * KART, me.pos.z + Math.cos(me.heading) * seatZ);
      e.ctrl.vel.set(0, 0, 0);
      e.ctrl.facing = me.heading;
      e.followYaw = thumb ? null : me.heading + Math.PI;
      e.cam.dist = me.boostT > 0 ? 11 : 9.5;
      e.anim.sit = true;
      return true;
    },
  };

  return (
    <>
      <fog attach="fog" args={['#d7eeff', 60, 190]} />
      <PlayWorld
        platforms={platforms}
        spawn={me.pos}
        yaw={me.heading + Math.PI}
        killY={-20}
        avatar={avatar}
        hooks={hooks}
        thumb={shot}
        onEngine={(e) => {
          engine.current = e;
          e.cam.pitch = 0.3;
        }}
      />
      <TrackMesh track={track} />
      {racers.map((r) => (
        <KartView key={r.id} racer={r} />
      ))}
      <Bursts />
      {[[-90, 22, -60, 3], [90, 26, -40, 2.6], [-80, 20, 90, 2.8], [80, 28, 90, 3], [0, 30, -110, 3.5], [0, 26, 120, 3]].map(([x, y, z, sc], i) => (
        <Cloud key={i} position={[x, y, z]} scale={sc} />
      ))}
    </>
  );
}

/* ---------- Karts ---------- */
function KartView({ racer }: { racer: Racer }) {
  const ref = useRef<THREE.Group>(null);
  const tag = useMemo(() => nameTag(racer.name || 'Tú'), [racer.name]);
  const flame = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const g = ref.current;
    if (!g) return;
    g.position.copy(racer.pos);
    g.rotation.y = racer.heading;
    if (flame.current) {
      flame.current.visible = racer.boostT > 0;
      flame.current.scale.setScalar(0.8 + Math.sin(s.clock.elapsedTime * 40) * 0.25);
    }
  });
  return (
    <group ref={ref}>
      <group scale={KART}>
        <CarModel color={racer.color} />
      </group>
      <mesh ref={flame} position={[0, 0.7, -2.1]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <coneGeometry args={[0.35, 1.2, 10]} />
        <meshStandardMaterial color="#ff9a3c" emissive="#ff6a2b" emissiveIntensity={1} />
      </mesh>
      {!racer.isPlayer && (
        <>
          <group position={[0, 0.47 * KART, -0.35 * KART]}>
            <Avatar config={racer.cfg} anim={racer.anim} />
          </group>
          <sprite material={tag} position={[0, 3.2, 0]} scale={[0.15, 0.0375, 1]} />
        </>
      )}
    </group>
  );
}

/* ---------- Pista, orillas, gradas y meta ---------- */
function ribbon(track: Track, from: number, to: number, y: number, colorAt?: (i: number) => THREE.Color) {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const k = i % N;
    const p = track.P[k], r = track.R[k];
    pos.push(p.x + r.x * from, y, p.z + r.z * from, p.x + r.x * to, y, p.z + r.z * to);
    if (colorAt) {
      const c = colorAt(k);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    if (i < N) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colorAt) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function TrackMesh({ track }: { track: Track }) {
  const road = useMemo(() => ribbon(track, -HALF_W, HALF_W, 0.05), [track]);
  const red = useMemo(() => new THREE.Color('#ff4d4d'), []);
  const white = useMemo(() => new THREE.Color('#ffffff'), []);
  const curbL = useMemo(() => ribbon(track, -HALF_W - 1.1, -HALF_W, 0.07, (i) => (Math.floor(i / 5) % 2 ? red : white)), [track, red, white]);
  const curbR = useMemo(() => ribbon(track, HALF_W, HALF_W + 1.1, 0.07, (i) => (Math.floor(i / 5) % 2 ? red : white)), [track, red, white]);
  const tires = useRef<THREE.InstancedMesh>(null);
  const trees = useRef<THREE.InstancedMesh>(null);
  const pads = useRef<THREE.InstancedMesh>(null);
  const tireSpots = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < N; i += 4) for (const s of [-1, 1]) out.push(track.P[i].clone().addScaledVector(track.R[i], s * (HALF_W + 1.8)));
    return out;
  }, [track]);
  const treeSpots = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let k = 0; k < 400 && out.length < 90; k++) {
      const x = (Math.random() - 0.5) * 240, z = (Math.random() - 0.5) * 240;
      if (track.P.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (HALF_W + 7) ** 2)) continue;
      out.push(new THREE.Vector3(x, 0, z));
    }
    return out;
  }, [track]);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const cs = KART_COLORS.map((c) => new THREE.Color(c));
    tireSpots.forEach((p, i) => {
      d.position.set(p.x, 0.45, p.z);
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      tires.current?.setMatrixAt(i, d.matrix);
      tires.current?.setColorAt(i, cs[Math.floor(i / 6) % cs.length]);
    });
    treeSpots.forEach((p, i) => {
      d.position.set(p.x, 3, p.z);
      d.scale.setScalar(1 + (i % 3) * 0.2);
      d.updateMatrix();
      trees.current?.setMatrixAt(i, d.matrix);
    });
    BOOST_PADS.forEach((b, i) => {
      const p = track.P[b];
      d.position.set(p.x, 0.09, p.z);
      d.rotation.set(-Math.PI / 2, 0, Math.atan2(track.T[b].x, track.T[b].z) + Math.PI);
      d.scale.setScalar(1);
      d.updateMatrix();
      pads.current?.setMatrixAt(i, d.matrix);
    });
    for (const m of [tires.current, trees.current, pads.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [tireSpots, treeSpots, track]);

  const padTex = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 256;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#ffd23f';
    c.fillRect(0, 0, 128, 256);
    c.fillStyle = '#ff9a3c';
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      const y = 30 + k * 75;
      c.moveTo(14, y + 50);
      c.lineTo(64, y);
      c.lineTo(114, y + 50);
      c.lineTo(114, y + 74);
      c.lineTo(64, y + 24);
      c.lineTo(14, y + 74);
      c.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  // arco de salida
  const s0 = track.P[0], t0 = track.T[0], r0 = track.R[0];
  const arch = Math.atan2(t0.x, t0.z);
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} material={mat('#86df8c')}>
        <planeGeometry args={[420, 420]} />
      </mesh>
      <mesh receiveShadow geometry={road} material={mat('#5d6173')} />
      <mesh receiveShadow geometry={curbL}>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </mesh>
      <mesh receiveShadow geometry={curbR}>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </mesh>
      <instancedMesh ref={tires} args={[undefined, undefined, tireSpots.length]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[0.55, 0.55, 0.9, 12]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={trees} args={[undefined, undefined, treeSpots.length]} castShadow frustumCulled={false}>
        <coneGeometry args={[1.8, 4.5, 8]} />
        <meshStandardMaterial color="#3fbf5a" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={pads} args={[undefined, undefined, BOOST_PADS.length]} frustumCulled={false}>
        <planeGeometry args={[5, 7]} />
        <meshBasicMaterial map={padTex} />
      </instancedMesh>
      {/* línea de meta a cuadritos */}
      <group position={[s0.x, 0.1, s0.z]} rotation={[0, arch, 0]}>
        {Array.from({ length: Math.round(HALF_W * 2) }, (_, i) =>
          [0, 1].map((row) => (
            <mesh key={`${i}${row}`} position={[-HALF_W + 0.5 + i, 0, row - 0.5]} rotation={[-Math.PI / 2, 0, 0]} material={mat((i + row) % 2 ? '#33264d' : '#ffffff')}>
              <planeGeometry args={[1, 1]} />
            </mesh>
          )),
        )}
        {/* arco */}
        {[-1, 1].map((s) => (
          <mesh key={s} castShadow material={mat('#ff5fa2')} position={[s * (HALF_W + 1), 3, 0]}>
            <boxGeometry args={[0.8, 6, 0.8]} />
          </mesh>
        ))}
        <mesh castShadow material={mat('#ff5fa2')} position={[0, 6.2, 0]}>
          <boxGeometry args={[HALF_W * 2 + 2.8, 1.4, 0.8]} />
        </mesh>
        <mesh position={[0, 6.2, -0.42]} rotation={[0, Math.PI, 0]} material={signMat('🏁 Bloxi Grand Prix', '#8b5cf6')}>
          <planeGeometry args={[12, 1.3]} />
        </mesh>
        <mesh position={[0, 6.2, 0.42]} material={signMat('🏁 Bloxi Grand Prix', '#8b5cf6')}>
          <planeGeometry args={[12, 1.3]} />
        </mesh>
      </group>
      {/* gradas con público */}
      <group position={[s0.x + r0.x * (HALF_W + 9), 0, s0.z + r0.z * (HALF_W + 9)]} rotation={[0, arch + Math.PI / 2, 0]}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} castShadow receiveShadow material={mat(['#cde9ff', '#ffd1e6', '#fff0b3'][k])} position={[0, 0.6 + k * 1.2, k * 1.6]}>
            <boxGeometry args={[20, 1.2 + k * 2.4, 1.6]} />
          </mesh>
        ))}
        {Array.from({ length: 24 }, (_, i) => (
          <mesh key={i} material={mat(KART_COLORS[i % KART_COLORS.length])} position={[-9 + (i % 12) * 1.6, 2.1 + Math.floor(i / 12) * 1.2, 0.2 + Math.floor(i / 12) * 1.6]}>
            <sphereGeometry args={[0.4, 10, 8]} />
          </mesh>
        ))}
      </group>
    </>
  );
}
