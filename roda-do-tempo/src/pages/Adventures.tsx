import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getStore, useTable } from '@/data/store';
import { useMembers, useSession } from '@/data/session';
import type { Adventure, AdvStatus } from '@/data/types';
import { Empty, Field, Icon, Modal, PageHeader, Panel, SegBar, Segmented, useUI } from '@/components/ui';
import { MemberMulti, Photo, ImagePicker, safeUrl } from '@/components/forms';
import { MemberAvatar } from '@/components/Avatar';
import { Cover } from '@/components/Cover';
import { ADV_COVERS, ADV_STATUS, adventureProgress, completeTask, eventsBetween, reopenTask } from '@/lib/domain';
import { addDays, fmtDate, relDay, today } from '@/lib/dates';
import { money, parseMoney } from '@/lib/format';
import { TaskEditor, newTask } from './Missions';
import { EventEditor, EventRow } from './Checkpoints';
import { listStats } from './Inventory';
import { useMe } from '@/data/session';

export function Adventures() {
  const advs = useTable('adventures');
  const tasks = useTable('tasks');
  const [tab, setTab] = useState<AdvStatus>('active');
  const [edit, setEdit] = useState<Partial<Adventure> | null>(null);
  const nav = useNavigate();
  const list = advs.filter((a) => a.status === tab).sort((a, b) => (a.start_date || '9999').localeCompare(b.start_date || '9999'));
  return (
    <div>
      <PageHeader world="06 · Aventuras" title="Próximos planos" subtitle="Cada plano grande é uma campanha" icon="map" actions={<button className="btn-primary" onClick={() => setEdit({})}><Icon name="plus" size={14} />Nova aventura</button>} />
      <div className="mb-4"><Segmented label="Status" value={tab} onChange={setTab} options={(['active', 'future', 'done'] as AdvStatus[]).map((s) => ({ value: s, label: `${ADV_STATUS[s]} · ${advs.filter((a) => a.status === s).length}` }))} /></div>
      {list.length === 0 ? <div className="px-box"><Empty icon="map" title="Nenhuma campanha aqui" text="Viagem, mudança, reforma, festa, férias, um projeto de longo prazo…" action={<button className="btn-primary" onClick={() => setEdit({ status: tab })}>Começar aventura</button>} /></div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((a) => { const p = adventureProgress(a, tasks); return (
            <Link key={a.id} to={`/aventuras/${a.id}`} className="px-box overflow-hidden block hover:-translate-y-[2px] transition-transform">
              <div className="relative h-28 border-b-[3px] border-line">{a.cover_path ? <Photo path={a.cover_path} className="w-full h-full object-cover" /> : <Cover kind={a.cover} className="w-full h-full" />}
                <span className="absolute top-2 left-2 chip bg-panel">{ADV_STATUS[a.status]}</span></div>
              <div className="p-4">
                <div className="hud text-[10px] text-terra">Aventura</div>
                <div className="h-pixel text-xl leading-tight">{a.name}</div>
                <div className="text-xs text-muted mt-1">{a.start_date ? fmtDate(a.start_date) : 'Sem data'}{a.end_date ? ` → ${fmtDate(a.end_date)}` : ''}</div>
                <SegBar value={p.pct} className="mt-3" /><div className="text-xs text-muted mt-1">{p.total ? `${p.done}/${p.total} etapas` : 'Sem etapas ainda'}</div>
              </div>
            </Link>
          ); })}
        </div>
      )}
      {edit && <AdventureEditor adv={edit} onClose={() => setEdit(null)} onCreated={(id) => nav(`/aventuras/${id}`)} />}
    </div>
  );
}

function AdventureEditor({ adv, onClose, onCreated }: { adv: Partial<Adventure>; onClose: () => void; onCreated?: (id: string) => void }) {
  const ui = useUI(); const st = getStore();
  const [a, setA] = useState<Partial<Adventure>>({ name: '', cover: 'mountain', participants: ['family'], status: 'future', links: [], notes: '', ...adv });
  const [budget, setBudget] = useState(adv.budget != null ? String(adv.budget).replace('.', ',') : '');
  const set = (p: Partial<Adventure>) => setA((x) => ({ ...x, ...p }));
  const save = () => {
    if (!a.name?.trim()) return ui.toast('Dê um nome à aventura', 'err');
    const b = budget.trim() ? parseMoney(budget) : null;
    if (budget.trim() && b == null) return ui.toast('Orçamento inválido', 'err');
    if (a.start_date && a.end_date && a.end_date < a.start_date) return ui.toast('A conclusão precisa ser depois do início', 'err');
    const r = st.save('adventures', { ...a, name: a.name.trim(), budget: b });
    onClose(); if (!adv.id) onCreated?.(r.id);
  };
  return (
    <Modal open onClose={onClose} title={adv.id ? 'Editar aventura' : 'Nova aventura'} wide footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}>
      <div className="space-y-4">
        <Field label="Nome"><input className="field text-lg font-semibold" value={a.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Nossa próxima viagem" /></Field>
        <div><span className="label">Capa</span>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">{ADV_COVERS.map((c) => <button key={c.value} type="button" aria-pressed={a.cover === c.value} title={c.label} onClick={() => set({ cover: c.value, cover_path: null })} className={`h-12 overflow-hidden rounded-lg border ${a.cover === c.value && !a.cover_path ? 'border-line' : 'border-line/20'}`}><Cover kind={c.value} className="w-full h-full" /></button>)}</div>
          <div className="mt-2"><ImagePicker value={a.cover_path} onChange={(p) => set({ cover_path: p })} label="Ou uma foto" /></div>
        </div>
        <div><span className="label">Status</span><Segmented label="Status" value={a.status!} onChange={(v) => set({ status: v })} options={(['future', 'active', 'done'] as AdvStatus[]).map((s) => ({ value: s, label: ADV_STATUS[s] }))} /></div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Início"><input type="date" className="field" value={a.start_date || ''} onChange={(e) => set({ start_date: e.target.value || null })} /></Field>
          <Field label="Conclusão prevista"><input type="date" className="field" value={a.end_date || ''} onChange={(e) => set({ end_date: e.target.value || null })} /></Field>
          <Field label="Orçamento (R$)"><input className="field" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="opcional" /></Field>
        </div>
        <div><span className="label">Participantes</span><MemberMulti value={a.participants || []} onChange={(v) => set({ participants: v })} /></div>
        <Field label="Descrição"><textarea className="field" value={a.description || ''} onChange={(e) => set({ description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function AdventureDetail() {
  const { id } = useParams();
  const advs = useTable('adventures'); const tasks = useTable('tasks'); const lists = useTable('lists'); const items = useTable('list_items'); const events = useTable('events');
  const members = useMembers(); const me = useMe(); const s = useSession();
  const ui = useUI(); const st = getStore(); const nav = useNavigate();
  const a = advs.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);
  const [task, setTask] = useState<any>(null);
  const [ev, setEv] = useState<any>(null);
  const [stage, setStage] = useState('');
  const [link, setLink] = useState({ title: '', url: '' });
  const stages = useMemo(() => tasks.filter((t) => t.adventure_id === id).sort((x, y) => (x.due_date || '9999').localeCompare(y.due_date || '9999') || x.created_at.localeCompare(y.created_at)), [tasks, id]);
  if (!a) return <div className="px-box"><Empty icon="map" title="Aventura não encontrada" action={<Link className="btn-ghost" to="/aventuras">Voltar</Link>} /></div>;
  const p = adventureProgress(a, tasks);
  const advLists = lists.filter((l) => l.adventure_id === a.id);
  const spent = advLists.reduce((acc, l) => acc + listStats(items.filter((i) => i.list_id === l.id)).sumAll, 0);
  const occs = eventsBetween(events.filter((e) => e.adventure_id === a.id), addDays(today(), -365), addDays(today(), 730));
  const nextStage = stages.find((t) => t.status !== 'done');

  const toggle = (t: typeof stages[number]) => {
    if (t.status === 'done') { reopenTask(st, t); return; }
    completeTask(st, t, me?.id, s.family.settings.gamification);
    const remaining = stages.filter((x) => x.id !== t.id && x.status !== 'done').length;
    if (remaining === 0 && a.status !== 'done') {
      ui.confirm({ title: 'Todas as etapas concluídas!', text: 'Marcar esta aventura como concluída?', ok: 'Concluir aventura' }).then((ok) => { if (ok) finish(); });
    } else ui.celebrate({ title: 'Etapa concluída!', sub: t.title, kind: 'mission' });
  };
  const finish = () => {
    st.save('adventures', { id: a.id, status: 'done', completed_at: new Date().toISOString() });
    if (s.family.settings.gamification) st.save('star_transactions', { amount: 10, source: 'adventure', ref_id: a.id, note: a.name });
    ui.celebrate({ title: 'Aventura concluída!', sub: a.name, kind: 'adventure' });
  };
  const addStage = (e: React.FormEvent) => { e.preventDefault(); if (!stage.trim()) return; st.save('tasks', newTask({ title: stage.trim(), adventure_id: a.id, assignee: 'both', category: 'lazer', stars: s.family.settings.gamification ? 1 : 0 })); setStage(''); };
  const del = async () => {
    if (!(await ui.confirm({ title: 'Excluir aventura?', text: 'As missões, listas e checkpoints ligados a ela continuam existindo, só perdem o vínculo.', ok: 'Excluir', danger: true }))) return;
    st.remove('adventures', a.id);
    stages.forEach((t) => st.save('tasks', { id: t.id, adventure_id: null }));
    nav('/aventuras');
  };

  return (
    <div>
      <Link to="/aventuras" className="inline-flex items-center gap-1 hud text-[11px] text-muted mb-3"><Icon name="left" size={12} />Aventuras</Link>
      <section className="px-box overflow-hidden mb-4">
        <div className="relative h-40 sm:h-52 border-b-[3px] border-line">
          {a.cover_path ? <Photo path={a.cover_path} className="w-full h-full object-cover" /> : <Cover kind={a.cover} className="w-full h-full" />}
          <div className="absolute bottom-3 left-3 right-3 flex items-end gap-3">
            <div className="px-box px-3 py-2 bg-panel/95"><div className="hud text-[10px] text-terra">Aventura · {ADV_STATUS[a.status]}</div><h1 className="h-pixel text-2xl sm:text-3xl leading-none">{a.name}</h1></div>
          </div>
        </div>
        <div className="p-4 grid sm:grid-cols-[1fr_auto] gap-4 items-center">
          <div>
            <div className="flex justify-between text-sm mb-1"><span className="font-semibold">Progresso da campanha</span><span className="tabular-nums">{Math.round(p.pct * 100)}%</span></div>
            <SegBar value={p.pct} total={12} />
            <div className="text-xs text-muted mt-2 flex flex-wrap gap-x-4">
              <span>{a.start_date ? fmtDate(a.start_date) : 'Sem início'}{a.end_date ? ` → ${fmtDate(a.end_date)}` : ''}</span>
              {a.budget != null && <span>Orçamento {money(a.budget)}{spent ? ` · listas somam ${money(spent)}` : ''}</span>}
              {nextStage && <span>Próxima etapa: <b className="text-ink">{nextStage.title}</b></span>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex -space-x-2 mr-2">{a.participants.includes('family') ? <span className="chip"><Icon name="users" size={12} />Família</span> : a.participants.map((pid) => members.find((m) => m.id === pid)).filter(Boolean).map((m) => <MemberAvatar key={m!.id} m={m} size={30} />)}</div>
            <button className="btn-ghost btn-sm" onClick={() => setEdit(true)}><Icon name="edit" size={12} />Editar</button>
            {a.status !== 'done' ? <button className="btn-moss btn-sm" onClick={finish}><Icon name="trophy" size={12} />Concluir</button> : <button className="btn-ghost btn-sm" onClick={() => st.save('adventures', { id: a.id, status: 'active', completed_at: null })}>Reabrir</button>}
            <button className="btn-ghost btn-sm" onClick={del} aria-label="Excluir aventura"><Icon name="trash" size={12} /></button>
          </div>
        </div>
        {a.description && <p className="px-4 pb-4 text-sm whitespace-pre-wrap">{a.description}</p>}
      </section>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
        <Panel title="Fases da campanha" kicker="Missões relacionadas" icon="sword" tone="terra">
          {stages.length === 0 && <p className="text-sm text-muted mb-3">Divida a aventura em etapas. O progresso é calculado automaticamente.</p>}
          <ol className="relative">
            {stages.map((t, i) => { const done = t.status === 'done'; const current = t.id === nextStage?.id; return (
              <li key={t.id} className="flex gap-3 items-stretch">
                <div className="flex flex-col items-center">
                  <button onClick={() => toggle(t)} aria-label={done ? `Reabrir ${t.title}` : `Concluir ${t.title}`} className={`w-9 h-9 grid place-items-center rounded-lg border border-line hud text-[11px] ${done ? 'bg-moss text-[rgb(var(--on-accent))]' : current ? 'bg-sun/20 text-[#B7791F] anim-float' : 'bg-panel'}`}>{done ? <Icon name="check" size={14} /> : String(i + 1).padStart(2, '0')}</button>
                  {i < stages.length - 1 && <span className={`w-[4px] flex-1 min-h-[14px] ${done ? 'bg-moss' : 'bg-line/20'}`} />}
                </div>
                <button className="flex-1 text-left pb-4" onClick={() => setTask(t)}>
                  <div className={`font-semibold ${done ? 'line-through text-muted' : ''}`}>{t.title}</div>
                  <div className="text-xs text-muted">{t.due_date ? relDay(t.due_date) : 'Sem prazo'}{current ? ' · fase atual' : ''}</div>
                </button>
              </li>
            ); })}
          </ol>
          <form onSubmit={addStage} className="flex gap-2 mt-2"><input className="field" placeholder="Nova etapa (ex.: Reservar hospedagem)" value={stage} onChange={(e) => setStage(e.target.value)} /><button className="btn-moss" disabled={!stage.trim()}><Icon name="plus" size={14} /></button></form>
        </Panel>
        <div className="space-y-4">
          <Panel title="Checkpoints" icon="flag" tone="sky" action={<button className="btn-ghost btn-sm" onClick={() => setEv({ date: a.start_date || today(), adventure_id: a.id, title: '' })}><Icon name="plus" size={12} /></button>}>
            {occs.length ? <ul className="space-y-2">{occs.slice(0, 6).map((o) => <EventRow key={o.ev.id + o.date} o={o} showDate onOpen={(x) => setEv(x.ev)} />)}</ul> : <p className="text-sm text-muted">Nenhum compromisso ligado a esta aventura.</p>}
          </Panel>
          <Panel title="Inventário" icon="bag" tone="moss" action={<button className="btn-ghost btn-sm" onClick={() => { const l = st.save('lists', { name: `${a.name}: itens`, icon: 'bag', color: '#5E7B3A', category: 'viagem', owners: ['family'], adventure_id: a.id, position: 0 }); nav(`/inventario/${l.id}`); }}><Icon name="plus" size={12} /></button>}>
            {advLists.length ? <ul className="space-y-2">{advLists.map((l) => { const s2 = listStats(items.filter((i) => i.list_id === l.id)); return <li key={l.id}><Link to={`/inventario/${l.id}`} className="flex items-center gap-2"><Icon name={l.icon as any} size={14} /><span className="flex-1 font-semibold text-sm">{l.name}</span><span className="text-xs text-muted">{s2.done}/{s2.total}</span></Link></li>; })}</ul> : <p className="text-sm text-muted">Crie uma lista para malas, compras ou checklist.</p>}
          </Panel>
          <Panel title="Anotações e links" icon="book">
            <textarea className="field min-h-[100px] mb-3" defaultValue={a.notes || ''} onBlur={(e) => e.target.value !== (a.notes || '') && st.save('adventures', { id: a.id, notes: e.target.value })} placeholder="Ideias, roteiro, contatos…" aria-label="Anotações" />
            <ul className="space-y-1 mb-2">{a.links.map((l) => <li key={l.id} className="flex items-center gap-2"><Icon name="link" size={12} /><a className="link text-sm flex-1 truncate" href={safeUrl(l.url)} target="_blank" rel="noopener noreferrer">{l.title || l.url}</a><button className="text-muted" aria-label="Remover link" onClick={() => st.save('adventures', { id: a.id, links: a.links.filter((x) => x.id !== l.id) })}><Icon name="close" size={10} /></button></li>)}</ul>
            <form className="flex gap-2 flex-wrap" onSubmit={(e) => { e.preventDefault(); if (!safeUrl(link.url)) return ui.toast('O link precisa começar com https://', 'err'); st.save('adventures', { id: a.id, links: [...a.links, { id: crypto.randomUUID(), title: link.title.trim(), url: link.url.trim() }] }); setLink({ title: '', url: '' }); }}>
              <input className="field flex-1 min-w-[100px] min-h-[36px] py-1" placeholder="Título" value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} />
              <input className="field flex-[2] min-w-[140px] min-h-[36px] py-1" placeholder="https://" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
              <button className="btn-ghost btn-sm">Adicionar</button>
            </form>
          </Panel>
        </div>
      </div>
      {edit && <AdventureEditor adv={a} onClose={() => setEdit(false)} />}
      {task && <TaskEditor task={task} onClose={() => setTask(null)} />}
      {ev && <EventEditor ev={ev} onClose={() => setEv(null)} />}
    </div>
  );
}
