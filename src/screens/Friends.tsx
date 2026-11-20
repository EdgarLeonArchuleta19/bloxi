import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  BOT_FILL, createRoom, formatCode, joinRoom, leaveRoom, setRoomBots, setRoomGame, startRoomGame, useRoom, type NetGame, type NetPlayer,
} from '../net/room';
import { sfx } from '../lib/sound';
import { CandyButton, ScreenHeader, Toggle } from '../ui/kit';
import { GameThumb } from './GameCard';
import { GAMES } from './games';

const ROOM_GAMES: { id: NetGame; label: string }[] = [
  { id: 'colors', label: 'Piso de Colores' },
  { id: 'stars', label: 'Atrapa Estrellas' },
  { id: 'obby', label: 'Carrera en el Obby' },
  { id: 'race', label: 'Carreritas' },
  { id: 'lava', label: 'El Piso es Lava' },
  { id: 'jail', label: 'Escapa de la Cárcel' },
];

export function Friends({ onBack, initialCode = '' }: { onBack: () => void; initialCode?: string }) {
  const status = useRoom((s) => s.status);
  const inGame = useRoom((s) => s.inGame);

  const leave = () => {
    leaveRoom();
    onBack();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeader title="👫 Jugar con amigos" onBack={status === 'lobby' || status === 'playing' ? leave : onBack} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-2">
        {(status === 'idle' || status === 'error') && <Start initialCode={initialCode} />}
        {status === 'connecting' && <Connecting />}
        {(status === 'lobby' || (status === 'playing' && !inGame)) && <Lobby />}
      </div>
    </div>
  );
}

/* ---------------- Crear o unirse ---------------- */
function Start({ initialCode }: { initialCode: string }) {
  const error = useRoom((s) => s.error);
  const [code, setCode] = useState(initialCode.toUpperCase());
  const clean = code.replace(/[^A-Z0-9]/g, '');

  return (
    <div className="flex h-full flex-col gap-3">
      {error && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card px-5 py-3 text-center text-lg font-bold text-candy">
          {error}
        </motion.div>
      )}
      <div className="grid flex-1 grid-cols-2 gap-4 short:gap-3">
        <div className="card flex flex-col items-center justify-center gap-3 p-6 text-center short:gap-2 short:p-4">
          <span className="text-6xl short:text-4xl">✨</span>
          <h2 className="text-3xl font-bold short:text-2xl">Crear sala</h2>
          <p className="text-lg text-ink/60 short:text-base">Te damos un código para que tus amigos entren.</p>
          <CandyButton tone="grape" className="mt-1 h-16 w-full max-w-xs text-2xl short:h-12 short:text-xl" onClick={() => createRoom()}>
            Crear sala
          </CandyButton>
        </div>
        <div className="card flex flex-col items-center justify-center gap-3 p-6 text-center short:gap-2 short:p-4">
          <span className="text-6xl short:text-4xl">🔑</span>
          <h2 className="text-3xl font-bold short:text-2xl">Unirme</h2>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))}
            onKeyDown={(e) => e.key === 'Enter' && clean.length >= 5 && joinRoom(clean)}
            placeholder="PANDA-472"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            className="h-16 w-full max-w-xs rounded-2xl border-4 border-[#e6dcff] bg-[#faf7ff] text-center text-3xl font-bold tracking-widest outline-none placeholder:text-ink/20 focus:border-grape short:h-12 short:text-2xl"
          />
          <CandyButton tone="mint" disabled={clean.length < 5} className="h-16 w-full max-w-xs text-2xl short:h-12 short:text-xl" onClick={() => joinRoom(clean)}>
            Entrar
          </CandyButton>
        </div>
      </div>
      <p className="text-center text-base text-ink/55 short:text-sm">
        🔐 Solo entra quien tenga el código • Sin chat • Necesitas internet 📶
      </p>
    </div>
  );
}

function Connecting() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <motion.span className="text-7xl" animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}>
        🌀
      </motion.span>
      <p className="text-2xl font-bold">Conectando…</p>
    </div>
  );
}

/* ---------------- Sala de espera ---------------- */
function Lobby() {
  const { code, isHost, players, game, bots, status, myId } = useRoom();
  const [copied, setCopied] = useState(false);
  const pretty = formatCode(code);
  const host = players.find((p) => p.host) ?? players[0];

  const share = async () => {
    sfx.tap();
    const url = `${location.origin}${location.pathname}?sala=${code}`;
    const text = `¡Juega conmigo en Bloxi! 🎮 Código de sala: ${pretty}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Bloxi', text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
      }
    } catch {
      /* la cerró */
    }
  };
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="flex h-full gap-4 short:gap-3">
      {/* Código + jugadores */}
      <div className="card flex w-[42%] shrink-0 flex-col p-5 short:p-3">
        <div className="text-center">
          <div className="text-lg font-bold text-ink/60 short:text-sm">Código de la sala</div>
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            className="my-1 text-5xl font-bold tracking-wider text-grape short:text-3xl"
            style={{ WebkitTextStroke: '2px #33264d', paintOrder: 'stroke fill' }}
          >
            {pretty}
          </motion.div>
          {isHost && (
            <CandyButton tone="sky" className="mx-auto h-11 px-5 text-lg short:h-9 short:text-base" onClick={share} silent>
              {copied ? '✓ ¡Copiado!' : '📤 Compartir código'}
            </CandyButton>
          )}
        </div>
        <div className="mt-3 text-lg font-bold short:mt-2 short:text-base">
          Jugadores ({players.length}/8)
        </div>
        <div className="no-scrollbar mt-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {players.map((p) => (
            <PlayerChip key={p.id} p={p} me={p.id === myId} />
          ))}
        </div>
      </div>

      {/* Juego */}
      <div className="card flex min-w-0 flex-1 flex-col p-5 short:p-3">
        {isHost ? (
          <>
            <div className="text-xl font-bold short:text-base">¿A qué jugamos?</div>
            <div className="mt-2 grid grid-cols-3 gap-3 short:gap-2">
              {ROOM_GAMES.map((g) => {
                const info = GAMES.find((x) => x.id === g.id)!;
                const active = game === g.id;
                return (
                  <motion.button
                    key={g.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      sfx.tap();
                      setRoomGame(g.id);
                    }}
                    className={`rounded-[26px] border-4 p-1 transition-colors ${active ? 'border-grape' : 'border-transparent opacity-70'}`}
                  >
                    <div className="mx-auto w-[min(100%,16vh)]">
                      <GameThumb game={info} />
                    </div>
                    <div className="mt-1 text-sm font-bold leading-tight short:text-xs">{active ? '✓ ' : ''}{g.label}</div>
                  </motion.button>
                );
              })}
            </div>
            {BOT_FILL[game] && (
              <div className="mt-3 flex items-center justify-between gap-3 short:mt-2">
                <div>
                  <div className="text-lg font-bold short:text-base">🤖 Rellenar con bots</div>
                  <div className="text-sm text-ink/55">Completa hasta {BOT_FILL[game]} jugadores</div>
                </div>
                <Toggle on={bots} onChange={() => setRoomBots(!bots)} />
              </div>
            )}
            <div className="flex-1" />
            <CandyButton tone="mint" className="mt-3 h-16 w-full text-2xl short:mt-2 short:h-12 short:text-xl" onClick={startRoomGame}>
              ▶ ¡Empezar!
            </CandyButton>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="w-[min(60%,30vh)]">
              <GameThumb game={GAMES.find((x) => x.id === game)!} />
            </div>
            <motion.p className="text-2xl font-bold short:text-xl" animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
              {status === 'playing' ? '⏳ Están jugando… entras en la siguiente' : `⏳ Esperando a que ${host?.name ?? 'el anfitrión'} empiece`}
            </motion.p>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerChip({ p, me }: { p: NetPlayer; me: boolean }) {
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2 short:py-1 ${me ? 'bg-[#f1ebff]' : 'bg-[#f6f2fb]'}`}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white short:h-8 short:w-8"
        style={{ background: `linear-gradient(135deg, ${p.avatar.skin}, #ff7ab6)`, boxShadow: '0 3px 0 rgba(51,38,77,0.15)' }}
      >
        {p.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate text-lg font-bold short:text-base">
        {p.name} {me && <span className="text-ink/45">(tú)</span>}
      </span>
      {p.host && <span className="text-xl">👑</span>}
    </motion.div>
  );
}
