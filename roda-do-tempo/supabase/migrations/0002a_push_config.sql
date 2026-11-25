-- Configuração de push (chaves VAPID e segredo do agendador). Só o servidor (service_role) lê.
-- Os VALORES não ficam no repositório: são inseridos direto no banco (veja docs/PUSH.md).
create table if not exists public.rdt_push_config (
  id int primary key default 1 check (id = 1),
  vapid_public text not null, vapid_private text not null, subject text not null, cron_secret text not null,
  updated_at timestamptz not null default now()
);
alter table public.rdt_push_config enable row level security;
revoke all on public.rdt_push_config from anon, authenticated, public;
grant select on public.rdt_push_config to service_role;
grant select, update on public.notifications to service_role;
grant select, delete on public.push_subscriptions to service_role;
grant select on public.user_prefs to service_role;
