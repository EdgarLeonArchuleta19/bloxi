import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '../data/items';
import { input } from '../lib/input';
import { sfx } from '../lib/sound';
import { Avatar, makeAnim, type AvatarAnim } from '../three/Avatar';
import { mat, rbox } from '../three/shapes';
import { Controller, FADE_HOLD, makeSolids, updateFades, updateMovers, type PlatformSpec, type Solid } from './physics';
import { useRun } from './runStore';

export interface Engine {
  ctrl: Controller;
  cam: { yaw: number; pitch: number; dist: number };
  anim: AvatarAnim;
  solids: Solid[];
  /** si no es null, la cámara se acomoda sola detrás de este ángulo (ej. al manejar) */
  followYaw: number | null;
}

export interface LevelHooks {
  onTick?: (e: Engine, dt: number) => void;
  onLand?: (s: Solid, e: Engine) => void;
  onFall?: (e: Engine) => void;
  /** si regresa true, el nivel mueve al personaje (ej. manejando) y no se usa la física normal */
  control?: (e: Engine, dt: number) => boolean;
}

interface Props {
  platforms: PlatformSpec[];
  spawn: THREE.Vector3;
  yaw: number;
  killY: number;
  avatar: AvatarConfig;
  hooks: React.RefObject<LevelHooks>;
  onEngine?: (e: Engine) => void;
  thumb?: ThumbShot;
  /** la cámara no atraviesa paredes ni estas cajas extra (ej. copas de árboles) */
  camCollide?: boolean;
  camBlockers?: { min: THREE.Vector3; max: THREE.Vector3 }[];
}

/** Distancia a la que un rayo choca con una caja (Infinity si no choca) */
function rayBox(o: THREE.Vector3, d: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3) {
  let tmin = -Infinity, tmax = Infinity;
  for (const k of ['x', 'y', 'z'] as const) {
    if (Math.abs(d[k]) < 1e-6) {
      if (o[k] < min[k] || o[k] > max[k]) return Infinity;
      continue;
    }
    let t1 = (min[k] - o[k]) / d[k], t2 = (max[k] - o[k]) / d[k];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  if (tmax < 0 || tmin < 0) return Infinity; // detrás, o la cámara empieza adentro
  return tmin;
}
const camDir = new THREE.Vector3();

/** Modo foto para generar las portadas de los juegos */
export interface ThumbShot {
  player: [number, number, number];
  cam: [number, number, number];
  look: [number, number, number];
}

const tmpTarget = new THREE.Vector3();
const tmpCam = new THREE.Vector3();

export function PlayWorld({ platforms, spawn, yaw, killY, avatar, hooks, onEngine, thumb, camCollide, camBlockers }: Props) {
  const camera = useThree((s) => s.camera);
  const engine = useMemo<Engine>(() => {
    const ctrl = new Controller();
    ctrl.reset(spawn, yaw + Math.PI);
    return { ctrl, cam: { yaw, pitch: 0.42, dist: 9 }, anim: makeAnim(), solids: makeSolids(platforms), followYaw: null } as Engine;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // entregar el motor al nivel ya montado (en desarrollo React construye todo dos veces)
  useLayoutEffect(() => {
    onEngine?.(engine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);
  const player = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const clock = useRef(0);
  const first = useRef(true);
  // cámara suave: ángulo deseado (del dedo) y punto al que mira, suavizados
  const aim = useRef<{ yaw: number; pitch: number } | null>(null);
  const look = useRef(new THREE.Vector3());
  const dist = useRef(9);
  const colDist = useRef(99);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const { ctrl, cam, anim, solids } = engine;
    const status = useRun.getState().status;

    // cámara: arrastrar con el dedo (se desliza hacia el ángulo nuevo, sin brincos)
    if (!aim.current) aim.current = { yaw: cam.yaw, pitch: cam.pitch };
    aim.current.yaw -= input.camDX * 0.007;
    aim.current.pitch = THREE.MathUtils.clamp(aim.current.pitch + input.camDY * 0.004, 0.08, 1.15);
    input.camDX = input.camDY = 0;
    if (engine.followYaw !== null) {
      // manejando: la cámara se va acomodando detrás, suavecito
      let d = engine.followYaw - aim.current.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      aim.current.yaw += d * (1 - Math.exp(-2.5 * dt));
    }
    const turn = 1 - Math.exp(-16 * dt);
    cam.yaw += (aim.current.yaw - cam.yaw) * turn;
    cam.pitch += (aim.current.pitch - cam.pitch) * turn;

    if (status === 'playing' || status === 'done') {
      clock.current += dt;
      updateMovers(solids, clock.current);

      let wx = 0, wz = 0, jump = false;
      if (status === 'playing') {
        const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
        const rx = -fz, rz = fx;
        wx = fx * input.moveY + rx * input.moveX;
        wz = fz * input.moveY + rz * input.moveX;
        const len = Math.hypot(wx, wz);
        if (len > 1) { wx /= len; wz /= len; }
        jump = input.jump;
      }
      input.jump = false;

      const controlled = hooks.current?.control?.(engine, dt) ?? false;
      if (!controlled) {
        const steps = Math.ceil(dt / (1 / 100));
        const sdt = dt / steps;
        for (let i = 0; i < steps; i++) {
          const ev = ctrl.step(sdt, wx, wz, jump && i === 0, solids);
          if (ev.jumped) sfx.jump();
          if (ev.bounced) sfx.bounce();
          if (ev.landedOn) hooks.current?.onLand?.(ev.landedOn, engine);
        }
        if (ctrl.pos.y < killY) hooks.current?.onFall?.(engine);
      }
      hooks.current?.onTick?.(engine, dt);

      updateFades(solids, ctrl.ground, dt);
      for (const s of solids) {
        if (s.kind === 'fade' && s.obj) {
          // tiembla antes de desaparecer y luego se encoge
          const k = s.active ? 1 : 0;
          const shake = s.active && s.fadeT > 0 ? Math.sin(clock.current * 60) * 0.08 * (s.fadeT / FADE_HOLD) : 0;
          s.obj.position.set(s.center.x + shake, s.center.y, s.center.z);
          const target = k;
          const cur = s.obj.scale.x;
          s.obj.scale.setScalar(cur + (target - cur) * (1 - Math.exp(-14 * dt)) || 0.001);
        }
        if (s.squash > 0 && s.obj) {
          s.squash = Math.max(0, s.squash - dt * 3);
          s.obj.scale.y = 1 - Math.sin(s.squash * Math.PI) * 0.35;
        }
      }
    } else {
      input.jump = false;
    }

    if (thumb) {
      ctrl.pos.set(...thumb.player);
      ctrl.vel.set(0, 0, 0);
      ctrl.facing = Math.atan2(thumb.cam[0] - thumb.player[0], thumb.cam[2] - thumb.player[2]);
      anim.cheer = 1;
      cam.yaw = Math.atan2(thumb.cam[0] - thumb.player[0], thumb.cam[2] - thumb.player[2]);
    }
    anim.speed = anim.sit ? 0 : ctrl.speed01;
    anim.grounded = anim.sit || ctrl.grounded || ctrl.coyote > 0.05;
    anim.vy = ctrl.vel.y;
    if (player.current) {
      player.current.position.copy(ctrl.pos);
      player.current.rotation.y = ctrl.facing;
    }

    // cámara en tercera persona: un solo punto suavizado (sin temblorcitos)
    tmpTarget.copy(ctrl.pos).y += 1.6;
    if (first.current) {
      look.current.copy(tmpTarget);
      first.current = false;
    } else {
      // de lado sigue rápido; de arriba/abajo más suave para que los saltos no zangoloteen
      const fh = 1 - Math.exp(-14 * dt);
      const fv = 1 - Math.exp(-6 * dt);
      look.current.x += (tmpTarget.x - look.current.x) * fh;
      look.current.z += (tmpTarget.z - look.current.z) * fh;
      look.current.y += (tmpTarget.y - look.current.y) * fv;
      // al reaparecer lejos (caída), brincar directo
      if (look.current.distanceTo(tmpTarget) > 12) look.current.copy(tmpTarget);
    }
    dist.current += (cam.dist - dist.current) * (1 - Math.exp(-3 * dt));
    const cp = Math.cos(cam.pitch);
    tmpCam.set(
      look.current.x + Math.sin(cam.yaw) * cp * dist.current,
      look.current.y + Math.sin(cam.pitch) * dist.current,
      look.current.z + Math.cos(cam.yaw) * cp * dist.current,
    );
    if (camCollide) {
      // si hay una pared/árbol entre la niña y la cámara, la cámara se acerca
      camDir.subVectors(tmpCam, look.current);
      const len = camDir.length();
      camDir.divideScalar(len || 1);
      let best = len;
      for (let i = 1; i < solids.length; i++) {
        const s = solids[i];
        if (!s.active || s.max.y < 0.6) continue;
        const t = rayBox(look.current, camDir, s.min, s.max);
        if (t < best) best = t;
      }
      if (camBlockers) for (const b of camBlockers) {
        const t = rayBox(look.current, camDir, b.min, b.max);
        if (t < best) best = t;
      }
      const want = Math.max(1.6, best - 0.45);
      // acercarse rápido, alejarse despacito
      colDist.current = want < colDist.current ? want : colDist.current + (want - colDist.current) * (1 - Math.exp(-4 * dt));
      if (colDist.current < len) tmpCam.copy(look.current).addScaledVector(camDir, colDist.current);
    }
    camera.position.copy(tmpCam);
    camera.lookAt(look.current);
    if (thumb) {
      camera.position.set(...thumb.cam);
      camera.lookAt(...thumb.look);
    }

    // la luz con sombra sigue al personaje
    if (light.current) {
      // desde el lado de la cámara para que el personaje se vea iluminado
      light.current.position.set(
        ctrl.pos.x + Math.sin(cam.yaw + 0.6) * 9,
        ctrl.pos.y + 16,
        ctrl.pos.z + Math.cos(cam.yaw + 0.6) * 9,
      );
      light.current.target.position.copy(ctrl.pos);
      light.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <hemisphereLight args={['#ffffff', '#c9b6ff', 1.05]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={light}
        castShadow
        intensity={1.6}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0008}
      />
      <group ref={player}>
        <Avatar config={avatar} anim={engine.anim} />
      </group>
      {engine.solids.map((s, i) => (s.spec.hidden ? null : <Platform key={i} solid={s} />))}
    </>
  );
}

function Platform({ solid }: { solid: Solid }) {
  const { s, color, kind } = solid.spec;
  if (kind === 'lava') {
    return (
      <group ref={(o) => void (solid.obj = o)} position={solid.center}>
        <mesh geometry={rbox(s[0], s[1], s[2], 0.2)} material={mat('#ff5a1f', { emissive: 0.75 })} />
        <mesh geometry={rbox(s[0] - 1, 0.1, s[2] - 1, 0.05)} material={mat('#ffb23f', { emissive: 0.9 })} position={[0, s[1] / 2, 0]} />
      </group>
    );
  }
  const top = useMemo(() => '#' + new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.22).getHexString(), [color]);
  if (kind === 'bounce') {
    return (
      <group ref={(o) => void (solid.obj = o)} position={solid.center}>
        <mesh castShadow receiveShadow geometry={rbox(s[0], s[1], s[2], 0.2)} material={mat('#ff5fa2')} />
        {[[-0.3, -0.3], [0.35, 0.1], [-0.1, 0.35], [0.25, -0.35]].map(([x, z], i) => (
          <mesh key={i} material={mat('#ffffff')} position={[x * s[0], s[1] / 2, z * s[2]]} scale={[1, 0.35, 1]}>
            <sphereGeometry args={[0.22, 10, 8]} />
          </mesh>
        ))}
      </group>
    );
  }
  return (
    <group ref={(o) => void (solid.obj = o)} position={solid.center}>
      <mesh castShadow receiveShadow geometry={rbox(s[0], s[1], s[2], 0.12)} material={mat(color)} />
      <mesh receiveShadow geometry={rbox(s[0] + 0.06, 0.18, s[2] + 0.06, 0.08)} material={mat(top)} position={[0, s[1] / 2 - 0.07, 0]} />
    </group>
  );
}
