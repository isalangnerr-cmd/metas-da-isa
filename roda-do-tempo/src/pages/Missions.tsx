import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getStore, useTable } from '@/data/store';
import { useMe, useMembers, useSession } from '@/data/session';
import type { Task, Priority } from '@/data/types';
import { Empty, Field, Icon, Modal, PageHeader, Panel, Segmented, useUI } from '@/components/ui';
import { AssigneeSelect, FileAttach, RecurrenceField, AttachmentLink } from '@/components/forms';
import { MemberAvatar } from '@/components/Avatar';
import { TASK_CATS, PRIORITY, assigneeLabel, catOf, completeTask, reopenTask, taskBucket, isMine } from '@/lib/domain';
import { fmtDate, relDay, today, isValidDate, isValidTime, addDays } from '@/lib/dates';
import { FREQ_LABEL } from '@/lib/recurrence';
import { uid } from '@/lib/format';

type View = 'hoje' | 'semana' | 'futuras' | 'todas' | 'historico';

export function Missions() {
  const tasks = useTable('tasks');
  const comps = useTable('task_completions');
  const members = useMembers();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('hoje');
  const [who, setWho] = useState<string>('all');
  const [cat, setCat] = useState<string>('all');
  const [prio, setPrio] = useState<string>('all');
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const ref = today();

  useEffect(() => {
    if (params.get('nova')) { setEditing({}); params.delete('nova'); setParams(params, { replace: true }); }
    const t = params.get('t'); if (t) { const x = tasks.find((y) => y.id === t); if (x) setEditing(x); params.delete('t'); setParams(params, { replace: true }); }
  }, [params, setParams, tasks]);

  const filtered = useMemo(() => tasks.filter((t) =>
    (who === 'all' || (who === 'mine' ? isMine(t.assignee, me?.id) : t.assignee === who)) &&
    (cat === 'all' || t.category === cat) && (prio === 'all' || t.priority === prio)), [tasks, who, cat, prio, me?.id]);

  const groups = useMemo(() => {
    const b = (t: Task) => taskBucket(t, ref);
    const sortT = (a: Task, c: Task) => (a.due_date || '9999').localeCompare(c.due_date || '9999') || (a.due_time || '99').localeCompare(c.due_time || '99') || (c.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0);
    const open = filtered.filter((t) => t.status !== 'done').sort(sortT);
    if (view === 'hoje') return [
      { title: 'Ficou para trás', hint: 'Sem pressa e sem culpa: escolha um novo dia ou conclua quando der.', items: open.filter((t) => b(t) === 'overdue') },
      { title: 'Hoje', items: open.filter((t) => b(t) === 'today') },
      { title: 'Concluídas hoje', items: filtered.filter((t) => t.status === 'done' && t.completed_at?.slice(0, 10) === ref) },
    ];
    if (view === 'semana') return [{ title: 'Próximos 7 dias', items: open.filter((t) => t.due_date && t.due_date >= ref && t.due_date <= addDays(ref, 7)) }];
    if (view === 'futuras') return [{ title: 'Mais adiante', items: open.filter((t) => t.due_date && t.due_date > addDays(ref, 7)) }, { title: 'Sem data', items: open.filter((t) => !t.due_date) }];
    if (view === 'todas') return [{ title: 'Em aberto', items: open }, { title: 'Concluídas', items: filtered.filter((t) => t.status === 'done').sort((a, c) => (c.completed_at || '').localeCompare(a.completed_at || '')) }];
    return [];
  }, [filtered, view, ref]);

  const todayAll = tasks.filter((t) => t.due_date === ref || (t.status === 'done' && t.completed_at?.slice(0, 10) === ref));
  const doneToday = comps.filter((c) => c.date === ref).length;

  return (
    <div>
      <PageHeader world="01 · Missões" title="Desafios do dia" subtitle={`${doneToday} concluída${doneToday === 1 ? '' : 's'} hoje · ${todayAll.filter((t) => t.status !== 'done').length} para hoje`} icon="sword"
        actions={<button className="btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={14} />Nova missão</button>} />
      <QuickAdd />
      <div className="flex flex-wrap gap-2 items-center my-4">
        <div className="scroll-x"><Segmented label="Visualização" value={view} onChange={setView} options={[
          { value: 'hoje', label: 'Hoje' }, { value: 'semana', label: 'Semana' }, { value: 'futuras', label: 'Futuras' }, { value: 'todas', label: 'Todas' }, { value: 'historico', label: 'Histórico' }]} /></div>
        <div className="flex gap-2 flex-wrap">
          <select className="field w-auto min-h-[40px] py-1 text-sm" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filtrar por responsável">
            <option value="all">Todos</option><option value="mine">Minhas</option>
            {members.filter((m) => m.kind === 'adult').map((m) => <option key={m.id} value={m.id}>{m.nickname || m.name}</option>)}
            <option value="both">Nós dois</option><option value="family">Família</option>
          </select>
          <select className="field w-auto min-h-[40px] py-1 text-sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrar por categoria">
            <option value="all">Categorias</option>{TASK_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select className="field w-auto min-h-[40px] py-1 text-sm" value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Filtrar por prioridade">
            <option value="all">Prioridade</option>{(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
          </select>
        </div>
      </div>

      {view === 'historico' ? <History /> : (
        <div className="space-y-5">
          {groups.map((g) => g.items.length > 0 && (
            <section key={g.title}>
              <h2 className="hud text-[12px] text-muted mb-2">{g.title} · {g.items.length}</h2>
              {g.hint && <p className="text-xs text-muted -mt-1 mb-2">{g.hint}</p>}
              <ul className="space-y-2">{g.items.map((t) => <TaskRow key={t.id} t={t} onOpen={() => setEditing(t)} />)}</ul>
            </section>
          ))}
          {groups.every((g) => !g.items.length) && <div className="px-box"><Empty icon="sword" title="Nenhuma missão aqui" text="Que tal adicionar o primeiro desafio do dia?" action={<button className="btn-primary" onClick={() => setEditing({})}>Nova missão</button>} /></div>}
        </div>
      )}
      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function QuickAdd() {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<'hoje' | 'amanha' | 'sem'>('hoje');
  const [who, setWho] = useState('family');
  const ui = useUI();
  const s = useSession();
  const members = useMembers();
  const me = useMe();
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim(); if (!t) return;
    getStore().save('tasks', newTask({ title: t, due_date: when === 'hoje' ? today() : when === 'amanha' ? addDays(today(), 1) : null, assignee: who, stars: s.family.settings.gamification ? 1 : 0 }));
    setTitle(''); ui.toast('Missão adicionada');
  };
  return (
    <form onSubmit={add} className="px-box p-3 flex flex-wrap gap-2 items-center">
      <Icon name="plus" size={16} className="text-terra ml-1" />
      <input className="field flex-1 min-w-[200px] border-0 focus:ring-0 bg-transparent" placeholder="Adicionar missão rápida… (Enter)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título da missão" maxLength={200} />
      <select className="field w-auto min-h-[40px] py-1 text-sm" value={when} onChange={(e) => setWhen(e.target.value as any)} aria-label="Quando"><option value="hoje">Hoje</option><option value="amanha">Amanhã</option><option value="sem">Sem data</option></select>
      <select className="field w-auto min-h-[40px] py-1 text-sm" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Responsável">
        {members.filter((m) => m.kind === 'adult').map((m) => <option key={m.id} value={m.id}>{m.id === me?.id ? 'Eu' : m.nickname || m.name}</option>)}
        <option value="both">Nós dois</option><option value="family">Família</option>
      </select>
      <button className="btn-moss btn-sm" disabled={!title.trim()}>Adicionar</button>
    </form>
  );
}

export function newTask(p: Partial<Task>): Partial<Task> {
  return { title: '', assignee: 'family', category: 'outros', priority: 'normal', status: 'todo', subtasks: [], attachments: [], stars: 1, recurrence: null, ...p };
}

export function TaskRow({ t, onOpen, compact }: { t: Task; onOpen: () => void; compact?: boolean }) {
  const s = useSession();
  const ui = useUI();
  const members = useMembers();
  const me = useMe();
  const c = catOf(TASK_CATS, t.category);
  const done = t.status === 'done';
  const st = getStore();
  const assigneeMember = members.find((m) => m.id === t.assignee);
  const subDone = t.subtasks.filter((x) => x.done).length;
  const toggle = () => {
    if (done) { reopenTask(st, t); ui.toast('Missão reaberta', 'info'); return; }
    const r = completeTask(st, t, me?.id, s.family.settings.gamification);
    ui.celebrate({ title: 'Missão concluída!', sub: s.family.settings.gamification && t.stars ? `+${t.stars} estrela${t.stars > 1 ? 's' : ''} para o time` : t.title, kind: 'mission' });
    if (r.recurring) ui.toast(`Próxima: ${relDay(r.next)}`, 'info');
  };
  const overdue = !done && t.due_date && t.due_date < today();
  return (
    <li className={`px-box-flat flex items-start gap-3 p-3 ${done ? 'opacity-70' : ''}`}>
      <input type="checkbox" className="px-check mt-1" checked={done} onChange={toggle} aria-label={done ? `Reabrir ${t.title}` : `Concluir ${t.title}`} />
      <button className="flex-1 min-w-0 text-left" onClick={onOpen}>
        <div className={`font-semibold leading-snug ${done ? 'line-through' : ''}`}>{t.title}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1"><Icon name={c.icon} size={12} />{c.label}</span>
          {t.due_date && <span className={overdue ? 'text-terra font-semibold' : ''}>{relDay(t.due_date)}{t.due_time ? ` · ${t.due_time}` : ''}</span>}
          {t.recurrence && <span className="inline-flex items-center gap-1"><Icon name="refresh" size={11} />{FREQ_LABEL[t.recurrence.freq]}</span>}
          {t.subtasks.length > 0 && <span>{subDone}/{t.subtasks.length} etapas</span>}
          {t.priority === 'high' && <span className="text-terra font-semibold">Importante</span>}
          {!compact && s.family.settings.gamification && t.stars > 0 && <span className="inline-flex items-center gap-1 text-[#B88A1C]"><Icon name="star" size={11} />{t.stars}</span>}
        </div>
      </button>
      <span className="flex items-center gap-1 text-[12px] font-semibold text-muted shrink-0" title={assigneeLabel(t.assignee, members, me?.id)}>
        {assigneeMember ? <MemberAvatar m={assigneeMember} size={28} /> : <span className="chip"><Icon name={t.assignee === 'both' ? 'heart' : 'users'} size={12} />{t.assignee === 'both' ? 'Nós dois' : 'Família'}</span>}
      </span>
    </li>
  );
}

function History() {
  const comps = useTable('task_completions');
  const members = useMembers();
  const s = useSession();
  const byDay = useMemo(() => {
    const m = new Map<string, typeof comps>();
    for (const c of [...comps].sort((a, b) => b.created_at.localeCompare(a.created_at))) { if (!m.has(c.date)) m.set(c.date, []); m.get(c.date)!.push(c); }
    return [...m.entries()].slice(0, 60);
  }, [comps]);
  if (!byDay.length) return <div className="px-box"><Empty icon="trophy" title="O histórico começa na primeira vitória" text="Cada missão concluída aparece aqui." /></div>;
  return (
    <div className="space-y-4">
      {byDay.map(([d, cs]) => (
        <Panel key={d} kicker={relDay(d)} title={fmtDate(d)} icon="check" tone="moss" action={s.family.settings.gamification ? <span className="chip"><Icon name="star" size={12} />{cs.reduce((a, b) => a + b.stars, 0)}</span> : undefined}>
          <ul className="space-y-1">{cs.map((c) => { const m = members.find((x) => x.id === c.member_id); return (
            <li key={c.id} className="flex items-center gap-2 text-sm"><Icon name="check" size={12} className="text-moss" /><span className="flex-1">{c.title}</span>{m && <span className="text-muted text-xs">{m.nickname || m.name}</span>}</li>
          ); })}</ul>
        </Panel>
      ))}
    </div>
  );
}

export function TaskEditor({ task, onClose }: { task: Partial<Task>; onClose: () => void }) {
  const s = useSession();
  const ui = useUI();
  const st = getStore();
  const advs = useTable('adventures');
  const isNew = !task.id;
  const [t, setT] = useState<Partial<Task>>(() => newTask({ stars: s.family.settings.gamification ? 1 : 0, ...task }));
  const [sub, setSub] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }));

  const save = () => {
    const title = (t.title || '').trim();
    if (!title) return setErr('Dê um nome para a missão.');
    if (t.due_date && !isValidDate(t.due_date)) return setErr('Prazo inválido.');
    if (t.start_date && t.due_date && t.start_date > t.due_date) return setErr('O início precisa ser antes do prazo.');
    if (t.due_time && !isValidTime(t.due_time)) return setErr('Horário inválido.');
    if (t.recurrence && !t.due_date) return setErr('Missões que se repetem precisam de um prazo inicial.');
    st.save('tasks', { ...t, title });
    ui.toast(isNew ? 'Missão criada' : 'Missão salva');
    onClose();
  };
  const del = async () => {
    if (!(await ui.confirm({ title: 'Excluir missão?', text: `“${t.title}” será removida para toda a família.`, ok: 'Excluir', danger: true }))) return;
    st.remove('tasks', t.id!); onClose();
    ui.toast('Missão excluída', 'ok', { label: 'Desfazer', run: () => st.save('tasks', { id: t.id!, deleted: false } as any) });
  };
  const dup = () => { const { id, created_at, updated_at, completed_at, ...rest } = t as Task; st.save('tasks', { ...rest, title: `${t.title} (cópia)`, status: 'todo', subtasks: (t.subtasks || []).map((x) => ({ ...x, id: uid(), done: false })) }); ui.toast('Missão duplicada'); onClose(); };

  return (
    <Modal open onClose={onClose} title={isNew ? 'Nova missão' : 'Missão'} wide footer={<>
      {!isNew && <button className="btn-ghost btn-sm mr-auto" onClick={del}><Icon name="trash" size={14} />Excluir</button>}
      {!isNew && <button className="btn-ghost btn-sm" onClick={dup}><Icon name="copy" size={14} />Duplicar</button>}
      <button className="btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn-primary" onClick={save}>Salvar</button>
    </>}>
      <div className="space-y-4">
        <Field label="Título"><input className="field text-lg font-semibold" value={t.title || ''} onChange={(e) => set({ title: e.target.value })} maxLength={200} placeholder="Ex.: Preparar um café da manhã juntos" /></Field>
        <div><span className="label">Responsável</span><AssigneeSelect value={t.assignee || 'family'} onChange={(v) => set({ assignee: v })} /></div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Início"><input type="date" className="field" value={t.start_date || ''} onChange={(e) => set({ start_date: e.target.value || null })} /></Field>
          <Field label="Prazo"><input type="date" className="field" value={t.due_date || ''} onChange={(e) => set({ due_date: e.target.value || null })} /></Field>
          <Field label="Horário (opcional)"><input type="time" className="field" value={t.due_time || ''} onChange={(e) => set({ due_time: e.target.value || null })} /></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          {[['Hoje', today()], ['Amanhã', addDays(today(), 1)], ['Em 1 semana', addDays(today(), 7)]].map(([l, d]) => <button key={l} type="button" className="btn-ghost btn-sm" onClick={() => set({ due_date: d })}>{l}</button>)}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Categoria"><select className="field" value={t.category} onChange={(e) => set({ category: e.target.value })}>{TASK_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
          <div><span className="label">Prioridade</span><Segmented label="Prioridade" value={t.priority || 'normal'} onChange={(v) => set({ priority: v })} options={(Object.keys(PRIORITY) as Priority[]).map((p) => ({ value: p, label: PRIORITY[p].label }))} /></div>
        </div>
        <div><span className="label">Repetição</span><RecurrenceField value={t.recurrence} onChange={(r) => set({ recurrence: r })} /></div>
        <div>
          <span className="label">Etapas (checklist)</span>
          <ul className="space-y-1 mb-2">
            {(t.subtasks || []).map((x, i) => (
              <li key={x.id} className="flex items-center gap-2">
                <input type="checkbox" className="px-check" checked={x.done} onChange={() => set({ subtasks: t.subtasks!.map((y) => y.id === x.id ? { ...y, done: !y.done } : y) })} aria-label={x.title} />
                <input className="field min-h-[36px] py-1 flex-1" value={x.title} onChange={(e) => set({ subtasks: t.subtasks!.map((y) => y.id === x.id ? { ...y, title: e.target.value } : y) })} />
                <button type="button" className="btn-icon btn-sm w-8" aria-label="Subir" disabled={i === 0} onClick={() => { const a = [...t.subtasks!]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set({ subtasks: a }); }}><Icon name="up" size={12} /></button>
                <button type="button" className="btn-icon btn-sm w-8" aria-label="Remover etapa" onClick={() => set({ subtasks: t.subtasks!.filter((y) => y.id !== x.id) })}><Icon name="close" size={12} /></button>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!sub.trim()) return; set({ subtasks: [...(t.subtasks || []), { id: uid(), title: sub.trim(), done: false }] }); setSub(''); }}>
            <input className="field min-h-[36px] py-1" placeholder="Nova etapa" value={sub} onChange={(e) => setSub(e.target.value)} />
            <button className="btn-ghost btn-sm">Adicionar</button>
          </form>
        </div>
        <Field label="Descrição"><textarea className="field min-h-[70px]" value={t.description || ''} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Anotações"><textarea className="field min-h-[60px]" value={t.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <div><span className="label">Anexos</span><FileAttach value={t.attachments || []} onChange={(v) => set({ attachments: v })} /></div>
        <div className="grid sm:grid-cols-3 gap-3">
          {s.family.settings.gamification && <Field label="Recompensa (estrelas)"><input type="number" min={0} max={10} className="field" value={t.stars ?? 1} onChange={(e) => set({ stars: Math.max(0, Math.min(10, +e.target.value || 0)) })} /></Field>}
          <Field label="Lembrar antes (min)" hint="Só para missões com horário"><input type="number" min={0} max={1440} className="field" value={t.remind_min ?? ''} placeholder={String(s.prefs.reminderLead)} onChange={(e) => set({ remind_min: e.target.value === '' ? null : Math.max(0, +e.target.value) })} /></Field>
          <Field label="Aventura"><select className="field" value={t.adventure_id || ''} onChange={(e) => set({ adventure_id: e.target.value || null })}><option value="">Nenhuma</option>{advs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        </div>
        {!isNew && t.completed_at && <p className="text-xs text-muted">Última conclusão: {fmtDate(t.completed_at.slice(0, 10))}</p>}
        {err && <p className="text-sm font-semibold text-[#A8432E]" role="alert">{err}</p>}
      </div>
    </Modal>
  );
}
export { AttachmentLink };
