# Caixa de entrada inteligente

Cole um recado, suba um print, foto ou PDF, e a IA (Claude, da Anthropic) propõe o que criar:
checkpoints, missões, itens de lista, registros da filha, memórias e desejos. **Nada é criado sem confirmação**:
vocês revisam, ajustam (tipo, título, data, hora, responsável) e tocam em "Criar".

## Como funciona

1. O app envia os arquivos para o armazenamento **privado** da família (Supabase Storage).
2. Chama a Edge Function `rdt-inbox` com o login da pessoa. A função confere (pelas regras RLS) que ela pertence à família,
   baixa os arquivos e manda texto + imagens + PDFs ao modelo `claude-opus-5-5` com **saída estruturada** (o JSON sempre
   segue o formato de `supabase/functions/rdt-inbox/schema.ts`).
3. O app valida a proposta (ids de membros, datas, horários, categorias) e mostra para confirmação.
4. Ao confirmar, cria tudo e anexa os arquivos originais às missões criadas.

A função já pede um plano B automático do servidor (`fallbacks: "default"`): se o modelo principal recusar um pedido por
engano, outro modelo tenta. Saúde: o prompt proíbe diagnóstico, dose ou recomendação médica; só organiza o que foi informado.

## O que configurar

1. **Chave da API da Anthropic** em [console.anthropic.com](https://console.anthropic.com) → API Keys.
   É cobrada por uso, separada da assinatura do Claude. Um recado típico custa poucos centavos; prints e PDFs grandes custam um pouco mais.
   Dica: defina um limite de gasto mensal no Console.
2. No Supabase: **Edge Functions → Secrets → Add new secret**: `ANTHROPIC_API_KEY` = sua chave.
   (Nunca coloque essa chave no app, no `.env.local` nem no GitHub: ela fica só no servidor.)
3. Publicar a função:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase functions deploy rdt-inbox
   ```

## Limites

- Até 5 arquivos por envio, 10 MB cada (fotos são reduzidas antes de enviar). Formatos: JPG, PNG, WEBP, GIF, PDF.
- Texto até 20 mil caracteres.
- Áudio ainda não é suportado (precisa de um serviço de transcrição; fica para a etapa do WhatsApp).
- No modo "neste aparelho" (sem servidor) a Caixa de entrada fica desligada.

## Privacidade

O conteúdo enviado vai à API da Anthropic apenas para ser organizado. Pela política padrão da API, os dados não são usados
para treinar modelos. Os arquivos ficam no Storage privado da família e podem ser apagados junto com a família.
