import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mat, rbox } from '../../three/shapes';
import { CITY_HALF, FAIR, LAKE, PALMS, ROADS, ROAD_W, SHOPS, TREES, type Building } from './cityData';

/* ---------------- Piso y calles (cada capa a su altura: sin parpadeos) ---------------- */
const LAYER = { grass: 0, sidewalk: 0.04, road: 0.08, dash: 0.11 };
export function Roads() {
  const len = CITY_HALF * 2 + 10;
  const dashes = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const r of ROADS)
      for (let t = -len / 2 + 3; t < len / 2; t += 6) {
        // sin rayitas dentro de los cruces
        if (ROADS.some((r2) => Math.abs(t - r2) < ROAD_W / 2 + 1.5)) continue;
        out.push([t, r, 0], [r, t, Math.PI / 2]);
      }
    return out;
  }, [len]);
  useLayoutEffect(() => {
    const m = dashes.current;
    if (!m) return;
    const d = new THREE.Object3D();
    spots.forEach(([x, z, ry], i) => {
      d.position.set(x, LAYER.dash, z);
      d.rotation.set(0, ry, 0);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [spots]);
  const flat = (x: number, y: number, z: number, w: number, d: number, color: string) => (
    <mesh receiveShadow position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} material={mat(color)}>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
  return (
    <group>
      {flat(0, LAYER.grass, 0, len + 60, len + 60, '#86df8c')}
      {ROADS.map((r) => (
        <group key={r}>
          {flat(0, LAYER.sidewalk, r, len, ROAD_W + 4, '#e9e4f2')}
          {flat(r, LAYER.sidewalk, 0, ROAD_W + 4, len, '#e9e4f2')}
          {flat(0, LAYER.road, r, len, ROAD_W, '#6b6f80')}
          {flat(r, LAYER.road, 0, ROAD_W, len, '#6b6f80')}
        </group>
      ))}
      <instancedMesh ref={dashes} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <boxGeometry args={[2.4, 0.02, 0.32]} />
        <meshLambertMaterial color="#ffffff" />
      </instancedMesh>
    </group>
  );
}

/* ---------------- Edificios (todos de un jalón) ---------------- */
export function Apartments({ buildings }: { buildings: Building[] }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const roof = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    buildings.forEach((b, i) => {
      d.position.set(b.x, b.h / 2, b.z);
      d.scale.set(b.w, b.h, b.d);
      d.updateMatrix();
      body.current?.setMatrixAt(i, d.matrix);
      body.current?.setColorAt(i, c.set(b.color));
      d.position.set(b.x, b.h + 0.15, b.z);
      d.scale.set(b.w + 0.4, 0.3, b.d + 0.4);
      d.updateMatrix();
      roof.current?.setMatrixAt(i, d.matrix);
      roof.current?.setColorAt(i, c.set(b.color).lerp(new THREE.Color('#33264d'), 0.25));
    });
    for (const m of [body.current, roof.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [buildings]);
  return (
    <>
      <instancedMesh ref={body} args={[rbox(1, 1, 1, 0.04), undefined, buildings.length]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={roof} args={[undefined, undefined, buildings.length]} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </>
  );
}

/* ---------------- Árboles y palmeras ---------------- */
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
      <instancedMesh ref={trunks} args={[rbox(0.7, 2.2, 0.7, 0.1), mat('#a86b3c'), TREES.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={leaves} args={[undefined, undefined, TREES.length]} castShadow frustumCulled={false}>
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
      <meshStandardMaterial color="#9fdcff" roughness={0.2} metalness={0.1} emissive="#bfe9ff" emissiveIntensity={0.15} userData={{ nightGlow: 0.85, dayGlow: 0.15 }} />
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
      {SHOPS.filter((s) => s.sign).map((s) => (
        <mesh key={s.id} position={s.sign!.pos} rotation={[0, s.sign!.rotY, 0]} material={signMat(`${s.emoji} ${s.id === 'house' ? `Casa de ${houseName}` : s.name}`, s.sign!.color)}>
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

/* ---------------- 🐶 Tienda de mascotas ---------------- */
export function PetShopDecor() {
  return (
    <group position={[-54, 0, -22]}>
      <Awning x={0} z={4} colors={['#ff9a3c', '#ffffff']} w={11} />
      <mesh material={mat('#ffffff', { rough: 0.2 })} position={[0, 1.3, 4.03]}>
        <boxGeometry args={[2.6, 2.6, 0.06]} />
      </mesh>
      {[-3.8, 3.8].map((x) => (
        <mesh key={x} material={mat('#9fdcff', { rough: 0.15 })} position={[x, 1.8, 4.03]}>
          <boxGeometry args={[2.6, 2, 0.05]} />
        </mesh>
      ))}
      {/* casita de perro */}
      <group position={[7.5, 0, 6]}>
        <mesh castShadow material={mat('#c96f6f')} position={[0, 0.6, 0]}>
          <boxGeometry args={[1.6, 1.2, 1.6]} />
        </mesh>
        <mesh castShadow material={mat('#8a5a3c')} position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[1.35, 0.8, 4]} />
        </mesh>
        <mesh material={mat('#33264d')} position={[0, 0.45, 0.81]}>
          <circleGeometry args={[0.38, 16]} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- 🏫 Escuela ---------------- */
export function SchoolDecor() {
  const flag = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (flag.current) flag.current.rotation.y = Math.sin(s.clock.elapsedTime * 3) * 0.25;
  });
  return (
    <group position={[54, 0, -25]}>
      <mesh castShadow material={mat('#c96f6f')} position={[0, 7.6, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.6, 1, 0.85]}>
        <coneGeometry args={[9, 2.2, 4]} />
      </mesh>
      {/* reloj */}
      <mesh material={mat('#ffffff')} position={[0, 5.6, 5.04]}>
        <circleGeometry args={[0.9, 24]} />
      </mesh>
      <mesh material={mat('#33264d')} position={[0, 5.75, 5.06]}>
        <boxGeometry args={[0.08, 0.6, 0.02]} />
      </mesh>
      <mesh material={mat('#8a5a3c')} position={[0, 1.4, 5.03]}>
        <boxGeometry args={[2.4, 2.8, 0.06]} />
      </mesh>
      {[-6, -3.2, 3.2, 6].map((x) => (
        <mesh key={x} material={mat('#9fdcff', { rough: 0.15 })} position={[x, 3.2, 5.03]}>
          <boxGeometry args={[1.8, 1.6, 0.05]} />
        </mesh>
      ))}
      {/* asta y bandera */}
      <mesh material={mat('#d9d9e3')} position={[-10, 3, 8]}>
        <cylinderGeometry args={[0.08, 0.08, 6, 8]} />
      </mesh>
      <mesh ref={flag} material={mat('#ff5fa2')} position={[-9.3, 5.4, 8]}>
        <boxGeometry args={[1.4, 0.9, 0.04]} />
      </mesh>
      {/* resbaladilla */}
      <group position={[7, 0, 11]}>
        <mesh castShadow material={mat('#ffd23f')} position={[0, 1.6, 0]} rotation={[0, 0, -0.6]}>
          <boxGeometry args={[3.6, 0.15, 1]} />
        </mesh>
        <mesh material={mat('#3cb7f5')} position={[1.45, 1.4, 0]}>
          <boxGeometry args={[0.15, 2.8, 0.15]} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- 🚒 Bomberos ---------------- */
export function FireStationDecor() {
  const siren = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (siren.current) (siren.current.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(s.clock.elapsedTime * 6) > 0 ? 1 : 0.1;
  });
  const sirenMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff3d3d', emissive: '#ff3d3d', emissiveIntensity: 1 }), []);
  return (
    <group position={[18, 0, -59]}>
      {[-3.5, 3.5].map((x) => (
        <group key={x} position={[x, 2.2, 5.03]}>
          <mesh material={mat('#ffffff')}>
            <boxGeometry args={[5, 4.4, 0.06]} />
          </mesh>
          {[-1.4, -0.4, 0.6, 1.6].map((y) => (
            <mesh key={y} material={mat('#d9d9e3')} position={[0, y, 0.04]}>
              <boxGeometry args={[4.8, 0.08, 0.02]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh ref={siren} material={sirenMat} position={[0, 6.5, 2]}>
        <sphereGeometry args={[0.45, 12, 10]} />
      </mesh>
    </group>
  );
}

/* ---------------- 🎡 Feria ---------------- */
export const WHEEL_R = 7;
export const WHEEL_Y = 8.6;
export const wheelAngle = () => (performance.now() / 1000) * 0.22;
export const carouselAngle = () => (performance.now() / 1000) * 0.7;
const GONDOLAS = ['#ff5fa2', '#ffd23f', '#3cb7f5', '#2fd39a', '#b07cff', '#ff9a3c', '#ff7ab6', '#7fd8ff'];

export function FairDecor() {
  const wheel = useRef<THREE.Group>(null);
  const gondolas = useRef<(THREE.Group | null)[]>([]);
  const carousel = useRef<THREE.Group>(null);
  const horses = useRef<(THREE.Group | null)[]>([]);
  useFrame((s) => {
    const a = wheelAngle();
    if (wheel.current) wheel.current.rotation.z = a;
    gondolas.current.forEach((g, i) => {
      if (!g) return;
      const ga = a + (i / GONDOLAS.length) * Math.PI * 2;
      g.position.set(Math.cos(ga) * WHEEL_R, Math.sin(ga) * WHEEL_R - 1, 0);
    });
    if (carousel.current) carousel.current.rotation.y = carouselAngle();
    horses.current.forEach((h, i) => h && (h.position.y = 1.5 + Math.sin(s.clock.elapsedTime * 2 + i) * 0.3));
  });
  const [wx, wz] = FAIR.wheel;
  const [cx, cz] = FAIR.carousel;
  return (
    <>
      <group position={[wx, WHEEL_Y, wz]}>
        {/* patas */}
        {[-1, 1].map((s) => (
          <group key={s} position={[0, 0, s * 1.2]}>
            <mesh castShadow material={mat('#d9d9e3')} position={[-2.6, -WHEEL_Y / 2, 0]} rotation={[0, 0, -0.3]}>
              <cylinderGeometry args={[0.2, 0.25, WHEEL_Y + 0.6, 8]} />
            </mesh>
            <mesh castShadow material={mat('#d9d9e3')} position={[2.6, -WHEEL_Y / 2, 0]} rotation={[0, 0, 0.3]}>
              <cylinderGeometry args={[0.2, 0.25, WHEEL_Y + 0.6, 8]} />
            </mesh>
          </group>
        ))}
        <group ref={wheel}>
          {[-0.6, 0.6].map((z) => (
            <mesh key={z} castShadow material={mat('#ff7ab6')} position={[0, 0, z]}>
              <torusGeometry args={[WHEEL_R, 0.16, 8, 48]} />
            </mesh>
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} material={mat('#ffffff')} rotation={[0, 0, (i / 8) * Math.PI]}>
              <boxGeometry args={[WHEEL_R * 2, 0.12, 0.12]} />
            </mesh>
          ))}
          <mesh material={mat('#ffd23f')} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.6, 0.6, 1.6, 16]} />
          </mesh>
        </group>
        {GONDOLAS.map((c, i) => (
          <group key={c + i} ref={(o) => void (gondolas.current[i] = o)}>
            <mesh castShadow geometry={rbox(1.6, 1.2, 1.4, 0.3)} material={mat(c)} position={[0, -0.6, 0]} />
            <mesh material={mat('#ffffff')} position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.8, 6]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* carrusel */}
      <group position={[cx, 0.35, cz]}>
        <group ref={carousel}>
          <mesh castShadow material={mat('#ff9ecb')} position={[0, 4.2, 0]}>
            <coneGeometry args={[3.9, 1.6, 16]} />
          </mesh>
          <mesh material={mat('#ffffff')} position={[0, 2, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 4, 12]} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6]} rotation={[0, -a, 0]}>
                <mesh material={mat('#ffd23f', { metal: 0.4, rough: 0.3 })} position={[0, 1.9, 0]}>
                  <cylinderGeometry args={[0.05, 0.05, 3.8, 6]} />
                </mesh>
                <group ref={(o) => void (horses.current[i] = o)}>
                  <mesh castShadow geometry={rbox(0.5, 0.6, 1.3, 0.2)} material={mat(GONDOLAS[i])} />
                  <mesh castShadow geometry={rbox(0.4, 0.6, 0.4, 0.15)} material={mat(GONDOLAS[i])} position={[0, 0.4, 0.6]} />
                </group>
              </group>
            );
          })}
        </group>
      </group>
    </>
  );
}

/* ---------------- 🏖️ Lago con playa ---------------- */
export function LakeDecor() {
  const ducks = useRef<THREE.Group>(null);
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5ccfff', roughness: 0.1, transparent: true, opacity: 0.9 }), []);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    ducks.current?.children.forEach((d, i) => {
      const a = t * 0.3 + i * 2.1;
      d.position.set(LAKE.x + Math.cos(a) * (4 + i * 1.5), 0.2 + Math.sin(t * 3 + i) * 0.04, LAKE.z + Math.sin(a) * (3 + i));
      d.rotation.y = -a;
    });
  });
  return (
    <>
      <mesh receiveShadow position={[LAKE.x, 0.035, LAKE.z]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#ffe3a3')}>
        <planeGeometry args={[LAKE.w + 5, LAKE.d + 5]} />
      </mesh>
      <mesh position={[LAKE.x, 0.07, LAKE.z]} rotation={[-Math.PI / 2, 0, 0]} material={water}>
        <planeGeometry args={[LAKE.w, LAKE.d]} />
      </mesh>
      {/* muelle */}
      <mesh castShadow receiveShadow material={mat('#c98a4b')} position={[LAKE.x - 4, 0.25, LAKE.z - 3]}>
        <boxGeometry args={[2.4, 0.2, 10]} />
      </mesh>
      <group ref={ducks}>
        {[0, 1, 2].map((i) => (
          <group key={i}>
            <mesh material={mat('#ffd23f')}>
              <sphereGeometry args={[0.32, 12, 10]} />
            </mesh>
            <mesh material={mat('#ffd23f')} position={[0, 0.3, 0.22]}>
              <sphereGeometry args={[0.2, 10, 8]} />
            </mesh>
            <mesh material={mat('#ff9a3c')} position={[0, 0.28, 0.44]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.07, 0.18, 6]} />
            </mesh>
          </group>
        ))}
      </group>
      {PALMS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} castShadow material={mat('#b8743a')} position={[k * 0.12, 0.6 + k * 1.1, 0]}>
              <cylinderGeometry args={[0.28 - k * 0.03, 0.32 - k * 0.03, 1.15, 8]} />
            </mesh>
          ))}
          {Array.from({ length: 6 }, (_, k) => {
            const a = (k / 6) * Math.PI * 2;
            return (
              <mesh key={k} castShadow material={mat('#3fbf5a')} position={[0.4 + Math.cos(a) * 1.1, 4.7, Math.sin(a) * 1.1]} rotation={[Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]} scale={[0.5, 1, 1.6]}>
                <boxGeometry args={[0.6, 0.08, 1.4]} />
              </mesh>
            );
          })}
        </group>
      ))}
    </>
  );
}

/* ---------------- 🐾 Mascotas ---------------- */
export type PetKind = 'dog' | 'cat' | 'bunny';
export const PET_KINDS: { kind: PetKind; name: string; emoji: string; color: string }[] = [
  { kind: 'dog', name: 'Perrito', emoji: '🐶', color: '#c98a4b' },
  { kind: 'cat', name: 'Gatito', emoji: '🐱', color: '#ffb36b' },
  { kind: 'bunny', name: 'Conejito', emoji: '🐰', color: '#ffffff' },
];

export const PetModel = forwardRef<THREE.Group, { kind: PetKind; legs: React.RefObject<(THREE.Mesh | null)[]> }>(function PetModel({ kind, legs }, ref) {
  const info = PET_KINDS.find((p) => p.kind === kind)!;
  const m = mat(info.color);
  const dark = mat('#33264d');
  return (
    <group ref={ref}>
      <mesh castShadow geometry={rbox(0.55, 0.45, 0.85, 0.15)} material={m} position={[0, 0.5, 0]} />
      <mesh castShadow geometry={rbox(0.5, 0.45, 0.45, 0.15)} material={m} position={[0, 0.85, 0.45]} />
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} material={dark} position={[x, 0.92, 0.68]}>
          <sphereGeometry args={[0.05, 8, 6]} />
        </mesh>
      ))}
      <mesh material={mat('#ff7ab6')} position={[0, 0.82, 0.69]}>
        <sphereGeometry args={[0.045, 8, 6]} />
      </mesh>
      {/* orejas */}
      {[-1, 1].map((s) =>
        kind === 'bunny' ? (
          <mesh key={s} castShadow geometry={rbox(0.1, 0.45, 0.06, 0.04)} material={m} position={[s * 0.12, 1.25, 0.4]} />
        ) : kind === 'cat' ? (
          <mesh key={s} castShadow material={m} position={[s * 0.15, 1.15, 0.4]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.1, 0.2, 4]} />
          </mesh>
        ) : (
          <mesh key={s} castShadow geometry={rbox(0.12, 0.3, 0.08, 0.04)} material={mat('#8a5a3c')} position={[s * 0.28, 0.85, 0.4]} />
        ),
      )}
      {/* cola */}
      <mesh castShadow material={m} position={[0, 0.65, -0.48]} rotation={[kind === 'bunny' ? 0 : -0.8, 0, 0]}>
        {kind === 'bunny' ? <sphereGeometry args={[0.14, 10, 8]} /> : <cylinderGeometry args={[0.05, 0.05, 0.4, 6]} />}
      </mesh>
      {/* patitas */}
      {[[-0.18, 0.28], [0.18, 0.28], [-0.18, -0.28], [0.18, -0.28]].map(([x, z], i) => (
        <mesh key={i} ref={(o) => void (legs.current[i] = o)} geometry={rbox(0.14, 0.32, 0.14, 0.05)} material={m} position={[x, 0.16, z]} />
      ))}
    </group>
  );
});
