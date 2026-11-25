import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getStore, useTable } from '@/data/store';
import { useMembers, useMe, useSession } from '@/data/session';
import type { Message, MessageKind } from '@/data/types';
import { Empty, Field, Icon, Modal, PageHeader, Segmented, useUI } from '@/components/ui';
import { MemberAvatar } from '@/components/Avatar';
import { MESSAGE_KINDS } from '@/lib/domain';
import { addDays, addYears, diffDays, fmtDate, fmtDateLong, today, isValidDate } from '@/lib/dates';
import { plural } from '@/lib/format';

export const isLocked = (m: Message, ref = today()) => !!m.open_at && m.open_at > ref;

export function Mail() {
  const msgs = useTable('messages');
  const me = useMe();
  const members = useMembers();
  const s = useSession();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'entrada' | 'enviadas' | 'capsulas'>('entrada');
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState<Message | null>(null);
  const st = getStore();

  const forMe = (m: Message) => m.recipient_id === me?.id || m.recipient_id === 'family' || members.find((x) => x.id === m.recipient_id)?.kind !== 'adult';
  const inbox = msgs.filter((m) => m.sender_id !== me?.id && forMe(m) && !isLocked(m)).sort((a, b) => (b.open_at || b.created_at).localeCompare(a.open_at || a.created_at));
  const sent = msgs.filter((m) => m.sender_id === me?.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const capsules = msgs.filter((m) => isLocked(m)).sort((a, b) => a.open_at!.localeCompare(b.open_at!));
  const unread = inbox.filter((m) => !m.read_at).length;

  useEffect(() => {
    const ids = msgs.filter((m) => !isLocked(m) || m.sender_id === me?.id).map((m) => m.id);
    st.loadBodies(ids).catch(() => {});
  }, [msgs, me?.id, st]);
  useEffect(() => { const id = params.get('m'); if (id) { const m = msgs.find((x) => x.id === id); if (m) setOpen(m); params.delete('m'); setParams(params, { replace: true }); } }, [params, msgs, setParams]);
  useEffect(() => { if (params.get('nova')) { setCompose(true); params.delete('nova'); setParams(params, { replace: true }); } }, [params, setParams]);

  const list = tab === 'entrada' ? inbox : tab === 'enviadas' ? sent : capsules;
  return (
    <div>
      <PageHeader world="07 · Correio" title="Mensagens no tempo" subtitle={unread ? `${plural(unread, 'carta nova', 'cartas novas')} na caixa` : 'Bilhetes, cartas e cápsulas do tempo'} icon="mail"
        actions={<button className="btn-primary" onClick={() => setCompose(true)}><Icon name="edit" size={14} />Escrever carta</button>} />
      <div className="mb-4"><Segmented label="Caixa" value={tab} onChange={setTab} options={[{ value: 'entrada', label: `Recebidas${unread ? ` · ${unread}` : ''}` }, { value: 'enviadas', label: 'Enviadas' }, { value: 'capsulas', label: `Cápsulas · ${capsules.length}` }]} /></div>
      {list.length === 0 ? <div className="px-box"><Empty icon="mail" title={tab === 'capsulas' ? 'Nenhuma cápsula guardada' : 'Caixa vazia'} text={tab === 'capsulas' ? 'Escreva algo para ser aberto daqui a um ano, aos 18 anos dela, no próximo aniversário de casamento…' : 'Que tal um bilhete de carinho?'} action={<button className="btn-primary" onClick={() => setCompose(true)}>Escrever</button>} /></div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((m) => <Envelope key={m.id} m={m} onOpen={() => setOpen(m)} mine={m.sender_id === me?.id} />)}
        </div>
      )}
      {s.mode === 'local' && <p className="text-xs text-muted mt-6">No modo “neste aparelho”, a trava das cápsulas é feita pelo app. Com o servidor ativo, o próprio banco só libera o conteúdo na data.</p>}
      {compose && <Compose onClose={() => setCompose(false)} />}
      {open && <Letter m={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Envelope({ m, onOpen, mine }: { m: Message; onOpen: () => void; mine: boolean }) {
  const members = useMembers();
  const from = members.find((x) => x.id === m.sender_id);
  const to = m.recipient_id === 'family' ? null : members.find((x) => x.id === m.recipient_id);
  const locked = isLocked(m);
  const k = MESSAGE_KINDS[m.kind];
  const days = m.open_at ? diffDays(m.open_at, today()) : 0;
  return (
    <button onClick={onOpen} className={`relative text-left px-box p-0 overflow-hidden hover:-translate-y-[2px] transition-transform ${!m.read_at && !mine && !locked ? 'ring-2 ring-sky' : ''}`}>
      {/* aba do envelope */}
      <svg viewBox="0 0 100 30" className="w-full h-12 block" preserveAspectRatio="none" aria-hidden><polygon points="0,0 100,0 50,30" fill={k.color} opacity=".85" /><polyline points="0,0 50,30 100,0" fill="none" stroke="rgb(var(--line))" strokeWidth="2" /></svg>
      <div className="px-4 pb-4 -mt-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0"><div className="hud text-[10px]" style={{ color: k.color }}>{k.label}</div><div className="h-pixel text-lg leading-tight truncate">{m.title}</div></div>
          <span className="w-10 h-12 grid place-items-center border-2 border-dashed border-line/50 rounded-md bg-panel2 shrink-0" aria-hidden><Icon name={(['heart', 'star', 'sparkle', 'paw', 'sun'] as const)[m.stamp % 5]} size={18} className="text-terra" /></span>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted">
          {from && <MemberAvatar m={from} size={24} />}<span>{from?.nickname || from?.name}</span><Icon name="right" size={10} /><span>{to ? to.nickname || to.name : 'Família'}</span>
          {m.private && <Icon name="lock" size={11} title="Privada" />}
        </div>
        {locked ? <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-plum"><Icon name="lock" size={14} />Abre em {fmtDate(m.open_at)} · {plural(days, 'dia', 'dias')}</div>
          : <div className="mt-3 text-xs text-muted">{m.open_at ? `Aberta em ${fmtDate(m.open_at)}` : fmtDate(m.created_at.slice(0, 10))}{!m.read_at && !mine ? ' · nova' : ''}</div>}
      </div>
    </button>
  );
}

function Letter({ m, onClose }: { m: Message; onClose: () => void }) {
  const st = getStore(); const me = useMe(); const members = useMembers(); const ui = useUI();
  useTable('messages');
  const body = st.body(m.id);
  const mine = m.sender_id === me?.id;
  const locked = isLocked(m);
  const from = members.find((x) => x.id === m.sender_id);
  useEffect(() => {
    if (!mine && !locked && !m.read_at) st.save('messages', { id: m.id, read_at: new Date().toISOString() }, { update: true });
  }, [m.id, mine, locked, m.read_at, st]);
  const del = async () => { if (await ui.confirm({ title: 'Apagar carta?', text: 'Ela some para todos.', ok: 'Apagar', danger: true })) { st.remove('messages', m.id); onClose(); } };
  return (
    <Modal open onClose={onClose} title={MESSAGE_KINDS[m.kind].label} footer={<>{mine && <button className="btn-ghost btn-sm mr-auto" onClick={del}><Icon name="trash" size={12} />Apagar</button>}<button className="btn-primary" onClick={onClose}>Fechar</button></>}>
      {locked && !mine ? (
        <div className="text-center py-6">
          <div className="inline-grid place-items-center w-20 h-20 rounded-xl border border-line bg-plum text-white mb-3 anim-shake"><Icon name="lock" size={36} /></div>
          <div className="h-pixel text-2xl">Ainda não é hora</div>
          <p className="text-sm text-muted mt-1">Esta cápsula de {from?.nickname || from?.name} abre em <b>{fmtDateLong(m.open_at!)}</b>.</p>
        </div>
      ) : (
        <article className="px-inset p-5 anim-pop bg-[repeating-linear-gradient(transparent,transparent_27px,rgb(var(--line)/.08)_28px)]">
          <div className="hud text-[10px] text-muted">{fmtDateLong(m.created_at.slice(0, 10))}</div>
          <h3 className="h-pixel text-2xl mb-3">{m.title}</h3>
          {body == null ? <p className="text-muted text-sm">{locked && mine ? 'Você guardou esta carta. Ela ficará trancada para os outros até a data.' : 'Carregando conteúdo…'}</p> : <p className="whitespace-pre-wrap leading-7 text-[15px]">{body}</p>}
          {locked && mine && body != null && <p className="text-xs text-plum mt-3 flex items-center gap-1"><Icon name="lock" size={11} />Trancada para os outros até {fmtDate(m.open_at)}.</p>}
          <div className="mt-4 text-right font-semibold">— {from?.nickname || from?.name}</div>
        </article>
      )}
    </Modal>
  );
}

function Compose({ onClose }: { onClose: () => void }) {
  const me = useMe(); const members = useMembers(); const ui = useUI(); const st = getStore();
  const [to, setTo] = useState<string>(members.find((m) => m.kind === 'adult' && m.id !== me?.id)?.id || 'family');
  const [kind, setKind] = useState<MessageKind>('note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [openAt, setOpenAt] = useState('');
  const [priv, setPriv] = useState(false);
  const toMember = members.find((m) => m.id === to);
  const canPrivate = toMember?.kind === 'adult' && toMember.id !== me?.id;
  const presets = useMemo(() => {
    const out: [string, string][] = [['Amanhã', addDays(today(), 1)], ['Daqui a 1 ano', addYears(today(), 1)], ['Daqui a 5 anos', addYears(today(), 5)]];
    for (const k of members.filter((m) => m.kind === 'child' && m.birth_date)) out.push([`Aos 18 anos de ${k.nickname || k.name}`, addYears(k.birth_date!, 18)]);
    return out;
  }, [members]);
  const send = () => {
    if (!me) return ui.toast('Seu perfil não foi encontrado', 'err');
    if (!title.trim() || !body.trim()) return ui.toast('Escreva um título e a mensagem', 'err');
    if (openAt && (!isValidDate(openAt) || openAt <= today())) return ui.toast('A data de abertura precisa ser no futuro', 'err');
    st.save('messages', { sender_id: me.id, recipient_id: to, kind, title: title.trim(), body: body.trim(), open_at: openAt || null, private: canPrivate && priv, stamp: Math.floor(Math.random() * 100) } as any);
    ui.celebrate({ title: openAt ? 'Cápsula guardada!' : 'Carta enviada!', sub: openAt ? `Abre em ${fmtDate(openAt)}` : undefined, kind: openAt ? 'wish' : 'mission' });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Escrever carta" wide footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={send}><Icon name="mail" size={14} />{openAt ? 'Guardar cápsula' : 'Enviar'}</button></>}>
      <div className="space-y-4">
        <div><span className="label">Para</span>
          <div className="flex flex-wrap gap-2">
            {members.filter((m) => m.id !== me?.id).map((m) => <button key={m.id} type="button" aria-pressed={to === m.id} onClick={() => setTo(m.id)} className={`flex items-center gap-2 pl-1 pr-3 py-1 min-h-[44px] rounded-xl border-2 ${to === m.id ? 'border-sky bg-sky/10' : 'border-line/30'}`}><MemberAvatar m={m} size={30} ring={false} /><span className="text-sm font-semibold">{m.nickname || m.name}</span></button>)}
            <button type="button" aria-pressed={to === 'family'} onClick={() => setTo('family')} className={`flex items-center gap-2 px-3 min-h-[44px] rounded-xl border-2 ${to === 'family' ? 'border-sky bg-sky/10' : 'border-line/30'}`}><Icon name="users" size={18} /><span className="text-sm font-semibold">Família toda</span></button>
          </div>
        </div>
        <Field label="Tipo"><select className="field" value={kind} onChange={(e) => setKind(e.target.value as MessageKind)}>{(Object.keys(MESSAGE_KINDS) as MessageKind[]).map((k) => <option key={k} value={k}>{MESSAGE_KINDS[k].label}</option>)}</select></Field>
        <Field label="Título"><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Ex.: Obrigado por hoje" /></Field>
        <Field label="Mensagem"><textarea className="field min-h-[180px] leading-7" value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} /></Field>
        <div>
          <Field label="Abrir só a partir de (opcional)"><input type="date" className="field" min={addDays(today(), 1)} value={openAt} onChange={(e) => setOpenAt(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-2 mt-2">{presets.map(([l, d]) => <button key={l} type="button" className="btn-ghost btn-sm" onClick={() => setOpenAt(d)}>{l}</button>)}{openAt && <button type="button" className="btn-ghost btn-sm" onClick={() => setOpenAt('')}>Sem trava</button>}</div>
        </div>
        {canPrivate && <label className="flex items-center gap-2"><input type="checkbox" className="px-check" checked={priv} onChange={(e) => setPriv(e.target.checked)} /><span className="text-sm"><b>Privada</b>: só você e {toMember!.nickname || toMember!.name} podem ver</span></label>}
      </div>
    </Modal>
  );
}
