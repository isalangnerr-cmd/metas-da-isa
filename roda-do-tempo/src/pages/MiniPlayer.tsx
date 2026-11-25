import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getStore, useTable } from '@/data/store';
import { useMembers, useMe } from '@/data/session';
import type { ChildRecord, ChildRecordKind, Member, Memory } from '@/data/types';
import { Empty, Field, Icon, Modal, PageHeader, Panel, Segmented, useUI } from '@/components/ui';
import { ImagePicker, Photo, safeUrl } from '@/components/forms';
import { MemberAvatar } from '@/components/Avatar';
import { CHILD_KINDS, MOMENT_CATS } from '@/lib/domain';
import { ageText, fmtDate, fmtDateLong, today, relDay, isValidDate } from '@/lib/dates';
import { normalize } from '@/lib/format';
import { DEFAULT_AVATARS } from '@/game/sprites';
import { MemberEditor } from './Family';

type Tab = 'perfil' | 'linha' | 'cuidados' | 'diario';

export function MiniPlayer() {
  const members = useMembers();
  const kids = members.filter((m) => m.kind === 'child');
  const [params] = useSearchParams();
  const [kidId, setKidId] = useState<string | undefined>(kids[0]?.id);
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'linha');
  const [editKid, setEditKid] = useState<Partial<Member> | null>(null);
  useEffect(() => { if (!kidId && kids[0]) setKidId(kids[0].id); }, [kids, kidId]);
  const kid = kids.find((k) => k.id === kidId) || kids[0];

  if (!kid) return (
    <div>
      <PageHeader world="04 · Mini player" title="O mundo dela" icon="rattle" />
      <div className="px-box"><Empty icon="rattle" title="Adicione o perfil da pequena" text="O perfil da filha não precisa de conta: ele é só da família." action={<button className="btn-primary" onClick={() => setEditKid({ kind: 'child', name: 'Eliza', nickname: 'Liz', color: '#E9B949', avatar: DEFAULT_AVATARS.child })}>Criar perfil</button>} /></div>
      {editKid && <MemberEditor member={editKid} onClose={() => setEditKid(null)} />}
    </div>
  );
  const name = kid.nickname || kid.name;

  return (
    <div>
      <PageHeader world="04 · Mini player" title={`O mundo de ${name}`} subtitle={kid.birth_date ? `${ageText(kid.birth_date)} de aventura` : undefined} icon="rattle"
        actions={kids.length > 1 ? <select className="field w-auto" value={kid.id} onChange={(e) => setKidId(e.target.value)}>{kids.map((k) => <option key={k.id} value={k.id}>{k.nickname || k.name}</option>)}</select> : undefined} />
      <div className="scroll-x mb-4"><Segmented label="Seções" value={tab} onChange={setTab} options={[{ value: 'linha', label: 'Linha do tempo' }, { value: 'cuidados', label: 'Rotina e saúde' }, { value: 'diario', label: 'Diário' }, { value: 'perfil', label: 'Perfil' }]} /></div>
      {tab === 'perfil' && <Profile kid={kid} onEdit={() => setEditKid(kid)} />}
      {tab === 'linha' && <Timeline kid={kid} />}
      {tab === 'cuidados' && <Care kid={kid} />}
      {tab === 'diario' && <Diary kid={kid} />}
      {editKid && <MemberEditor member={editKid} onClose={() => setEditKid(null)} />}
      <p className="text-xs text-muted mt-6 flex items-center gap-1"><Icon name="lock" size={12} />Visível só para os adultos da família. Registros de saúde são apenas organizacionais e não substituem orientação médica.</p>
    </div>
  );
}

function Profile({ kid, onEdit }: { kid: Member; onEdit: () => void }) {
  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4">
      <div className="px-box p-5 text-center bg-[linear-gradient(rgb(var(--sun)/.25),transparent)]">
        <div className="flex justify-center mb-3"><MemberAvatar m={kid} size={120} photo /></div>
        <div className="h-pixel text-2xl">{kid.name}</div>
        {kid.nickname && <div className="text-muted">“{kid.nickname}”</div>}
        {kid.birth_date && <div className="mt-2 text-sm"><b>{ageText(kid.birth_date)}</b><br /><span className="text-muted">nasceu em {fmtDate(kid.birth_date)}</span></div>}
        <button className="btn-ghost btn-sm mt-4" onClick={onEdit}><Icon name="edit" size={12} />Editar perfil</button>
      </div>
      <Panel title="Informações importantes" icon="heart" tone="terra">
        {kid.info?.length ? (
          <dl className="grid sm:grid-cols-2 gap-3">{kid.info.map((i, k) => <div key={k} className="px-inset p-3"><dt className="label">{i.label}</dt><dd className="font-semibold whitespace-pre-wrap">{i.value}</dd></div>)}</dl>
        ) : <Empty icon="list" title="Nada anotado ainda" text="Tipo sanguíneo, alergias, pediatra, escola, tamanho de roupa e calçado…" action={<button className="btn-ghost" onClick={onEdit}>Adicionar informações</button>} />}
      </Panel>
    </div>
  );
}

function Timeline({ kid }: { kid: Member }) {
  const recs = useTable('child_records');
  const [edit, setEdit] = useState<Partial<ChildRecord> | null>(null);
  const [cat, setCat] = useState('all');
  const moments = recs.filter((r) => r.member_id === kid.id && r.kind === 'moment' && (cat === 'all' || r.category === cat)).sort((a, b) => b.date.localeCompare(a.date));
  const years = [...new Set(moments.map((m) => m.date.slice(0, 4)))];
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button className="btn-primary" onClick={() => setEdit({ kind: 'moment', member_id: kid.id, date: today(), category: MOMENT_CATS[0] })}><Icon name="plus" size={14} />Registrar momento</button>
        <select className="field w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrar categoria"><option value="all">Todos os momentos</option>{MOMENT_CATS.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      {moments.length === 0 ? <div className="px-box"><Empty icon="star" title="A primeira fase começa aqui" text="Primeiros passos, palavras, viagens, descobertas…" /></div> : (
        <div className="relative pl-6">
          <div className="absolute left-[9px] top-2 bottom-2 w-[4px] bg-line/20 rounded" />
          {years.map((y) => (
            <div key={y} className="mb-6">
              <div className="relative -ml-6 mb-3 flex items-center gap-2"><span className="w-[22px] h-[22px] rounded-[4px] border-[3px] border-line bg-sun" /><span className="h-pixel text-xl">{y}</span></div>
              <ul className="space-y-3">
                {moments.filter((m) => m.date.startsWith(y)).map((m) => (
                  <li key={m.id} className="relative">
                    <span className="absolute -left-[21px] top-4 w-3 h-3 bg-terra border-2 border-line" />
                    <button className="px-box p-4 w-full text-left flex gap-3 hover:-translate-y-[1px] transition-transform" onClick={() => setEdit(m)}>
                      {m.media_path && <Photo path={m.media_path} className="w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-[4px] border-2 border-line shrink-0" />}
                      <div className="min-w-0">
                        <div className="hud text-[10px] text-terra">{m.category} · {fmtDate(m.date)}{kid.birth_date ? ` · ${ageText(kid.birth_date, m.date)}` : ''}</div>
                        <div className="h-pixel text-lg leading-tight">{m.title}</div>
                        {m.description && <p className="text-sm mt-1 line-clamp-3 whitespace-pre-wrap">{m.description}</p>}
                        {safeUrl(m.data?.link) && <span className="text-xs link">link</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {edit && <RecordEditor rec={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

const CARE_KINDS: ChildRecordKind[] = ['consult', 'vaccine', 'growth', 'food', 'sleep', 'school', 'medicine', 'reminder'];
function Care({ kid }: { kid: Member }) {
  const recs = useTable('child_records');
  const [kind, setKind] = useState<ChildRecordKind | 'all'>('all');
  const [edit, setEdit] = useState<Partial<ChildRecord> | null>(null);
  const mine = recs.filter((r) => r.member_id === kid.id && r.kind !== 'moment');
  const list = mine.filter((r) => kind === 'all' || r.kind === kind).sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
  const t = today();
  const upcoming = mine.filter((r) => (r.date >= t && ['consult', 'vaccine', 'reminder', 'school'].includes(r.kind)) || (r.data?.next_date && r.data.next_date >= t)).sort((a, b) => (a.data?.next_date && a.date < t ? a.data.next_date : a.date).localeCompare(b.data?.next_date && b.date < t ? b.data.next_date : b.date));
  const growth = mine.filter((r) => r.kind === 'growth').sort((a, b) => a.date.localeCompare(b.date));
  const last = growth[growth.length - 1];
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {CARE_KINDS.map((k) => <button key={k} className="px-box-flat p-3 flex items-center gap-2 text-left hover:bg-panel2" onClick={() => setEdit({ kind: k, member_id: kid.id, date: today(), title: k === 'growth' ? 'Medição' : '' })}><Icon name={CHILD_KINDS[k].icon} size={16} className="text-terra" /><span className="text-sm font-semibold">+ {CHILD_KINDS[k].label}</span></button>)}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Próximos cuidados" icon="bell" tone="sun">
          {upcoming.length ? <ul className="space-y-2">{upcoming.slice(0, 6).map((r) => { const d = r.date >= t ? r.date : r.data!.next_date!; return (
            <li key={r.id}><button className="w-full text-left flex items-center gap-2" onClick={() => setEdit(r)}><Icon name={CHILD_KINDS[r.kind].icon} size={14} /><span className="flex-1 font-semibold text-sm">{r.title}</span><span className="text-xs text-muted">{relDay(d)}{r.time ? ` · ${r.time}` : ''}</span></button></li>
          ); })}</ul> : <p className="text-sm text-muted">Nenhuma consulta, vacina ou lembrete futuro.</p>}
        </Panel>
        <Panel title="Crescimento" icon="up" tone="moss">
          {last ? (
            <div>
              <div className="flex gap-6 mb-3">
                {last.data?.weight != null && <div><div className="label">Peso</div><div className="h-pixel text-2xl">{String(last.data.weight).replace('.', ',')} kg</div></div>}
                {last.data?.height != null && <div><div className="label">Altura</div><div className="h-pixel text-2xl">{String(last.data.height).replace('.', ',')} cm</div></div>}
              </div>
              <table className="w-full text-sm"><thead><tr className="text-left text-muted"><th className="font-normal">Data</th><th className="font-normal">Peso</th><th className="font-normal">Altura</th></tr></thead>
                <tbody>{growth.slice(-6).reverse().map((g) => <tr key={g.id} className="border-t border-line/10"><td className="py-1">{fmtDate(g.date)}</td><td>{g.data?.weight != null ? `${String(g.data.weight).replace('.', ',')} kg` : '—'}</td><td>{g.data?.height != null ? `${String(g.data.height).replace('.', ',')} cm` : '—'}</td></tr>)}</tbody></table>
            </div>
          ) : <p className="text-sm text-muted">Registre peso e altura nas consultas para acompanhar aqui.</p>}
        </Panel>
      </div>
      <Panel title="Registros" icon="list" action={<select className="field w-auto min-h-[36px] py-1 text-sm" value={kind} onChange={(e) => setKind(e.target.value as any)} aria-label="Filtrar tipo"><option value="all">Todos</option>{CARE_KINDS.map((k) => <option key={k} value={k}>{CHILD_KINDS[k].label}</option>)}</select>}>
        {list.length ? <ul className="divide-y-2 divide-line/10">{list.map((r) => (
          <li key={r.id}><button className="w-full text-left py-2 flex items-start gap-3" onClick={() => setEdit(r)}>
            <span className="grid place-items-center w-8 h-8 rounded-[4px] border-2 border-line bg-panel2 shrink-0"><Icon name={CHILD_KINDS[r.kind].icon} size={14} /></span>
            <span className="flex-1 min-w-0"><span className="block font-semibold text-sm">{r.title}</span><span className="block text-xs text-muted">{CHILD_KINDS[r.kind].label} · {fmtDate(r.date)}{r.time ? ` ${r.time}` : ''}{r.data?.dose ? ` · ${r.data.dose}` : ''}</span>{r.description && <span className="block text-xs mt-1 line-clamp-2">{r.description}</span>}</span>
          </button></li>
        ))}</ul> : <Empty icon="list" title="Sem registros" />}
      </Panel>
      {edit && <RecordEditor rec={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function RecordEditor({ rec, onClose }: { rec: Partial<ChildRecord>; onClose: () => void }) {
  const ui = useUI(); const st = getStore();
  const [r, setR] = useState<Partial<ChildRecord>>({ data: {}, ...rec });
  const set = (p: Partial<ChildRecord>) => setR((x) => ({ ...x, ...p }));
  const setD = (p: Partial<NonNullable<ChildRecord['data']>>) => setR((x) => ({ ...x, data: { ...(x.data || {}), ...p } }));
  const k = r.kind!;
  const save = () => {
    if (!r.title?.trim()) return ui.toast('Dê um título ao registro', 'err');
    if (!isValidDate(r.date)) return ui.toast('Data inválida', 'err');
    if (r.data?.link && !safeUrl(r.data.link)) return ui.toast('O link precisa começar com https://', 'err');
    st.save('child_records', { ...r, title: r.title.trim() }); ui.toast('Registro salvo'); onClose();
  };
  const num = (v: string) => (v === '' ? null : Math.max(0, parseFloat(v.replace(',', '.'))));
  return (
    <Modal open onClose={onClose} title={CHILD_KINDS[k].label} footer={<>
      {rec.id && <button className="btn-ghost btn-sm mr-auto" onClick={async () => { if (await ui.confirm({ title: 'Excluir registro?', ok: 'Excluir', danger: true })) { st.remove('child_records', rec.id!); onClose(); } }}><Icon name="trash" size={12} />Excluir</button>}
      <button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}>
      <div className="space-y-3">
        <Field label="Título"><input className="field" value={r.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder={k === 'moment' ? 'Ex.: Deu os primeiros passos!' : k === 'vaccine' ? 'Nome da vacina' : ''} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><input type="date" className="field" value={r.date || ''} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Horário"><input type="time" className="field" value={r.time || ''} onChange={(e) => set({ time: e.target.value || null })} /></Field>
        </div>
        {k === 'moment' && <Field label="Categoria"><select className="field" value={r.category} onChange={(e) => set({ category: e.target.value })}>{MOMENT_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>}
        {k === 'growth' && <div className="grid grid-cols-2 gap-3">
          <Field label="Peso (kg)"><input className="field" inputMode="decimal" defaultValue={r.data?.weight ?? ''} onChange={(e) => setD({ weight: num(e.target.value) })} /></Field>
          <Field label="Altura (cm)"><input className="field" inputMode="decimal" defaultValue={r.data?.height ?? ''} onChange={(e) => setD({ height: num(e.target.value) })} /></Field>
        </div>}
        {(k === 'vaccine' || k === 'medicine') && <Field label={k === 'vaccine' ? 'Dose' : 'Dose e horário informados pelos responsáveis'}><input className="field" value={r.data?.dose || ''} onChange={(e) => setD({ dose: e.target.value })} /></Field>}
        {(k === 'vaccine' || k === 'consult' || k === 'medicine') && <Field label="Próxima data (opcional)" hint="Gera um lembrete"><input type="date" className="field" value={r.data?.next_date || ''} onChange={(e) => setD({ next_date: e.target.value || null })} /></Field>}
        <Field label={k === 'moment' ? 'A história' : 'Anotações'}><textarea className="field min-h-[100px]" value={r.description || ''} onChange={(e) => set({ description: e.target.value })} /></Field>
        {k === 'moment' && <Field label="Vídeo ou link (opcional)"><input className="field" type="url" value={r.data?.link || ''} onChange={(e) => setD({ link: e.target.value })} placeholder="https://" /></Field>}
        {safeUrl(r.data?.link) && <a className="link text-sm" href={safeUrl(r.data?.link)} target="_blank" rel="noopener noreferrer">Abrir link</a>}
        <ImagePicker value={r.media_path} onChange={(p) => set({ media_path: p })} label="Foto" />
      </div>
    </Modal>
  );
}

function Diary({ kid }: { kid: Member }) {
  const mems = useTable('memories');
  const members = useMembers();
  const me = useMe();
  const [q, setQ] = useState('');
  const [year, setYear] = useState('all');
  const [edit, setEdit] = useState<Partial<Memory> | null>(null);
  const [read, setRead] = useState<Memory | null>(null);
  const mine = mems.filter((m) => m.member_id === kid.id || !m.member_id);
  const years = [...new Set(mine.map((m) => m.date.slice(0, 4)))].sort().reverse();
  const list = useMemo(() => {
    const nq = normalize(q.trim());
    return mine.filter((m) => (year === 'all' || m.date.startsWith(year)) && (!nq || normalize(`${m.title} ${m.body} ${m.tags.join(' ')}`).includes(nq))).sort((a, b) => b.date.localeCompare(a.date));
  }, [mine, q, year]);
  // "neste dia" em anos anteriores
  const md = today().slice(5);
  const onThisDay = mine.filter((m) => m.date.slice(5) === md && m.date.slice(0, 4) !== today().slice(0, 4));
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button className="btn-primary" onClick={() => setEdit({ member_id: kid.id, date: today(), body: '', tags: [], author_id: me?.id })}><Icon name="edit" size={14} />Escrever memória</button>
        <div className="flex-1 min-w-[200px] relative"><Icon name="search" size={14} className="absolute left-3 top-[15px] text-muted" /><input className="field pl-9" placeholder="Pesquisar memórias" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar" /></div>
        <select className="field w-auto" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Ano"><option value="all">Todos os anos</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
      </div>
      {onThisDay.length > 0 && <div className="px-box p-4 mb-4 bg-sun/20"><div className="hud text-[11px] text-terra mb-1">Neste dia, em outros anos</div>{onThisDay.map((m) => <button key={m.id} className="block link font-semibold" onClick={() => setRead(m)}>{m.title} ({m.date.slice(0, 4)})</button>)}</div>}
      {list.length === 0 ? <div className="px-box"><Empty icon="book" title={q ? 'Nada encontrado' : 'O diário está em branco'} text="Pequenos relatos da infância, para revisitar depois." /></div> : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((m) => { const a = members.find((x) => x.id === m.author_id); return (
            <button key={m.id} className="px-box p-4 text-left hover:-translate-y-[1px] transition-transform" onClick={() => setRead(m)}>
              <div className="hud text-[10px] text-muted">{fmtDate(m.date)}{a ? ` · por ${a.nickname || a.name}` : ''}</div>
              <div className="h-pixel text-lg leading-tight">{m.title}</div>
              <p className="text-sm mt-1 line-clamp-3 whitespace-pre-wrap">{m.body}</p>
              {m.tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{m.tags.map((t) => <span key={t} className="chip">#{t}</span>)}</div>}
            </button>
          ); })}
        </div>
      )}
      {read && (
        <Modal open onClose={() => setRead(null)} title={read.title} footer={<><button className="btn-ghost" onClick={() => { setEdit(read); setRead(null); }}><Icon name="edit" size={12} />Editar</button><button className="btn-primary" onClick={() => setRead(null)}>Fechar</button></>}>
          <div className="hud text-[11px] text-muted mb-2 first-letter:uppercase">{fmtDateLong(read.date)}</div>
          {read.media_path && <Photo path={read.media_path} className="w-full max-h-80 object-cover rounded-[4px] border-2 border-line mb-3" />}
          <p className="whitespace-pre-wrap leading-relaxed">{read.body}</p>
        </Modal>
      )}
      {edit && <MemoryEditor mem={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function MemoryEditor({ mem, onClose }: { mem: Partial<Memory>; onClose: () => void }) {
  const ui = useUI(); const st = getStore();
  const [m, setM] = useState<Partial<Memory>>(mem);
  const [tags, setTags] = useState((mem.tags || []).join(', '));
  const set = (p: Partial<Memory>) => setM((x) => ({ ...x, ...p }));
  const save = () => {
    if (!m.title?.trim()) return ui.toast('Dê um título à memória', 'err');
    st.save('memories', { ...m, title: m.title.trim(), tags: tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean).slice(0, 12) });
    ui.toast('Memória guardada'); onClose();
  };
  return (
    <Modal open onClose={onClose} title={mem.id ? 'Editar memória' : 'Nova memória'} wide footer={<>
      {mem.id && <button className="btn-ghost btn-sm mr-auto" onClick={async () => { if (await ui.confirm({ title: 'Apagar memória?', text: 'Isso não pode ser desfeito.', ok: 'Apagar', danger: true })) { st.remove('memories', mem.id!); onClose(); } }}><Icon name="trash" size={12} />Apagar</button>}
      <button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Guardar</button></>}>
      <div className="space-y-3">
        <div className="grid sm:grid-cols-[1fr_180px] gap-3">
          <Field label="Título"><input className="field" value={m.title || ''} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Data"><input type="date" className="field" value={m.date || ''} onChange={(e) => set({ date: e.target.value })} /></Field>
        </div>
        <Field label="Relato"><textarea className="field min-h-[200px] leading-relaxed" value={m.body || ''} onChange={(e) => set({ body: e.target.value })} placeholder="Hoje ela…" /></Field>
        <Field label="Marcadores" hint="Separe por vírgula: praia, vovó, primeira vez"><input className="field" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        <ImagePicker value={m.media_path} onChange={(p) => set({ media_path: p })} label="Foto" />
      </div>
    </Modal>
  );
}
