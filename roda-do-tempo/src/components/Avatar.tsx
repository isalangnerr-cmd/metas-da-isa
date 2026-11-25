import { buildSprite, DEFAULT_AVATARS, outlineCells, OUTLINE, type CharKind } from '@/game/sprites';
import type { Avatar as Av, Member } from '@/data/types';
import { usePhoto } from '@/data/media';

export function Sprite({ kind, avatar, size = 40, frame = 0, flip = false, view = 'front', className = '' }: { kind: CharKind; avatar: Av; size?: number; frame?: number; flip?: boolean; view?: 'front' | 'side'; className?: string }) {
  const { grid, pal } = buildSprite(kind, avatar, frame, view);
  const w = grid[0].length + 2, h = grid.length + 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} height={size} width={(size * w) / h} className={`pixelated ${className}`} shapeRendering="crispEdges" aria-hidden
      style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      {outlineCells(grid).map(([x, y]) => <rect key={`o${x}-${y}`} x={x + 1} y={y + 1} width={1.02} height={1.02} fill={OUTLINE} />)}
      {grid.flatMap((row, y) => row.split('').map((c, x) => (c === '.' || !pal[c]) ? null : <rect key={`${x}-${y}`} x={x + 1} y={y + 1} width={1.02} height={1.02} fill={pal[c]} />))}
    </svg>
  );
}

export function avatarOf(m?: Member | null): Av {
  if (!m) return DEFAULT_AVATARS.a;
  const def = m.kind === 'pet' ? DEFAULT_AVATARS.pet : m.kind === 'child' ? DEFAULT_AVATARS.child : DEFAULT_AVATARS.a;
  return { ...def, ...(m.avatar || {}) };
}

/** Avatar: só o rosto (recortado) em um quadradinho arredondado. */
export function MemberAvatar({ m, size = 40, ring = true, photo = false }: { m?: Member | null; size?: number; ring?: boolean; photo?: boolean }) {
  const url = usePhoto(photo ? m?.photo_path : null);
  const kind = (m?.kind || 'adult') as CharKind;
  // mostra cabeça e ombros: o sprite é ampliado e alinhado ao topo
  const scale = kind === 'adult' ? 2.05 : kind === 'child' ? 1.45 : 1.05;
  return (
    <span className={`relative inline-block overflow-hidden rounded-xl shrink-0 ${ring ? 'ring-2 ring-panel' : ''}`}
      style={{ width: size, height: size, background: m?.color ? `${m.color}2e` : 'rgb(var(--panel2))' }} title={m?.name}>
      {url ? <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" /> : (
        <span className="absolute left-1/2 -translate-x-1/2" style={{ top: kind === 'pet' ? size * 0.04 : size * 0.06 }}>
          <Sprite kind={kind} avatar={avatarOf(m)} size={size * scale * (kind === 'pet' ? 0.9 : 1)} view="front" />
        </span>
      )}
    </span>
  );
}
