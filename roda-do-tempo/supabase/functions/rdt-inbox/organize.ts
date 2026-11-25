// Lógica da Caixa de entrada inteligente: manda texto/imagens/PDFs ao Claude e
// recebe de volta uma lista estruturada de coisas para criar no app.
import Anthropic from "npm:@anthropic-ai/sdk@1.14.0";
import { EVENT_CATEGORIES, OUTPUT_SCHEMA, TASK_CATEGORIES } from "./schema.ts";

export interface InboxContext {
  today: string; // YYYY-MM-DD (America/Sao_Paulo)
  weekday: string; // ex.: "quarta-feira"
  now: string; // HH:MM
  members: { id: string; name: string; nickname?: string | null; kind: string; me?: boolean }[];
  lists: { id: string; name: string }[];
}
export interface InboxFile { media_type: string; data: string /* base64 */; name: string }

export function systemPrompt(ctx: InboxContext) {
  const members = ctx.members.map((m) => `- ${m.id}: ${m.name}${m.nickname ? ` ("${m.nickname}")` : ""} (${m.kind === "adult" ? "adulto" : m.kind === "child" ? "criança" : "pet"})${m.me ? " ← quem está mandando" : ""}`).join("\n");
  const lists = ctx.lists.length ? ctx.lists.map((l) => `- ${l.id}: ${l.name}`).join("\n") : "(nenhuma)";
  return `Você é a Caixa de entrada do Roda do Tempo, o app de organização de uma família (dois adultos, uma filha pequena e uma cachorrinha).
A família manda recados, prints de grupos da escola, fotos de convites, PDFs (cardápios, circulares, receitas), listas e anotações soltas. Seu trabalho é entender e propor o que criar no app. Nada é criado sem a família confirmar.

Hoje é ${ctx.weekday}, ${ctx.today}, ${ctx.now} no horário de Brasília (America/Sao_Paulo). Resolva datas relativas ("sexta", "amanhã", "dia 12") a partir de hoje; se o mês não estiver claro, use a próxima ocorrência futura. Horários em 24h.

Membros:
${members}

Listas existentes:
${lists}

Tipos de item:
- task (missão): algo a fazer. "date" = prazo. assignee: id de adulto, "both" ou "family" (use "family" se não estiver claro). category: ${TASK_CATEGORIES.join(", ")}.
- event (checkpoint): compromisso com data. Use all_day=true quando não houver horário. category: ${EVENT_CATEGORIES.join(", ")}. reminder_minutes opcional (ex.: 60, 1440).
- list_item: algo para comprar/levar/anotar numa lista. Prefira uma lista existente (list_id); senão sugira list_name.
- child_record: registro da criança (consulta, vacina, peso/altura, escola, medicamento informado pelos pais, lembrete). Use member_id da criança e child_kind.
- memory: um relato/lembrança para o diário.
- wish: um desejo (lugar para conhecer, algo para comprar um dia, viagem).

Regras:
- Um recado pode gerar vários itens (ex.: festa na escola → evento + missão "levar prato doce" na véspera + item de lista).
- Não invente informação. Se algo essencial estiver ambíguo, ainda proponha o item com o que tiver e escreva a dúvida em "questions".
- Saúde: só organize o que foi informado; nunca dê diagnóstico, dose ou recomendação médica.
- Títulos curtos e claros, em português do Brasil. "reply" deve ser breve (1 a 3 frases), no tom de um app acolhedor.
- Se não houver nada para criar, devolva items vazio e explique em "reply".`;
}

export async function organize(client: Anthropic, ctx: InboxContext, text: string, files: InboxFile[]) {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const f of files) {
    if (f.media_type === "application/pdf") {
      content.push({ type: "document", title: f.name, source: { type: "base64", media_type: "application/pdf", data: f.data } });
    } else {
      content.push({ type: "image", source: { type: "base64", media_type: f.media_type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: f.data } });
    }
  }
  content.push({ type: "text", text: text.trim() ? `Recado:\n${text.trim()}` : "Organize o conteúdo dos arquivos acima." });

  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
    system: systemPrompt(ctx),
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") return { error: "refusal" as const };
  if (response.stop_reason === "max_tokens") return { error: "too_long" as const };
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return { error: "empty" as const };
  const parsed = JSON.parse(textBlock.text) as { reply: string; items: Record<string, unknown>[]; questions: string[] };
  return { result: parsed, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } };
}
