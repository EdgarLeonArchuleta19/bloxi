import type { GameId } from '../game/GameScreen';

export interface GameInfo {
  id: GameId;
  title: string;
  desc: string;
  emoji: string;
  thumb: string; // captura del juego (npm run thumbs)
  gradient: string;
  shade: string;
  category: string;
  tags: string[];
  difficulty: 'Fácil' | 'Medio' | 'Difícil';
  duration: string;
}

// 👉 Para agregar un juego nuevo: añádelo aquí y crea su nivel en src/game/levels
export const GAMES: GameInfo[] = [
  {
    id: 'obby',
    title: 'Obby en las Nubes',
    desc: '8 etapas en el cielo: trampolines, plataformas que desaparecen, lava 🔥, elevadores y la meta del arcoíris. ¡Se guarda tu avance!',
    emoji: '☁️',
    thumb: 'thumbs/obby.jpg',
    gradient: 'linear-gradient(135deg,#6fd0ff 0%,#9b7bff 100%)',
    shade: '#6a4fd6',
    category: 'Aventura',
    tags: ['obby', 'saltos', 'parkour', 'nubes', 'aventura'],
    difficulty: 'Medio',
    duration: '6 min',
  },
  {
    id: 'stars',
    title: 'Atrapa Estrellas',
    desc: 'Corre por la isla y junta todas las estrellas que puedas antes de que se acabe el tiempo.',
    emoji: '⭐',
    thumb: 'thumbs/stars.jpg',
    gradient: 'linear-gradient(135deg,#ffd84a 0%,#ff6fae 100%)',
    shade: '#d9488a',
    category: 'Rápidos',
    tags: ['estrellas', 'isla', 'tiempo', 'correr', 'rapido'],
    difficulty: 'Fácil',
    duration: '1 min',
  },
  {
    id: 'colors',
    title: 'Piso de Colores',
    desc: '¡Juega contra 7 jugadores más! Sale un color y tienes que pararte en él antes de que los demás cuadros se caigan al agua. Gana quien quede al final.',
    emoji: '🎨',
    thumb: 'thumbs/colors.jpg',
    gradient: 'linear-gradient(135deg,#7ae0b8 0%,#ff7ab6 100%)',
    shade: '#d9488a',
    category: 'Fiesta',
    tags: ['colores', 'piso', 'fiesta', 'rapido', 'baile', 'color block'],
    difficulty: 'Fácil',
    duration: '2 min',
  },
];

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function searchGames(query: string, category: string) {
  const q = normalize(query);
  return GAMES.filter((g) => {
    if (category !== 'Todos' && g.category !== category) return false;
    if (!q) return true;
    return [g.title, g.category, ...g.tags].some((t) => normalize(t).includes(q));
  });
}

export const GAME_CATEGORIES = ['Todos', ...Array.from(new Set(GAMES.map((g) => g.category)))];
