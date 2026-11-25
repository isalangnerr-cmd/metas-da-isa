import type { IconName } from '@/components/icons';
import type { Adventure, CalEvent, Member, Task, Tables, WishStatus, AdvStatus, ChildRecordKind, MessageKind, Priority } from '@/data/types';
import type { Store } from '@/data/store';
import { addDays, diffDays, startOfWeek, today } from './dates';
import { nextOccurrence, occurrencesBetween } from './recurrence';

export interface Cat { value: string; label: string; icon: IconName; color: string }
export const TASK_CATS: Cat[] = [
  { value: 'casa', label: 'Casa', icon: 'home', color: '#8A5A3B' },
  { value: 'filha', label: 'Filha', icon: 'rattle', color: '#E9B949' },
  { value: 'pet', label: 'Cachorrinha', icon: 'paw', color: '#C9924A' },
  { value: 'compras', label: 'Compras', icon: 'cart', color: '#5E7B3A' },
  { value: 'saude', label: 'Saúde', icon: 'pill', color: '#C2643C' },
  { value: 'financeiro', label: 'Financeiro', icon: 'gift', color: '#6E9FB5' },
  { value: 'trabalho', label: 'Trabalho', icon: 'book', color: '#4B5D73' },
  { value: 'relacionamento', label: 'Relacionamento', icon: 'heart', color: '#B5543A' },
  { value: 'lazer', label: 'Lazer', icon: 'game', color: '#8A5A7A' },
  { value: 'pessoal', label: 'Pessoal', icon: 'user', color: '#7A6553' },
  { value: 'outros', label: 'Outros', icon: 'sparkle', color: '#7A6553' },
];
export const EVENT_CATS: Cat[] = [
  { value: 'familia', label: 'Família', icon: 'users', color: '#5E7B3A' },
  { value: 'casal', label: 'Casal', icon: 'heart', color: '#B5543A' },
  { value: 'filha', label: 'Filha', icon: 'rattle', color: '#D9A62E' },
  { value: 'consulta', label: 'Consultas', icon: 'pill', color: '#C2643C' },
  { value: 'trabalho', label: 'Trabalho', icon: 'book', color: '#4B5D73' },
  { value: 'aniversario', label: 'Aniversários', icon: 'gift', color: '#8A5A7A' },
  { value: 'viagem', label: 'Viagens', icon: 'plane', color: '#6E9FB5' },
  { value: 'pet', label: 'Cachorrinha', icon: 'paw', color: '#C9924A' },
  { value: 'contas', label: 'Contas', icon: 'cart', color: '#7A6553' },
  { value: 'pessoal', label: 'Pessoal', icon: 'user', color: '#8A5A3B' },
];
export const LIST_CATS: Cat[] = [
  { value: 'compras', label: 'Compras', icon: 'cart', color: '#5E7B3A' },
  { value: 'casa', label: 'Casa', icon: 'home', color: '#8A5A3B' },
  { value: 'viagem', label: 'Viagem', icon: 'plane', color: '#6E9FB5' },
  { value: 'filha', label: 'Filha', icon: 'rattle', color: '#D9A62E' },
  { value: 'pet', label: 'Cachorrinha', icon: 'paw', color: '#C9924A' },
  { value: 'cultura', label: 'Filmes, séries e livros', icon: 'film', color: '#8A5A7A' },
  { value: 'lugares', label: 'Lugares', icon: 'pin', color: '#C2643C' },
  { value: 'presentes', label: 'Presentes', icon: 'gift', color: '#B5543A' },
  { value: 'outros', label: 'Outros', icon: 'list', color: '#7A6553' },
];
export const LIST_ICONS: IconName[] = ['cart', 'bag', 'pill', 'home', 'plane', 'rattle', 'gift', 'film', 'book', 'pin', 'paw', 'list', 'heart', 'star'];
export const COLORS = ['#5E7B3A', '#C2643C', '#E9B949', '#6E9FB5', '#8A5A7A', '#8A5A3B', '#B5543A', '#4B5D73'];

export const LIST_TEMPLATES: { name: string; icon: IconName; color: string; category: string; items: string[] }[] = [
  { name: 'Supermercado da semana', icon: 'cart', color: '#5E7B3A', category: 'compras', items: ['Arroz', 'Feijão', 'Leite', 'Ovos', 'Pão', 'Frutas', 'Legumes', 'Café', 'Papel higiênico', 'Detergente'] },
  { name: 'Farmácia', icon: 'pill', color: '#C2643C', category: 'compras', items: ['Protetor solar', 'Pomada para assaduras', 'Soro fisiológico', 'Termômetro', 'Curativos'] },
  { name: 'Mala de viagem', icon: 'plane', color: '#6E9FB5', category: 'viagem', items: ['Documentos', 'Carregadores', 'Roupas', 'Pijamas', 'Escova de dentes', 'Remédios', 'Brinquedo favorito', 'Ração e potinho'] },
  { name: 'Compras da filha', icon: 'rattle', color: '#D9A62E', category: 'filha', items: ['Fraldas', 'Lenços umedecidos', 'Roupinhas', 'Lanche da escola'] },
  { name: 'Itens da cachorrinha', icon: 'paw', color: '#C9924A', category: 'pet', items: ['Ração', 'Petiscos', 'Tapete higiênico', 'Shampoo', 'Vermífugo'] },
  { name: 'Filmes e séries', icon: 'film', color: '#8A5A7A', category: 'cultura', items: [] },
  { name: 'Restaurantes para conhecer', icon: 'pin', color: '#C2643C', category: 'lugares', items: [] },
  { name: 'Livros', icon: 'book', color: '#8A5A3B', category: 'cultura', items: [] },
  { name: 'Checklist de mudança', icon: 'home', color: '#8A5A3B', category: 'casa', items: ['Caixas e fita', 'Transferir internet', 'Atualizar endereço', 'Contratar mudança', 'Limpeza do novo apê', 'Etiquetar caixas por cômodo'] },
  { name: 'Presentes', icon: 'gift', color: '#B5543A', category: 'presentes', items: [] },
];

export const PRIORITY: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Tranquila', color: '#6E9FB5' }, normal: { label: 'Normal', color: '#5E7B3A' }, high: { label: 'Importante', color: '#C2643C' },
};
export const WISH_STATUS: Record<WishStatus, { label: string; icon: IconName }> = {
  dreaming: { label: 'Sonhando', icon: 'cloud' }, planning: { label: 'Planejando', icon: 'map' }, progress: { label: 'Em andamento', icon: 'play' },
  done: { label: 'Realizado', icon: 'trophy' }, archived: { label: 'Arquivado', icon: 'book' },
};
export const WISH_CATS: Cat[] = [
  { value: 'casa', label: 'Para a casa', icon: 'home', color: '#8A5A3B' },
  { value: 'lugar', label: 'Lugar / restaurante', icon: 'pin', color: '#C2643C' },
  { value: 'viagem', label: 'Viagem', icon: 'plane', color: '#6E9FB5' },
  { value: 'presente', label: 'Presente', icon: 'gift', color: '#B5543A' },
  { value: 'sonho', label: 'Grande sonho', icon: 'star', color: '#E9B949' },
  { value: 'aprender', label: 'Aprender algo', icon: 'book', color: '#4B5D73' },
  { value: 'experiencia', label: 'Experiência em família', icon: 'users', color: '#5E7B3A' },
];
export const ADV_STATUS: Record<AdvStatus, string> = { future: 'Em breve', active: 'Em andamento', done: 'Concluída' };
export const ADV_COVERS: { value: string; label: string }[] = [
  { value: 'mountain', label: 'Montanhas' }, { value: 'beach', label: 'Praia' }, { value: 'city', label: 'Cidade' },
  { value: 'house', label: 'Casa nova' }, { value: 'party', label: 'Festa' }, { value: 'forest', label: 'Floresta' }, { value: 'night', label: 'Noite estrelada' },
];
export const CHILD_KINDS: Record<ChildRecordKind, { label: string; icon: IconName; group: 'timeline' | 'care' }> = {
  moment: { label: 'Momento', icon: 'star', group: 'timeline' },
  consult: { label: 'Consulta', icon: 'pill', group: 'care' },
  vaccine: { label: 'Vacina', icon: 'sparkle', group: 'care' },
  growth: { label: 'Peso e altura', icon: 'up', group: 'care' },
  food: { label: 'Alimentação', icon: 'heart', group: 'care' },
  sleep: { label: 'Sono', icon: 'moon', group: 'care' },
  school: { label: 'Escola', icon: 'book', group: 'care' },
  medicine: { label: 'Medicamento', icon: 'pill', group: 'care' },
  reminder: { label: 'Lembrete', icon: 'bell', group: 'care' },
};
export const MOMENT_CATS = ['Primeiros passos', 'Primeiras palavras', 'Viagem', 'Aniversário', 'Descoberta', 'Momento engraçado', 'Conquista', 'Foto', 'Vídeo ou link', 'Cotidiano'];
export const MESSAGE_KINDS: Record<MessageKind, { label: string; color: string }> = {
  note: { label: 'Bilhete de carinho', color: '#E8624D' }, thanks: { label: 'Agradecimento', color: '#4A9B6A' },
  surprise: { label: 'Surpresa', color: '#F2B544' }, future: { label: 'Carta para o futuro', color: '#4F8CC9' }, capsule: { label: 'Cápsula do tempo', color: '#8B63AA' },
};

export const catOf = (list: Cat[], v?: string) => list.find((c) => c.value === v) || list[list.length - 1];

// ---------- Responsáveis ----------
export function assigneeLabel(a: string, members: Member[], meId?: string) {
  if (a === 'both') return 'Nós dois';
  if (a === 'family') return 'Família';
  const m = members.find((x) => x.id === a);
  if (!m) return 'Família';
  return m.id === meId ? `${m.nickname || m.name} (eu)` : m.nickname || m.name;
}
export function isMine(a: string, meId?: string) { return a === meId || a === 'both' || a === 'family'; }

// ---------- Missões ----------
export const isOverdue = (t: Task, ref = today()) => t.status !== 'done' && !!t.due_date && t.due_date < ref;
export const isToday = (t: Task, ref = today()) => t.status !== 'done' && (t.due_date === ref || (!!t.start_date && t.start_date <= ref && (!t.due_date || t.due_date >= ref)));
export function taskBucket(t: Task, ref = today()): 'overdue' | 'today' | 'week' | 'later' | 'nodate' | 'done' {
  if (t.status === 'done') return 'done';
  if (!t.due_date) return t.start_date && t.start_date <= ref ? 'today' : 'nodate';
  if (t.due_date < ref) return 'overdue';
  if (t.due_date === ref) return 'today';
  if (t.due_date <= addDays(startOfWeek(ref), 6) || diffDays(t.due_date, ref) <= 6) return 'week';
  return 'later';
}

export function completeTask(s: Store, t: Task, meId: string | undefined, gamification: boolean) {
  const date = today();
  s.save('task_completions', { task_id: t.id, title: t.title, member_id: meId, date, stars: gamification ? t.stars : 0 });
  if (gamification && t.stars > 0) s.save('star_transactions', { amount: t.stars, source: 'task', ref_id: t.id, member_id: meId, note: t.title });
  const next = t.recurrence && t.recurrence.freq !== 'none' ? nextOccurrence(t.due_date || date, t.recurrence, t.due_date && t.due_date > date ? t.due_date : date) : null;
  if (next && (!t.recurrence?.until || next <= t.recurrence.until)) {
    const shift = t.start_date && t.due_date ? diffDays(next, t.due_date) : 0;
    s.save('tasks', { id: t.id, due_date: next, start_date: t.start_date ? addDays(t.start_date, shift) : null, status: 'todo', subtasks: t.subtasks.map((x) => ({ ...x, done: false })), completed_at: new Date().toISOString(), completed_by: meId });
    return { recurring: true, next };
  }
  s.save('tasks', { id: t.id, status: 'done', completed_at: new Date().toISOString(), completed_by: meId });
  return { recurring: false, next: null };
}
export function reopenTask(s: Store, t: Task) {
  s.save('tasks', { id: t.id, status: 'todo', completed_at: null });
  if (t.status === 'done') {
    // devolve as estrelas da última conclusão desta missão (sem "perder pontos": só desfaz o registro)
    const last = s.all('star_transactions').filter((x) => x.ref_id === t.id && x.source === 'task').sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (last) s.remove('star_transactions', last.id);
    const comp = s.all('task_completions').filter((x) => x.task_id === t.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (comp) s.remove('task_completions', comp.id);
  }
}

// ---------- Aventuras ----------
export function adventureProgress(a: Adventure, tasks: Task[]) {
  const ts = tasks.filter((t) => t.adventure_id === a.id);
  if (!ts.length) return { done: 0, total: 0, pct: a.status === 'done' ? 1 : 0 };
  const done = ts.filter((t) => t.status === 'done').length;
  return { done, total: ts.length, pct: done / ts.length };
}

// ---------- Eventos expandidos (recorrência) ----------
export interface Occ { ev: CalEvent; date: string }
export function eventsBetween(events: CalEvent[], a: string, b: string): Occ[] {
  const out: Occ[] = [];
  for (const ev of events) {
    const span = ev.end_date && ev.end_date > ev.date ? diffDays(ev.end_date, ev.date) : 0;
    const dates = occurrencesBetween(ev.date, ev.recurrence, addDays(a, -span), b);
    for (const d of dates) {
      if (ev.exdates?.includes(d)) continue;
      for (let i = 0; i <= span; i++) { const dd = addDays(d, i); if (dd >= a && dd <= b) out.push({ ev, date: dd }); }
    }
  }
  return out.sort((x, y) => (x.date + (x.ev.all_day ? '00' : x.ev.start_time || '99')).localeCompare(y.date + (y.ev.all_day ? '00' : y.ev.start_time || '99')));
}

// ---------- Conquistas ----------
export interface AchDef { key: string; title: string; text: string; icon: IconName; unlock?: string; test: (d: Data) => boolean }
type Data = { [K in keyof Tables]: Tables[K][] };
export const COSMETICS: Record<string, string> = {
  flowers: 'Canteiro de flores', lantern: 'Lanterna no jardim', flag: 'Bandeira da família', rainbow: 'Arco-íris no céu',
  mailbox: 'Caixa de correio vermelha', treehouse: 'Casinha na árvore', fireflies: 'Vaga-lumes à noite',
};
export const ACHIEVEMENTS: AchDef[] = [
  { key: 'first_mission', title: 'Primeira missão', text: 'Concluíram a primeira missão juntos.', icon: 'sword', unlock: 'flowers', test: (d) => d.task_completions.length >= 1 },
  { key: 'first_checkpoint', title: 'Primeiro checkpoint', text: 'Marcaram o primeiro compromisso no calendário.', icon: 'flag', unlock: 'flag', test: (d) => d.events.some((e) => !e.example) },
  { key: 'team_week', title: 'Uma semana em equipe', text: 'Concluíram missões em 5 dias diferentes de uma mesma semana.', icon: 'users', unlock: 'lantern', test: (d) => {
    const weeks = new Map<string, Set<string>>();
    for (const c of d.task_completions) { const w = startOfWeek(c.date); if (!weeks.has(w)) weeks.set(w, new Set()); weeks.get(w)!.add(c.date); }
    return [...weeks.values()].some((s) => s.size >= 5);
  } },
  { key: 'first_adventure', title: 'Nossa primeira aventura', text: 'Concluíram uma aventura inteira.', icon: 'map', unlock: 'treehouse', test: (d) => d.adventures.some((a) => a.status === 'done') },
  { key: 'dream_come_true', title: 'Um sonho realizado', text: 'Realizaram um desejo da lista de estrelas.', icon: 'star', unlock: 'rainbow', test: (d) => d.wishes.some((w) => w.status === 'done') },
  { key: 'memories', title: 'Memórias para sempre', text: 'Guardaram 10 memórias e momentos.', icon: 'heart', unlock: 'fireflies', test: (d) => d.memories.length + d.child_records.filter((r) => r.kind === 'moment').length >= 10 },
  { key: 'home_order', title: 'Casa em ordem', text: 'Concluíram 20 missões da casa.', icon: 'home', test: (d) => {
    const ids = new Set(d.tasks.filter((t) => t.category === 'casa').map((t) => t.id));
    return d.task_completions.filter((c) => ids.has(c.task_id)).length >= 20;
  } },
  { key: 'better_together', title: 'Juntos somos melhores', text: 'Concluíram 10 missões de "nós dois" ou "família".', icon: 'heart', test: (d) => {
    const ids = new Set(d.tasks.filter((t) => t.assignee === 'both' || t.assignee === 'family').map((t) => t.id));
    return d.task_completions.filter((c) => ids.has(c.task_id)).length >= 10;
  } },
  { key: 'first_letter', title: 'Correio aberto', text: 'Mandaram a primeira carta pelo correio.', icon: 'mail', unlock: 'mailbox', test: (d) => d.messages.length >= 1 },
];

/** Verifica conquistas novas e registra. Retorna as recém-desbloqueadas. */
export function checkAchievements(s: Store): AchDef[] {
  const data = Object.fromEntries((['tasks', 'task_completions', 'events', 'adventures', 'wishes', 'memories', 'child_records', 'messages'] as const).map((t) => [t, s.all(t)])) as any as Data;
  const have = new Set(s.all('achievements').map((a) => a.key));
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.key) && a.test(data));
  for (const a of fresh) s.save('achievements', { id: deterministicId(s.familyId + ':ach:' + a.key), key: a.key, unlocked_at: new Date().toISOString() });
  return fresh;
}

/** UUID determinístico (mesma chave = mesmo id), evita duplicar avisos e conquistas entre aparelhos. */
export function deterministicId(key: string) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x12345678, h4 = 0x9e3779b9;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); h3 = Math.imul(h3 ^ c, 2246822507); h4 = Math.imul(h4 ^ c, 3266489909);
  }
  const hex = [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${'89ab'[parseInt(hex[16], 16) & 3]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function starTotals(s: Store) {
  const tx = s.all('star_transactions');
  return { total: tx.reduce((a, b) => a + b.amount, 0), week: tx.filter((t) => t.created_at.slice(0, 10) >= addDays(today(), -6)).reduce((a, b) => a + b.amount, 0) };
}
