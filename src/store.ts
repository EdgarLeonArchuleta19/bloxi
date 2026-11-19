import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mirrorSoon, SAVE_KEY } from './lib/backup';
import type { ControlsLayout } from './lib/controlsLayout';
import {
  DEFAULT_AVATAR, HAIR_COLORS, ITEMS, OUTFIT_LOOKS, findItem, itemKey, type AvatarConfig, type Category,
} from './data/items';

export const WELCOME_GIFT = 25;

interface SaveState {
  name: string;
  coins: number;
  owned: string[];
  avatar: AvatarConfig;
  bestObby: number | null; // segundos
  bestStars: number;
  bestColors: number; // rondas
  obbyStage: number; // etapa más lejana alcanzada en el obby
  sound: boolean;
  controls: ControlsLayout | null; // null = acomodo automático
  allowRooms: boolean; // papás pueden apagar las salas con amigos
  cityFriends: { name: string; avatar: AvatarConfig }[]; // amigos bots de la Mini Ciudad
  cityPet: string | null; // mascota adoptada en la ciudad
  recent: string[]; // juegos jugados recientemente
  setName: (n: string) => void;
  addCoins: (n: number) => void;
  owns: (cat: Category, id: string) => boolean;
  buy: (cat: Category, id: string) => boolean;
  equip: (cat: Category, id: string) => void;
  setColor: (key: keyof AvatarConfig, color: string) => void;
  surprise: () => void;
  markPlayed: (id: string) => void;
  setBestObby: (t: number) => boolean;
  setBestStars: (n: number) => boolean;
  setBestColors: (n: number) => boolean;
  setObbyStage: (n: number) => void;
  toggleSound: () => void;
  setControls: (c: ControlsLayout | null) => void;
  setAllowRooms: (v: boolean) => void;
  addCityFriend: (f: { name: string; avatar: AvatarConfig }) => void;
  setCityPet: (p: string | null) => void;
  resetAll: () => void;
}

const initial = {
  name: '',
  coins: 0,
  owned: [] as string[],
  avatar: DEFAULT_AVATAR,
  bestObby: null as number | null,
  bestStars: 0,
  bestColors: 0,
  obbyStage: 0,
  sound: true,
  controls: null as ControlsLayout | null,
  allowRooms: true,
  cityFriends: [] as { name: string; avatar: AvatarConfig }[],
  cityPet: null as string | null,
  recent: [] as string[],
};

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Si el disfraz tapa algo que la niña quiere cambiar, se quita el disfraz para que se vea el cambio */
function clearOutfitIfNeeded(a: AvatarConfig, changed: string): AvatarConfig {
  if (a.outfit === 'none') return a;
  const look = OUTFIT_LOOKS[a.outfit] ?? {};
  const blocks =
    changed === 'top' || changed === 'bottom' || changed === 'shoes' ||
    ((changed === 'hair' || changed === 'hairColor') && look.hideHair) ||
    (changed === 'hat' && look.hideHat) || (changed === 'back' && look.hideBack) || (changed === 'face' && look.hideFace);
  return blocks ? { ...a, outfit: 'none' } : a;
}

export const useGame = create<SaveState>()(
  persist(
    (set, get) => ({
      ...initial,
      setName: (name) => set({ name }),
      addCoins: (n) => set((s) => ({ coins: s.coins + n })),
      owns: (cat, id) => {
        const item = ITEMS.find((i) => i.cat === cat && i.id === id);
        return !item || item.price === 0 || get().owned.includes(itemKey(cat, id));
      },
      buy: (cat, id) => {
        const item = ITEMS.find((i) => i.cat === cat && i.id === id);
        if (!item) return false;
        const s = get();
        if (s.owns(cat, id)) return true;
        if (s.coins < item.price) return false;
        set({ coins: s.coins - item.price, owned: [...s.owned, itemKey(cat, id)] });
        return true;
      },
      equip: (cat, id) => set((s) => ({ avatar: clearOutfitIfNeeded({ ...s.avatar, [cat]: id }, cat) })),
      setColor: (key, color) => set((s) => ({ avatar: clearOutfitIfNeeded({ ...s.avatar, [key]: color }, key) })),
      surprise: () => {
        const s = get();
        const ownedOf = (cat: Category) => ITEMS.filter((i) => i.cat === cat && s.owns(cat, i.id)).map((i) => i.id);
        const outfits = ownedOf('outfit').filter((id) => id !== 'none');
        set({
          avatar: {
            ...s.avatar,
            hairColor: pick(HAIR_COLORS),
            shoes: pick(ownedOf('shoes')),
            outfit: outfits.length && Math.random() < 0.4 ? pick(outfits) : 'none',
            top: pick(ownedOf('top')),
            bottom: pick(ownedOf('bottom')),
            face: pick(ownedOf('face')),
            hair: pick(ownedOf('hair')),
            hat: Math.random() < 0.6 ? pick(ownedOf('hat')) : 'none',
            glasses: Math.random() < 0.4 ? pick(ownedOf('glasses')) : 'none',
            back: Math.random() < 0.5 ? pick(ownedOf('back')) : 'none',
          },
        });
      },
      markPlayed: (id) => set((s) => ({ recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, 10) })),
      setBestObby: (t) => {
        const b = get().bestObby;
        if (b === null || t < b) {
          set({ bestObby: t });
          return true;
        }
        return false;
      },
      setBestStars: (n) => {
        if (n > get().bestStars) {
          set({ bestStars: n });
          return true;
        }
        return false;
      },
      setBestColors: (n) => {
        if (n > get().bestColors) {
          set({ bestColors: n });
          return true;
        }
        return false;
      },
      setObbyStage: (n) => set((s) => ({ obbyStage: Math.max(s.obbyStage, n) })),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      setControls: (controls) => set({ controls }),
      setAllowRooms: (allowRooms) => set({ allowRooms }),
      setCityPet: (cityPet) => set({ cityPet }),
      addCityFriend: (f) => set((s) => ({ cityFriends: [...s.cityFriends.filter((x) => x.name !== f.name), f].slice(-6) })),
      resetAll: () => set({ ...initial }),
    }),
    {
      name: SAVE_KEY,
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SaveState>;
        // partidas viejas: si una prenda ya no existe, poner la de default
        const avatar = { ...DEFAULT_AVATAR, ...(p.avatar ?? {}) } as AvatarConfig;
        const cats: Category[] = ['outfit', 'top', 'bottom', 'shoes', 'face', 'hair', 'hat', 'glasses', 'back'];
        for (const c of cats) if (!findItem(c, avatar[c])) avatar[c] = DEFAULT_AVATAR[c];
        for (const k of ['shirt', 'pants'] as const) delete (avatar as unknown as Record<string, unknown>)[k];
        return { ...current, ...p, avatar };
      },
    },
  ),
);

// Cada cambio se copia también a IndexedDB (respaldo automático)
useGame.subscribe(() => mirrorSoon());
