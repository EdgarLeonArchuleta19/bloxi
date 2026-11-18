// Detalles para que Bloxi se sienta como app nativa y no como página web.

export function setupNativeFeel() {
  const root = document.documentElement;

  // 1) Teclado: en vez de que el navegador "haga zoom" o empuje la página,
  //    la app se acomoda al espacio visible (como una app nativa).
  const vv = window.visualViewport;
  const syncViewport = () => {
    const h = vv ? vv.height : window.innerHeight;
    root.style.setProperty('--app-h', `${Math.round(h)}px`);
    // iOS desplaza la página al abrir el teclado: la regresamos a su lugar
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
  };
  syncViewport();
  vv?.addEventListener('resize', syncViewport);
  vv?.addEventListener('scroll', syncViewport);
  window.addEventListener('resize', syncViewport);
  window.addEventListener('orientationchange', () => setTimeout(syncViewport, 300));
  document.addEventListener('focusout', () => setTimeout(syncViewport, 50));

  // 2) Sin zoom con pellizco ni doble toque
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1 || (e as TouchEvent & { scale?: number }).scale !== undefined && (e as TouchEvent & { scale?: number }).scale !== 1) {
        e.preventDefault();
      }
    },
    { passive: false },
  );

  // 3) Sin menú de "copiar / guardar imagen" al dejar presionado
  document.addEventListener('contextmenu', (e) => {
    const t = e.target as HTMLElement;
    if (!t.closest('input, textarea')) e.preventDefault();
  });

  // 4) Sin arrastrar imágenes
  document.addEventListener('dragstart', (e) => e.preventDefault());

  // 5) Quitar la pantalla de carga cuando la app ya está lista
  requestAnimationFrame(() =>
    setTimeout(() => {
      const splash = document.getElementById('splash');
      if (!splash) return;
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 450);
    }, 250),
  );
}

/** Vibración cortita al tocar (Android; iPhone/iPad la ignora) */
export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* nada */
  }
}
