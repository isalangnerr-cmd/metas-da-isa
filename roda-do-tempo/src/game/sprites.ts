// Personagens originais em pixel art, montados por camadas (cabeça, cabelo, barba, óculos, roupa).
// Desenhados a partir das referências da família; tudo é personalizável no app.
import type { Avatar } from '@/data/types';

export type Grid = string[];
export type Palette = Record<string, string>;
export type CharKind = 'adult' | 'child' | 'pet';
export const OUTLINE = '#2B1D14';

export const SKINS = ['#F6D5C0', '#F3D0BB', '#E8B48C', '#C98E62', '#9A6440', '#6B4329'];
export const HAIRS = ['#C8642F', '#3B2418', '#5A3A22', '#8A5A2B', '#EBD3A0', '#1E1A18', '#A33B2A', '#8A8A8A'];
export const CLOTHES = ['#D9443A', '#E98A86', '#F08BB0', '#2E2B2B', '#5A5555', '#EFE6D2', '#4F8CC9', '#5FA77A', '#F2B544', '#8A5A7A', '#FFFFFF'];
export const SHOES = ['#D23B2E', '#2B2B2B', '#F4F1EA', '#4F8CC9', '#E0457B'];
export const FURS = ['#FAF6F0', '#E6C27A', '#C9924A', '#5A3A22', '#2B1D14', '#B9B9B9'];
export const PATCHES = ['#8C5A44', '#5A3A22', '#2B1D14', '#C9924A', '#FAF6F0'];
export const ADULT_HAIR = ['Longo', 'Careca', 'Curto', 'Coque'];
export const CHILD_HAIR = ['Rabinho', 'Curtinho', 'Maria-chiquinha'];
export const OUTFITS = ['Macacão', 'Camiseta e bermuda', 'Camiseta e calça'];
export const GLASSES = ['Sem óculos', 'Redondos'];
// compatibilidade com versões anteriores do editor
export const HAIR_STYLES = ADULT_HAIR; export const ACCESSORIES = GLASSES; export const SHIRTS = CLOTHES; export const PANTS = CLOTHES;

export const PRESETS: Record<string, { label: string; kind: CharKind; avatar: Avatar }> = {
  ruiva: { label: 'Ruiva de macacão', kind: 'adult', avatar: { skin: '#F6D5C0', hair: '#C8642F', hairStyle: 0, shirt: '#5A5555', pants: '#D9443A', accessory: 1, glasses: 1, glassesColor: '#7A3E1E', freckles: true, outfit: 0, striped: true, shoes: '#D23B2E' } },
  barba: { label: 'Careca de barba', kind: 'adult', avatar: { skin: '#F3D0BB', hair: '#3B2418', hairStyle: 1, shirt: '#2E2B2B', pants: '#EFE6D2', accessory: 1, beard: true, glasses: 1, glassesColor: '#77787C', outfit: 1, shoes: '#2B2B2B' } },
  pequena: { label: 'Pequena de rosa', kind: 'child', avatar: { skin: '#F8DCCB', hair: '#EBD3A0', hairStyle: 0, shirt: '#F08BB0', pants: '#F08BB0', accessory: 0, checkered: true, bow: '#E0457B' } },
  shihtzu: { label: 'Shih Tzu', kind: 'pet', avatar: { skin: '#FAF6F0', hair: '#8C5A44', hairStyle: 0, shirt: '#FAF6F0', pants: '#FAF6F0', accessory: 0 } },
};
export const DEFAULT_AVATARS: Record<'a' | 'b' | 'child' | 'pet', Avatar> = {
  a: PRESETS.ruiva.avatar, b: PRESETS.barba.avatar, child: PRESETS.pequena.avatar, pet: PRESETS.shihtzu.avatar,
};

// ---------- Adulto: 16 x 28 ----------
const HEAD: Grid = [
  '................', '......SSSS......', '....SSSSSSSS....', '...SSSSSSSSSS...', '...SSSSSSSSSS...', '...SSSSSSSSSS...',
  '..SSSSSSSSSSSS..', '..SSSESSSSESSS..', '..SSSSSSSSSSSS..', '..SSSSSSSSSSSS..', '...SSSSMMSSSS...', '....SSSSSSSS....', '......SSSS......',
];
const BODY_OVERALL: Grid = [
  '....TTTTTTTT....', '...TPPTTTTPPT...', '.STTPPTTTTPPTTS.', '.STTPPPPPPPPTTS.', '.SS.PpPpPpPp.SS.', '.SS.PpPPPPpP.SS.',
  '....PpPpPpPp....', '....PpPpPpPp....', '...PpPp..pPpP...', '...PpPp..pPpP...', '...PpPp..pPpP...', '...PpPp..pPpP...', '...PpPp..pPpP...',
  '...RRRR..RRRR...', '...WWWW..WWWW...',
];
const BODY_TEE: Grid = [
  '....TTTTTTTT....', '..TTTTTTTTTTTT..', '.TTTTTTTTTTTTTT.', '.TTTTTTTTTTTTTT.', '.TTTTTTTTTTTTTT.', '.SSTTTTTTTTTTSS.',
  '.SS.TTTTTTTT.SS.', '....CCCCCCCC....', '....CCCCCCCC....', '....CCC..CCC....', '....CCC..CCC....', '....SSS..SSS....', '....SSS..SSS....',
  '...RRRR..RRRR...', '...WWWW..WWWW...',
];
const HAIR_LONG: Grid = [
  '......HHHH......', '....HHHHHHHH....', '...HHHHhhHHHH...', '..HHHH....HHHH..', '..HHH......HHH..', '..HH........HH..',
  '..H..........H..', '..H..........H..', '..H..........H..', '..H..........H..', '..HH........HH..', '..HHH......HHH..', '..HHH......HHH..', '..HH........HH..',
];
const HAIR_SHORT: Grid = ['................', '.....HHHHHH.....', '....HHHHHHHH....', '...HHHHHHHHHH...', '...HH......HH...', '...H........H...'];
const HAIR_BUN: Grid = ['......HHHH......', '.....HHHHHH.....', '....HHHHHHHH....', '...HHHHHHHHHH...', '...HH......HH...', '...H........H...'];
const BEARD: Grid = [
  '..H..........H..', '..HH.HHHHHH.HH..', '..HHHHHMMHHHHH..', '...HHHHHHHHHH...', '....HHHHHHHH....', '......HHHH......',
];
const GLASSES_ROUND: Grid = ['....GGG..GGG....', '...G...GG...G...', '....GGG..GGG....'];
const FRECKLES: Grid = ['...F........F...', '....F......F....'];
const CAP: Grid = ['....QQQQQQQQ....', '...QQQQqqQQQQ...', '..QQQQQqqQQQQQ..', '..QQQQQQQQQQQQ..', '..XXXXXXXXXXXX..'];

// ---------- Criança: 12 x 17 ----------
const KID: Grid = [
  '............', '............', '...SSSSSS...', '..SSSSSSSS..', '..SSSSSSSS..', '.SSSSSSSSSS.', '.SSESSSSESS.', '.SFSSSSSSFS.',
  '..SSSMMSSS..', '...SSSSSS...', '..PPPPPPPP..', '.SPPwPPwPPS.', '.SPPPPPPPPS.', '..PPwPPwPP..', '...SS..SS...', '...SS..SS...', '..CXC..CXC..',
];
const KID_HAIR: Grid[] = [
  ['.....bb.....', '.....HH.....', '...HHHHHH...', '..HHHHHHHH..', '..H......H..'],
  ['............', '............', '...HHHHHH...', '..HHHHHHHH..', '..H......H..'],
  ['............', 'b..........b', 'HH.HHHHHH.HH', 'HHHHHHHHHHHH', '.HH......HH.', '.H........H.'],
];

// ---------- Cachorrinha ----------
export const DOG_FRONT: Grid = [
  '.....wwwwww.....', '....wwwwwwww....', '..DDwwwwwwwwDD..', '.DDDDwwwwwwDDDD.', '.DDDDDwwwwDDDDD.', 'DDDDLEwwwwELDDDD',
  'DDDDEEwwwwEEDDDD', 'DDDDDwwNNwwDDDDD', '.DDDwwwNNwwwDDD.', '.DDDwwwwwwwwDDD.', '..DDwwwMMwwwDD..', '...wwwwwwwwww...',
  '..wwwwwwwwwwww..', '..wwwwwwwwwwww..', '..wwDwwwwwwDww..', '..ww.ww..ww.ww..',
];
const DOG_SIDE: Grid = [
  '..........wwwww...', '.ww......wwwwwww..', 'wDDw....DDwwLEwww.', 'wDDw....DDwwEEwwwN', '.wDww...DDDwwwwwww', '..wwwwwwDDDwwwMww.',
  '..wwwwwwwDDwwwww..', '..wDDDwwwwwwwww...', '..wwwwwwwwwwwww...', '..wwwwwwwwwwwww...', '..ww.ww...ww.ww...', '..ww.ww...ww.ww...',
];
const DOG_SIDE_WALK: Grid = ['..wwwwwwwwwwwww...', '.ww..ww...ww..ww..', 'ww...ww..ww....ww.'];

function overlay(base: Grid, layer: Grid, y0: number, opaque = false): Grid {
  const out = base.slice();
  layer.forEach((row, i) => {
    const y = y0 + i; if (y < 0 || y >= out.length) return;
    const a = out[y].split('');
    row.split('').forEach((c, x) => { if (opaque || c !== '.') a[x] = c; });
    out[y] = a.join('');
  });
  return out;
}
/** Passo de caminhada: levanta uma das pernas (colunas [a,b]) um pixel. */
function step(g: Grid, a: number, b: number, from: number): Grid {
  const out = g.map((r) => r.split(''));
  for (let y = from; y < g.length; y++) for (let x = a; x <= b; x++) out[y][x] = y + 1 < g.length ? g[y + 1][x] : '.';
  return out.map((r) => r.join(''));
}

export function buildSprite(kind: CharKind, av: Avatar, frame = 0, view: 'front' | 'side' = 'side'): { grid: Grid; pal: Palette } {
  if (kind === 'pet') {
    const pal = { w: av.skin, D: av.hair, N: '#3B2116', E: '#3B2116', L: '#FFFFFF', M: '#C26C6C' };
    if (view === 'front') return { grid: DOG_FRONT, pal };
    return { grid: frame % 2 ? overlay(DOG_SIDE, DOG_SIDE_WALK, 9, true) : DOG_SIDE, pal };
  }
  if (kind === 'child') {
    let g = overlay(KID, KID_HAIR[av.hairStyle % KID_HAIR.length] || KID_HAIR[0], 0);
    if (frame % 2) g = step(g, 2, 5, 13);
    const pal: Palette = { S: av.skin, H: av.hair, b: av.bow || '#E0457B', E: '#2B1D14', M: '#C0584A', F: '#F7B5B5', P: av.shirt, w: '#FFFFFF',
      C: av.checkered === false ? (av.shoes || '#1E1E1E') : '#1E1E1E', X: av.checkered === false ? (av.shoes || '#1E1E1E') : '#FFFFFF' };
    return { grid: g, pal };
  }
  const outfit = av.outfit ?? (av.hairStyle === 1 ? 1 : 0);
  let g = [...HEAD, ...(outfit === 0 ? BODY_OVERALL : BODY_TEE)];
  if (outfit === 0 && av.striped === false) g = g.map((r) => r.replace(/p/g, 'P'));
  if (outfit === 2) g = g.map((r, y) => (y >= 24 && y <= 25 ? r.replace(/S/g, 'C') : r));
  const hs = av.hairStyle ?? 0;
  if (hs === 0) g = overlay(g, HAIR_LONG, 0); else if (hs === 2) g = overlay(g, HAIR_SHORT, 0); else if (hs === 3) g = overlay(g, HAIR_BUN, 0);
  if (av.freckles) g = overlay(g, FRECKLES, 8);
  if (av.beard) g = overlay(g, BEARD.map((r) => r.replace(/H/g, 'B')), 9);
  if ((av.glasses ?? 0) > 0) g = overlay(g, GLASSES_ROUND, 6);
  if (av.cap) g = overlay(g, CAP, 0);
  if (frame % 2) g = step(g, 3, 6, 20);
  const pal: Palette = {
    S: av.skin, H: av.hair, h: shade(av.hair), B: av.beardColor || av.hair, E: '#2B1D14', M: '#C0584A', F: '#D99474',
    G: av.glassesColor || '#77787C', T: av.shirt, P: av.pants, p: '#F7D3CC', C: av.pants, R: av.shoes || '#2B2B2B', W: '#F4F1EA',
    Q: av.capColor || '#E0457B', q: '#FFFFFF', X: shade(av.capColor || '#E0457B'),
  };
  return { grid: g, pal };
}

function shade(hex: string, k = 0.8) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** Células de contorno (fora do desenho, vizinhas a ele). */
export function outlineCells(grid: Grid): [number, number][] {
  const w = grid[0].length, h = grid.length, out: [number, number][] = [];
  const f = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && grid[y][x] !== '.';
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if (!f(x, y) && (f(x - 1, y) || f(x + 1, y) || f(x, y - 1) || f(x, y + 1))) out.push([x, y]);
  return out;
}

const cache = new Map<string, HTMLCanvasElement>();
/** Desenha uma grade em canvas (com contorno), usando cache por sprite. */
export function drawGrid(ctx: CanvasRenderingContext2D, grid: Grid, pal: Palette, x: number, y: number, s: number, flip = false) {
  const key = grid.join('|') + JSON.stringify(pal) + s;
  let c = cache.get(key);
  if (!c) {
    const w = grid[0].length, h = grid.length;
    c = document.createElement('canvas'); c.width = (w + 2) * s; c.height = (h + 2) * s;
    const g = c.getContext('2d')!;
    g.fillStyle = OUTLINE;
    for (const [ox, oy] of outlineCells(grid)) g.fillRect((ox + 1) * s, (oy + 1) * s, s, s);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = grid[j][i]; if (ch === '.' || !pal[ch]) continue; g.fillStyle = pal[ch]; g.fillRect((i + 1) * s, (j + 1) * s, s, s); }
    if (cache.size > 200) cache.clear();
    cache.set(key, c);
  }
  if (flip) { ctx.save(); ctx.translate(Math.round(x) + c.width - 2 * s, 0); ctx.scale(-1, 1); ctx.drawImage(c, -s, Math.round(y) - s); ctx.restore(); }
  else ctx.drawImage(c, Math.round(x) - s, Math.round(y) - s);
}
