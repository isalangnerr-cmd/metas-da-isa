// Metas da Isa: funções com o Claude.
//  - modo "diario": lê as entradas do diário de um mês e devolve os temas que mais apareceram + uma reflexão curta.
//  - modo "organizar": lê um recado (texto e/ou fotos/prints) e sugere itens pro app (compromisso, tarefa,
//    hábito, passinho, meta, % de leitura). Nada é gravado aqui: o app mostra as sugestões e a Isa confirma.
//  - modo "ping": só diz se a chave do Claude está configurada (não lê nada).
// Segredo necessário: ANTHROPIC_API_KEY (Supabase > Edge Functions > Secrets).
// Ela roda no projeto do Supabase que tem a chave do Claude (hoje, o do Roda do Tempo) e não guarda nada:
// só confere o login da Isa no projeto do Metas da Isa (uptoisa), onde os dados continuam.
import Anthropic from "npm:@anthropic-ai/sdk@1.14.0";

const METAS_URL = "https://oojnqitywbasfxuispiw.supabase.co", METAS_KEY = "sb_publishable_BuWlm09MZg6kgfcoqhpBpQ_OMkEsxGX";
async function usuario(auth: string) {
  if (!/^Bearer\s+\S+/.test(auth)) return null;
  const r = await fetch(METAS_URL + "/auth/v1/user", { headers: { apikey: METAS_KEY, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? u : null;
}

// deno-lint-ignore no-explicit-any
type A = any;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const MODELO = "claude-opus-5-5";
const IMG_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ---------- formatos de resposta (saída estruturada) ----------
// A API aceita poucos campos com união (anyOf/null): por isso texto ausente = "" e número ausente = -1 ou 0.
const txt = (d: string) => ({ type: "string", description: d + ' Use "" quando não houver.' });

const SCHEMA_DIARIO = {
  type: "object", additionalProperties: false,
  required: ["temas", "reflexao", "humor"],
  properties: {
    temas: {
      type: "array", description: "De 3 a 5 temas que mais apareceram no mês, do mais frequente pro menos.",
      items: {
        type: "object", additionalProperties: false, required: ["tema", "dias", "exemplo"],
        properties: {
          tema: { type: "string", description: "Nome curto do tema, em minúsculas (ex: tempo com a filha)." },
          dias: { type: "integer", description: "Em quantos dias esse tema apareceu." },
          exemplo: { type: "string", description: "Um trecho curto (até 12 palavras) que ela escreveu sobre isso." },
        },
      },
    },
    reflexao: { type: "string", description: "Reflexão curta (3 a 5 frases) sobre os padrões do mês, acolhedora e concreta." },
    humor: { type: "string", description: "Uma frase sobre o padrão de humor do mês (ex: o que aparece nos dias 😄 e nos dias 😕)." },
  },
} as const;

const TIPOS = ["compromisso", "tarefa", "marcar_habito", "habito_novo", "riscar_passinho", "passinho_novo", "meta_nova", "leitura"] as const;
const SCHEMA_ORGANIZAR = {
  type: "object", additionalProperties: false,
  required: ["resposta", "itens", "duvidas"],
  properties: {
    resposta: { type: "string", description: "Resposta curta e carinhosa (1 a 2 frases) dizendo o que foi entendido." },
    duvidas: { type: "array", items: { type: "string" }, description: "Dúvidas que impedem de criar algo com segurança. Vazio se não houver." },
    itens: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["tipo", "titulo", "data", "hora", "hora_fim", "local", "descricao", "area", "habito_id", "meta_id", "marco_id", "passo_id", "livro_id", "pct", "vezes_semana", "tempo", "horizonte", "trecho"],
        properties: {
          tipo: { type: "string", enum: [...TIPOS] },
          titulo: { type: "string", description: "Título curto em português do Brasil, em minúsculas, começando com verbo quando for tarefa/passinho." },
          data: txt("YYYY-MM-DD. Compromisso: o dia. Tarefa: o prazo. Marcar hábito: o dia em que foi feito. Meta nova: data limite."),
          hora: txt("HH:MM 24h, só para compromisso."),
          hora_fim: txt("HH:MM 24h, só para compromisso."),
          local: txt("Local do compromisso."),
          descricao: txt("Detalhes úteis (ex: o que levar)."),
          area: { type: "string", enum: ["", "carreira", "saude", "familia", "eu"], description: "Área da vida para tarefa, hábito novo ou meta nova." },
          habito_id: txt("id de um hábito existente (marcar_habito)."),
          meta_id: txt("id de uma meta existente (riscar_passinho, passinho_novo)."),
          marco_id: txt("id do marco dessa meta (riscar_passinho, passinho_novo)."),
          passo_id: txt("id do passinho a riscar (riscar_passinho)."),
          livro_id: txt("id do livro que ela está lendo (leitura)."),
          pct: { type: "integer", description: "Porcentagem lida no Kindle (leitura). -1 quando não for leitura." },
          vezes_semana: { type: "integer", description: "Hábito novo: quantas vezes por semana (1 a 7). 0 quando não se aplica." },
          tempo: { type: "integer", description: "Passinho novo: 5, 15 ou 60 minutos. 0 quando não se aplica." },
          horizonte: { type: "string", enum: ["", "curto", "medio", "longo"], description: "Meta nova: curto (até 3 meses), medio (3 a 12 meses), longo (1 a 5 anos)." },
          trecho: txt("Trecho curto do recado que justifica este item."),
        },
      },
    },
  },
} as const;

// ---------- prompts ----------
function promptDiario(mes: string) {
  return `Você lê o diário guiado da Isa e devolve os temas do mês ${mes} e uma reflexão curta.
A Isa é mãe de uma menina pequena, organiza metas de carreira, saúde, família e de si mesma, e escreve todo dia respondendo 3 perguntas: uma sobre o que deu energia, uma sobre uma pequena vitória e uma sobre o que faria diferente amanhã. Ela também marca o humor do dia de 1 (😞) a 5 (😄).
Regras:
- Use só o que está escrito. Não invente fatos, não diagnostique, não dê conselho médico nem psicológico.
- Temas com nomes curtos e concretos, a partir das palavras dela. Conte em quantos dias cada tema apareceu.
- A reflexão fala de padrões (o que se repete, o que costuma vir junto com os dias de humor melhor ou pior, o que ela vem querendo mudar), em tom acolhedor, leve e direto, em português do Brasil informal, em minúsculas. Termine com uma sugestão pequena e gentil pro próximo mês, sem cobrança.`;
}
function promptOrganizar(c: A) {
  const habitos = (c.habitos || []).map((h: A) => `- ${h.id}: ${h.titulo}`).join("\n") || "(nenhum)";
  const metas = (c.metas || []).map((m: A) => `- meta ${m.id}: ${m.titulo}\n` + (m.marcos || []).map((k: A) =>
    `  - marco ${k.id}: ${k.titulo}\n` + (k.passos || []).map((p: A) => `    - passinho ${p.id}: ${p.titulo}${p.feito ? " (já riscado)" : ""}`).join("\n")).join("\n")).join("\n") || "(nenhuma)";
  const livros = (c.livros || []).map((l: A) => `- ${l.id}: ${l.titulo} (está em ${l.pct}%)`).join("\n") || "(nenhum)";
  const tarefas = (c.tarefas || []).map((t: A) => `- ${t.titulo}${t.data ? ` (${t.data})` : ""}`).join("\n") || "(nenhuma)";
  return `Você é a caixa de entrada do app "metas da isa". A Isa cola recados, prints de grupos (escola, família), fotos de convites ou fala pelo microfone. Seu trabalho é entender e sugerir o que registrar no app. Nada entra sem ela confirmar.

Hoje é ${c.diaSemana || ""}, ${c.hoje}, ${c.agora} (horário dela). Resolva datas relativas ("sexta", "amanhã", "dia 12") a partir de hoje; se o mês não estiver claro, use a próxima ocorrência no futuro. Horários em 24h.

Tipos de item:
- compromisso: algo com dia (e talvez horário) para a agenda do Google. Sem horário, deixe hora vazia.
- tarefa: algo a fazer, com prazo em "data" se houver.
- marcar_habito: ela conta que fez um hábito que já existe. Use habito_id de um hábito da lista e "data" do dia em que fez.
- habito_novo: ela quer começar um hábito recorrente que não está na lista.
- riscar_passinho: ela conta que fez um passinho de uma meta. Use meta_id, marco_id e passo_id da lista (só passinhos não riscados).
- passinho_novo: um próximo passo concreto que cabe numa meta existente (meta_id e marco_id).
- meta_nova: um objetivo maior, de semanas ou meses, que não está na lista.
- leitura: ela conta em que % está um livro que está lendo (livro_id e pct).

Hábitos dela:
${habitos}

Metas dela (com marcos e passinhos):
${metas}

Livros que está lendo:
${livros}

Tarefas que já existem (não duplique):
${tarefas}

Regras:
- Um recado pode gerar vários itens (ex.: festa na escola sexta 15h, levar prato doce → compromisso na sexta 15h + tarefa "levar prato doce" com prazo na sexta).
- Só use ids que existem nas listas acima. Se não achar o hábito, a meta ou o livro certo, não invente id: use habito_novo, meta_nova ou tarefa, ou escreva a dúvida.
- Não invente informação. Se algo essencial estiver ambíguo, proponha mesmo assim com o que tiver e escreva a dúvida em "duvidas".
- Saúde: só registre o que foi dito, sem conselho médico.
- Títulos curtos, em português do Brasil, em minúsculas. Campos sem informação: "" para texto, -1 para pct, 0 para vezes_semana e tempo.
- Se não houver nada para registrar, devolva itens vazio e explique em "resposta".`;
}

async function pedir(client: Anthropic, system: string, content: A[], schema: A, effort: "low" | "medium" | "high") {
  const r = await client.beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content }],
  } as A);
  if (r.stop_reason === "refusal") return { erro: "recusou" };
  if (r.stop_reason === "max_tokens") return { erro: "longo_demais" };
  const t = r.content.find((b: A) => b.type === "text") as A;
  if (!t) return { erro: "vazio" };
  return { resultado: JSON.parse(t.text) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  try {
    const body = await req.json().catch(() => ({}));
    if (body.modo === "ping") return json({ ok: true, chave: !!key });
    if (!key) return json({ erro: "sem_chave" }, 503);

    // quem está chamando? (o login dela no app)
    const user = await usuario(req.headers.get("Authorization") || "");
    if (!user) return json({ erro: "login" }, 401);
    const client = new Anthropic({ apiKey: key });

    if (body.modo === "diario") {
      const mes = String(body.mes || "").slice(0, 7);
      const ents = (Array.isArray(body.entradas) ? body.entradas : []).slice(0, 31);
      if (ents.length < 3) return json({ erro: "poucos_dias" }, 400);
      const CARAS = ["", "😞", "😕", "😐", "🙂", "😄"];
      const texto = ents.map((e: A) => `### ${String(e.dia).slice(0, 10)}${e.humor ? ` · humor ${CARAS[+e.humor] || ""} (${e.humor}/5)` : ""}\n` +
        (e.perguntas || []).map((p: string, i: number) => `- ${String(p).slice(0, 200)}\n  ${String((e.respostas || [])[i] || "(sem resposta)").slice(0, 2000)}`).join("\n")).join("\n\n");
      const out = await pedir(client, promptDiario(mes), [{ type: "text", text: `Diário de ${mes}:\n\n${texto}` }], SCHEMA_DIARIO, "medium");
      return "erro" in out ? json(out, 422) : json(out.resultado);
    }

    if (body.modo === "organizar") {
      const texto = String(body.texto || "").slice(0, 20000);
      const imgs = (Array.isArray(body.imagens) ? body.imagens : []).slice(0, 5)
        .filter((i: A) => IMG_OK.includes(i && i.media_type) && typeof i.data === "string" && i.data.length < 7_000_000);
      if (!texto.trim() && !imgs.length) return json({ erro: "vazio" }, 400);
      const content: A[] = imgs.map((i: A) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } }));
      content.push({ type: "text", text: texto.trim() ? `Recado:\n${texto.trim()}` : "Organize o que aparece na(s) imagem(ns) acima." });
      const out = await pedir(client, promptOrganizar(body.contexto || {}), content, SCHEMA_ORGANIZAR, "medium");
      return "erro" in out ? json(out, 422) : json(out.resultado);
    }
    return json({ erro: "modo" }, 400);
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error("anthropic", e.status, e.message);
    else console.error("metas-ia", String(e));
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return json({ erro: "chave_invalida" }, 503);
    if (e instanceof Anthropic.RateLimitError) return json({ erro: "muitos_pedidos" }, 429);
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) return json({ erro: "sem_credito" }, 402);
    if (e instanceof Anthropic.APIError) return json({ erro: "ia", detalhe: e.message.slice(0, 300) }, 502);
    return json({ erro: "falha", detalhe: String(e).slice(0, 300) }, 500);
  }
});
