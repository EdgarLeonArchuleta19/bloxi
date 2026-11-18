import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GameScreen, type GameId } from './game/GameScreen';
import { useRun } from './game/runStore';
import { AvatarEditor } from './screens/AvatarEditor';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Play } from './screens/Play';
import { Settings } from './screens/Settings';
import { useGame } from './store';
import { RotateDevice, SkyBackground } from './ui/kit';

type Screen = 'home' | 'play' | 'avatar' | 'settings';

// Transición tipo iOS: la pantalla nueva entra desde la derecha y la anterior se recorre un poquito
const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-25%', opacity: dir > 0 ? 1 : 0.6 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-25%' : '100%', opacity: dir > 0 ? 0.6 : 1 }),
};

export default function App() {
  const name = useGame((s) => s.name);
  const [stack, setStack] = useState<Screen[]>(['home']);
  const [dir, setDir] = useState(1);
  const [game, setGame] = useState<GameId | null>(null);
  const [stage, setStage] = useState(0);
  const gameRef = useRef<GameId | null>(null);
  const exiting = useRef(false);
  gameRef.current = game;

  const current = stack[stack.length - 1];
  const screen = !name ? 'onboarding' : game ? 'game' : 'app';

  // Botón "atrás" del celular / gesto de regresar = navegar dentro de la app
  useEffect(() => {
    history.replaceState({ bloxi: 0 }, '');
    const onPop = () => {
      if (exiting.current) {
        exiting.current = false;
        setGame(null);
        return;
      }
      if (gameRef.current) {
        // en el juego, "atrás" pone pausa en vez de salir de golpe
        const run = useRun.getState();
        if (run.status === 'playing') run.set({ status: 'paused' });
        history.pushState({ bloxi: 'game' }, '');
        return;
      }
      setDir(-1);
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((s: Screen) => {
    setDir(1);
    setStack((st) => [...st, s]);
    history.pushState({ bloxi: s }, '');
  }, []);
  const back = useCallback(() => history.back(), []);

  const startGame = (id: GameId, fromStage = 0) => {
    setStage(fromStage);
    useGame.getState().markPlayed(id);
    setGame(id);
    history.pushState({ bloxi: 'game' }, '');
  };
  const exitGame = () => {
    exiting.current = true;
    history.back();
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <SkyBackground />
      <AnimatePresence mode="wait">
        {screen === 'onboarding' && (
          <motion.div key="onb" className="absolute inset-0" exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.25 }}>
            <Onboarding />
          </motion.div>
        )}
        {screen === 'game' && game && (
          <motion.div
            key="game"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <GameScreen id={game} stage={stage} onExit={exitGame} />
          </motion.div>
        )}
        {screen === 'app' && (
          <motion.div key="app" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <AnimatePresence initial={false} custom={dir}>
              <motion.div
                key={current + stack.length}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 380, damping: 40 }}
                className="safe-top safe-x safe-bottom absolute inset-0 flex flex-col"
              >
                {current === 'home' && (
                  <Home onPlay={startGame} onEdit={() => go('avatar')} onAllGames={() => go('play')} onSettings={() => go('settings')} />
                )}
                {current === 'play' && <Play onPlay={startGame} onBack={back} />}
                {current === 'avatar' && <AvatarEditor onBack={back} onGoPlay={() => go('play')} />}
                {current === 'settings' && <Settings onBack={back} />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <RotateDevice />
    </div>
  );
}
