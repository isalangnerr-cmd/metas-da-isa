import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getStore, useTable } from '@/data/store';
import { useMembers, useMe, useSession } from '@/data/session';
import { Icon, Panel, SegBar } from '@/components/ui';
import { MemberAvatar } from '@/components/Avatar';
import { Game } from '@/game/Game';
import { NAV } from '@/nav';
import { ACHIEVEMENTS, adventureProgress, eventsBetween, isMine, starTotals } from '@/lib/domain';
import { addDays, fmtDateLong, greeting, relDay, today, fmtDate } from '@/lib/dates';
import { TaskRow, TaskEditor } from './Missions';
import { EventRow, EventEditor } from './Checkpoints';
import { listStats } from './Inventory';
import { isLocked } from './Mail';
import { MESSAGE_KINDS } from '@/lib/domain';

export function Home() {
  const s = useSession(); const me = useMe(); const members = useMembers(); const nav = useNavigate();
  const tasks = useTable('tasks'); const comps = useTable('task_completions'); const events = useTable('events');
  const lists = useTable('lists'); const items = useTable('list_items'); const advs = useTable('adventures');
  const wishes = useTable('wishes'); const msgs = useTable('messages'); const ach = useTable('achievements'); const recs = useTable('child_records');
  useTable('star_transactions');
  const [task, setTask] = useState<any>(null);
  const [ev, setEv] = useState<any>(null);
  const t = today();
  const gam = s.family.settings.gamification;

  const todayTasks = tasks.filter((x) => x.status !== 'done' && x.due_date === t).sort((a, b) => (a.due_time || '99').localeCompare(b.due_time || '99'));
  const overdue = tasks.filter((x) => x.status !== 'done' && x.due_date && x.due_date < t);
  const doneToday = comps.filter((c) => c.date === t).length;
  const totalToday = todayTasks.length + doneToday;
  const upcoming = useMemo(() => eventsBetween(events, t, addDays(t, 14)).slice(0, 5), [events, t]);
  const activeLists = lists.filter((l) => !l.archived).map((l) => ({ l, st: listStats(items.filter((i) => i.list_id === l.id)) })).filter((x) => x.st.total > x.st.done).slice(0, 4);
  const nextAdvs = advs.filter((a) => a.status !== 'done').slice(0, 3);
  const wishesInProgress = wishes.filter((w) => w.status === 'progress' || w.status === 'planning').slice(0, 3);
  const recentMsgs = msgs.filter((m) => !isLocked(m) && m.sender_id !== me?.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const reminders = recs.filter((r) => ['consult', 'vaccine', 'reminder'].includes(r.kind) && ((r.date >= t && r.date <= addDays(t, 7)) || (r.data?.next_date && r.data.next_date >= t && r.data.next_date <= addDays(t, 7))));
  const weekDone = comps.filter((c) => c.date >= addDays(t, -6)).length;
  const stars = starTotals(getStore());
  const unlocked = ACHIEVEMENTS.filter((a) => a.unlock && ach.some((x) => x.key === a.key)).map((a) => a.unlock!);
  const pad = (n: number) => String(n).padStart(2, '0');
  const pets = members.filter((m) => m.kind === 'pet').length;

  return (
    <div className="space-y-5">
      {/* Saudação */}
      <section className="flex flex-wrap items-end gap-3 anim-rise">
        <div className="flex-1 min-w-[220px]">
          <div className="hud text-[11px] text-terra">World 01 · Nossa aventura</div>
          <h1 className="h-pixel text-[28px] sm:text-[34px] leading-none">{greeting()}, {me?.nickname || me?.name || 'jogador'}!</h1>
          <p className="text-sm text-muted mt-1 first-letter:uppercase">{fmtDateLong(t)}</p>
        </div>
        <div className="flex -space-x-2 md:hidden">{members.slice(0, 5).map((m) => <MemberAvatar key={m.id} m={m} size={36} />)}</div>
      </section>

      {/* Herói com HUD + minigame */}
      <section className="px-box overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 bg-[rgb(58_42_30)] text-[#F3E8D4]">
          <span className="hud text-[12px]">World 01</span>
          <span className="hud text-[12px]">Missões <b className="text-sun">{pad(doneToday)}/{pad(totalToday)}</b></span>
          <span className="flex gap-1" aria-label="Três corações: a família">{[0, 1, 2].map((i) => <Icon key={i} name="heart" size={16} className="text-[#E0735A]" />)}</span>
          <span className="hud text-[12px] flex items-center gap-1">Co-op: {pad(members.filter((m) => m.kind !== 'pet').length || 3)} + <Icon name="paw" size={14} />{pets > 1 ? pets : ''}</span>
          {gam && <span className="hud text-[12px] flex items-center gap-1 ml-auto"><Icon name="star" size={14} className="text-sun" />{stars.total}</span>}
        </div>
        <div className="p-4">
          <h2 className="h-pixel text-[22px] sm:text-[26px] text-center mb-3 tracking-wider">UMA AVENTURA EM FAMÍLIA</h2>
          <Game members={members} unlocked={unlocked} sounds={s.prefs.sounds} reduceMotion={s.prefs.reduceMotion}
            onStar={() => s.setPrefs({ gameStars: (s.prefs.gameStars || 0) + 1 })} />
          <p className="text-[11px] text-muted mt-2">Estrelinhas do jogo: {s.prefs.gameStars} · elas são só diversão e não contam no progresso real.</p>
        </div>
      </section>

      {/* Ações rápidas */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Ações rápidas">
        <button className="btn-primary" onClick={() => setTask({ due_date: t })}><Icon name="plus" size={14} />Missão</button>
        <button className="btn-moss" onClick={() => setEv({ date: t })}><Icon name="flag" size={14} />Checkpoint</button>
        <button className="btn-sun" onClick={() => nav(activeLists[0] ? `/inventario/${activeLists[0].l.id}` : '/inventario')}><Icon name="bag" size={14} />Item de lista</button>
        <button className="btn-ghost" onClick={() => nav('/correio?nova=1')}><Icon name="mail" size={14} />Carta</button>
      </section>

      {/* Atalhos numerados */}
      <section aria-label="Atalhos">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {NAV.slice(1, 8).map((n) => (
            <Link key={n.to} to={n.to} className="px-box p-3 group hover:-translate-y-[2px] transition-transform">
              <div className="flex items-center justify-between mb-2"><span className="hud text-[11px] text-muted">{n.n}</span><span className="grid place-items-center w-8 h-8 rounded-[4px] border-2 border-line text-[rgb(58_42_30)]" style={{ background: n.color }}><Icon name={n.icon} size={16} /></span></div>
              <div className="h-pixel text-[16px] leading-tight">{n.theme}</div>
              <div className="text-[11px] text-muted">{n.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2" kicker="Missões da vida real" title="Hoje" icon="sword" tone="terra" action={<Link to="/missoes" className="hud text-[10px] link">ver todas</Link>}>
          {overdue.length > 0 && <Link to="/missoes" className="block px-inset p-2 mb-3 text-sm">{overdue.length} missão{overdue.length > 1 ? 'ões' : ''} de dias anteriores esperando um novo dia. Sem pressa.</Link>}
          {todayTasks.length ? <ul className="space-y-2">{todayTasks.slice(0, 6).map((x) => <TaskRow key={x.id} t={x} onOpen={() => setTask(x)} compact />)}</ul>
            : <p className="text-sm text-muted py-2">{doneToday ? `Tudo feito por hoje: ${doneToday} missão${doneToday > 1 ? 'ões' : ''} concluída${doneToday > 1 ? 's' : ''}!` : 'Nenhuma missão para hoje.'} <button className="link" onClick={() => setTask({ due_date: t })}>Adicionar</button></p>}
          {tasks.filter((x) => x.status !== 'done' && x.due_date === addDays(t, 1)).length > 0 && (
            <div className="mt-3"><div className="hud text-[10px] text-muted mb-1">Amanhã</div>
              <ul className="space-y-1">{tasks.filter((x) => x.status !== 'done' && x.due_date === addDays(t, 1)).slice(0, 3).map((x) => <li key={x.id} className="text-sm flex gap-2"><Icon name="right" size={10} className="mt-1" />{x.title}</li>)}</ul></div>
          )}
        </Panel>
        <Panel kicker="Progresso cooperativo" title="O time" icon="users" tone="moss">
          <div className="space-y-3">
            <div><div className="flex justify-between text-sm"><span>Missões de hoje</span><b className="tabular-nums">{doneToday}/{totalToday}</b></div><SegBar value={totalToday ? doneToday / totalToday : 0} /></div>
            <div className="flex justify-between text-sm"><span>Concluídas nos últimos 7 dias</span><b>{weekDone}</b></div>
            {gam && <div className="flex justify-between text-sm"><span>Estrelas do time (semana)</span><b className="flex items-center gap-1"><Icon name="star" size={12} className="text-sun" />{stars.week}</b></div>}
            {gam && <div className="flex justify-between text-sm"><span>Conquistas</span><b>{ach.length}/{ACHIEVEMENTS.length}</b></div>}
            <div className="flex -space-x-1 pt-1">{members.map((m) => <MemberAvatar key={m.id} m={m} size={34} />)}</div>
          </div>
        </Panel>

        <Panel kicker="Próximos checkpoints" title="Agenda" icon="flag" tone="sky" action={<Link to="/checkpoints?v=agenda" className="hud text-[10px] link">calendário</Link>}>
          {upcoming.length ? <ul className="space-y-2">{upcoming.map((o) => <EventRow key={o.ev.id + o.date} o={o} showDate onOpen={(x) => setEv(x.ev)} />)}</ul> : <p className="text-sm text-muted">Nada nos próximos 14 dias.</p>}
        </Panel>
        <Panel kicker="Inventário" title="Listas ativas" icon="bag" tone="moss" action={<Link to="/inventario" className="hud text-[10px] link">abrir</Link>}>
          {activeLists.length ? <ul className="space-y-3">{activeLists.map(({ l, st }) => (
            <li key={l.id}><Link to={`/inventario/${l.id}`} className="block"><div className="flex justify-between text-sm mb-1"><span className="font-semibold flex items-center gap-1"><Icon name={l.icon as any} size={12} />{l.name}</span><span className="text-muted">{st.total - st.done} faltando</span></div><SegBar value={st.pct} /></Link></li>
          ))}</ul> : <p className="text-sm text-muted">Nenhuma lista com itens pendentes.</p>}
        </Panel>
        <Panel kicker="Lembretes importantes" title="Cuidados" icon="bell" tone="sun">
          {reminders.length ? <ul className="space-y-2">{reminders.map((r) => <li key={r.id}><Link to="/mini-player?tab=cuidados" className="flex gap-2 text-sm"><Icon name="pill" size={12} className="mt-1" /><span className="flex-1 font-semibold">{r.title}</span><span className="text-muted text-xs">{relDay(r.date >= t ? r.date : r.data!.next_date!)}</span></Link></li>)}</ul> : <p className="text-sm text-muted">Nenhuma consulta, vacina ou lembrete nesta semana.</p>}
        </Panel>

        <Panel kicker="Próximas aventuras" title="Campanhas" icon="map" action={<Link to="/aventuras" className="hud text-[10px] link">ver</Link>}>
          {nextAdvs.length ? <ul className="space-y-3">{nextAdvs.map((a) => { const p = adventureProgress(a, tasks); return <li key={a.id}><Link to={`/aventuras/${a.id}`} className="block"><div className="flex justify-between text-sm mb-1"><span className="font-semibold">{a.name}</span><span className="text-muted">{a.start_date ? fmtDate(a.start_date) : ''}</span></div><SegBar value={p.pct} /></Link></li>; })}</ul> : <p className="text-sm text-muted">Nenhum plano em andamento. <Link to="/aventuras" className="link">Planejar</Link></p>}
        </Panel>
        <Panel kicker="Desejos em andamento" title="Estrelas" icon="star" tone="sun" action={<Link to="/estrelas" className="hud text-[10px] link">ver</Link>}>
          {wishesInProgress.length ? <ul className="space-y-2">{wishesInProgress.map((w) => <li key={w.id} className="text-sm"><div className="flex justify-between"><span className="font-semibold">{w.title}</span><span className="text-muted">{w.progress}%</span></div><SegBar value={w.progress / 100} /></li>)}</ul> : <p className="text-sm text-muted">Nenhum desejo em andamento.</p>}
        </Panel>
        <Panel kicker="Mensagens recentes" title="Correio" icon="mail" tone="plum" action={<Link to="/correio" className="hud text-[10px] link">abrir</Link>}>
          {recentMsgs.length ? <ul className="space-y-2">{recentMsgs.map((m) => { const f = members.find((x) => x.id === m.sender_id); return <li key={m.id}><Link to={`/correio?m=${m.id}`} className="flex items-center gap-2 text-sm"><MemberAvatar m={f} size={26} /><span className="flex-1 min-w-0"><span className="block font-semibold truncate">{m.title}</span><span className="block text-xs text-muted">{MESSAGE_KINDS[m.kind].label}</span></span>{!m.read_at && <span className="w-2 h-2 bg-terra" />}</Link></li>; })}</ul> : <p className="text-sm text-muted">A caixa de correio está vazia.</p>}
        </Panel>
      </div>

      <footer className="text-center py-6">
        <div className="h-pixel text-[20px] sm:text-[24px] tracking-wider">NOSSA MELHOR CAMPANHA É A VIDA REAL.</div>
        <div className="hud text-[10px] text-muted mt-2">Nossa aventura / 03 · Mesmo time. Dentro e fora do jogo.</div>
      </footer>
      {task && <TaskEditor task={task} onClose={() => setTask(null)} />}
      {ev && <EventEditor ev={ev} onClose={() => setEv(null)} />}
    </div>
  );
}
