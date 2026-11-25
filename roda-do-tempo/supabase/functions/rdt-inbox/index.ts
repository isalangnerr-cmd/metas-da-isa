// Edge Function: Caixa de entrada inteligente.
// Recebe texto e arquivos já enviados ao Storage privado da família, confere que quem chama
// pertence à família (com o login da própria pessoa, sob as regras RLS) e pede ao Claude
// uma proposta estruturada. Nada é gravado aqui: o app mostra a proposta e a família confirma.
// Segredo necessário: ANTHROPIC_API_KEY (Supabase > Edge Functions > Secrets).
import Anthropic from "npm:@anthropic-ai/sdk@1.14.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { organize, type InboxContext, type InboxFile } from "./organize.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const MAX_FILES = 5, MAX_BYTES = 10 * 1024 * 1024, MAX_TEXT = 20000;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

function b64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf); let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "no_key" }, 503);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "auth" }, 401);

    const body = await req.json();
    const familyId = String(body.family_id || "");
    const text = String(body.text || "").slice(0, MAX_TEXT);
    const paths: { path: string; media_type: string; name: string }[] = Array.isArray(body.files) ? body.files.slice(0, MAX_FILES) : [];
    if (!text.trim() && !paths.length) return json({ error: "empty" }, 400);

    // pertence à família? (RLS: só retorna se a pessoa for membro)
    const { data: fam } = await sb.from("families").select("id").eq("id", familyId).maybeSingle();
    if (!fam) return json({ error: "forbidden" }, 403);

    const files: InboxFile[] = [];
    for (const f of paths) {
      if (!String(f.path).startsWith(familyId + "/") || !ALLOWED.includes(f.media_type)) return json({ error: "file_type" }, 400);
      const { data, error } = await sb.storage.from("family-media").download(f.path);
      if (error || !data) return json({ error: "file_read" }, 400);
      if (data.size > MAX_BYTES) return json({ error: "file_size" }, 400);
      files.push({ media_type: f.media_type, name: String(f.name || "arquivo").slice(0, 80), data: b64(await data.arrayBuffer()) });
    }

    const [{ data: members }, { data: lists }] = await Promise.all([
      sb.from("members").select("id, name, nickname, kind, user_id").eq("family_id", familyId).eq("deleted", false),
      sb.from("lists").select("id, name").eq("family_id", familyId).eq("deleted", false).eq("archived", false),
    ]);
    const now = new Date();
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((x) => [x.type, x.value]));
    const ctx: InboxContext = {
      today: `${p.year}-${p.month}-${p.day}`, now: `${p.hour}:${p.minute}`,
      weekday: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(now),
      members: (members || []).map((m) => ({ id: m.id, name: m.name, nickname: m.nickname, kind: m.kind, me: m.user_id === user.id })),
      lists: lists || [],
    };

    const out = await organize(new Anthropic({ apiKey: key }), ctx, text, files);
    if ("error" in out) return json({ error: out.error }, 422);
    return json(out);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "bad_key" }, 503);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate_limit" }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: "ai", status: e.status }, 502);
    return json({ error: "failed", detail: String(e) }, 500);
  }
});
