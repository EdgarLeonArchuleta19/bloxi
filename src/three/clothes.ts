import * as THREE from 'three';

// Estampados y patrones de ropa dibujados con canvas (sin archivos de imagen)
type Ctx = CanvasRenderingContext2D;
const INK = '#2b2240';

function makeTex(draw: (c: Ctx) => void, size = 256) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function starPath(c: Ctx, x: number, y: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}

function heartPath(c: Ctx, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y, x - s * 0.7, y - s * 1.1, x, y - s * 0.4);
  c.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9);
}

function bolt(c: Ctx, x: number, y: number, s: number, fill: string) {
  c.fillStyle = fill;
  c.strokeStyle = INK;
  c.lineWidth = 6;
  c.beginPath();
  const pts = [[0.15, -1], [-0.45, 0.1], [-0.02, 0.1], [-0.2, 1], [0.45, -0.15], [0.02, -0.15], [0.25, -1]];
  pts.forEach(([px, py], i) => (i ? c.lineTo(x + px * s, y + py * s) : c.moveTo(x + px * s, y + py * s)));
  c.closePath();
  c.fill();
  c.stroke();
}

const DECALS: Record<string, (c: Ctx) => void> = {
  catface: (c) => {
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#2b2240';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(58, 92); c.lineTo(70, 40); c.lineTo(100, 74);
    c.lineTo(156, 74); c.lineTo(186, 40); c.lineTo(198, 92);
    c.ellipse(128, 130, 72, 60, 0, 0, Math.PI);
    c.closePath();
    c.fill(); c.stroke();
    c.fillStyle = '#2b2240';
    c.beginPath(); c.arc(102, 118, 9, 0, Math.PI * 2); c.arc(154, 118, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff7ab6';
    c.beginPath(); c.moveTo(118, 136); c.lineTo(138, 136); c.lineTo(128, 148); c.fill();
    c.lineWidth = 4;
    for (const s of [-1, 1]) for (const dy of [-6, 6]) {
      c.beginPath(); c.moveTo(128 + s * 40, 146 + dy); c.lineTo(128 + s * 90, 140 + dy * 2); c.stroke();
    }
  },
  ten: (c) => {
    c.fillStyle = '#ffffff';
    c.font = 'bold 150px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('10', 128, 140);
    c.fillRect(70, 18, 116, 10);
  },
  star: (c) => {
    starPath(c, 128, 128, 80);
    c.fillStyle = '#ffd23f';
    c.fill();
    c.lineWidth = 10;
    c.strokeStyle = '#ffffff';
    c.stroke();
  },
  heart: (c) => {
    heartPath(c, 128, 125, 70);
    c.fillStyle = '#ff3d7f';
    c.fill();
    c.lineWidth = 10;
    c.strokeStyle = '#ffffff';
    c.stroke();
  },
  smile: (c) => {
    c.fillStyle = '#ffd23f';
    c.beginPath();
    c.arc(128, 128, 78, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 8;
    c.strokeStyle = INK;
    c.stroke();
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(100, 110, 9, 14, 0, 0, Math.PI * 2);
    c.ellipse(156, 110, 9, 14, 0, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 9;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(128, 128, 42, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();
  },
  bolt: (c) => bolt(c, 128, 128, 90, '#ffd23f'),
  rainbow: (c) => {
    ['#ff5f5f', '#ffa24c', '#ffd84a', '#5fe08a', '#4cc0ff', '#9b7bff'].forEach((col, i) => {
      c.strokeStyle = col;
      c.lineWidth = 15;
      c.beginPath();
      c.arc(128, 170, 100 - i * 14, Math.PI, 0);
      c.stroke();
    });
    c.fillStyle = '#ffffff';
    for (const x of [38, 218]) {
      c.beginPath();
      c.arc(x, 175, 22, 0, Math.PI * 2);
      c.arc(x + (x < 128 ? 20 : -20), 168, 18, 0, Math.PI * 2);
      c.fill();
    }
  },
  dinoprint: (c) => {
    c.fillStyle = '#2fd39a';
    c.strokeStyle = INK;
    c.lineWidth = 6;
    c.beginPath();
    c.ellipse(120, 150, 62, 40, 0, 0, Math.PI * 2); // cuerpo
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(165, 135);
    c.quadraticCurveTo(190, 80, 175, 60); // cuello
    c.lineTo(205, 55);
    c.quadraticCurveTo(205, 110, 180, 160);
    c.fill();
    c.beginPath();
    c.ellipse(195, 58, 26, 18, 0, 0, Math.PI * 2); // cabeza
    c.fill();
    c.stroke();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(203, 52, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2fd39a';
    c.fillRect(85, 180, 20, 30);
    c.fillRect(135, 180, 20, 30);
    c.beginPath();
    c.moveTo(62, 150);
    c.lineTo(20, 175);
    c.lineTo(70, 165);
    c.fill();
    c.fillStyle = '#ff9a3c';
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(80 + i * 22, 118 - Math.sin(i) * 4);
      c.lineTo(91 + i * 22, 96);
      c.lineTo(102 + i * 22, 116);
      c.fill();
    }
  },
  tie: (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(70, 0);
    c.lineTo(128, 50);
    c.lineTo(186, 0);
    c.fill();
    c.fillStyle = '#ff3d5a';
    c.beginPath();
    c.moveTo(112, 40);
    c.lineTo(144, 40);
    c.lineTo(136, 64);
    c.lineTo(156, 200);
    c.lineTo(128, 236);
    c.lineTo(100, 200);
    c.lineTo(120, 64);
    c.closePath();
    c.fill();
  },
  belly: (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(128, 140, 92, 116, 0, 0, Math.PI * 2);
    c.fill();
  },
  mustard: (c) => {
    c.strokeStyle = '#ffd23f';
    c.lineWidth = 18;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    for (let i = 0; i <= 8; i++) c.lineTo(40 + (i % 2) * 176, 10 + i * 30);
    c.stroke();
  },
  hero: (c) => {
    c.fillStyle = '#ffd23f';
    c.beginPath();
    c.arc(128, 120, 80, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 8;
    c.strokeStyle = '#ff3d5a';
    c.stroke();
    bolt(c, 128, 120, 62, '#ff3d5a');
  },
  astro: (c) => {
    c.fillStyle = '#3c6cf5';
    c.beginPath();
    c.roundRect(150, 40, 80, 56, 10);
    c.fill();
    c.fillStyle = '#ffffff';
    for (const [x, y] of [[170, 60], [195, 72], [212, 55]]) {
      starPath(c, x, y, 9);
      c.fill();
    }
    c.fillStyle = '#ff5fa2';
    c.beginPath();
    c.arc(80, 90, 28, 0, Math.PI * 2);
    c.fill();
  },
  robotface: (c) => {
    c.fillStyle = '#2b2240';
    c.beginPath();
    c.roundRect(28, 50, 200, 150, 26);
    c.fill();
    c.fillStyle = '#5ff5ff';
    c.shadowColor = '#5ff5ff';
    c.shadowBlur = 16;
    c.beginPath();
    c.roundRect(68, 90, 34, 40, 8);
    c.roundRect(154, 90, 34, 40, 8);
    c.fill();
    c.fillRect(88, 158, 80, 12);
    c.shadowBlur = 0;
  },
  robotpanel: (c) => {
    c.fillStyle = '#9aa5b1';
    c.beginPath();
    c.roundRect(48, 60, 160, 120, 16);
    c.fill();
    ['#ff3d5a', '#ffd23f', '#2fd39a'].forEach((col, i) => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(88 + i * 40, 100, 14, 0, Math.PI * 2);
      c.fill();
    });
    c.fillStyle = INK;
    c.fillRect(78, 140, 100, 12);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(0, 222, 256, 18); // cinta adhesiva
  },
  mask: (c) => {
    c.fillStyle = '#1d1830';
    c.beginPath();
    c.roundRect(20, 70, 216, 62, 30);
    c.fill();
    c.globalCompositeOperation = 'destination-out';
    for (const x of [88, 168]) {
      c.beginPath();
      c.ellipse(x, 100, 26, 22, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  },
};

const decalCache = new Map<string, THREE.Material>();
export function decalMat(id: string): THREE.Material | null {
  if (!DECALS[id]) return null;
  let m = decalCache.get(id);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: makeTex(DECALS[id]), transparent: true, depthWrite: false });
    decalCache.set(id, m);
  }
  return m;
}

/** Patrones que cubren toda la tela, cada prenda con sus propios colores */
const patternCache = new Map<string, THREE.Material>();
const PATTERNS: Record<string, (c: Ctx, base: string, accent: string) => void> = {
  stripes: (c, _b, a) => {
    c.fillStyle = a;
    for (let i = 0; i < 4; i++) c.fillRect(0, i * 32 + 4, 128, 14);
  },
  legstripes: (c, _b, a) => {
    c.fillStyle = a;
    for (let i = 0; i < 5; i++) c.fillRect(0, i * 25.6 + 3, 128, 11);
  },
  rainbowstripes: (c) => {
    ['#ff5f5f', '#ffa24c', '#ffd84a', '#5fe08a', '#4cc0ff', '#9b7bff'].forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(0, i * 21.3, 128, 21.3);
    });
  },
  dots: (c) => {
    const cols = ['#ff3d5a', '#3cb7f5', '#2fd39a', '#ffffff', '#b07cff'];
    let i = 0;
    for (let y = 16; y < 128; y += 32)
      for (let x = (y / 32) % 2 ? 32 : 16; x < 128; x += 32) {
        c.fillStyle = cols[i++ % cols.length];
        c.beginPath();
        c.arc(x, y, 9, 0, Math.PI * 2);
        c.fill();
      }
  },
  polka: (c, _b, a) => {
    c.fillStyle = a;
    for (let y = 12; y < 128; y += 26)
      for (let x = (Math.round(y / 26) % 2) * 13 + 10; x < 128; x += 26) {
        c.beginPath();
        c.arc(x, y, 5.5, 0, Math.PI * 2);
        c.fill();
      }
  },
  denim: (c, b) => {
    const col = new THREE.Color(b);
    c.strokeStyle = '#' + col.clone().lerp(new THREE.Color('#ffffff'), 0.18).getHexString();
    c.lineWidth = 1;
    for (let x = -128; x < 128; x += 4) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 128, 128);
      c.stroke();
    }
    c.strokeStyle = '#ffc46b';
    c.setLineDash([5, 4]);
    c.lineWidth = 2;
    c.strokeRect(6, 6, 116, 116);
    c.setLineDash([]);
  },
  sidestripe: (c, _b, a) => {
    c.fillStyle = a;
    c.fillRect(52, 0, 9, 128);
    c.fillRect(67, 0, 9, 128);
  },
  stars: (c, _b, a) => {
    c.fillStyle = a;
    for (const [x, y, r] of [[24, 22, 10], [90, 40, 8], [50, 80, 11], [110, 100, 9], [16, 112, 7], [70, 12, 6]]) {
      starPath(c, x, y, r);
      c.fill();
    }
  },
  camo: (c) => {
    const cols = ['#4f6b3a', '#8aa864', '#3b4a2a', '#a3b57a'];
    for (let i = 0; i < 18; i++) {
      c.fillStyle = cols[i % cols.length];
      c.beginPath();
      c.ellipse((i * 47) % 128, (i * 29) % 128, 18 + (i % 3) * 6, 10 + (i % 4) * 4, i, 0, Math.PI * 2);
      c.fill();
    }
  },
  plaid: (c) => {
    c.fillStyle = 'rgba(40,20,40,0.35)';
    for (let i = 0; i < 4; i++) {
      c.fillRect(i * 32 + 8, 0, 12, 128);
      c.fillRect(0, i * 32 + 8, 128, 12);
    }
    c.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 4; i++) {
      c.fillRect(i * 32 + 26, 0, 2, 128);
      c.fillRect(0, i * 32 + 26, 128, 2);
    }
  },
  hearts: (c, _b, a) => {
    c.fillStyle = a;
    for (const [x, y] of [[22, 22], [86, 30], [50, 72], [108, 88], [20, 108], [74, 116]]) {
      heartPath(c, x, y, 9);
      c.fill();
    }
  },
};

export function patternMat(kind: string | undefined, base: string, accent = '#ffffff'): THREE.Material | null {
  if (!kind || !PATTERNS[kind]) return null;
  const k = `${kind}|${base}|${accent}`;
  let m = patternCache.get(k);
  if (!m) {
    const tex = makeTex((c) => {
      c.fillStyle = base;
      c.fillRect(0, 0, 128, 128);
      PATTERNS[kind](c, base, accent);
    }, 128);
    m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
    patternCache.set(k, m);
  }
  return m;
}

/** Para faldas (cilindros): repite el patrón alrededor para que no se estire */
const wrapCache = new Map<THREE.Material, THREE.Material>();
export function wrapAround(m: THREE.Material, times = 4): THREE.Material {
  const std = m as THREE.MeshStandardMaterial;
  if (!std.map) return m;
  let w = wrapCache.get(m);
  if (!w) {
    const c = std.clone();
    const t = std.map.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(times, 1);
    t.needsUpdate = true;
    c.map = t;
    w = c;
    wrapCache.set(m, w);
  }
  return w;
}
