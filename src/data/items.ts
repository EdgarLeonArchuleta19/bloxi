export type Category = 'outfit' | 'top' | 'bottom' | 'shoes' | 'face' | 'hair' | 'hat' | 'glasses' | 'back';

export type Pattern =
  | 'stripes' | 'legstripes' | 'rainbowstripes' | 'dots' | 'polka' | 'denim' | 'sidestripe' | 'stars' | 'camo' | 'plaid' | 'hearts';

/** Cómo se ve una prenda (cada prenda trae SU color, no se pinta) */
export interface ClothLook {
  shape: string; // tee | tank | long | hoodie · pants | shorts | skirt | tutu · sneaker | light | boot | flat | bunny
  color: string;
  accent?: string;
  pattern?: Pattern;
  decal?: string;
}

export interface Item {
  id: string;
  cat: Category;
  name: string;
  emoji: string;
  price: number;
  sub?: 'pants' | 'shorts' | 'skirt';
  look?: ClothLook;
}

export interface AvatarConfig {
  skin: string;
  hairColor: string;
  outfit: string;
  top: string;
  bottom: string;
  shoes: string;
  face: string;
  hair: string;
  hat: string;
  glasses: string;
  back: string;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: '#f7c9a3',
  hairColor: '#6b3f22',
  outfit: 'none',
  top: 'tee-star',
  bottom: 'jeans',
  shoes: 'sneaker-white',
  face: 'smile',
  hair: 'long',
  hat: 'none',
  glasses: 'none',
  back: 'none',
};

/** Avatar inicial de niño (el de niña es DEFAULT_AVATAR) */
export const BOY_AVATAR: AvatarConfig = {
  ...DEFAULT_AVATAR,
  hairColor: '#2b1d14',
  top: 'tee-smile',
  bottom: 'shorts-jean',
  shoes: 'sneaker-white',
  hair: 'short',
};

const top = (id: string, name: string, emoji: string, price: number, look: ClothLook): Item => ({ id, cat: 'top', name, emoji, price, look });
const bot = (id: string, sub: Item['sub'], name: string, emoji: string, price: number, look: ClothLook): Item => ({
  id, cat: 'bottom', sub, name, emoji, price, look,
});
const shoe = (id: string, name: string, emoji: string, price: number, look: ClothLook): Item => ({ id, cat: 'shoes', name, emoji, price, look });

// Precios bajitos (una partida da ~20-40 monedas) y SIEMPRE al menos uno gratis por tipo
export const ITEMS: Item[] = [
  // Disfraces completos 🎭
  { id: 'none', cat: 'outfit', name: 'Sin disfraz', emoji: '🚫', price: 0 },
  { id: 'banana', cat: 'outfit', name: 'Plátano', emoji: '🍌', price: 0 },
  { id: 'hotdog', cat: 'outfit', name: 'Hot dog', emoji: '🌭', price: 15 },
  { id: 'pizza', cat: 'outfit', name: 'Pizza', emoji: '🍕', price: 15 },
  { id: 'robot', cat: 'outfit', name: 'Robot de caja', emoji: '🤖', price: 15 },
  { id: 'dino', cat: 'outfit', name: 'Dinosaurio', emoji: '🦖', price: 20 },
  { id: 'shark', cat: 'outfit', name: 'Tiburón', emoji: '🦈', price: 20 },
  { id: 'penguin', cat: 'outfit', name: 'Pingüino', emoji: '🐧', price: 20 },
  { id: 'clown', cat: 'outfit', name: 'Payasito', emoji: '🤡', price: 20 },
  { id: 'unicornpj', cat: 'outfit', name: 'Pijama unicornio', emoji: '🦄', price: 25 },
  { id: 'princess', cat: 'outfit', name: 'Princesa', emoji: '👸', price: 25 },
  { id: 'hero', cat: 'outfit', name: 'Superhéroe', emoji: '🦸', price: 25 },
  { id: 'astronaut', cat: 'outfit', name: 'Astronauta', emoji: '👩‍🚀', price: 30 },

  // Playeras 👕
  top('tee-star', 'Estrella rosa', '⭐', 0, { shape: 'tee', color: '#ff5fa2', decal: 'star' }),
  top('tee-white', 'Blanca', '👕', 0, { shape: 'tee', color: '#ffffff' }),
  top('tee-heart', 'Corazón lila', '💖', 5, { shape: 'tee', color: '#b07cff', decal: 'heart' }),
  top('tee-smile', 'Carita feliz', '😃', 5, { shape: 'tee', color: '#3cb7f5', decal: 'smile' }),
  top('tank-mint', 'Tirantes menta', '🎽', 5, { shape: 'tank', color: '#2fd39a' }),
  top('tee-bolt', 'Rayo', '⚡', 5, { shape: 'tee', color: '#33264d', decal: 'bolt' }),
  top('tee-sailor', 'Marinera', '⚓', 8, { shape: 'tee', color: '#ffffff', pattern: 'stripes', accent: '#2d4a8a' }),
  top('tee-dots', 'Confeti', '🎉', 8, { shape: 'tee', color: '#ffcf33', pattern: 'dots' }),
  top('tee-rainbow', 'Arcoíris', '🌈', 8, { shape: 'tee', color: '#ffffff', decal: 'rainbow' }),
  top('tee-dino', 'Dino', '🦕', 8, { shape: 'tee', color: '#ffe8a3', decal: 'dinoprint' }),
  top('tee-cat', 'Gatito', '🐱', 8, { shape: 'tee', color: '#ff9ecb', decal: 'catface' }),
  top('tee-soccer', 'Fútbol 10', '⚽', 10, { shape: 'tee', color: '#ff4d4d', decal: 'ten' }),
  top('long-tie', 'Camisa elegante', '👔', 10, { shape: 'long', color: '#ffffff', decal: 'tie' }),
  top('long-rainbow', 'Rayas arcoíris', '🍭', 12, { shape: 'long', color: '#ffffff', pattern: 'rainbowstripes' }),
  top('hoodie-pink', 'Sudadera rosa', '🧥', 10, { shape: 'hoodie', color: '#ff7ab6' }),
  top('hoodie-gray', 'Sudadera gris', '🧥', 10, { shape: 'hoodie', color: '#9aa5b1' }),
  top('hoodie-space', 'Sudadera galaxia', '🌌', 15, { shape: 'hoodie', color: '#3b2a7a', pattern: 'stars', accent: '#ffd23f' }),

  // Pantalones 👖
  bot('jeans', 'pants', 'Jeans', '👖', 0, { shape: 'pants', color: '#4a6fb5', pattern: 'denim' }),
  bot('pants-pink', 'pants', 'Pantalón rosa', '👖', 5, { shape: 'pants', color: '#ff9ecb' }),
  bot('pants-sport', 'pants', 'Deportivo', '🏃', 5, { shape: 'pants', color: '#2b2b3a', pattern: 'sidestripe', accent: '#ffffff' }),
  bot('pants-stripes', 'pants', 'Rayitas', '🍬', 8, { shape: 'pants', color: '#7c6cf0', pattern: 'legstripes', accent: '#ffffff' }),
  bot('pants-stars', 'pants', 'Estrellitas', '✨', 10, { shape: 'pants', color: '#33264d', pattern: 'stars', accent: '#ffd23f' }),
  bot('pants-camo', 'pants', 'Camuflaje', '🌿', 10, { shape: 'pants', color: '#6b8e4e', pattern: 'camo' }),

  // Shorts 🩳
  bot('shorts-jean', 'shorts', 'Short de mezclilla', '🩳', 0, { shape: 'shorts', color: '#5a82c9', pattern: 'denim' }),
  bot('shorts-pink', 'shorts', 'Short rosa', '🩳', 5, { shape: 'shorts', color: '#ff7ab6' }),
  bot('shorts-sport', 'shorts', 'Short deportivo', '🏀', 5, { shape: 'shorts', color: '#ff4d4d', pattern: 'sidestripe', accent: '#ffffff' }),
  bot('shorts-flowers', 'shorts', 'Short de bolitas', '🌼', 8, { shape: 'shorts', color: '#2fd39a', pattern: 'polka', accent: '#ffffff' }),
  bot('shorts-beach', 'shorts', 'Short de playa', '🏖️', 8, { shape: 'shorts', color: '#3cb7f5', pattern: 'legstripes', accent: '#ffffff' }),
  bot('shorts-hearts', 'shorts', 'Short corazones', '💕', 10, { shape: 'shorts', color: '#ffffff', pattern: 'hearts', accent: '#ff5fa2' }),

  // Faldas 👗
  bot('skirt-purple', 'skirt', 'Falda morada', '👗', 0, { shape: 'skirt', color: '#7c6cf0' }),
  bot('skirt-jean', 'skirt', 'Falda de mezclilla', '👗', 5, { shape: 'skirt', color: '#5a82c9', pattern: 'denim' }),
  bot('skirt-plaid', 'skirt', 'Falda de cuadros', '🟥', 8, { shape: 'skirt', color: '#e0413a', pattern: 'plaid' }),
  bot('skirt-dots', 'skirt', 'Falda de lunares', '⚫', 8, { shape: 'skirt', color: '#33264d', pattern: 'polka', accent: '#ffffff' }),
  bot('tutu-pink', 'skirt', 'Tutú rosa', '🩰', 10, { shape: 'tutu', color: '#ff9ecb', accent: '#ffd6ec' }),
  bot('tutu-lila', 'skirt', 'Tutú mágico', '🦋', 12, { shape: 'tutu', color: '#b07cff', accent: '#a8e6ff' }),

  // Tenis 👟
  shoe('sneaker-white', 'Tenis blancos', '👟', 0, { shape: 'sneaker', color: '#ffffff', accent: '#e6e1f0' }),
  shoe('sneaker-pink', 'Tenis rosas', '👟', 5, { shape: 'sneaker', color: '#ff7ab6', accent: '#ffffff' }),
  shoe('flat-black', 'Zapatos elegantes', '👞', 5, { shape: 'flat', color: '#2b2240', accent: '#2b2240' }),
  shoe('boot-brown', 'Botas vaqueras', '🤠', 8, { shape: 'boot', color: '#8a5a3c', accent: '#5a3a24' }),
  shoe('boot-rain', 'Botas de lluvia', '🌧️', 8, { shape: 'boot', color: '#ffcf33', accent: '#d99b00' }),
  shoe('sneaker-light', 'Tenis con luces', '💡', 15, { shape: 'light', color: '#ffffff', accent: '#ff3dd2' }),
  shoe('bunny', 'Pantuflas conejo', '🐰', 12, { shape: 'bunny', color: '#ffffff', accent: '#ffa8c8' }),

  // Caras 😊
  { id: 'smile', cat: 'face', name: 'Sonrisa', emoji: '🙂', price: 0 },
  { id: 'happy', cat: 'face', name: 'Feliz', emoji: '😄', price: 0 },
  { id: 'wink', cat: 'face', name: 'Guiño', emoji: '😉', price: 5 },
  { id: 'surprise', cat: 'face', name: 'Sorpresa', emoji: '😮', price: 5 },
  { id: 'silly', cat: 'face', name: 'Lengüita', emoji: '😜', price: 5 },
  { id: 'cat', cat: 'face', name: 'Gatito', emoji: '😺', price: 8 },
  { id: 'cool', cat: 'face', name: 'Cool', emoji: '😎', price: 8 },
  { id: 'hearts', cat: 'face', name: 'Enamorada', emoji: '😍', price: 10 },
  { id: 'stars', cat: 'face', name: 'Estrellitas', emoji: '🤩', price: 10 },

  // Pelo 💇
  { id: 'none', cat: 'hair', name: 'Sin pelo', emoji: '🥚', price: 0 },
  { id: 'short', cat: 'hair', name: 'Corto', emoji: '💇', price: 0 },
  { id: 'long', cat: 'hair', name: 'Largo', emoji: '💁', price: 0 },
  { id: 'pigtails', cat: 'hair', name: 'Coletas', emoji: '🎀', price: 5 },
  { id: 'bun', cat: 'hair', name: 'Chongo', emoji: '🍡', price: 5 },
  { id: 'spiky', cat: 'hair', name: 'Picudo', emoji: '⚡', price: 5 },
  { id: 'curly', cat: 'hair', name: 'Rizos', emoji: '🌀', price: 8 },
  { id: 'ponytail', cat: 'hair', name: 'Cola de caballo', emoji: '🐴', price: 0 },
  { id: 'braids', cat: 'hair', name: 'Dos trenzas', emoji: '🥨', price: 0 },
  { id: 'spacebuns', cat: 'hair', name: 'Chonguitos', emoji: '🐼', price: 0 },
  { id: 'bangs', cat: 'hair', name: 'Largo con fleco', emoji: '💇‍♀️', price: 5 },
  { id: 'sidepony', cat: 'hair', name: 'Coleta de lado', emoji: '🎀', price: 5 },
  { id: 'bob', cat: 'hair', name: 'Melenita', emoji: '👧', price: 5 },
  { id: 'puffs', cat: 'hair', name: 'Puffs', emoji: '☁️', price: 5 },
  { id: 'wavy', cat: 'hair', name: 'Ondulado', emoji: '🌊', price: 8 },
  { id: 'halfup', cat: 'hair', name: 'Media cola con moño', emoji: '🎀', price: 8 },
  { id: 'longbraid', cat: 'hair', name: 'Trenza larga', emoji: '🪢', price: 8 },
  { id: 'curlylong', cat: 'hair', name: 'Rizos largos', emoji: '🌀', price: 10 },
  { id: 'crownbraid', cat: 'hair', name: 'Corona trenzada', emoji: '👑', price: 10 },
  { id: 'mermaid', cat: 'hair', name: 'Sirena (súper largo)', emoji: '🧜‍♀️', price: 12 },

  // Gorros 👑
  { id: 'none', cat: 'hat', name: 'Nada', emoji: '🚫', price: 0 },
  { id: 'bow', cat: 'hat', name: 'Moño', emoji: '🎀', price: 0 },
  { id: 'cap', cat: 'hat', name: 'Gorra', emoji: '🧢', price: 5 },
  { id: 'party', cat: 'hat', name: 'Fiesta', emoji: '🥳', price: 5 },
  { id: 'catEars', cat: 'hat', name: 'Orejas gato', emoji: '🐱', price: 8 },
  { id: 'bunny', cat: 'hat', name: 'Orejas conejo', emoji: '🐰', price: 8 },
  { id: 'flowers', cat: 'hat', name: 'Corona flores', emoji: '🌸', price: 10 },
  { id: 'tophat', cat: 'hat', name: 'Sombrero', emoji: '🎩', price: 10 },
  { id: 'halo', cat: 'hat', name: 'Aureola', emoji: '😇', price: 12 },
  { id: 'crown', cat: 'hat', name: 'Corona', emoji: '👑', price: 15 },
  { id: 'unicorn', cat: 'hat', name: 'Cuerno unicornio', emoji: '🦄', price: 15 },

  // Lentes 🕶️
  { id: 'none', cat: 'glasses', name: 'Nada', emoji: '🚫', price: 0 },
  { id: 'round', cat: 'glasses', name: 'Redondos', emoji: '👓', price: 0 },
  { id: 'sun', cat: 'glasses', name: 'De sol', emoji: '🕶️', price: 5 },
  { id: 'heart', cat: 'glasses', name: 'Corazón', emoji: '💖', price: 8 },
  { id: 'star', cat: 'glasses', name: 'Estrella', emoji: '⭐', price: 8 },

  // Espalda 🪽
  { id: 'none', cat: 'back', name: 'Nada', emoji: '🚫', price: 0 },
  { id: 'backpack', cat: 'back', name: 'Mochila', emoji: '🎒', price: 0 },
  { id: 'cape', cat: 'back', name: 'Capa', emoji: '🦸', price: 10 },
  { id: 'angel', cat: 'back', name: 'Alas ángel', emoji: '🪽', price: 15 },
  { id: 'butterfly', cat: 'back', name: 'Alas mariposa', emoji: '🦋', price: 15 },
  { id: 'jetpack', cat: 'back', name: 'Jetpack', emoji: '🚀', price: 20 },
  { id: 'dragon', cat: 'back', name: 'Alas dragón', emoji: '🐉', price: 20 },
];

export const itemKey = (cat: Category, id: string) => `${cat}:${id}`;
export const findItem = (cat: Category, id: string) => ITEMS.find((i) => i.cat === cat && i.id === id);

export interface EditorTab {
  id: string;
  label: string;
  emoji: string;
  cat: Category | 'skin';
  sub?: Item['sub'];
}

/** Grupos del armario */
export const GROUPS: { id: string; label: string; emoji: string; tabs: EditorTab[] }[] = [
  { id: 'outfits', label: 'Disfraces', emoji: '🎭', tabs: [{ id: 'outfit', label: 'Disfraces', emoji: '🎭', cat: 'outfit' }] },
  {
    id: 'clothes',
    label: 'Ropa',
    emoji: '👕',
    tabs: [
      { id: 'top', label: 'Playeras', emoji: '👕', cat: 'top' },
      { id: 'pants', label: 'Pantalones', emoji: '👖', cat: 'bottom', sub: 'pants' },
      { id: 'shorts', label: 'Shorts', emoji: '🩳', cat: 'bottom', sub: 'shorts' },
      { id: 'skirt', label: 'Faldas', emoji: '👗', cat: 'bottom', sub: 'skirt' },
      { id: 'shoes', label: 'Tenis', emoji: '👟', cat: 'shoes' },
    ],
  },
  {
    id: 'head',
    label: 'Cabeza',
    emoji: '🙂',
    tabs: [
      { id: 'face', label: 'Caras', emoji: '😊', cat: 'face' },
      { id: 'hair', label: 'Pelo', emoji: '💇', cat: 'hair' },
      { id: 'skin', label: 'Piel', emoji: '🎨', cat: 'skin' },
    ],
  },
  {
    id: 'acc',
    label: 'Accesorios',
    emoji: '👑',
    tabs: [
      { id: 'hat', label: 'Gorros', emoji: '👑', cat: 'hat' },
      { id: 'glasses', label: 'Lentes', emoji: '🕶️', cat: 'glasses' },
      { id: 'back', label: 'Espalda', emoji: '🪽', cat: 'back' },
    ],
  },
];

export const SKIN_COLORS = ['#ffe3cc', '#f7c9a3', '#e8b088', '#c98e62', '#a0663f', '#6e4429', '#ffd84a', '#a8e6ff', '#c9b6ff', '#9ff0b8'];
export const HAIR_COLORS = [
  '#2b1d14', '#6b3f22', '#8a1c2b', '#b8743a', '#f2c94c', '#fff1a8', '#ff8c42', '#ff6fae',
  '#ffb3d9', '#d9b8ff', '#b07cff', '#3cb7f5', '#a8e6ff', '#2fd39a', '#ffffff', '#9aa5b1',
];

/** Cómo cambia el cuerpo cada disfraz */
export interface OutfitLook {
  shirt?: string;
  pants?: string;
  shoes?: string;
  top?: string;
  bottom?: string;
  fullSleeves?: boolean;
  hideHair?: boolean;
  hideHat?: boolean;
  hideBack?: boolean;
  hideFace?: boolean;
}

export const OUTFIT_LOOKS: Record<string, OutfitLook> = {
  banana: { shirt: '#ffe14d', pants: '#ffe14d', shoes: '#8a5a3c', fullSleeves: true, hideHair: true, hideHat: true },
  hotdog: { shirt: '#d9573f', pants: '#d9573f', shoes: '#d9573f', fullSleeves: true, hideHair: true, hideHat: true },
  pizza: { shirt: '#ffcf6b', pants: '#ff4d4d', shoes: '#ffffff', top: 'basic', bottom: 'pants' },
  robot: { shirt: '#c9935a', pants: '#9aa5b1', shoes: '#6b7280', fullSleeves: true, hideHair: true, hideHat: true, hideFace: true, hideBack: true },
  dino: { shirt: '#5fd36a', pants: '#5fd36a', shoes: '#3fae4b', fullSleeves: true, hideHair: true, hideHat: true },
  shark: { shirt: '#7fa7c9', pants: '#7fa7c9', shoes: '#5b84a8', fullSleeves: true, hideHair: true, hideHat: true },
  penguin: { shirt: '#2b2b3a', pants: '#2b2b3a', shoes: '#ff9a3c', fullSleeves: true, hideHair: true, hideHat: true },
  clown: { shirt: '#ffcf33', pants: '#3cb7f5', shoes: '#ff3d5a', top: 'dots', bottom: 'pants', hideHair: true, hideHat: true },
  unicornpj: { shirt: '#f9dcf0', pants: '#f9dcf0', shoes: '#ffb3d9', fullSleeves: true, hideHair: true, hideHat: true },
  princess: { shirt: '#ff9ecb', pants: '#ff9ecb', shoes: '#ffcf33', top: 'basic', bottom: 'gown', hideHat: true },
  hero: { shirt: '#3c6cf5', pants: '#3c6cf5', shoes: '#ff3d5a', top: 'basic', bottom: 'pants', fullSleeves: true, hideBack: true },
  astronaut: { shirt: '#f2f4f8', pants: '#f2f4f8', shoes: '#9aa5b1', fullSleeves: true, hideHat: true, hideBack: true },
};
