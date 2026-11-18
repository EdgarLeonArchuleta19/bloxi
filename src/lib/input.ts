// Estado de controles compartido (joystick táctil + teclado para probar en compu)
export const input = {
  moveX: 0, // -1 izquierda, 1 derecha
  moveY: 0, // 1 adelante, -1 atrás
  jump: false, // se "consume" al usarse
  jumpHeld: false,
  camDX: 0, // arrastre acumulado de cámara (pixeles)
  camDY: 0,
};

const keys = new Set<string>();

function updateKeys() {
  const l = keys.has('a') || keys.has('arrowleft');
  const r = keys.has('d') || keys.has('arrowright');
  const u = keys.has('w') || keys.has('arrowup');
  const d = keys.has('s') || keys.has('arrowdown');
  input.moveX = (r ? 1 : 0) - (l ? 1 : 0);
  input.moveY = (u ? 1 : 0) - (d ? 1 : 0);
}

let keyboardBound = false;
export function bindKeyboard() {
  if (keyboardBound) return;
  keyboardBound = true;
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ') {
      if (!input.jumpHeld) input.jump = true;
      input.jumpHeld = true;
    }
    keys.add(k);
    updateKeys();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ') input.jumpHeld = false;
    keys.delete(k);
    updateKeys();
  });
}

export function resetInput() {
  input.moveX = input.moveY = input.camDX = input.camDY = 0;
  input.jump = input.jumpHeld = false;
}
