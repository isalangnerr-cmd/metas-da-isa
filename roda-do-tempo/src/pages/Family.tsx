import { useEffect, useState } from 'react';
import { getStore, useTable } from '@/data/store';
import { useMembers, useMe, useSession } from '@/data/session';
import { supabase } from '@/data/supabase';
import type { Member, MemberKind, NotifType } from '@/data/types';
import { Field, Icon, Modal, PageHeader, Panel, Segmented, useUI } from '@/components/ui';
import { ImagePicker } from '@/components/forms';
import { MemberAvatar, Sprite, avatarOf } from '@/components/Avatar';
import { ACCESSORIES, DEFAULT_AVATARS, HAIRS, HAIR_STYLES, PANTS, SHIRTS, SKINS } from '@/game/sprites';
import { ACHIEVEMENTS, COLORS, COSMETICS, starTotals } from '@/lib/domain';
import { downloadText, toICS } from '@/lib/ics';
import { enablePush, disablePush, pushSupported, notifSupported } from '@/lib/pwa';
import { ageText, fmtDate, today } from '@/lib/dates';
import { idbClear } from '@/data/idb';
import { removeExamples, seedExamples } from '@/lib/examples';

const NOTIF_LABELS: Record<NotifType, string> = {
  task_assigned: 'Nova missão atribuída', task_due: 'Missão perto do prazo', event_soon: 'Compromisso chegando', list_changed: 'Mudança em lista compartilhada',
  message: 'Nova carta', capsule: 'Cápsula do tempo liberada', wish_done: 'Desejo realizado', adventure_done: 'Aventura concluída', health: 'Consultas e vacinas',
};
const KIND_LABEL: Record<MemberKind, string> = { adult: 'Adulto', child: 'Criança', pet: 'Pet' };

export function FamilyPage() {
  const s = useSession(); const ui = useUI(); const st = getStore();
  const members = useMembers(); const me = useMe();
  const [edit, setEdit] = useState<Partial<Member> | null>(null);
  const [invite, setInvite] = useState(false);
  const ach = useTable('achievements');
  useTable('star_transactions');
  const stars = starTotals(st);
  const [famName, setFamName] = useState(s.family.name);
  const exTasks = useTable('tasks'); const exEvents = useTable('events');
  const hasExamples = exTasks.some((t) => t.example) || exEvents.some((e) => e.example);

  const exportJson = () => downloadText(`roda-do-tempo-${today()}.json`, JSON.stringify({ exportado_em: new Date().toISOString(), familia: s.family, ...st.exportAll() }, null, 2), 'application/json');
  const deleteAll = async () => {
    const ok = await ui.confirm({ title: 'Excluir todos os dados?', text: `Isso apaga a família “${s.family.name}”, todas as missões, listas, memórias, cartas e fotos${s.mode === 'cloud' ? ' do servidor, para todos os membros' : ' deste aparelho'}. Não dá para desfazer. Recomendamos exportar antes.`, ok: 'Excluir tudo', danger: true });
    if (!ok) return;
    const name = prompt(`Para confirmar, digite o nome da família: ${s.family.name}`);
    if (name !== s.family.name) return ui.toast('Nome não confere. Nada foi apagado.', 'err');
    try {
      if (s.mode === 'cloud') {
        const { data: files } = await supabase!.storage.from('family-media').list(s.family.id, { limit: 1000 });
        if (files?.length) await supabase!.storage.from('family-media').remove(files.map((f) => `${s.family.id}/${f.name}`));
        const { error } = await supabase!.rpc('delete_family', { p_family: s.family.id, p_confirm: name });
        if (error) throw error;
        localStorage.removeItem(`rdt:family:cloud:${s.userId}`);
      } else { await idbClear(); localStorage.removeItem(`rdt:family:local:${s.userId}`); }
      st.wipeLocal(); await s.signOut();
    } catch (e: any) { ui.toast(e.message || 'Falha ao excluir', 'err'); }
  };
  const leave = async () => {
    if (!(await ui.confirm({ title: 'Sair da família?', text: 'Seus dados continuam para os outros membros. Você precisará de um novo convite para voltar.', ok: 'Sair', danger: true }))) return;
    const { error } = await supabase!.rpc('leave_family', { p_family: s.family.id });
    if (error) return ui.toast(error.message, 'err');
    st.wipeLocal(); localStorage.removeItem(`rdt:family:cloud:${s.userId}`); await s.signOut();
  };
  const push = async (on: boolean) => {
    if (!on) { await disablePush(); s.setPrefs({ push: false }); return; }
    const r = await enablePush();
    if (r === 'ok') { s.setPrefs({ push: true }); ui.toast('Notificações push ativadas'); }
    else if (r === 'no-key') { s.setPrefs({ push: true }); ui.toast('Avisos do sistema ativados com o app aberto. Push com app fechado precisa de configuração no servidor.', 'info'); }
    else if (r === 'denied') ui.toast('Permissão negada no navegador', 'err');
    else if (r === 'unsupported') ui.toast(/iPhone|iPad/.test(navigator.userAgent) ? 'No iPhone, instale o app na tela de início (Compartilhar → Adicionar à Tela de Início) para ativar.' : 'Este navegador não suporta push', 'err');
    else ui.toast('Não foi possível ativar', 'err');
  };

  return (
    <div>
      <PageHeader world="08 · Nossa família" title="Personalização" subtitle={s.mode === 'cloud' ? `Conectado como ${s.email}` : 'Dados salvos só neste aparelho'} icon="gear" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="O time" icon="users" tone="moss" action={<button className="btn-ghost btn-sm" onClick={() => setEdit({ kind: 'child', avatar: DEFAULT_AVATARS.child, color: COLORS[2] })}><Icon name="plus" size={12} />Perfil</button>}>
          <form className="flex gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); if (famName.trim()) s.updateFamily({ name: famName.trim() }).then(() => ui.toast('Nome salvo')).catch((x) => ui.toast(x.message, 'err')); }}>
            <input className="field" value={famName} onChange={(e) => setFamName(e.target.value)} aria-label="Nome da família" maxLength={80} /><button className="btn-ghost btn-sm" disabled={famName === s.family.name}>Salvar</button>
          </form>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id}><button className="w-full px-box-flat p-2 flex items-center gap-3 text-left hover:bg-panel2" onClick={() => setEdit(m)}>
                <MemberAvatar m={m} size={48} photo />
                <span className="flex-1 min-w-0"><span className="block font-semibold">{m.name}{m.nickname ? ` · ${m.nickname}` : ''}{m.id === me?.id ? ' (você)' : ''}</span>
                  <span className="block text-xs text-muted">{KIND_LABEL[m.kind]}{m.birth_date ? ` · ${ageText(m.birth_date)}` : ''}{m.kind === 'adult' && s.mode === 'cloud' ? (m.user_id ? ' · com conta' : ' · sem conta ainda') : ''}</span></span>
                <span className="w-4 h-4 rounded-sm border-2 border-line" style={{ background: m.color }} />
              </button></li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn-ghost btn-sm" onClick={() => setEdit({ kind: 'adult', avatar: DEFAULT_AVATARS.b, color: COLORS[0] })}><Icon name="user" size={12} />Adulto</button>
            <button className="btn-ghost btn-sm" onClick={() => setEdit({ kind: 'pet', avatar: DEFAULT_AVATARS.pet, color: COLORS[5] })}><Icon name="paw" size={12} />Pet</button>
            {s.mode === 'cloud' && <button className="btn-sun btn-sm" onClick={() => setInvite(true)}><Icon name="mail" size={12} />Convidar adulto</button>}
          </div>
          {s.mode === 'local' && s.setLocalMe && (
            <div className="mt-4 px-inset p-3">
              <Field label="Quem está usando este aparelho?"><select className="field" value={me?.id} onChange={(e) => s.setLocalMe!(e.target.value)}>{members.filter((m) => m.kind === 'adult').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
            </div>
          )}
        </Panel>

        <Panel title="Aparência e som" icon="sun" tone="sun">
          <div className="space-y-4">
            <div><span className="label">Tema</span><Segmented label="Tema" value={s.prefs.theme} onChange={(v) => s.setPrefs({ theme: v })} options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }, { value: 'system', label: 'Automático' }]} /></div>
            <Toggle label="Sons de 8 bits" checked={s.prefs.sounds} onChange={(v) => s.setPrefs({ sounds: v })} />
            <Toggle label="Reduzir animações" checked={s.prefs.reduceMotion} onChange={(v) => s.setPrefs({ reduceMotion: v })} />
            <Toggle label="Gamificação (estrelas, conquistas, celebrações)" hint="Vale para toda a família. Sem rankings nem perda de pontos." checked={s.family.settings.gamification} onChange={(v) => s.updateFamily({ settings: { gamification: v } })} />
          </div>
        </Panel>

        <Panel title="Notificações" icon="bell" tone="terra">
          <div className="space-y-3">
            {(notifSupported() || pushSupported()) && <Toggle label="Avisos do sistema (push)" hint={s.mode === 'local' ? 'Funciona com o app aberto.' : 'Com o app fechado, precisa da Edge Function de push configurada (veja o README).'} checked={s.prefs.push} onChange={push} />}
            <Field label="Avisar missões com horário com antecedência de"><select className="field" value={s.prefs.reminderLead} onChange={(e) => s.setPrefs({ reminderLead: +e.target.value })}>{[5, 10, 15, 30, 60, 120].map((m) => <option key={m} value={m}>{m} minutos</option>)}</select></Field>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 pt-2">
              {(Object.keys(NOTIF_LABELS) as NotifType[]).map((k) => <Toggle key={k} label={NOTIF_LABELS[k]} checked={s.prefs.notify[k] !== false} onChange={(v) => s.setPrefs({ notify: { ...s.prefs.notify, [k]: v } })} small />)}
            </div>
          </div>
        </Panel>

        {s.family.settings.gamification && (
          <Panel title="Conquistas do time" icon="trophy" tone="sun" action={<span className="chip"><Icon name="star" size={12} />{stars.total} estrelas</span>}>
            <p className="text-xs text-muted mb-3">Estrelas vêm de missões, sonhos e aventuras reais. As estrelinhas do minigame ({s.prefs.gameStars}) são contadas à parte, só por diversão.</p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {ACHIEVEMENTS.map((a) => { const got = ach.find((x) => x.key === a.key); return (
                <li key={a.key} className={`px-box-flat p-2 flex gap-2 ${got ? '' : 'opacity-50'}`}>
                  <span className={`grid place-items-center w-9 h-9 rounded-[4px] border-2 border-line shrink-0 ${got ? 'bg-sun text-[rgb(58_42_30)]' : 'bg-panel2'}`}><Icon name={got ? a.icon : 'lock'} size={16} /></span>
                  <span className="min-w-0"><span className="block font-semibold text-sm">{a.title}</span><span className="block text-[11px] text-muted">{a.text}</span>
                    {a.unlock && <span className="block text-[11px] text-terra">{got ? 'Desbloqueou' : 'Desbloqueia'}: {COSMETICS[a.unlock]}</span>}
                    {got && <span className="block text-[10px] text-muted">{fmtDate(got.unlocked_at.slice(0, 10))}</span>}</span>
                </li>
              ); })}
            </ul>
          </Panel>
        )}

        <Panel title="Dados e privacidade" icon="lock">
          <div className="space-y-3 text-sm">
            <p className="text-muted">{s.mode === 'cloud' ? 'Os dados ficam no seu projeto Supabase, protegidos por login e por regras no banco que isolam cada família. Fotos ficam em armazenamento privado, acessadas por links temporários.' : 'Tudo está salvo apenas neste navegador. Limpar os dados do navegador apaga o app. Exporte com frequência.'}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost btn-sm" onClick={exportJson}><Icon name="download" size={12} />Exportar tudo (JSON)</button>
              <button className="btn-ghost btn-sm" onClick={() => downloadText('roda-do-tempo.ics', toICS(st.all('events')))}><Icon name="calendar" size={12} />Exportar calendário (.ics)</button>
              {hasExamples ? <button className="btn-ghost btn-sm" onClick={() => { removeExamples(st); ui.toast('Exemplos removidos'); }}><Icon name="trash" size={12} />Remover exemplos</button>
                : <button className="btn-ghost btn-sm" onClick={() => { seedExamples(st, members); ui.toast('Exemplos adicionados'); }}><Icon name="sparkle" size={12} />Adicionar exemplos</button>}
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t-2 border-line/10">
              <button className="btn-ghost btn-sm" onClick={() => s.signOut()}><Icon name="logout" size={12} />{s.mode === 'cloud' ? 'Sair da conta' : 'Voltar à tela inicial'}</button>
              {s.mode === 'cloud' && <button className="btn-ghost btn-sm" onClick={leave}>Sair da família</button>}
              <button className="btn-danger btn-sm" onClick={deleteAll}><Icon name="trash" size={12} />Excluir todos os dados</button>
            </div>
          </div>
        </Panel>
        <InstallCard />
      </div>
      {edit && <MemberEditor member={edit} onClose={() => setEdit(null)} />}
      {invite && <InviteModal onClose={() => setInvite(false)} />}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange, small }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; small?: boolean }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative shrink-0 w-12 h-7 rounded-[4px] border-[3px] border-line ${checked ? 'bg-moss' : 'bg-panel2'}`}>
        <span className={`absolute top-[2px] w-4 h-4 bg-panel border-2 border-line transition-[left] ${checked ? 'left-[24px]' : 'left-[2px]'}`} />
      </button>
      <span className="min-w-0"><span className={`block ${small ? 'text-sm' : 'font-semibold text-sm'}`}>{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
    </label>
  );
}

function InstallCard() {
  const [evt, setEvt] = useState<any>(null);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone;
  useEffect(() => { const f = (e: any) => { e.preventDefault(); setEvt(e); }; window.addEventListener('beforeinstallprompt', f); return () => window.removeEventListener('beforeinstallprompt', f); }, []);
  if (standalone) return null;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return (
    <Panel title="Instalar o app" icon="download" tone="sky">
      {evt ? <button className="btn-primary" onClick={() => evt.prompt()}>Instalar na tela inicial</button>
        : ios ? <p className="text-sm">No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>
          : <p className="text-sm">No Chrome, abra o menu ⋮ e toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p>}
    </Panel>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const s = useSession(); const ui = useUI(); const members = useMembers();
  const free = members.filter((m) => m.kind === 'adult' && !m.user_id);
  const [memberId, setMemberId] = useState(free[0]?.id || '');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const link = code ? `${location.origin}${location.pathname}#/convite/${code}` : '';
  const create = async () => {
    const { data, error } = await supabase!.from('invites').insert({ family_id: s.family.id, member_id: memberId || null, email: email || null }).select('code').single();
    if (error) return ui.toast(error.message, 'err');
    setCode(data.code);
  };
  const share = async () => {
    const text = `Vem jogar com a gente no Roda do Tempo: ${link}`;
    if (navigator.share) { try { await navigator.share({ title: 'Roda do Tempo', text, url: link }); } catch { /* cancelou */ } }
    else { await navigator.clipboard.writeText(link); ui.toast('Link copiado'); }
  };
  return (
    <Modal open onClose={onClose} title="Convidar para a família">
      {!code ? (
        <div className="space-y-3">
          <p className="text-sm">O convite gera um link de uso único, válido por 14 dias. A pessoa cria a conta e entra direto na família.</p>
          {free.length > 0 && <Field label="Vincular ao perfil"><select className="field" value={memberId} onChange={(e) => setMemberId(e.target.value)}>{free.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}<option value="">Criar um perfil novo</option></select></Field>}
          <Field label="E-mail (opcional)" hint="Para abrir o seu app de e-mail com o convite pronto."><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn-primary w-full" onClick={create}>Gerar convite</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="px-inset p-3 font-mono text-xs break-all select-all">{link}</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={share}><Icon name="link" size={14} />Compartilhar</button>
            <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(link).then(() => ui.toast('Link copiado'))}><Icon name="copy" size={14} />Copiar</button>
            {email && <a className="btn-ghost" href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Convite: Roda do Tempo')}&body=${encodeURIComponent(`Oi! Entra na nossa família no Roda do Tempo:\n\n${link}\n\nMesmo time. Dentro e fora do jogo.`)}`}><Icon name="mail" size={14} />Abrir e-mail</a>}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function MemberEditor({ member, onClose }: { member: Partial<Member>; onClose: () => void }) {
  const ui = useUI(); const st = getStore(); const me = useMe(); const members = useMembers();
  const [m, setM] = useState<Partial<Member>>({ kind: 'adult', name: '', color: COLORS[0], info: [], position: members.length, ...member, avatar: avatarOf(member as Member) });
  const set = (p: Partial<Member>) => setM((x) => ({ ...x, ...p }));
  const av = m.avatar!;
  const setAv = (p: Partial<typeof av>) => set({ avatar: { ...av, ...p } });
  const pet = m.kind === 'pet';
  const save = () => {
    if (!m.name?.trim()) return ui.toast('Dê um nome ao perfil', 'err');
    st.save('members', { ...m, name: m.name.trim(), nickname: m.nickname?.trim() || null, info: (m.info || []).filter((i) => i.label.trim() || i.value.trim()) }); ui.toast('Perfil salvo'); onClose();
  };
  const del = async () => {
    if (member.id === me?.id) return ui.toast('Você não pode remover o próprio perfil', 'err');
    if (!(await ui.confirm({ title: `Remover ${m.name}?`, text: 'Os registros ligados a este perfil continuam salvos.', ok: 'Remover', danger: true }))) return;
    st.remove('members', member.id!); onClose();
  };
  const Swatches = ({ list, value, on, label }: { list: string[]; value: string; on: (c: string) => void; label: string }) => (
    <div><span className="label">{label}</span><div className="flex flex-wrap gap-1">{list.map((c) => <button key={c} type="button" aria-label={`${label} ${c}`} aria-pressed={c === value} onClick={() => on(c)} className={`w-8 h-8 rounded-[3px] border-[3px] ${c === value ? 'border-line' : 'border-line/20'}`} style={{ background: c }} />)}</div></div>
  );
  return (
    <Modal open onClose={onClose} title={member.id ? 'Editar perfil' : 'Novo perfil'} wide footer={<>
      {member.id && <button className="btn-ghost btn-sm mr-auto" onClick={del}><Icon name="trash" size={12} />Remover</button>}
      <button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}>
      <div className="grid sm:grid-cols-[180px_1fr] gap-5">
        <div className="flex flex-col items-center gap-2">
          <div className="w-40 h-40 grid place-items-end justify-center rounded-[6px] border-[3px] border-line bg-[linear-gradient(#BFD6E0,#E3EEDF_70%,#5E7B3A_70%)] pb-6">
            <Sprite kind={m.kind!} avatar={av} size={pet ? 60 : m.kind === 'child' ? 80 : 110} />
          </div>
          <span className="hud text-[10px] text-muted">Personagem</span>
        </div>
        <div className="space-y-3">
          {!member.id && <div><span className="label">Tipo</span><Segmented label="Tipo" value={m.kind!} onChange={(k) => set({ kind: k, avatar: k === 'pet' ? DEFAULT_AVATARS.pet : k === 'child' ? DEFAULT_AVATARS.child : DEFAULT_AVATARS.b })} options={[{ value: 'adult', label: 'Adulto' }, { value: 'child', label: 'Criança' }, { value: 'pet', label: 'Pet' }]} /></div>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome"><input className="field" value={m.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} /></Field>
            <Field label="Apelido"><input className="field" value={m.nickname || ''} onChange={(e) => set({ nickname: e.target.value })} maxLength={40} /></Field>
          </div>
          {m.kind !== 'adult' && <Field label="Data de nascimento"><input type="date" className="field" value={m.birth_date || ''} onChange={(e) => set({ birth_date: e.target.value || null })} /></Field>}
          <Swatches label="Cor de identificação" list={COLORS} value={m.color!} on={(c) => set({ color: c })} />
          {pet ? (<>
            <Swatches label="Pelagem" list={['#C9924A', '#E6C27A', '#F3E8D4', '#5A3A22', '#2B1D14', '#9A9A9A']} value={av.skin} on={(c) => setAv({ skin: c })} />
            <Swatches label="Orelhas e manchas" list={['#8A5A2B', '#5A3A22', '#2B1D14', '#F3E8D4', '#C9924A']} value={av.hair} on={(c) => setAv({ hair: c })} />
            <Swatches label="Coleira" list={SHIRTS} value={av.shirt} on={(c) => setAv({ shirt: c })} />
          </>) : (<>
            <Swatches label="Pele" list={SKINS} value={av.skin} on={(c) => setAv({ skin: c })} />
            <Swatches label="Cabelo" list={HAIRS} value={av.hair} on={(c) => setAv({ hair: c })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Penteado"><select className="field" value={av.hairStyle} onChange={(e) => setAv({ hairStyle: +e.target.value })}>{HAIR_STYLES.map((h, i) => <option key={h} value={i}>{h}</option>)}</select></Field>
              <Field label="Acessório"><select className="field" value={av.accessory} onChange={(e) => setAv({ accessory: +e.target.value })}>{ACCESSORIES.map((h, i) => <option key={h} value={i}>{h}</option>)}</select></Field>
            </div>
            <Swatches label="Roupa" list={SHIRTS} value={av.shirt} on={(c) => setAv({ shirt: c })} />
            <Swatches label="Calça" list={PANTS} value={av.pants} on={(c) => setAv({ pants: c })} />
          </>)}
          <ImagePicker value={m.photo_path} onChange={(p) => set({ photo_path: p })} label="Foto (opcional)" />
          {m.kind !== 'adult' && (
            <div><span className="label">Informações importantes</span>
              <div className="space-y-2">{(m.info || []).map((i, k) => (
                <div key={k} className="flex gap-2">
                  <input className="field w-1/3" placeholder="Ex.: Alergias" value={i.label} onChange={(e) => set({ info: m.info!.map((x, j) => j === k ? { ...x, label: e.target.value } : x) })} />
                  <input className="field flex-1" placeholder="Valor" value={i.value} onChange={(e) => set({ info: m.info!.map((x, j) => j === k ? { ...x, value: e.target.value } : x) })} />
                  <button type="button" className="btn-icon btn-sm w-9" aria-label="Remover" onClick={() => set({ info: m.info!.filter((_, j) => j !== k) })}><Icon name="close" size={12} /></button>
                </div>
              ))}</div>
              <div className="flex flex-wrap gap-2 mt-2">{(pet ? ['Raça', 'Veterinário', 'Vacinas', 'Ração'] : ['Tipo sanguíneo', 'Alergias', 'Pediatra', 'Escola', 'Tamanho de roupa', 'Calçado']).map((l) => <button key={l} type="button" className="chip" onClick={() => set({ info: [...(m.info || []), { label: l, value: '' }] })}>+ {l}</button>)}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
