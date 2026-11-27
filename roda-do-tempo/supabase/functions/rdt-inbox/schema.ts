// Formato da resposta da IA (saída estruturada). Sem dependências: usado pela função e pelos testes.
const ITEM_KINDS = ["task", "event", "list_item", "child_record", "memory", "wish"] as const;
// campo opcional: "valor do tipo t" OU null (anyOf, formato aceito pela saída estruturada)
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
          description: nullable("string"),
          date: nullable("string", { description: "YYYY-MM-DD. Para tarefa: prazo. Para evento: dia." }),
          time: nullable("string", { description: "HH:MM 24h" }),
          end_time: nullable("string", { description: "HH:MM 24h" }),
          all_day: nullable("boolean"),
          location: nullable("string"),
          assignee: nullable("string", { description: "id de membro adulto, 'both' (os dois adultos) ou 'family'" }),
          category: nullable("string"),
          list_id: nullable("string", { description: "id de uma lista existente, se o item couber nela" }),
          list_name: nullable("string", { description: "nome de lista nova a criar, se nenhuma existente servir" }),
          qty: nullable("number"),
          unit: nullable("string"),
          price: nullable("number"),
          child_kind: nullable("string", { enum: ["moment", "consult", "vaccine", "growth", "food", "sleep", "school", "medicine", "reminder"] }),
          member_id: nullable("string", { description: "membro relacionado (criança ou pet) quando for registro do Mini player" }),
          reminder_minutes: nullable("integer"),
          source_quote: nullable("string", { description: "trecho curto do recado que justifica este item" }),
        },
      },
    },
  },
} as const;

export const TASK_CATEGORIES = ["casa", "filha", "pet", "compras", "saude", "financeiro", "trabalho", "relacionamento", "lazer", "pessoal", "outros"];
export const EVENT_CATEGORIES = ["familia", "casal", "filha", "consulta", "trabalho", "aniversario", "viagem", "pet", "contas", "pessoal"];
