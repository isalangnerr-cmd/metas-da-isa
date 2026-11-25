import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getStore, useTable } from '@/data/store';
import type { CalEvent } from '@/data/types';
import { Empty, Field, Icon, Modal, PageHeader, Segmented, useUI } from '@/components/ui';
import { MemberMulti, RecurrenceField } from '@/components/forms';
import { MemberAvatar } from '@/components/Avatar';
import { EVENT_CATS, catOf, eventsBetween, type Occ } from '@/lib/domain';
import { addDays, addMonths, DIAS_CURTOS, daysInMonth, fmtDateLong, monthName, relDay, startOfMonth, startOfWeek, today, weekday, isValidDate, isValidTime, fmtDate } from '@/lib/dates';
import { downloadText, toICS } from '@/lib/ics';
import { FREQ_LABEL } from '@/lib/recurrence';
import { useMembers } from '@/data/session';

type View = 'mes' | 'semana' | 'dia' | 'agenda';
const evColor = (e: CalEvent) => e.color || catOf(EVENT_CATS, e.category).color;

export function Checkpoints() {
  const events = useTable('events');
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>(() => (window.innerWidth < 640 ? 'agenda' : 'mes'));
  const [cursor, setCursor] = useState(params.get('d') || today());
  const [editing, setEditing] = useState<{ ev: Partial<CalEvent>; occ?: string } | null>(null);
  const [cat, setCat] = useState('all');
  useEffect(() => { if (params.get('novo')) { setEditing({ ev: { date: cursor } }); params.delete('novo'); setParams(params, { replace: true }); } }, [params, setParams, cursor]);
  const evs = useMemo(() => events.filter((e) => cat === 'all' || e.category === cat), [events, cat]);

  const step = (dir: number) => setCursor((c) => view === 'mes' ? addMonths(startOfMonth(c), dir) : view === 'semana' ? addDays(c, 7 * dir) : view === 'dia' ? addDays(c, dir) : addDays(c, 30 * dir));
  const label = view === 'mes' ? `${monthName(+cursor.slice(5, 7) - 1)} ${cursor.slice(0, 4)}` : view === 'semana' ? `Semana de ${fmtDate(startOfWeek(cursor))}` : view === 'dia' ? fmtDateLong(cursor) : `A partir de ${fmtDate(cursor)}`;
  const open = (o: Occ) => setEditing({ ev: o.ev, occ: o.date });

  return (
    <div>
      <PageHeader world="03 · Checkpoints" title="Datas e encontros" subtitle="Calendário compartilhado · horário de Brasília" icon="flag"
        actions={<>
          <button className="btn-ghost" onClick={() => downloadText('roda-do-tempo.ics', toICS(events))} title="Exportar para Google Agenda, Apple ou Outlook"><Icon name="download" size={14} />.ics</button>
          <button className="btn-primary" onClick={() => setEditing({ ev: { date: cursor } })}><Icon name="plus" size={14} />Novo</button>
        </>} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Segmented label="Visualização" value={view} onChange={setView} options={[{ value: 'mes', label: 'Mês' }, { value: 'semana', label: 'Semana' }, { value: 'dia', label: 'Dia' }, { value: 'agenda', label: 'Agenda' }]} />
        <div className="flex items-center gap-1 ml-auto">
          <button className="btn-icon btn-sm" onClick={() => step(-1)} aria-label="Anterior"><Icon name="left" size={14} /></button>
          <button className="btn-ghost btn-sm" onClick={() => setCursor(today())}>Hoje</button>
          <button className="btn-icon btn-sm" onClick={() => step(1)} aria-label="Próximo"><Icon name="right" size={14} /></button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h2 className="h-pixel text-xl first-letter:uppercase flex-1">{label}</h2>
        <select className="field w-auto min-h-[38px] py-1 text-sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrar categoria">
          <option value="all">Todas as categorias</option>{EVENT_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {view === 'mes' && <MonthView cursor={cursor} events={evs} onPick={(d) => { setCursor(d); setView('dia'); }} onOpen={open} />}
      {view === 'semana' && <WeekView cursor={cursor} events={evs} onOpen={open} onNew={(d) => setEditing({ ev: { date: d } })} />}
      {view === 'dia' && <DayList date={cursor} occs={eventsBetween(evs, cursor, cursor)} onOpen={open} onNew={() => setEditing({ ev: { date: cursor } })} />}
      {view === 'agenda' && <Agenda from={cursor} events={evs} onOpen={open} />}
      {editing && <EventEditor ev={editing.ev} occ={editing.occ} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MonthView({ cursor, events, onPick, onOpen }: { cursor: string; events: CalEvent[]; onPick: (d: string) => void; onOpen: (o: Occ) => void }) {
  const first = startOfMonth(cursor), start = startOfWeek(first), n = daysInMonth(first);
  const cells = Math.ceil((weekday(first) + n) / 7) * 7;
  const occs = eventsBetween(events, start, addDays(start, cells - 1));
  const t = today();
  return (
    <div className="px-box overflow-hidden">
      <div className="grid grid-cols-7 bg-panel2 border-b border-line">{DIAS_CURTOS.map((d) => <div key={d} className="hud text-[10px] text-muted text-center py-2">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {Array.from({ length: cells }, (_, i) => {
          const d = addDays(start, i); const inM = d.slice(0, 7) === first.slice(0, 7); const day = occs.filter((o) => o.date === d);
          return (
            <div key={d} className={`min-h-[78px] sm:min-h-[100px] p-1 border-r border-b border-line/60 ${inM ? '' : 'bg-panel2/50 text-muted'}`}>
              <button onClick={() => onPick(d)} className={`w-7 h-7 grid place-items-center rounded-lg text-sm font-bold ${d === t ? 'bg-terra text-white border border-line' : 'hover:bg-panel2'}`} aria-label={fmtDateLong(d)}>{+d.slice(8)}</button>
              <div className="space-y-[2px] mt-1">
                {day.slice(0, 3).map((o) => (
                  <button key={o.ev.id + o.date} onClick={() => onOpen(o)} className="block w-full text-left text-[11px] leading-tight px-1 py-[1px] rounded-md truncate font-semibold text-white" style={{ background: evColor(o.ev) }}>
                    <span className="hidden sm:inline">{!o.ev.all_day && o.ev.start_time ? o.ev.start_time + ' ' : ''}</span>{o.ev.title}
                  </button>
                ))}
                {day.length > 3 && <button onClick={() => onPick(d)} className="text-[10px] text-muted font-bold">+{day.length - 3}</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, events, onOpen, onNew }: { cursor: string; events: CalEvent[]; onOpen: (o: Occ) => void; onNew: (d: string) => void }) {
  const start = startOfWeek(cursor);
  const occs = eventsBetween(events, start, addDays(start, 6));
  const t = today();
  return (
    <div className="grid md:grid-cols-7 gap-2">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i); const day = occs.filter((o) => o.date === d);
        return (
          <div key={d} className={`px-box-flat p-2 min-h-[120px] ${d === t ? 'ring-2 ring-sky' : ''}`}>
            <div className="flex items-center justify-between mb-2"><span className="hud text-[10px] text-muted">{DIAS_CURTOS[i]} {d.slice(8)}/{d.slice(5, 7)}</span>
              <button className="text-muted hover:text-ink" onClick={() => onNew(d)} aria-label={`Novo em ${fmtDate(d)}`}><Icon name="plus" size={12} /></button></div>
            <div className="space-y-1">{day.map((o) => <EvChip key={o.ev.id + o.date} o={o} onOpen={onOpen} />)}</div>
          </div>
        );
      })}
    </div>
  );
}

function EvChip({ o, onOpen }: { o: Occ; onOpen: (o: Occ) => void }) {
  return (
    <button onClick={() => onOpen(o)} className="w-full text-left px-2 py-1 rounded-lg border border-line/30 bg-panel" style={{ borderLeft: `6px solid ${evColor(o.ev)}` }}>
      <div className="text-[11px] text-muted">{o.ev.all_day || !o.ev.start_time ? 'Dia inteiro' : `${o.ev.start_time}${o.ev.end_time ? '–' + o.ev.end_time : ''}`}</div>
      <div className="text-sm font-semibold leading-tight">{o.ev.title}</div>
    </button>
  );
}

function DayList({ date, occs, onOpen, onNew }: { date: string; occs: Occ[]; onOpen: (o: Occ) => void; onNew: () => void }) {
  if (!occs.length) return <div className="px-box"><Empty icon="flag" title="Dia livre" text={`Nada marcado para ${relDay(date).toLowerCase()}.`} action={<button className="btn-primary" onClick={onNew}>Marcar checkpoint</button>} /></div>;
  return <ul className="space-y-2">{occs.map((o) => <EventRow key={o.ev.id + o.date} o={o} onOpen={onOpen} />)}</ul>;
}

export function EventRow({ o, onOpen, showDate }: { o: Occ; onOpen: (o: Occ) => void; showDate?: boolean }) {
  const members = useMembers();
  const c = catOf(EVENT_CATS, o.ev.category);
  return (
    <li>
      <button onClick={() => onOpen(o)} className="w-full px-box-flat p-3 flex items-center gap-3 text-left" style={{ borderLeft: `8px solid ${evColor(o.ev)}` }}>
        <div className="w-16 shrink-0 text-center">
          {showDate && <div className="hud text-[10px] text-muted">{relDay(o.date)}</div>}
          <div className="font-bold tabular-nums">{o.ev.all_day || !o.ev.start_time ? 'Dia' : o.ev.start_time}</div>
          {!o.ev.all_day && o.ev.end_time && <div className="text-[11px] text-muted tabular-nums">{o.ev.end_time}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold leading-tight">{o.ev.title}</div>
          <div className="text-xs text-muted flex flex-wrap gap-x-2"><span className="inline-flex items-center gap-1"><Icon name={c.icon} size={11} />{c.label}</span>{o.ev.location && <span className="inline-flex items-center gap-1"><Icon name="pin" size={11} />{o.ev.location}</span>}{o.ev.recurrence && <span>{FREQ_LABEL[o.ev.recurrence.freq]}</span>}</div>
        </div>
        <div className="flex -space-x-2">{o.ev.participants.includes('family') ? <span className="chip"><Icon name="users" size={11} />Família</span> : o.ev.participants.map((p) => members.find((m) => m.id === p)).filter(Boolean).slice(0, 3).map((m) => <MemberAvatar key={m!.id} m={m} size={26} />)}</div>
      </button>
    </li>
  );
}

function Agenda({ from, events, onOpen }: { from: string; events: CalEvent[]; onOpen: (o: Occ) => void }) {
  const occs = eventsBetween(events, from, addDays(from, 90));
  if (!occs.length) return <div className="px-box"><Empty icon="calendar" title="Agenda livre" text="Nenhum checkpoint nos próximos 90 dias." /></div>;
  const days = [...new Set(occs.map((o) => o.date))];
  return (
    <div className="space-y-4">
      {days.map((d) => (
        <section key={d}>
          <h3 className="hud text-[11px] text-muted mb-2 first-letter:uppercase">{relDay(d)} · {fmtDateLong(d)}</h3>
          <ul className="space-y-2">{occs.filter((o) => o.date === d).map((o) => <EventRow key={o.ev.id + d} o={o} onOpen={onOpen} />)}</ul>
        </section>
      ))}
    </div>
  );
}

const REMINDER_OPTS = [[10, '10 min'], [30, '30 min'], [60, '1 h'], [180, '3 h'], [1440, '1 dia'], [10080, '1 semana']] as const;

export function EventEditor({ ev, occ, onClose }: { ev: Partial<CalEvent>; occ?: string; onClose: () => void }) {
  const ui = useUI(); const st = getStore();
  const advs = useTable('adventures');
  const isNew = !ev.id;
  const [e, setE] = useState<Partial<CalEvent>>({ title: '', date: today(), all_day: false, start_time: '10:00', end_time: '11:00', participants: ['family'], category: 'familia', reminders: [30], ...ev });
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<CalEvent>) => setE((x) => ({ ...x, ...p }));
  const recurring = !!ev.recurrence && ev.recurrence.freq !== 'none';

  const validate = () => {
    if (!e.title?.trim()) return 'Dê um nome ao checkpoint.';
    if (!isValidDate(e.date)) return 'Data inválida.';
    if (e.end_date && e.end_date < e.date!) return 'A data final precisa ser depois do início.';
    if (!e.all_day) {
      if (e.start_time && !isValidTime(e.start_time)) return 'Horário inválido.';
      if (e.end_time && e.start_time && (!e.end_date || e.end_date === e.date) && e.end_time < e.start_time) return 'O término precisa ser depois do início.';
    }
    return null;
  };
  const save = (scope: 'all' | 'one' = 'all') => {
    const v = validate(); if (v) return setErr(v);
    const clean = { ...e, title: e.title!.trim(), start_time: e.all_day ? null : e.start_time || null, end_time: e.all_day ? null : e.end_time || null };
    if (scope === 'one' && occ && recurring) {
      // separa esta ocorrência da série
      st.save('events', { id: ev.id!, exdates: [...(ev.exdates || []), occ] });
      const { id, created_at, updated_at, ...rest } = clean as CalEvent;
      st.save('events', { ...rest, recurrence: null, exdates: [] });
    } else st.save('events', clean);
    ui.toast(isNew ? 'Checkpoint marcado' : 'Checkpoint salvo'); onClose();
  };
  const del = async (scope: 'all' | 'one') => {
    if (!(await ui.confirm({ title: scope === 'one' ? 'Excluir só esta data?' : 'Excluir checkpoint?', text: scope === 'all' && recurring ? 'Todas as repetições serão removidas.' : e.title, ok: 'Excluir', danger: true }))) return;
    if (scope === 'one' && occ) st.save('events', { id: ev.id!, exdates: [...(ev.exdates || []), occ] }); else st.remove('events', ev.id!);
    onClose();
  };
  const postpone = () => {
    if (recurring && occ) { set({ date: addDays(occ, 1), recurrence: null }); return; }
    set({ date: addDays(e.date!, 1), end_date: e.end_date ? addDays(e.end_date, 1) : null });
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'Novo checkpoint' : 'Checkpoint'} wide footer={<>
      {!isNew && <button className="btn-ghost btn-sm mr-auto" onClick={() => del('all')}><Icon name="trash" size={12} />Excluir{recurring ? ' série' : ''}</button>}
      {!isNew && recurring && occ && <button className="btn-ghost btn-sm" onClick={() => del('one')}>Excluir esta data</button>}
      {!isNew && <button className="btn-ghost btn-sm" onClick={() => downloadText(`${e.title}.ics`, toICS([e as CalEvent]))}><Icon name="download" size={12} />.ics</button>}
      {!isNew && recurring && occ && <button className="btn-ghost" onClick={() => save('one')}>Salvar só esta</button>}
      <button className="btn-primary" onClick={() => save('all')}>{recurring && !isNew ? 'Salvar série' : 'Salvar'}</button>
    </>}>
      <div className="space-y-4">
        {recurring && occ && <div className="px-inset p-2 text-xs">Este checkpoint se repete. Você está vendo a data <b>{fmtDate(occ)}</b>.</div>}
        <Field label="Título"><input className="field text-lg font-semibold" value={e.title} onChange={(x) => set({ title: x.target.value })} maxLength={200} placeholder="Ex.: Piquenique em família" /></Field>
        <label className="flex items-center gap-2"><input type="checkbox" className="px-check" checked={e.all_day} onChange={(x) => set({ all_day: x.target.checked })} /><span className="font-semibold text-sm">Dia inteiro</span></label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Data"><input type="date" className="field" value={e.date} onChange={(x) => set({ date: x.target.value })} /></Field>
          {!e.all_day && <Field label="Início"><input type="time" className="field" value={e.start_time || ''} onChange={(x) => set({ start_time: x.target.value })} /></Field>}
          {!e.all_day && <Field label="Término"><input type="time" className="field" value={e.end_time || ''} onChange={(x) => set({ end_time: x.target.value })} /></Field>}
          <Field label="Até (vários dias)"><input type="date" className="field" value={e.end_date || ''} onChange={(x) => set({ end_date: x.target.value || null })} /></Field>
        </div>
        {!isNew && <button type="button" className="btn-ghost btn-sm" onClick={postpone}><Icon name="right" size={12} />Reagendar para o dia seguinte</button>}
        <Field label="Local"><input className="field" value={e.location || ''} onChange={(x) => set({ location: x.target.value })} placeholder="Endereço ou lugar" /></Field>
        <div><span className="label">Participantes</span><MemberMulti value={e.participants || []} onChange={(v) => set({ participants: v })} /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Categoria"><select className="field" value={e.category} onChange={(x) => set({ category: x.target.value })}>{EVENT_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
          <Field label="Cor"><div className="flex gap-2 items-center"><input type="color" className="w-12 h-11 rounded border border-line" value={e.color || catOf(EVENT_CATS, e.category).color} onChange={(x) => set({ color: x.target.value })} />{e.color && <button type="button" className="text-sm link" onClick={() => set({ color: null })}>usar cor da categoria</button>}</div></Field>
        </div>
        <div><span className="label">Repetição</span><RecurrenceField value={e.recurrence} onChange={(r) => set({ recurrence: r })} /></div>
        <div><span className="label">Lembretes</span>
          <div className="flex flex-wrap gap-2">{REMINDER_OPTS.map(([m, l]) => { const on = e.reminders?.includes(m); return <button key={m} type="button" aria-pressed={on} onClick={() => set({ reminders: on ? e.reminders!.filter((x) => x !== m) : [...(e.reminders || []), m] })} className={`chip min-h-[36px] px-3 ${on ? 'bg-sky/10 border-sky text-sky' : ''}`}><Icon name="bell" size={11} />{l} antes</button>; })}</div>
        </div>
        <Field label="Descrição"><textarea className="field" value={e.description || ''} onChange={(x) => set({ description: x.target.value })} /></Field>
        <Field label="Aventura relacionada"><select className="field" value={e.adventure_id || ''} onChange={(x) => set({ adventure_id: x.target.value || null })}><option value="">Nenhuma</option>{advs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        {err && <p className="text-sm font-semibold text-[#A8432E]" role="alert">{err}</p>}
      </div>
    </Modal>
  );
}
