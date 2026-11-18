import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GameScreen, type GameId } from './game/GameScreen';
import { useRun } from './game/runStore';
import { leaveRoom, useRoom } from './net/room';
import { AvatarEditor } from './screens/AvatarEditor';
import { Friends } from './screens/Friends';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Play } from './screens/Play';
import { Settings } from './screens/Settings';
import { applyUpdate, useUpdate } from './lib/pwa';
import { useGame } from './store';
import { RotateDevice, SkyBackground } from './ui/kit';
import { fadeTransition, pageTransition, popSpring } from './ui/motion';

type Screen = 'home' | 'play' | 'avatar' | 'settings' | 'friends';

// Link para entrar directo a una sala: ...?sala=PANDA472
const linkCode = new URLSearchParams(location.search).get('sala') ?? '';

// Transición tipo iOS: la pantalla nueva entra desde la derecha y la anterior se recorre un poquito
const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-22%', opacity: dir > 0 ? 1 : 0.7 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-22%' : '100%', opacity: dir > 0 ? 0.7 : 1 }),
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
  const roomStatus = useRoom((s) => s.status);
  const roomInGame = useRoom((s) => s.inGame);
  const roomGame = useRoom((s) => s.game);
  const roomRun = useRoom((s) => s.run);
  const netGame = roomStatus === 'playing' && roomInGame;
  const screen = !name ? 'onboarding' : netGame ? 'net' : game ? 'game' : 'app';

  // si llegaron con link de sala, abrir la pantalla de amigos
  useEffect(() => {
    if (name && linkCode && useGame.getState().allowRooms) {
      history.replaceState({ bloxi: 0 }, '', location.pathname);
      go('friends');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!name]);

  // Botón "atrás" del celular / gesto de regresar = navegar dentro de la app
  useEffect(() => {
    history.replaceState({ bloxi: 0 }, '');
    const onPop = () => {
      if (exiting.current) {
        exiting.current = false;
        setGame(null);
        return;
      }
      if (gameRef.current || (useRoom.getState().status === 'playing' && useRoom.getState().inGame)) {
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
          <motion.div key="onb" className="absolute inset-0" exit={{ opacity: 0, scale: 1.03 }} transition={fadeTransition}>
            <Onboarding />
          </motion.div>
        )}
        {screen === 'game' && game && (
          <motion.div
            key="game"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
          >
            <GameScreen id={game} stage={stage} onExit={exitGame} />
          </motion.div>
        )}
        {screen === 'net' && (
          <motion.div key={`net${roomRun}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fadeTransition}>
            <GameScreen
              id={roomGame}
              net
              onExit={() => {
                // salió de la sala: regresar al inicio
                setDir(-1);
                setStack(['home']);
              }}
            />
          </motion.div>
        )}
        {screen === 'app' && (
          <motion.div key="app" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fadeTransition}>
            <AnimatePresence initial={false} custom={dir}>
              <motion.div
                key={current + stack.length}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={pageTransition}
                style={{ willChange: 'transform' }}
                className="safe-top safe-x safe-bottom absolute inset-0 flex flex-col"
              >
                {current === 'home' && (
                  <Home
                    onPlay={startGame}
                    onEdit={() => go('avatar')}
                    onAllGames={() => go('play')}
                    onSettings={() => go('settings')}
                    onFriends={() => go('friends')}
                  />
                )}
                {current === 'play' && <Play onPlay={startGame} onBack={back} />}
                {current === 'avatar' && <AvatarEditor onBack={back} onGoPlay={() => go('play')} />}
                {current === 'settings' && <Settings onBack={back} />}
                {current === 'friends' && (
                  <Friends
                    initialCode={linkCode}
                    onBack={() => {
                      leaveRoom();
                      back();
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <UpdateNotice inGame={screen === 'game' || screen === 'net'} />
      <RotateDevice />
    </div>
  );
}

/** Cuando hay versión nueva: avisar y actualizar solita (nunca a media partida) */
function UpdateNotice({ inGame }: { inGame: boolean }) {
  const ready = useUpdate((s) => s.ready);
  const show = ready && !inGame;
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(applyUpdate, 1800);
    return () => clearTimeout(t);
  }, [show]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-[#33264d]/40 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="card flex items-center gap-5 px-8 py-6"
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={popSpring}
          >
            <motion.span className="text-6xl" animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 1, repeat: Infinity }}>
              ✨
            </motion.span>
            <div>
              <div className="text-2xl font-bold">¡Bloxi tiene cosas nuevas!</div>
              <div className="text-lg text-ink/60">Actualizando… tu progreso no se pierde 💖</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
