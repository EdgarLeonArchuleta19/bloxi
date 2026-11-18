import { useMemo, useState } from 'react';
import { downloadBackup, loadBackup } from '../lib/backup';
import { sfx } from '../lib/sound';
import { useGame } from '../store';
import { CandyButton, Modal, Toggle } from '../ui/kit';

export function Settings() {
  const name = useGame((s) => s.name);
  const sound = useGame((s) => s.sound);
  const [editName, setEditName] = useState(name);
  const [gate, setGate] = useState(false);

  return (
    <div className="no-scrollbar flex h-full flex-col gap-4 overflow-y-auto pb-2">
      <h1 className="text-4xl font-bold max-sm:text-3xl short:text-2xl">⚙️ Ajustes</h1>

      <div className="grid gap-4 landscape:grid-cols-2">
        <div className="card flex flex-col gap-4 p-5">
          <div className="text-xl font-bold">😊 Mi nombre</div>
          <div className="flex gap-3">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value.slice(0, 14))}
              className="h-14 min-w-0 flex-1 rounded-2xl border-4 border-[#e6dcff] bg-[#faf7ff] px-4 text-2xl font-bold outline-none focus:border-grape"
            />
            <CandyButton
              tone="grape"
              className="h-14 px-5 text-lg"
              disabled={!editName.trim() || editName.trim() === name}
              onClick={() => useGame.getState().setName(editName.trim())}
            >
              Guardar
            </CandyButton>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold">🔊 Sonidos</span>
            <Toggle on={sound} onChange={() => useGame.getState().toggleSound()} />
          </div>
        </div>

        <div className="card flex flex-col gap-2 p-5">
          <div className="text-xl font-bold">📲 Instalar en el iPad</div>
          <ol className="list-decimal space-y-1 pl-6 text-lg text-ink/75">
            <li>Abre Bloxi en <b>Safari</b>.</li>
            <li>Toca el botón <b>Compartir</b> (cuadrito con flecha ⬆️).</li>
            <li>Elige <b>“Agregar a pantalla de inicio”</b>.</li>
            <li>¡Listo! Ya funciona sin internet ✈️</li>
          </ol>
        </div>

        <div className="card flex flex-col gap-2 p-5 landscape:col-span-2">
          <div className="text-xl font-bold">👨‍👩‍👧 Para papás</div>
          <ul className="space-y-1 text-lg text-ink/75">
            <li>✅ Sin cuentas, sin chat y sin otros jugadores.</li>
            <li>✅ Sin anuncios ni compras con dinero real: las monedas solo se ganan jugando.</li>
            <li>✅ No envía ningún dato a internet: todo se guarda en este dispositivo.</li>
            <li>💡 Tip: usa “Acceso guiado” del iPad (Ajustes → Accesibilidad) para que no salga de la app.</li>
          </ul>
          <div className="mt-3 rounded-2xl bg-[#f6f2fb] p-4">
            <div className="text-lg font-bold">💾 Copia de seguridad</div>
            <p className="text-base text-ink/65">
              El progreso se guarda solo en este dispositivo (en dos lugares, para que no se pierda). Puedes descargar una copia para
              pasarla a otro iPad.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <CandyButton tone="sky" className="h-12 px-5 text-lg" onClick={() => downloadBackup(name)}>
                ⬇️ Descargar copia
              </CandyButton>
              <label className="candy flex h-12 cursor-pointer items-center px-5 text-lg" style={{ background: '#ffffff', color: '#33264d', ['--shade' as string]: '#d9d0ea', textShadow: 'none' }}>
                ⬆️ Cargar copia
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f && !(await loadBackup(f))) {
                      sfx.error();
                      alert('Ese archivo no es una copia de Bloxi 🥲');
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
          <button onClick={() => setGate(true)} className="mt-2 self-start text-lg font-semibold text-candy underline">
            Borrar todo el progreso
          </button>
        </div>
      </div>
      <p className="text-center text-base text-ink/40">Bloxi v1.0 • Hecho con 💖</p>

      <ParentGate open={gate} onClose={() => setGate(false)} />
    </div>
  );
}

/** Pregunta de adulto para evitar que borre todo por accidente */
function ParentGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const q = useMemo(() => {
    const a = 6 + Math.floor(Math.random() * 7);
    const b = 4 + Math.floor(Math.random() * 6);
    return { a, b, r: a * b };
  }, [open]);
  const [ans, setAns] = useState('');
  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-6xl">🔐</div>
      <h2 className="mt-2 text-2xl font-bold">Solo para adultos</h2>
      <p className="mt-1 text-lg text-ink/70">
        ¿Cuánto es {q.a} × {q.b}?
      </p>
      <input
        inputMode="numeric"
        value={ans}
        onChange={(e) => setAns(e.target.value.replace(/\D/g, '').slice(0, 3))}
        className="mt-4 h-14 w-40 rounded-2xl border-4 border-[#e6dcff] text-center text-3xl font-bold outline-none"
      />
      <p className="mt-3 text-base text-ink/60">Se borrarán el nombre, monedas y accesorios.</p>
      <div className="mt-5 flex gap-3">
        <CandyButton tone="white" className="h-14 flex-1 text-lg" onClick={onClose}>
          Cancelar
        </CandyButton>
        <CandyButton
          tone="candy"
          className="h-14 flex-1 text-lg"
          onClick={() => {
            if (Number(ans) === q.r) {
              useGame.getState().resetAll();
              onClose();
            } else {
              sfx.error();
              setAns('');
            }
          }}
        >
          Borrar
        </CandyButton>
      </div>
    </Modal>
  );
}
