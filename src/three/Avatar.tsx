import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OUTFIT_LOOKS, findItem, type AvatarConfig, type ClothLook, type OutfitLook } from '../data/items';
import { decalMat, patternMat, wrapAround } from './clothes';
import { OUTFIT_DECAL, OutfitBody, OutfitHead, OutfitHips } from './Outfits';
import { faceTexture } from './faces';
import {
  angelWingGeo, butterflyLowerGeo, butterflyUpperGeo, dragonWingGeo, heartGeo, mat, rbox, starGeo,
} from './shapes';

/** Estado de animación que el juego va actualizando cada frame */
export interface AvatarAnim {
  speed: number; // 0..1
  grounded: boolean;
  vy: number;
  cheer: number; // segundos restantes de festejo
  sit?: boolean; // sentado (manejando)
  hold?: string; // 'icecream' | 'pizza' | 'balloon' en la mano
  wave?: number; // segundos saludando con la mano
}

export const makeAnim = (): AvatarAnim => ({ speed: 0, grounded: true, vy: 0, cheer: 0 });

const damp = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-k * dt));

type G = THREE.Group | null;

export function Avatar({ config, anim }: { config: AvatarConfig; anim?: AvatarAnim }) {
  const fallback = useMemo(makeAnim, []);
  const root = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const cape = useRef<THREE.Group>(null);
  const flames = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const holdIce = useRef<THREE.Group>(null);
  const holdPizza = useRef<THREE.Group>(null);
  const holdBalloon = useRef<THREE.Group>(null);
  const phase = useRef(0);

  const face = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ map: faceTexture(config.face), transparent: true, depthWrite: false });
    return m;
  }, [config.face]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const a = anim ?? fallback;
    const t = state.clock.elapsedTime;
    phase.current += dt * (3 + a.speed * 9);
    const sw = Math.sin(phase.current) * 0.85 * a.speed;
    const k = 11;

    let lx = sw, rx = -sw, alx = -sw * 0.9, arx = sw * 0.9, alz = -0.05, arz = 0.05;
    if (!a.grounded) {
      lx = 0.5; rx = -0.35; alx = -0.3; arx = -0.3; alz = -1.1; arz = 1.1;
    }
    let bounceY = a.speed < 0.1 && a.grounded ? Math.sin(t * 2.2) * 0.015 : Math.abs(Math.sin(phase.current)) * 0.05 * a.speed;
    if (a.hold && a.hold !== 'balloon') arx = -0.95; // brazo al frente sosteniendo algo
    if (a.wave && a.wave > 0) {
      a.wave -= dt;
      arz = 2.5 + Math.sin(t * 14) * 0.35;
      arx = 0;
    }
    if (a.sit) {
      // sentado manejando: piernas al frente, manos al volante
      lx = rx = -1.45;
      alx = arx = -1.05;
      alz = -0.12;
      arz = 0.12;
      bounceY = 0;
    }
    if (a.cheer > 0) {
      a.cheer -= dt;
      alz = -2.7 + Math.sin(t * 14) * 0.25;
      arz = 2.7 - Math.sin(t * 14) * 0.25;
      alx = arx = 0;
      bounceY = Math.abs(Math.sin(t * 7)) * 0.25;
    }

    if (legL.current) legL.current.rotation.x = damp(legL.current.rotation.x, lx, k, dt);
    if (legR.current) legR.current.rotation.x = damp(legR.current.rotation.x, rx, k, dt);
    if (armL.current) {
      armL.current.rotation.x = damp(armL.current.rotation.x, alx, k, dt);
      armL.current.rotation.z = damp(armL.current.rotation.z, alz, k, dt);
    }
    if (armR.current) {
      armR.current.rotation.x = damp(armR.current.rotation.x, arx, k, dt);
      armR.current.rotation.z = damp(armR.current.rotation.z, arz, k, dt);
    }
    if (root.current) root.current.position.y = damp(root.current.position.y, bounceY, 20, dt);
    if (upper.current) upper.current.rotation.x = damp(upper.current.rotation.x, a.speed * 0.12, 8, dt);

    // alas que aletean (más rápido en el aire)
    const flap = Math.sin(t * (a.grounded ? 3 : 14)) * (a.grounded ? 0.15 : 0.45);
    if (wingR.current) wingR.current.rotation.y = 0.45 + flap;
    if (wingL.current) wingL.current.rotation.y = -(0.45 + flap);
    if (cape.current)
      cape.current.rotation.x = damp(cape.current.rotation.x, 0.08 + a.speed * 0.7 + (a.grounded ? 0 : 0.5) + Math.sin(t * 6) * 0.04, 6, dt);
    if (flames.current) {
      const s = (a.grounded ? 0.5 : 1.3) + Math.sin(t * 40) * 0.15;
      flames.current.scale.set(1, s, 1);
    }
    if (holdIce.current) holdIce.current.visible = a.hold === 'icecream';
    if (holdPizza.current) holdPizza.current.visible = a.hold === 'pizza';
    if (holdBalloon.current) {
      holdBalloon.current.visible = a.hold === 'balloon';
      holdBalloon.current.rotation.z = Math.sin(t * 1.6) * 0.08;
    }
    if (halo.current) halo.current.position.y = 0.66 + Math.sin(t * 2.5) * 0.03;
  });

  const outfit = config.outfit ?? 'none';
  const look: OutfitLook = outfit !== 'none' ? OUTFIT_LOOKS[outfit] ?? {} : {};
  // Cada prenda trae su forma, color y patrón. Los disfraces traen su propio look.
  const topL: ClothLook =
    outfit !== 'none'
      ? { shape: look.fullSleeves ? 'long' : 'tee', color: look.shirt ?? '#ffffff', pattern: look.top === 'dots' ? 'dots' : undefined }
      : findItem('top', config.top)?.look ?? { shape: 'tee', color: '#ffffff' };
  const botL: ClothLook =
    outfit !== 'none'
      ? { shape: look.bottom === 'gown' ? 'gown' : 'pants', color: look.pants ?? '#ffffff' }
      : findItem('bottom', config.bottom)?.look ?? { shape: 'pants', color: '#4a6fb5' };
  const shoeL: ClothLook =
    outfit !== 'none'
      ? { shape: 'sneaker', color: look.shoes ?? '#ffffff', accent: look.shoes ?? '#ffffff' }
      : findItem('shoes', config.shoes)?.look ?? { shape: 'sneaker', color: '#ffffff' };

  const skin = mat(config.skin);
  const shirt = patternMat(topL.pattern, topL.color, topL.accent) ?? mat(topL.color);
  const pants = patternMat(botL.pattern, botL.color, botL.accent) ?? mat(botL.color);
  const sleeve = topL.shape === 'tank' ? skin : shirt;
  const forearm = topL.shape === 'long' || topL.shape === 'hoodie' ? shirt : skin;
  const bareLegs = botL.shape === 'skirt' || botL.shape === 'tutu';
  const decal = decalMat(OUTFIT_DECAL[outfit] ?? topL.decal ?? '');
  const hair = look.hideHair ? 'none' : config.hair;
  const hairY = hair !== 'none' ? 0.07 : 0;

  return (
    <group ref={root}>
      {/* Piernas */}
      {([[-0.2, legL], [0.2, legR]] as const).map(([x, ref]) => (
        <group key={x} ref={ref as React.RefObject<THREE.Group>} position={[x, 0.8, 0]}>
          {botL.shape === 'shorts' ? (
            <>
              <mesh castShadow geometry={rbox(0.4, 0.32, 0.4)} material={pants} position={[0, -0.16, 0]} />
              <mesh castShadow geometry={rbox(0.34, 0.36, 0.34)} material={skin} position={[0, -0.47, 0]} />
            </>
          ) : (
            <mesh castShadow geometry={rbox(0.38, 0.64, 0.38)} material={bareLegs ? skin : pants} position={[0, -0.32, 0]} />
          )}
          <Shoe look={shoeL} />
        </group>
      ))}
      <Bottoms id={botL.shape} m={wrapAround(pants)} accent={botL.accent} />
      <OutfitHips id={outfit} />

      <group ref={upper} position={[0, 0.8, 0]}>
        {/* Torso */}
        <mesh castShadow geometry={rbox(0.84, 0.8, 0.44, 0.1)} material={shirt} position={[0, 0.4, 0]} />
        {decal && (
          <mesh position={[0, 0.4, 0.225]} material={decal}>
            <planeGeometry args={[0.66, 0.66]} />
          </mesh>
        )}
        {topL.shape === 'hoodie' && <Hoodie m={shirt} />}
        {topL.shape === 'tank' && <Tank m={shirt} />}
        <OutfitBody id={outfit} />
        {/* Brazos */}
        {([[-0.61, armL], [0.61, armR]] as const).map(([x, ref]) => (
          <group key={x} ref={ref as React.RefObject<THREE.Group>} position={[x, 0.75, 0]}>
            <mesh castShadow geometry={rbox(0.34, 0.36, 0.38)} material={sleeve} position={[0, -0.14, 0]} />
            <mesh castShadow geometry={rbox(0.3, 0.46, 0.32)} material={forearm} position={[0, -0.52, 0]} />
            {x > 0 && <HandItems ice={holdIce} pizza={holdPizza} />}
          </group>
        ))}
        {/* globo (flota arriba de la mano) */}
        <group ref={holdBalloon} position={[0.78, 0.3, 0.15]} visible={false}>
          <mesh material={mat('#ffffff')} position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 1.6, 4]} />
          </mesh>
          <mesh castShadow material={mat('#ff4d8b', { rough: 0.25 })} position={[0, 1.85, 0]} scale={[1, 1.18, 1]}>
            <sphereGeometry args={[0.38, 18, 16]} />
          </mesh>
          <mesh material={mat('#ff4d8b')} position={[0, 1.42, 0]}>
            <coneGeometry args={[0.07, 0.12, 8]} />
          </mesh>
        </group>

        {/* Cabeza */}
        <group position={[0, 1.13, 0]}>
          {!look.hideFace && (
            <>
              <mesh castShadow geometry={rbox(0.68, 0.66, 0.66, 0.14)} material={skin} />
              <mesh position={[0, -0.01, 0.335]} material={face}>
                <planeGeometry args={[0.62, 0.62]} />
              </mesh>
            </>
          )}
          <Hair id={hair} color={config.hairColor} />
          {!look.hideHat && (
            <group position={[0, hairY, 0]}>
              <Hat id={config.hat} haloRef={halo} />
            </group>
          )}
          {!look.hideFace && <Glasses id={config.glasses} />}
          <OutfitHead id={outfit} />
        </group>

        {/* Espalda (posiciones relativas al torso) */}
        <Back id={outfit === 'hero' ? 'cape' : look.hideBack ? 'none' : config.back} wingL={wingL} wingR={wingR} cape={cape} flames={flames} />
      </group>
    </group>
  );
}


/* ---------------- Tenis ---------------- */
function Shoe({ look }: { look: ClothLook }) {
  const m = mat(look.color);
  const sole = mat(look.accent ?? '#e6e1f0');
  switch (look.shape) {
    case 'boot':
      return (
        <>
          <mesh castShadow geometry={rbox(0.43, 0.46, 0.44, 0.08)} material={m} position={[0, -0.57, 0.01]} />
          <mesh castShadow geometry={rbox(0.44, 0.14, 0.52, 0.06)} material={m} position={[0, -0.72, 0.05]} />
          <mesh geometry={rbox(0.46, 0.06, 0.54, 0.03)} material={sole} position={[0, -0.79, 0.05]} />
        </>
      );
    case 'flat':
      return <mesh castShadow geometry={rbox(0.4, 0.14, 0.48, 0.06)} material={m} position={[0, -0.73, 0.04]} />;
    case 'bunny':
      return (
        <>
          <mesh castShadow geometry={rbox(0.46, 0.24, 0.54, 0.11)} material={m} position={[0, -0.69, 0.05]} />
          {[-0.08, 0.08].map((x) => (
            <group key={x} position={[x, -0.5, 0.2]} rotation={[0.2, 0, x * 2]}>
              <mesh geometry={rbox(0.07, 0.2, 0.04, 0.03)} material={m} />
              <mesh geometry={rbox(0.035, 0.13, 0.01, 0.005)} material={sole} position={[0, 0, 0.025]} />
            </group>
          ))}
          <mesh material={mat('#2b2240')} position={[0, -0.64, 0.33]}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
        </>
      );
    case 'light':
      return (
        <>
          <mesh castShadow geometry={rbox(0.42, 0.18, 0.48, 0.08)} material={m} position={[0, -0.68, 0.04]} />
          <mesh geometry={rbox(0.44, 0.07, 0.5, 0.03)} material={mat(look.accent ?? '#ff3dd2', { emissive: 1 })} position={[0, -0.78, 0.04]} />
        </>
      );
  }
  return (
    <>
      <mesh castShadow geometry={rbox(0.42, 0.18, 0.48, 0.08)} material={m} position={[0, -0.68, 0.04]} />
      <mesh geometry={rbox(0.44, 0.06, 0.5, 0.03)} material={sole} position={[0, -0.78, 0.04]} />
    </>
  );
}

function Tank({ m }: { m: THREE.Material }) {
  return (
    <>
      {[-0.27, 0.27].map((x) => (
        <mesh key={x} geometry={rbox(0.14, 0.16, 0.46, 0.04)} material={m} position={[x, 0.76, 0]} />
      ))}
    </>
  );
}

/* ---------------- Cosas en la mano ---------------- */
function HandItems({ ice, pizza }: { ice: React.RefObject<THREE.Group | null>; pizza: React.RefObject<THREE.Group | null> }) {
  return (
    <group position={[0, -0.82, 0.05]}>
      <group ref={ice} visible={false}>
        <mesh material={mat('#e0a35c')} position={[0, -0.12, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.13, 0.36, 12]} />
        </mesh>
        <mesh material={mat('#ff9ecb')} position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.15, 14, 12]} />
        </mesh>
        <mesh material={mat('#7fd8ff')} position={[0, 0.27, 0]}>
          <sphereGeometry args={[0.12, 14, 12]} />
        </mesh>
        <mesh material={mat('#ff3d5a')} position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.045, 8, 6]} />
        </mesh>
      </group>
      <group ref={pizza} visible={false} rotation={[0.3, 0, 0]}>
        <mesh material={mat('#ffcf4a')} position={[0, -0.15, 0.05]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.22, 0.45, 3]} />
        </mesh>
        <mesh material={mat('#c98a4b')} position={[0, 0.07, 0.05]}>
          <boxGeometry args={[0.4, 0.08, 0.1]} />
        </mesh>
        <mesh material={mat('#e0413a')} position={[0.03, -0.1, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.02, 10]} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- Faldas y tutú ---------------- */
function Bottoms({ id, m, accent }: { id: string; m: THREE.Material; accent?: string }) {
  switch (id) {
    case 'skirt':
      return (
        <mesh castShadow material={m} position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.47, 0.64, 0.44, 24]} />
        </mesh>
      );
    case 'tutu':
      return (
        <>
          <mesh castShadow material={m} position={[0, 0.74, 0]}>
            <cylinderGeometry args={[0.47, 0.82, 0.12, 24]} />
          </mesh>
          <mesh castShadow material={accent ? mat(accent) : m} position={[0, 0.64, 0]}>
            <cylinderGeometry args={[0.5, 0.72, 0.12, 24]} />
          </mesh>
          <mesh material={mat('#ffffff')} position={[0, 0.82, 0]}>
            <cylinderGeometry args={[0.45, 0.45, 0.07, 24]} />
          </mesh>
        </>
      );
    case 'gown':
      return (
        <>
          <mesh castShadow material={m} position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.46, 0.92, 0.86, 28]} />
          </mesh>
          <mesh material={mat('#ffc928', { metal: 0.5, rough: 0.3 })} position={[0, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.45, 0.04, 8, 28]} />
          </mesh>
          <mesh material={mat('#ffffff')} position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.9, 0.05, 8, 32]} />
          </mesh>
        </>
      );
  }
  return null;
}

function Hoodie({ m }: { m: THREE.Material }) {
  return (
    <>
      <mesh castShadow geometry={rbox(0.72, 0.3, 0.26, 0.1)} material={m} position={[0, 0.86, -0.26]} />
      <mesh geometry={rbox(0.52, 0.22, 0.05, 0.03)} material={m} position={[0, 0.16, 0.23]} />
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} material={mat('#ffffff')} position={[x, 0.62, 0.235]}>
          <cylinderGeometry args={[0.018, 0.018, 0.24, 6]} />
        </mesh>
      ))}
    </>
  );
}

/* ---------------- Pelo ---------------- */
function Hair({ id, color }: { id: string; color: string }) {
  if (id === 'none') return null;
  const m = mat(color);
  const base = (
    <>
      <mesh castShadow geometry={rbox(0.74, 0.17, 0.74, 0.07)} material={m} position={[0, 0.36, 0]} />
      <mesh geometry={rbox(0.74, 0.5, 0.15, 0.06)} material={m} position={[0, 0.12, -0.3]} />
      <mesh geometry={rbox(0.72, 0.13, 0.12, 0.05)} material={m} position={[0, 0.27, 0.3]} />
      <mesh geometry={rbox(0.1, 0.32, 0.62, 0.04)} material={m} position={[-0.355, 0.17, -0.03]} />
      <mesh geometry={rbox(0.1, 0.32, 0.62, 0.04)} material={m} position={[0.355, 0.17, -0.03]} />
    </>
  );
  switch (id) {
    case 'short':
      return base;
    case 'long':
      return (
        <>
          {base}
          <mesh castShadow geometry={rbox(0.76, 1.0, 0.16, 0.07)} material={m} position={[0, -0.16, -0.33]} />
          <mesh geometry={rbox(0.12, 0.78, 0.42, 0.05)} material={m} position={[-0.37, -0.05, -0.12]} />
          <mesh geometry={rbox(0.12, 0.78, 0.42, 0.05)} material={m} position={[0.37, -0.05, -0.12]} />
        </>
      );
    case 'pigtails':
      return (
        <>
          {base}
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh material={mat('#ff5fa2')} position={[s * 0.43, 0.14, -0.1]}>
                <sphereGeometry args={[0.07, 12, 12]} />
              </mesh>
              <mesh castShadow material={m} position={[s * 0.5, -0.12, -0.1]} scale={[1, 1.7, 1]}>
                <sphereGeometry args={[0.15, 16, 16]} />
              </mesh>
            </group>
          ))}
        </>
      );
    case 'bun':
      return (
        <>
          {base}
          <mesh castShadow material={m} position={[0, 0.52, -0.12]}>
            <sphereGeometry args={[0.21, 18, 18]} />
          </mesh>
        </>
      );
    case 'spiky':
      return (
        <>
          {base}
          {[[-0.2, 0.15], [0, 0.18], [0.2, 0.15], [-0.15, -0.15], [0.15, -0.15], [0, -0.05]].map(([x, z], i) => (
            <mesh key={i} castShadow material={m} position={[x, 0.55, z]} rotation={[z * -2, 0, -x * 1.5]}>
              <coneGeometry args={[0.12, 0.34, 6]} />
            </mesh>
          ))}
        </>
      );
    case 'curly':
      return (
        <>
          {base}
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2;
            const r = i % 2 ? 0.3 : 0.22;
            return (
              <mesh key={i} castShadow material={m} position={[Math.cos(a) * r, 0.44 + (i % 3) * 0.03, Math.sin(a) * r - 0.04]}>
                <sphereGeometry args={[0.15, 12, 12]} />
              </mesh>
            );
          })}
        </>
      );
    case 'ponytail':
      return (
        <>
          {base}
          <mesh material={mat('#ff5fa2')} position={[0, 0.3, -0.42]}>
            <sphereGeometry args={[0.08, 12, 10]} />
          </mesh>
          {[[0.2, -0.5, 0.17], [0.0, -0.54, 0.16], [-0.2, -0.53, 0.14], [-0.38, -0.49, 0.11]].map(([y, z, r], i) => (
            <mesh key={i} castShadow material={m} position={[0, y, z]} scale={[1, 1.35, 1]}>
              <sphereGeometry args={[r, 14, 12]} />
            </mesh>
          ))}
        </>
      );
    case 'sidepony':
      return (
        <>
          {base}
          <mesh material={mat('#b07cff')} position={[0.4, 0.26, -0.08]}>
            <sphereGeometry args={[0.08, 12, 10]} />
          </mesh>
          {[[0.47, 0.12, 0.16], [0.52, -0.08, 0.15], [0.54, -0.28, 0.13], [0.52, -0.45, 0.1]].map(([x, y, r], i) => (
            <mesh key={i} castShadow material={m} position={[x, y, -0.08]} scale={[1, 1.3, 1]}>
              <sphereGeometry args={[r, 14, 12]} />
            </mesh>
          ))}
        </>
      );
    case 'braids':
      return (
        <>
          {base}
          {[-1, 1].map((s) => (
            <group key={s}>
              {Array.from({ length: 7 }, (_, i) => {
                const y = 0.02 - i * 0.11;
                return (
                  <mesh key={i} castShadow material={m} position={[s * (0.36 + (i % 2) * 0.02), y, y > -0.3 ? 0.06 : 0.25]}>
                    <sphereGeometry args={[0.085, 10, 8]} />
                  </mesh>
                );
              })}
              <mesh material={mat('#ff5fa2')} position={[s * 0.37, -0.76, 0.25]}>
                <sphereGeometry args={[0.06, 10, 8]} />
              </mesh>
            </group>
          ))}
        </>
      );
    case 'longbraid':
      return (
        <>
          {base}
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} castShadow material={m} position={[(i % 2) * 0.03 - 0.015, 0.15 - i * 0.13, -0.43 - Math.sin(i * 0.3) * 0.03]}>
              <sphereGeometry args={[0.11 - i * 0.004, 12, 10]} />
            </mesh>
          ))}
          <mesh material={mat('#ff5fa2')} position={[0, -1.05, -0.43]}>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
        </>
      );
    case 'spacebuns':
      return (
        <>
          {base}
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh castShadow material={m} position={[s * 0.25, 0.5, -0.04]}>
                <sphereGeometry args={[0.17, 16, 14]} />
              </mesh>
              <mesh material={mat('#ffd23f')} position={[s * 0.25, 0.4, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.12, 0.03, 8, 18]} />
              </mesh>
            </group>
          ))}
        </>
      );
    case 'bob':
      return (
        <>
          <mesh castShadow geometry={rbox(0.76, 0.18, 0.76, 0.08)} material={m} position={[0, 0.36, 0]} />
          <mesh geometry={rbox(0.74, 0.16, 0.12, 0.05)} material={m} position={[0, 0.26, 0.31]} />
          <mesh castShadow geometry={rbox(0.8, 0.66, 0.16, 0.07)} material={m} position={[0, 0.04, -0.33]} />
          <mesh castShadow geometry={rbox(0.14, 0.66, 0.68, 0.06)} material={m} position={[-0.38, 0.04, -0.01]} />
          <mesh castShadow geometry={rbox(0.14, 0.66, 0.68, 0.06)} material={m} position={[0.38, 0.04, -0.01]} />
        </>
      );
    case 'wavy':
      return (
        <>
          {base}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} castShadow geometry={rbox(0.78, 0.22, 0.17, 0.08)} material={m} position={[Math.sin(i * 1.6) * 0.04, 0.2 - i * 0.18, -0.34 - Math.cos(i * 1.6) * 0.03]} />
          ))}
          {[-1, 1].flatMap((s) =>
            Array.from({ length: 4 }, (_, i) => (
              <mesh key={`${s}${i}`} geometry={rbox(0.13, 0.22, 0.4, 0.06)} material={m} position={[s * (0.38 + Math.sin(i * 1.7) * 0.03), 0.08 - i * 0.18, -0.12]} />
            )),
          )}
        </>
      );
    case 'mermaid':
      return (
        <>
          {base}
          <mesh castShadow geometry={rbox(0.8, 1.7, 0.17, 0.08)} material={m} position={[0, -0.5, -0.34]} />
          <mesh geometry={rbox(0.12, 1.0, 0.44, 0.05)} material={m} position={[-0.38, -0.2, -0.12]} />
          <mesh geometry={rbox(0.12, 1.0, 0.44, 0.05)} material={m} position={[0.38, -0.2, -0.12]} />
          <mesh geometry={starGeo()} material={mat('#ffd23f', { rough: 0.3 })} position={[0.36, 0.22, 0.2]} scale={0.22} rotation={[0, 0.5, 0.3]} />
          {[-0.2, 0, 0.2].map((x) => (
            <mesh key={x} material={mat('#ffffff', { rough: 0.2 })} position={[x, -0.2, -0.43]}>
              <sphereGeometry args={[0.035, 8, 6]} />
            </mesh>
          ))}
        </>
      );
    case 'curlylong':
      return (
        <>
          {base}
          {Array.from({ length: 15 }, (_, i) => {
            const col = i % 3, row = Math.floor(i / 3);
            return (
              <mesh key={i} castShadow material={m} position={[(col - 1) * 0.25 + (row % 2) * 0.06, 0.15 - row * 0.19, -0.38]}>
                <sphereGeometry args={[0.15, 12, 10]} />
              </mesh>
            );
          })}
          {[-1, 1].flatMap((s) =>
            [0, 1, 2].map((r) => (
              <mesh key={`${s}${r}`} material={m} position={[s * 0.4, 0.1 - r * 0.2, -0.1]}>
                <sphereGeometry args={[0.13, 12, 10]} />
              </mesh>
            )),
          )}
        </>
      );
    case 'halfup':
      return (
        <>
          {base}
          <mesh castShadow geometry={rbox(0.76, 1.0, 0.16, 0.07)} material={m} position={[0, -0.16, -0.33]} />
          <mesh geometry={rbox(0.12, 0.78, 0.42, 0.05)} material={m} position={[-0.37, -0.05, -0.12]} />
          <mesh geometry={rbox(0.12, 0.78, 0.42, 0.05)} material={m} position={[0.37, -0.05, -0.12]} />
          <mesh castShadow material={m} position={[0, 0.3, -0.45]}>
            <sphereGeometry args={[0.13, 14, 12]} />
          </mesh>
          <group position={[0, 0.3, -0.56]}>
            {[-1, 1].map((s) => (
              <mesh key={s} material={mat('#ff5fa2')} position={[s * 0.13, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]}>
                <coneGeometry args={[0.1, 0.18, 4]} />
              </mesh>
            ))}
          </group>
        </>
      );
    case 'puffs':
      return (
        <>
          {base}
          {[-1, 1].map((s) => (
            <mesh key={s} castShadow material={m} position={[s * 0.32, 0.44, -0.06]}>
              <sphereGeometry args={[0.24, 16, 14]} />
            </mesh>
          ))}
        </>
      );
    case 'bangs':
      return (
        <>
          {base}
          <mesh castShadow geometry={rbox(0.76, 0.24, 0.13, 0.06)} material={m} position={[0, 0.22, 0.31]} />
          <mesh castShadow geometry={rbox(0.76, 1.0, 0.16, 0.07)} material={m} position={[0, -0.16, -0.33]} />
          <mesh geometry={rbox(0.12, 0.78, 0.42, 0.05)} material={m} position={[-0.37, -0.05, -0.12]} />
          <mesh geometry={rbox(0.12, 0.78, 0.42, 0.05)} material={m} position={[0.37, -0.05, -0.12]} />
        </>
      );
    case 'crownbraid':
      return (
        <>
          {base}
          <mesh castShadow geometry={rbox(0.76, 1.0, 0.16, 0.07)} material={m} position={[0, -0.16, -0.33]} />
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            return (
              <mesh key={i} material={m} position={[Math.cos(a) * 0.37, 0.3, Math.sin(a) * 0.37]}>
                <sphereGeometry args={[0.08, 10, 8]} />
              </mesh>
            );
          })}
          {[0.6, 1.4, 2.6].map((a, i) => (
            <mesh key={a} material={mat(['#ffffff', '#ff7ab6', '#ffd23f'][i])} position={[Math.cos(a) * 0.4, 0.33, Math.sin(a) * 0.4]}>
              <sphereGeometry args={[0.055, 10, 8]} />
            </mesh>
          ))}
        </>
      );
  }
  return base;
}

/* ---------------- Gorros ---------------- */
function Hat({ id, haloRef }: { id: string; haloRef: React.RefObject<THREE.Mesh | null> }) {
  const gold = mat('#ffc928', { metal: 0.5, rough: 0.3 });
  switch (id) {
    case 'cap':
      return (
        <>
          <mesh castShadow material={mat('#3cb7f5')} position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.2, 24]} />
          </mesh>
          <mesh castShadow geometry={rbox(0.6, 0.05, 0.34, 0.02)} material={mat('#3cb7f5')} position={[0, 0.34, 0.42]} />
          <mesh material={mat('#ffffff')} position={[0, 0.53, 0]}>
            <sphereGeometry args={[0.05, 10, 10]} />
          </mesh>
        </>
      );
    case 'crown':
      return (
        <>
          <mesh castShadow material={gold} position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 10, 1, true]} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh key={i} material={gold} position={[Math.cos(a) * 0.29, 0.62, Math.sin(a) * 0.29]}>
                <coneGeometry args={[0.07, 0.16, 6]} />
              </mesh>
            );
          })}
          {[[0, '#ff3d7f'], [-0.15, '#3cb7f5'], [0.15, '#2fd39a']].map(([x, c]) => (
            <mesh key={x as number} material={mat(c as string, { emissive: 0.3, rough: 0.2 })} position={[x as number, 0.45, 0.29]}>
              <sphereGeometry args={[0.05, 10, 10]} />
            </mesh>
          ))}
        </>
      );
    case 'tophat':
      return (
        <>
          <mesh castShadow material={mat('#2b2240')} position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.46, 0.46, 0.04, 28]} />
          </mesh>
          <mesh castShadow material={mat('#2b2240')} position={[0, 0.62, 0]}>
            <cylinderGeometry args={[0.27, 0.27, 0.48, 24]} />
          </mesh>
          <mesh material={mat('#ff5fa2')} position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.275, 0.275, 0.1, 24]} />
          </mesh>
        </>
      );
    case 'catEars':
      return (
        <>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.23, 0.46, 0]} rotation={[0, 0, -s * 0.25]}>
              <mesh castShadow material={mat('#f6a5c0')} rotation={[0, Math.PI / 4, 0]}>
                <coneGeometry args={[0.15, 0.28, 4]} />
              </mesh>
              <mesh material={mat('#ffffff')} position={[0, -0.02, 0.06]} rotation={[0, Math.PI / 4, 0]}>
                <coneGeometry args={[0.08, 0.18, 4]} />
              </mesh>
            </group>
          ))}
        </>
      );
    case 'bunny':
      return (
        <>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.15, 0.64, -0.02]} rotation={[-0.1, 0, -s * 0.15]}>
              <mesh castShadow geometry={rbox(0.15, 0.58, 0.08, 0.06)} material={mat('#ffffff')} />
              <mesh geometry={rbox(0.08, 0.42, 0.02, 0.01)} material={mat('#ffa8c8')} position={[0, 0, 0.045]} />
            </group>
          ))}
        </>
      );
    case 'unicorn':
      return (
        <>
          <mesh castShadow material={mat('#ffe27a', { metal: 0.3, rough: 0.3 })} position={[0, 0.52, 0.2]} rotation={[0.4, 0, 0]}>
            <coneGeometry args={[0.08, 0.44, 12]} />
          </mesh>
          {['#ff7ab6', '#b07cff', '#3cb7f5', '#2fd39a'].map((c, i) => (
            <mesh key={c} material={mat(c)} position={[0.05 - i * 0.02, 0.38 + i * 0.03, -0.1 - i * 0.12]}>
              <sphereGeometry args={[0.1, 10, 10]} />
            </mesh>
          ))}
        </>
      );
    case 'bow':
      return (
        <group position={[0.22, 0.4, 0.06]} rotation={[0, 0, 0.3]}>
          <mesh material={mat('#ff3d8b')}>
            <sphereGeometry args={[0.07, 12, 12]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} castShadow material={mat('#ff5fa2')} position={[s * 0.15, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]}>
              <coneGeometry args={[0.13, 0.24, 4]} />
            </mesh>
          ))}
        </group>
      );
    case 'party':
      return (
        <group position={[0.05, 0.6, 0]} rotation={[0, 0, -0.15]}>
          <mesh castShadow material={mat('#b07cff')}>
            <coneGeometry args={[0.2, 0.46, 18]} />
          </mesh>
          <mesh material={mat('#ffcf33')} position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.155, 0.17, 0.06, 18]} />
          </mesh>
          <mesh material={mat('#ff5fa2')} position={[0, 0.25, 0]}>
            <sphereGeometry args={[0.08, 12, 12]} />
          </mesh>
        </group>
      );
    case 'halo':
      return (
        <mesh ref={haloRef} material={mat('#ffe066', { emissive: 0.9 })} position={[0, 0.66, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.26, 0.045, 12, 32]} />
        </mesh>
      );
    case 'flowers':
      return (
        <>
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2;
            const c = ['#ff7ab6', '#ffffff', '#b07cff'][i % 3];
            return (
              <group key={i} position={[Math.cos(a) * 0.36, 0.36, Math.sin(a) * 0.36]}>
                <mesh material={mat(c)} scale={[1, 0.6, 1]}>
                  <sphereGeometry args={[0.09, 10, 10]} />
                </mesh>
                <mesh material={mat('#ffcf33')} position={[0, 0.05, 0]}>
                  <sphereGeometry args={[0.04, 8, 8]} />
                </mesh>
              </group>
            );
          })}
        </>
      );
  }
  return null;
}

/* ---------------- Lentes ---------------- */
function Glasses({ id }: { id: string }) {
  if (id === 'none') return null;
  const z = 0.36;
  const bridge = (color: string) => (
    <mesh material={mat(color)} position={[0, 0.07, z]}>
      <boxGeometry args={[0.1, 0.025, 0.02]} />
    </mesh>
  );
  switch (id) {
    case 'round':
      return (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} material={mat('#2b2240')} position={[s * 0.15, 0.06, z]}>
              <torusGeometry args={[0.1, 0.022, 8, 24]} />
            </mesh>
          ))}
          {bridge('#2b2240')}
        </>
      );
    case 'sun':
      return (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={rbox(0.26, 0.15, 0.04, 0.04)} material={mat('#1d1830', { rough: 0.15 })} position={[s * 0.15, 0.06, z]} />
          ))}
          {bridge('#1d1830')}
        </>
      );
    case 'heart':
      return (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={heartGeo()} material={mat('#ff3d7f', { rough: 0.25 })} position={[s * 0.15, 0.06, z]} scale={0.3} />
          ))}
          {bridge('#ff3d7f')}
        </>
      );
    case 'star':
      return (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={starGeo()} material={mat('#ffcf33', { rough: 0.25 })} position={[s * 0.15, 0.06, z]} scale={0.32} />
          ))}
          {bridge('#ffcf33')}
        </>
      );
  }
  return null;
}

/* ---------------- Espalda ---------------- */
function Back({
  id, wingL, wingR, cape, flames,
}: {
  id: string;
  wingL: React.RefObject<G>;
  wingR: React.RefObject<G>;
  cape: React.RefObject<G>;
  flames: React.RefObject<G>;
}) {
  const wings = (render: () => React.ReactNode, y = 0.55) => (
    <group position={[0, y, -0.24]}>
      <group ref={wingR} position={[0.06, 0, 0]}>
        {render()}
      </group>
      <group ref={wingL} position={[-0.06, 0, 0]} scale={[-1, 1, 1]}>
        {render()}
      </group>
    </group>
  );

  switch (id) {
    case 'backpack':
      return (
        <group position={[0, 0.38, -0.36]}>
          <mesh castShadow geometry={rbox(0.62, 0.64, 0.28, 0.1)} material={mat('#8b5cf6')} />
          <mesh geometry={rbox(0.44, 0.26, 0.1, 0.05)} material={mat('#ffcf33')} position={[0, -0.12, -0.16]} />
        </group>
      );
    case 'cape':
      return (
        <group ref={cape} position={[0, 0.78, -0.25]}>
          <mesh castShadow geometry={rbox(0.8, 1.3, 0.04, 0.02)} material={mat('#ff3d5a')} position={[0, -0.65, 0]} />
        </group>
      );
    case 'angel':
      return wings(() => (
        <mesh castShadow geometry={angelWingGeo()} material={mat('#ffffff')} scale={0.85} rotation={[0, 0, 0.35]} />
      ));
    case 'butterfly':
      return wings(() => (
        <group scale={0.95} rotation={[0, 0, 0.15]}>
          <mesh castShadow geometry={butterflyUpperGeo()} material={mat('#ff7ab6', { opacity: 0.92 })} />
          <mesh castShadow geometry={butterflyLowerGeo()} material={mat('#b07cff', { opacity: 0.92 })} />
        </group>
      ));
    case 'dragon':
      return wings(() => (
        <mesh castShadow geometry={dragonWingGeo()} material={mat('#7c3aed')} scale={0.9} rotation={[0, 0, 0.25]} />
      ));
    case 'jetpack':
      return (
        <group position={[0, 0.42, -0.36]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.16, 0, 0]}>
              <mesh castShadow material={mat('#c9d2e0', { metal: 0.6, rough: 0.3 })}>
                <cylinderGeometry args={[0.13, 0.13, 0.56, 16]} />
              </mesh>
              <mesh material={mat('#ff3d5a')} position={[0, 0.36, 0]}>
                <coneGeometry args={[0.13, 0.18, 16]} />
              </mesh>
            </group>
          ))}
          <group ref={flames} position={[0, -0.3, 0]}>
            {[-1, 1].map((s) => (
              <mesh key={s} material={mat('#ff9a3c', { emissive: 1 })} position={[s * 0.16, -0.12, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.09, 0.28, 10]} />
              </mesh>
            ))}
          </group>
        </group>
      );
  }
  return null;
}
