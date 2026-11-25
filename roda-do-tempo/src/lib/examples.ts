// Exemplos opcionais (marcados com example=true) para ver o app "vivo". Removíveis a qualquer momento.
import type { Store } from '@/data/store';
import type { Member } from '@/data/types';
import { addDays, today } from './dates';

export function seedExamples(s: Store, members: Member[]) {
  const t = today();
  const adults = members.filter((m) => m.kind === 'adult');
  const me = adults[0]?.id || 'family';
  const base = { status: 'todo' as const, subtasks: [], attachments: [], stars: 1, priority: 'normal' as const, example: true };
  s.saveMany('tasks', [
    { ...base, title: 'Preparar um café da manhã juntos', assignee: 'both', category: 'relacionamento', due_date: t },
    { ...base, title: 'Separar o material da escola', assignee: 'family', category: 'filha', due_date: addDays(t, 1) },
    { ...base, title: 'Fazer as compras da semana', assignee: me, category: 'compras', due_date: addDays(t, 1) },
    { ...base, title: 'Passear com a cachorrinha', assignee: 'family', category: 'pet', due_date: t, recurrence: { freq: 'daily' } },
  ]);
  s.saveMany('events', [
    { title: 'Piquenique em família', date: addDays(t, 2), start_time: '10:00', end_time: '13:00', all_day: false, participants: ['family'], category: 'familia', reminders: [60], example: true },
    { title: 'Uma noite só nossa', date: addDays(t, 4), start_time: '20:00', end_time: '23:00', all_day: false, participants: adults.map((a) => a.id), category: 'casal', reminders: [180], example: true },
  ]);
  const a = s.save('adventures', { name: 'Nossa próxima viagem', cover: 'beach', participants: ['family'], status: 'active', links: [], notes: '', example: true });
  s.saveMany('tasks', ['Escolher destino', 'Definir orçamento', 'Reservar hospedagem', 'Comprar passagens', 'Preparar roteiro', 'Organizar malas']
    .map((title, i) => ({ ...base, title, assignee: 'both', category: 'lazer', adventure_id: a.id, due_date: addDays(t, 7 * (i + 1)) })));
  const l = s.save('lists', { name: 'Compras da semana', icon: 'cart', color: '#5E7B3A', category: 'compras', owners: ['family'], position: 0, example: true });
  s.saveMany('list_items', [['Leite', 2, 5.49], ['Pão de forma', 1, 9.9], ['Bananas', 1, 6.5], ['Ração', 1, 89.9]].map(([name, qty, price], i) => ({ list_id: l.id, name: name as string, qty: qty as number, price: price as number, done: false, position: i })));
}

export function removeExamples(s: Store) {
  for (const t of ['tasks', 'events', 'adventures', 'lists'] as const) {
    for (const r of s.all(t) as any[]) if (r.example) {
      s.remove(t, r.id);
      if (t === 'lists') for (const i of s.all('list_items')) if (i.list_id === r.id) s.remove('list_items', i.id);
    }
  }
}
