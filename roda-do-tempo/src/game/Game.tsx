// Minigame de plataforma 2D (canvas), leve e opcional.
// Estrelas do jogo são contadas à parte das estrelas reais da família.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildSprite, drawGrid, DEFAULT_AVATARS } from './sprites';
import type { Member } from '@/data/types';
import { avatarOf } from '@/components/Avatar';
import { Icon, chime } from '@/components/ui';
import { nowParts } from '@/lib/dates';

const S = 3; // escala do pixel
const W = 760; // largura do mundo (px lógicos)
const H = 84;  // altura lógica
const GROUND = 70;

export interface POI { x: number; w: number; label: string; to: string; kind: string }
const POIS: POI[] = [
  { x: 40, w: 46, label: 'Nossa família', to: '/familia', kind: 'house' },
  { x: 112, w: 14, label: 'Correio', to: '/correio', kind: 'mailbox' },
  { x: 160, w: 22, label: 'Missões', to: '/missoes', kind: 'board' },
  { x: 230, w: 18, label: 'Inventário', to: '/inventario', kind: 'chest' },
  { x: 300, w: 26, label: 'Mini player', to: '/mini-player', kind: 'swing' },
  { x: 390, w: 20, label: 'Estrelas', to: '/estrelas', kind: 'well' },
  { x: 470, w: 12, label: 'Checkpoints', to: '/checkpoints', kind: 'flag' },
  { x: 560, w: 18, label: 'Aventuras', to: '/aventuras', kind: 'sign' },
];
const PLATFORMS = [
  { x: 130, y: 52, w: 26 }, { x: 196, y: 44, w: 22 }, { x: 262, y: 50, w: 24 }, { x: 340, y: 40, w: 28 },
  { x: 430, y: 48, w: 24 }, { x: 505, y: 38, w: 22 }, { x: 600, y: 46, w: 30 }, { x: 670, y: 34, w: 24 },
];
const starSpots = () => [
  ...PLATFORMS.map((p) => ({ x: p.x + p.w / 2 - 2, y: p.y - 10 })),
  { x: 96, y: 48 }, { x: 375, y: 26 }, { x: 640, y: 22 }, { x: 720, y: 56 },
].map((s) => ({ ...s, got: false, t: Math.random() * 6 }));

interface Props { members: Member[]; unlocked: string[]; onStar: () => void; sounds: boolean; reduceMotion: boolean }

export function Game({ members, unlocked, onStar, sounds, reduceMotion }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const playable = members.filter((m) => m.kind !== 'pet');
  const [who, setWho] = useState<string>(() => { try { return localStorage.getItem('rdt:game:who') || ''; } catch { return ''; } });
  const [near, setNear] = useState<POI | null>(null);
  const [focused, setFocused] = useState(false);
  const input = useRef({ l: false, r: false, jump: false, act: false });
  const cb = useRef({ onStar, sounds, nav }); cb.current = { onStar, sounds, nav };
  const player = playable.find((m) => m.id === who) || playable[0];

  useEffect(() => {
    const c = canvas.current!, ctx = c.getContext('2d')!;
    let raf = 0, last = performance.now(), visible = true, vw = 320;
    const p = { x: 70, y: GROUND - 18, vx: 0, vy: 0, onGround: true, face: 1, frame: 0, ft: 0 };
    const dog = { x: 50, face: 1, frame: 0 };
    const stars = starSpots();
    const sparks: { x: number; y: number; t: number }[] = [];
    let cam = 0, respawn = 0;
    const npcs = members.filter((m) => m.id !== player?.id && m.kind !== 'pet').map((m, i) => ({ m, x: 20 + i * 14, dir: 1, t: Math.random() * 100 }));
    const pet = members.find((m) => m.kind === 'pet');
    const { hour } = nowParts();
    const night = hour >= 19 || hour < 6;
    const dusk = hour >= 17 && hour < 19;

    const resize = () => {
      const w = wrap.current!.clientWidth; vw = Math.min(W, Math.ceil(w / S));
      c.width = vw * S; c.height = H * S; c.style.width = `${vw * S}px`; c.style.height = `${H * S}px`;
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(wrap.current!);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { last = performance.now(); loop(last); } }, { threshold: 0.05 });
    io.observe(c);

    const R = (x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(Math.round((x - cam) * S), Math.round(y * S), Math.ceil(w * S), Math.ceil(h * S)); };
    const RS = (x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x * S), Math.round(y * S), Math.ceil(w * S), Math.ceil(h * S)); };
    const star = (x: number, y: number, col = '#E9B949') => { R(x + 2, y, 1, 5, col); R(x, y + 2, 5, 1, col); R(x + 1, y + 1, 3, 3, col); R(x + 2, y + 2, 1, 1, '#FFF4DC'); };

    const drawPOI = (o: POI, t: number) => {
      const g = GROUND;
      switch (o.kind) {
        case 'house':
          R(o.x, g - 28, 46, 28, '#F3E8D4'); R(o.x - 3, g - 31, 52, 3, '#8A3F26'); R(o.x, g - 34, 46, 3, '#A84B2E'); R(o.x + 4, g - 37, 38, 3, '#A84B2E'); R(o.x + 10, g - 40, 26, 3, '#B5543A');
          R(o.x + 34, g - 44, 5, 8, '#7A6553'); R(o.x + 19, g - 14, 9, 14, '#8A5A3B'); R(o.x + 26, g - 7, 1, 1, '#E9B949');
          R(o.x + 5, g - 22, 9, 8, night ? '#F1C75E' : '#6E9FB5'); R(o.x + 32, g - 22, 9, 8, night ? '#F1C75E' : '#6E9FB5'); R(o.x + 9, g - 22, 1, 8, '#3A2A1E'); R(o.x + 36, g - 22, 1, 8, '#3A2A1E');
          if (unlocked.includes('flowers')) for (let i = 0; i < 6; i++) { R(o.x + 2 + i * 7, g - 3, 1, 3, '#5E7B3A'); R(o.x + 1 + i * 7, g - 5, 3, 2, ['#C2643C', '#E9B949', '#8A5A7A'][i % 3]); }
          break;
        case 'mailbox': R(o.x + 6, g - 12, 2, 12, '#5A3A22'); R(o.x, g - 20, 14, 9, unlocked.includes('mailbox') ? '#B5543A' : '#6E9FB5'); R(o.x, g - 20, 14, 2, '#3A2A1E'); R(o.x + 12, g - 26, 1, 7, '#3A2A1E'); R(o.x + 12, g - 26, 4, 3, '#C2643C'); break;
        case 'board': R(o.x + 2, g - 16, 2, 16, '#5A3A22'); R(o.x + 18, g - 16, 2, 16, '#5A3A22'); R(o.x, g - 26, 22, 12, '#8A5A3B'); R(o.x + 3, g - 24, 6, 4, '#F3E8D4'); R(o.x + 11, g - 23, 7, 5, '#F3E8D4'); R(o.x + 5, g - 19, 5, 3, '#F3E8D4'); R(o.x + 6, g - 25, 1, 1, '#C2643C'); break;
        case 'chest': R(o.x, g - 10, 18, 10, '#8A5A3B'); R(o.x, g - 13, 18, 4, '#A06B45'); R(o.x, g - 10, 18, 1, '#3A2A1E'); R(o.x + 8, g - 10, 3, 4, '#E9B949'); break;
        case 'swing': R(o.x - 6, g - 46, 6, 46, '#6B4A33'); R(o.x - 18, g - 62, 44, 20, '#5E7B3A'); R(o.x - 12, g - 68, 32, 8, '#6E8E44');
          if (unlocked.includes('treehouse')) { R(o.x - 14, g - 58, 14, 10, '#C2643C'); R(o.x - 16, g - 60, 18, 2, '#8A3F26'); R(o.x - 9, g - 54, 4, 6, '#3A2A1E'); }
          { const sw = reduceMotion ? 0 : Math.sin(t / 600) * 2; R(o.x + 6 + sw, g - 42, 1, 30, '#3A2A1E'); R(o.x + 18 + sw, g - 42, 1, 30, '#3A2A1E'); R(o.x + 4 + sw, g - 12, 17, 2, '#8A5A3B'); }
          break;
        case 'well': R(o.x, g - 10, 20, 10, '#9A8A7A'); R(o.x, g - 10, 20, 2, '#7A6553'); R(o.x + 2, g - 28, 2, 18, '#5A3A22'); R(o.x + 16, g - 28, 2, 18, '#5A3A22'); R(o.x - 1, g - 31, 22, 4, '#B5543A'); R(o.x + 9, g - 26, 1, 10, '#3A2A1E'); star(o.x + 7, g - 40 + (reduceMotion ? 0 : Math.sin(t / 400) * 1.5)); break;
        case 'flag': R(o.x + 5, g - 40, 2, 40, '#7A6553'); R(o.x + 7, g - 40, 12, 8, unlocked.includes('flag') ? '#C2643C' : '#5E7B3A'); R(o.x + 10, g - 38, 3, 3, '#F3E8D4'); break;
        case 'sign': R(o.x + 8, g - 20, 2, 20, '#5A3A22'); R(o.x, g - 26, 18, 6, '#8A5A3B'); R(o.x + 18, g - 25, 2, 4, '#8A5A3B'); R(o.x + 3, g - 24, 10, 1, '#F3E8D4'); R(o.x + 2, g - 16, 14, 5, '#8A5A3B'); R(o.x - 1, g - 15, 2, 3, '#8A5A3B'); break;
      }
    };

    const loop = (now: number) => {
      if (!visible) return;
      const dt = Math.min(2.5, (now - last) / 16.67); last = now;
      const inp = input.current;
      // física
      const speed = 1.4;
      p.vx = (inp.r ? speed : 0) - (inp.l ? speed : 0);
      if (p.vx) p.face = p.vx > 0 ? 1 : -1;
      if (inp.jump && p.onGround) { p.vy = -5.2; p.onGround = false; if (cb.current.sounds) chime('jump'); }
      inp.jump = false;
      p.vy += 0.32 * dt; if (p.vy > 6) p.vy = 6;
      const prevBottom = p.y + 18;
      p.x = Math.max(0, Math.min(W - 12, p.x + p.vx * dt)); p.y += p.vy * dt;
      p.onGround = false;
      const bottom = p.y + 18;
      if (bottom >= GROUND) { p.y = GROUND - 18; p.vy = 0; p.onGround = true; }
      else if (p.vy >= 0) for (const pl of PLATFORMS) {
        if (p.x + 9 > pl.x && p.x + 3 < pl.x + pl.w && prevBottom <= pl.y + 0.5 && bottom >= pl.y) { p.y = pl.y - 18; p.vy = 0; p.onGround = true; }
      }
      p.ft += Math.abs(p.vx) * dt; if (p.ft > 6) { p.ft = 0; p.frame++; }
      // cachorrinha segue
      const target = p.x - p.face * 16;
      if (Math.abs(dog.x - target) > 4) { const d = Math.sign(target - dog.x); dog.x += d * 1.2 * dt; dog.face = d; dog.frame = Math.floor(now / 120); } else dog.frame = 0;
      for (const n of npcs) { n.t += dt; if (n.t > 140) { n.t = 0; n.dir = Math.random() < 0.5 ? -1 : 1; } if (n.t < 50) n.x = Math.max(4, Math.min(108, n.x + n.dir * 0.3 * dt)); }
      // estrelas
      for (const s of stars) if (!s.got && p.x + 10 > s.x && p.x + 2 < s.x + 5 && p.y < s.y + 5 && p.y + 18 > s.y) {
        s.got = true; sparks.push({ x: s.x, y: s.y, t: 0 }); cb.current.onStar(); if (cb.current.sounds) chime('coin');
      }
      if (stars.every((s) => s.got)) { respawn += dt; if (respawn > 400) { stars.forEach((s) => (s.got = false)); respawn = 0; } }
      // proximidade
      const cx = p.x + 6;
      const n = POIS.find((o) => cx > o.x - 6 && cx < o.x + o.w + 6) || null;
      setNear((cur) => (cur?.to === n?.to ? cur : n));
      if (inp.act) { inp.act = false; if (n) cb.current.nav(n.to); }
      // câmera
      cam = Math.max(0, Math.min(W - vw, p.x - vw / 2 + 6));

      // ---- desenho ----
      const sky = night ? ['#1E2440', '#2C3358', '#3B4266'] : dusk ? ['#E9A273', '#F1C49A', '#F6DDBC'] : ['#9CC3D3', '#B6D4DE', '#D3E6E8'];
      RS(0, 0, vw, 30, sky[0]); RS(0, 30, vw, 16, sky[1]); RS(0, 46, vw, 30, sky[2]);
      if (unlocked.includes('rainbow') && !night) ['#C2643C', '#E9B949', '#5E7B3A', '#6E9FB5'].forEach((col, i) => { for (let k = 0; k < 40; k++) { const a = Math.PI * (k / 39); RS(vw * 0.7 + Math.cos(a) * (30 - i * 2) - cam * 0.05, 52 - Math.sin(a) * (30 - i * 2), 2, 2, col); } });
      if (night) { for (let i = 0; i < 40; i++) { const x = (i * 53) % vw, y = (i * 29) % 40; if (reduceMotion || (Math.floor(now / 500) + i) % 7) RS(x, y, 1, 1, '#FFF4DC'); } RS(vw - 30, 8, 8, 8, '#F3E8D4'); RS(vw - 28, 8, 6, 6, '#2C3358'); }
      else { RS(vw - 28, 7, 9, 9, '#F1C75E'); RS(vw - 30, 9, 13, 5, '#F1C75E'); }
      // nuvens (parallax)
      if (!night) for (let i = 0; i < 5; i++) { const x = ((i * 170 - cam * 0.3 + (reduceMotion ? 0 : now / 400)) % (vw + 60) + vw + 60) % (vw + 60) - 40; RS(x, 10 + i * 5, 20, 4, '#FFFFFF'); RS(x + 4, 7 + i * 5, 11, 3, '#FFFFFF'); }
      // colinas
      for (let x = 0; x < vw; x++) { const hx = x + cam * 0.5; const h = 12 + Math.sin(hx / 40) * 5 + Math.sin(hx / 17) * 2; RS(x, GROUND - h, 1, h, night ? '#26382A' : '#86A866'); }
      // árvores ao fundo
      for (let i = 0; i < 12; i++) { const x = i * 70 + 20; if (x - cam < -20 || x - cam > vw + 20) continue; R(x + 4, GROUND - 14, 3, 14, '#5A3A22'); R(x, GROUND - 26, 11, 13, night ? '#2F4420' : '#5E7B3A'); R(x + 2, GROUND - 29, 7, 4, night ? '#2F4420' : '#6E8E44'); }
      // chão
      R(0, GROUND, W, H - GROUND, night ? '#4A3424' : '#8A5A3B'); R(0, GROUND, W, 3, night ? '#3F5A2A' : '#5E7B3A');
      for (let x = 0; x < W; x += 6) R(x, GROUND + 6 + ((x / 6) % 2) * 4, 2, 1, '#00000022');
      // POIs
      for (const o of POIS) drawPOI(o, now);
      if (unlocked.includes('lantern')) { R(705, GROUND - 22, 2, 22, '#3A2A1E'); R(702, GROUND - 28, 8, 7, night ? '#F1C75E' : '#E9B949'); }
      // plataformas
      for (const pl of PLATFORMS) { R(pl.x, pl.y, pl.w, 4, '#8A5A3B'); R(pl.x, pl.y, pl.w, 2, '#5E7B3A'); R(pl.x, pl.y + 4, pl.w, 1, '#00000033'); }
      // estrelas
      for (const s of stars) if (!s.got) star(s.x, s.y + (reduceMotion ? 0 : Math.sin(now / 300 + s.t) * 1.2));
      for (const k of sparks) { k.t += dt; const r = k.t * 0.6; R(k.x + 2 - r, k.y + 2, 1, 1, '#E9B949'); R(k.x + 2 + r, k.y + 2, 1, 1, '#E9B949'); R(k.x + 2, k.y + 2 - r, 1, 1, '#E9B949'); }
      while (sparks.length && sparks[0].t > 20) sparks.shift();
      if (unlocked.includes('fireflies') && night) for (let i = 0; i < 10; i++) RS((i * 77 + now / 50 * (i % 2 ? 1 : -1)) % vw, 40 + Math.sin(now / 500 + i) * 10, 1, 1, '#F1F17A');
      // NPCs
      for (const n of npcs) { const { grid, pal } = buildSprite(n.m.kind as any, avatarOf(n.m), 0); drawGrid(ctx, grid, pal, (n.x - cam) * S, (GROUND - grid.length) * S, S, n.dir < 0); }
      // cachorrinha
      { const { grid, pal } = buildSprite('pet', pet ? avatarOf(pet) : DEFAULT_AVATARS.pet, dog.frame); drawGrid(ctx, grid, pal, (dog.x - cam) * S, (GROUND - grid.length) * S, S, dog.face < 0); }
      // jogador
      if (player) { const kind = player.kind as any; const { grid, pal } = buildSprite(kind, avatarOf(player), p.onGround && p.vx ? p.frame : p.onGround ? 0 : 1); drawGrid(ctx, grid, pal, (p.x - cam) * S, (p.y + 18 - grid.length) * S, S, p.face < 0); }
      // balão de interação
      if (n) { const bx = Math.max(2, Math.min(vw - 60, n.x + n.w / 2 - 30 - cam)); RS(bx, 2, 60, 10, '#FFF9EE'); ctx.strokeStyle = '#3A2A1E'; ctx.lineWidth = S; ctx.strokeRect(bx * S, 2 * S, 60 * S, 10 * S); ctx.fillStyle = '#3A2A1E'; ctx.font = `${S * 5}px Silkscreen, monospace`; ctx.textAlign = 'center'; ctx.fillText(n.label.toUpperCase(), (bx + 30) * S, 9.2 * S); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); visible = false; };
  }, [player?.id, members, unlocked, reduceMotion]);

  // teclado: só quando o jogo está focado (não atrapalha o resto do app)
  const onKey = (down: boolean) => (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase(); const i = input.current;
    if (k === 'arrowleft' || k === 'a') i.l = down;
    else if (k === 'arrowright' || k === 'd') i.r = down;
    else if ((k === ' ' || k === 'arrowup' || k === 'w') && down) i.jump = true;
    else if (k === 'enter' && down) i.act = true;
    else return;
    e.preventDefault();
  };
  const hold = (key: 'l' | 'r') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.current[key] = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); },
    onPointerUp: () => { input.current[key] = false; }, onPointerCancel: () => { input.current[key] = false; }, onPointerLeave: () => { input.current[key] = false; },
  });

  return (
    <div className="select-none">
      <div ref={wrap} tabIndex={0} onKeyDown={onKey(true)} onKeyUp={onKey(false)} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); input.current = { l: false, r: false, jump: false, act: false }; }}
        className="relative w-full overflow-hidden rounded-[4px] border-[3px] border-line bg-[#9CC3D3] outline-none focus-visible:ring-[3px] focus-visible:ring-sun"
        role="application" aria-label="Minigame: use as setas ou A e D para andar, espaço para pular e Enter para entrar nos lugares">
        <canvas ref={canvas} className="block pixelated mx-auto" />
        {!focused && <div className="absolute bottom-2 left-2 hidden md:block hud text-[9px] bg-panel/90 px-2 py-1 border-2 border-line rounded-[3px] pointer-events-none">Clique para jogar · ← → espaço enter</div>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
        <p className="hud text-[10px] text-muted">Explore · pule para coletar estrelas.</p>
        {playable.length > 1 && (
          <label className="flex items-center gap-2 text-xs"><span className="text-muted">Jogando com</span>
            <select className="field min-h-[32px] py-0 w-auto text-xs" value={player?.id} onChange={(e) => { setWho(e.target.value); try { localStorage.setItem('rdt:game:who', e.target.value); } catch { /* */ } }}>
              {playable.map((m) => <option key={m.id} value={m.id}>{m.nickname || m.name}</option>)}
            </select></label>
        )}
        {near && <button className="hidden md:inline-flex btn-primary btn-sm ml-auto" onClick={() => nav(near.to)}>Entrar: {near.label}</button>}
      </div>
      <div className="flex md:hidden items-center justify-between gap-2 mt-3">
        <div className="flex gap-2">
          <button className="btn-icon w-14 h-14 touch-none" aria-label="Esquerda" {...hold('l')}><Icon name="left" size={20} /></button>
          <button className="btn-icon w-14 h-14 touch-none" aria-label="Direita" {...hold('r')}><Icon name="right" size={20} /></button>
        </div>
        {near && <span className="hud text-[10px] text-terra text-center">{near.label}</span>}
        <div className="flex gap-2">
          <button className="btn-sun w-14 h-14 px-0 touch-none" aria-label="Pular" onPointerDown={(e) => { e.preventDefault(); input.current.jump = true; }}><Icon name="up" size={20} /></button>
          <button className={`btn-icon w-14 h-14 touch-none ${near ? '!bg-terra text-white' : ''}`} aria-label={near ? `Entrar: ${near.label}` : 'Interagir'} onPointerDown={(e) => { e.preventDefault(); input.current.act = true; }}>A</button>
        </div>
      </div>
    </div>
  );
}
