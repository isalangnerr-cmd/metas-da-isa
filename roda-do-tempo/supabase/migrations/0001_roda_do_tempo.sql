-- =====================================================================
-- Roda do Tempo: esquema, segurança (RLS), gatilhos e funções
-- Rode no SQL Editor do Supabase (ou `supabase db push`).
-- Todas as tabelas de conteúdo são isoladas por família (family_id) e
-- só podem ser lidas/escritas por adultos que pertencem a ela.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Núcleo: famílias e acesso ----------
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  settings jsonb not null default '{"gamification": true}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Quem (conta) tem acesso a qual família. É a fonte de verdade das permissões.
create table if not exists public.family_users (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'adult' check (role in ('owner', 'adult')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index if not exists family_users_user on public.family_users(user_id);

create or replace function public.rdt_is_member(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.family_users where family_id = fid and user_id = auth.uid());
$$;

-- Versão segura para caminhos do Storage ("<family_id>/arquivo.jpg")
create or replace function public.rdt_is_member_text(fid text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return public.rdt_is_member(fid::uuid);
exception when others then
  return false;
end $$;

-- ---------- Colunas comuns + gatilho "a versão mais recente vence" ----------
create or replace function public.rdt_touch() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    -- Edição offline antiga chegando depois de uma mais nova: ignora (sem erro).
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.family_id := old.family_id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  if new.updated_at is null or new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  return new;
end $$;

-- Cria uma tabela de conteúdo com as colunas comuns, RLS, gatilho e realtime.
create or replace function public.rdt_setup_table(t text) returns void
language plpgsql as $$
begin
  execute format('alter table public.%I enable row level security', t);
  execute format('drop policy if exists "%s_select" on public.%I', t, t);
  execute format('drop policy if exists "%s_insert" on public.%I', t, t);
  execute format('drop policy if exists "%s_update" on public.%I', t, t);
  execute format('drop policy if exists "%s_delete" on public.%I', t, t);
  execute format('create policy "%s_select" on public.%I for select to authenticated using (public.rdt_is_member(family_id))', t, t);
  execute format('create policy "%s_insert" on public.%I for insert to authenticated with check (public.rdt_is_member(family_id))', t, t);
  execute format('create policy "%s_update" on public.%I for update to authenticated using (public.rdt_is_member(family_id)) with check (public.rdt_is_member(family_id))', t, t);
  execute format('create policy "%s_delete" on public.%I for delete to authenticated using (public.rdt_is_member(family_id))', t, t);
  execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
  execute format('create trigger %I before insert or update on public.%I for each row execute function public.rdt_touch()', t || '_touch', t);
  execute format('create index if not exists %I on public.%I (family_id, updated_at)', t || '_fam_upd', t);
end $$;

-- ---------- Perfis da família (adultos, filha, pet) ----------
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('adult', 'child', 'pet')),
  name text not null check (char_length(name) between 1 and 60),
  nickname text check (char_length(nickname) <= 40),
  color text not null default '#C2643C' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar jsonb not null default '{}'::jsonb,
  birth_date date,
  photo_path text,
  info jsonb not null default '[]'::jsonb,
  position int not null default 0,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create unique index if not exists members_user_family on public.members(family_id, user_id) where user_id is not null and not deleted;

-- Uma conta só pode se vincular a um perfil por convite (ou ao criar a família).
create or replace function public.rdt_members_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is not null and new.user_id is distinct from auth.uid() then new.user_id := null; end if;
  elsif new.user_id is distinct from old.user_id then
    if not (old.user_id is null and new.user_id = auth.uid()) and not (old.user_id = auth.uid() and new.user_id is null) then
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists members_guard on public.members;
create trigger members_guard before insert or update on public.members for each row execute function public.rdt_members_guard();

-- ---------- Missões ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 5000),
  assignee text not null default 'family',
  category text not null default 'outros',
  start_date date, due_date date, due_time text check (due_time is null or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  recurrence jsonb,
  subtasks jsonb not null default '[]'::jsonb,
  notes text check (char_length(notes) <= 10000),
  attachments jsonb not null default '[]'::jsonb,
  stars int not null default 1 check (stars between 0 and 10),
  adventure_id uuid, wish_id uuid,
  completed_at timestamptz, completed_by text, remind_min int,
  example boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  task_id uuid not null, title text not null, member_id text, date date not null, stars int not null default 0,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ---------- Inventário ----------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  icon text not null default 'bag', color text not null default '#5E7B3A',
  description text, category text not null default 'compras', owners jsonb not null default '[]'::jsonb,
  adventure_id uuid, archived boolean not null default false, position int not null default 0,
  example boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  qty numeric check (qty is null or qty >= 0), unit text, notes text,
  price numeric(12,2) check (price is null or price >= 0), link text, image_path text,
  done boolean not null default false, done_at timestamptz, position double precision not null default 0,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ---------- Checkpoints (calendário). Datas/horas no fuso America/Sao_Paulo ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  date date not null, end_date date,
  start_time text check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text check (end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  all_day boolean not null default false, location text, description text,
  participants jsonb not null default '[]'::jsonb, category text not null default 'familia', color text,
  recurrence jsonb, reminders jsonb not null default '[]'::jsonb, exdates jsonb not null default '[]'::jsonb,
  adventure_id uuid, example boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ---------- Mini player ----------
create table if not exists public.child_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null check (kind in ('moment','consult','vaccine','growth','food','sleep','school','medicine','reminder')),
  date date not null, time text, title text not null check (char_length(title) between 1 and 200),
  description text, category text, data jsonb not null default '{}'::jsonb, media_path text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200), date date not null,
  body text not null default '' check (char_length(body) <= 20000), tags jsonb not null default '[]'::jsonb,
  media_path text, author_id text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ---------- Estrelas e Aventuras ----------
create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200), description text,
  category text not null default 'experiencia', owner text not null default 'family', image_path text, link text,
  value numeric(12,2) check (value is null or value >= 0),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  deadline date, progress int not null default 0 check (progress between 0 and 100),
  status text not null default 'dreaming' check (status in ('dreaming','planning','progress','done','archived')),
  achieved_at date, adventure_id uuid,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create table if not exists public.adventures (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120), cover text not null default 'mountain', cover_path text,
  description text, participants jsonb not null default '[]'::jsonb, start_date date, end_date date,
  status text not null default 'future' check (status in ('future','active','done')),
  budget numeric(12,2) check (budget is null or budget >= 0), notes text, links jsonb not null default '[]'::jsonb,
  completed_at timestamptz, example boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ---------- Correio ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  sender_id uuid not null references public.members(id) on delete cascade,
  recipient_id text not null, -- id de membro ou 'family'
  title text not null check (char_length(title) between 1 and 160),
  kind text not null default 'note' check (kind in ('note','thanks','surprise','future','capsule')),
  open_at date, read_at timestamptz, private boolean not null default false, stamp int not null default 0,
  attachments jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
-- O conteúdo fica separado: o banco só entrega depois da data de abertura.
create table if not exists public.message_bodies (
  message_id uuid primary key references public.messages(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  body text not null check (char_length(body) <= 20000),
  updated_at timestamptz not null default now()
);

-- ---------- Notificações, conquistas, estrelas ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null, title text not null, body text, link text, read_at timestamptz, key text, pushed_at timestamptz,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  key text not null, unlocked_at timestamptz not null default now(),
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create table if not exists public.star_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id text, amount int not null check (amount between -100 and 100),
  source text not null check (source in ('task','wish','adventure','bonus')), ref_id uuid, note text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ---------- Preferências, convites e push ----------
create table if not exists public.user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  code text not null unique default encode(gen_random_bytes(12), 'hex'),
  email text, member_id uuid references public.members(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references auth.users(id), used_at timestamptz,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  keys jsonb not null, created_at timestamptz not null default now()
);

-- ---------- RLS ----------
select public.rdt_setup_table(t) from unnest(array['members','tasks','task_completions','lists','list_items','events',
  'child_records','memories','wishes','adventures','achievements','star_transactions']) as t;
create unique index if not exists achievements_key on public.achievements(family_id, key);

-- families
alter table public.families enable row level security;
drop policy if exists families_select on public.families;
drop policy if exists families_update on public.families;
create policy families_select on public.families for select to authenticated using (public.rdt_is_member(id));
create policy families_update on public.families for update to authenticated using (public.rdt_is_member(id)) with check (public.rdt_is_member(id));
-- (criação e exclusão só pelas funções abaixo)

alter table public.family_users enable row level security;
drop policy if exists family_users_select on public.family_users;
create policy family_users_select on public.family_users for select to authenticated using (public.rdt_is_member(family_id));

alter table public.invites enable row level security;
drop policy if exists invites_all on public.invites;
create policy invites_all on public.invites for all to authenticated using (public.rdt_is_member(family_id)) with check (public.rdt_is_member(family_id));

alter table public.user_prefs enable row level security;
drop policy if exists prefs_own on public.user_prefs;
create policy prefs_own on public.user_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Qual conta é dona de um perfil
create or replace function public.rdt_member_user(mid text) returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from public.members where id::text = mid;
$$;

-- messages: cartas privadas só para remetente e destinatário
alter table public.messages enable row level security;
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_update on public.messages;
drop policy if exists messages_delete on public.messages;
create policy messages_select on public.messages for select to authenticated using (
  public.rdt_is_member(family_id) and (not private
    or public.rdt_member_user(sender_id::text) = auth.uid()
    or public.rdt_member_user(recipient_id) = auth.uid()));
create policy messages_insert on public.messages for insert to authenticated with check (
  public.rdt_is_member(family_id) and public.rdt_member_user(sender_id::text) = auth.uid());
create policy messages_update on public.messages for update to authenticated using (
  public.rdt_is_member(family_id) and (public.rdt_member_user(sender_id::text) = auth.uid()
    or public.rdt_member_user(recipient_id) = auth.uid() or not private))
  with check (public.rdt_is_member(family_id));
create policy messages_delete on public.messages for delete to authenticated using (public.rdt_member_user(sender_id::text) = auth.uid());
drop trigger if exists messages_touch on public.messages;
create trigger messages_touch before insert or update on public.messages for each row execute function public.rdt_touch();
create index if not exists messages_fam_upd on public.messages(family_id, updated_at);

-- Quem não é o remetente só pode marcar como lida (não pode mudar a data de abertura etc.)
create or replace function public.rdt_messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.rdt_member_user(old.sender_id::text) is distinct from auth.uid() then
    if new.title is distinct from old.title or new.open_at is distinct from old.open_at or new.recipient_id is distinct from old.recipient_id
       or new.private is distinct from old.private or new.sender_id is distinct from old.sender_id or new.deleted is distinct from old.deleted then
      raise exception 'Somente quem enviou pode alterar esta carta';
    end if;
    -- não dá para "ler" uma cápsula antes da hora
    if new.read_at is not null and old.read_at is null and old.open_at is not null
       and old.open_at > (now() at time zone 'America/Sao_Paulo')::date then
      new.read_at := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before update on public.messages for each row execute function public.rdt_messages_guard();

-- Conteúdo da carta: liberado para o remetente sempre; para os demais só a partir da data de abertura.
create or replace function public.rdt_can_read_body(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.messages m
    where m.id = mid and not m.deleted and public.rdt_is_member(m.family_id) and (
      public.rdt_member_user(m.sender_id::text) = auth.uid()
      or ((m.open_at is null or m.open_at <= (now() at time zone 'America/Sao_Paulo')::date)
          and (not m.private or public.rdt_member_user(m.recipient_id) = auth.uid()))));
$$;
alter table public.message_bodies enable row level security;
drop policy if exists bodies_select on public.message_bodies;
drop policy if exists bodies_write on public.message_bodies;
drop policy if exists bodies_update on public.message_bodies;
create policy bodies_select on public.message_bodies for select to authenticated using (public.rdt_can_read_body(message_id));
create policy bodies_write on public.message_bodies for insert to authenticated with check (
  exists (select 1 from public.messages m where m.id = message_id and m.family_id = message_bodies.family_id
          and public.rdt_member_user(m.sender_id::text) = auth.uid()));
create policy bodies_update on public.message_bodies for update to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.rdt_member_user(m.sender_id::text) = auth.uid()))
  with check (exists (select 1 from public.messages m where m.id = message_id and public.rdt_member_user(m.sender_id::text) = auth.uid()));

-- notifications: cada pessoa vê as suas
alter table public.notifications enable row level security;
drop policy if exists notif_select on public.notifications;
drop policy if exists notif_insert on public.notifications;
drop policy if exists notif_update on public.notifications;
create policy notif_select on public.notifications for select to authenticated using (public.rdt_is_member(family_id) and (user_id = auth.uid() or user_id is null));
create policy notif_insert on public.notifications for insert to authenticated with check (public.rdt_is_member(family_id) and user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists notifications_touch on public.notifications;
create trigger notifications_touch before insert or update on public.notifications for each row execute function public.rdt_touch();
create index if not exists notifications_fam_upd on public.notifications(family_id, updated_at);
-- chave única por pessoa (evita aviso duplicado entre aparelhos e servidor; key nula não conflita)
create unique index if not exists notifications_key on public.notifications(user_id, key);

-- ---------- Funções da família ----------
create or replace function public.create_family(p_name text, p_member_name text, p_color text default '#C2643C', p_avatar jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'É preciso entrar na conta'; end if;
  if char_length(coalesce(p_name, '')) not between 1 and 80 then raise exception 'Nome da família inválido'; end if;
  insert into public.families(name, created_by) values (p_name, auth.uid()) returning id into fid;
  insert into public.family_users(family_id, user_id, role) values (fid, auth.uid(), 'owner');
  insert into public.members(family_id, user_id, kind, name, color, avatar, position)
    values (fid, auth.uid(), 'adult', coalesce(nullif(p_member_name, ''), 'Eu'), p_color, p_avatar, 0);
  return fid;
end $$;

create or replace function public.invite_info(p_code text)
returns table(family_name text, member_name text, expired boolean, used boolean)
language sql stable security definer set search_path = public as $$
  select f.name, m.name, i.expires_at < now(), i.used_at is not null
  from public.invites i join public.families f on f.id = i.family_id left join public.members m on m.id = i.member_id
  where i.code = p_code;
$$;

create or replace function public.accept_invite(p_code text, p_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invites; mid uuid;
begin
  if auth.uid() is null then raise exception 'É preciso entrar na conta'; end if;
  select * into inv from public.invites where code = p_code for update;
  if not found then raise exception 'Convite não encontrado'; end if;
  if inv.used_at is not null then raise exception 'Este convite já foi usado'; end if;
  if inv.expires_at < now() then raise exception 'Este convite expirou'; end if;
  insert into public.family_users(family_id, user_id, role) values (inv.family_id, auth.uid(), 'adult') on conflict do nothing;
  if inv.member_id is not null then
    update public.members set user_id = auth.uid(), updated_at = now() where id = inv.member_id and user_id is null returning id into mid;
  end if;
  if mid is null then
    insert into public.members(family_id, user_id, kind, name, color, position)
      values (inv.family_id, auth.uid(), 'adult', coalesce(nullif(p_name, ''), 'Novo membro'), '#5E7B3A', 1) returning id into mid;
  end if;
  update public.invites set used_by = auth.uid(), used_at = now() where id = inv.id;
  return inv.family_id;
end $$;

create or replace function public.leave_family(p_family uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.members set user_id = null, updated_at = now() where family_id = p_family and user_id = auth.uid();
  delete from public.family_users where family_id = p_family and user_id = auth.uid();
end $$;

-- Exclui a família inteira e todos os dados (irreversível). Só quem pertence a ela.
create or replace function public.delete_family(p_family uuid, p_confirm text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.rdt_is_member(p_family) then raise exception 'Sem permissão'; end if;
  if p_confirm is distinct from (select name from public.families where id = p_family) then raise exception 'Confirmação incorreta'; end if;
  -- os arquivos do Storage são apagados pelo app (API do Storage) antes de chamar esta função
  delete from public.families where id = p_family;
end $$;

revoke all on function public.create_family(text, text, text, jsonb) from anon;
revoke all on function public.accept_invite(text, text) from anon;
revoke all on function public.delete_family(uuid, text) from anon;

-- ---------- Notificações automáticas (gatilhos no servidor) ----------
create or replace function public.rdt_wants(uid uuid, t text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (prefs->'notify'->>t)::boolean from public.user_prefs where user_id = uid), true);
$$;

create or replace function public.rdt_notify(fid uuid, uid uuid, t text, ttl text, bdy text, lnk text, k text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if uid is null or uid = auth.uid() or not public.rdt_wants(uid, t) then return; end if;
  insert into public.notifications(family_id, user_id, type, title, body, link, key, created_by)
  values (fid, uid, t, ttl, bdy, lnk, k, auth.uid()) on conflict (user_id, key) do nothing;
end $$;

-- Outros adultos da família (exceto quem fez a ação)
create or replace function public.rdt_other_adults(fid uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select user_id from public.family_users where family_id = fid and user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
$$;

create or replace function public.rdt_tasks_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if new.deleted or new.status = 'done' then return new; end if;
  if tg_op = 'INSERT' or new.assignee is distinct from old.assignee then
    if new.assignee in ('both', 'family') then
      for u in select public.rdt_other_adults(new.family_id) loop
        perform public.rdt_notify(new.family_id, u, 'task_assigned', 'Nova missão para o time', new.title, '/missoes?t=' || new.id);
      end loop;
    else
      perform public.rdt_notify(new.family_id, public.rdt_member_user(new.assignee), 'task_assigned', 'Missão atribuída a você', new.title, '/missoes?t=' || new.id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists tasks_notify on public.tasks;
create trigger tasks_notify after insert or update of assignee on public.tasks for each row execute function public.rdt_tasks_notify();

create or replace function public.rdt_messages_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid; locked boolean := new.open_at is not null and new.open_at > (now() at time zone 'America/Sao_Paulo')::date;
begin
  if new.recipient_id = 'family' or public.rdt_member_user(new.recipient_id) is null then
    if new.private then return new; end if;
    for u in select public.rdt_other_adults(new.family_id) loop
      perform public.rdt_notify(new.family_id, u, 'message', case when locked then 'Uma cápsula do tempo foi guardada' else 'Chegou uma carta no correio' end,
        new.title, '/correio?m=' || new.id, 'msg:' || new.id);
    end loop;
  else
    perform public.rdt_notify(new.family_id, public.rdt_member_user(new.recipient_id), 'message',
      case when locked then 'Uma carta está esperando a data certa' else 'Chegou uma carta para você' end,
      case when locked then 'Abre em ' || to_char(new.open_at, 'DD/MM/YYYY') else new.title end, '/correio?m=' || new.id, 'msg:' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages for each row execute function public.rdt_messages_notify();

create or replace function public.rdt_list_items_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid; lname text; bucket text := to_char(now(), 'YYYYMMDDHH24');
begin
  select name into lname from public.lists where id = new.list_id;
  for u in select public.rdt_other_adults(new.family_id) loop
    -- no máximo um aviso por lista por hora
    perform public.rdt_notify(new.family_id, u, 'list_changed', 'Inventário atualizado', coalesce(lname, 'Lista') || ': ' || new.name,
      '/inventario/' || new.list_id, 'list:' || new.list_id || ':' || bucket);
  end loop;
  return new;
end $$;
drop trigger if exists list_items_notify on public.list_items;
create trigger list_items_notify after insert on public.list_items for each row execute function public.rdt_list_items_notify();

create or replace function public.rdt_status_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if tg_table_name = 'wishes' and new.status = 'done' and old.status is distinct from 'done' then
    for u in select public.rdt_other_adults(new.family_id) loop
      perform public.rdt_notify(new.family_id, u, 'wish_done', 'Um sonho foi realizado!', new.title, '/estrelas', 'wish:' || new.id);
    end loop;
  elsif tg_table_name = 'adventures' and new.status = 'done' and old.status is distinct from 'done' then
    for u in select public.rdt_other_adults(new.family_id) loop
      perform public.rdt_notify(new.family_id, u, 'adventure_done', 'Aventura concluída!', new.name, '/aventuras/' || new.id, 'adv:' || new.id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists wishes_notify on public.wishes;
create trigger wishes_notify after update of status on public.wishes for each row execute function public.rdt_status_notify();
drop trigger if exists adventures_notify on public.adventures;
create trigger adventures_notify after update of status on public.adventures for each row execute function public.rdt_status_notify();

-- ---------- Storage privado ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-media', 'family-media', false, 15728640, array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists "family media read" on storage.objects;
drop policy if exists "family media write" on storage.objects;
drop policy if exists "family media update" on storage.objects;
drop policy if exists "family media delete" on storage.objects;
create policy "family media read" on storage.objects for select to authenticated
  using (bucket_id = 'family-media' and public.rdt_is_member_text((storage.foldername(name))[1]));
create policy "family media write" on storage.objects for insert to authenticated
  with check (bucket_id = 'family-media' and public.rdt_is_member_text((storage.foldername(name))[1]));
create policy "family media update" on storage.objects for update to authenticated
  using (bucket_id = 'family-media' and public.rdt_is_member_text((storage.foldername(name))[1]));
create policy "family media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'family-media' and public.rdt_is_member_text((storage.foldername(name))[1]));

-- ---------- Tempo real ----------
do $$
declare t text;
begin
  foreach t in array array['members','tasks','task_completions','lists','list_items','events','child_records','memories',
                           'wishes','adventures','messages','notifications','achievements','star_transactions','families']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Ninguém anônimo acessa nada
revoke all on all tables in schema public from anon;
