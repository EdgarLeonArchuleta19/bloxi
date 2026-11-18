import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '../data/items';
import { Avatar, makeAnim } from './Avatar';
import { mat } from './shapes';

interface Props {
  config: AvatarConfig;
  cheerKey?: number;
  zoom?: number;
  className?: string;
}

/** Bloxi parado en una islita flotante. Se puede girar con el dedo y si lo tocas festeja. */
export function Showcase({ config, cheerKey = 0, zoom = 1, className }: Props) {
  const anim = useMemo(makeAnim, []);
  const spin = useRef({ angle: -0.35, vel: 0, dragging: false, lastX: 0, moved: 0 });

  useEffect(() => {
    if (cheerKey) anim.cheer = 1.3;
  }, [cheerKey, anim]);

  return (
    <div
      className={className}
      onPointerDown={(e) => {
        spin.current.dragging = true;
        spin.current.lastX = e.clientX;
        spin.current.moved = 0;
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const s = spin.current;
        if (!s.dragging) return;
        const dx = e.clientX - s.lastX;
        s.lastX = e.clientX;
        s.moved += Math.abs(dx);
        s.angle += dx * 0.012;
        s.vel = dx * 0.6;
      }}
      onPointerUp={() => {
        const s = spin.current;
        s.dragging = false;
        if (s.moved < 6) anim.cheer = 1.3; // un toque = festejo
      }}
      onPointerCancel={() => (spin.current.dragging = false)}
    >
      <Canvas
        shadows
        flat
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 1.65, 6.8 / zoom], fov: 32 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.22, 0)}
      >
        <ambientLight intensity={0.35} />
        <hemisphereLight args={['#ffffff', '#ffd6ec', 1.0]} />
        <directionalLight
          castShadow
          position={[3, 6, 4]}
          intensity={1.5}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-3}
          shadow-camera-right={3}
          shadow-camera-top={3}
          shadow-camera-bottom={-3}
        />
        <Spinner spin={spin}>
          <Avatar config={config} anim={anim} />
        </Spinner>
        <Island />
        <Sparkles />
      </Canvas>
    </div>
  );
}

function Spinner({ spin, children }: { spin: React.RefObject<{ angle: number; vel: number; dragging: boolean }>; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const s = spin.current;
    if (!s.dragging) {
      s.angle += s.vel * dt * 0.02;
      s.vel *= Math.exp(-dt * 3);
      // regresa suavemente a ver de frente
      if (Math.abs(s.vel) < 1) s.angle += (Math.sin(state.clock.elapsedTime * 0.5) * 0.35 - s.angle) * (1 - Math.exp(-dt * 1.5));
    }
    if (g.current) g.current.rotation.y = s.angle;
  });
  return <group ref={g}>{children}</group>;
}

function Island() {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current) g.current.position.y = Math.sin(s.clock.elapsedTime * 1.2) * 0.03 - 0.0;
  });
  return (
    <group ref={g}>
      <mesh receiveShadow material={mat('#7ee08a')} position={[0, -0.12, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.24, 40]} />
      </mesh>
      <mesh material={mat('#c58b5a')} position={[0, -0.6, 0]}>
        <cylinderGeometry args={[1.3, 0.35, 0.75, 40]} />
      </mesh>
      {[[-0.9, 0.5, '#ff7ab6'], [0.95, 0.35, '#ffcf33'], [0.6, -0.85, '#b07cff'], [-0.7, -0.8, '#ffffff']].map(([x, z, c], i) => (
        <group key={i} position={[x as number, 0.05, z as number]}>
          <mesh material={mat('#3fbf5a')} position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.12, 6]} />
          </mesh>
          <mesh material={mat(c as string)} position={[0, 0.1, 0]} scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.07, 10, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Sparkles() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 40;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (Math.random() - 0.5) * 5;
      p[i * 3 + 1] = Math.random() * 3;
      p[i * 3 + 2] = (Math.random() - 0.5) * 3 - 0.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.05;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#ffffff" size={0.05} transparent opacity={0.85} />
    </points>
  );
}
