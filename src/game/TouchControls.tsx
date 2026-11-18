import { useEffect, useRef } from 'react';
import { input } from '../lib/input';

const R = 62; // radio del joystick

/** Joystick a la izquierda, arrastrar a la derecha para girar la cámara y botón grande de saltar */
export function TouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const jumpBtn = useRef<HTMLDivElement>(null);
  const roles = useRef(new Map<number, { role: 'stick' | 'cam'; ox: number; oy: number; lx: number; ly: number }>());

  const restStick = () => {
    const b = base.current;
    if (!b) return;
    b.style.left = 'calc(max(env(safe-area-inset-left), 24px) + 84px)';
    b.style.top = 'calc(100% - max(env(safe-area-inset-bottom), 24px) - 84px)';
    b.style.opacity = '0.55';
    if (knob.current) knob.current.style.transform = 'translate(-50%, -50%)';
  };

  useEffect(() => {
    restStick();
  }, []);

  const down = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const isLeft = e.clientX < window.innerWidth * 0.45;
    const hasStick = [...roles.current.values()].some((r) => r.role === 'stick');
    if (isLeft && !hasStick) {
      roles.current.set(e.pointerId, { role: 'stick', ox: e.clientX, oy: e.clientY, lx: e.clientX, ly: e.clientY });
      const b = base.current!;
      b.style.left = `${e.clientX}px`;
      b.style.top = `${e.clientY}px`;
      b.style.opacity = '1';
    } else {
      roles.current.set(e.pointerId, { role: 'cam', ox: e.clientX, oy: e.clientY, lx: e.clientX, ly: e.clientY });
    }
  };

  const move = (e: React.PointerEvent) => {
    const r = roles.current.get(e.pointerId);
    if (!r) return;
    if (r.role === 'stick') {
      let dx = e.clientX - r.ox, dy = e.clientY - r.oy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
      input.moveX = dx / R;
      input.moveY = -dy / R;
      if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else {
      input.camDX += e.clientX - r.lx;
      input.camDY += e.clientY - r.ly;
    }
    r.lx = e.clientX;
    r.ly = e.clientY;
  };

  const up = (e: React.PointerEvent) => {
    const r = roles.current.get(e.pointerId);
    roles.current.delete(e.pointerId);
    if (r?.role === 'stick') {
      input.moveX = input.moveY = 0;
      restStick();
    }
  };

  const jump = (e: React.PointerEvent) => {
    e.stopPropagation();
    input.jump = true;
    input.jumpHeld = true;
    jumpBtn.current?.animate([{ transform: 'scale(0.86)' }, { transform: 'scale(1)' }], { duration: 180 });
  };

  return (
    <>
      <div
        className="absolute inset-0 z-10"
        style={{ touchAction: 'none' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      {/* Joystick */}
      <div
        ref={base}
        className="pointer-events-none absolute z-20 h-[124px] w-[124px] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/80 bg-white/25 backdrop-blur-sm"
      >
        <div
          ref={knob}
          className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-white shadow-[0_4px_0_rgba(51,38,77,0.25)]"
          style={{ transform: 'translate(-50%, -50%)' }}
        />
      </div>
      {/* Botón de salto */}
      <div
        ref={jumpBtn}
        onPointerDown={jump}
        onPointerUp={() => (input.jumpHeld = false)}
        className="candy absolute z-20 flex h-28 w-28 flex-col items-center justify-center text-lg max-sm:h-24 max-sm:w-24 short:h-20 short:w-20 short:text-sm"
        style={{
          right: 'calc(max(env(safe-area-inset-right), 20px) + 8px)',
          bottom: 'calc(max(env(safe-area-inset-bottom), 20px) + 8px)',
          background: 'linear-gradient(180deg,#ff7ab6,#ff4f98)',
          ['--shade' as string]: '#d93d82',
          touchAction: 'none',
        }}
      >
        <span className="text-4xl leading-none">⬆</span>
        <span className="text-base">¡Salta!</span>
      </div>
    </>
  );
}
