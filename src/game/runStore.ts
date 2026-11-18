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

interface RunState {
  status: RunStatus;
  coins: number;
  time: number;
  stars: number;
  checkpoint: number;
  toast: { id: number; text: string } | null;
  result: RunResult | null;
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
  toast: null,
  result: null,
  set: (p) => set(p),
  addCoins: (n) => {
    // las monedas se guardan al instante: si sale del juego no las pierde
    useGame.getState().addCoins(n);
    set((s) => ({ coins: s.coins + n }));
  },
  showToast: (text) => set({ toast: { id: Math.random(), text } }),
  reset: () => set({ status: 'countdown', coins: 0, time: 0, stars: 0, checkpoint: 0, toast: null, result: null }),
}));
