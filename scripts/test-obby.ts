// Bot que recorre el obby con la misma física del juego para verificar que se puede terminar.
import * as THREE from 'three';
import { Controller, makeSolids, updateMovers } from '../src/game/physics';
import { buildObby } from '../src/game/levels/obbyData';

const { platforms } = buildObby();
const solids = makeSolids(platforms);
const ctrl = new Controller();
ctrl.reset(new THREE.Vector3(0, 0, -2));
let t = 0;
const dt = 1 / 100;
let totalFails = 0;

for (let k = 1; k < solids.length; k++) {
  const tgt = solids[k];
  let ok = false;
  for (let attempt = 0; attempt < 8 && !ok; attempt++) {
    let wait = attempt * 0.37;
    for (let step = 0; step < 2500; step++) {
      t += dt;
      updateMovers(solids, t);
      const cur = ctrl.ground;
      let wx = 0, wz = 0, jump = false;
      if (wait > 0 && ctrl.grounded) {
        wait -= dt;
      } else {
        const dx = tgt.center.x - ctrl.pos.x, dz = tgt.center.z - ctrl.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        wx = dx / len; wz = dz / len;
        // plataforma que se mueve en x: esperar a que esté alineada
        if (ctrl.grounded && cur !== tgt && tgt.spec.move?.axis === 'x' && Math.abs(tgt.center.x - ctrl.pos.x) > 0.8) {
          wx = 0; wz = 0;
        }
        if (ctrl.grounded && cur && cur !== tgt) {
          const tx = wx > 0 ? (cur.max.x - ctrl.pos.x) / wx : wx < 0 ? (cur.min.x - ctrl.pos.x) / wx : Infinity;
          const tz = wz > 0 ? (cur.max.z - ctrl.pos.z) / wz : wz < 0 ? (cur.min.z - ctrl.pos.z) / wz : Infinity;
          if (Math.min(tx, tz) < 0.5) jump = true;
        }
      }
      const ev = ctrl.step(dt, wx, wz, jump, solids);
      if (ctrl.ground === tgt || (ev.bounced && tgt.kind === 'bounce' && Math.abs(ctrl.pos.z - tgt.center.z) < 2)) {
        ok = true;
        break;
      }
      if (ctrl.pos.y < -12) break;
    }
    if (!ok) {
      totalFails++;
      console.log(`  falló hacia plataforma ${k} (intento ${attempt + 1})`);
      const prev = solids[k - 1];
      ctrl.reset(new THREE.Vector3(prev.center.x, prev.max.y + 0.01, prev.center.z));
    }
  }
  console.log(`${ok ? '✅' : '❌'} plataforma ${k} (${tgt.kind}) z=${tgt.center.z}`);
  if (!ok) process.exit(1);
}
console.log(`🏆 Obby completado. Fallos: ${totalFails}. Tiempo sim: ${t.toFixed(1)}s`);
