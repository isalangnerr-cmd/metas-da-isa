import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ICONS, type IconName } from './icons';

// ---------- Ícone pixel ----------
export function Icon({ name, size = 20, className = '', title, style }: { name: IconName; size?: number; className?: string; title?: string; style?: React.CSSProperties }) {
  const grid = ICONS[name];
  const rects: ReactNode[] = [];
  grid.forEach((row, y) => row.split('').forEach((c, x) => {
    if (c === '#') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} />);
    else if (c === '+') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} opacity={0.35} />);
  }));
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="currentColor" style={style} className={`pixelated shrink-0 ${className}`}
      shapeRendering="crispEdges" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}{rects}
    </svg>
  );
}

// ---------- Painel ----------
export function Panel({ title, kicker, icon, action, children, className = '', tone }: {
  title?: ReactNode; kicker?: string; icon?: IconName; action?: ReactNode; children: ReactNode; className?: string; tone?: 'moss' | 'terra' | 'sun' | 'sky' | 'plum';
}) {
  const toneCls = tone ? { moss: 'bg-moss', terra: 'bg-terra', sun: 'bg-sun', sky: 'bg-sky', plum: 'bg-plum' }[tone] : 'bg-bark';
  return (
    <section className={`px-box overflow-hidden ${className}`}>
      {(title || kicker) && (
        <header className="flex items-center gap-2 px-4 pt-3 pb-2 border-b-2 border-line/15">
          {icon && <span className={`grid place-items-center w-8 h-8 rounded-[4px] border-2 border-line ${toneCls} text-[rgb(var(--on-accent))]`}><Icon name={icon} size={16} /></span>}
          <div className="min-w-0 flex-1">
            {kicker && <div className="hud text-[10px] text-muted leading-none mb-1">{kicker}</div>}
            {title && <h2 className="h-pixel text-[19px] leading-tight truncate">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ world, title, subtitle, icon, actions }: { world: string; title: string; subtitle?: string; icon: IconName; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-3 mb-5 anim-rise">
      <div className="grid place-items-center w-14 h-14 rounded-[6px] border-[3px] border-line bg-sun text-[rgb(58_42_30)] shadow-px"><Icon name={icon} size={30} /></div>
      <div className="flex-1 min-w-[180px]">
        <div className="hud text-[11px] text-terra">{world}</div>
        <h1 className="h-pixel text-[30px] leading-none">{title}</h1>
        {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}

// ---------- Progresso ----------
export function SegBar({ value, total = 10, className = '', label }: { value: number; total?: number; className?: string; label?: string }) {
  const on = Math.round(Math.max(0, Math.min(1, value)) * total);
  return (
    <div className={`seg-bar ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label || 'Progresso'}>
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="inline-grid place-items-center w-16 h-16 mb-3 rounded-[6px] border-[3px] border-dashed border-line/40 text-muted anim-float"><Icon name={icon} size={30} /></div>
      <div className="h-pixel text-lg">{title}</div>
      {text && <p className="text-muted text-sm mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 justify-center py-10 text-muted" role="status">
      <div className="grid grid-cols-3 gap-[3px]">{[0, 1, 2].map((i) => <span key={i} className="w-2.5 h-2.5 bg-terra anim-blink" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>
      <span className="hud text-xs">{label}…</span>
    </div>
  );
}

// ---------- Modal / folha ----------
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    setTimeout(() => { const f = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select'); f?.focus(); }, 30);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgb(20_14_10/0.55)]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" className={`px-box w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92dvh] flex flex-col rounded-b-none sm:rounded-[6px] anim-rise`}>
        <header className="flex items-center gap-2 px-4 py-3 border-b-2 border-line/20 bg-panel2">
          <h2 className="h-pixel text-xl flex-1 truncate">{title}</h2>
          <button className="btn-icon btn-sm w-9" onClick={onClose} aria-label="Fechar"><Icon name="close" size={14} /></button>
        </header>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        {footer && <footer className="px-4 py-3 border-t-2 border-line/20 flex gap-2 justify-end flex-wrap safe-b">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------- Toasts, confirmação e celebração ----------
type Toast = { id: number; text: string; tone: 'ok' | 'err' | 'info'; action?: { label: string; run: () => void } };
type Celebration = { title: string; sub?: string; kind?: 'mission' | 'wish' | 'adventure' | 'achievement' };
interface UICtx {
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  confirm: (o: { title: string; text?: string; ok?: string; danger?: boolean }) => Promise<boolean>;
  celebrate: (c: Celebration) => void;
}
const Ctx = createContext<UICtx>(null as any);
export const useUI = () => useContext(Ctx);

export function UIProvider({ children, sounds }: { children: ReactNode; sounds: boolean }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [conf, setConf] = useState<null | { title: string; text?: string; ok?: string; danger?: boolean; res: (b: boolean) => void }>(null);
  const [cel, setCel] = useState<Celebration | null>(null);
  const soundsRef = useRef(sounds); soundsRef.current = sounds;
  const toast = useCallback<UICtx['toast']>((text, tone = 'ok', action) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6000 : 3200);
  }, []);
  const confirm = useCallback<UICtx['confirm']>((o) => new Promise((res) => setConf({ ...o, res })), []);
  const celebrate = useCallback((c: Celebration) => {
    setCel(c); if (soundsRef.current) chime(c.kind === 'mission' ? 'small' : 'big');
    setTimeout(() => setCel(null), c.kind === 'mission' ? 1600 : 3200);
  }, []);
  return (
    <Ctx.Provider value={{ toast, confirm, celebrate }}>
      {children}
      <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[calc(84px+env(safe-area-inset-bottom))] lg:bottom-6 flex flex-col gap-2 w-[min(92vw,420px)]" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`px-box px-4 py-3 flex items-center gap-3 anim-rise ${t.tone === 'err' ? 'bg-[#F4D6CC] text-[#5A1F12]' : ''}`}>
            <Icon name={t.tone === 'err' ? 'close' : t.tone === 'info' ? 'bell' : 'check'} size={16} className={t.tone === 'err' ? '' : 'text-moss'} />
            <span className="flex-1 text-sm font-semibold">{t.text}</span>
            {t.action && <button className="btn-ghost btn-sm" onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
      <Modal open={!!conf} onClose={() => { conf?.res(false); setConf(null); }} title={conf?.title || ''}
        footer={<>
          <button className="btn-ghost" onClick={() => { conf?.res(false); setConf(null); }}>Cancelar</button>
          <button className={conf?.danger ? 'btn-danger' : 'btn-primary'} data-autofocus onClick={() => { conf?.res(true); setConf(null); }}>{conf?.ok || 'Confirmar'}</button>
        </>}>
        <p className="text-sm">{conf?.text}</p>
      </Modal>
      {cel && <CelebrationView c={cel} onDone={() => setCel(null)} />}
    </Ctx.Provider>
  );
}

function CelebrationView({ c, onDone }: { c: Celebration; onDone: () => void }) {
  const big = c.kind !== 'mission';
  const colors = ['#C2643C', '#5E7B3A', '#E9B949', '#6E9FB5', '#8A5A7A'];
  return (
    <div className={`fixed inset-0 z-[70] pointer-events-none flex ${big ? 'items-center' : 'items-start pt-24'} justify-center`} onClick={onDone} role="status" aria-live="assertive">
      {big && Array.from({ length: 28 }, (_, i) => (
        <span key={i} className="absolute top-0 w-2.5 h-2.5" style={{ left: `${(i * 37) % 100}%`, background: colors[i % 5], animation: `confetti ${1.6 + (i % 5) * 0.3}s steps(12) ${(i % 7) * 0.08}s both` }} />
      ))}
      <div className="px-box px-6 py-4 text-center anim-pop bg-panel">
        <div className="flex justify-center gap-1 text-sun mb-1">{[0, 1, 2].map((i) => <Icon key={i} name="star" size={big ? 22 : 16} />)}</div>
        <div className="h-pixel text-2xl sm:text-3xl">{c.title}</div>
        {c.sub && <div className="text-sm text-muted mt-1">{c.sub}</div>}
      </div>
    </div>
  );
}

// Som 8-bit curtinho, gerado (sem arquivos)
let actx: AudioContext | null = null;
export function chime(kind: 'small' | 'big' | 'coin' | 'jump' = 'small') {
  try {
    actx = actx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = { small: [660, 880], big: [523, 659, 784, 1046], coin: [988, 1319], jump: [330, 495] }[kind];
    notes.forEach((f, i) => {
      const o = actx!.createOscillator(), g = actx!.createGain();
      o.type = 'square'; o.frequency.value = f;
      const t = actx!.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g).connect(actx!.destination); o.start(t); o.stop(t + 0.13);
    });
  } catch { /* sem áudio */ }
}

// ---------- Campos ----------
export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return <label className={`block ${className}`}><span className="label">{label}</span>{children}{hint && <span className="block text-xs text-muted mt-1">{hint}</span>}</label>;
}
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 p-1 px-inset">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={`tab ${value === o.value ? 'tab-on' : ''}`}>{o.label}</button>
      ))}
    </div>
  );
}
