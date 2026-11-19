// Devolve os compromissos do dia, lidos do endereço iCal que a pessoa salvou no app.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { eventosEntre, lerIcs } from "./ics.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { ini, fim, dia } = await req.json();
    const { data, error } = await sb.from("metas_docs").select("dados").eq("colecao", "config").eq("id", "agenda").maybeSingle();
    if (error) return j({ erro: true, codigo: "db" });
    const url = data?.dados?.ics;
    if (!url) return j({ semUrl: true });
    const r = await lerIcs(url);
    if (!r.txt) return j({ erro: true, codigo: r.codigo });
    return j({ events: eventosEntre(r.txt, new Date(ini), new Date(fim), String(dia)) });
  } catch (e) {
    return j({ erro: true, codigo: "falha", detalhe: String(e) });
  }
});
