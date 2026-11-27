// Formato da resposta da IA (saída estruturada). Sem dependências: usado pela função e pelos testes.
const ITEM_KINDS = ["task", "event", "list_item", "child_record", "memory", "wish"] as const;
// A API aceita no máximo 16 campos com união (anyOf/null). Por isso: texto ausente = "" (string vazia),
// e só os números usam "número OU null".
const text = (description = "") => ({ type: "string", description: (description ? description + ". " : "") + 'Use "" quando não houver.' });
const nullable = (t: string, extra: Record<string, unknown> = {}) => ({ anyOf: [{ type: t, ...extra }, { type: "null" }] });

/** Esquema da resposta (saída estruturada: o JSON sempre segue este formato). */
export const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "items", "questions"],
  properties: {
    reply: { type: "string", description: "Resposta curta e calorosa em português do Brasil dizendo o que foi entendido." },
    questions: { type: "array", items: { type: "string" }, description: "Dúvidas que impedem de criar algo com segurança (ex.: data ambígua). Vazio se não houver." },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "title", "description", "date", "time", "end_time", "all_day", "location", "assignee", "category", "list_id", "list_name", "qty", "unit", "price", "child_kind", "member_id", "reminder_minutes", "source_quote"],
        properties: {
          kind: { type: "string", enum: [...ITEM_KINDS] },
          title: { type: "string" },
          description: text(),
          date: text("YYYY-MM-DD. Para tarefa: prazo. Para evento: dia"),
          time: text("HH:MM 24h"),
          end_time: text("HH:MM 24h"),
          all_day: { type: "boolean", description: "true só para compromisso de dia inteiro, sem horário" },
          location: text(),
          assignee: text("id de membro adulto, 'both' (os dois adultos) ou 'family'"),
          category: text(),
          list_id: text("id de uma lista existente, se o item couber nela"),
          list_name: text("nome de lista nova a criar, se nenhuma existente servir"),
          qty: nullable("number"),
          unit: text(),
          price: nullable("number"),
          child_kind: { type: "string", enum: ["", "moment", "consult", "vaccine", "growth", "food", "sleep", "school", "medicine", "reminder"], description: 'Use "" se não for registro da criança.' },
          member_id: text("membro relacionado (criança ou pet) quando for registro do Mini player"),
          reminder_minutes: nullable("integer"),
          source_quote: text("trecho curto do recado que justifica este item"),
        },
      },
    },
  },
} as const;

export const TASK_CATEGORIES = ["casa", "filha", "pet", "compras", "saude", "financeiro", "trabalho", "relacionamento", "lazer", "pessoal", "outros"];
export const EVENT_CATEGORIES = ["familia", "casal", "filha", "consulta", "trabalho", "aniversario", "viagem", "pet", "contas", "pessoal"];
