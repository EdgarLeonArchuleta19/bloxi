import { useMemo } from 'react';
import * as THREE from 'three';
import { decalMat } from './clothes';
import { mat, rbox } from './shapes';

// Piezas 3D de los disfraces. Coordenadas:
//  - Head: relativo al centro de la cabeza (cabeza de 0.68 x 0.66 x 0.66)
//  - Body: relativo a la cadera del torso (torso centrado en y=0.4, frente en z=0.22)
//  - Hips: relativo a los pies (cadera en y=0.8)

const RAINBOW = ['#ff5f5f', '#ffa24c', '#ffd84a', '#5fe08a', '#4cc0ff', '#9b7bff'];

/** Capucha de mameluco que enmarca la cara */
function Hood({ color }: { color: string }) {
  const m = mat(color);
  return (
    <>
      <mesh castShadow geometry={rbox(0.82, 0.2, 0.8, 0.08)} material={m} position={[0, 0.37, -0.01]} />
      <mesh castShadow geometry={rbox(0.82, 0.78, 0.14, 0.06)} material={m} position={[0, 0.0, -0.37]} />
      <mesh geometry={rbox(0.12, 0.78, 0.76, 0.05)} material={m} position={[-0.4, 0.0, -0.02]} />
      <mesh geometry={rbox(0.12, 0.78, 0.76, 0.05)} material={m} position={[0.4, 0.0, -0.02]} />
    </>
  );
}

function Eye({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh material={mat('#ffffff')}>
        <sphereGeometry args={[0.1, 14, 12]} />
      </mesh>
      <mesh material={mat('#2b2240')} position={[0, 0, 0.07]}>
        <sphereGeometry args={[0.05, 10, 8]} />
      </mesh>
    </group>
  );
}

export function OutfitHead({ id }: { id: string }) {
  switch (id) {
    case 'dino':
      return (
        <>
          <Hood color="#5fd36a" />
          <mesh castShadow geometry={rbox(0.84, 0.22, 0.4, 0.08)} material={mat('#5fd36a')} position={[0, 0.42, 0.36]} />
          {[-0.24, -0.12, 0, 0.12, 0.24].map((x) => (
            <mesh key={x} material={mat('#ffffff')} position={[x, 0.27, 0.5]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.045, 0.11, 6]} />
            </mesh>
          ))}
          <Eye x={-0.2} y={0.58} z={0.3} />
          <Eye x={0.2} y={0.58} z={0.3} />
        </>
      );
    case 'shark':
      return (
        <>
          <Hood color="#7fa7c9" />
          <mesh castShadow material={mat('#7fa7c9')} position={[0, 0.66, -0.08]} scale={[0.3, 1, 1]}>
            <coneGeometry args={[0.24, 0.5, 4]} />
          </mesh>
          {[-0.24, -0.12, 0, 0.12, 0.24].map((x) => (
            <mesh key={x} material={mat('#ffffff')} position={[x, 0.24, 0.36]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.05, 0.12, 6]} />
            </mesh>
          ))}
          {[-1, 1].flatMap((s) =>
            [-0.15, 0.0, 0.15].map((y) => (
              <mesh key={`${s}${y}`} material={mat('#ffffff')} position={[s * 0.31, y, 0.36]} rotation={[0, 0, (s * Math.PI) / 2]}>
                <coneGeometry args={[0.05, 0.12, 6]} />
              </mesh>
            )),
          )}
          <Eye x={-0.25} y={0.4} z={0.3} />
          <Eye x={0.25} y={0.4} z={0.3} />
        </>
      );
    case 'penguin':
      return (
        <>
          <Hood color="#2b2b3a" />
          <mesh material={mat('#ff9a3c')} position={[0, 0.4, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.1, 0.22, 8]} />
          </mesh>
          <Eye x={-0.18} y={0.52} z={0.33} />
          <Eye x={0.18} y={0.52} z={0.33} />
        </>
      );
    case 'unicornpj':
      return (
        <>
          <Hood color="#f9dcf0" />
          <mesh castShadow material={mat('#ffe27a', { metal: 0.3, rough: 0.3 })} position={[0, 0.62, 0.2]} rotation={[0.35, 0, 0]}>
            <coneGeometry args={[0.08, 0.42, 12]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={mat('#ffb3d9')} position={[s * 0.27, 0.53, 0]} rotation={[0, 0, -s * 0.3]}>
              <coneGeometry args={[0.09, 0.2, 4]} />
            </mesh>
          ))}
          {RAINBOW.map((c, i) => (
            <mesh key={c} material={mat(c)} position={[0, 0.42 - i * 0.14, -0.45]}>
              <sphereGeometry args={[0.12, 10, 10]} />
            </mesh>
          ))}
        </>
      );
    case 'banana':
      return (
        <>
          <Hood color="#ffe14d" />
          <mesh castShadow material={mat('#ffe14d')} position={[0.06, 0.66, -0.02]} rotation={[0, 0, -0.25]}>
            <coneGeometry args={[0.36, 0.6, 16]} />
          </mesh>
          <mesh material={mat('#6b4a2a')} position={[0.15, 0.98, -0.02]} rotation={[0, 0, -0.25]}>
            <cylinderGeometry args={[0.05, 0.06, 0.14, 8]} />
          </mesh>
        </>
      );
    case 'hotdog':
      return (
        <>
          <Hood color="#d9573f" />
          <mesh castShadow material={mat('#d9573f')} position={[0, 0.45, -0.02]} scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.41, 18, 14]} />
          </mesh>
        </>
      );
    case 'robot': {
      return (
        <>
          <mesh castShadow geometry={rbox(0.94, 0.88, 0.92, 0.03)} material={mat('#c9935a')} />
          <mesh material={decalMat('robotface')!} position={[0, 0, 0.465]}>
            <planeGeometry args={[0.8, 0.8]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.24, 0.6, 0]}>
              <mesh material={mat('#9aa5b1')}>
                <cylinderGeometry args={[0.025, 0.025, 0.3, 6]} />
              </mesh>
              <mesh material={mat('#ff3d5a', { emissive: 0.4 })} position={[0, 0.17, 0]}>
                <sphereGeometry args={[0.06, 10, 8]} />
              </mesh>
            </group>
          ))}
        </>
      );
    }
    case 'clown':
      return (
        <>
          <mesh material={mat('#ff3d3d', { rough: 0.2 })} position={[0, -0.03, 0.37]}>
            <sphereGeometry args={[0.09, 14, 12]} />
          </mesh>
          {[-1, 1].flatMap((s) =>
            [0, 1, 2, 3].map((i) => (
              <mesh key={`${s}${i}`} castShadow material={mat(RAINBOW[(i + (s > 0 ? 3 : 0)) % 6])} position={[s * 0.4, 0.3 - i * 0.12, 0.12 - i * 0.1]}>
                <sphereGeometry args={[0.16, 12, 10]} />
              </mesh>
            )),
          )}
          <mesh castShadow material={mat('#ff5fa2')} position={[0, 0.42, 0]} rotation={[0, 0, 0.2]}>
            <coneGeometry args={[0.13, 0.3, 14]} />
          </mesh>
        </>
      );
    case 'princess': {
      const gold = mat('#ffc928', { metal: 0.5, rough: 0.3 });
      return (
        <group position={[0, 0.38, 0.04]}>
          <mesh material={gold}>
            <cylinderGeometry args={[0.3, 0.3, 0.07, 24, 1, true]} />
          </mesh>
          <mesh material={gold} position={[0, 0.1, 0.27]}>
            <coneGeometry args={[0.07, 0.18, 6]} />
          </mesh>
          {[-0.14, 0.14].map((x) => (
            <mesh key={x} material={gold} position={[x, 0.07, 0.25]}>
              <coneGeometry args={[0.05, 0.12, 6]} />
            </mesh>
          ))}
          <mesh material={mat('#ff3d7f', { emissive: 0.3 })} position={[0, 0.05, 0.31]}>
            <sphereGeometry args={[0.045, 10, 8]} />
          </mesh>
        </group>
      );
    }
    case 'hero':
      return (
        <mesh material={decalMat('mask')!} position={[0, -0.01, 0.34]}>
          <planeGeometry args={[0.66, 0.66]} />
        </mesh>
      );
    case 'astronaut':
      return <Helmet />;
  }
  return null;
}

function Helmet() {
  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#bfe6ff', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, depthWrite: false,
      }),
    [],
  );
  return (
    <>
      <mesh material={glass}>
        <sphereGeometry args={[0.6, 28, 22]} />
      </mesh>
      <mesh material={mat('#d4d9e2', { metal: 0.4, rough: 0.35 })} position={[0, -0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.07, 10, 28]} />
      </mesh>
    </>
  );
}

/** Piezas del torso */
export function OutfitBody({ id }: { id: string }) {
  switch (id) {
    case 'dino':
      return (
        <>
          {[0.75, 0.45, 0.15].map((y) => (
            <mesh key={y} material={mat('#ff9a3c')} position={[0, y, -0.28]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.1, 0.22, 4]} />
            </mesh>
          ))}
        </>
      );
    case 'pizza':
      return <PizzaSlice />;
    case 'robot':
      return (
        <>
          <mesh castShadow geometry={rbox(1.0, 0.92, 0.62, 0.03)} material={mat('#c9935a')} position={[0, 0.4, 0]} />
          <mesh material={decalMat('robotpanel')!} position={[0, 0.4, 0.315]}>
            <planeGeometry args={[0.8, 0.8]} />
          </mesh>
        </>
      );
    case 'clown':
      return (
        <>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh key={i} material={mat(RAINBOW[i % 6])} position={[Math.cos(a) * 0.36, 0.8, Math.sin(a) * 0.22]}>
                <sphereGeometry args={[0.11, 10, 8]} />
              </mesh>
            );
          })}
        </>
      );
    case 'princess':
      return (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} castShadow material={mat('#ffb8d8')} position={[s * 0.6, 0.66, 0]}>
              <sphereGeometry args={[0.24, 14, 12]} />
            </mesh>
          ))}
        </>
      );
    case 'hero':
      return <mesh geometry={rbox(0.88, 0.1, 0.48, 0.04)} material={mat('#ffd23f')} position={[0, 0.06, 0]} />;
    case 'astronaut':
      return (
        <group position={[0, 0.4, -0.38]}>
          <mesh castShadow geometry={rbox(0.7, 0.74, 0.3, 0.08)} material={mat('#e6e9f0')} />
          {[-1, 1].map((s) => (
            <mesh key={s} material={mat('#9aa5b1', { metal: 0.5 })} position={[s * 0.2, -0.2, -0.17]}>
              <cylinderGeometry args={[0.07, 0.07, 0.4, 10]} />
            </mesh>
          ))}
        </group>
      );
  }
  return null;
}

function PizzaSlice() {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.42, 0.32);
    s.lineTo(0.42, 0.32);
    s.lineTo(0, -0.5);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  }, []);
  return (
    <group position={[0, 0.45, 0.24]}>
      <mesh castShadow geometry={geo} material={mat('#ffcf4a')} />
      <mesh geometry={rbox(0.96, 0.16, 0.12, 0.06)} material={mat('#c98a4b')} position={[0, 0.36, 0.03]} />
      {[[-0.15, 0.12], [0.15, 0.1], [0, -0.18]].map(([x, y]) => (
        <mesh key={`${x}${y}`} material={mat('#e0413a')} position={[x, y, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.02, 14]} />
        </mesh>
      ))}
      {[[-0.05, 0.2], [0.08, -0.05]].map(([x, y]) => (
        <mesh key={`g${x}`} material={mat('#3fbf5a')} position={[x, y, 0.08]}>
          <sphereGeometry args={[0.035, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/** Colas, panes, cáscaras... (relativo a los pies) */
export function OutfitHips({ id }: { id: string }) {
  switch (id) {
    case 'dino':
      return (
        <mesh castShadow material={mat('#5fd36a')} position={[0, 0.72, -0.62]} rotation={[-Math.PI / 2 - 0.35, 0, 0]}>
          <coneGeometry args={[0.24, 0.9, 12]} />
        </mesh>
      );
    case 'shark':
      return (
        <group position={[0, 0.75, -0.45]}>
          {[-1, 1].map((s) => (
            <mesh key={s} castShadow material={mat('#7fa7c9')} position={[0, s * 0.18, -0.18]} rotation={[-Math.PI / 2 + s * 0.6, 0, 0]} scale={[0.3, 1, 1]}>
              <coneGeometry args={[0.2, 0.45, 4]} />
            </mesh>
          ))}
        </group>
      );
    case 'unicornpj':
      return (
        <group position={[0, 0.8, -0.3]}>
          {RAINBOW.slice(0, 4).map((c, i) => (
            <mesh key={c} material={mat(c)} position={[0, -i * 0.12, -0.12 - i * 0.08]}>
              <sphereGeometry args={[0.12, 10, 8]} />
            </mesh>
          ))}
        </group>
      );
    case 'banana':
      return (
        <>
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            return (
              <mesh
                key={i}
                castShadow
                material={mat('#fff1a8')}
                position={[Math.cos(a) * 0.42, 0.7, Math.sin(a) * 0.3]}
                rotation={[Math.sin(a) * 0.5 + Math.PI, 0, -Math.cos(a) * 0.5]}
                scale={[1, 1, 0.35]}
              >
                <coneGeometry args={[0.2, 0.55, 8]} />
              </mesh>
            );
          })}
        </>
      );
    case 'hotdog':
      return (
        <>
          <mesh castShadow geometry={rbox(1.3, 2.05, 0.34, 0.16)} material={mat('#e8b36a')} position={[0, 1.2, -0.42]} />
          <mesh geometry={rbox(1.2, 0.06, 0.04, 0.02)} material={mat('#fff3d6')} position={[0, 2.0, -0.24]} />
        </>
      );
  }
  return null;
}

/** Estampado del pecho que trae cada disfraz */
export const OUTFIT_DECAL: Record<string, string> = {
  penguin: 'belly',
  hotdog: 'mustard',
  hero: 'hero',
  astronaut: 'astro',
};
