// Dados do widget do iPhone (Scriptable). Chamada com ?k=<chave secreta> (tabela metas_widget).
// Só lê: devolve a sequência de leitura, a meta de leitura de hoje e a rotina do dia
// (hábitos + tarefas no foco ou com data até hoje), do mesmo jeito que a tela "hoje" do app.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// deno-lint-ignore no-explicit-any
type A = any;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TZ = "America/Sao_Paulo";

const diaEm = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const menos = (dia: string, n: number) => { const d = new Date(dia + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const pctLiv = (l: A) => (l.pct !== undefined && l.pct !== null && !isNaN(+l.pct))
  ? Math.max(0, Math.min(100, Math.round(+l.pct)))
  : (l.paginas ? Math.min(100, Math.round((+l.paginaAtual || 0) / l.paginas * 100)) : 0);

function leitStreak(dias: Record<string, boolean>, hoje: string) {
  let d = dias[hoje] ? hoje : menos(hoje, 1), n = 0;
  while (dias[d] && n < 2000) { n++; d = menos(d, 1); }
  return n;
}

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

Deno.serve(async (req) => {
  try {
    const k = new URL(req.url).searchParams.get("k") || "";
    if (k.length < 20) return json({ erro: "chave" }, 401);
    const { data: w } = await admin.from("metas_widget").select("user_id").eq("chave", k).maybeSingle();
    if (!w) return json({ erro: "chave" }, 401);

    const { data: docs, error } = await admin.from("metas_docs").select("colecao,id,dados").eq("user_id", w.user_id)
      .in("colecao", ["estado", "livros", "habitos", "tarefas"]);
    if (error) return json({ erro: error.message }, 500);
    const col = (c: string) => (docs || []).filter((d: A) => d.colecao === c).map((d: A) => d.dados).filter(Boolean);
    const geral = ((docs || []).find((d: A) => d.colecao === "estado" && d.id === "geral") || {}).dados || {};
    const hoje = diaEm(new Date());

    const dias = geral.leituraDias || {};
    const livros = col("livros");
    const metaLeitura = Math.max(1, Math.min(50, +geral.metaLeitura || 3));
    const feitoLeitura = livros.reduce((a: number, l: A) => a + (l.diaRef === hoje ? Math.max(0, pctLiv(l) - (+l.baseHoje || 0)) : 0), 0);
    const lendo = livros.filter((l: A) => l.status === "lendo" && l.titulo).map((l: A) => ({ titulo: l.titulo, pct: pctLiv(l) }));

    const habitos = col("habitos").filter((h: A) => h.titulo && !h.arquivado)
      .sort((a: A, b: A) => String(a.criadoEm || "").localeCompare(String(b.criadoEm || "")))
      .map((h: A) => ({ titulo: h.titulo, feito: !!(h.dias || {})[hoje] }));
    const far = "9999";
    const tarefas = col("tarefas").filter((t: A) => t.titulo && !t.feita && (t.foco || (t.data && t.data <= hoje)))
      .sort((a: A, b: A) => (+!!b.foco - +!!a.foco) || String(a.data || far).localeCompare(String(b.data || far)) || String(a.criadoEm || "").localeCompare(String(b.criadoEm || "")))
      .slice(0, 6).map((t: A) => ({ titulo: t.titulo, foco: !!t.foco, atrasada: !!(t.data && t.data < hoje) }));

    return json({
      hoje,
      leitura: { sequencia: leitStreak(dias, hoje), leuHoje: !!dias[hoje], meta: metaLeitura, feito: Math.round(feitoLeitura * 10) / 10, lendo },
      habitos, tarefas,
    });
  } catch (e) {
    return json({ erro: String(e) }, 500);
  }
});
