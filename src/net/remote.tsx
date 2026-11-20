import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { nameTag } from '../game/levels/colorBots';
import type { Engine } from '../game/PlayWorld';
import { Avatar, makeAnim, type AvatarAnim } from '../three/Avatar';
import { broadcast, sendToHost, useRoom } from './room';

/** [id, x, y, z, mirada, velocidad 0..1, en el piso 0/1, eliminado 0/1] */
export type PosEntry = [string, number, number, number, number, number, number, number];

interface Remote {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  facing: number;
  targetFacing: number;
  speed: number;
  grounded: boolean;
  out: boolean;
  seen: boolean;
  raw: PosEntry; // lo último que llegó tal cual (algunos juegos usan los campos a su modo)
}

const remotes = new Map<string, Remote>();

export function updateRemote(e: PosEntry) {
  const [id, x, y, z, f, s, g, o] = e;
  if (id === useRoom.getState().myId) return;
  let r = remotes.get(id);
  if (!r) {
    r = { pos: new THREE.Vector3(x, y, z), target: new THREE.Vector3(), facing: f, targetFacing: f, speed: 0, grounded: true, out: false, seen: true, raw: e };
    remotes.set(id, r);
  }
  r.target.set(x, y, z);
  r.targetFacing = f;
  r.speed = s;
  r.grounded = g === 1;
  r.out = o === 1;
  r.seen = true;
  r.raw = e;
}

/** Lo último que sabemos de otro jugador (o bot del anfitrión) */
export function getRemote(id: string): Readonly<Remote> | undefined {
  return remotes.get(id);
}

export function clearRemotes() {
  remotes.clear();
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Manda mi posición ~12 veces por segundo.
 * El anfitrión además reenvía a todos las posiciones de todos (y de los bots).
 */
export function NetSync({
  engine, isOut, extra, self,
}: {
  engine: React.RefObject<Engine | null>;
  isOut?: () => boolean;
  extra?: () => PosEntry[];
  /** en vez de la posición del personaje, mandar esto (ej. el kart en Carreritas) */
  self?: () => PosEntry;
}) {
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.08) return;
    acc.current = 0;
    const e = engine.current;
    const room = useRoom.getState();
    if (!e || room.status !== 'playing') return;
    const c = e.ctrl;
    const mine: PosEntry = self ? self() : [room.myId, round2(c.pos.x), round2(c.pos.y), round2(c.pos.z), round2(c.facing), round2(c.speed01), c.grounded ? 1 : 0, isOut?.() ? 1 : 0];
    if (room.isHost) {
      const all: PosEntry[] = [mine];
      remotes.forEach((r, id) => {
        if (!id.startsWith('bot')) all.push(r.raw);
      });
      if (extra) all.push(...extra());
      broadcast({ t: 'state', s: all });
    } else {
      sendToHost({ t: 'pos', e: mine });
    }
  });
  return null;
}

/** Dibuja a los demás jugadores (y en invitados, también a los bots del anfitrión) */
export function RemotePlayers() {
  const players = useRoom((s) => s.players);
  const botPlayers = useRoom((s) => s.botPlayers);
  const myId = useRoom((s) => s.myId);
  const isHost = useRoom((s) => s.isHost);
  const list = useMemo(
    () => [...players, ...(isHost ? [] : botPlayers)].filter((p) => p.id !== myId),
    [players, botPlayers, myId, isHost],
  );
  return (
    <>
      {list.map((p) => (
        <RemoteOne key={p.id} id={p.id} name={p.name} avatar={p.avatar} />
      ))}
    </>
  );
}

function RemoteOne({ id, name, avatar }: { id: string; name: string; avatar: Parameters<typeof Avatar>[0]['config'] }) {
  const ref = useRef<THREE.Group>(null);
  const anim = useMemo<AvatarAnim>(makeAnim, []);
  const tag = useMemo(() => nameTag(name), [name]);
  useFrame((_, rawDt) => {
    const o = ref.current;
    const r = remotes.get(id);
    if (!o) return;
    if (!r || r.out) {
      o.visible = false;
      return;
    }
    o.visible = true;
    const dt = Math.min(rawDt, 0.05);
    // suavizar entre actualizaciones (llegan ~12 por segundo)
    if (r.pos.distanceTo(r.target) > 8) r.pos.copy(r.target);
    else r.pos.lerp(r.target, 1 - Math.exp(-14 * dt));
    let df = r.targetFacing - r.facing;
    df = Math.atan2(Math.sin(df), Math.cos(df));
    r.facing += df * (1 - Math.exp(-12 * dt));
    o.position.copy(r.pos);
    o.rotation.y = r.facing;
    anim.speed = r.speed;
    anim.grounded = r.grounded;
  });
  return (
    <group ref={ref} visible={false}>
      <Avatar config={avatar} anim={anim} />
      <sprite material={tag} position={[0, 2.95, 0]} scale={[0.15, 0.0375, 1]} />
    </group>
  );
}
