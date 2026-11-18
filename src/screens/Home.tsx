import { useState } from 'react';
import { motion } from 'motion/react';
import { ITEMS } from '../data/items';
import type { GameId } from '../game/GameScreen';
import { sfx } from '../lib/sound';
import { useGame } from '../store';
import { Showcase } from '../three/Showcase';
import { CandyButton, CoinIcon, CoinPill } from '../ui/kit';
import { GameSheet, GameTile } from './GameCard';
import { GAMES, type GameInfo } from './games';

const FEATURED_OUTFITS = ['banana', 'dino', 'hotdog', 'unicornpj', 'shark', 'robot', 'princess', 'astronaut'];

function Row({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between">
        <h2 className="text-2xl font-bold max-sm:text-xl short:text-lg">{title}</h2>
        {action && (
          <button
            onClick={() => {
              sfx.tap();
              onAction?.();
            }}
            className="text-lg font-bold text-grape"
          >
            {action} ›
          </button>
        )}
      </div>
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">{children}</div>
    </section>
  );
}

export function Home({
  onPlay, onEdit, onAllGames,
}: {
  onPlay: (id: GameId) => void;
  onEdit: (tab?: 'outfit') => void;
  onAllGames: () => void;
}) {
  const name = useGame((s) => s.name);
  const coins = useGame((s) => s.coins);
  const avatar = useGame((s) => s.avatar);
  const recent = useGame((s) => s.recent);
  const owned = useGame((s) => s.owned);
  const [open, setOpen] = useState<GameInfo | null>(null);

  const recentGames = recent.map((id) => GAMES.find((g) => g.id === id)).filter(Boolean) as GameInfo[];
  const games = recentGames.length ? [...recentGames, ...GAMES.filter((g) => !recent.includes(g.id))] : GAMES;
  const outfits = FEATURED_OUTFITS.map((id) => ITEMS.find((i) => i.cat === 'outfit' && i.id === id)!).filter(Boolean);

  return (
    <div className="flex h-full flex-col gap-4 landscape:flex-row landscape:gap-6">
      {/* Bloxi */}
      <motion.div
        className="card relative flex shrink-0 flex-col overflow-hidden portrait:h-[36%] landscape:w-[36%]"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#e7f6ff] to-[#fff0f8]" />
        <Showcase config={avatar} className="relative min-h-0 flex-1" />
        <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-base font-bold short:hidden">💫 Mi Bloxi</div>
        <div className="absolute inset-x-3 bottom-3 flex justify-center">
          <CandyButton tone="grape" className="h-12 px-5 text-lg short:h-10 short:px-4 short:text-base" onClick={() => onEdit()}>
            👗 Vestir a mi Bloxi
          </CandyButton>
        </div>
      </motion.div>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2 short:gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-bold max-sm:text-3xl short:text-2xl">
              ¡Hola, {name}! <span className="inline-block origin-[70%_70%] animate-[wave_2s_ease-in-out_infinite]">👋</span>
            </h1>
            <p className="text-xl text-ink/60 short:hidden max-sm:text-lg">¿A qué jugamos hoy?</p>
          </div>
          <CoinPill amount={coins} />
        </div>

        <Row title={recentGames.length ? '🔁 Seguir jugando' : '🎮 Juegos'} action="Ver todos" onAction={onAllGames}>
          {games.slice(0, 8).map((g) => (
            <div key={g.id} className="w-[150px] shrink-0 max-sm:w-[128px] short:w-[112px] tablet:w-[200px]">
              <GameTile game={g} onOpen={() => setOpen(g)} />
            </div>
          ))}
        </Row>

        <Row title="🎭 Disfraces chistosos" action="Ir al armario" onAction={() => onEdit('outfit')}>
          {outfits.map((o) => {
            const has = owned.includes(`outfit:${o.id}`);
            const wearing = avatar.outfit === o.id;
            return (
              <motion.button
                key={o.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  sfx.tap();
                  onEdit('outfit');
                }}
                className="card relative flex w-[112px] shrink-0 flex-col items-center px-2 pb-2.5 pt-3 short:w-[96px] short:pt-2 tablet:w-[140px] tablet:pt-4"
              >
                <span className="text-5xl short:text-4xl tablet:text-6xl">{o.emoji}</span>
                <span className="mt-1 line-clamp-1 text-base font-bold">{o.name}</span>
                {wearing ? (
                  <span className="mt-1 rounded-full bg-mint px-2.5 text-sm font-bold text-white">Puesto ✓</span>
                ) : has ? (
                  <span className="mt-1 rounded-full bg-[#f1ebff] px-2.5 text-sm font-bold text-grape-dark">Es tuyo</span>
                ) : (
                  <span className="mt-1 flex items-center gap-1 rounded-full bg-sun px-2.5 text-sm font-bold text-[#5a3b00]">
                    <CoinIcon size={16} /> {o.price}
                  </span>
                )}
              </motion.button>
            );
          })}
        </Row>
      </div>

      <GameSheet game={open} onClose={() => setOpen(null)} onPlay={(g) => onPlay(g.id)} />
    </div>
  );
}
