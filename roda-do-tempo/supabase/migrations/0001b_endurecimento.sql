-- Endurecimento (recomendações do verificador de segurança do Supabase)
alter function public.rdt_touch() set search_path = public;
alter function public.rdt_setup_table(text) set search_path = public;
alter function public.rdt_members_guard() set search_path = public;

-- Ninguém sem login executa funções do app
revoke execute on function
  public.rdt_is_member(uuid), public.rdt_is_member_text(text), public.rdt_member_user(text), public.rdt_can_read_body(uuid),
  public.create_family(text, text, text, jsonb), public.invite_info(text), public.accept_invite(text, text),
  public.leave_family(uuid), public.delete_family(uuid, text),
  public.rdt_wants(uuid, text), public.rdt_notify(uuid, uuid, text, text, text, text, text), public.rdt_other_adults(uuid),
  public.rdt_tasks_notify(), public.rdt_messages_notify(), public.rdt_list_items_notify(), public.rdt_status_notify(),
  public.rdt_messages_guard(), public.rdt_touch(), public.rdt_members_guard(), public.rdt_setup_table(text)
from public, anon, authenticated;

-- Logados: só o que o app chama e o que as regras RLS usam
grant execute on function
  public.rdt_is_member(uuid), public.rdt_is_member_text(text), public.rdt_member_user(text), public.rdt_can_read_body(uuid),
  public.create_family(text, text, text, jsonb), public.invite_info(text), public.accept_invite(text, text),
  public.leave_family(uuid), public.delete_family(uuid, text)
to authenticated;
