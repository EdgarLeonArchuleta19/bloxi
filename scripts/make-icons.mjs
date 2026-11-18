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
  // u,v en [0,1]
  const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  let col = mix([126, 200, 255], [255, 158, 214], v); // cielo -> rosa
  // cubo-cabeza
  const hx = 0.5, hy = 0.5, hs = 0.3, r = 0.06;
  const dx = Math.max(Math.abs(u - hx) - (hs - r), 0);
  const dy = Math.max(Math.abs(v - hy) - (hs - r), 0);
  const d = Math.hypot(dx, dy);
  if (d < r + 0.018 && d >= r) col = [60, 40, 70];
  if (d < r) {
    col = [255, 214, 74];
    if (u - hx + (v - hy) * 0.2 > 0.18) col = [238, 190, 50];
    // ojos
    for (const ex of [0.4, 0.6]) {
      if (Math.hypot(u - ex, (v - 0.44) * 0.8) < 0.04) col = [40, 30, 50];
      if (Math.hypot(u - ex + 0.012, v - 0.425) < 0.012) col = [255, 255, 255];
    }
    // cachetes
    for (const cx of [0.33, 0.67]) if (Math.hypot(u - cx, v - 0.55) < 0.035) col = [255, 140, 170];
    // sonrisa
    const sd = Math.hypot(u - 0.5, v - 0.52);
    if (sd > 0.1 && sd < 0.13 && v > 0.55) col = [40, 30, 50];
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
