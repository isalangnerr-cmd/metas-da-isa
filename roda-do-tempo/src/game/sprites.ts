// Sprites originais em pixel art, gerados a partir de grades de caracteres.
import type { Avatar } from '@/data/types';

export type Grid = string[];
export type Palette = Record<string, string>;

export const SKINS = ['#F6D3B3', '#E8B48C', '#C98E62', '#9A6440', '#6B4329'];
export const HAIRS = ['#2B1D14', '#5A3A22', '#8A5A2B', '#C9924A', '#E6C27A', '#A33B2A', '#6B6B6B'];
export const SHIRTS = ['#C2643C', '#5E7B3A', '#E9B949', '#6E9FB5', '#8A5A7A', '#3A2A1E', '#F3E8D4'];
export const PANTS = ['#3A2A1E', '#4B5D73', '#5E7B3A', '#8A5A3B', '#2E2E3A'];
export const HAIR_STYLES = ['Curto', 'Longo', 'Coque', 'Cacheado', 'Careca'];
export const ACCESSORIES = ['Nada', 'Óculos', 'Boné', 'Laço', 'Flor'];

export const DEFAULT_AVATARS: Record<string, Avatar> = {
  a: { skin: SKINS[1], hair: HAIRS[1], hairStyle: 1, shirt: SHIRTS[0], pants: PANTS[1], accessory: 0 },
  b: { skin: SKINS[1], hair: HAIRS[0], hairStyle: 0, shirt: SHIRTS[1], pants: PANTS[0], accessory: 1 },
  child: { skin: SKINS[0], hair: HAIRS[3], hairStyle: 2, shirt: SHIRTS[2], pants: PANTS[2], accessory: 3 },
  pet: { skin: '#C9924A', hair: '#8A5A2B', hairStyle: 0, shirt: '#C2643C', pants: '#3A2A1E', accessory: 0 },
};

// Adulto: 12x18. Letras: S pele, E olho, M boca, T camisa, P calça, B sapato, O contorno escuro
const ADULT_BODY: Grid = [
  '............',
  '............',
  '............',
  '...SSSSSS...',
  '..SSSSSSSS..',
  '..SESSSSES..',
  '..SSSSSSSS..',
  '...SSMMSS...',
  '....SSSS....',
  '..TTTTTTTT..',
  '.TTTTTTTTTT.',
  '.STTTTTTTTS.',
  '.S.TTTTTT.S.',
  '...PPPPPP...',
  '...PP..PP...',
  '...PP..PP...',
  '..BBB..BBB..',
  '............',
];
const ADULT_WALK: Grid = [
  '...PPPPPP...',
  '..PP....PP..',
  '.PP......PP.',
  'BBB......BBB',
];
const ADULT_HAIR: Grid[] = [
  ['....HHHH....', '...HHHHHH...', '..HHHHHHHH..', '..H......H..'],
  ['....HHHH....', '...HHHHHH...', '..HHHHHHHH..', '.HH......HH.', '.H........H.', '.H........H.', '.H........H.', '.HH......HH.', '..H......H..'],
  ['.....HH.....', '....HHHH....', '...HHHHHH...', '..HHHHHHHH..', '..H......H..'],
  ['...H.HH.H...', '..HHHHHHHH..', '.HHHHHHHHHH.', '.HH......HH.', '.H........H.'],
  ['............', '............', '............', '............'],
];

// Criança: 10x14
const CHILD_BODY: Grid = [
  '..........',
  '..........',
  '..SSSSSS..',
  '.SSSSSSSS.',
  '.SESSSSES.',
  '.SSSSSSSS.',
  '..SSMMSS..',
  '..TTTTTT..',
  '.STTTTTTS.',
  '..TTTTTT..',
  '..PPPPPP..',
  '..PP..PP..',
  '.BBB..BBB.',
  '..........',
];
const CHILD_WALK: Grid = ['..PPPPPP..', '.PP....PP.', 'BBB....BBB'];
const CHILD_HAIR: Grid[] = [
  ['...HHHH...', '..HHHHHH..', '.HH....HH.'],
  ['...HHHH...', '..HHHHHH..', '.HHHHHHHH.', 'HH......HH', 'H........H', 'H........H', 'HH......HH'],
  ['H..HHHH..H', 'HHHHHHHHHH', '.HHHHHHHH.', '.H......H.'],
  ['..H.HH.H..', '.HHHHHHHH.', 'HHHHHHHHHH', 'HH......HH'],
  ['..........', '...HH.....', '..........'],
];

// Cachorrinha: 14x10, olhando para a direita. F pelo, D orelha/manchas, N nariz, E olho, C coleira
export const DOG: Grid = [
  '..............',
  '..........DD..',
  '.........DFFD.',
  '.........FFEFN',
  'D........FFFFF',
  '.D.FFFFFFCCFF.',
  '..FFFFFFFFFF..',
  '..FFFFFFFFFF..',
  '..FF.FF..FF.F.',
  '..DD.DD..DD...',
];
export const DOG_WALK: Grid = [
  '..FFFFFFFFFF..',
  '.FF..FF.FF..F.',
  '.DD...DD.DD...',
];

const ACC_ADULT: Record<number, { y: number; rows: Grid }> = {
  1: { y: 5, rows: ['..GGGGGGGG..'] },
  2: { y: 1, rows: ['...CCCCCC...', '..CCCCCCCCCC'] },
  3: { y: 1, rows: ['........RR.R', '.........RR.', '........R..R'] },
  4: { y: 2, rows: ['.........YY.', '........YRY.', '.........YY.'] },
};
const ACC_CHILD: Record<number, { y: number; rows: Grid }> = {
  1: { y: 4, rows: ['.GGGGGGGG.'] },
  2: { y: 0, rows: ['..CCCCCC..', '.CCCCCCCCC'] },
  3: { y: 0, rows: ['......RR.R', '.......RR.', '......R..R'] },
  4: { y: 1, rows: ['.......YY.', '......YRY.', '.......YY.'] },
};

function overlay(base: Grid, layer: Grid, y0: number, skipEmpty = true): Grid {
  const out = base.slice();
  layer.forEach((row, i) => {
    const y = y0 + i;
    if (y < 0 || y >= out.length) return;
    const chars = out[y].split('');
    row.split('').forEach((c, x) => { if (!skipEmpty || c !== '.') chars[x] = c; });
    out[y] = chars.join('');
  });
  return out;
}

export type CharKind = 'adult' | 'child' | 'pet';
export function buildSprite(kind: CharKind, av: Avatar, frame = 0): { grid: Grid; pal: Palette } {
  const pal: Palette = {
    S: av.skin, H: av.hair, T: av.shirt, P: av.pants, B: '#2B1D14', E: '#2B1D14', M: '#B5543A',
    G: '#2B1D14', C: av.shirt, R: '#C2643C', Y: '#E9B949', O: '#2B1D14',
  };
  if (kind === 'pet') {
    const grid = frame % 2 ? overlay(DOG, DOG_WALK, 7, false) : DOG;
    return { grid, pal: { F: av.skin, D: av.hair, N: '#2B1D14', E: '#2B1D14', C: av.shirt } };
  }
  const adult = kind === 'adult';
  let g = adult ? ADULT_BODY : CHILD_BODY;
  const hairs = adult ? ADULT_HAIR : CHILD_HAIR;
  const hair = hairs[av.hairStyle % hairs.length];
  g = overlay(g, hair, adult ? 0 : 0);
  if (frame % 2) g = overlay(g, adult ? ADULT_WALK : CHILD_WALK, adult ? 13 : 10, false);
  const acc = (adult ? ACC_ADULT : ACC_CHILD)[av.accessory];
  if (acc) { g = overlay(g, acc.rows, acc.y); }
  return { grid: g, pal };
}

/** Desenha uma grade em canvas (para o jogo). */
export function drawGrid(ctx: CanvasRenderingContext2D, grid: Grid, pal: Palette, x: number, y: number, s: number, flip = false) {
  const w = grid[0].length;
  for (let j = 0; j < grid.length; j++) {
    const row = grid[j];
    for (let i = 0; i < w; i++) {
      const c = row[flip ? w - 1 - i : i];
      if (c === '.' || !pal[c]) continue;
      ctx.fillStyle = pal[c];
      ctx.fillRect(Math.round(x + i * s), Math.round(y + j * s), Math.ceil(s), Math.ceil(s));
    }
  }
}
