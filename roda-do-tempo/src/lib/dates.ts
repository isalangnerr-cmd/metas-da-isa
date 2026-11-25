// Datas no fuso America/Sao_Paulo. Datas "de calendário" são strings YYYY-MM-DD
// e horários são HH:MM (24h), sempre interpretados no fuso da família.
export const TZ = 'America/Sao_Paulo';

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function nowParts(d = new Date()) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, hour: +p.hour, minute: +p.minute };
}
export const today = (d = new Date()) => nowParts(d).date;
export const nowTime = (d = new Date()) => nowParts(d).time;

const toUTC = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const fromUTC = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(s: string, n: number) { const d = toUTC(s); d.setUTCDate(d.getUTCDate() + n); return fromUTC(d); }
export function addMonths(s: string, n: number) {
  const [y, m, d] = s.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return fromUTC(target);
}
export const addYears = (s: string, n: number) => addMonths(s, n * 12);
export const diffDays = (a: string, b: string) => Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 864e5);
export const weekday = (s: string) => toUTC(s).getUTCDay(); // 0 = domingo
export function startOfWeek(s: string) { return addDays(s, -weekday(s)); }
export const startOfMonth = (s: string) => s.slice(0, 8) + '01';
export function daysInMonth(s: string) { const [y, m] = s.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
export const isValidDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUTC(toUTC(s)) === s;
export const isValidTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const monthName = (m: number) => MESES[m];

/** DD/MM/AAAA */
export function fmtDate(s?: string | null) { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
export function fmtDateLong(s: string) { const [y, m, d] = s.split('-').map(Number); return `${DIAS[weekday(s)]}, ${d} de ${MESES[m - 1]} de ${y}`; }
export function fmtDayMonth(s: string) { const [, m, d] = s.split('-').map(Number); return `${d} de ${MESES[m - 1].slice(0, 3)}`; }

/** "Hoje", "Amanhã", "Ontem", "sex, 28/11" */
export function relDay(s?: string | null, ref = today()) {
  if (!s) return 'Sem data';
  const d = diffDays(s, ref);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  if (d === -1) return 'Ontem';
  return `${DIAS_CURTOS[weekday(s)]}, ${s.slice(8, 10)}/${s.slice(5, 7)}${s.slice(0, 4) !== ref.slice(0, 4) ? '/' + s.slice(0, 4) : ''}`;
}

export function greeting(hour = nowParts().hour) {
  if (hour < 5) return 'Boa madrugada';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Idade em anos, meses e dias, por extenso. */
export function ageText(birth: string, ref = today()) {
  let [by, bm, bd] = birth.split('-').map(Number);
  const [ry, rm, rd] = ref.split('-').map(Number);
  if (diffDays(ref, birth) < 0) return 'ainda vai chegar';
  let years = ry - by, months = rm - bm, days = rd - bd;
  if (days < 0) { months -= 1; days += daysInMonth(addMonths(ref, -1)); }
  if (months < 0) { years -= 1; months += 12; }
  const pl = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  if (years === 0 && months === 0) return pl(days, 'dia', 'dias');
  if (years === 0) return pl(months, 'mês', 'meses') + (days ? ` e ${pl(days, 'dia', 'dias')}` : '');
  if (years < 3 && months) return `${pl(years, 'ano', 'anos')} e ${pl(months, 'mês', 'meses')}`;
  return pl(years, 'ano', 'anos');
}

/** Converte data+hora local de São Paulo para Date (instante absoluto). */
export function zonedToDate(date: string, time = '00:00') {
  const [y, m, d] = date.split('-').map(Number);
  const [H, M] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, H, M);
  const p = nowParts(new Date(guess));
  const [py, pm, pd] = p.date.split('-').map(Number);
  const off = Date.UTC(py, pm - 1, pd, p.hour, p.minute) - guess;
  return new Date(guess - off);
}
export const cmpDateTime = (a: { date?: string | null; time?: string | null }, b: { date?: string | null; time?: string | null }) =>
  `${a.date || '9999'}${a.time || '99'}`.localeCompare(`${b.date || '9999'}${b.time || '99'}`);
