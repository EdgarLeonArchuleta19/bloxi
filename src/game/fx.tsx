import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rbox } from '../three/shapes';

// Chispitas de colores al agarrar monedas/estrellas (un solo InstancedMesh = muy barato)
const N = 160;
const queue: { pos: THREE.Vector3; color: string; count: number }[] = [];

export function burst(pos: THREE.Vector3, color = '#ffcf33', count = 14) {
  queue.push({ pos: pos.clone(), color, count });
}

export function Bursts() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(
    () => ({
      p: Array.from({ length: N }, () => new THREE.Vector3()),
      v: Array.from({ length: N }, () => new THREE.Vector3()),
      life: new Float32Array(N),
      next: 0,
    }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const palette = ['#ff5fa2', '#ffcf33', '#3cb7f5', '#2fd39a', '#b07cff', '#ffffff'];

  // inicializar colores antes del primer render (para que el shader los incluya)
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const white = new THREE.Color('#ffffff');
    for (let k = 0; k < N; k++) {
      m.setColorAt(k, white);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      m.setMatrixAt(k, dummy.matrix);
    }
  }, [dummy]);

  useFrame((_, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.05);
    while (queue.length) {
      const b = queue.shift()!;
      for (let i = 0; i < b.count; i++) {
        const k = data.next++ % N;
        data.p[k].copy(b.pos);
        data.v[k].set((Math.random() - 0.5) * 8, Math.random() * 7 + 2, (Math.random() - 0.5) * 8);
        data.life[k] = 0.7 + Math.random() * 0.3;
        col.set(i % 2 ? b.color : palette[(Math.random() * palette.length) | 0]);
        m.setColorAt(k, col);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    for (let k = 0; k < N; k++) {
      if (data.life[k] > 0) {
        data.life[k] -= dt;
        data.v[k].y -= 18 * dt;
        data.p[k].addScaledVector(data.v[k], dt);
        dummy.position.copy(data.p[k]);
        dummy.rotation.set(data.life[k] * 8, data.life[k] * 6, 0);
        dummy.scale.setScalar(Math.max(0, data.life[k]));
      } else {
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      m.setMatrixAt(k, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[rbox(0.18, 0.18, 0.18, 0.04), undefined, N]} frustumCulled={false}>
      <meshBasicMaterial />
    </instancedMesh>
  );
}

// ⚡ todas las nubes comparten la misma geometría y material
const cloudGeo = new THREE.SphereGeometry(1, 12, 9);
const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });

/** Nubes esponjosas hechas de esferas */
export function Cloud({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const ref = useRef<THREE.Group>(null);
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame((s) => {
    if (ref.current) ref.current.position.x = position[0] + Math.sin(s.clock.elapsedTime * 0.1 + seed) * 3;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      {[[0, 0, 0, 1.6], [1.5, -0.2, 0.3, 1.2], [-1.5, -0.3, 0, 1.1], [0.6, 0.6, -0.2, 1.1], [-0.6, 0.4, 0.4, 1]].map(
        ([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} scale={r} geometry={cloudGeo} material={cloudMat} />
        ),
      )}
    </group>
  );
}
