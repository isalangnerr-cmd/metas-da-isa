// Capas de aventura em pixel art (paisagens geradas, originais).
const SC: Record<string, { sky: string; sky2: string; ground: string; fg: string; sun: string; night?: boolean }> = {
  mountain: { sky: '#9CC3D3', sky2: '#C9E0E6', ground: '#5E7B3A', fg: '#8A5A3B', sun: '#E9B949' },
  beach: { sky: '#8CC6DA', sky2: '#D7EEF1', ground: '#E8CF94', fg: '#3E8BA8', sun: '#F1C75E' },
  city: { sky: '#E9B98F', sky2: '#F4D9B8', ground: '#7A6553', fg: '#4B3A2E', sun: '#F6E1A6' },
  house: { sky: '#BFD6C4', sky2: '#E3EEDF', ground: '#5E7B3A', fg: '#C2643C', sun: '#E9B949' },
  party: { sky: '#D8B1C9', sky2: '#F1DCE6', ground: '#8A5A7A', fg: '#E9B949', sun: '#FFF4DC' },
  forest: { sky: '#A9CBB0', sky2: '#DCEBD8', ground: '#3F5A2A', fg: '#2F4420', sun: '#F1C75E' },
  night: { sky: '#232A45', sky2: '#3B4266', ground: '#1E2A1E', fg: '#0F1A12', sun: '#F3E8D4', night: true },
};
export function Cover({ kind = 'mountain', className = '' }: { kind?: string; className?: string }) {
  const s = SC[kind] || SC.mountain;
  const R = (x: number, y: number, w: number, h: number, f: string, k?: string) => <rect key={k || `${x}-${y}-${w}-${f}`} x={x} y={y} width={w} height={h} fill={f} />;
  const els: JSX.Element[] = [R(0, 0, 64, 24, s.sky), R(0, 8, 64, 6, s.sky2)];
  els.push(R(48, 3, 5, 5, s.sun), R(47, 4, 7, 3, s.sun));
  if (s.night) for (let i = 0; i < 14; i++) els.push(R((i * 17) % 62, (i * 7) % 12, 1, 1, '#FFF4DC', 'st' + i));
  else els.push(R(8, 4, 9, 2, '#FFFFFF'), R(10, 3, 5, 1, '#FFFFFF'), R(28, 6, 8, 2, '#FFFFFF'));
  if (kind === 'mountain' || kind === 'night') for (let i = 0; i < 12; i++) { els.push(R(6 + i, 18 - i, 26 - 2 * i, 1, s.fg, 'm' + i)); els.push(R(30 + i, 19 - i * 0.8, 24 - 2 * i, 1, '#6B4A33', 'n' + i)); }
  if (kind === 'beach') { els.push(R(0, 16, 64, 3, s.fg), R(0, 15, 64, 1, '#BFE3EC')); els.push(R(10, 10, 1, 9, '#8A5A3B'), R(7, 9, 7, 1, '#5E7B3A'), R(8, 8, 5, 1, '#5E7B3A')); }
  if (kind === 'city') [[4, 9, 6], [12, 6, 5], [19, 11, 7], [28, 4, 6], [36, 8, 8], [46, 10, 5], [53, 7, 7]].forEach(([x, y, w], i) => { els.push(R(x, y, w, 20 - y, s.fg, 'b' + i)); for (let k = y + 2; k < 18; k += 3) els.push(R(x + 1, k, 1, 1, '#F6E1A6', `w${i}-${k}`), R(x + w - 2, k, 1, 1, '#F6E1A6', `v${i}-${k}`)); });
  if (kind === 'house') { els.push(R(22, 11, 18, 8, '#F3E8D4'), R(20, 10, 22, 1, s.fg), R(22, 9, 18, 1, s.fg), R(24, 8, 14, 1, s.fg), R(27, 7, 8, 1, s.fg), R(29, 14, 4, 5, '#8A5A3B'), R(35, 13, 3, 3, '#6E9FB5'), R(24, 13, 3, 3, '#6E9FB5')); }
  if (kind === 'party') for (let i = 0; i < 10; i++) { els.push(R(4 + i * 6, 2 + (i % 2), 3, 3, ['#C2643C', '#5E7B3A', '#E9B949', '#6E9FB5'][i % 4], 'f' + i)); els.push(R(5 + i * 6, 5 + (i % 2), 1, 1, '#3A2A1E', 'g' + i)); }
  if (kind === 'forest') for (let i = 0; i < 9; i++) { const x = 2 + i * 7; els.push(R(x + 2, 15, 2, 4, '#5A3A22', 't' + i), R(x, 11 - (i % 3), 6, 5 + (i % 3), s.fg, 'c' + i), R(x + 1, 9 - (i % 3), 4, 2, s.fg, 'd' + i)); }
  els.push(R(0, 19, 64, 5, s.ground), R(0, 19, 64, 1, '#00000022'));
  return <svg viewBox="0 0 64 24" preserveAspectRatio="xMidYMid slice" className={`pixelated ${className}`} shapeRendering="crispEdges" aria-hidden>{els}</svg>;
}
