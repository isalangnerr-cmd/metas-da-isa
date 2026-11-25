// Edge Function: entrega como push os avisos ainda não enviados (tabela notifications).
// Agende com pg_cron + pg_net (veja docs/PUSH.md). Protegida por CRON_SECRET.
// Segredos necessários: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), CRON_SECRET.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`) return new Response('forbidden', { status: 403 });
  const since = new Date(Date.now() - 6 * 3600e3).toISOString();
  const { data: notifs, error } = await admin.from('notifications').select('id, user_id, title, body, link, type')
    .is('pushed_at', null).is('read_at', null).eq('deleted', false).gt('created_at', since).not('user_id', 'is', null).limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let sent = 0;
  for (const n of notifs || []) {
    const { data: prefs } = await admin.from('user_prefs').select('prefs').eq('user_id', n.user_id).maybeSingle();
    const wants = prefs?.prefs?.push !== false && prefs?.prefs?.notify?.[n.type] !== false;
    if (wants) {
      const { data: subs } = await admin.from('push_subscriptions').select('endpoint, keys').eq('user_id', n.user_id);
      for (const s of subs || []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title: n.title, body: n.body || '', url: n.link || '/', tag: n.id }));
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }
    }
    await admin.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', n.id);
  }
  return Response.json({ checked: notifs?.length || 0, sent });
});
