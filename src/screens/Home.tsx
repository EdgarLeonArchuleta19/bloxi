import { useState } from 'react';
import { motion } from 'motion/react';
import { ITEMS } from '../data/items';
import type { GameId } from '../game/GameScreen';
import { sfx } from '../lib/sound';
import { useGame } from '../store';
import { Showcase } from '../three/Showcase';
import { CandyButton, CoinIcon, CoinPill, RoundButton } from '../ui/kit';
import { GameSheet, GameTile } from './GameCard';
import { GAMES, type GameInfo } from './games';

const FEATURED_OUTFITS = ['banana', 'dino', 'hotdog', 'unicornpj', 'shark', 'robot', 'princess', 'astronaut'];

function Row({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <section className="shrink-0">
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <h2 className="text-2xl font-bold short:text-lg">{title}</h2>
        {action && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              sfx.tap();
              onAction?.();
            }}
            className="shrink-0 rounded-full bg-white/80 px-4 py-1.5 text-lg font-bold text-grape short:px-3 short:py-1 short:text-base"
          >
            {action} ›
          </motion.button>
        )}
      </div>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2 pt-1 tablet:gap-4">{children}</div>
    </section>
  );
}

export function Home({
  onPlay, onEdit, onAllGames, onSettings, onFriends,
}: {
  onPlay: (id: GameId, stage?: number) => void;
  onEdit: () => void;
  onAllGames: () => void;
  onSettings: () => void;
  onFriends: () => void;
}) {
  const name = useGame((s) => s.name);
  const coins = useGame((s) => s.coins);
  const avatar = useGame((s) => s.avatar);
  const recent = useGame((s) => s.recent);
  const owned = useGame((s) => s.owned);
  const allowRooms = useGame((s) => s.allowRooms);
  const [open, setOpen] = useState<GameInfo | null>(null);

  const recentGames = recent.map((id) => GAMES.find((g) => g.id === id)).filter(Boolean) as GameInfo[];
  const games = [...recentGames, ...GAMES.filter((g) => !recent.includes(g.id))];
  const outfits = FEATURED_OUTFITS.map((id) => ITEMS.find((i) => i.cat === 'outfit' && i.id === id)!).filter(Boolean);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 short:gap-2">
      {/* Barra de arriba */}
      <header className="flex shrink-0 items-center justify-between gap-3">
        <h1 className="truncate text-4xl font-bold short:text-2xl">
          ¡Hola, {name}! <span className="inline-block origin-[70%_70%] animate-[wave_2s_ease-in-out_infinite]">👋</span>
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {allowRooms && (
            <CandyButton tone="sky" className="h-14 px-5 text-xl short:h-11 short:px-4 short:text-base" onClick={onFriends}>
              👫 Amigos
            </CandyButton>
          )}
          <CoinPill amount={coins} />
          <RoundButton onClick={onSettings} label="Ajustes">
            ⚙️
          </RoundButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 short:gap-3">
        {/* Bloxi: tocar para ir al armario */}
        <motion.div
          className="card relative flex w-[36%] shrink-0 flex-col overflow-hidden short:w-[32%]"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 26 }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#e7f6ff] to-[#fff0f8]" />
          <Showcase config={avatar} className="relative min-h-0 flex-1" />
          <div className="absolute inset-x-3 bottom-3 flex justify-center short:bottom-2">
            <CandyButton tone="grape" className="h-14 px-6 text-xl short:h-11 short:px-4 short:text-base" onClick={onEdit}>
              👗 Mi Bloxi
            </CandyButton>
          </div>
        </motion.div>

        {/* Juegos y disfraces */}
        <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto short:gap-1">
          <Row title={recentGames.length ? '🔁 Seguir jugando' : '🎮 Juegos'} action="🔍 Ver todos" onAction={onAllGames}>
            {games.slice(0, 10).map((g) => (
              <div key={g.id} className="w-[170px] shrink-0 short:w-[118px] tablet:w-[210px]">
                <GameTile game={g} onOpen={() => setOpen(g)} />
              </div>
            ))}
          </Row>

          <Row title="🎭 Disfraces chistosos" action="Armario" onAction={onEdit}>
            {outfits.map((o) => {
              const has = o.price === 0 || owned.includes(`outfit:${o.id}`);
              const wearing = avatar.outfit === o.id;
              return (
                <motion.button
                  key={o.id}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    sfx.tap();
                    onEdit();
                  }}
                  className="card relative flex w-[118px] shrink-0 flex-col items-center px-2 pb-2.5 pt-3 short:w-[92px] short:pb-1.5 short:pt-1.5 tablet:w-[140px] tablet:pt-4"
                >
                  <span className="text-5xl short:text-3xl tablet:text-6xl">{o.emoji}</span>
                  <span className="mt-1 line-clamp-1 text-base font-bold short:text-sm">{o.name}</span>
                  {wearing ? (
                    <span className="mt-1 rounded-full bg-mint px-2.5 text-sm font-bold text-white">Puesto ✓</span>
                  ) : has ? (
                    <span className="mt-1 rounded-full bg-[#f1ebff] px-2.5 text-sm font-bold text-grape-dark">{o.price === 0 ? '¡Gratis!' : 'Es tuyo'}</span>
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
      </div>

      <GameSheet game={open} onClose={() => setOpen(null)} onPlay={(g, st) => onPlay(g.id, st)} />
    </div>
  );
}
