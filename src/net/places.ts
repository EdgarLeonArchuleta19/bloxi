import { useEffect, useRef } from 'react';
import { useRun } from '../game/runStore';
import { broadcast, onNetMessage, sendToHost, useRoom } from './room';

// 🏁 Lugares de llegada en sala (Carreritas, Cárcel): el anfitrión los reparte conforme van llegando.

type Mode = 'solo' | 'host' | 'guest';

export function nameInRoom(id: string) {
  const room = useRoom.getState();
  return [...room.players, ...room.botPlayers].find((p) => p.id === id)?.name ?? 'Alguien';
}

export function usePlaces(
  mode: Mode,
  opts: {
    /** me tocó este lugar */
    onMine: (place: number) => void;
    /** alguien (yo, otra persona o un bot) llegó en este lugar */
    onAny?: (id: string, place: number) => void;
    /** aviso cuando llega otro */
    toast: (name: string, place: number) => string;
  },
) {
  const given = useRef(0);
  const done = useRef(new Set<string>());
  const cb = useRef(opts);
  cb.current = opts;

  const onPlaced = (id: string, name: string, place: number) => {
    cb.current.onAny?.(id, place);
    if (id === useRoom.getState().myId) cb.current.onMine(place);
    else useRun.getState().showToast(cb.current.toast(name, place));
  };

  /** Anfitrión: alguien llegó → le toca el siguiente lugar */
  const givePlace = (id: string) => {
    if (done.current.has(id)) return;
    done.current.add(id);
    const place = ++given.current;
    const name = nameInRoom(id);
    broadcast({ t: 'placed', id, name, place });
    onPlaced(id, name, place);
  };

  useEffect(() => {
    if (mode === 'solo') return;
    return onNetMessage((m, from) => {
      if (mode === 'host' && m.t === 'finish') givePlace(from);
      if (mode === 'guest' && m.t === 'placed') onPlaced(m.id, m.name, m.place);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /** Yo llegué a la meta */
  const iFinished = (time = 0) => {
    if (mode === 'host') givePlace(useRoom.getState().myId);
    else if (mode === 'guest') sendToHost({ t: 'finish', time });
  };

  return { iFinished, givePlace };
}
