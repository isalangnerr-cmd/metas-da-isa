import { describe, it, expect, beforeEach } from 'vitest';
import { OUTPUT_SCHEMA, TASK_CATEGORIES, EVENT_CATEGORIES } from '../supabase/functions/rdt-inbox/schema';
import { applyItems, sanitize, countsText, type InboxItem } from '@/lib/inbox';
import { Store } from '@/data/store';
import { LocalBackend } from '@/data/backend';
import { TASK_CATS, EVENT_CATS } from '@/lib/domain';
import type { Member } from '@/data/types';

// Saída estruturada exige: todo objeto com additionalProperties:false e todas as chaves em "required"
function checkStrict(node: any, path = 'root') {
  if (node && typeof node === 'object') {
    const t = Array.isArray(node.type) ? node.type : [node.type];
    if (t.includes('object')) {
      expect(node.additionalProperties, path).toBe(false);
      expect([...node.required].sort(), path).toEqual(Object.keys(node.properties).sort());
    }
    for (const [k, v] of Object.entries(node)) if (v && typeof v === 'object') checkStrict(v, `${path}.${k}`);
  }
}

const base: InboxItem = { kind: 'task', title: 'x', description: null, date: null, time: null, end_time: null, all_day: null, location: null, assignee: null, category: null,
  list_id: null, list_name: null, qty: null, unit: null, price: null, child_kind: null, member_id: null, reminder_minutes: null, source_quote: null };
const mem = (p: Partial<Member>): Member => ({ id: 'm', family_id: 'f', created_at: '', updated_at: '', kind: 'adult', name: 'A', color: '#000000', avatar: {} as any, position: 0, ...p });
const members = [mem({ id: 'a1' }), mem({ id: 'a2' }), mem({ id: 'k1', kind: 'child', name: 'Liz' })];

describe('caixa de entrada', () => {
  beforeEach(() => localStorage.clear());
  it('esquema da resposta é estrito (exigência da saída estruturada)', () => checkStrict(OUTPUT_SCHEMA));
  it('esquema usa só formatos aceitos pela API (sem lista de tipos; enum do mesmo tipo declarado)', () => {
    const walk = (n: any, path: string) => {
      if (!n || typeof n !== 'object') return;
      if ('type' in n) expect(Array.isArray(n.type), `${path}: use anyOf em vez de lista de tipos`).toBe(false);
      if (n.enum && n.type) for (const v of n.enum) expect(typeof v === (n.type === 'integer' ? 'number' : n.type), `${path}: enum ${v}`).toBe(true);
      for (const [k, v] of Object.entries(n)) walk(v, `${path}.${k}`);
    };
    walk(OUTPUT_SCHEMA, 'root');
    // limite da API: no máximo 16 campos com união (anyOf / lista de tipos)
    let unions = 0;
    const count = (n: any) => { if (!n || typeof n !== 'object') return; if (n.anyOf || Array.isArray(n.type)) unions++; Object.values(n).forEach(count); };
    count(OUTPUT_SCHEMA);
    expect(unions).toBeLessThanOrEqual(16);
  });
  it('aceita a resposta com textos vazios ("") no lugar de null', () => {
    const it = sanitize({ ...base, kind: 'event', title: 'Banho da Pandora', date: '2026-11-28', time: '14:00', description: '', location: '', assignee: '', child_kind: '' as any, member_id: '', all_day: false }, members);
    expect(it.description).toBeNull(); expect(it.location).toBeNull(); expect(it.assignee).toBe('family'); expect(it.child_kind).toBeNull(); expect(it.member_id).toBeNull();
  });
  it('categorias da IA batem com as do app', () => {
    expect(TASK_CATEGORIES.sort()).toEqual(TASK_CATS.map((c) => c.value).sort());
    expect(EVENT_CATEGORIES.sort()).toEqual(EVENT_CATS.map((c) => c.value).sort());
  });
  it('não confia cegamente na IA: valida ids, datas e horários', () => {
    const it = sanitize({ ...base, assignee: 'id-inventado', date: '2026-02-30', time: '25:00', member_id: 'x', price: -3, kind: 'hack' as any }, members);
    expect(it.assignee).toBe('family'); expect(it.date).toBeNull(); expect(it.time).toBeNull();
    expect(it.member_id).toBeNull(); expect(it.price).toBeNull(); expect(it.kind).toBe('task');
  });
  it('cria evento, missão da véspera e item numa lista nova', async () => {
    const s = new Store(new LocalBackend(), 'fam', 'u'); await s.start();
    const counts = applyItems(s, [
      sanitize({ ...base, kind: 'event', title: 'Festa junina', date: '2026-06-19', time: '15:00', category: 'filha' }, members),
      sanitize({ ...base, kind: 'task', title: 'Levar prato doce', date: '2026-06-18', assignee: 'both', category: 'filha' }, members),
      sanitize({ ...base, kind: 'list_item', title: 'Paçoca', qty: 2, list_name: 'Festa junina' }, members),
      sanitize({ ...base, kind: 'list_item', title: 'Pé de moleque', list_name: 'festa junina' }, members),
    ], { members, gamification: true });
    expect(counts).toEqual({ event: 1, task: 1, list_item: 2 });
    const ev = s.all('events')[0];
    expect(ev.start_time).toBe('15:00'); expect(ev.all_day).toBe(false); expect(ev.reminders).toEqual([1440, 15]);
    expect(s.all('tasks')[0].assignee).toBe('both');
    expect(s.all('lists')).toHaveLength(1); // reaproveita a lista pelo nome (sem acento/maiúscula)
    expect(countsText(counts)).toBe('1 checkpoint, 1 missão, 2 itens de lista');
  });
  it('evento sem data vira missão; registro da filha vai para o perfil dela', async () => {
    const s = new Store(new LocalBackend(), 'fam', 'u'); await s.start();
    applyItems(s, [
      sanitize({ ...base, kind: 'event', title: 'Reunião de pais (data a confirmar)' }, members),
      sanitize({ ...base, kind: 'child_record', title: 'Vacina gripe', child_kind: 'vaccine', date: '2026-12-12' }, members),
    ], { members, gamification: false });
    expect(s.all('tasks')[0].title).toContain('Reunião'); expect(s.all('tasks')[0].stars).toBe(0);
    const r = s.all('child_records')[0]; expect(r.member_id).toBe('k1'); expect(r.kind).toBe('vaccine');
  });
});
