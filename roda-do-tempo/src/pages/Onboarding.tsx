import { useState } from 'react';
import { getStore } from '@/data/store';
import { useMembers, useMe, useSession } from '@/data/session';
import { Field, Icon, Modal, useUI } from '@/components/ui';
import { Sprite } from '@/components/Avatar';
import { DEFAULT_AVATARS } from '@/game/sprites';
import { COLORS } from '@/lib/domain';
import { seedExamples } from '@/lib/examples';

/** Primeira vez: monta o time (parceiro(a), filha e cachorrinha). Tudo editável depois. */
export function Onboarding() {
  const s = useSession(); const ui = useUI(); const st = getStore(); const me = useMe(); const members = useMembers();
  const [partner, setPartner] = useState('');
  const [kid, setKid] = useState('Eliza'); const [kidNick, setKidNick] = useState('Liz'); const [kidBirth, setKidBirth] = useState('');
  const [pet, setPet] = useState('');
  const [examples, setExamples] = useState(false);
  const [open, setOpen] = useState(true);
  const done = async (skip = false) => {
    if (!skip) {
      let pos = members.length;
      if (partner.trim()) st.save('members', { kind: 'adult', name: partner.trim(), color: COLORS[0], avatar: DEFAULT_AVATARS.b, position: pos++, info: [] });
      if (kid.trim()) st.save('members', { kind: 'child', name: kid.trim(), nickname: kidNick.trim() || null, birth_date: kidBirth || null, color: COLORS[2], avatar: DEFAULT_AVATARS.child, position: pos++, info: [] });
      if (pet.trim()) st.save('members', { kind: 'pet', name: pet.trim(), color: COLORS[5], avatar: DEFAULT_AVATARS.pet, position: pos++, info: [] });
      if (examples) setTimeout(() => seedExamples(st, st.all('members')), 50);
    }
    await s.updateFamily({ settings: { examples_seeded: true } }).catch(() => {});
    setOpen(false);
    if (!skip) ui.celebrate({ title: 'Press Start!', sub: 'O time está formado.', kind: 'achievement' });
  };
  if (!open) return null;
  return (
    <Modal open onClose={() => done(true)} title="Formando o time" wide footer={<><button className="btn-ghost" onClick={() => done(true)}>Depois</button><button className="btn-primary" onClick={() => done()}>Começar <Icon name="play" size={12} /></button></>}>
      <div className="flex justify-center items-end gap-3 mb-4" aria-hidden>
        <Sprite kind="adult" avatar={(me?.avatar as any) || DEFAULT_AVATARS.a} size={56} /><Sprite kind="adult" avatar={DEFAULT_AVATARS.b} size={56} />
        <Sprite kind="child" avatar={DEFAULT_AVATARS.child} size={38} /><Sprite kind="pet" avatar={DEFAULT_AVATARS.pet} size={28} />
      </div>
      <p className="text-center text-sm mb-4">Olá, <b>{me?.name}</b>! Quem joga com você? Dá para mudar tudo depois em “Nossa família”.</p>
      <div className="space-y-4">
        <Field label="Parceira ou parceiro" hint={s.mode === 'cloud' ? 'Depois você pode mandar um convite para essa pessoa ter a própria conta.' : undefined}><input className="field" value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="Nome" /></Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Filha"><input className="field" value={kid} onChange={(e) => setKid(e.target.value)} /></Field>
          <Field label="Apelido"><input className="field" value={kidNick} onChange={(e) => setKidNick(e.target.value)} /></Field>
          <Field label="Nascimento"><input type="date" className="field" value={kidBirth} onChange={(e) => setKidBirth(e.target.value)} /></Field>
        </div>
        <Field label="Cachorrinha"><input className="field" value={pet} onChange={(e) => setPet(e.target.value)} placeholder="Nome dela" /></Field>
        <label className="flex items-center gap-2"><input type="checkbox" className="px-check" checked={examples} onChange={(e) => setExamples(e.target.checked)} /><span className="text-sm">Adicionar alguns exemplos para conhecer o app (dá para remover com um clique)</span></label>
      </div>
    </Modal>
  );
}
