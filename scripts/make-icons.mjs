// Genera los íconos PNG de la app sin dependencias (dibuja una carita de cubo).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function pixel(u, v) {
  // u,v en [0,1]. Fondo: cielo -> rosita
  const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  let col = mix([110, 196, 255], [255, 196, 228], v);
  // rayitos de luz
  const ang = Math.atan2(v - 0.5, u - 0.5);
  if (Math.sin(ang * 8) > 0.6) col = mix(col, [255, 255, 255], 0.12);

  // cubito inclinado -12°
  const t = (12 * Math.PI) / 180;
  const rot = (x, y) => [0.5 + (x - 0.5) * Math.cos(t) - (y - 0.5) * Math.sin(t), 0.5 + (x - 0.5) * Math.sin(t) + (y - 0.5) * Math.cos(t)];
  const box = (x, y, cy, hs, r) => {
    const dx = Math.max(Math.abs(x - 0.5) - (hs - r), 0);
    const dy = Math.max(Math.abs(y - cy) - (hs - r), 0);
    return Math.hypot(dx, dy) - r;
  };
  const [x, y] = rot(u, v);
  const hs = 0.31, r = 0.075;
  const ink = [51, 38, 77];
  // sombra 3D
  if (box(x, y, 0.535, hs, r) < 0) col = ink;
  const d = box(x, y, 0.49, hs, r);
  if (d < 0.02) col = ink;
  if (d < 0) {
    // degradado rosa -> morado
    const k = Math.min(1, Math.max(0, (x - 0.19 + y - 0.18) / 1.25));
    col = mix([255, 122, 182], [139, 92, 246], k);
    // brillo
    if (y < 0.27 && y > 0.235 && x > 0.27 && x < 0.6) col = mix(col, [255, 255, 255], 0.45);
    // ojos
    for (const ex of [0.39, 0.61]) {
      if (Math.hypot((x - ex) / 0.055, (y - 0.46) / 0.07) < 1) col = ink;
      if (Math.hypot(x - ex + 0.015, y - 0.435) < 0.02) col = [255, 255, 255];
    }
    // cachetes
    for (const cx of [0.3, 0.7]) if (Math.hypot((x - cx) / 0.045, (y - 0.56) / 0.03) < 1) col = mix(col, [255, 209, 230], 0.8);
    // sonrisa
    const sd = Math.hypot(x - 0.5, y - 0.5);
    if (sd > 0.085 && sd < 0.125 && y > 0.555 && Math.abs(x - 0.5) < 0.11) col = ink;
  }
  return col;
}

function makePng(size, file) {
  const SS = 3;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          acc = acc.map((a, i) => a + c[i]);
        }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = acc[0] / (SS * SS); raw[o + 1] = acc[1] / (SS * SS); raw[o + 2] = acc[2] / (SS * SS); raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(file, png);
  console.log('ok', file);
}

mkdirSync('public/icons', { recursive: true });
makePng(192, 'public/icons/icon-192.png');
makePng(512, 'public/icons/icon-512.png');
makePng(180, 'public/icons/apple-touch-icon.png');
