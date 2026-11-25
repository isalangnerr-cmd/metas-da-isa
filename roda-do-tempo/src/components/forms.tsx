import { useRef, useState } from 'react';
import { useMembers, useMe } from '@/data/session';
import { MemberAvatar } from './Avatar';
import { Icon, useUI } from './ui';
import { uploadFile, usePhoto } from '@/data/media';
import { FREQ_LABEL, type Freq, type Recurrence } from '@/lib/recurrence';

/** Seleção de responsável: membros adultos + Nós dois + Família */
export function AssigneeSelect({ value, onChange, includeKids = false }: { value: string; onChange: (v: string) => void; includeKids?: boolean }) {
  const members = useMembers();
  const me = useMe();
  const opts = [
    ...members.filter((m) => m.kind === 'adult' || includeKids).map((m) => ({ v: m.id, label: m.id === me?.id ? 'Eu' : m.nickname || m.name, m })),
    { v: 'both', label: 'Nós dois', m: null }, { v: 'family', label: 'Família', m: null },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Responsável">
      {opts.map((o) => (
        <button type="button" key={o.v} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`flex items-center gap-2 pl-1 pr-3 py-1 min-h-[44px] rounded-[6px] border-2 ${value === o.v ? 'border-line bg-sun/70 shadow-pxs' : 'border-line/30 bg-panel'}`}>
          {o.m ? <MemberAvatar m={o.m} size={32} ring={false} /> : <span className="grid place-items-center w-8 h-8"><Icon name={o.v === 'both' ? 'heart' : 'users'} size={18} /></span>}
          <span className="text-sm font-semibold">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function MemberMulti({ value, onChange, includeFamily = true }: { value: string[]; onChange: (v: string[]) => void; includeFamily?: boolean }) {
  const members = useMembers();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2">
      {includeFamily && (
        <button type="button" aria-pressed={value.includes('family')} onClick={() => toggle('family')} className={`flex items-center gap-2 px-3 min-h-[44px] rounded-[6px] border-2 ${value.includes('family') ? 'border-line bg-sun/70' : 'border-line/30 bg-panel'}`}>
          <Icon name="users" size={18} /><span className="text-sm font-semibold">Família toda</span>
        </button>
      )}
      {members.map((m) => (
        <button type="button" key={m.id} aria-pressed={value.includes(m.id)} onClick={() => toggle(m.id)} className={`flex items-center gap-2 pl-1 pr-3 py-1 min-h-[44px] rounded-[6px] border-2 ${value.includes(m.id) ? 'border-line bg-sun/70' : 'border-line/30 bg-panel'}`}>
          <MemberAvatar m={m} size={30} ring={false} /><span className="text-sm font-semibold">{m.nickname || m.name}</span>
        </button>
      ))}
    </div>
  );
}

export function RecurrenceField({ value, onChange }: { value?: Recurrence | null; onChange: (r: Recurrence | null) => void }) {
  const r = value || { freq: 'none' as Freq };
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select className="field w-auto flex-1 min-w-[150px]" value={r.freq} onChange={(e) => { const f = e.target.value as Freq; onChange(f === 'none' ? null : { ...r, freq: f }); }} aria-label="Repetição">
        {(Object.keys(FREQ_LABEL) as Freq[]).map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
      </select>
      {r.freq !== 'none' && r.freq !== 'weekdays' && (
        <label className="flex items-center gap-1 text-sm">a cada <input type="number" min={1} max={99} className="field w-16" value={r.interval || 1} onChange={(e) => onChange({ ...r, interval: Math.max(1, +e.target.value || 1) })} /></label>
      )}
      {r.freq !== 'none' && (
        <label className="flex items-center gap-1 text-sm">até <input type="date" className="field w-auto" value={r.until || ''} onChange={(e) => onChange({ ...r, until: e.target.value || null })} /></label>
      )}
    </div>
  );
}

export function Photo({ path, className = '', alt = '' }: { path?: string | null; className?: string; alt?: string }) {
  const url = usePhoto(path);
  if (!path) return null;
  return url ? <img src={url} alt={alt} className={className} loading="lazy" /> : <div className={`${className} bg-panel2 animate-pulse`} />;
}

export function ImagePicker({ value, onChange, label = 'Imagem' }: { value?: string | null; onChange: (p: string | null) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const ui = useUI();
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await uploadFile(f)); } catch (e: any) { ui.toast(e.message || 'Falha ao enviar imagem', 'err'); }
    setBusy(false);
  };
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        {value ? <Photo path={value} className="w-20 h-20 object-cover rounded-[4px] border-2 border-line" /> : <div className="w-20 h-20 grid place-items-center rounded-[4px] border-2 border-dashed border-line/40 text-muted"><Icon name="image" size={24} /></div>}
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => ref.current?.click()}><Icon name="camera" size={14} />{busy ? 'Enviando…' : value ? 'Trocar' : 'Escolher'}</button>
          {value && <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(null)}>Remover</button>}
        </div>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    </div>
  );
}

export function FileAttach({ value, onChange }: { value: { id: string; name: string; path?: string; url?: string; type?: string }[]; onChange: (v: any[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const ui = useUI();
  const add = async (f?: File) => {
    if (!f) return; setBusy(true);
    try { const path = await uploadFile(f); onChange([...value, { id: crypto.randomUUID(), name: f.name, path, type: f.type }]); }
    catch (e: any) { ui.toast(e.message || 'Falha ao anexar', 'err'); }
    setBusy(false);
  };
  return (
    <div className="space-y-2">
      {value.map((a) => (
        <div key={a.id} className="flex items-center gap-2 px-inset px-2 py-1">
          <Icon name={a.url ? 'link' : a.type?.startsWith('image') ? 'image' : 'book'} size={14} />
          <AttachmentLink a={a} />
          <button type="button" className="btn-icon btn-sm w-8 ml-auto" aria-label={`Remover ${a.name}`} onClick={() => onChange(value.filter((x) => x.id !== a.id))}><Icon name="close" size={12} /></button>
        </div>
      ))}
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => ref.current?.click()}><Icon name="upload" size={14} />{busy ? 'Enviando…' : 'Arquivo'}</button>
        <input className="field flex-1 min-w-[160px] min-h-[36px] py-1" placeholder="ou cole um link https://" value={link} onChange={(e) => setLink(e.target.value)} />
        <button type="button" className="btn-ghost btn-sm" disabled={!/^https?:\/\//.test(link)} onClick={() => { onChange([...value, { id: crypto.randomUUID(), name: link.replace(/^https?:\/\//, '').slice(0, 60), url: link }]); setLink(''); }}>Adicionar link</button>
      </div>
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { add(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
export function AttachmentLink({ a }: { a: { name: string; path?: string; url?: string } }) {
  const u = usePhoto(a.path || null);
  const href = a.url || u || undefined;
  return <a className="link text-sm truncate" href={href} target="_blank" rel="noopener noreferrer">{a.name}</a>;
}

export const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : undefined);
