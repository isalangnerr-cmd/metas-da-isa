// Gera os ícones PNG do PWA a partir do logotipo em pixel art (usa o Chromium do Playwright).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync } from 'node:fs';
const n = 16, c = (n - 1) / 2, rows = [];
for (let y = 0; y < n; y++) { let r = ''; for (let x = 0; x < n; x++) {
  const dx = x - c, dy = y - c, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), spoke = Math.abs(Math.sin(ang * 4)) < 0.28;
  r += d > c + 0.5 ? '.' : d > c - 1 ? 'O' : d > c - 2.2 ? 'Y' : d > c - 2.9 ? 'O' : d < 1.3 ? 'H' : (x >= Math.floor(c) && x <= Math.ceil(c) && y < c && y > 2.5) ? 'T' : spoke ? 'B' : 'C';
} rows.push(r); }
const PAL = { O: '#3A2A1E', Y: '#E9B949', H: '#3A2A1E', T: '#C2643C', B: '#8A5A3B', C: '#FFF4DC' };
const svg = (size, pad, bg) => {
  const k = (size - pad * 2) / n; let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${bg}"/>`;
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') s += `<rect x="${pad + x * k}" y="${pad + y * k}" width="${k + 0.5}" height="${k + 0.5}" fill="${PAL[ch]}"/>`; }));
  s += `<rect x="${pad + 12 * k}" y="${pad}" width="${k}" height="${3 * k}" fill="#E9B949"/><rect x="${pad + 11 * k}" y="${pad + k}" width="${3 * k}" height="${k}" fill="#E9B949"/>`;
  return s + '</svg>';
};
const b = await chromium.launch(); const p = await b.newPage();
for (const [name, size, pad] of [['icon-192', 192, 16], ['icon-512', 512, 40], ['icon-maskable-512', 512, 104], ['apple-touch-icon', 180, 18]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0">${svg(size, pad, '#F6EFE1')}</body></html>`);
  writeFileSync(`public/icons/${name}.png`, await p.screenshot({ omitBackground: false }));
}
await b.close();
console.log('ícones gerados');
