// Roda a cada 15 min (pg_cron). Olha os dados de cada pessoa e manda notificação quando faz sentido:
// - leitura: depois das 21h, se a meta de % do dia ainda não foi batida
// - sequência: depois das 20h, se ainda não riscou nada hoje e a sequência vai acabar
// - livre: entre 8h e 21h, quando um compromisso acabou e sobrou tempo livre antes do próximo
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { eventosEntre, lerIcs } from "./ics.ts";

// deno-lint-ignore no-explicit-any
type A = any;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function relogio(tz: string) {
  const now = new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map((x) => [x.type, x.value]));
  const y = +p.year, mo = +p.month, d = +p.day, H = +p.hour, M = +p.minute;
  const off = Date.UTC(y, mo - 1, d, H, M) - Math.floor(now.getTime() / 60000) * 60000;
  const ini = new Date(Date.UTC(y, mo - 1, d) - off), fim = new Date(ini.getTime() + 864e5);
  return { now, H, M, dia: `${p.year}-${p.month}-${p.day}`, ini, fim };
}
const chave = (d: Date) => d.toISOString().slice(0, 10);
function streak(h: Record<string, number>, dia: string) {
  const d = new Date(dia + "T12:00:00Z");
  if (!(h[chave(d)] > 0)) d.setUTCDate(d.getUTCDate() - 1);
  let s = 0, gap = 0;
  for (let i = 0; i < 500; i++) {
    if (h[chave(d)] > 0) { s++; gap = 0; } else { gap++; if (gap > 1) break; }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return s;
}
const pctLiv = (l: A) => (l.pct !== undefined && l.pct !== null && !isNaN(+l.pct))
  ? Math.max(0, Math.min(100, Math.round(+l.pct)))
  : (l.paginas ? Math.min(100, Math.round((+l.paginaAtual || 0) / l.paginas * 100)) : 0);
const TEMPOS = [5, 15, 60];
function candPassos(metas: A[]) {
  const out: { meta: string; passo: string; tempo: number }[] = [];
  for (const m of metas) {
    if (m.concluidaEm || !Array.isArray(m.marcos)) continue;
    for (const k of m.marcos) {
      const p = (k.passos || []).find((p: A) => !p.feito);
      if (p) { out.push({ meta: m.titulo, passo: p.titulo, tempo: TEMPOS.includes(+p.tempo) ? +p.tempo : 15 }); break; }
    }
  }
  return out;
}
const hm = (d: Date, tz: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d);
const durTxt = (min: number) => min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}` : `${min} min`;

async function jaFoi(user: string, tipo: string, dia: string) {
  const { data } = await admin.from("metas_avisos_enviados").select("tipo").eq("user_id", user).eq("dia", dia).eq("tipo", tipo).maybeSingle();
  return !!data;
}
async function quantosLivres(user: string, dia: string) {
  const { count } = await admin.from("metas_avisos_enviados").select("tipo", { count: "exact", head: true }).eq("user_id", user).eq("dia", dia).like("tipo", "livre%");
  return count || 0;
}

async function avisosDe(user: string, tz: string, forcar?: string) {
  const { data: docs } = await admin.from("metas_docs").select("colecao,id,dados").eq("user_id", user);
  const col = (c: string) => (docs || []).filter((d: A) => d.colecao === c).map((d: A) => d.dados);
  const geral = ((docs || []).find((d: A) => d.colecao === "estado" && d.id === "geral") || {}).dados || {};
  const agendaUrl = ((docs || []).find((d: A) => d.colecao === "config" && d.id === "agenda") || {}).dados?.ics;
  const r = relogio(tz);
  const out: { tipo: string; title: string; body: string; tag: string }[] = [];

  if (forcar === "teste") {
    out.push({ tipo: "teste-" + r.H + r.M, title: "Metas da Isa 🔔", body: "avisos funcionando! vou te cutucar só quando fizer sentido ✦", tag: "teste" });
    return { r, out };
  }

  // leitura
  const livros = col("livros");
  const lendo = livros.filter((l: A) => l.status === "lendo");
  if (lendo.length && r.H >= 21 && r.H < 23 && !(await jaFoi(user, "leitura", r.dia))) {
    const meta = Math.max(1, Math.min(50, +geral.metaLeitura || 3));
    const ganho = livros.reduce((a: number, l: A) => a + (l.diaRef === r.dia ? Math.max(0, pctLiv(l) - (+l.baseHoje || 0)) : 0), 0);
    if (ganho < meta) {
      const l = lendo[0];
      const falta = Math.round((meta - ganho) * 10) / 10;
      out.push({ tipo: "leitura", title: "📚 bora ler um pouquinho?", body: `faltam ${falta}% pra sua meta de hoje. ${l.titulo} tá em ${pctLiv(l)}%.`, tag: "leitura" });
    }
  }

  // sequência
  const hist = geral.historico || {};
  if (r.H >= 20 && r.H < 23 && !(hist[r.dia] > 0) && !(await jaFoi(user, "sequencia", r.dia))) {
    const s = streak(hist, r.dia);
    if (s >= 2) {
      const p = candPassos(col("metas")).sort((a, b) => a.tempo - b.tempo)[0];
      out.push({ tipo: "sequencia", title: `🔥 sua sequência de ${s} dias acaba hoje`, body: p ? `risca um passinho rapidinho: ${p.passo}` : "risca qualquer passinho pra manter ✦", tag: "sequencia" });
    }
  }

  // tempo livre depois de um compromisso
  if (agendaUrl && r.H >= 8 && r.H < 21 && (await quantosLivres(user, r.dia)) < 3) {
    const ics = await lerIcs(agendaUrl);
    if (ics.txt) {
      const evs = eventosEntre(ics.txt, r.ini, r.fim, r.dia)
        .filter((e) => e.start.dateTime && e.status !== "cancelled" && e.transparency !== "transparent")
        .map((e) => ({ t: e.summary, ini: new Date(e.start.dateTime!), fim: new Date(e.end.dateTime!) }));
      const agora = r.now.getTime();
      const ocupado = evs.some((e) => e.ini.getTime() <= agora && e.fim.getTime() > agora);
      const acabou = evs.filter((e) => e.fim.getTime() <= agora && e.fim.getTime() > agora - 20 * 6e4).sort((a, b) => b.fim.getTime() - a.fim.getTime())[0];
      if (acabou && !ocupado) {
        const prox = evs.filter((e) => e.ini.getTime() > agora).sort((a, b) => a.ini.getTime() - b.ini.getTime())[0];
        const limite = Math.min(prox ? prox.ini.getTime() : Infinity, r.ini.getTime() + 22 * 36e5);
        const min = Math.round((limite - agora) / 6e4);
        const tipo = "livre-" + hm(acabou.fim, tz).replace(":", "");
        if (min >= 15 && !(await jaFoi(user, tipo, r.dia))) {
          const fit = candPassos(col("metas")).filter((p) => p.tempo <= min).sort((a, b) => b.tempo - a.tempo);
          const p = fit[Math.floor(Math.random() * Math.min(3, fit.length))];
          const quanto = min >= 600 ? "um tempinho" : durTxt(min);
          out.push({
            tipo, tag: "livre",
            title: `🕒 você tem ${quanto} livre${prox ? ` até ${hm(prox.ini, tz)}` : ""}`,
            body: p ? `cabe esse passinho: ${p.passo}` : "que tal ler um pouquinho? 📚",
          });
        }
      }
    }
  }
  return { r, out };
}

Deno.serve(async (req) => {
  try {
    const { data: seg, error } = await admin.rpc("metas_segredos");
    if (error) return new Response("segredos: " + error.message, { status: 500 });
    const S = Object.fromEntries((seg || []).map((x: A) => [x.nome, x.valor]));
    if (req.headers.get("x-chave") !== S.metas_cron_chave) return new Response("não", { status: 401 });
    const corpo = await req.json().catch(() => ({}));
    webpush.setVapidDetails("https://oojnqitywbasfxuispiw.supabase.co", S.metas_vapid_pub, S.metas_vapid_priv);

    const { data: subs } = await admin.from("metas_push").select("*");
    const porUser = new Map<string, A[]>();
    for (const s of subs || []) porUser.set(s.user_id, [...(porUser.get(s.user_id) || []), s]);

    const log: A[] = [];
    for (const [user, lista] of porUser) {
      const { r, out } = await avisosDe(user, lista[0].fuso || "America/Sao_Paulo", corpo.forcar);
      for (const a of out) {
        let ok = 0;
        for (const s of lista) {
          try {
            await webpush.sendNotification(s.inscricao, JSON.stringify({ title: a.title, body: a.body, tag: a.tag, url: "./" }), { TTL: 3600, urgency: "normal" });
            ok++;
          } catch (e: A) {
            if (e && (e.statusCode === 404 || e.statusCode === 410)) await admin.from("metas_push").delete().eq("endpoint", s.endpoint);
            log.push({ erro: String(e && (e.body || e.message || e)) });
          }
        }
        if (ok) await admin.from("metas_avisos_enviados").upsert({ user_id: user, tipo: a.tipo, dia: r.dia });
        log.push({ tipo: a.tipo, enviados: ok });
      }
    }
    return new Response(JSON.stringify({ ok: true, log }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response("falha: " + String(e), { status: 500 });
  }
});
