import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  JUMP_MAX, JUMP_MIN, STICK_MAX, STICK_MIN, defaultLayout, placeControls, useViewportSize, type ControlsLayout,
} from '../lib/controlsLayout';
import { haptic } from '../lib/native';
import { sfx } from '../lib/sound';
import { useGame } from '../store';
import { CandyButton } from '../ui/kit';
import { JumpButtonView, StickView } from './TouchControls';

type Part = 'jump' | 'stick';

/** Pantalla para acomodar los botones: arrastrarlos y cambiar su tamaño */
export function ControlsEditor({ onClose }: { onClose: () => void }) {
  const { w, h } = useViewportSize();
  const saved = useGame((s) => s.controls);
  const [layout, setLayout] = useState<ControlsLayout>(() => saved ?? defaultLayout(window.innerWidth, window.innerHeight));
  const [dragging, setDragging] = useState<Part | null>(null);
  const drag = useRef<{ part: Part; dx: number; dy: number } | null>(null);
  const pos = placeControls(layout, w, h);

  const startDrag = (part: Part) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = part === 'jump' ? pos.jump : pos.stick;
    drag.current = { part, dx: e.clientX - p.x, dy: e.clientY - p.y };
    setDragging(part);
    haptic(10);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const x = (e.clientX - d.dx) / w;
    const y = (e.clientY - d.dy) / h;
    setLayout((l) => (d.part === 'jump' ? { ...l, jumpX: x, jumpY: y } : { ...l, stickX: x, stickY: y }));
  };
  const endDrag = () => {
    if (drag.current) haptic(6);
    drag.current = null;
    setDragging(null);
  };

  const save = () => {
    // guardamos la posición ya acomodada dentro de la pantalla
    const p = placeControls(layout, w, h);
    useGame.getState().setControls({ ...layout, jumpX: p.jump.x / w, jumpY: p.jump.y / h, stickX: p.stick.x / w, stickY: p.stick.y / h });
    sfx.equip();
    onClose();
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[80] overflow-hidden bg-gradient-to-b from-[#8fd3ff] via-[#c4e7ff] to-[#ffe3f1]"
      style={{ touchAction: 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* piso de mentiritas para que se vea como el juego */}
      <div className="absolute inset-x-[-20%] bottom-[-30%] h-[70%] rounded-[50%] bg-[#c9b6ff] opacity-70" />
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(white 2px, transparent 2.5px)', backgroundSize: '26px 26px' }} />

      {/* Panel con tamaños (se vuelve transparente mientras arrastras) */}
      <div
        className="safe-top absolute inset-x-0 top-0 flex justify-center px-4 transition-opacity"
        style={{ opacity: dragging ? 0.25 : 1, pointerEvents: dragging ? 'none' : 'auto' }}
      >
        <div className="card mt-2 w-full max-w-lg p-4 text-center short:p-3">
          <h2 className="text-2xl font-bold short:text-xl">🕹️ Acomoda tus botones</h2>
          <p className="text-base text-ink/60 short:hidden">Arrastra el botón y el joystick a donde quieras. Cambia su tamaño aquí:</p>
          <div className="mt-3 grid gap-3 text-left short:mt-2 short:grid-cols-2 short:gap-4">
            <label className="block">
              <span className="text-lg font-bold">⬆ Botón de saltar</span>
              <input
                type="range"
                min={JUMP_MIN}
                max={JUMP_MAX}
                value={layout.jumpSize}
                onChange={(e) => setLayout((l) => ({ ...l, jumpSize: Number(e.target.value) }))}
                className="mt-2"
              />
            </label>
            <label className="block">
              <span className="text-lg font-bold">🕹️ Joystick</span>
              <input
                type="range"
                min={STICK_MIN}
                max={STICK_MAX}
                value={layout.stickSize}
                onChange={(e) => setLayout((l) => ({ ...l, stickSize: Number(e.target.value) }))}
                className="mt-2"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-3 short:mt-3">
            <CandyButton
              tone="white"
              className="h-12 flex-1 text-lg"
              onClick={() => {
                setLayout(defaultLayout(w, h));
                useGame.getState().setControls(null);
              }}
            >
              ↺ Como estaba
            </CandyButton>
            <CandyButton tone="mint" className="h-12 flex-1 text-lg" onClick={save} silent>
              ✓ ¡Listo!
            </CandyButton>
          </div>
        </div>
      </div>

      {/* Joystick arrastrable */}
      <StickView
        size={layout.stickSize}
        className={`cursor-grab ${dragging === 'stick' ? 'ring-8 ring-grape/40' : ''}`}
        style={{ left: pos.stick.x, top: pos.stick.y, opacity: 1, touchAction: 'none' }}
        onPointerDown={startDrag('stick')}
      />
      <Hint x={pos.stick.x} y={pos.stick.y - layout.stickSize / 2 - 22} text="Caminar" />

      {/* Botón de saltar arrastrable */}
      <JumpButtonView
        size={pos.jump.size}
        className={`cursor-grab ${dragging === 'jump' ? 'scale-105 ring-8 ring-grape/40' : ''}`}
        style={{ left: pos.jump.x - pos.jump.size / 2, top: pos.jump.y - pos.jump.size / 2 }}
        onPointerDown={startDrag('jump')}
      />
      <Hint x={pos.jump.x} y={pos.jump.y - pos.jump.size / 2 - 22} text="Saltar" />
    </motion.div>,
    document.body,
  );
}

function Hint({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-ink/80 px-3 py-0.5 text-sm font-bold text-white"
      style={{ left: x, top: Math.max(14, y) }}
    >
      ✋ {text}
    </div>
  );
}
