import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './index.css';
import App from './App';
import { mirrorSoon, requestPersistence, restoreIfNeeded } from './lib/backup';
import { useGame } from './store';
import { ThumbScene } from './ThumbScene';

// Evita el zoom con gestos en iPad
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

const thumb = import.meta.env.DEV ? new URLSearchParams(location.search).get('thumb') : null;

async function start() {
  // Si el navegador borró el guardado principal, lo recupera de la copia en IndexedDB
  if (!thumb && (await restoreIfNeeded())) await useGame.persist.rehydrate();
  mirrorSoon();
  requestPersistence();
  window.addEventListener('pointerdown', requestPersistence, { once: true });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>{thumb ? <ThumbScene id={thumb} /> : <App />}</StrictMode>,
  );
}
start();
