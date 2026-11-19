import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useRun } from '../runStore';
import { ROADS, ROAD_W } from './cityData';

// 🌞🌙 Día y noche en Mi Ciudad: el cielo cambia, salen estrellas y se prenden las luces.

const CYCLE = 240; // segundos que dura un día completo
/** fase 0..1 · 0–0.5 día · 0.5–0.6 atardecer · 0.6–0.9 noche · 0.9–1 amanecer */
export const dayNight = { phase: 0.04, night: 0, sunset: 0 };

export function nightAt(phase: number) {
  if (phase < 0.5) return 0;
  if (phase < 0.6) return (phase - 0.5) / 0.1;
  if (phase < 0.9) return 1;
  return 1 - (phase - 0.9) / 0.1;
}

/** Despertar en la mañana (dormir en la casita) */
export function skipToMorning() {
  dayNight.phase = 0.01;
}

const C = (c: string) => new THREE.Color(c);
const SKY = {
  dayTop: C('#6ec2ff'), dayBottom: C('#dff2ff'),
  setTop: C('#8a7cff'), setBottom: C('#ffb38a'),
  nightTop: C('#0b0e30'), nightBottom: C('#2b2f6e'),
};
const FOG = { day: C('#d7eeff'), set: C('#ffc9a8'), night: C('#1f2457') };
const LIGHT = { day: C('#ffffff'), set: C('#ffbf8f'), night: C('#9fb2ff') };
const WIN = { day: C('#bfe9ff'), night: C('#ffd36b') };

const mix3 = (out: THREE.Color, day: THREE.Color, set: THREE.Color, night: THREE.Color, n: number, s: number) =>
  out.copy(day).lerp(night, n).lerp(set, s * 0.75);

const skyVert = /* glsl */ `
varying float vH;
void main() {
  vH = normalize(position).y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const skyFrag = /* glsl */ `
uniform vec3 top;
uniform vec3 bottom;
varying float vH;
void main() {
  float t = smoothstep(-0.05, 0.6, vH);
  gl_FragColor = vec4(mix(bottom, top, t), 1.0);
}`;

type Lights = { hemi?: THREE.HemisphereLight; amb?: THREE.AmbientLight; dir?: THREE.DirectionalLight; glow: THREE.MeshStandardMaterial[] };

export function DayNight({ frozen = false }: { frozen?: boolean }) {
  const scene = useThree((s) => s.scene);
  const sky = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.Points>(null);
  const sun = useRef<THREE.Mesh>(null);
  const moon = useRef<THREE.Mesh>(null);
  const lights = useRef<Lights | null>(null);
  const lastSky = useRef('');
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { top: { value: SKY.dayTop.clone() }, bottom: { value: SKY.dayBottom.clone() } },
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  const starGeo = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 500; i++) {
      const a = Math.random() * Math.PI * 2, y = 0.12 + Math.random() * 0.88;
      const r = Math.sqrt(1 - y * y);
      pts.push(Math.cos(a) * r * 175, y * 175, Math.sin(a) * r * 175);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const starMat = useMemo(() => new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }), []);

  useLayoutEffect(() => {
    if (frozen) dayNight.phase = 0.04;
  }, [frozen]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    // buscar las luces del mundo (una sola vez)
    if (!lights.current) {
      const l: Lights = { glow: [] };
      scene.traverse((o) => {
        if ((o as THREE.HemisphereLight).isHemisphereLight) l.hemi = o as THREE.HemisphereLight;
        else if ((o as THREE.AmbientLight).isAmbientLight) l.amb = o as THREE.AmbientLight;
        else if ((o as THREE.DirectionalLight).isDirectionalLight) l.dir = o as THREE.DirectionalLight;
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && m.userData?.nightGlow && !l.glow.includes(m)) l.glow.push(m);
      });
      lights.current = l;
    }
    const status = useRun.getState().status;
    if (!frozen && status === 'playing') dayNight.phase = (dayNight.phase + dt / CYCLE) % 1;
    const n = nightAt(dayNight.phase);
    const s = Math.sin(Math.min(1, Math.max(0, n)) * Math.PI); // atardecer/amanecer
    dayNight.night = n;
    dayNight.sunset = s;

    const L = lights.current;
    if (L.hemi) {
      L.hemi.intensity = THREE.MathUtils.lerp(1.05, 0.55, n);
      mix3(L.hemi.color, LIGHT.day, LIGHT.set, LIGHT.night, n, s);
    }
    if (L.amb) L.amb.intensity = THREE.MathUtils.lerp(0.25, 0.22, n);
    if (L.dir) {
      L.dir.intensity = THREE.MathUtils.lerp(1.6, 0.45, n);
      mix3(L.dir.color, LIGHT.day, LIGHT.set, LIGHT.night, n, s);
    }
    for (const m of L.glow) {
      m.emissive.copy(WIN.day).lerp(WIN.night, n);
      m.emissiveIntensity = THREE.MathUtils.lerp(m.userData.dayGlow ?? 0.15, m.userData.nightGlow, n);
    }
    const fog = scene.fog as THREE.Fog | null;
    if (fog) mix3(fog.color, FOG.day, FOG.set, FOG.night, n, s);
    mix3(skyMat.uniforms.top.value, SKY.dayTop, SKY.setTop, SKY.nightTop, n, s);
    mix3(skyMat.uniforms.bottom.value, SKY.dayBottom, SKY.setBottom, SKY.nightBottom, n, s);

    // el cielo, el sol, la luna y las estrellas siguen a la cámara
    const cam = state.camera.position;
    sky.current?.position.copy(cam);
    stars.current?.position.copy(cam);
    starMat.opacity = Math.max(0, n * 1.2 - 0.2);
    if (sun.current) {
      // el sol sale por un lado y se mete por el otro durante el día
      const k = Math.min(1, dayNight.phase / 0.58) * Math.PI;
      sun.current.position.set(cam.x + Math.cos(k) * 150, cam.y + Math.sin(k) * 90 - 8, cam.z - 60);
      sun.current.visible = n < 0.95;
    }
    if (moon.current) {
      const k = THREE.MathUtils.clamp((dayNight.phase - 0.55) / 0.42, 0, 1) * Math.PI;
      moon.current.position.set(cam.x + Math.cos(k) * 150, cam.y + Math.sin(k) * 90 - 8, cam.z + 50);
      moon.current.visible = n > 0.05;
    }

    // aviso y emoji del cielo
    const icon = n > 0.6 ? '🌙' : s > 0.3 ? '🌅' : '☀️';
    if (icon !== lastSky.current) {
      const prev = lastSky.current;
      lastSky.current = icon;
      const run = useRun.getState();
      run.set({ sky: icon });
      if (prev && status === 'playing') {
        if (icon === '🌙') run.showToast('🌙 ¡Ya es de noche! Mira las estrellas ✨');
        else if (icon === '☀️' && prev === '🌅' && dayNight.phase > 0.85) run.showToast('☀️ ¡Buenos días! Ya amaneció');
        else if (icon === '☀️' && prev === '🌙') run.showToast('☀️ ¡Buenos días! Ya amaneció');
        else if (icon === '🌅' && prev === '☀️') run.showToast('🌅 ¡Está atardeciendo!');
      }
    }
  });

  return (
    <>
      <mesh ref={sky} material={skyMat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[185, 32, 16]} />
      </mesh>
      <points ref={stars} geometry={starGeo} material={starMat} frustumCulled={false} renderOrder={-9} />
      <mesh ref={sun} frustumCulled={false}>
        <sphereGeometry args={[9, 20, 14]} />
        <meshBasicMaterial color="#fff2a8" fog={false} />
      </mesh>
      <mesh ref={moon} frustumCulled={false}>
        <sphereGeometry args={[6, 20, 14]} />
        <meshBasicMaterial color="#f4f1ff" fog={false} />
      </mesh>
    </>
  );
}

/* ---------- Postes de luz que se prenden en la noche ---------- */
export function StreetLamps() {
  const poles = useRef<THREE.InstancedMesh>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const glows = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    const off = ROAD_W / 2 + 1.2;
    for (const r of ROADS)
      for (let t = -96; t <= 96; t += 24) {
        if (ROADS.some((r2) => Math.abs(t - r2) < ROAD_W / 2 + 3)) continue;
        out.push([t, r + off], [r - off, t]);
      }
    return out;
  }, []);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0, depthWrite: false }), []);
  const bulbMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#fff6c8', emissive: '#ffd36b', emissiveIntensity: 0.1 });
    m.userData = { nightGlow: 1.6, dayGlow: 0.1 };
    return m;
  }, []);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      d.position.set(x, 2.2, z);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      poles.current?.setMatrixAt(i, d.matrix);
      d.position.set(x, 4.5, z);
      d.updateMatrix();
      bulbs.current?.setMatrixAt(i, d.matrix);
      d.position.set(x, 0.13, z);
      d.rotation.set(-Math.PI / 2, 0, 0);
      d.updateMatrix();
      glows.current?.setMatrixAt(i, d.matrix);
    });
    for (const m of [poles.current, bulbs.current, glows.current]) if (m) m.instanceMatrix.needsUpdate = true;
  }, [spots]);
  useFrame(() => {
    glowMat.opacity = dayNight.night * 0.35;
    if (glows.current) glows.current.visible = dayNight.night > 0.02;
  });
  return (
    <>
      <instancedMesh ref={poles} args={[undefined, undefined, spots.length]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[0.1, 0.14, 4.4, 8]} />
        <meshStandardMaterial color="#5d6173" metalness={0.4} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, spots.length]} material={bulbMat} frustumCulled={false}>
        <sphereGeometry args={[0.38, 12, 10]} />
      </instancedMesh>
      <instancedMesh ref={glows} args={[undefined, undefined, spots.length]} material={glowMat} frustumCulled={false}>
        <circleGeometry args={[3.2, 20]} />
      </instancedMesh>
    </>
  );
}
