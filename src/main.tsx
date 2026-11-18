import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './index.css';
import App from './App';
import { mirrorSoon, requestPersistence, restoreIfNeeded } from './lib/backup';
import { setupNativeFeel } from './lib/native';
import { setupPWA } from './lib/pwa';
import { useGame } from './store';
import { ThumbScene } from './ThumbScene';

// Sin zoom, sin menús de navegador, se acomoda al teclado, pantalla de carga…
setupNativeFeel();

const thumb = import.meta.env.DEV ? new URLSearchParams(location.search).get('thumb') : null;

async function start() {
  // Si el navegador borró el guardado principal, lo recupera de la copia en IndexedDB
  if (!thumb && (await restoreIfNeeded())) await useGame.persist.rehydrate();
  mirrorSoon();
  requestPersistence();
  if (!thumb) setupPWA();
  window.addEventListener('pointerdown', requestPersistence, { once: true });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>{thumb ? <ThumbScene id={thumb} /> : <App />}</StrictMode>,
  );
}
start();
