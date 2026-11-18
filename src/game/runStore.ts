import { create } from 'zustand';
import { useGame } from '../store';

export type RunStatus = 'countdown' | 'playing' | 'paused' | 'done';

export interface RunResult {
  title: string;
  subtitle: string;
  coins: number;
  record: boolean;
  emoji: string;
}

/** Botón de acción según dónde estés (ej. "🍦 Comprar helado", "🚗 Subir") */
export interface RunAction {
  id: string;
  label: string;
  tone?: 'mint' | 'sky' | 'grape' | 'sun' | 'candy' | 'white';
}

interface RunState {
  status: RunStatus;
  coins: number;
  time: number;
  stars: number;
  checkpoint: number;
  lives: number;
  round: number;
  players: number;
  friends: number;
  /** letrero grande: "¡Párate en AZUL!" (name+color) o texto libre */
  banner: { name: string; color: string; text?: string } | null;
  bar: number; // 0..1 tiempo restante de la ronda
  toast: { id: number; text: string } | null;
  result: RunResult | null;
  actions: RunAction[];
  overlay: 'closet' | null;
  set: (p: Partial<RunState>) => void;
  addCoins: (n: number) => void;
  showToast: (text: string) => void;
  reset: () => void;
}

export const useRun = create<RunState>()((set) => ({
  status: 'countdown',
  coins: 0,
  time: 0,
  stars: 0,
  checkpoint: 0,
  lives: 3,
  round: 0,
  players: 8,
  friends: 0,
  banner: null,
  bar: 0,
  toast: null,
  result: null,
  actions: [],
  overlay: null,
  set: (p) => set(p),
  addCoins: (n) => {
    // las monedas se guardan al instante: si sale del juego no las pierde
    useGame.getState().addCoins(n);
    set((s) => ({ coins: s.coins + n }));
  },
  showToast: (text) => set({ toast: { id: Math.random(), text } }),
  reset: () =>
    set({
      status: 'countdown', coins: 0, time: 0, stars: 0, checkpoint: 0, lives: 3, round: 0, players: 8, friends: 0,
      banner: null, bar: 0, toast: null, result: null, actions: [], overlay: null,
    }),
}));

/* ---- Botones de acción: el nivel decide qué hacer al tocarlos ---- */
let actionHandler: ((id: string) => void) | null = null;
export function setActionHandler(fn: ((id: string) => void) | null) {
  actionHandler = fn;
}
export function triggerAction(id: string) {
  actionHandler?.(id);
}
/** Cambia los botones solo si de verdad cambiaron (evita redibujar cada cuadro) */
export function setActions(list: RunAction[]) {
  const cur = useRun.getState().actions;
  const same = cur.length === list.length && cur.every((a, i) => a.id === list[i].id && a.label === list[i].label);
  if (!same) useRun.getState().set({ actions: list });
}

// solo en desarrollo: para pruebas automáticas
if (import.meta.env.DEV) (window as unknown as { __run: typeof useRun }).__run = useRun;
