-- =====================================================================
-- Lembretes gerados pelo servidor (funcionam com o app fechado) + envio por push.
-- Requer as extensões pg_cron e pg_net. Gera avisos com as MESMAS chaves que o app
-- usa (sem duplicar) e a função rdt-push os entrega no celular.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.rdt_generate_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0; c int;
  now_sp timestamp := now() at time zone 'America/Sao_Paulo';
  today_sp date := (now() at time zone 'America/Sao_Paulo')::date;
  r record; lead int; m int; at_ts timestamp;
begin
  -- missões de hoje (de quem é responsável; "nós dois"/"família" = todos os adultos)
  for r in
    select t.*, fu.user_id as uid
    from public.tasks t
    join public.family_users fu on fu.family_id = t.family_id
    left join public.members mb on mb.id::text = t.assignee
    where not t.deleted and t.status <> 'done' and t.due_date = today_sp
      and (t.assignee in ('both', 'family') or mb.user_id = fu.user_id)
  loop
    lead := coalesce(r.remind_min, (select (prefs->>'reminderLead')::int from public.user_prefs where user_id = r.uid), 30);
    if ((r.due_time is null and extract(hour from now_sp) >= 8)
       or (r.due_time is not null and now_sp >= (r.due_date + r.due_time::time) - make_interval(mins => lead)
           and now_sp < (r.due_date + r.due_time::time) + interval '1 hour'))
       and public.rdt_wants(r.uid, 'task_due') then
      insert into public.notifications(family_id, user_id, type, title, body, link, key, created_by)
      values (r.family_id, r.uid, 'task_due', case when r.due_time is null then 'Missão para hoje' else 'Missão chegando' end,
              r.title || coalesce(' · ' || r.due_time, ''), '/missoes?t=' || r.id, 'due:' || r.id || ':' || r.due_date, null)
      on conflict (user_id, key) do nothing;
      get diagnostics c = row_count; n := n + c;
    end if;
  end loop;

  -- compromissos (sem repetição) com lembretes: participantes ou família toda
  for r in
    select e.*, fu.user_id as uid
    from public.events e
    join public.family_users fu on fu.family_id = e.family_id
    left join public.members mb on mb.family_id = e.family_id and mb.user_id = fu.user_id
    where not e.deleted and (e.recurrence is null or e.recurrence->>'freq' = 'none')
      and e.date between today_sp and today_sp + 8
      and not (e.exdates ? e.date::text)
      and (jsonb_array_length(e.participants) = 0 or e.participants ? 'family' or e.participants ? mb.id::text)
  loop
    if not public.rdt_wants(r.uid, 'event_soon') then continue; end if;
    at_ts := r.date + (case when r.all_day or r.start_time is null then '09:00' else r.start_time end)::time;
    for m in select (jsonb_array_elements_text(r.reminders))::int loop
      -- janela: do horário do aviso até 2h depois (nunca depois do início)
      if now_sp >= at_ts - make_interval(mins => m) and now_sp < least(at_ts, at_ts - make_interval(mins => m) + interval '2 hours') then
        insert into public.notifications(family_id, user_id, type, title, body, link, key, created_by)
        values (r.family_id, r.uid, 'event_soon',
                case when m >= 1440 and r.date = today_sp + 1 then 'Amanhã tem checkpoint' when m >= 1440 then 'Checkpoint chegando' else 'Daqui a ' || m || ' min' end,
                r.title || case when r.all_day or r.start_time is null then '' else ' · ' || r.start_time end,
                '/checkpoints?d=' || r.date, 'ev:' || r.id || ':' || r.date || ':' || m, null)
        on conflict (user_id, key) do nothing;
        get diagnostics c = row_count; n := n + c;
      end if;
    end loop;
  end loop;

  -- consultas, vacinas e lembretes da filha (véspera às 18h e no dia às 7h)
  for r in
    select cr.*, fu.user_id as uid, d.dt
    from public.child_records cr
    join public.family_users fu on fu.family_id = cr.family_id
    cross join lateral (values (cr.date), ((cr.data->>'next_date')::date)) as d(dt)
    where not cr.deleted and cr.kind in ('consult', 'vaccine', 'reminder') and d.dt is not null
      and d.dt in (today_sp, today_sp + 1)
  loop
    if not public.rdt_wants(r.uid, 'health') then continue; end if;
    if r.dt = today_sp + 1 and extract(hour from now_sp) >= 18 then
      insert into public.notifications(family_id, user_id, type, title, body, link, key, created_by)
      values (r.family_id, r.uid, 'health', 'Amanhã', r.title || ' · ' || to_char(r.dt, 'DD/MM/YYYY'), '/mini-player?tab=cuidados', 'health:' || r.id || ':' || r.dt, null)
      on conflict (user_id, key) do nothing;
      get diagnostics c = row_count; n := n + c;
    elsif r.dt = today_sp and extract(hour from now_sp) >= 7 then
      insert into public.notifications(family_id, user_id, type, title, body, link, key, created_by)
      values (r.family_id, r.uid, 'health', 'Hoje', r.title, '/mini-player?tab=cuidados', 'health:' || r.id || ':' || r.dt || ':hoje', null)
      on conflict (user_id, key) do nothing;
      get diagnostics c = row_count; n := n + c;
    end if;
  end loop;

  -- cápsulas que abriram
  for r in
    select msg.*, fu.user_id as uid
    from public.messages msg
    join public.family_users fu on fu.family_id = msg.family_id
    where not msg.deleted and msg.open_at is not null and msg.open_at <= today_sp and msg.read_at is null
      and fu.user_id is distinct from public.rdt_member_user(msg.sender_id::text)
      and (msg.recipient_id = 'family' or public.rdt_member_user(msg.recipient_id) is null or public.rdt_member_user(msg.recipient_id) = fu.user_id)
      and (not msg.private or public.rdt_member_user(msg.recipient_id) = fu.user_id)
  loop
    if public.rdt_wants(r.uid, 'capsule') then
      insert into public.notifications(family_id, user_id, type, title, body, link, key, created_by)
      values (r.family_id, r.uid, 'capsule', 'Uma cápsula do tempo abriu!', r.title, '/correio?m=' || r.id, 'cap:' || r.id, null)
      on conflict (user_id, key) do nothing;
      get diagnostics c = row_count; n := n + c;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.rdt_generate_reminders() from public, anon, authenticated;

-- Padrão dos compromissos: avisar 1 dia antes e 15 minutos antes
alter table public.events alter column reminders set default '[1440, 15]'::jsonb;
update public.events set reminders = (select jsonb_agg(distinct v) from jsonb_array_elements(reminders || '[1440, 15]'::jsonb) v), updated_at = now() where not deleted;

-- Agendamentos: lembretes a cada 5 min; entrega por push a cada minuto (o segredo é lido da tabela protegida)
select cron.schedule('rdt-lembretes', '*/5 * * * *', $$ select public.rdt_generate_reminders(); $$);
select cron.schedule('rdt-push', '* * * * *', $$
  select net.http_post(
    url := 'https://rebjgvhmqaaiyzrhoxfa.supabase.co/functions/v1/rdt-push',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select cron_secret from public.rdt_push_config where id = 1), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
$$);
