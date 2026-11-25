// Caixa de entrada inteligente: tipos da proposta da IA e como ela vira dados do app.
import type { Store } from '@/data/store';
import type { Attachment, Member } from '@/data/types';
import { EVENT_CATS, TASK_CATS } from './domain';
import { isValidDate, isValidTime, today } from './dates';
import { normalize } from './format';

export type InboxKind = 'task' | 'event' | 'list_item' | 'child_record' | 'memory' | 'wish';
export interface InboxItem {
  kind: InboxKind; title: string; description: string | null; date: string | null; time: string | null; end_time: string | null;
  all_day: boolean | null; location: string | null; assignee: string | null; category: string | null; list_id: string | null;
  list_name: string | null; qty: number | null; unit: string | null; price: number | null; child_kind: string | null;
  member_id: string | null; reminder_minutes: number | null; source_quote: string | null;
}
export interface InboxResult { reply: string; items: InboxItem[]; questions: string[] }

export const KIND_LABEL: Record<InboxKind, string> = {
  task: 'Missão', event: 'Checkpoint', list_item: 'Item de lista', child_record: 'Mini player', memory: 'Memória', wish: 'Desejo',
};
const CHILD_KINDS = ['moment', 'consult', 'vaccine', 'growth', 'food', 'sleep', 'school', 'medicine', 'reminder'];

const clean = (s: string | null | undefined, max = 2000) => (s ?? '').toString().trim().slice(0, max) || null;
const okDate = (d: string | null) => (d && isValidDate(d) ? d : null);
const okTime = (t: string | null) => (t && isValidTime(t) ? t : null);

/** Normaliza um item vindo da IA (nunca confiar cegamente: valida ids, datas e categorias). */
export function sanitize(it: Partial<InboxItem>, members: Member[]): InboxItem {
  const adults = new Set(members.filter((m) => m.kind === 'adult').map((m) => m.id));
  const kind = (['task', 'event', 'list_item', 'child_record', 'memory', 'wish'] as InboxKind[]).includes(it.kind as InboxKind) ? (it.kind as InboxKind) : 'task';
  const assignee = it.assignee && (adults.has(it.assignee) || it.assignee === 'both' || it.assignee === 'family') ? it.assignee : 'family';
  return {
    kind, title: clean(it.title, 200) || 'Sem título', description: clean(it.description), date: okDate(it.date ?? null), time: okTime(it.time ?? null),
    end_time: okTime(it.end_time ?? null), all_day: it.all_day ?? null, location: clean(it.location, 200), assignee,
    category: clean(it.category, 40), list_id: clean(it.list_id, 60), list_name: clean(it.list_name, 80),
    qty: typeof it.qty === 'number' && it.qty >= 0 ? it.qty : null, unit: clean(it.unit, 20), price: typeof it.price === 'number' && it.price >= 0 ? Math.round(it.price * 100) / 100 : null,
    child_kind: it.child_kind && CHILD_KINDS.includes(it.child_kind) ? it.child_kind : null,
    member_id: it.member_id && members.some((m) => m.id === it.member_id) ? it.member_id : null,
    reminder_minutes: typeof it.reminder_minutes === 'number' && it.reminder_minutes >= 0 && it.reminder_minutes <= 43200 ? Math.round(it.reminder_minutes) : null,
    source_quote: clean(it.source_quote, 300),
  };
}

/** Cria no app os itens confirmados. Retorna quantos foram criados de cada tipo. */
export function applyItems(s: Store, items: InboxItem[], opts: { members: Member[]; gamification: boolean; attachments?: Attachment[] }) {
  const counts: Partial<Record<InboxKind, number>> = {};
  const kids = opts.members.filter((m) => m.kind === 'child');
  const inc = (k: InboxKind) => { counts[k] = (counts[k] || 0) + 1; };
  for (const it of items) {
    const desc = [it.description, it.source_quote ? `“${it.source_quote}”` : null].filter(Boolean).join('\n\n') || undefined;
    if (it.kind === 'task' || (it.kind === 'event' && !it.date)) {
      s.save('tasks', {
        title: it.title, description: desc, assignee: it.assignee || 'family',
        category: TASK_CATS.some((c) => c.value === it.category) ? it.category! : 'outros', due_date: it.date, due_time: it.time,
        priority: 'normal', status: 'todo', subtasks: [], attachments: opts.attachments || [], stars: opts.gamification ? 1 : 0, recurrence: null,
      });
      inc('task');
    } else if (it.kind === 'event') {
      const allDay = it.all_day ?? !it.time;
      s.save('events', {
        title: it.title, date: it.date!, start_time: allDay ? null : it.time, end_time: allDay ? null : it.end_time, all_day: allDay,
        location: it.location || undefined, description: desc, participants: ['family'],
        category: EVENT_CATS.some((c) => c.value === it.category) ? it.category! : 'familia', reminders: [it.reminder_minutes ?? (allDay ? 1440 : 60)],
      });
      inc('event');
    } else if (it.kind === 'list_item') {
      let listId = it.list_id && s.get('lists', it.list_id) ? it.list_id : null;
      if (!listId) {
        const name = it.list_name || 'Compras';
        const found = s.all('lists').find((l) => !l.archived && normalize(l.name) === normalize(name));
        listId = found?.id || s.save('lists', { name, icon: 'cart', color: '#4A9B6A', category: 'compras', owners: ['family'], position: s.all('lists').length }).id;
      }
      const pos = Math.min(0, ...s.all('list_items').filter((i) => i.list_id === listId).map((i) => i.position)) - 1;
      s.save('list_items', { list_id: listId, name: it.title, qty: it.qty, unit: it.unit || undefined, price: it.price, notes: it.description || undefined, done: false, position: pos });
      inc('list_item');
    } else if (it.kind === 'child_record') {
      const kid = (it.member_id && kids.find((k) => k.id === it.member_id)) || kids[0];
      if (!kid) { s.save('memories', { title: it.title, date: it.date || today(), body: desc || it.title, tags: [] }); inc('memory'); continue; }
      s.save('child_records', { member_id: kid.id, kind: (it.child_kind as any) || 'reminder', date: it.date || today(), time: it.time, title: it.title, description: desc, data: {} });
      inc('child_record');
    } else if (it.kind === 'memory') {
      s.save('memories', { title: it.title, date: it.date || today(), body: it.description || it.title, tags: [], member_id: it.member_id && kids.some((k) => k.id === it.member_id) ? it.member_id : null });
      inc('memory');
    } else if (it.kind === 'wish') {
      s.save('wishes', { title: it.title, description: desc, category: 'experiencia', owner: it.assignee || 'family', priority: 'normal', progress: 0, status: 'dreaming', value: it.price });
      inc('wish');
    }
  }
  return counts;
}

export function countsText(c: Partial<Record<InboxKind, number>>) {
  const names: Record<InboxKind, [string, string]> = {
    task: ['missão', 'missões'], event: ['checkpoint', 'checkpoints'], list_item: ['item de lista', 'itens de lista'],
    child_record: ['registro da pequena', 'registros da pequena'], memory: ['memória', 'memórias'], wish: ['desejo', 'desejos'],
  };
  return (Object.keys(c) as InboxKind[]).map((k) => `${c[k]} ${c[k] === 1 ? names[k][0] : names[k][1]}`).join(', ');
}

export const ERROR_TEXT: Record<string, string> = {
  no_key: 'A IA ainda não foi ligada: falta cadastrar a chave ANTHROPIC_API_KEY nos segredos das Edge Functions do Supabase.',
  bad_key: 'A chave da Anthropic cadastrada no Supabase não foi aceita. Confira se ela está correta e ativa.',
  rate_limit: 'Muitos pedidos seguidos. Espere um minutinho e tente de novo.',
  refusal: 'A IA não conseguiu processar esse conteúdo. Tente reescrever o recado.',
  too_long: 'O conteúdo ficou grande demais para organizar de uma vez. Tente mandar em partes.',
  empty: 'Escreva um recado ou anexe um arquivo.',
  file_type: 'Só dá para mandar fotos (JPG, PNG, WEBP) e PDFs.',
  file_size: 'Cada arquivo pode ter até 10 MB.',
  forbidden: 'Você não tem acesso a esta família.',
  auth: 'Sua sessão expirou. Entre de novo.',
};
