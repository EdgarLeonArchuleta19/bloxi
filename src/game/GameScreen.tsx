import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'motion/react';
import { bindKeyboard, resetInput } from '../lib/input';
import { sfx } from '../lib/sound';
import { useGame } from '../store';
import { CandyButton, CoinIcon, Confetti, Modal } from '../ui/kit';
import { OBBY_CHECKPOINTS, ObbyLevel, formatTime } from './levels/Obby';
import { COLOR_ROUNDS, ColorFloorLevel } from './levels/ColorFloor';
import { STAR_TIME, StarIslandLevel } from './levels/StarIsland';
import { useRun } from './runStore';
import { backToLobby, leaveRoom, startRoomGame, useRoom } from '../net/room';
import { ControlsEditor } from './ControlsEditor';
import { TouchControls } from './TouchControls';

export type GameId = 'obby' | 'stars' | 'colors';

export function GameScreen({ id, onExit, stage = 0, net = false }: { id: GameId; onExit: () => void; stage?: number; net?: boolean }) {
  // en sala el menú no detiene el juego (los demás siguen jugando)
  const [menu, setMenu] = useState(false);
  const isHost = useRoom((s) => s.isHost);
  const avatar = useGame((s) => s.avatar);
  // limpiar la partida anterior ANTES del primer render (evita avisos viejos)
  useState(() => useRun.getState().reset());
  const [runKey, setRunKey] = useState(0);
  const [count, setCount] = useState<number | null>(3);
  const [editing, setEditing] = useState(false);
  const status = useRun((s) => s.status);

  // reiniciar partida + cuenta regresiva
  useEffect(() => {
    bindKeyboard();
    resetInput();
    useRun.getState().reset();
    if (id === 'stars') useRun.getState().set({ time: STAR_TIME });
    if (id === 'obby') useRun.getState().set({ checkpoint: stage });
    const seq = [3, 2, 1, 0];
    const timers = seq.map((n, i) =>
      setTimeout(() => {
        setCount(n);
        if (n > 0) sfx.count();
        else {
          sfx.go();
          useRun.getState().set({ status: 'playing' });
        }
      }, 400 + i * 800),
    );
    const hide = setTimeout(() => setCount(null), 400 + seq.length * 800);
    setCount(null);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(hide);
    };
  }, [runKey, id, stage]);

  // pausar si la app pasa a segundo plano
  useEffect(() => {
    const onVis = () => {
      if (!net && document.hidden && useRun.getState().status === 'playing') useRun.getState().set({ status: 'paused' });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-b from-[#8fd3ff] via-[#c4e7ff] to-[#ffe3f1]">
      <Canvas
        key={runKey}
        shadows
        flat
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 55, near: 0.1, far: 400, position: [0, 5, -10] }}
        className="!absolute inset-0"
      >
        {id === 'obby' && <ObbyLevel avatar={avatar} startStage={stage} />}
        {id === 'stars' && <StarIslandLevel avatar={avatar} />}
        {id === 'colors' && <ColorFloorLevel avatar={avatar} />}
      </Canvas>

      {status !== 'done' && <TouchControls />}
      <Hud id={id} onPause={() => (net ? setMenu(true) : useRun.getState().set({ status: 'paused' }))} />
      {id === 'colors' && <ColorBanner />}
      <Toast />

      {/* Cuenta regresiva */}
      <AnimatePresence>
        {count !== null && (
          <motion.div
            key={count}
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
            initial={{ scale: 2.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 20 }}
          >
            <span className="title-stroke text-[min(140px,28vmin)] font-bold leading-none text-sun drop-shadow-lg">
              {count === 0 ? '¡YA!' : count}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pausa */}
      <Modal open={(net ? menu : status === 'paused') && !editing} wide>
        <div className="flex items-center gap-6 short:gap-4">
          <div className="flex w-[30%] shrink-0 flex-col items-center">
            <div className="text-7xl short:text-5xl">⏸️</div>
            <h2 className="mt-2 text-3xl font-bold short:text-2xl">Pausa</h2>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 short:gap-2">
            <CandyButton
              tone="mint"
              className="col-span-2 h-16 text-2xl short:h-12 short:text-xl"
              onClick={() => (net ? setMenu(false) : useRun.getState().set({ status: 'playing' }))}
            >
              ▶ Seguir jugando
            </CandyButton>
            {!net && (
              <CandyButton tone="sky" className="h-14 text-lg short:h-11 short:text-base" onClick={() => setRunKey((k) => k + 1)}>
                🔄 Otra vez
              </CandyButton>
            )}
            <CandyButton tone="grape" className={`h-14 text-lg short:h-11 short:text-base ${net ? 'col-span-2' : ''}`} onClick={() => setEditing(true)}>
              🕹️ Botones
            </CandyButton>
            {net ? (
              <CandyButton
                tone="white"
                className="col-span-2 h-14 text-lg short:h-11 short:text-base"
                onClick={() => {
                  leaveRoom();
                  onExit();
                }}
              >
                🚪 Salir de la sala
              </CandyButton>
            ) : (
              <CandyButton tone="white" className="col-span-2 h-14 text-lg short:h-11 short:text-base" onClick={onExit}>
                🏠 Salir al inicio
              </CandyButton>
            )}
          </div>
        </div>
      </Modal>
      <AnimatePresence>{editing && <ControlsEditor onClose={() => setEditing(false)} />}</AnimatePresence>

      {net ? (
        <ResultModal
          onAgain={isHost ? () => startRoomGame() : undefined}
          onExit={() => backToLobby()}
          exitLabel="👫 A la sala"
        />
      ) : (
        <ResultModal onAgain={() => setRunKey((k) => k + 1)} onExit={onExit} />
      )}
    </div>
  );
}

function Hud({ id, onPause }: { id: GameId; onPause: () => void }) {
  const { status, coins, time, stars, checkpoint, lives, round, players } = useRun();
  const low = id === 'stars' && time <= 10 && status === 'playing';
  return (
    <div className="safe-top safe-x pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3">
      <button
        onClick={() => {
          if (status !== 'playing') return;
          sfx.tap();
          onPause();
        }}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-2xl short:h-11 short:w-11 short:text-xl shadow-[0_5px_0_rgba(51,38,77,0.15)] active:translate-y-1"
      >
        ⏸
      </button>

      <div className="flex items-center gap-3 rounded-full bg-white/95 px-5 py-2 text-2xl font-bold shadow-[0_5px_0_rgba(51,38,77,0.12)] max-sm:gap-2 max-sm:px-3 max-sm:text-lg short:py-1 short:text-lg">
        {id === 'colors' ? (
          <>
            <span className="tracking-tight">{'❤️'.repeat(Math.max(0, lives))}{'🤍'.repeat(Math.max(0, 3 - lives))}</span>
            <span className="h-6 w-0.5 rounded bg-ink/15" />
            <span className="tabular-nums">
              Ronda {Math.max(1, round)}/{COLOR_ROUNDS}
            </span>
            <span className="h-6 w-0.5 rounded bg-ink/15" />
            <span className="tabular-nums">👥 {players}</span>
          </>
        ) : id === 'obby' ? (
          <>
            <span>🚩 {checkpoint}/{OBBY_CHECKPOINTS}</span>
            <span className="h-6 w-0.5 rounded bg-ink/15" />
            <span className="tabular-nums">⏱ {formatTime(time)}</span>
          </>
        ) : (
          <>
            <span>⭐ {stars}</span>
            <span className="h-6 w-0.5 rounded bg-ink/15" />
            <motion.span
              className={`tabular-nums ${low ? 'text-candy' : ''}`}
              animate={low ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={{ repeat: low ? Infinity : 0, duration: 1 }}
            >
              ⏱ {Math.ceil(time)}
            </motion.span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-1.5 pr-4 text-2xl font-bold shadow-[0_5px_0_rgba(51,38,77,0.12)] max-sm:text-lg short:text-lg">
        <CoinIcon size={34} />
        <span className="tabular-nums">+{coins}</span>
      </div>
    </div>
  );
}

/** Letrero gigante: "¡Párate en AZUL!" con barra de tiempo */
function ColorBanner() {
  const banner = useRun((s) => s.banner);
  const bar = useRun((s) => s.bar);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[13%] z-30 flex justify-center px-4 short:top-[20%]">
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.name + banner.color}
            initial={{ scale: 0.4, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="flex flex-col items-center gap-2 rounded-[28px] bg-white/95 px-6 py-3 shadow-[0_6px_0_rgba(51,38,77,0.15)] short:py-2"
          >
            <div className="flex items-center gap-3 text-3xl font-bold max-sm:text-2xl short:text-2xl">
              <span className="h-11 w-11 rounded-2xl border-4 border-white shadow-md short:h-8 short:w-8" style={{ background: banner.color }} />
              <span>
                ¡Párate en <span style={{ color: banner.color, WebkitTextStroke: '1.5px #33264d', paintOrder: 'stroke fill' }}>{banner.name}</span>!
              </span>
            </div>
            <div className="h-3 w-full min-w-[220px] overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${bar * 100}%`, background: banner.color }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toast() {
  const toast = useRun((s) => s.toast);
  const [visible, setVisible] = useState<typeof toast>(null);
  useEffect(() => {
    if (!toast) return;
    setVisible(toast);
    const t = setTimeout(() => setVisible(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[34%] z-30 flex justify-center">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={visible.id}
            initial={{ scale: 0.3, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="title-stroke px-4 text-center text-5xl font-bold text-white drop-shadow-lg max-sm:text-3xl short:text-3xl"
          >
            {visible.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultModal({ onAgain, onExit, exitLabel = '🏠 Salir' }: { onAgain?: () => void; onExit: () => void; exitLabel?: string }) {
  const result = useRun((s) => s.result);
  const name = useGame((s) => s.name);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!result) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 1300);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <>
      {show && <Confetti />}
      <Modal open={show && !!result} wide>
        {result && (
          <div className="flex items-center gap-6 short:gap-4">
          <div className="flex w-[36%] shrink-0 flex-col items-center">
            <motion.div
              className="text-8xl short:text-6xl"
              animate={{ rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1 }}
            >
              {result.emoji}
            </motion.div>
            <h2 className="mt-2 text-3xl font-bold leading-tight short:text-2xl">{result.title}</h2>
            <p className="mt-1 text-lg text-ink/70 short:text-base">¡Muy bien, {name}! 🎉</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <p className="text-xl font-semibold leading-snug short:text-base">{result.subtitle}</p>
            {result.record && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                className="mx-auto mt-2 w-fit rounded-full bg-sun px-4 py-1 text-lg font-bold text-[#5a3b00] short:text-base"
              >
                🏅 ¡Nuevo récord!
              </motion.div>
            )}
            <div className="mx-auto mt-3 flex w-fit items-center gap-3 rounded-3xl bg-[#fff6d6] px-6 py-3 short:mt-2 short:py-2">
              <CoinIcon size={44} />
              <span className="text-4xl font-bold short:text-3xl">+{result.coins}</span>
            </div>
            <div className="mt-5 flex w-full gap-3 short:mt-3">
              <CandyButton tone="white" className="h-16 flex-1 text-xl short:h-12 short:text-lg" onClick={onExit}>
                {exitLabel}
              </CandyButton>
              {onAgain && (
                <CandyButton tone="mint" className="h-16 flex-1 text-xl short:h-12 short:text-lg" onClick={onAgain}>
                  🔄 Otra vez
                </CandyButton>
              )}
            </div>
          </div>
          </div>
        )}
      </Modal>
    </>
  );
}
