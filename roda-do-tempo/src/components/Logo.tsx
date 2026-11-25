// Logotipo original: uma roda (de carroça/relógio) em pixel art com ponteiro e estrela.
export function logoGrid(n = 16): string[] {
  const c = (n - 1) / 2, out: string[] = [];
  for (let y = 0; y < n; y++) {
    let row = '';
    for (let x = 0; x < n; x++) {
      const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const spoke = Math.abs(Math.sin(ang * 4)) < 0.28;
      if (d > c + 0.5) row += '.';
      else if (d > c - 1) row += 'O';
      else if (d > c - 2.2) row += 'Y';
      else if (d > c - 2.9) row += 'O';
      else if (d < 1.3) row += 'H';
      else if (x >= Math.floor(c) && x <= Math.ceil(c) && y < c && y > 2.5) row += 'T';
      else if (spoke) row += 'B';
      else row += 'C';
    }
    out.push(row);
  }
  return out;
}
const PAL: Record<string, string> = { O: '#3A2A1E', Y: '#E9B949', H: '#3A2A1E', T: '#C2643C', B: '#8A5A3B', C: '#FFF4DC' };

export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  const g = logoGrid(16);
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={`pixelated ${className}`} shapeRendering="crispEdges" aria-hidden>
      {g.flatMap((row, y) => row.split('').map((ch, x) => ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={PAL[ch]} />))}
      {/* estrelinha */}
      <rect x={12} y={0} width={1} height={3} fill="#E9B949" /><rect x={11} y={1} width={3} height={1} fill="#E9B949" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <LogoMark size={compact ? 32 : 40} />
      <div className="leading-none">
        <div className="h-pixel text-[20px] font-bold tracking-wide">Roda do Tempo</div>
        {!compact && <div className="hud text-[9px] text-muted mt-1">Mesmo time · dentro e fora do jogo</div>}
      </div>
    </div>
  );
}
