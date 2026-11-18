import * as THREE from 'three';

// Caras dibujadas en canvas (transparente) que se pegan al frente de la cabeza
const cache = new Map<string, THREE.CanvasTexture>();
const INK = '#2b2240';
const BLUSH = 'rgba(255,120,160,0.55)';

type Ctx = CanvasRenderingContext2D;

function eye(c: Ctx, x: number, y: number, r = 20) {
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'white';
  c.beginPath();
  c.arc(x - r * 0.25, y - r * 0.35, r * 0.32, 0, Math.PI * 2);
  c.fill();
}

function blush(c: Ctx) {
  c.fillStyle = BLUSH;
  for (const x of [58, 198]) {
    c.beginPath();
    c.ellipse(x, 150, 22, 13, 0, 0, Math.PI * 2);
    c.fill();
  }
}

function smile(c: Ctx, w = 40, y = 150) {
  c.strokeStyle = INK;
  c.lineWidth = 11;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(128, y - 15, w, 0.2 * Math.PI, 0.8 * Math.PI);
  c.stroke();
}

function arcEye(c: Ctx, x: number, y: number) {
  c.strokeStyle = INK;
  c.lineWidth = 11;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(x, y + 8, 18, 1.15 * Math.PI, 1.85 * Math.PI);
  c.stroke();
}

function heart(c: Ctx, x: number, y: number, s: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y, x - s * 0.7, y - s * 1.1, x, y - s * 0.4);
  c.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9);
  c.fill();
}

function star(c: Ctx, x: number, y: number, r: number, color: string) {
  c.fillStyle = color;
  c.strokeStyle = INK;
  c.lineWidth = 4;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
  c.stroke();
}

const DRAW: Record<string, (c: Ctx) => void> = {
  smile: (c) => {
    eye(c, 88, 100);
    eye(c, 168, 100);
    blush(c);
    smile(c);
  },
  happy: (c) => {
    arcEye(c, 88, 100);
    arcEye(c, 168, 100);
    blush(c);
    c.fillStyle = INK;
    c.beginPath();
    c.arc(128, 140, 34, 0, Math.PI);
    c.fill();
    c.fillStyle = '#ff7a9c';
    c.beginPath();
    c.arc(128, 162, 16, Math.PI, 0);
    c.fill();
  },
  wink: (c) => {
    eye(c, 88, 100);
    c.strokeStyle = INK;
    c.lineWidth = 11;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(150, 90);
    c.lineTo(182, 102);
    c.lineTo(150, 112);
    c.stroke();
    blush(c);
    smile(c, 36);
  },
  surprise: (c) => {
    eye(c, 88, 98, 24);
    eye(c, 168, 98, 24);
    blush(c);
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(128, 165, 18, 22, 0, 0, Math.PI * 2);
    c.fill();
  },
  cat: (c) => {
    eye(c, 88, 100);
    eye(c, 168, 100);
    blush(c);
    c.strokeStyle = INK;
    c.lineWidth = 8;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(110, 145, 18, 0.1 * Math.PI, 0.9 * Math.PI);
    c.arc(146, 145, 18, 0.1 * Math.PI, 0.9 * Math.PI);
    c.stroke();
    c.lineWidth = 5;
    for (const s of [-1, 1]) {
      for (const dy of [-8, 8]) {
        c.beginPath();
        c.moveTo(128 + s * 60, 140 + dy * 0.3);
        c.lineTo(128 + s * 110, 135 + dy * 1.6);
        c.stroke();
      }
    }
  },
  silly: (c) => {
    eye(c, 88, 100, 16);
    eye(c, 168, 98, 24);
    blush(c);
    smile(c, 40);
    c.fillStyle = '#ff6f91';
    c.beginPath();
    c.ellipse(140, 172, 16, 20, 0.2, 0, Math.PI * 2);
    c.fill();
  },
  cool: (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 10;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(62, 72);
    c.lineTo(108, 80);
    c.moveTo(148, 80);
    c.lineTo(194, 72);
    c.stroke();
    eye(c, 88, 105, 17);
    eye(c, 168, 105, 17);
    c.beginPath();
    c.moveTo(100, 160);
    c.quadraticCurveTo(140, 170, 165, 145);
    c.stroke();
  },
  hearts: (c) => {
    heart(c, 88, 100, 26, '#ff3d7f');
    heart(c, 168, 100, 26, '#ff3d7f');
    blush(c);
    smile(c, 42);
  },
  stars: (c) => {
    star(c, 88, 100, 30, '#ffcf33');
    star(c, 168, 100, 30, '#ffcf33');
    blush(c);
    c.fillStyle = INK;
    c.beginPath();
    c.arc(128, 140, 32, 0, Math.PI);
    c.fill();
  },
};

export function faceTexture(id: string): THREE.CanvasTexture {
  let t = cache.get(id);
  if (t) return t;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d')!;
  (DRAW[id] ?? DRAW.smile)(c);
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(id, t);
  return t;
}
