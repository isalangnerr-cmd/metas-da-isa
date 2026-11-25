-- Testes de segurança (RLS) e regras do banco. Rode com supabase/tests/run.sh
\set ON_ERROR_STOP 1
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x'),('22222222-2222-2222-2222-222222222222','b@x'),('33333333-3333-3333-3333-333333333333','intruso@x');

create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;

set role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.create_family('Família A', 'Ana') as fid \gset
-- Ana cria um perfil de parceiro, filha e convite
insert into public.members(family_id, kind, name) values (:'fid', 'adult', 'Bia') returning id as bia \gset
select id as ana from public.members where user_id = auth.uid() \gset
insert into public.members(family_id, kind, name) values (:'fid', 'child', 'Liz') returning id as liz \gset
insert into public.invites(family_id, member_id) values (:'fid', :'bia') returning code \gset
insert into public.tasks(family_id, title, assignee) values (:'fid', 'Missão secreta', 'family') returning id as task \gset

-- Bia aceita o convite e vira dona do perfil
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select count(*) from public.tasks) = 0, 'antes do convite, Bia não vê nada');
select public.accept_invite(:'code');
select pg_temp.check((select user_id from public.members where id = :'bia') = auth.uid(), 'convite vincula a conta ao perfil');
select pg_temp.check((select count(*) from public.tasks) = 1, 'depois do convite, Bia vê as missões');
select pg_temp.check((select count(*) from public.notifications where type = 'task_assigned') = 0, 'notificação só para os outros (ainda nenhuma para Bia)');

-- Intruso não vê nem escreve
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check((select count(*) from public.tasks) = 0, 'intruso não lê missões de outra família');
select pg_temp.check((select count(*) from public.members) = 0, 'intruso não lê perfis (dados da criança protegidos)');
do $$ begin
  insert into public.tasks(family_id, title) values ((select family_id from public.invites limit 1), 'invasão');
  raise exception 'FALHOU: intruso conseguiu inserir';
exception when insufficient_privilege or others then
  if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok: intruso não insere em outra família';
end $$;
do $$ begin perform public.accept_invite('codigo-invalido'); raise exception 'FALHOU'; exception when others then if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok: convite inválido é recusado'; end $$;

-- Cápsula do tempo: conteúdo trancado no banco
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.messages(family_id, sender_id, recipient_id, title, open_at) values (:'fid', :'ana', :'bia', 'Para o futuro', current_date + 365) returning id as cap \gset
insert into public.message_bodies(message_id, family_id, body) values (:'cap', :'fid', 'conteúdo secreto');
insert into public.messages(family_id, sender_id, recipient_id, title) values (:'fid', :'ana', :'bia', 'Bilhete') returning id as note \gset
insert into public.message_bodies(message_id, family_id, body) values (:'note', :'fid', 'te amo');
insert into public.messages(family_id, sender_id, recipient_id, title, private) values (:'fid', :'ana', :'bia', 'Privada', true) returning id as priv \gset
select pg_temp.check((select count(*) from public.message_bodies where message_id = :'cap') = 1, 'remetente lê a própria cápsula');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select count(*) from public.messages where id = :'cap') = 1, 'destinatária vê o envelope da cápsula');
select pg_temp.check((select count(*) from public.message_bodies where message_id = :'cap') = 0, 'destinatária NÃO lê o conteúdo antes da data');
select pg_temp.check((select body from public.message_bodies where message_id = :'note') = 'te amo', 'bilhete sem trava é lido');
select pg_temp.check((select count(*) from public.notifications where user_id = auth.uid() and type = 'message') = 3, 'destinatária recebeu aviso das cartas');
update public.messages set read_at = now(), updated_at = now() where id = :'cap';
select pg_temp.check((select read_at from public.messages where id = :'cap') is null, 'não dá para marcar cápsula como lida antes da hora');
do $$ begin
  update public.messages set open_at = current_date - 1, updated_at = now() where title = 'Para o futuro';
  raise exception 'FALHOU';
exception when others then if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok: destinatária não muda a data de abertura';
end $$;
do $$ begin
  insert into public.messages(family_id, sender_id, recipient_id, title) select family_id, id, 'family', 'falsa' from public.members where name = 'Ana';
  raise exception 'FALHOU';
exception when others then if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok: ninguém envia carta em nome de outra pessoa';
end $$;

-- Mensagem privada: terceiro adulto da família não vê
reset role; insert into public.family_users values (:'fid', '33333333-3333-3333-3333-333333333333', 'adult'); set role authenticated;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check((select count(*) from public.messages where id = :'priv') = 0, 'carta privada é invisível para outro adulto');
select pg_temp.check((select count(*) from public.messages where id = :'note') = 1, 'carta não privada é visível para a família');
reset role; delete from public.family_users where user_id = '33333333-3333-3333-3333-333333333333'; set role authenticated;

-- Edição offline antiga não sobrescreve a mais nova
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.tasks set title = 'Nova', updated_at = now() + interval '1 minute' where id = :'task';
update public.tasks set title = 'Velha (offline)', updated_at = now() - interval '1 hour' where id = :'task';
select pg_temp.check((select title from public.tasks where id = :'task') = 'Nova', 'a versão mais recente vence');

-- Perfil: não dá para "roubar" o perfil já vinculado
update public.members set user_id = auth.uid(), updated_at = now() + interval '2 minute' where id = :'bia';
select pg_temp.check((select user_id from public.members where id = :'bia') = '22222222-2222-2222-2222-222222222222', 'conta de outro adulto não pode ser trocada');

-- Bia é notificada quando recebe uma missão
insert into public.tasks(family_id, title, assignee) values (:'fid', 'Levar a Liz', :'bia');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select count(*) from public.notifications where user_id = auth.uid() and type = 'task_assigned') >= 1, 'aviso de missão atribuída');

-- Storage: só a própria família
select pg_temp.check(public.rdt_is_member_text(:'fid'), 'membro acessa a pasta da família');
select pg_temp.check(not public.rdt_is_member_text('nao-e-uuid'), 'caminho inválido é negado');

-- Exclusão total exige confirmação
do $$ begin perform public.delete_family((select id from public.families limit 1), 'nome errado'); raise exception 'FALHOU'; exception when others then if sqlerrm like 'FALHOU%' then raise; end if; raise notice 'ok: exclusão exige o nome da família'; end $$;
select public.delete_family(:'fid', 'Família A');
reset role;
select pg_temp.check((select count(*) from public.tasks) = 0 and (select count(*) from public.members) = 0, 'excluir família apaga todos os dados');
\echo TODOS OS TESTES DO BANCO PASSARAM
