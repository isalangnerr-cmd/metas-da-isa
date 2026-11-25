// Edge Function: entrega como push os avisos ainda não enviados (tabela notifications).
// Chamada a cada minuto pelo pg_cron (pg_net). As chaves VAPID e o segredo do agendador
// ficam na tabela protegida public.rdt_push_config (só o service_role lê).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
let cfg: { vapid_public: string; vapid_private: string; subject: string; cron_secret: string } | null = null;

Deno.serve(async (req) => {
  if (!cfg) {
    const { data, error } = await admin.from("rdt_push_config").select("vapid_public, vapid_private, subject, cron_secret").eq("id", 1).single();
    if (error || !data) return Response.json({ error: "no_config" }, { status: 500 });
    cfg = data;
    webpush.setVapidDetails(cfg.subject, cfg.vapid_public, cfg.vapid_private);
  }
  if (req.headers.get("authorization") !== `Bearer ${cfg.cron_secret}`) return new Response("forbidden", { status: 403 });

  const since = new Date(Date.now() - 6 * 3600e3).toISOString();
  const { data: notifs, error } = await admin.from("notifications").select("id, user_id, title, body, link, type")
    .is("pushed_at", null).is("read_at", null).eq("deleted", false).gt("created_at", since).not("user_id", "is", null).limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0, failed = 0;
  const prefsCache = new Map<string, { push?: boolean; notify?: Record<string, boolean> } | null>();
  for (const n of notifs || []) {
    if (!prefsCache.has(n.user_id)) {
      const { data } = await admin.from("user_prefs").select("prefs").eq("user_id", n.user_id).maybeSingle();
      prefsCache.set(n.user_id, data?.prefs ?? null);
    }
    const prefs = prefsCache.get(n.user_id);
    const wants = prefs?.notify?.[n.type] !== false;
    if (wants) {
      const { data: subs } = await admin.from("push_subscriptions").select("endpoint, keys").eq("user_id", n.user_id);
      for (const s of subs || []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title: n.title, body: n.body || "", url: n.link || "/", tag: n.id }), { TTL: 3600 });
          sent++;
        } catch (e) {
          failed++;
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
    await admin.from("notifications").update({ pushed_at: new Date().toISOString() }).eq("id", n.id);
  }
  return Response.json({ checked: notifs?.length || 0, sent, failed });
});
