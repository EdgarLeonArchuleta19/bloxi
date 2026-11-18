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
    desc: 'Brinca de plataforma en plataforma, usa los trampolines y llega a la meta del arcoíris.',
    emoji: '☁️',
    thumb: 'thumbs/obby.jpg',
    gradient: 'linear-gradient(135deg,#6fd0ff 0%,#9b7bff 100%)',
    shade: '#6a4fd6',
    category: 'Aventura',
    tags: ['obby', 'saltos', 'parkour', 'nubes', 'aventura'],
    difficulty: 'Fácil',
    duration: '3 min',
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
