// Itens de outras abas que têm data e geram lembrete aparecem também na agenda (Checkpoints).
// Não são copiados: são montados na hora a partir da origem, então mudar a data lá muda aqui.
import { useMemo } from 'react';
import { useTable } from '@/data/store';
import type { CalEvent, ChildRecord, Member, Message, Task } from '@/data/types';
import { isValidDate } from './dates';
import { CHILD_KINDS } from './domain';
import { ls } from './storage';

export const EXTRA_CATS = [
  { value: 'x-missao', label: 'Missões', color: '#E8624D' },
  { value: 'x-cuidados', label: 'Cuidados da filha', color: '#E0457B' },
  { value: 'x-capsula', label: 'Cápsulas do tempo', color: '#8B63AA' },
];

const base = (id: string, date: string, p: Partial<CalEvent>): CalEvent => ({
  id, family_id: '', created_at: '', updated_at: '', title: '', date, all_day: true, participants: [], category: 'x-missao', reminders: [], ...p,
});

export function reminderEvents(tasks: Task[], records: ChildRecord[], messages: Message[], members: Member[]): CalEvent[] {
  const out: CalEvent[] = [];
  for (const t of tasks) {
    if (t.status === 'done' || !isValidDate(t.due_date)) continue;
    out.push(base(`task:${t.id}`, t.due_date!, {
      title: t.title, all_day: !t.due_time, start_time: t.due_time || null, category: 'x-missao', color: '#E8624D',
      participants: t.assignee === 'both' || t.assignee === 'family' ? ['family'] : [t.assignee],
      virtual: { kind: 'task', link: `/missoes?t=${t.id}`, label: 'Missão' },
    }));
  }
  const kids = new Map(members.map((m) => [m.id, m]));
  for (const r of records) {
    if (!['consult', 'vaccine', 'reminder', 'school', 'medicine'].includes(r.kind)) continue;
    const who = kids.get(r.member_id);
    const name = who ? who.nickname || who.name : '';
    const dates = [r.date, r.data?.next_date].filter((d): d is string => isValidDate(d));
    dates.forEach((d, i) => out.push(base(`health:${r.id}:${i}`, d, {
      title: `${i ? 'Próxima: ' : ''}${r.title}${name ? ` · ${name}` : ''}`, all_day: !(i === 0 && r.time), start_time: i === 0 ? r.time || null : null,
      category: 'x-cuidados', color: '#E0457B', participants: who ? [who.id] : [],
      virtual: { kind: 'health', link: '/mini-player?tab=cuidados', label: CHILD_KINDS[r.kind].label },
    })));
  }
  for (const m of messages) {
    if (!m.open_at || m.read_at || !isValidDate(m.open_at)) continue;
    out.push(base(`capsule:${m.id}`, m.open_at, {
      title: `Cápsula abre: ${m.title}`, category: 'x-capsula', color: '#8B63AA',
      virtual: { kind: 'capsule', link: `/correio?m=${m.id}`, label: 'Cápsula do tempo' },
    }));
  }
  return out;
}

const KEY = 'rdt:cal:extras';
export const extrasOn = () => ls.get<boolean>(KEY, true);
export const setExtrasOn = (v: boolean) => ls.set(KEY, v);

/** Eventos de verdade + (opcional) itens de outras abas. */
export function useCalendarEvents(withExtras = true): CalEvent[] {
  const events = useTable('events'); const tasks = useTable('tasks'); const recs = useTable('child_records');
  const msgs = useTable('messages'); const members = useTable('members');
  return useMemo(() => (withExtras ? [...events, ...reminderEvents(tasks, recs, msgs, members)] : events), [withExtras, events, tasks, recs, msgs, members]);
}
