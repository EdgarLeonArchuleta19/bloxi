// Curvas de animación compartidas para que todo se mueva suave y parejo (estilo iOS)

/** Curva de iOS para pasar de pantalla */
export const EASE_IOS = [0.32, 0.72, 0, 1] as const;
/** Salida suave (arranca rápido y frena despacito) */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Cambio de pantalla (deslizar) */
export const pageTransition = { duration: 0.5, ease: EASE_IOS };
/** Entrar/salir de un juego */
export const fadeTransition = { duration: 0.45, ease: EASE_OUT };
/** Resorte suave para tarjetas y ventanas (sin rebote brusco) */
export const softSpring = { type: 'spring', stiffness: 240, damping: 28, mass: 0.9 } as const;
/** Resorte para "pop" de avisos */
export const popSpring = { type: 'spring', stiffness: 300, damping: 24, mass: 0.8 } as const;
/** Al presionar botones */
export const tapSpring = { type: 'spring', stiffness: 520, damping: 34 } as const;
