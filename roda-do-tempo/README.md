# Roda do Tempo

**Mesmo time. Dentro e fora do jogo.**

App web (PWA) de organização familiar com cara de videogame retrô: missões, listas compartilhadas,
calendário, o mundo da filha, desejos, aventuras, correio com cápsulas do tempo e um minigame de
plataforma na página inicial.

- **Funcionalidades:** veja [docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md)
- **Notificações push com o app fechado (opcional):** [docs/PUSH.md](docs/PUSH.md)
- **Caixa de entrada inteligente (IA):** [docs/CAIXA-DE-ENTRADA.md](docs/CAIXA-DE-ENTRADA.md)

## Como funciona o armazenamento

O app tem dois modos:

| Modo | Quando | Dados | Compartilhamento |
|---|---|---|---|
| **Nuvem (Supabase)** | quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão configurados | Postgres com regras de acesso (RLS), fotos em armazenamento privado | Sim, em tempo real entre os adultos da família |
| **Neste aparelho** | sem servidor configurado, ou se a pessoa escolher “Usar só neste aparelho” | navegador (localStorage + IndexedDB) | Não |

Nos dois modos o app funciona offline: as alterações ficam numa fila e são enviadas quando a conexão volta.
Se duas pessoas editarem a mesma coisa, vence a versão mais recente (o banco ignora versões antigas) e o
app avisa. Itens de lista são registros separados, então duas pessoas podem mexer na mesma lista ao mesmo tempo.

## Stack

React 18 + TypeScript + Vite + Tailwind CSS · Supabase (Auth, Postgres, RLS, Realtime, Storage) ·
Canvas 2D para o minigame · Service Worker próprio para PWA/offline/push · Vitest para testes.

## Rodar no computador

```bash
cd roda-do-tempo
npm install
cp .env.example .env.local   # opcional: preencha com os dados do Supabase
npm run dev                  # http://localhost:5173
```

Sem `.env.local`, o app abre no modo “neste aparelho”.

## Configurar o Supabase (contas, compartilhamento e sincronização)

1. Crie (ou reative) um projeto em [supabase.com](https://supabase.com).
2. **SQL Editor** → cole e rode `supabase/migrations/0001_roda_do_tempo.sql`.
   Ele cria as tabelas, as políticas RLS, os gatilhos, as funções da família, o bucket privado `family-media` e liga o Realtime.
3. **Authentication → URL Configuration**: em *Site URL* e *Redirect URLs*, coloque o endereço onde o app ficará publicado
   (ex.: `https://SEU-USUARIO.github.io/metas-da-isa/roda/`). Isso é necessário para os links de confirmação, de acesso e de convite.
4. **Project Settings → API**: copie a *Project URL* e a chave *publishable/anon* para `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```
   A chave anon é pública por design; quem protege os dados são as políticas RLS. **Nunca** coloque a `service_role` no app.
5. (Opcional) Para a Caixa de entrada com IA, siga [docs/CAIXA-DE-ENTRADA.md](docs/CAIXA-DE-ENTRADA.md).
6. (Opcional) Para lembretes e push com o app fechado, siga [docs/PUSH.md](docs/PUSH.md).

### Primeiro uso

1. Uma pessoa cria a conta e a família (“Novo jogo”) e monta o time (parceiro(a), filha, cachorrinha).
2. Em **Nossa família → Convidar adulto**, gera um link de convite (uso único, 14 dias) e manda por WhatsApp/e-mail.
3. A outra pessoa abre o link, cria a conta e entra direto, já vinculada ao próprio perfil.

## Publicar (GitHub Pages)

O build fica na pasta `roda/` na raiz do repositório, servida pelo mesmo GitHub Pages do Metas da Isa:

```bash
cd roda-do-tempo
npm run build:pages          # gera ../roda (usa o .env.local, se existir)
git add ../roda && git commit -m "Publica Roda do Tempo" && git push
```

Depois do merge na branch publicada, o app fica em `https://SEU-USUARIO.github.io/metas-da-isa/roda/`.

### Instalar no celular

- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.
- **Android (Chrome):** menu ⋮ → *Instalar app*. Também há um botão em **Nossa família → Instalar o app**.

## Testes

```bash
npm test                 # 32 testes (inclui a Caixa de entrada): datas/fuso, recorrência, ICS, fila offline, conflitos, regras do jogo
npm run typecheck
# Segurança do banco (precisa de um Postgres local):
PGHOST=/tmp PGPORT=5432 supabase/tests/run.sh   # 25 verificações de RLS, cápsulas, convites, exclusão
```

## Estrutura

```
src/
  data/        store (cache + fila offline + realtime), backends nuvem/local, sessão, tipos
  lib/         datas no fuso de SP, recorrência, ICS, regras de domínio, lembretes, PWA
  components/  design system pixel (ícones, painéis, modais, avatares, capas)
  game/        sprites em pixel art e o minigame (canvas)
  pages/       World 01, Missões, Inventário, Checkpoints, Mini player, Estrelas, Aventuras, Correio, Família
supabase/
  migrations/  0001 (esquema + RLS), 0002 (lembretes no servidor, opcional)
  functions/   rdt-push (envio de push, opcional)
  tests/       testes de segurança do banco
```

## Privacidade

- Cada família só enxerga os próprios dados (RLS em todas as tabelas, testado).
- Fotos e anexos ficam num bucket **privado**, acessados por links temporários (1 h).
- O conteúdo das cartas fica numa tabela separada que o banco só libera na data de abertura.
- Cartas privadas só aparecem para quem enviou e quem recebeu.
- Exportação completa em JSON e exclusão total dos dados em **Nossa família → Dados e privacidade**.
- O service worker nunca guarda respostas do servidor em cache, só os arquivos do app.
- `noindex`: o app não é indexado por buscadores.
