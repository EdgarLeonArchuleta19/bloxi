import { create } from 'zustand';
import type { DataConnection, Peer as PeerT } from 'peerjs';
import type { AvatarConfig } from '../data/items';
import { randomAvatar } from '../game/levels/colorBots';
import { useGame } from '../store';
import { clearRemotes, updateRemote, type PosEntry } from './remote';

// 👫 Salas privadas con código.
// - El anfitrión (host) crea la sala; su código es su ID en PeerJS.
// - Los demás se conectan DIRECTO al anfitrión (WebRTC). No hay chat ni salas públicas.
// - El anfitrión manda en el juego (rondas, colores, lugares) y reenvía las posiciones.

export type NetGame = 'colors' | 'obby' | 'stars';
export interface NetPlayer {
  id: string;
  name: string;
  avatar: AvatarConfig;
  host?: boolean;
  bot?: boolean;
}

export type Msg =
  | { t: 'hello'; name: string; avatar: AvatarConfig }
  | { t: 'full' }
  | { t: 'lobby'; players: NetPlayer[]; game: NetGame; bots: boolean }
  | { t: 'start'; game: NetGame; bots: NetPlayer[]; run: number }
  | { t: 'lobbyBack' }
  | { t: 'pos'; e: PosEntry }
  | { t: 'state'; s: PosEntry[] }
  | { t: 'round'; round: number; target: number; colors: number[]; dur: number }
  | { t: 'drop' }
  | { t: 'restore' }
  | { t: 'out'; id: string }
  | { t: 'alive'; n: number }
  | { t: 'end'; ranking: { id: string; name: string; place: number }[] }
  | { t: 'finish'; time: number }
  | { t: 'placed'; id: string; name: string; place: number }
  | { t: 'stars'; s: [number, number, number, number, number][] }
  | { t: 'grab'; i: number }
  | { t: 'score'; id: string; i: number; v: number; total: number };

const PREFIX = 'bloxi-sala-';
const MAX_PLAYERS = 8;
const WORDS = ['PANDA', 'GATO', 'LUNA', 'NUBE', 'DINO', 'FRESA', 'KOALA', 'PIZZA', 'ROBOT', 'HADA', 'PATO', 'MANGO', 'COCO', 'MIEL', 'SAPO', 'TACO'];

interface RoomState {
  status: 'idle' | 'connecting' | 'lobby' | 'playing' | 'error';
  code: string;
  isHost: boolean;
  myId: string;
  players: NetPlayer[];
  botPlayers: NetPlayer[];
  game: NetGame;
  bots: boolean;
  run: number; // cambia cada vez que empieza una partida
  inGame: boolean; // esta pantalla está dentro del juego
  error: string | null;
}

export const useRoom = create<RoomState>()(() => ({
  status: 'idle',
  code: '',
  isHost: false,
  myId: '',
  players: [],
  botPlayers: [],
  game: 'colors',
  bots: true,
  run: 0,
  inGame: false,
  error: null,
}));

let peer: PeerT | null = null;
let hostConn: DataConnection | null = null;
const conns = new Map<string, DataConnection>();
const listeners = new Set<(m: Msg, from: string) => void>();

/** Escuchar mensajes del juego (rondas, caídas, lugares…) */
export function onNetMessage(fn: (m: Msg, from: string) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const emit = (m: Msg, from: string) => listeners.forEach((fn) => fn(m, from));

export const formatCode = (c: string) => (c.length > 3 ? `${c.slice(0, -3)}-${c.slice(-3)}` : c);
const cleanCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
const newCode = () => WORDS[Math.floor(Math.random() * WORDS.length)] + String(100 + Math.floor(Math.random() * 900));

function me(host: boolean): NetPlayer {
  const g = useGame.getState();
  return { id: useRoom.getState().myId, name: g.name || 'Bloxi', avatar: g.avatar, host };
}

async function makePeer(id?: string): Promise<PeerT> {
  const { Peer } = await import('peerjs');
  return id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
}

const friendlyError = (type: string) =>
  type === 'peer-unavailable'
    ? 'No encontramos esa sala 🥲 Revisa el código.'
    : type === 'network' || type === 'server-error' || type === 'socket-error'
      ? 'No hay internet 📶 Para jugar con amigos necesitas conexión.'
      : 'Algo salió mal 😅 Intenta otra vez.';

/* ------------------------- Anfitrión ------------------------- */

export async function createRoom(attempt = 0): Promise<void> {
  leaveRoom(false);
  const code = newCode();
  useRoom.setState({ status: 'connecting', error: null, code, isHost: true, myId: PREFIX + code, players: [], botPlayers: [] });
  try {
    const p = await makePeer(PREFIX + code);
    peer = p;
    p.on('open', () => {
      useRoom.setState({ status: 'lobby', players: [me(true)] });
    });
    p.on('connection', (conn) => {
      conn.on('open', () => {
        const st = useRoom.getState();
        if (st.players.length >= MAX_PLAYERS || st.status === 'playing') {
          conn.send({ t: 'full' } satisfies Msg);
          setTimeout(() => conn.close(), 300);
          return;
        }
        conns.set(conn.peer, conn);
      });
      conn.on('data', (raw) => hostReceive(raw as Msg, conn.peer));
      conn.on('close', () => {
        conns.delete(conn.peer);
        useRoom.setState((s) => ({ players: s.players.filter((x) => x.id !== conn.peer) }));
        emit({ t: 'out', id: conn.peer }, conn.peer);
        broadcastLobby();
      });
    });
    p.on('error', (err: { type: string }) => {
      if (err.type === 'unavailable-id' && attempt < 4) {
        createRoom(attempt + 1); // ese código ya existe: otro
        return;
      }
      useRoom.setState({ status: 'error', error: friendlyError(err.type) });
    });
    p.on('disconnected', () => p.reconnect());
  } catch {
    useRoom.setState({ status: 'error', error: friendlyError('network') });
  }
}

function hostReceive(m: Msg, from: string) {
  if (m.t === 'hello') {
    useRoom.setState((s) => ({
      players: [...s.players.filter((x) => x.id !== from), { id: from, name: String(m.name).slice(0, 14), avatar: m.avatar }],
    }));
    broadcastLobby();
    return;
  }
  if (m.t === 'pos') {
    updateRemote(m.e);
    return;
  }
  emit(m, from);
}

export function broadcast(m: Msg) {
  conns.forEach((c) => c.open && c.send(m));
}
export function sendTo(id: string, m: Msg) {
  const c = conns.get(id);
  if (c?.open) c.send(m);
}

function broadcastLobby() {
  const s = useRoom.getState();
  if (!s.isHost) return;
  broadcast({ t: 'lobby', players: s.players, game: s.game, bots: s.bots });
}

export function setRoomGame(game: NetGame) {
  useRoom.setState({ game });
  broadcastLobby();
}
export function setRoomBots(bots: boolean) {
  useRoom.setState({ bots });
  broadcastLobby();
}

const BOT_NAMES = ['LunaStar', 'MateoPro', 'ValeRainbow', 'LeoDino', 'MiaCookie', 'NicoBlox', 'EmmaPanda', 'TomiRocket'];

export function startRoomGame() {
  const s = useRoom.getState();
  if (!s.isHost) return;
  const humans = s.players.length;
  // 🤖 rellenar con bots: Colores hasta 8 jugadores, Estrellas hasta 5
  const fillTo = s.game === 'colors' ? 8 : s.game === 'stars' ? 5 : 0;
  const botPlayers: NetPlayer[] =
    s.bots && fillTo
      ? Array.from({ length: Math.max(0, fillTo - humans) }, (_, i) => ({
          id: `bot${i}`,
          name: BOT_NAMES[i % BOT_NAMES.length],
          avatar: randomAvatar(),
          bot: true,
        }))
      : [];
  const run = s.run + 1;
  clearRemotes();
  useRoom.setState({ status: 'playing', botPlayers, run, inGame: true });
  broadcast({ t: 'start', game: s.game, bots: botPlayers, run });
}

export function backToLobby() {
  const s = useRoom.getState();
  if (s.isHost) {
    useRoom.setState({ status: 'lobby', inGame: false });
    broadcast({ t: 'lobbyBack' });
    broadcastLobby();
  } else {
    useRoom.setState({ inGame: false });
  }
}

/* ------------------------- Invitado ------------------------- */

export async function joinRoom(rawCode: string) {
  leaveRoom(false);
  const code = cleanCode(rawCode);
  useRoom.setState({ status: 'connecting', error: null, code, isHost: false, players: [], botPlayers: [] });
  try {
    const p = await makePeer();
    peer = p;
    p.on('open', (id) => {
      useRoom.setState({ myId: id });
      const conn = p.connect(PREFIX + code, { reliable: true });
      hostConn = conn;
      conn.on('open', () => {
        const g = useGame.getState();
        conn.send({ t: 'hello', name: g.name || 'Bloxi', avatar: g.avatar } satisfies Msg);
      });
      conn.on('data', (raw) => guestReceive(raw as Msg));
      conn.on('close', () => {
        if (useRoom.getState().status !== 'idle') {
          useRoom.setState({ status: 'error', inGame: false, error: 'La sala se cerró 👋' });
          cleanup();
        }
      });
    });
    p.on('error', (err: { type: string }) => useRoom.setState({ status: 'error', inGame: false, error: friendlyError(err.type) }));
  } catch {
    useRoom.setState({ status: 'error', error: friendlyError('network') });
  }
}

function guestReceive(m: Msg) {
  switch (m.t) {
    case 'full':
      useRoom.setState({ status: 'error', error: 'La sala está llena o ya están jugando 🙈' });
      cleanup();
      return;
    case 'lobby':
      useRoom.setState((s) => ({ status: s.status === 'playing' ? 'playing' : 'lobby', players: m.players, game: m.game, bots: m.bots }));
      return;
    case 'start':
      clearRemotes();
      useRoom.setState({ status: 'playing', game: m.game, botPlayers: m.bots, run: m.run, inGame: true });
      return;
    case 'lobbyBack':
      useRoom.setState({ status: 'lobby', inGame: false });
      return;
    case 'state':
      m.s.forEach(updateRemote);
      return;
  }
  emit(m, 'host');
}

/** Invitado → anfitrión */
export function sendToHost(m: Msg) {
  if (hostConn?.open) hostConn.send(m);
}

/* ------------------------- Salir ------------------------- */

function cleanup() {
  conns.forEach((c) => c.close());
  conns.clear();
  hostConn?.close();
  hostConn = null;
  peer?.destroy();
  peer = null;
  clearRemotes();
}

export function leaveRoom(reset = true) {
  cleanup();
  if (reset) useRoom.setState({ status: 'idle', code: '', players: [], botPlayers: [], inGame: false, error: null, isHost: false });
}

/** ¿Estamos jugando en sala ahora mismo? */
export function netMode(): 'solo' | 'host' | 'guest' {
  const s = useRoom.getState();
  if (s.status !== 'playing' || !s.inGame) return 'solo';
  return s.isHost ? 'host' : 'guest';
}
