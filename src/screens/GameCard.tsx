import { motion } from 'motion/react';
import { formatTime } from '../game/levels/Obby';
import { sfx } from '../lib/sound';
import { useGame } from '../store';
import { CandyButton, Modal } from '../ui/kit';
import type { GameInfo } from './games';

export function useBest(game: GameInfo) {
  const bestObby = useGame((s) => s.bestObby);
  const bestStars = useGame((s) => s.bestStars);
  if (game.id === 'obby') return bestObby !== null ? formatTime(bestObby) : null;
  return bestStars > 0 ? `${bestStars} ⭐` : null;
}

/** Portada: captura real del juego + nombre encima */
export function GameThumb({ game, rounded = 'rounded-[22px]' }: { game: GameInfo; rounded?: string }) {
  return (
    <div
      className={`@container relative aspect-square w-full overflow-hidden ${rounded}`}
      style={{ background: game.gradient, boxShadow: `0 5px 0 ${game.shade}` }}
    >
      <img src={game.thumb} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#33264d]/70 via-[#33264d]/25 to-transparent" />
      <div
        className="absolute inset-x-[6%] bottom-[6%] font-bold leading-[0.95] text-white"
        style={{
          fontSize: '13.5cqw',
          WebkitTextStroke: 'calc(1.2cqw) #33264d',
          paintOrder: 'stroke fill',
          textShadow: '0 0.8cqw 0 rgba(0,0,0,0.25)',
        }}
      >
        {game.title}
      </div>
    </div>
  );
}

/** Tile de la cuadrícula: portada + nombre + info */
export function GameTile({ game, onOpen }: { game: GameInfo; onOpen: () => void }) {
  const best = useBest(game);
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={() => {
        sfx.tap();
        onOpen();
      }}
      className="flex w-full flex-col text-left"
    >
      <GameThumb game={game} />
      <div className="mt-2 truncate px-1 text-sm font-bold text-ink/55 tablet:text-base">{best ? `🏅 Récord: ${best}` : `${game.emoji} ${game.category} · ${game.duration}`}</div>
    </motion.button>
  );
}

/** Ficha del juego con el botón grande de Jugar */
export function GameSheet({ game, onClose, onPlay }: { game: GameInfo | null; onClose: () => void; onPlay: (g: GameInfo) => void }) {
  return (
    <Modal open={!!game} onClose={onClose}>
      {game && <SheetBody game={game} onClose={onClose} onPlay={onPlay} />}
    </Modal>
  );
}

function SheetBody({ game, onClose, onPlay }: { game: GameInfo; onClose: () => void; onPlay: (g: GameInfo) => void }) {
  const best = useBest(game);
  return (
    <>
      <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl font-bold shadow">
        ✕
      </button>
      <div className="mx-auto w-[min(15rem,34vh)]">
        <GameThumb game={game} rounded="rounded-[26px]" />
      </div>
      <p className="mt-4 text-lg leading-snug text-ink/70 short:mt-2 short:text-base">{game.desc}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2 text-base font-bold">
        <span className="rounded-full bg-[#e9f8f1] px-3 py-1 text-mint-dark">😊 {game.difficulty}</span>
        <span className="rounded-full bg-[#e8f5ff] px-3 py-1 text-sky-dark">⏱ {game.duration}</span>
        <span className="rounded-full bg-[#f1ebff] px-3 py-1 text-grape-dark">🏷️ {game.category}</span>
        {best && <span className="rounded-full bg-[#fff6d6] px-3 py-1 text-[#8a5a00]">🏅 {best}</span>}
      </div>
      <CandyButton tone="mint" className="mt-5 h-16 w-full text-3xl short:mt-3 short:h-14 short:text-2xl" onClick={() => onPlay(game)}>
        ▶ ¡Jugar!
      </CandyButton>
    </>
  );
}
