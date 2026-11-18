import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mat, rbox } from '../../three/shapes';
import { CITY_HALF, ROADS, ROAD_W, SHOPS, TREES } from './cityData';

/* ---------------- Calles ---------------- */
export function Roads() {
  const len = CITY_HALF * 2 + 10;
  const dashes = useRef<THREE.InstancedMesh>(null);
  const count = ROADS.length * 2 * Math.floor(len / 6);
  useLayoutEffect(() => {
    const m = dashes.current;
    if (!m) return;
    const d = new THREE.Object3D();
    let i = 0;
    for (const r of ROADS)
      for (let t = -len / 2 + 3; t < len / 2; t += 6) {
        d.position.set(t, 0.035, r);
        d.rotation.set(0, 0, 0);
        d.updateMatrix();
        m.setMatrixAt(i++, d.matrix);
        d.position.set(r, 0.035, t);
        d.rotation.set(0, Math.PI / 2, 0);
        d.updateMatrix();
        m.setMatrixAt(i++, d.matrix);
      }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
  }, [len]);
  return (
    <group>
      {ROADS.map((r) => (
        <group key={r}>
          {/* banqueta + calle (en x y en z) */}
          <mesh receiveShadow position={[0, 0.01, r]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#e9e4f2')}>
            <planeGeometry args={[len, ROAD_W + 4]} />
          </mesh>
          <mesh receiveShadow position={[r, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#e9e4f2')}>
            <planeGeometry args={[ROAD_W + 4, len]} />
          </mesh>
          <mesh receiveShadow position={[0, 0.02, r]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#6b6f80')}>
            <planeGeometry args={[len, ROAD_W]} />
          </mesh>
          <mesh receiveShadow position={[r, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#6b6f80')}>
            <planeGeometry args={[ROAD_W, len]} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={dashes} args={[undefined, undefined, count]}>
        <boxGeometry args={[2.4, 0.02, 0.32]} />
        <meshLambertMaterial color="#ffffff" />
      </instancedMesh>
    </group>
  );
}

/* ---------------- Árboles (copa) ---------------- */
export function TreeTops() {
  const leaves = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const cs = ['#3fbf5a', '#58cf6c', '#2fae4d'].map((c) => new THREE.Color(c));
    TREES.forEach(([x, z], i) => {
      d.position.set(x, 3.3, z);
      d.scale.setScalar(1 + (i % 3) * 0.15);
      d.updateMatrix();
      leaves.current?.setMatrixAt(i, d.matrix);
      leaves.current?.setColorAt(i, cs[i % 3]);
      d.position.set(x, 1.1, z);
      d.scale.setScalar(1);
      d.updateMatrix();
      trunks.current?.setMatrixAt(i, d.matrix);
    });
    if (leaves.current) {
      leaves.current.instanceMatrix.needsUpdate = true;
      if (leaves.current.instanceColor) leaves.current.instanceColor.needsUpdate = true;
    }
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <>
      <instancedMesh ref={trunks} args={[rbox(0.7, 2.2, 0.7, 0.1), mat('#a86b3c'), TREES.length]} castShadow />
      <instancedMesh ref={leaves} args={[undefined, undefined, TREES.length]} castShadow>
        <sphereGeometry args={[1.7, 14, 12]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </>
  );
}

/* ---------------- Ventanas de edificios ---------------- */
export function Windows({ buildings }: { buildings: { x: number; z: number; w: number; d: number; h: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (const b of buildings) {
      for (let y = 2; y < b.h - 1; y += 2.4) {
        for (let t = -b.w / 2 + 1.6; t < b.w / 2 - 1; t += 2.4) {
          out.push([b.x + t, y, b.z + b.d / 2 + 0.03, 0]);
          out.push([b.x + t, y, b.z - b.d / 2 - 0.03, Math.PI]);
        }
        for (let t = -b.d / 2 + 1.6; t < b.d / 2 - 1; t += 2.4) {
          out.push([b.x + b.w / 2 + 0.03, y, b.z + t, Math.PI / 2]);
          out.push([b.x - b.w / 2 - 0.03, y, b.z + t, -Math.PI / 2]);
        }
      }
    }
    return out;
  }, [buildings]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const d = new THREE.Object3D();
    spots.forEach(([x, y, z, r], i) => {
      d.position.set(x, y, z);
      d.rotation.set(0, r, 0);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]}>
      <planeGeometry args={[1.2, 1.3]} />
      <meshStandardMaterial color="#9fdcff" roughness={0.2} metalness={0.1} emissive="#bfe9ff" emissiveIntensity={0.15} />
    </instancedMesh>
  );
}

/* ---------------- Letreros ---------------- */
const signCache = new Map<string, THREE.Material>();
export function signMat(text: string, color: string) {
  const k = text + color;
  let m = signCache.get(k);
  if (!m) {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 128;
    const c = cv.getContext('2d')!;
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(6, 6, 500, 116, 40);
    c.fill();
    c.lineWidth = 10;
    c.strokeStyle = '#ffffff';
    c.stroke();
    c.fillStyle = '#ffffff';
    c.font = 'bold 62px Fredoka, ui-rounded, system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 68, 470);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    m = new THREE.MeshBasicMaterial({ map: t, transparent: true });
    signCache.set(k, m);
  }
  return m;
}

export function Signs({ houseName }: { houseName: string }) {
  return (
    <>
      {SHOPS.map((s) => (
        <mesh key={s.id} position={s.sign.pos} rotation={[0, s.sign.rotY, 0]} material={signMat(`${s.emoji} ${s.id === 'house' ? `Casa de ${houseName}` : s.name}`, s.sign.color)}>
          <planeGeometry args={[s.id === 'balloons' ? 3 : 5.6, s.id === 'balloons' ? 0.75 : 1.4]} />
        </mesh>
      ))}
    </>
  );
}

/* ---------------- Casita ---------------- */
export function HouseDecor() {
  return (
    <group position={[-18, 0, -21]}>
      {/* techo de dos aguas */}
      <mesh castShadow material={mat('#c96f6f')} position={[0, 5.9, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.05, 1, 0.82]}>
        <coneGeometry args={[8.2, 2.8, 4]} />
      </mesh>
      {/* puerta y ventanas */}
      <mesh material={mat('#8a5a3c')} position={[0, 1.3, 4.03]}>
        <boxGeometry args={[1.6, 2.6, 0.08]} />
      </mesh>
      <mesh material={mat('#ffd23f')} position={[0.55, 1.3, 4.1]}>
        <sphereGeometry args={[0.1, 8, 6]} />
      </mesh>
      {[-3, 3].map((x) => (
        <group key={x} position={[x, 2.4, 4.03]}>
          <mesh material={mat('#9fdcff', { rough: 0.2 })}>
            <boxGeometry args={[1.8, 1.4, 0.06]} />
          </mesh>
          <mesh material={mat('#ffffff')} position={[0, 0, 0.04]}>
            <boxGeometry args={[0.12, 1.4, 0.04]} />
          </mesh>
          <mesh material={mat('#ff9ecb')} position={[0, -0.85, 0.15]}>
            <boxGeometry args={[2, 0.3, 0.35]} />
          </mesh>
        </group>
      ))}
      {/* jardín con cerca y flores */}
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} castShadow material={mat('#ffffff')} position={[-5 + i, 0.45, 7.6]}>
          <boxGeometry args={[0.18, 0.9, 0.18]} />
        </mesh>
      ))}
      <mesh material={mat('#ffffff')} position={[-2.75, 0.7, 7.6]}>
        <boxGeometry args={[4.6, 0.12, 0.1]} />
      </mesh>
      <mesh material={mat('#ffffff')} position={[2.75, 0.7, 7.6]}>
        <boxGeometry args={[4.6, 0.12, 0.1]} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={`f${i}`} material={mat(['#ff7ab6', '#ffd23f', '#b07cff', '#ffffff'][i % 4])} position={[-4.5 + (i % 7) * 1.5 + (i > 6 ? 0.7 : 0), 0.2, 5 + (i > 6 ? 1.3 : 0)]}>
          <sphereGeometry args={[0.2, 8, 6]} />
        </mesh>
      ))}
      {/* buzón */}
      <group position={[3.8, 0, 7.2]}>
        <mesh material={mat('#8a5a3c')} position={[0, 0.5, 0]}>
          <boxGeometry args={[0.12, 1, 0.12]} />
        </mesh>
        <mesh material={mat('#3cb7f5')} position={[0, 1.1, 0]}>
          <boxGeometry args={[0.4, 0.35, 0.6]} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- Tiendas ---------------- */
function Awning({ x, z, colors, w = 7.6 }: { x: number; z: number; colors: [string, string]; w?: number }) {
  return (
    <group position={[x, 3.1, z]} rotation={[0.35, 0, 0]}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} castShadow material={mat(colors[i % 2])} position={[-w / 2 + w / 16 + (i * w) / 8, 0, 0.9]}>
          <boxGeometry args={[w / 8, 0.1, 1.9]} />
        </mesh>
      ))}
    </group>
  );
}

export function ShopsDecor() {
  const spin = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (spin.current) spin.current.children.forEach((c, i) => (c.rotation.y = s.clock.elapsedTime * 0.8 + i));
  });
  return (
    <>
      <Awning x={12.5} z={-17.5} colors={['#7fd8ff', '#ffffff']} />
      <Awning x={23.5} z={-17.5} colors={['#ff4d4d', '#ffffff']} />
      <Awning x={18} z={18} colors={['#b07cff', '#ffd6ec']} w={12} />
      {/* puertas */}
      {[12.5, 23.5].map((x) => (
        <mesh key={x} material={mat('#ffffff', { rough: 0.2 })} position={[x, 1.3, -17.46]}>
          <boxGeometry args={[2.4, 2.6, 0.06]} />
        </mesh>
      ))}
      <mesh material={mat('#ffffff', { rough: 0.2 })} position={[18, 1.4, 17.96]}>
        <boxGeometry args={[3, 2.8, 0.06]} />
      </mesh>
      {/* aparadores de la tienda de ropa */}
      {[13, 23].map((x) => (
        <mesh key={x} material={mat('#9fdcff', { rough: 0.15 })} position={[x, 1.8, 17.96]}>
          <boxGeometry args={[3.4, 2.4, 0.05]} />
        </mesh>
      ))}
      {/* helado y pizza gigantes en el techo (giran) */}
      <group ref={spin}>
        <group position={[12.5, 5.6, -21]}>
          <mesh castShadow material={mat('#e0a35c')} position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.8, 2.2, 14]} />
          </mesh>
          <mesh castShadow material={mat('#ff9ecb')} position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.95, 16, 14]} />
          </mesh>
          <mesh material={mat('#ff3d5a')} position={[0, 2.1, 0]}>
            <sphereGeometry args={[0.25, 10, 8]} />
          </mesh>
        </group>
        <group position={[23.5, 5.4, -21]} rotation={[Math.PI / 2.4, 0, 0]}>
          <mesh castShadow material={mat('#ffcf4a')}>
            <cylinderGeometry args={[1.6, 1.6, 0.25, 3]} />
          </mesh>
          {[[0.4, 0.2], [-0.5, -0.2], [0.1, -0.7]].map(([x, z]) => (
            <mesh key={x} material={mat('#e0413a')} position={[x, 0.15, z]}>
              <cylinderGeometry args={[0.28, 0.28, 0.06, 12]} />
            </mesh>
          ))}
        </group>
      </group>
    </>
  );
}

/* ---------------- Parque: fuente, globos y bancas ---------------- */
export function ParkDecor() {
  const water = useRef<THREE.Mesh>(null);
  const balloons = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (water.current) water.current.scale.y = 1 + Math.sin(t * 6) * 0.12;
    balloons.current?.children.forEach((c, i) => (c.position.y = 2.8 + Math.sin(t * 1.5 + i) * 0.15));
  });
  return (
    <>
      <group position={[-18, 0, 18]}>
        <mesh material={mat('#5ccfff', { rough: 0.1 })} position={[0, 0.82, 0]}>
          <cylinderGeometry args={[2.2, 2.2, 0.05, 28]} />
        </mesh>
        <mesh castShadow material={mat('#ffffff')} position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.35, 0.5, 1.4, 14]} />
        </mesh>
        <mesh material={mat('#ffffff')} position={[0, 2.1, 0]}>
          <cylinderGeometry args={[1, 0.6, 0.25, 18]} />
        </mesh>
        <mesh ref={water} material={mat('#a8e6ff', { opacity: 0.85, emissive: 0.2 })} position={[0, 2.7, 0]}>
          <coneGeometry args={[0.5, 1.2, 12]} />
        </mesh>
      </group>
      {/* kiosko de globos */}
      <group ref={balloons} position={[-9.5, 0, 10.5]}>
        {['#ff4d8b', '#ffd23f', '#3cb7f5', '#2fd39a', '#b07cff'].map((c, i) => (
          <mesh key={c} castShadow material={mat(c, { rough: 0.25 })} position={[-1 + i * 0.5, 2.8, (i % 2) * 0.4]} scale={[1, 1.18, 1]}>
            <sphereGeometry args={[0.35, 14, 12]} />
          </mesh>
        ))}
      </group>
      {/* bancas */}
      {[[-26, 18, Math.PI / 2], [-18, 27, 0], [-10, 18, Math.PI / 2]].map(([x, z, r]) => (
        <group key={`${x}${z}`} position={[x, 0, z]} rotation={[0, r, 0]}>
          <mesh castShadow material={mat('#c98a4b')} position={[0, 0.55, 0]}>
            <boxGeometry args={[2.4, 0.15, 0.7]} />
          </mesh>
          <mesh castShadow material={mat('#c98a4b')} position={[0, 0.95, -0.3]}>
            <boxGeometry args={[2.4, 0.6, 0.12]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={mat('#6b6f80')} position={[s * 1, 0.27, 0]}>
              <boxGeometry args={[0.12, 0.55, 0.6]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/* ---------------- Carros y motos ---------------- */
const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.34, 16);
wheelGeo.rotateZ(Math.PI / 2);
const motoWheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.18, 16);
motoWheelGeo.rotateZ(Math.PI / 2);

export const CarModel = forwardRef<THREE.Group, { color: string }>(function CarModel({ color }, ref) {
  const body = mat(color, { rough: 0.35, metal: 0.1 });
  return (
    <group ref={ref}>
      <mesh castShadow geometry={rbox(2.3, 0.75, 4.2, 0.28)} material={body} position={[0, 0.85, 0]} />
      {/* cofre y cajuela */}
      <mesh castShadow geometry={rbox(2.1, 0.3, 1.2, 0.14)} material={body} position={[0, 1.3, 1.35]} />
      <mesh castShadow geometry={rbox(2.1, 0.3, 0.9, 0.14)} material={body} position={[0, 1.3, -1.55]} />
      {/* parabrisas */}
      <mesh material={mat('#bfe9ff', { opacity: 0.55, rough: 0.05 })} position={[0, 1.65, 0.7]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[1.9, 0.6, 0.06]} />
      </mesh>
      {/* asientos */}
      <mesh geometry={rbox(1.9, 0.25, 1.2, 0.1)} material={mat('#ffffff')} position={[0, 1.15, -0.3]} />
      <mesh geometry={rbox(1.9, 0.7, 0.25, 0.1)} material={mat('#ffffff')} position={[0, 1.5, -0.95]} />
      {/* volante */}
      <mesh material={mat('#33264d')} position={[0, 1.55, 0.35]} rotation={[-0.9, 0, 0]}>
        <torusGeometry args={[0.24, 0.05, 8, 18]} />
      </mesh>
      {/* faros */}
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} material={mat('#fff6b3', { emissive: 0.6 })} position={[x, 0.95, 2.1]}>
          <sphereGeometry args={[0.18, 10, 8]} />
        </mesh>
      ))}
      {[-0.8, 0.8].map((x) => (
        <mesh key={`t${x}`} material={mat('#ff3d5a', { emissive: 0.4 })} position={[x, 0.95, -2.1]}>
          <boxGeometry args={[0.35, 0.18, 0.05]} />
        </mesh>
      ))}
      {/* llantas */}
      {[[-1.12, 1.35], [1.12, 1.35], [-1.12, -1.35], [1.12, -1.35]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0.45, z]}>
          <mesh castShadow geometry={wheelGeo} material={mat('#33264d')} />
          <mesh material={mat('#d9d9e3')} rotation={[0, 0, Math.PI / 2]} scale={[1, 0.6, 1]}>
            <cylinderGeometry args={[0.22, 0.22, 0.36, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

export const MotoModel = forwardRef<THREE.Group, { color: string }>(function MotoModel({ color }, ref) {
  const body = mat(color, { rough: 0.3, metal: 0.15 });
  return (
    <group ref={ref}>
      <mesh castShadow geometry={rbox(0.55, 0.55, 1.7, 0.2)} material={body} position={[0, 0.9, 0]} />
      <mesh castShadow geometry={rbox(0.5, 0.18, 0.8, 0.08)} material={mat('#33264d')} position={[0, 1.22, -0.25]} />
      <mesh castShadow geometry={rbox(0.45, 0.5, 0.35, 0.1)} material={body} position={[0, 1.25, 0.75]} />
      <mesh material={mat('#d9d9e3', { metal: 0.6, rough: 0.3 })} position={[0, 1.55, 0.85]}>
        <boxGeometry args={[1.1, 0.08, 0.08]} />
      </mesh>
      <mesh material={mat('#fff6b3', { emissive: 0.6 })} position={[0, 1.3, 0.95]}>
        <sphereGeometry args={[0.14, 10, 8]} />
      </mesh>
      {[0.8, -0.8].map((z) => (
        <mesh key={z} castShadow geometry={motoWheelGeo} material={mat('#33264d')} position={[0, 0.42, z]} />
      ))}
    </group>
  );
});
