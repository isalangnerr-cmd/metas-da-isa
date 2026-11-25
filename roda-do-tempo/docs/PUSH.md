# Notificações push com o app fechado (opcional)

Sem esta configuração, o app já avisa:
- na **central de notificações** (sininho), sincronizada entre aparelhos;
- com **notificação do sistema** enquanto o app está aberto ou em segundo plano recente.

Para receber avisos com o app **fechado** (inclusive no iPhone com o app instalado na tela de início, iOS 16.4+):

## 1. Chaves VAPID

```bash
npx web-push generate-vapid-keys
```

- A chave **pública** vai no `.env.local` do app: `VITE_VAPID_PUBLIC_KEY=...` (e rode `npm run build:pages` de novo).
- As duas vão como segredos da Edge Function (passo 2).

## 2. Edge Function `rdt-push`

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:voce@exemplo.com CRON_SECRET=$(openssl rand -hex 24)
npx supabase functions deploy rdt-push --no-verify-jwt
```

## 3. Agendamento

No Supabase, ative as extensões **pg_cron** e **pg_net** (Database → Extensions). Depois, no SQL Editor:

```sql
-- lembretes de missões do dia e cápsulas liberadas
\i supabase/migrations/0002_lembretes_no_servidor.sql   -- (ou cole o conteúdo)

-- entrega por push a cada 5 minutos (troque REF e o CRON_SECRET)
select cron.schedule('rdt-push', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://REF.supabase.co/functions/v1/rdt-push',
    headers := jsonb_build_object('Authorization', 'Bearer SEU_CRON_SECRET')
  );
$$);
```

## 4. No app

**Nossa família → Notificações → Avisos do sistema (push)**. Cada pessoa escolhe quais tipos de aviso quer receber.

Os lembretes de compromissos do calendário e de consultas/vacinas são gerados pelo app (com ele aberto em algum aparelho).
O servidor gera os de missões do dia e de cápsulas, além dos avisos imediatos (missão atribuída, carta nova,
lista alterada — no máximo um por lista por hora —, desejo realizado e aventura concluída).
