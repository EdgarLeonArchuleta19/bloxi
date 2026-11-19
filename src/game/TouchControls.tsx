import { forwardRef, useEffect, useRef } from 'react';
import { defaultLayout, placeControls, useViewportSize } from '../lib/controlsLayout';
import { input } from '../lib/input';
import { haptic } from '../lib/native';
import { useGame } from '../store';

/** Dibujo del botón de saltar (se usa en el juego y en el editor de botones) */
export const JumpButtonView = forwardRef<HTMLDivElement, { size: number } & React.HTMLAttributes<HTMLDivElement>>(
  function JumpButtonView({ size, style, className = '', ...rest }, ref) {
    return (
      <div
        ref={ref}
        {...rest}
        className={`absolute ${className}`}
        style={{ width: size, height: size, touchAction: 'none', ['--s' as string]: `${size}px`, ...style }}
      >
        <div className="jump-btn">
          <svg width={size * 0.42} height={size * 0.36} viewBox="0 0 40 34" style={{ marginTop: -size * 0.04 }}>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 17 L20 6 L32 17" stroke="#8a1f52" strokeWidth="9" />
              <path d="M8 29 L20 18 L32 29" stroke="#8a1f52" strokeWidth="9" />
              <path d="M8 17 L20 6 L32 17" stroke="#ffffff" strokeWidth="5" />
              <path d="M8 29 L20 18 L32 29" stroke="#ffffff" strokeWidth="5" opacity="0.85" />
            </g>
          </svg>
          <span className="jump-label" style={{ fontSize: Math.max(11, size * 0.15), marginTop: size * 0.02 }}>
            SALTAR
          </span>
        </div>
      </div>
    );
  },
);

/** Pedal para acelerar (carreritas) */
export const PedalButtonView = forwardRef<HTMLDivElement, { size: number } & React.HTMLAttributes<HTMLDivElement>>(
  function PedalButtonView({ size, style, className = '', ...rest }, ref) {
    return (
      <div
        ref={ref}
        {...rest}
        className={`absolute ${className}`}
        style={{ width: size, height: size, touchAction: 'none', ['--s' as string]: `${size}px`, ...style }}
      >
        <div className="jump-btn pedal-btn">
          <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 40 40" style={{ marginTop: -size * 0.03 }}>
            <rect x="9" y="3" width="22" height="30" rx="6" fill="#ffffff" stroke="#0f6b4a" strokeWidth="3" />
            {[10, 16, 22].map((y) => (
              <rect key={y} x="13" y={y} width="14" height="3" rx="1.5" fill="#2fd39a" />
            ))}
            <rect x="17" y="33" width="6" height="5" rx="2" fill="#0f6b4a" />
          </svg>
          <span className="jump-label pedal-label" style={{ fontSize: Math.max(10, size * 0.13), marginTop: size * 0.02 }}>
            ACELERAR
          </span>
        </div>
      </div>
    );
  },
);

/** Dibujo del joystick */
export const StickView = forwardRef<HTMLDivElement, { size: number; knobRef?: React.Ref<HTMLDivElement> } & React.HTMLAttributes<HTMLDivElement>>(
  function StickView({ size, knobRef, style, className = '', ...rest }, ref) {
    return (
      <div
        ref={ref}
        {...rest}
        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/80 bg-white/25 backdrop-blur-sm ${className}`}
        style={{ width: size, height: size, ...style }}
      >
        <div
          ref={knobRef}
          className="absolute left-1/2 top-1/2 rounded-full bg-white shadow-[0_4px_0_rgba(51,38,77,0.25)]"
          style={{ width: size * 0.45, height: size * 0.45, transform: 'translate(-50%, -50%)' }}
        />
      </div>
    );
  },
);

/** Joystick, arrastrar para girar la cámara y botón de saltar, en la posición y tamaño que elija la niña */
export function TouchControls({ pedal = false }: { pedal?: boolean }) {
  const { w, h } = useViewportSize();
  const saved = useGame((s) => s.controls);
  const layout = saved ?? defaultLayout(w, h);
  const pos = placeControls(layout, w, h);
  const R = layout.stickSize * 0.5; // qué tanto se mueve el joystick

  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const jumpBtn = useRef<HTMLDivElement>(null);
  const roles = useRef(new Map<number, { role: 'stick' | 'cam'; ox: number; oy: number; lx: number; ly: number }>());
  const stickOnLeft = pos.stick.x < w / 2;

  const restStick = () => {
    const b = base.current;
    if (!b) return;
    b.style.left = `${pos.stick.x}px`;
    b.style.top = `${pos.stick.y}px`;
    b.style.opacity = '0.55';
    if (knob.current) knob.current.style.transform = 'translate(-50%, -50%)';
  };

  useEffect(() => {
    if (![...roles.current.values()].some((r) => r.role === 'stick')) restStick();
  });

  const down = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    // el lado de la pantalla donde está el joystick sirve para caminar; el otro para girar la cámara
    const inStickSide = stickOnLeft ? e.clientX < w * 0.45 : e.clientX > w * 0.55;
    const hasStick = [...roles.current.values()].some((r) => r.role === 'stick');
    if (inStickSide && !hasStick) {
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
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
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
    haptic(12);
    jumpBtn.current?.firstElementChild?.classList.add('pressed');
  };
  const release = () => {
    input.jumpHeld = false;
    jumpBtn.current?.firstElementChild?.classList.remove('pressed');
  };
  const gasOn = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    input.gas = true;
    haptic(10);
    jumpBtn.current?.firstElementChild?.classList.add('pressed');
  };
  const gasOff = () => {
    input.gas = false;
    jumpBtn.current?.firstElementChild?.classList.remove('pressed');
  };
  useEffect(() => () => void (input.gas = false), []);

  return (
    <>
      <div className="absolute inset-0 z-10" style={{ touchAction: 'none' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      <StickView ref={base} knobRef={knob} size={layout.stickSize} className="pointer-events-none z-20" style={{ left: pos.stick.x, top: pos.stick.y, opacity: 0.55 }} />
      {pedal ? (
        <PedalButtonView
          ref={jumpBtn}
          size={pos.jump.size * 1.1}
          className="z-20"
          style={{ left: pos.jump.x - (pos.jump.size * 1.1) / 2, top: pos.jump.y - (pos.jump.size * 1.1) / 2 }}
          onPointerDown={gasOn}
          onPointerUp={gasOff}
          onPointerCancel={gasOff}
        />
      ) : (
        <JumpButtonView
          ref={jumpBtn}
          size={pos.jump.size}
          className="z-20"
          style={{ left: pos.jump.x - pos.jump.size / 2, top: pos.jump.y - pos.jump.size / 2 }}
          onPointerDown={jump}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
        />
      )}
    </>
  );
}
