// Exportação iCalendar (RFC 5545). Horários no fuso America/Sao_Paulo (TZID).
// Arquitetura pronta para integração futura: veja src/lib/calendarSync.ts
import type { CalEvent } from '@/data/types';
import { addDays } from './dates';

const esc = (s = '') => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const d8 = (d: string) => d.replace(/-/g, '');
const t6 = (t: string) => t.replace(':', '') + '00';
function fold(line: string) {
  const out: string[] = []; let s = line;
  while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); }
  out.push(s); return out.join('\r\n');
}
const RRULE: Record<string, string> = { daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };

export function eventToVevent(e: CalEvent, stamp = new Date()): string[] {
  const L: string[] = ['BEGIN:VEVENT', `UID:${e.id}@rodadotempo`, `DTSTAMP:${stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`];
  if (e.all_day || !e.start_time) {
    L.push(`DTSTART;VALUE=DATE:${d8(e.date)}`, `DTEND;VALUE=DATE:${d8(addDays(e.end_date || e.date, 1))}`);
  } else {
    L.push(`DTSTART;TZID=America/Sao_Paulo:${d8(e.date)}T${t6(e.start_time)}`);
    const endT = e.end_time || e.start_time;
    L.push(`DTEND;TZID=America/Sao_Paulo:${d8(e.end_date || e.date)}T${t6(endT)}`);
  }
  L.push(`SUMMARY:${esc(e.title)}`);
  if (e.location) L.push(`LOCATION:${esc(e.location)}`);
  if (e.description) L.push(`DESCRIPTION:${esc(e.description)}`);
  if (e.category) L.push(`CATEGORIES:${esc(e.category)}`);
  if (e.recurrence && e.recurrence.freq !== 'none') {
    let r = RRULE[e.recurrence.freq];
    if (e.recurrence.interval && e.recurrence.interval > 1) r += `;INTERVAL=${e.recurrence.interval}`;
    if (e.recurrence.until) r += `;UNTIL=${d8(e.recurrence.until)}T235959Z`;
    L.push(`RRULE:${r}`);
  }
  for (const x of e.exdates || []) L.push(e.all_day || !e.start_time ? `EXDATE;VALUE=DATE:${d8(x)}` : `EXDATE;TZID=America/Sao_Paulo:${d8(x)}T${t6(e.start_time)}`);
  for (const m of e.reminders || []) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${m}M`, 'END:VALARM');
  L.push('END:VEVENT');
  return L;
}

export function toICS(events: CalEvent[], name = 'Roda do Tempo'): string {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Roda do Tempo//PT-BR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:America/Sao_Paulo',
    'BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE'];
  for (const e of events) L.push(...eventToVevent(e));
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

export function downloadText(name: string, text: string, type = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
