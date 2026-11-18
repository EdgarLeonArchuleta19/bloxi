import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';

// Actualizaciones de la app instalada (PWA).
// En iPhone/iPad la app casi nunca se "abre de cero", solo se reanuda,
// así que revisamos si hay versión nueva seguido y al regresar a la app.

export const useUpdate = create<{ ready: boolean; applying: boolean }>(() => ({ ready: false, applying: false }));

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

export function setupPWA() {
  if (import.meta.env.DEV) return;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useUpdate.setState({ ready: true });
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // Cada revisión solo baja sw.js (~3 KB), no la app completa.
      // Revisamos al regresar a la app y, si se queda abierta, cada 15 min.
      let last = 0;
      const check = () => {
        const now = Date.now();
        if (document.hidden || now - last < 60_000 || !navigator.onLine) return; // sin internet no pasa nada
        last = now;
        reg.update().catch(() => {});
      };
      setInterval(check, 15 * 60_000);
      document.addEventListener('visibilitychange', () => !document.hidden && check());
      window.addEventListener('focus', check);
      window.addEventListener('online', check);
      window.addEventListener('pageshow', check);
    },
  });
}

/** Instala la versión nueva y recarga la app */
export function applyUpdate() {
  if (useUpdate.getState().applying) return;
  useUpdate.setState({ applying: true });
  updateSW?.(true);
  // por si el navegador no recarga solo
  setTimeout(() => location.reload(), 4000);
}
