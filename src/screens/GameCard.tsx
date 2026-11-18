import { motion } from 'motion/react';
import { OBBY_STAGES, formatTime } from '../game/levels/Obby';
import { sfx } from '../lib/sound';
import { useGame } from '../store';
import { CandyButton, Modal } from '../ui/kit';
import type { GameInfo } from './games';

export function useBest(game: GameInfo) {
  const bestObby = useGame((s) => s.bestObby);
  const bestStars = useGame((s) => s.bestStars);
  const bestColors = useGame((s) => s.bestColors);
  if (game.id === 'obby') return bestObby !== null ? formatTime(bestObby) : null;
  if (game.id === 'colors') return bestColors > 0 ? `${bestColors} rondas` : null;
  if (game.id === 'city' || game.id === 'lava') return null;
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
type PlayFn = (g: GameInfo, stage?: number) => void;

export function GameSheet({ game, onClose, onPlay }: { game: GameInfo | null; onClose: () => void; onPlay: PlayFn }) {
  return (
    <Modal open={!!game} onClose={onClose} wide>
      {game && <SheetBody game={game} onClose={onClose} onPlay={onPlay} />}
    </Modal>
  );
}

function SheetBody({ game, onClose, onPlay }: { game: GameInfo; onClose: () => void; onPlay: PlayFn }) {
  const best = useBest(game);
  const obbyStage = useGame((s) => s.obbyStage);
  const canContinue = game.id === 'obby' && obbyStage > 0;
  return (
    <>
      <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl font-bold shadow">
        ✕
      </button>
      <div className="flex items-center gap-6 text-left short:gap-4">
      <div className="w-[min(40%,46vh)] shrink-0">
        <GameThumb game={game} rounded="rounded-[26px]" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pr-10 short:gap-2">
      <p className="text-lg leading-snug text-ink/70 short:text-base short:leading-tight">{game.desc}</p>
      <div className="flex flex-wrap gap-2 text-base font-bold short:text-sm">
        <span className="rounded-full bg-[#e9f8f1] px-3 py-1 text-mint-dark">😊 {game.difficulty}</span>
        <span className="rounded-full bg-[#e8f5ff] px-3 py-1 text-sky-dark">⏱ {game.duration}</span>
        <span className="rounded-full bg-[#f1ebff] px-3 py-1 text-grape-dark">🏷️ {game.category}</span>
        {best && <span className="rounded-full bg-[#fff6d6] px-3 py-1 text-[#8a5a00]">🏅 {best}</span>}
      </div>
      {canContinue ? (
        <div className="mt-1 flex flex-col gap-2.5">
          <CandyButton tone="mint" className="h-16 w-full text-2xl short:h-12 short:text-lg" onClick={() => onPlay(game, obbyStage)}>
            ⏩ Seguir en etapa {obbyStage + 1}
          </CandyButton>
          <CandyButton tone="white" className="h-14 w-full text-xl short:h-11 short:text-base" onClick={() => onPlay(game, 0)}>
            ▶ Desde el inicio
          </CandyButton>
          <p className="text-center text-sm text-ink/50">
            Llevas {obbyStage} de {OBBY_STAGES.length - 1} checkpoints 🚩 {OBBY_STAGES[obbyStage]?.emoji}
          </p>
        </div>
      ) : (
        <CandyButton tone="mint" className="mt-1 h-16 w-full text-3xl short:h-12 short:text-xl" onClick={() => onPlay(game)}>
          ▶ ¡Jugar!
        </CandyButton>
      )}
      </div>
      </div>
    </>
  );
}
