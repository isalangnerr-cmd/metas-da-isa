// Lê um arquivo iCal (.ics) e devolve os eventos que caem entre a e b,
// no mesmo formato que a API do Google Calendar usa (summary, start, end...).
import ICAL from "npm:ical.js@2.1.0";

export type Ev = {
  summary: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  status: string;
  transparency: string;
};

// deno-lint-ignore no-explicit-any
type T = any;

export function eventosEntre(txt: string, a: Date, b: Date, dia: string): Ev[] {
  const comp = new ICAL.Component(ICAL.parse(txt));
  for (const tz of comp.getAllSubcomponents("vtimezone")) {
    try { ICAL.TimezoneService.register(new ICAL.Timezone(tz)); } catch (_) { /* já registrado */ }
  }
  const evs = comp.getAllSubcomponents("vevent").map((v: T) => new ICAL.Event(v));
  const masters = evs.filter((e: T) => !e.isRecurrenceException());
  for (const ex of evs.filter((e: T) => e.isRecurrenceException())) {
    const m = masters.find((x: T) => x.uid === ex.uid);
    if (m) { try { m.relateException(ex); } catch (_) { /* ignora */ } }
  }
  const out: Ev[] = [];
  const push = (item: T, s: T, f: T) => {
    const st = String(item.component.getFirstPropertyValue("status") || "").toLowerCase();
    const tr = String(item.component.getFirstPropertyValue("transp") || "").toUpperCase() === "TRANSPARENT" ? "transparent" : "opaque";
    out.push({
      summary: String(item.summary || "(sem título)"),
      start: s.isDate ? { date: s.toString() } : { dateTime: s.toJSDate().toISOString() },
      end: s.isDate ? { date: (f || s).toString() } : { dateTime: (f || s).toJSDate().toISOString() },
      status: st,
      transparency: tr,
    });
  };
  // evento de dia inteiro: entra se o dia local estiver entre o início (incluso) e o fim (excluso)
  const cabeDia = (s: T, f: T) => s.toString() <= dia && (f ? f.toString() : s.toString()) > dia || s.toString() === dia;
  const cabeHora = (s: T, f: T) => s.toJSDate() < b && (f || s).toJSDate() > a;

  for (const ev of masters) {
    try {
      if (ev.isRecurring()) {
        const it = ev.iterator();
        let t: T, n = 0;
        while ((t = it.next()) && n++ < 20000) {
          const det = ev.getOccurrenceDetails(t);
          const s = det.startDate, f = det.endDate;
          if (s.isDate) {
            if (s.toString() > dia) break;
            if (cabeDia(s, f)) push(det.item, s, f);
            continue;
          }
          if (s.toJSDate() >= b) break;
          if (cabeHora(s, f)) push(det.item, s, f);
        }
      } else {
        const s = ev.startDate, f = ev.endDate;
        if (!s) continue;
        if (s.isDate ? cabeDia(s, f) : cabeHora(s, f)) push(ev, s, f);
      }
    } catch (_) { /* evento esquisito: pula */ }
  }
  return out.sort((x, y) => String(x.start.dateTime || x.start.date).localeCompare(String(y.start.dateTime || y.start.date)));
}

export async function lerIcs(url: string): Promise<{ txt?: string; codigo?: string }> {
  const r = await fetch(url, { headers: { "User-Agent": "metas-app" } });
  if (r.status === 404) return { codigo: "ics_404" };
  if (!r.ok) return { codigo: "ics" };
  return { txt: await r.text() };
}
