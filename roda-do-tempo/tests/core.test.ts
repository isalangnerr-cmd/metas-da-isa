import { describe, it, expect, beforeEach } from 'vitest';
import { addDays, addMonths, ageText, diffDays, relDay, zonedToDate, isValidDate, isValidTime, fmtDate } from '@/lib/dates';
import { occurrencesBetween, nextOccurrence } from '@/lib/recurrence';
import { toICS } from '@/lib/ics';
import { parseMoney, money } from '@/lib/format';
import { Store } from '@/data/store';
import type { Backend, Row } from '@/data/backend';
import { LocalBackend } from '@/data/backend';
import { completeTask, reopenTask, adventureProgress, checkAchievements, deterministicId, eventsBetween, taskBucket } from '@/lib/domain';
import { listStats } from '@/pages/Inventory';
import type { CalEvent, Task } from '@/data/types';

describe('datas (America/Sao_Paulo)', () => {
  it('soma meses respeitando fim do mês', () => {
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
  });
  it('formata DD/MM/AAAA e dias relativos', () => {
    expect(fmtDate('2026-03-09')).toBe('09/03/2026');
    expect(relDay('2026-03-10', '2026-03-09')).toBe('Amanhã');
    expect(relDay('2026-03-09', '2026-03-09')).toBe('Hoje');
  });
  it('calcula idade', () => {
    expect(ageText('2023-03-10', '2026-11-25')).toBe('3 anos');
    expect(ageText('2026-01-25', '2026-11-25')).toBe('10 meses');
    expect(ageText('2025-05-10', '2026-11-25')).toBe('1 ano e 6 meses');
  });
  it('converte horário local de São Paulo (UTC-3) para instante absoluto', () => {
    expect(zonedToDate('2026-11-25', '10:00').toISOString()).toBe('2026-11-25T13:00:00.000Z');
  });
  it('valida datas e horas', () => {
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('23:59')).toBe(true);
    expect(diffDays('2026-01-01', '2025-12-25')).toBe(7);
  });
});

describe('recorrência', () => {
  it('semanal com intervalo', () => {
    expect(occurrencesBetween('2026-11-02', { freq: 'weekly', interval: 2 }, '2026-11-01', '2026-12-01')).toEqual(['2026-11-02', '2026-11-16', '2026-11-30']);
  });
  it('mensal no dia 31 não "escorrega"', () => {
    expect(occurrencesBetween('2026-01-31', { freq: 'monthly' }, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('dias úteis pulam fim de semana', () => {
    expect(occurrencesBetween('2026-11-27', { freq: 'weekdays' }, '2026-11-27', '2026-12-01')).toEqual(['2026-11-27', '2026-11-30', '2026-12-01']);
  });
  it('respeita a data final', () => {
    expect(occurrencesBetween('2026-11-01', { freq: 'daily', until: '2026-11-03' }, '2026-11-01', '2026-11-10')).toHaveLength(3);
    expect(nextOccurrence('2026-11-03', { freq: 'daily', until: '2026-11-03' })).toBeNull();
  });
});

describe('dinheiro', () => {
  it('lê formatos brasileiros', () => {
    expect(parseMoney('1.234,56')).toBe(1234.56);
    expect(parseMoney('R$ 12,5')).toBe(12.5);
    expect(parseMoney('abc')).toBeNull();
    expect(money(10).replace(/\s/g, ' ')).toBe('R$ 10,00');
  });
});

const ev = (p: Partial<CalEvent>): CalEvent => ({ id: 'e1', family_id: 'f', created_at: '', updated_at: '', title: 'Teste', date: '2026-11-25', all_day: false, start_time: '10:00', end_time: '11:00', participants: [], category: 'familia', reminders: [30], ...p });

describe('calendário', () => {
  it('exporta ICS com fuso, recorrência e escape', () => {
    const ics = toICS([ev({ title: 'Jantar, só nós; ok', recurrence: { freq: 'weekly' }, exdates: ['2026-12-02'] })]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;TZID=America/Sao_Paulo:20261125T100000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY');
    expect(ics).toContain('SUMMARY:Jantar\\, só nós\; ok');
    expect(ics).toContain('EXDATE;TZID=America/Sao_Paulo:20261202T100000');
    expect(ics).toContain('TRIGGER:-PT30M');
  });
  it('eventos de dia inteiro usam DTEND exclusivo', () => {
    expect(toICS([ev({ all_day: true, start_time: null })])).toContain('DTEND;VALUE=DATE:20261126');
  });
  it('expande repetições e ignora datas excluídas', () => {
    const occ = eventsBetween([ev({ recurrence: { freq: 'weekly' }, exdates: ['2026-12-02'] })], '2026-11-25', '2026-12-10');
    expect(occ.map((o) => o.date)).toEqual(['2026-11-25', '2026-12-09']);
  });
  it('eventos de vários dias aparecem em cada dia', () => {
    expect(eventsBetween([ev({ end_date: '2026-11-27' })], '2026-11-26', '2026-11-30').map((o) => o.date)).toEqual(['2026-11-26', '2026-11-27']);
  });
});

// ---------- Store (sincronização) ----------
class FakeCloud implements Backend {
  mode = 'cloud' as const;
  rows = new Map<string, Row>();
  online = true;
  calls = 0;
  async fetchAll(t: string) { return [...this.rows.values()].filter((r) => r.__t === t).map(({ __t, ...r }) => r as Row); }
  async fetchOne(t: string, id: string) { const r = this.rows.get(t + id); if (!r) return null; const { __t, ...x } = r; return x as Row; }
  async upsert(t: string, rows: Row[]) {
    this.calls++;
    if (!this.online) throw new Error('Failed to fetch');
    const out: Row[] = [];
    for (const r0 of rows) {
      const { _op, ...r } = r0 as any;
      const cur = this.rows.get(t + (r.id ?? r.message_id));
      if (cur && r.updated_at < cur.updated_at) continue; // gatilho rdt_touch
      this.rows.set(t + (r.id ?? r.message_id), { ...r, __t: t }); out.push(r);
    }
    return out;
  }
  subscribe() { return () => {}; }
  async fetchBodies() { return {}; }
  async upload() { return 'x'; }
  async fileUrl() { return null; }
  async removeFile() {}
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('store: offline, fila e conflitos', () => {
  beforeEach(() => localStorage.clear());
  it('guarda na fila quando offline e envia ao voltar', async () => {
    const be = new FakeCloud(); be.online = false;
    const s = new Store(be, 'fam', 'u1'); await s.start();
    s.save('tasks', { title: 'Comprar pão' } as any);
    await tick(); await s.flush();
    expect(s.outbox.length).toBe(1);
    expect(s.sync.error).toBeTruthy();
    be.online = true; await s.flush();
    expect(s.outbox.length).toBe(0);
    expect([...be.rows.values()].some((r) => r.title === 'Comprar pão')).toBe(true);
    s.stop();
  });
  it('a fila sobrevive a recarregar o app', async () => {
    const be = new FakeCloud(); be.online = false;
    const s = new Store(be, 'fam', 'u1'); await s.start();
    s.save('lists', { name: 'Feira' } as any); s.persist(); s.stop();
    const s2 = new Store(be, 'fam', 'u1'); be.online = true; await s2.start(); await s2.flush();
    expect(s2.all('lists')[0].name).toBe('Feira');
    expect(s2.outbox.length).toBe(0);
    s2.stop();
  });
  it('conflito: versão mais nova do servidor vence e avisa', async () => {
    const be = new FakeCloud(); be.online = false;
    const s = new Store(be, 'fam', 'u1'); await s.start();
    const r = s.save('list_items', { name: 'Leite', list_id: 'l' } as any);
    // outra pessoa editou depois, já no servidor
    be.rows.set('list_items' + r.id, { ...r, name: 'Leite sem lactose', updated_at: new Date(Date.now() + 60000).toISOString(), __t: 'list_items' });
    let conflicted = false; s.onConflict = () => { conflicted = true; };
    be.online = true; await s.flush();
    expect(conflicted).toBe(true);
    expect(s.get('list_items', r.id)!.name).toBe('Leite sem lactose');
    s.stop();
  });
  it('conteúdo de carta vai para tabela separada (trava no servidor)', async () => {
    const be = new FakeCloud();
    const s = new Store(be, 'fam', 'u1'); await s.start();
    const m = s.save('messages', { sender_id: 'a', recipient_id: 'b', title: 'Oi', body: 'segredo', open_at: '2040-01-01' } as any);
    await tick(); await s.flush();
    expect(be.rows.get('messages' + m.id)!.body).toBeUndefined();
    expect(be.rows.get('message_bodies' + m.id)!.body).toBe('segredo');
    s.stop();
  });
  it('exclusão é suave (sincroniza entre aparelhos)', async () => {
    const s = new Store(new LocalBackend(), 'fam', 'u1'); await s.start();
    const t = s.save('tasks', { title: 'x' } as any);
    s.remove('tasks', t.id);
    expect(s.all('tasks')).toHaveLength(0);
    expect((s.data.tasks.get(t.id) as any).deleted).toBe(true);
  });
});

describe('regras do jogo', () => {
  beforeEach(() => localStorage.clear());
  const mk = (s: Store, p: Partial<Task>) => s.save('tasks', { title: 'Regar plantas', assignee: 'family', category: 'casa', priority: 'normal', status: 'todo', subtasks: [{ id: 's', title: 'a', done: true }], attachments: [], stars: 2, ...p });
  it('missão recorrente avança para a próxima data e registra conclusão e estrelas', async () => {
    const s = new Store(new LocalBackend(), 'fam', 'u1'); await s.start();
    const t = mk(s, { due_date: '2026-11-20', recurrence: { freq: 'weekly' } });
    const r = completeTask(s, t, 'm1', true);
    expect(r.recurring).toBe(true);
    const after = s.get('tasks', t.id)!;
    expect(after.status).toBe('todo');
    expect(after.due_date! > '2026-11-20').toBe(true);
    expect(after.subtasks[0].done).toBe(false);
    expect(s.all('task_completions')).toHaveLength(1);
    expect(s.all('star_transactions')[0].amount).toBe(2);
  });
  it('reabrir desfaz o registro sem punição extra', async () => {
    const s = new Store(new LocalBackend(), 'fam', 'u1'); await s.start();
    const t = mk(s, { due_date: '2026-11-20' });
    completeTask(s, t, 'm1', true);
    reopenTask(s, s.get('tasks', t.id)!);
    expect(s.get('tasks', t.id)!.status).toBe('todo');
    expect(s.all('star_transactions')).toHaveLength(0);
    expect(s.all('task_completions')).toHaveLength(0);
  });
  it('sem gamificação não gera estrelas', async () => {
    const s = new Store(new LocalBackend(), 'fam', 'u1'); await s.start();
    completeTask(s, mk(s, {}), 'm1', false);
    expect(s.all('star_transactions')).toHaveLength(0);
  });
  it('progresso da aventura vem das missões concluídas', async () => {
    const s = new Store(new LocalBackend(), 'fam', 'u1'); await s.start();
    const a = s.save('adventures', { name: 'Viagem', cover: 'beach', participants: [], status: 'active', links: [] });
    const t1 = mk(s, { adventure_id: a.id }); mk(s, { adventure_id: a.id });
    completeTask(s, t1, undefined, true);
    expect(adventureProgress(a, s.all('tasks')).pct).toBe(0.5);
  });
  it('conquistas são desbloqueadas uma vez só', async () => {
    const s = new Store(new LocalBackend(), 'fam', 'u1'); await s.start();
    completeTask(s, mk(s, {}), undefined, true);
    expect(checkAchievements(s).map((a) => a.key)).toContain('first_mission');
    expect(checkAchievements(s)).toHaveLength(0);
  });
  it('missões atrasadas não são punidas, só agrupadas', () => {
    expect(taskBucket({ status: 'todo', due_date: '2026-11-01' } as Task, '2026-11-25')).toBe('overdue');
  });
  it('id determinístico é um UUID estável', () => {
    const a = deterministicId('x:1'), b = deterministicId('x:1');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(deterministicId('x:2')).not.toBe(a);
  });
  it('total da lista de compras considera quantidade', () => {
    const st = listStats([{ price: 5, qty: 2, done: false }, { price: 10, qty: null, done: true }, { price: null, done: false }] as any);
    expect(st.sumAll).toBe(20); expect(st.sumOpen).toBe(10); expect(st.sumDone).toBe(10); expect(st.done).toBe(1);
  });
});
