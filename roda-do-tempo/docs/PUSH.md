# Notificações push (com o app fechado)

**Já configurado no projeto da família.** Como funciona:

- `rdt_generate_reminders()` roda a cada 5 minutos (pg_cron) e cria avisos de:
  missões do dia, compromissos (padrão: 1 dia antes e 15 minutos antes), consultas/vacinas da filha
  (véspera às 18h e no dia às 7h) e cápsulas do tempo que abriram.
- Os avisos imediatos (missão atribuída, carta nova, lista alterada, desejo realizado, aventura concluída)
  são criados por gatilhos no banco.
- A Edge Function `rdt-push` roda a cada minuto e entrega os avisos novos como push nos aparelhos inscritos.
- As chaves VAPID e o segredo do agendador ficam na tabela protegida `rdt_push_config` (só o servidor lê);
  a chave pública VAPID fica em `.env.production` (`VITE_VAPID_PUBLIC_KEY`).

## Para cada pessoa ativar

- **iPhone (iOS 16.4+):** abra o app no Safari → Compartilhar → *Adicionar à Tela de Início*. Abra pelo ícone,
  vá em **Nossa família → Notificações → Avisos do sistema (push)** e permita.
- **Android / computador:** **Nossa família → Notificações → Avisos do sistema (push)** e permita no navegador.

Cada aparelho precisa ativar uma vez. Os tipos de aviso podem ser ligados/desligados na mesma tela.

## Reconfigurar em outro projeto

1. Rode `0002a_push_config.sql` e `0002_lembretes_no_servidor.sql` (ajuste a URL da função).
2. Gere chaves com `npx web-push generate-vapid-keys` e insira em `rdt_push_config` junto com um segredo aleatório.
3. Publique a função: `npx supabase functions deploy rdt-push --no-verify-jwt`.
4. Coloque a chave pública em `VITE_VAPID_PUBLIC_KEY` e gere o build.
