// Genera las portadas de los juegos tomando una captura del juego real.
// Uso: con `npm run dev` corriendo →  node scripts/make-thumbs.mjs [url] [ruta-a-chrome-o-edge]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5199';
const exe = process.argv[3] ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const games = ['obby', 'stars'];

mkdirSync('public/thumbs', { recursive: true });
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 560, height: 560 } });
for (const g of games) {
  await page.goto(`${url}/?thumb=${g}`);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `public/thumbs/${g}.jpg`, type: 'jpeg', quality: 86 });
  console.log('ok', g);
}
await browser.close();
