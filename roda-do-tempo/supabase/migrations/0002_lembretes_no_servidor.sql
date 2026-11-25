-- =====================================================================
-- OPCIONAL: lembretes gerados pelo servidor (funcionam com o app fechado)
-- Requer a extensão pg_cron (Supabase > Database > Extensions > pg_cron).
-- Gera avisos de missões do dia e de cápsulas liberadas. A entrega como
-- push no celular é feita pela Edge Function rdt-push (veja docs/PUSH.md).
-- As chaves dos avisos são as mesmas do app, então não há duplicidade.
-- =====================================================================
create or replace function public.rdt_generate_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  now_sp timestamp := now() at time zone 'America/Sao_Paulo';
  today_sp date := (now() at time zone 'America/Sao_Paulo')::date;
  r record;
  lead int;
begin
  -- missões de hoje (de quem é responsável; "nós dois"/"família" = todos os adultos)
  for r in
    select t.*, fu.user_id as uid
    from public.tasks t
    join public.family_users fu on fu.family_id = t.family_id
    left join public.members m on m.id::text = t.assignee
    where not t.deleted and t.status <> 'done' and t.due_date = today_sp
      and (t.assignee in ('both', 'family') or m.user_id = fu.user_id)
  loop
    lead := coalesce(r.remind_min, coalesce((select (prefs->>'reminderLead')::int from public.user_prefs where user_id = r.uid), 30));
    if (r.due_time is null and extract(hour from now_sp) >= 8)
       or (r.due_time is not null and now_sp >= (r.due_date + r.due_time::time) - make_interval(mins => lead)
           and now_sp < (r.due_date + r.due_time::time) + interval '1 hour') then
      if public.rdt_wants(r.uid, 'task_due') then
        insert into public.notifications(family_id, user_id, type, title, body, link, key, created_by)
        values (r.family_id, r.uid, 'task_due', case when r.due_time is null then 'Missão para hoje' else 'Missão chegando' end,
                r.title || coalesce(' · ' || r.due_time, ''), '/missoes?t=' || r.id, 'due:' || r.id || ':' || r.due_date, null)
        on conflict (user_id, key) do nothing;
        get diagnostics lead = row_count; n := n + lead;
      end if;
    end if;
  end loop;

  -- cápsulas que abriram
  for r in
    select msg.*, fu.user_id as uid
    from public.messages msg
    join public.family_users fu on fu.family_id = msg.family_id
    where not msg.deleted and msg.open_at is not null and msg.open_at <= today_sp and msg.read_at is null
      and (msg.recipient_id = 'family' or public.rdt_member_user(msg.recipient_id) is null or public.rdt_member_user(msg.recipient_id) = fu.user_id)
      and (not msg.private or public.rdt_member_user(msg.recipient_id) = fu.user_id)
  loop
    if public.rdt_wants(r.uid, 'capsule') then
      insert into public.notifications(family_id, user_id, type, title, body, link, key, created_by)
      values (r.family_id, r.uid, 'capsule', 'Uma cápsula do tempo abriu!', r.title, '/correio?m=' || r.id, 'cap:' || r.id, null)
      on conflict (user_id, key) do nothing;
      get diagnostics lead = row_count; n := n + lead;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.rdt_generate_reminders() from anon, authenticated;

-- A cada 5 minutos
select cron.schedule('rdt-lembretes', '*/5 * * * *', $$ select public.rdt_generate_reminders(); $$);
