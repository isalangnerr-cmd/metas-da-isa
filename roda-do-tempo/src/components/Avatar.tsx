import { buildSprite, DEFAULT_AVATARS, type CharKind } from '@/game/sprites';
import type { Avatar as Av, Member } from '@/data/types';
import { usePhoto } from '@/data/media';

export function Sprite({ kind, avatar, size = 40, frame = 0, flip = false, className = '' }: { kind: CharKind; avatar: Av; size?: number; frame?: number; flip?: boolean; className?: string }) {
  const { grid, pal } = buildSprite(kind, avatar, frame);
  const w = grid[0].length, h = grid.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} height={size} width={(size * w) / h} className={`pixelated ${className}`} shapeRendering="crispEdges" aria-hidden
      style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      {grid.flatMap((row, y) => row.split('').map((c, x) => (c === '.' || !pal[c]) ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={pal[c]} />))}
    </svg>
  );
}

export function avatarOf(m?: Member | null): Av {
  if (!m) return DEFAULT_AVATARS.a;
  const def = m.kind === 'pet' ? DEFAULT_AVATARS.pet : m.kind === 'child' ? DEFAULT_AVATARS.child : DEFAULT_AVATARS.a;
  return { ...def, ...(m.avatar || {}) };
}

export function MemberAvatar({ m, size = 40, ring = true, photo = false }: { m?: Member | null; size?: number; ring?: boolean; photo?: boolean }) {
  const url = usePhoto(photo ? m?.photo_path : null);
  return (
    <span className={`relative inline-grid place-items-end justify-center overflow-hidden rounded-[6px] shrink-0 ${ring ? 'border-[3px] border-line' : ''}`}
      style={{ width: size, height: size, background: m?.color ? `${m.color}33` : undefined }} title={m?.name}>
      {url ? <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" /> :
        <Sprite kind={(m?.kind || 'adult') as CharKind} avatar={avatarOf(m)} size={size * (m?.kind === 'pet' ? 0.62 : 0.86)} />}
    </span>
  );
}
