import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { GameId } from '../game/GameScreen';
import { sfx } from '../lib/sound';
import { useGame } from '../store';
import { CoinPill } from '../ui/kit';
import { GameSheet, GameTile } from './GameCard';
import { GAME_CATEGORIES, searchGames, type GameInfo } from './games';

export function Play({ onPlay }: { onPlay: (id: GameId) => void }) {
  const coins = useGame((s) => s.coins);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('Todos');
  const [open, setOpen] = useState<GameInfo | null>(null);
  const results = searchGames(query, cat);

  return (
    <div className="flex h-full flex-col gap-3 short:gap-2">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-bold max-sm:text-3xl short:text-2xl">🎮 Juegos</h1>
        <CoinPill amount={coins} />
      </div>

      {/* Buscador */}
      <div className="relative">
        <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-xl">🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar juegos…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-14 w-full rounded-full border-4 border-transparent bg-white/95 pl-14 pr-14 text-xl font-semibold short:h-11 short:text-lg shadow-[0_5px_0_rgba(51,38,77,0.08)] outline-none placeholder:text-ink/30 focus:border-grape"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-ink/10 text-lg font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {/* Categorías */}
      <div className="no-scrollbar -mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-1">
        {GAME_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => {
              sfx.tap();
              setCat(c);
            }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-base font-bold transition-colors ${
              cat === c ? 'bg-ink text-white' : 'bg-white/90 text-ink/70'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Cuadrícula */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-2 pt-1">
        <AnimatePresence mode="popLayout">
          {results.length ? (
            <motion.div
              key="grid"
              className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-4 gap-y-5 short:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] tablet:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] tablet:gap-x-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {results.map((g) => (
                <motion.div key={g.id} layout initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <GameTile game={g} onOpen={() => setOpen(g)} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div key="empty" className="flex flex-col items-center py-14 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="text-7xl">🥲</span>
              <p className="mt-3 text-2xl font-bold">No encontramos ese juego</p>
              <p className="text-lg text-ink/60">Intenta con otra palabra</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GameSheet game={open} onClose={() => setOpen(null)} onPlay={(g) => onPlay(g.id)} />
    </div>
  );
}
