import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mat, starGeo } from '../../three/shapes';

export interface CoinData {
  pos: THREE.Vector3;
  taken: boolean;
  t: number; // animación al agarrarla
}

const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 24);
coinGeo.rotateX(Math.PI / 2);

export function Coins({ coins }: { coins: CoinData[] }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const m = mat('#ffc928', { metal: 0.5, rough: 0.3, emissive: 0.25 });
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    coins.forEach((c, i) => {
      const o = refs.current[i];
      if (!o) return;
      if (c.taken) {
        c.t += dt;
        o.position.y = c.pos.y + c.t * 6;
        o.scale.setScalar(Math.max(0, 1 - c.t * 3));
        o.visible = c.t < 0.35;
      } else {
        o.visible = true;
        o.scale.setScalar(1);
        o.position.set(c.pos.x, c.pos.y + Math.sin(t * 3 + i) * 0.12, c.pos.z);
      }
      o.rotation.y = t * 3 + i;
    });
  });
  return (
    <>
      {coins.map((c, i) => (
        <mesh key={i} ref={(o) => void (refs.current[i] = o)} geometry={coinGeo} material={m} position={c.pos} castShadow />
      ))}
    </>
  );
}

export interface StarSlot {
  pos: THREE.Vector3;
  active: boolean;
  rainbow: boolean;
  age: number;
}

export function Stars({ slots }: { slots: StarSlot[] }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useMemo(
    () =>
      slots.map(
        () =>
          new THREE.MeshStandardMaterial({
            color: '#ffd23f', emissive: '#ffb800', emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.2,
          }),
      ),
    [slots],
  );
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    slots.forEach((st, i) => {
      const o = refs.current[i];
      if (!o) return;
      o.visible = st.active;
      if (!st.active) return;
      st.age += dt;
      const pop = Math.min(1, st.age * 3);
      const sc = (st.rainbow ? 1.25 : 1) * (pop < 1 ? pop * (1.3 - 0.3 * pop) : 1);
      o.scale.setScalar(sc * 1.4);
      o.position.set(st.pos.x, st.pos.y + Math.sin(t * 2.5 + i) * 0.2, st.pos.z);
      o.rotation.y = t * 2 + i;
      const m = mats[i];
      if (st.rainbow) {
        m.color.setHSL((t * 0.5 + i * 0.1) % 1, 0.9, 0.62);
        m.emissive.copy(m.color);
      } else {
        m.color.set('#ffd23f');
        m.emissive.set('#ffb800');
      }
    });
  });
  return (
    <>
      {slots.map((_, i) => (
        <mesh key={i} ref={(o) => void (refs.current[i] = o)} geometry={starGeo()} material={mats[i]} castShadow />
      ))}
    </>
  );
}

