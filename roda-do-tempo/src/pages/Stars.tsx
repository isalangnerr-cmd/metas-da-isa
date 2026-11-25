import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStore, useTable } from '@/data/store';
import { useMembers, useMe, useSession } from '@/data/session';
import type { Wish, WishStatus, Priority } from '@/data/types';
import { Empty, Field, Icon, Modal, PageHeader, SegBar, Segmented, useUI } from '@/components/ui';
import { AssigneeSelect, ImagePicker, Photo, safeUrl } from '@/components/forms';
import { PRIORITY, WISH_CATS, WISH_STATUS, assigneeLabel, catOf } from '@/lib/domain';
import { fmtDate, today } from '@/lib/dates';
import { money, parseMoney } from '@/lib/format';
import { TaskEditor, newTask } from './Missions';

const ACTIVE: WishStatus[] = ['dreaming', 'planning', 'progress'];

export function Stars() {
  const wishes = useTable('wishes');
  const [edit, setEdit] = useState<Partial<Wish> | null>(null);
  const [tab, setTab] = useState<'ativos' | 'realizados' | 'arquivados'>('ativos');
  const members = useMembers(); const me = useMe();
  const done = wishes.filter((w) => w.status === 'done').sort((a, b) => (b.achieved_at || '').localeCompare(a.achieved_at || ''));
  return (
    <div>
      <PageHeader world="05 · Estrelas" title="Nossos desejos" subtitle={`${wishes.filter((w) => ACTIVE.includes(w.status)).length} brilhando · ${done.length} realizados`} icon="star"
        actions={<button className="btn-primary" onClick={() => setEdit({})}><Icon name="plus" size={14} />Novo desejo</button>} />
      <div className="mb-4"><Segmented label="Mostrar" value={tab} onChange={setTab} options={[{ value: 'ativos', label: 'No céu' }, { value: 'realizados', label: 'Realizados' }, { value: 'arquivados', label: 'Arquivados' }]} /></div>
      {tab === 'ativos' && (
        wishes.some((w) => ACTIVE.includes(w.status)) ? (
          <div className="grid lg:grid-cols-3 gap-4">
            {ACTIVE.map((s) => (
              <section key={s} className="px-inset p-3">
                <h2 className="hud text-[12px] mb-3 flex items-center gap-2"><Icon name={WISH_STATUS[s].icon} size={14} />{WISH_STATUS[s].label} · {wishes.filter((w) => w.status === s).length}</h2>
                <div className="space-y-3">{wishes.filter((w) => w.status === s).sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0)).map((w) => <WishCard key={w.id} w={w} onOpen={() => setEdit(w)} owner={assigneeLabel(w.owner, members, me?.id)} />)}</div>
              </section>
            ))}
          </div>
        ) : <div className="px-box"><Empty icon="star" title="O céu está esperando" text="Um restaurante, uma viagem, algo para a casa, um grande sonho…" action={<button className="btn-primary" onClick={() => setEdit({})}>Fazer um desejo</button>} /></div>
      )}
      {tab === 'realizados' && (done.length ? (
        <ol className="space-y-3">{done.map((w) => (
          <li key={w.id} className="px-box p-4 flex items-center gap-4">
            <span className="grid place-items-center w-12 h-12 rounded-[4px] border-[3px] border-line bg-sun text-[rgb(58_42_30)]"><Icon name="trophy" size={24} /></span>
            <button className="flex-1 text-left" onClick={() => setEdit(w)}><div className="h-pixel text-lg">{w.title}</div><div className="text-xs text-muted">Realizado em {fmtDate(w.achieved_at)} · {catOf(WISH_CATS, w.category).label}</div></button>
          </li>
        ))}</ol>
      ) : <div className="px-box"><Empty icon="trophy" title="O primeiro sonho realizado vai aparecer aqui" /></div>)}
      {tab === 'arquivados' && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{wishes.filter((w) => w.status === 'archived').map((w) => <WishCard key={w.id} w={w} onOpen={() => setEdit(w)} owner={assigneeLabel(w.owner, members, me?.id)} />)}</div>}
      {edit && <WishEditor wish={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function WishCard({ w, onOpen, owner }: { w: Wish; onOpen: () => void; owner: string }) {
  const c = catOf(WISH_CATS, w.category);
  return (
    <button onClick={onOpen} className="px-box block w-full text-left overflow-hidden hover:-translate-y-[2px] transition-transform">
      {w.image_path && <Photo path={w.image_path} className="w-full h-32 object-cover border-b-[3px] border-line" />}
      <div className="p-3">
        <div className="flex items-start gap-2"><Icon name={c.icon} size={16} className="mt-1 shrink-0" style={{ color: c.color }} /><div className="h-pixel text-[17px] leading-tight flex-1">{w.title}</div>{w.priority === 'high' && <Icon name="star" size={14} className="text-sun" title="Prioridade" />}</div>
        <div className="text-xs text-muted mt-1">{owner}{w.value ? ` · ${money(w.value)}` : ''}{w.deadline ? ` · até ${fmtDate(w.deadline)}` : ''}</div>
        {w.progress > 0 && <SegBar value={w.progress / 100} className="mt-2" total={10} />}
      </div>
    </button>
  );
}

function WishEditor({ wish, onClose }: { wish: Partial<Wish>; onClose: () => void }) {
  const ui = useUI(); const st = getStore(); const s = useSession(); const nav = useNavigate();
  const [w, setW] = useState<Partial<Wish>>({ title: '', category: 'experiencia', owner: 'family', priority: 'normal', progress: 0, status: 'dreaming', ...wish });
  const [val, setVal] = useState(wish.value != null ? String(wish.value).replace('.', ',') : '');
  const [mission, setMission] = useState<any>(null);
  const set = (p: Partial<Wish>) => setW((x) => ({ ...x, ...p }));
  const build = (): Partial<Wish> | null => {
    if (!w.title?.trim()) { ui.toast('Dê um nome ao desejo', 'err'); return null; }
    const v = val.trim() ? parseMoney(val) : null;
    if (val.trim() && v == null) { ui.toast('Valor inválido', 'err'); return null; }
    if (w.link && !safeUrl(w.link)) { ui.toast('O link precisa começar com https://', 'err'); return null; }
    return { ...w, title: w.title.trim(), value: v };
  };
  const save = () => {
    const x = build(); if (!x) return;
    const becameDone = x.status === 'done' && wish.status !== 'done';
    if (becameDone) { x.achieved_at = today(); x.progress = 100; }
    if (x.status !== 'done') x.achieved_at = null;
    const r = st.save('wishes', x);
    if (becameDone) {
      if (s.family.settings.gamification) st.save('star_transactions', { amount: 5, source: 'wish', ref_id: r.id, note: r.title });
      ui.celebrate({ title: 'Sonho realizado!', sub: r.title, kind: 'wish' });
    } else ui.toast('Desejo salvo');
    onClose();
  };
  const toAdventure = () => {
    const x = build(); if (!x) return;
    const r = st.save('wishes', { ...x, status: x.status === 'dreaming' ? 'planning' : x.status });
    const a = st.save('adventures', { name: r.title, description: r.description, cover: r.category === 'viagem' ? 'beach' : 'mountain', participants: ['family'], status: 'future', budget: r.value ?? null, links: r.link ? [{ id: crypto.randomUUID(), title: 'Link do desejo', url: r.link }] : [], notes: '' });
    st.save('wishes', { id: r.id, adventure_id: a.id });
    ui.toast('Virou uma aventura!'); onClose(); nav(`/aventuras/${a.id}`);
  };
  const toMission = () => {
    const x = build(); if (!x) return;
    const r = st.save('wishes', x);
    setMission(newTask({ title: r.title, assignee: r.owner, category: 'pessoal', wish_id: r.id, due_date: r.deadline || null, stars: s.family.settings.gamification ? 2 : 0 }));
  };
  if (mission) return <TaskEditor task={mission} onClose={onClose} />;
  return (
    <Modal open onClose={onClose} title={wish.id ? 'Desejo' : 'Novo desejo'} wide footer={<>
      {wish.id && <button className="btn-ghost btn-sm mr-auto" onClick={async () => { if (await ui.confirm({ title: 'Excluir desejo?', ok: 'Excluir', danger: true })) { st.remove('wishes', wish.id!); onClose(); } }}><Icon name="trash" size={12} />Excluir</button>}
      <button className="btn-ghost btn-sm" onClick={toMission}><Icon name="sword" size={12} />Virar missão</button>
      {!w.adventure_id && <button className="btn-ghost btn-sm" onClick={toAdventure}><Icon name="map" size={12} />Virar aventura</button>}
      <button className="btn-primary" onClick={save}>Salvar</button></>}>
      <div className="space-y-4">
        <Field label="Desejo"><input className="field text-lg font-semibold" value={w.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Conhecer aquele restaurante" /></Field>
        <div><span className="label">Status</span><Segmented label="Status" value={w.status!} onChange={(v) => set({ status: v })} options={(Object.keys(WISH_STATUS) as WishStatus[]).map((k) => ({ value: k, label: WISH_STATUS[k].label }))} /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Categoria"><select className="field" value={w.category} onChange={(e) => set({ category: e.target.value })}>{WISH_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
          <Field label="Valor estimado (R$)"><input className="field" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder="0,00" /></Field>
        </div>
        <div><span className="label">De quem é o desejo</span><AssigneeSelect value={w.owner || 'family'} onChange={(v) => set({ owner: v })} includeKids /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><span className="label">Prioridade</span><Segmented label="Prioridade" value={w.priority!} onChange={(v) => set({ priority: v })} options={(Object.keys(PRIORITY) as Priority[]).map((p) => ({ value: p, label: PRIORITY[p].label }))} /></div>
          <Field label="Prazo (opcional)"><input type="date" className="field" value={w.deadline || ''} onChange={(e) => set({ deadline: e.target.value || null })} /></Field>
        </div>
        <Field label={`Progresso: ${w.progress}%`}><input type="range" min={0} max={100} step={5} className="w-full accent-[rgb(var(--moss))]" value={w.progress} onChange={(e) => set({ progress: +e.target.value })} /></Field>
        <Field label="Descrição"><textarea className="field" value={w.description || ''} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Link"><input type="url" className="field" value={w.link || ''} onChange={(e) => set({ link: e.target.value })} placeholder="https://" /></Field>
        <ImagePicker value={w.image_path} onChange={(p) => set({ image_path: p })} />
        {w.achieved_at && <p className="text-sm text-moss font-semibold">Realizado em {fmtDate(w.achieved_at)}</p>}
      </div>
    </Modal>
  );
}
