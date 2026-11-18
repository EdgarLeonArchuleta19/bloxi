import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GameScreen, type GameId } from './game/GameScreen';
import { sfx } from './lib/sound';
import { AvatarEditor } from './screens/AvatarEditor';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Play } from './screens/Play';
import { Settings } from './screens/Settings';
import { useGame } from './store';
import { SkyBackground } from './ui/kit';

type Tab = 'home' | 'play' | 'avatar' | 'settings';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'home', label: 'Inicio', emoji: '🏠' },
  { id: 'play', label: 'Jugar', emoji: '🎮' },
  { id: 'avatar', label: 'Mi Bloxi', emoji: '👕' },
  { id: 'settings', label: 'Ajustes', emoji: '⚙️' },
];

export default function App() {
  const name = useGame((s) => s.name);
  const [tab, setTab] = useState<Tab>('home');
  const [game, setGame] = useState<GameId | null>(null);

  const screen = !name ? 'onboarding' : game ? 'game' : 'tabs';
  const startGame = (id: GameId) => {
    useGame.getState().markPlayed(id);
    setGame(id);
  };

  return (
    <div className="relative h-full w-full">
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
            <GameScreen id={game} onExit={() => setGame(null)} />
          </motion.div>
        )}
        {screen === 'tabs' && (
          <motion.div
            key="tabs"
            className="safe-top safe-x absolute inset-0 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="relative min-h-0 flex-1 pb-[104px] short:pb-[70px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  className="h-full"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {tab === 'home' && <Home onPlay={startGame} onEdit={() => setTab('avatar')} onAllGames={() => setTab('play')} />}
                  {tab === 'play' && <Play onPlay={startGame} />}
                  {tab === 'avatar' && <AvatarEditor onGoPlay={() => setTab('play')} />}
                  {tab === 'settings' && <Settings />}
                </motion.div>
              </AnimatePresence>
            </div>
            <TabBar tab={tab} onChange={setTab} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="safe-bottom pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4">
      <nav className="pointer-events-auto flex w-full max-w-[560px] gap-1 rounded-[30px] bg-white/95 p-1.5 shadow-[0_6px_0_rgba(51,38,77,0.08),0_16px_40px_rgba(51,38,77,0.18)] backdrop-blur">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => {
                if (active) return;
                sfx.tap();
                onChange(t.id);
              }}
              className="relative flex h-[64px] flex-1 flex-col items-center justify-center rounded-[22px] short:h-[48px] short:flex-row short:gap-1.5"
            >
              {active && (
                <motion.span
                  layoutId="tab-bubble"
                  className="absolute inset-0 rounded-[24px] bg-gradient-to-b from-[#ff8cc0] to-[#ff5fa2] shadow-[0_4px_0_#d93d82]"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <motion.span
                className="relative text-[26px] leading-none short:text-[20px]"
                animate={{ scale: active ? 1.15 : 1, y: active ? -2 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              >
                {t.emoji}
              </motion.span>
              <span className={`relative mt-1 text-sm font-bold short:mt-0 ${active ? 'text-white' : 'text-ink/60'}`}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
