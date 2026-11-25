import { addDays, addMonths, addYears, diffDays, weekday } from './dates';

export type Freq = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';
export interface Recurrence { freq: Freq; interval?: number; until?: string | null }

export const FREQ_LABEL: Record<Freq, string> = {
  none: 'Não repete', daily: 'Todo dia', weekdays: 'Dias úteis', weekly: 'Toda semana', monthly: 'Todo mês', yearly: 'Todo ano',
};

/** Próxima ocorrência estritamente depois de `from`. */
export function nextOccurrence(base: string, r: Recurrence | null | undefined, from = base): string | null {
  if (!r || r.freq === 'none') return null;
  const all = occurrencesBetween(base, r, addDays(from, 1), addDays(from, 400), 1);
  return all[0] ?? null;
}

/** Datas das ocorrências entre [a, b] (inclusive). */
export function occurrencesBetween(base: string, r: Recurrence | null | undefined, a: string, b: string, limit = 500): string[] {
  const out: string[] = [];
  if (!r || r.freq === 'none') { if (base >= a && base <= b) out.push(base); return out; }
  const step = Math.max(1, r.interval || 1);
  const until = r.until && r.until < b ? r.until : b;
  if (r.freq === 'daily' || r.freq === 'weekly' || r.freq === 'weekdays') {
    const unit = r.freq === 'weekly' ? 7 * step : r.freq === 'daily' ? step : 1;
    let d = base;
    if (a > base) { const k = Math.floor(diffDays(a, base) / unit); d = addDays(base, k * unit); }
    for (; d <= until && out.length < limit; d = addDays(d, unit)) {
      if (d < a) continue;
      if (r.freq === 'weekdays' && (weekday(d) === 0 || weekday(d) === 6)) continue;
      out.push(d);
    }
    return out;
  }
  const add = r.freq === 'monthly' ? addMonths : addYears;
  for (let i = 0; out.length < limit; i += step) {
    const d = add(base, i);
    if (d > until) break;
    if (d >= a) out.push(d);
    if (i > 5000) break;
  }
  return out;
}
