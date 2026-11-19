import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { DEFAULT_AVATAR, type AvatarConfig } from './data/items';
import { CityLevel } from './game/levels/City';
import { ColorFloorLevel } from './game/levels/ColorFloor';
import { LavaLevel } from './game/levels/LavaFloor';
import { RaceLevel } from './game/levels/Race';
import { ObbyLevel } from './game/levels/Obby';
import { StarIslandLevel } from './game/levels/StarIsland';
import type { ThumbShot } from './game/PlayWorld';
import { useRun } from './game/runStore';
import { useGame } from './store';

// Herramienta para generar portadas: abre /?thumb=obby y toma captura (scripts/make-thumbs.mjs)
const SHOTS: Record<string, { shot: ThumbShot; avatar: Partial<AvatarConfig> }> = {
  obby: {
    shot: { player: [0.4, 2.4, 13.4], cam: [-3.4, 5.4, 7.2], look: [1.2, 4.4, 24] },
    avatar: { hat: 'bow', back: 'butterfly' },
  },
  city: {
    shot: { player: [12.5, 0, -12.2], cam: [5.5, 4.2, -3.2], look: [14.5, 2.8, -17.5] },
    avatar: { hat: 'bow', glasses: 'heart' },
  },
  race: {
    shot: { player: [0, 0, 0], cam: [0, 0, 0], look: [0, 0, 0] },
    avatar: { hat: 'cap', glasses: 'sun' },
  },
  lava: {
    shot: { player: [0, 1.0, -11.4], cam: [7, 7.5, 6], look: [0.5, 0.6, -5] },
    avatar: { top: 'tee-heart', bottom: 'tutu-pink', hair: 'pigtails' },
  },
  colors: {
    shot: { player: [0, 0, 4.35], cam: [-3.6, 6.2, 11.5], look: [0.4, 1.0, 0] },
    avatar: { top: 'tee-dots', bottom: 'skirt-purple', hair: 'spacebuns', hairColor: '#ff6fae', face: 'happy' },
  },
  stars: {
    shot: { player: [0, 0, 7], cam: [0, 3.2, 13.5], look: [0, 1.6, 3] },
    avatar: { top: 'tee-rainbow', bottom: 'tutu-pink', hat: 'crown', face: 'stars' },
  },
};

export function ThumbScene({ id }: { id: string }) {
  const cfg = SHOTS[id] ?? SHOTS.obby;
  useEffect(() => {
    useGame.setState({ sound: false });
    useRun.getState().reset();
    useRun.getState().set({ status: 'playing' });
  }, []);
  const avatar = { ...DEFAULT_AVATAR, ...cfg.avatar };
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#8fd3ff] via-[#c4e7ff] to-[#ffe3f1]">
      <Canvas shadows flat dpr={1} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} camera={{ fov: 50, near: 0.1, far: 400 }}>
        {id === 'stars' && <StarIslandLevel avatar={avatar} thumb={cfg.shot} />}
        {id === 'colors' && <ColorFloorLevel avatar={avatar} thumb={cfg.shot} />}
        {id === 'obby' && <ObbyLevel avatar={avatar} thumb={cfg.shot} />}
        {id === 'city' && <CityLevel avatar={avatar} thumb={cfg.shot} />}
        {id === 'lava' && <LavaLevel avatar={avatar} thumb={cfg.shot} />}
        {id === 'race' && <RaceLevel avatar={avatar} thumb={cfg.shot} />}
      </Canvas>
    </div>
  );
}
