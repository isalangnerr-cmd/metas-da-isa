import { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { NAV } from './nav';
import { Icon, Modal, useUI } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { MemberAvatar } from '@/components/Avatar';
import { useMembers, useSession, useMe } from '@/data/session';
import { getStore, useSync, useTable } from '@/data/store';
import { fmtDateLong, today } from '@/lib/dates';
import { useReminders } from '@/lib/reminders';
import { checkAchievements } from '@/lib/domain';
import { Home } from '@/pages/Home';
import { Missions } from '@/pages/Missions';
import { Inventory, ListDetail } from '@/pages/Inventory';
import { Checkpoints } from '@/pages/Checkpoints';
import { MiniPlayer } from '@/pages/MiniPlayer';
import { Stars } from '@/pages/Stars';
import { Adventures, AdventureDetail } from '@/pages/Adventures';
import { Mail } from '@/pages/Mail';
import { FamilyPage } from '@/pages/Family';
import { Onboarding } from '@/pages/Onboarding';
import { NotificationsPanel } from '@/pages/Notifications';
import { Inbox } from '@/pages/Inbox';

const MOBILE_MAIN = ['/', '/missoes', '/inventario', '/checkpoints'];

export function App() {
  const s = useSession();
  const ui = useUI();
  const loc = useLocation();
  const nav = useNavigate();
  const [more, setMore] = useState(false);
  const [bell, setBell] = useState(false);
  const notifs = useTable('notifications');
  const unread = notifs.filter((n) => !n.read_at && (!n.user_id || n.user_id === s.userId)).length;
  const members = useMembers();
  const me = useMe();
  useReminders();

  // avisos de conflito de edição e conquistas
  useEffect(() => {
    const st = getStore();
    st.onConflict = () => ui.toast('Alguém editou isso ao mesmo tempo. Mantivemos a versão mais recente.', 'info');
  }, [ui]);
  const comps = useTable('task_completions'); const advs = useTable('adventures'); const wishes = useTable('wishes');
  const evs = useTable('events'); const mems = useTable('memories'); const msgs = useTable('messages');
  useEffect(() => {
    if (!s.family.settings.gamification) return;
    const t = setTimeout(() => {
      const fresh = checkAchievements(getStore());
      if (fresh[0]) ui.celebrate({ title: 'Conquista!', sub: fresh[0].title, kind: 'achievement' });
    }, 900);
    return () => clearTimeout(t);
  }, [comps.length, advs, wishes, evs.length, mems.length, msgs.length, s.family.settings.gamification, ui]);

  useEffect(() => { window.scrollTo(0, 0); setMore(false); }, [loc.pathname]);
  // atalho de teclado: N = nova missão
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.metaKey || e.ctrlKey) return;
      if (e.key === 'n' && !document.querySelector('[role=dialog]')) { nav('/missoes?nova=1'); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [nav]);

  const needsOnboarding = !s.family.settings.examples_seeded && members.length <= 1;

  return (
    <div className="min-h-full lg:flex">
      {/* Barra lateral (computador) */}
      <aside className="hidden lg:flex flex-col w-[256px] shrink-0 h-screen sticky top-0 border-r border-line bg-panel p-4 gap-0.5 overflow-y-auto">
        <div className="mb-4"><Logo /></div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `group flex items-center gap-3 px-2 py-1.5 rounded-xl ${isActive ? 'bg-panel2' : 'hover:bg-panel2/60'}`}>
            {({ isActive }) => (<>
              <span className="tile w-9 h-9" style={{ background: n.color + "1f", color: n.color }}><Icon name={n.icon} size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2"><span className="pixel text-[11px] text-muted">{n.n}</span><span className={`text-[14px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{n.theme}</span></span>
                <span className="block text-[11.5px] text-muted leading-tight truncate">{n.func} · {n.desc}</span>
              </span>
            </>)}
          </NavLink>
        ))}
        <div className="mt-auto pt-4 pixel text-[12px] text-muted leading-relaxed">Mesmo time.<br />Dentro e fora do jogo.</div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onBell={() => setBell(true)} unread={unread} />
        <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 sm:px-6 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/missoes" element={<Missions />} />
            <Route path="/inventario" element={<Inventory />} />
            <Route path="/inventario/:id" element={<ListDetail />} />
            <Route path="/checkpoints" element={<Checkpoints />} />
            <Route path="/mini-player" element={<MiniPlayer />} />
            <Route path="/estrelas" element={<Stars />} />
            <Route path="/aventuras" element={<Adventures />} />
            <Route path="/aventuras/:id" element={<AdventureDetail />} />
            <Route path="/correio" element={<Mail />} />
            <Route path="/familia" element={<FamilyPage />} />
            <Route path="/entrada" element={<Inbox />} />
            <Route path="/convite/:code" element={<InviteAlready />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
      </div>

      {/* Navegação inferior (celular) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-panel/95 backdrop-blur border-t border-line safe-b" aria-label="Navegação principal">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] ${isActive ? 'text-terra' : 'text-muted'}`}>
              {({ isActive }) => (<>
                <span className={`grid place-items-center w-12 h-7 rounded-full ${isActive ? 'bg-terra/12' : ''}`}><Icon name={n.icon} size={18} /></span>
                <span className="text-[10.5px] font-semibold">{n.theme.replace('World 01', 'Início')}</span>
              </>)}
            </NavLink>
          ))}
          <button className={`flex flex-col items-center justify-center gap-1 py-2 ${more ? 'text-terra' : 'text-muted'}`} onClick={() => setMore(true)} aria-haspopup="dialog">
            <span className="grid place-items-center w-12 h-7"><Icon name="more" size={18} /></span><span className="text-[10.5px] font-semibold">Mais</span>
          </button>
        </div>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="Menu">
        <div className="grid grid-cols-2 gap-2">
          {NAV.filter((n) => !MOBILE_MAIN.includes(n.to)).map((n) => (
            <NavLink key={n.to} to={n.to} className="px-box-flat p-3 flex items-center gap-3 active:scale-[0.98]">
              <span className="tile w-9 h-9" style={{ background: n.color + "1f", color: n.color }}><Icon name={n.icon} size={18} /></span>
              <span className="min-w-0"><span className="block font-semibold text-[14px] leading-tight">{n.theme}</span><span className="block text-[11px] text-muted truncate">{n.func}</span></span>
            </NavLink>
          ))}
        </div>
      </Modal>
      <NotificationsPanel open={bell} onClose={() => setBell(false)} />
      {needsOnboarding && me && <Onboarding />}
    </div>
  );
}

function InviteAlready() {
  return <div className="px-box p-6 max-w-md mx-auto text-center"><div className="h-pixel text-xl mb-2">Você já está numa família</div><p className="text-sm text-muted">Para entrar em outra família, saia da atual em “Nossa família”.</p></div>;
}

function TopBar({ onBell, unread }: { onBell: () => void; unread: number }) {
  const s = useSession();
  const members = useMembers();
  const sync = useSync();
  const nav = useNavigate();
  const status = useMemo(() => {
    if (s.mode === 'local') return { icon: 'home' as const, text: 'Neste aparelho', tone: 'text-muted' };
    if (!sync.online) return { icon: 'offline' as const, text: sync.pending ? `Offline · ${sync.pending} p/ enviar` : 'Offline', tone: 'text-terra' };
    if (sync.error && sync.pending) return { icon: 'refresh' as const, text: 'Tentando enviar…', tone: 'text-terra' };
    if (sync.syncing || sync.pending) return { icon: 'refresh' as const, text: 'Sincronizando', tone: 'text-muted' };
    return { icon: 'cloud' as const, text: 'Sincronizado', tone: 'text-moss' };
  }, [s.mode, sync.online, sync.pending, sync.syncing, sync.error]);
  return (
    <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-line/70 safe-t">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        <div className="lg:hidden"><Logo compact /></div>
        <div className="hidden lg:block">
          <div className="pixel text-[11px] text-muted">Hoje</div>
          <div className="font-medium text-sm first-letter:uppercase">{fmtDateLong(today())}</div>
        </div>
        <div className="flex-1" />
        <div className={`hidden sm:flex items-center gap-1.5 text-[12px] font-medium ${status.tone}`} title={sync.error || ''}><Icon name={status.icon} size={14} />{status.text}</div>
        <div className="hidden md:flex -space-x-1.5" aria-label="Membros da família">
          {members.slice(0, 5).map((m) => <MemberAvatar key={m.id} m={m} size={34} />)}
        </div>
        <button className="btn-icon" onClick={() => nav('/entrada')} aria-label="Caixa de entrada" title="Caixa de entrada: mande um recado e a IA organiza"><Icon name="sparkle" size={18} /></button>
        <button className="btn-icon relative" onClick={onBell} aria-label={`Notificações${unread ? `: ${unread} novas` : ''}`}>
          <Icon name="bell" size={18} />
          {unread > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 grid place-items-center rounded-full bg-terra text-white text-[10px] font-bold ring-2 ring-bg">{unread > 9 ? '9+' : unread}</span>}
        </button>
        <button className="btn-icon" onClick={() => nav('/familia')} aria-label="Configurações"><Icon name="gear" size={18} /></button>
      </div>
      <div className={`sm:hidden flex items-center justify-center gap-1 text-[10.5px] font-medium pb-1 -mt-1 ${status.tone}`}><Icon name={status.icon} size={11} />{status.text}</div>
    </header>
  );
}
