import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStore, useSync } from '@/data/store';
import { useMembers, useSession } from '@/data/session';
import { supabase } from '@/data/supabase';
import { uploadFileWithType } from '@/data/media';
import { Empty, Field, Icon, PageHeader, Spinner, useUI } from '@/components/ui';
import { MemberAvatar } from '@/components/Avatar';
import { applyItems, countsText, ERROR_TEXT, KIND_LABEL, sanitize, type InboxItem, type InboxKind } from '@/lib/inbox';
import { fmtDate, relDay } from '@/lib/dates';
import { ls } from '@/lib/storage';
import type { IconName } from '@/components/icons';

const KIND_ICON: Record<InboxKind, IconName> = { task: 'sword', event: 'flag', list_item: 'bag', child_record: 'rattle', memory: 'book', wish: 'star' };
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';
interface Pending { file: File; preview?: string }
interface History { at: string; text: string; summary: string }

export function Inbox() {
  const s = useSession(); const ui = useUI(); const members = useMembers(); const sync = useSync();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<'' | 'upload' | 'ai'>('');
  const [result, setResult] = useState<{ reply: string; questions: string[]; items: (InboxItem & { on: boolean })[]; uploaded: { path: string; type: string; name: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const histKey = `rdt:inbox:${s.family.id}`;
  const [history, setHistory] = useState<History[]>(() => ls.get(histKey, []));
  const input = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | File[]) => {
    const arr = [...list].filter((f) => ACCEPT.includes(f.type));
    if (arr.length < [...list].length) ui.toast(ERROR_TEXT.file_type, 'err');
    setFiles((cur) => [...cur, ...arr.map((file) => ({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined }))].slice(0, 5));
  };
  const onPaste = (e: React.ClipboardEvent) => { const fs = [...e.clipboardData.files]; if (fs.length) { e.preventDefault(); addFiles(fs); } };

  if (s.mode === 'local') return (
    <div>
      <PageHeader world="Caixa de entrada" title="Mande, a gente organiza" icon="sparkle" />
      <div className="px-box"><Empty icon="cloud" title="Precisa do servidor ligado" text="A Caixa de entrada usa a IA no servidor da família (Supabase + chave da Anthropic). No modo “neste aparelho” ela fica desligada." /></div>
    </div>
  );

  const organize = async () => {
    if (!text.trim() && !files.length) return setError(ERROR_TEXT.empty);
    if (!sync.online) return setError('Sem internet agora. A Caixa de entrada precisa de conexão.');
    setError(null); setResult(null);
    try {
      setBusy('upload');
      const uploaded = [];
      for (const p of files) { const u = await uploadFileWithType(p.file); uploaded.push({ path: u.path, type: u.type, name: p.file.name }); }
      setBusy('ai');
      const { data, error: err } = await supabase!.functions.invoke('rdt-inbox', {
        body: { family_id: s.family.id, text, files: uploaded.map((u) => ({ path: u.path, media_type: u.type, name: u.name })) },
      });
      if (err) {
        let code = 'failed', detail = '';
        try { const b = await (err as any).context?.json(); code = b?.error || code; detail = b?.detail || ''; } catch { /* */ }
        throw new Error(ERROR_TEXT[code] || `Não foi possível organizar agora. Tente de novo em instantes.${detail ? ` (detalhe: ${detail})` : ''}`);
      }
      const r = data.result;
      setResult({ reply: r.reply, questions: r.questions || [], items: (r.items || []).map((it: InboxItem) => ({ ...sanitize(it, members), on: true })), uploaded });
    } catch (e: any) { setError(e.message || String(e)); }
    setBusy('');
  };

  const setItem = (i: number, p: Partial<InboxItem & { on: boolean }>) => setResult((r) => r && { ...r, items: r.items.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const confirm = () => {
    if (!result) return;
    const chosen = result.items.filter((x) => x.on);
    if (!chosen.length) return ui.toast('Selecione pelo menos um item', 'err');
    const attachments = result.uploaded.map((u) => ({ id: crypto.randomUUID(), name: u.name, path: u.path, type: u.type }));
    const counts = applyItems(getStore(), chosen, { members, gamification: s.family.settings.gamification, attachments });
    const summary = countsText(counts);
    const h = [{ at: new Date().toISOString(), text: text.slice(0, 140) || result.uploaded.map((u) => u.name).join(', '), summary }, ...history].slice(0, 20);
    setHistory(h); ls.set(histKey, h);
    ui.celebrate({ title: 'Organizado!', sub: summary, kind: 'mission' });
    setText(''); setFiles([]); setResult(null);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader world="Caixa de entrada" title="Mande, a gente organiza" subtitle="Cole o recado da escola, um print, uma foto do convite ou um PDF. A IA sugere missões, checkpoints e itens, e vocês confirmam." icon="sparkle" />

      <section className="px-box p-4 mb-5" onPaste={onPaste} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
        <Field label="Recado">
          <textarea className="field min-h-[130px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} maxLength={20000}
            placeholder={'Ex.: “Festa junina da escola sexta 15h, cada criança leva um prato doce. Vacina da Liz dia 12 às 9h.”'} />
        </Field>
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-3">
            {files.map((p, i) => (
              <li key={i} className="relative px-box-flat p-1 pr-7 flex items-center gap-2 max-w-[220px]">
                {p.preview ? <img src={p.preview} alt="" className="w-12 h-12 object-cover rounded-lg" /> : <span className="tile w-12 h-12 bg-terra/10 text-terra"><Icon name="book" size={18} /></span>}
                <span className="text-xs truncate">{p.file.name}</span>
                <button className="absolute top-1 right-1 text-muted hover:text-ink" aria-label={`Remover ${p.file.name}`} onClick={() => setFiles(files.filter((_, k) => k !== i))}><Icon name="close" size={10} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button className="btn-ghost btn-sm" onClick={() => input.current?.click()} disabled={files.length >= 5}><Icon name="camera" size={14} />Foto, print ou PDF</button>
          <span className="text-xs text-muted">Até 5 arquivos · dá para colar um print com Ctrl+V</span>
          <button className="btn-primary ml-auto" onClick={organize} disabled={!!busy}><Icon name="sparkle" size={14} />{busy === 'upload' ? 'Enviando arquivos…' : busy === 'ai' ? 'Organizando…' : 'Organizar'}</button>
        </div>
        <input ref={input} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        {error && <p className="mt-3 text-sm font-medium text-[#C2412D]" role="alert">{error}</p>}
      </section>

      {busy === 'ai' && <div className="px-box"><Spinner label="Lendo o recado" /></div>}

      {result && (
        <section className="px-box p-4 mb-5 anim-rise">
          <div className="flex gap-3 mb-4">
            <span className="tile w-9 h-9 bg-sun/20 text-[#B7791F]"><Icon name="sparkle" size={16} /></span>
            <div className="flex-1"><p className="font-medium">{result.reply}</p>
              {result.questions.length > 0 && <ul className="mt-2 text-sm text-muted list-disc pl-5">{result.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>}</div>
          </div>
          {result.items.length === 0 ? <p className="text-sm text-muted">Nada para criar neste recado.</p> : (
            <ul className="space-y-2">
              {result.items.map((it, i) => (
                <li key={i} className={`px-box-flat p-3 ${it.on ? '' : 'opacity-50'}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="px-check mt-1" checked={it.on} onChange={(e) => setItem(i, { on: e.target.checked })} aria-label={`Incluir ${it.title}`} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <select className="chip min-h-[30px] pr-6" value={it.kind} onChange={(e) => setItem(i, { kind: e.target.value as InboxKind })} aria-label="Tipo">
                          {(Object.keys(KIND_LABEL) as InboxKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                        </select>
                        <Icon name={KIND_ICON[it.kind]} size={14} className="text-muted" />
                        {it.date && <span className="text-xs text-muted">{relDay(it.date)} · {fmtDate(it.date)}{it.time ? ` · ${it.time}` : ''}</span>}
                      </div>
                      <input className="field min-h-[38px] py-1 font-semibold" value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} aria-label="Título" />
                      <div className="flex flex-wrap gap-2">
                        {it.kind !== 'list_item' && <input type="date" className="field w-auto min-h-[36px] py-1 text-sm" value={it.date || ''} onChange={(e) => setItem(i, { date: e.target.value || null })} aria-label="Data" />}
                        {(it.kind === 'task' || it.kind === 'event' || it.kind === 'child_record') && <input type="time" className="field w-auto min-h-[36px] py-1 text-sm" value={it.time || ''} onChange={(e) => setItem(i, { time: e.target.value || null })} aria-label="Horário" />}
                        {(it.kind === 'task' || it.kind === 'wish') && (
                          <select className="field w-auto min-h-[36px] py-1 text-sm" value={it.assignee || 'family'} onChange={(e) => setItem(i, { assignee: e.target.value })} aria-label="Responsável">
                            {members.filter((m) => m.kind === 'adult').map((m) => <option key={m.id} value={m.id}>{m.nickname || m.name}</option>)}
                            <option value="both">Nós dois</option><option value="family">Família</option>
                          </select>
                        )}
                        {it.kind === 'list_item' && <span className="chip">{it.list_id ? getStore().get('lists', it.list_id)?.name : it.list_name || 'Compras'}{it.qty ? ` · ${it.qty}${it.unit ? ' ' + it.unit : ''}` : ''}</span>}
                        {it.kind === 'child_record' && members.filter((m) => m.kind === 'child').slice(0, 1).map((k) => <span key={k.id} className="flex items-center gap-1 chip"><MemberAvatar m={k} size={18} ring={false} />{k.nickname || k.name}</span>)}
                      </div>
                      {it.source_quote && <p className="text-xs text-muted italic">“{it.source_quote}”</p>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <button className="btn-ghost" onClick={() => setResult(null)}>Descartar</button>
            {result.items.length > 0 && <button className="btn-moss" onClick={confirm}><Icon name="check" size={14} />Criar {result.items.filter((x) => x.on).length} {result.items.filter((x) => x.on).length === 1 ? 'item' : 'itens'}</button>}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="hud text-[11px] text-muted mb-2">Organizados recentemente (neste aparelho)</h2>
          <ul className="px-box divide-y divide-line">
            {history.map((h, i) => <li key={i} className="p-3 text-sm"><div className="font-medium truncate">{h.text}</div><div className="text-xs text-muted">{relDay(h.at.slice(0, 10))} · {h.summary}</div></li>)}
          </ul>
        </section>
      )}
      <p className="text-xs text-muted mt-6 flex gap-1"><Icon name="lock" size={12} className="mt-[1px]" />O que você manda aqui é enviado à IA da Anthropic só para ser organizado. Nada é criado sem a sua confirmação. <Link to="/familia" className="link">Privacidade</Link></p>
    </div>
  );
}
