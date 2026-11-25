-- Permissões explícitas por tabela (projetos novos do Supabase não liberam nada por padrão).
-- As linhas que cada pessoa vê continuam decididas pelas regras RLS.
revoke all on public.families, public.family_users, public.members, public.tasks, public.task_completions, public.lists,
  public.list_items, public.events, public.child_records, public.memories, public.wishes, public.adventures, public.messages,
  public.message_bodies, public.notifications, public.achievements, public.star_transactions, public.user_prefs,
  public.invites, public.push_subscriptions
from anon, authenticated;

grant select, insert, update, delete on public.members, public.tasks, public.task_completions, public.lists, public.list_items,
  public.events, public.child_records, public.memories, public.wishes, public.adventures, public.messages,
  public.achievements, public.star_transactions, public.invites, public.user_prefs, public.push_subscriptions
to authenticated;
grant select, update on public.families to authenticated;               -- criar/excluir só pelas funções
grant select on public.family_users to authenticated;                   -- entrar/sair só pelas funções
grant select, insert, update on public.message_bodies to authenticated;
grant select, insert, update on public.notifications to authenticated;
