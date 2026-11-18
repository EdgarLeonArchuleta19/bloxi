import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '../../data/items';
import { sfx } from '../../lib/sound';
import { useGame } from '../../store';
import { mat } from '../../three/shapes';
import { Bursts, Cloud, burst } from '../fx';
import { PlayWorld, type LevelHooks, type ThumbShot } from '../PlayWorld';
import { useRun } from '../runStore';
import { buildObby } from './obbyData';
import { Coins, type CoinData } from './pickups';

export const OBBY_CHECKPOINTS = 3;
const FINISH_BONUS = 20;

export function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ObbyLevel({ avatar, thumb }: { avatar: AvatarConfig; thumb?: ThumbShot }) {
  const level = useMemo(buildObby, []);
  const coins = useMemo<CoinData[]>(() => level.coins.map((p) => ({ pos: new THREE.Vector3(...p), taken: false, t: 0 })), [level]);
  const spawn = useMemo(() => new THREE.Vector3(0, 0, -2), []);
  const respawn = useRef(spawn.clone());
  const timeAcc = useRef(0);
  const finishPos = useMemo(() => new THREE.Vector3(0, 15, 145), []);

  const hooks = useRef<LevelHooks>({});
  hooks.current = {
    onLand: (s, e) => {
      const run = useRun.getState();
      if (s.kind === 'checkpoint' && (s.spec.index ?? 0) > run.checkpoint) {
        run.set({ checkpoint: s.spec.index! });
        respawn.current.set(s.center.x, s.max.y, s.center.z);
        sfx.checkpoint();
        run.showToast('¡Checkpoint! 🚩');
        burst(e.ctrl.pos.clone().setY(e.ctrl.pos.y + 1), '#2fd39a', 24);
      }
      if (s.kind === 'finish' && run.status === 'playing') {
        const time = timeAcc.current;
        run.addCoins(FINISH_BONUS);
        const record = useGame.getState().setBestObby(time);
        e.anim.cheer = 999;
        sfx.win();
        for (let k = 0; k < 4; k++) burst(finishPos.clone().add(new THREE.Vector3((k - 1.5) * 2, 3, 0)), '#ffcf33', 30);
        run.set({
          status: 'done',
          result: {
            emoji: '🏆',
            title: '¡Llegaste a la meta!',
            subtitle: `Tiempo: ${formatTime(time)}  •  +${FINISH_BONUS} de premio`,
            coins: useRun.getState().coins,
            record,
          },
        });
      }
    },
    onFall: (e) => {
      sfx.fall();
      useRun.getState().showToast('¡Ups! Otra vez 💪');
      e.ctrl.reset(respawn.current, e.ctrl.facing);
    },
    onTick: (e, dt) => {
      const run = useRun.getState();
      if (run.status === 'playing') {
        timeAcc.current += dt;
        if (Math.floor(timeAcc.current * 10) !== Math.floor(run.time * 10)) run.set({ time: timeAcc.current });
      }
      const center = e.ctrl.pos.clone();
      center.y += 1.1;
      for (const c of coins) {
        if (!c.taken && c.pos.distanceTo(center) < 1.3) {
          c.taken = true;
          sfx.coin();
          burst(c.pos, '#ffcf33', 10);
          run.addCoins(1);
        }
      }
    },
  };

  return (
    <>
      <fog attach="fog" args={['#d7eeff', 45, 150]} />
      <PlayWorld platforms={level.platforms} spawn={spawn} yaw={Math.PI} killY={-12} avatar={avatar} hooks={hooks} thumb={thumb} />
      <Coins coins={coins} />
      <Bursts />
      <Flags />
      <Finish pos={finishPos} />
      <StartSign />
      {CLOUDS.map((c, i) => (
        <Cloud key={i} position={c[0]} scale={c[1]} />
      ))}
    </>
  );
}

const CLOUDS: [[number, number, number], number][] = [
  [[-14, -6, 10], 2], [[16, -4, 30], 2.4], [[-18, 2, 55], 1.8], [[20, 6, 80], 2.2], [[-16, 8, 100], 2],
  [[18, 10, 125], 2.5], [[-20, 12, 150], 2], [[10, -10, 60], 3], [[-8, -8, 120], 3], [[0, 25, 175], 3],
  [[25, 18, 160], 2], [[-28, 0, 20], 2.5],
];

function Flags() {
  const reached = useRun((s) => s.checkpoint);
  const flags: [number, number, number, number][] = [
    [1, 3, 37, 1],
    [2, 3.5, 66, 2],
    [3, 13, 105.5, 3],
  ];
  return (
    <>
      {flags.map(([idx, top, z]) => (
        <group key={idx} position={[2.6, top, z + 2.6]}>
          <mesh castShadow material={mat('#ffffff')} position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 3, 8]} />
          </mesh>
          <Flag up={reached >= idx} />
        </group>
      ))}
    </>
  );
}

function Flag({ up }: { up: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 4) * 0.2;
    ref.current.position.y += ((up ? 2.65 : 0.6) - ref.current.position.y) * 0.08;
  });
  return (
    <mesh ref={ref} castShadow material={mat(up ? '#2fd39a' : '#ff5fa2')} position={[-0.45, 0.6, 0]}>
      <boxGeometry args={[0.85, 0.55, 0.05]} />
    </mesh>
  );
}

function Finish({ pos }: { pos: THREE.Vector3 }) {
  const trophy = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (trophy.current) {
      trophy.current.rotation.y = s.clock.elapsedTime * 1.2;
      trophy.current.position.y = 2 + Math.sin(s.clock.elapsedTime * 2) * 0.15;
    }
  });
  const gold = mat('#ffc928', { metal: 0.6, rough: 0.25, emissive: 0.15 });
  const rainbow = ['#ff5f5f', '#ffa24c', '#ffd84a', '#5fe08a', '#4cc0ff', '#9b7bff'];
  return (
    <group position={pos}>
      {/* arcoíris */}
      {rainbow.map((c, i) => (
        <mesh key={c} position={[0, 0, 3.8]}>
          <torusGeometry args={[6.4 - i * 0.42, 0.21, 10, 48, Math.PI]} />
          <meshLambertMaterial color={c} />
        </mesh>
      ))}
      <group ref={trophy} position={[0, 2, -1]}>
        <mesh material={gold} position={[0, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.5, 0.3, 20]} />
        </mesh>
        <mesh material={gold} position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.5, 10]} />
        </mesh>
        <mesh material={gold} position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.65, 0.25, 0.85, 24]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={gold} position={[s * 0.7, 1.1, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.22, 0.06, 8, 20]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function StartSign() {
  return (
    <group position={[0, 0, 4.6]}>
      {[-4, 4].map((x) => (
        <mesh key={x} castShadow material={mat('#ffffff')} position={[x, 1.6, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 3.2, 10]} />
        </mesh>
      ))}
      {['#ff5fa2', '#ffcf33', '#3cb7f5', '#2fd39a', '#b07cff'].map((c, i) => (
        <mesh key={c} castShadow material={mat(c)} position={[-3.2 + i * 1.6, 3.15, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.45, 0.8, 3]} />
        </mesh>
      ))}
    </group>
  );
}
