import { useEffect, useState } from 'react';

/** Posición (centro, como fracción de la pantalla) y tamaño (px) del botón de saltar y del joystick */
export interface ControlsLayout {
  jumpSize: number;
  jumpX: number;
  jumpY: number;
  stickSize: number;
  stickX: number;
  stickY: number;
}

export const JUMP_MIN = 72;
export const JUMP_MAX = 190;
export const STICK_MIN = 96;
export const STICK_MAX = 210;

/** Acomodo por defecto según el tamaño de la pantalla */
export function defaultLayout(w: number, h: number): ControlsLayout {
  const vmin = Math.min(w, h);
  const jumpSize = Math.round(Math.min(116, Math.max(82, vmin * 0.2)));
  const stickSize = Math.round(Math.min(132, Math.max(104, vmin * 0.24)));
  return {
    jumpSize,
    jumpX: 1 - (jumpSize / 2 + 30) / w,
    jumpY: 1 - (jumpSize / 2 + 30) / h,
    stickSize,
    stickX: (stickSize / 2 + 36) / w,
    stickY: 1 - (stickSize / 2 + 36) / h,
  };
}

const MARGIN = 10;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Convierte el acomodo a pixeles, sin dejar que nada se salga de la pantalla */
export function placeControls(l: ControlsLayout, w: number, h: number) {
  const jr = l.jumpSize / 2 + MARGIN;
  const sr = l.stickSize / 2 + MARGIN;
  return {
    jump: { x: clamp(l.jumpX * w, jr, w - jr), y: clamp(l.jumpY * h, jr + 60, h - jr), size: l.jumpSize },
    stick: { x: clamp(l.stickX * w, sr, w - sr), y: clamp(l.stickY * h, sr + 60, h - sr), size: l.stickSize },
  };
}

export function useViewportSize() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return size;
}
