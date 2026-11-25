// Widget "Metas da Isa" para o app Scriptable (iPhone), tamanho médio.
// Mostra a sequência de leitura e a rotina do dia (hábitos que faltam + tarefas no foco).
// Coloque a chave secreta abaixo (ela só permite LER esses dados).
const CHAVE = "COLE_A_CHAVE_AQUI";
const URL_DADOS = "https://oojnqitywbasfxuispiw.supabase.co/functions/v1/metas-widget?k=" + CHAVE;

const C = {
  fundo: new Color("#2E0F17"), card: new Color("#451A25"), tinta: new Color("#FFF4EC"),
  apagado: new Color("#EBC6CC"), cereja: new Color("#FF4D6A"), creme: new Color("#FFE8C7"),
};
const fm = FileManager.local();
const cache = fm.joinPath(fm.documentsDirectory(), "metas-widget.json");

async function dados() {
  try {
    const r = new Request(URL_DADOS); r.timeoutInterval = 15;
    const j = await r.loadJSON();
    if (j && j.leitura) { fm.writeString(cache, JSON.stringify(j)); return j; }
  } catch (e) { /* sem internet: usa o último que deu certo */ }
  return fm.fileExists(cache) ? JSON.parse(fm.readString(cache)) : null;
}

function txt(st, s, size, cor, peso = "medium") {
  const t = st.addText(s);
  t.font = peso === "bold" ? Font.boldRoundedSystemFont(size) : Font.mediumRoundedSystemFont(size);
  t.textColor = cor; t.lineLimit = 1; t.minimumScaleFactor = 0.75;
  return t;
}

async function monta() {
  const w = new ListWidget();
  w.backgroundColor = C.fundo;
  w.setPadding(14, 14, 14, 14);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  const d = await dados();
  if (!d) { txt(w, "metas da isa ✦", 15, C.tinta, "bold"); w.addSpacer(4); txt(w, "não consegui carregar agora", 12, C.apagado); return w; }

  const linha = w.addStack(); linha.layoutHorizontally(); linha.topAlignContent();

  // esquerda: leitura
  const esq = linha.addStack(); esq.layoutVertically();
  esq.backgroundColor = C.card; esq.cornerRadius = 16; esq.setPadding(10, 12, 10, 12); esq.size = new Size(112, 0);
  const L = d.leitura;
  txt(esq, "🔥 " + L.sequencia, 28, C.creme, "bold");
  txt(esq, L.sequencia === 1 ? "dia lendo" : "dias lendo", 12, C.apagado);
  esq.addSpacer();
  const ok = L.feito >= L.meta;
  txt(esq, ok ? "meta batida ✦" : `+${L.feito}% de ${L.meta}%`, 12, ok ? C.creme : C.tinta, "bold");
  if (!L.leuHoje) txt(esq, "ainda não leu hoje", 10, C.cereja);

  linha.addSpacer(12);

  // direita: rotina do dia
  const dir = linha.addStack(); dir.layoutVertically();
  const hs = d.habitos || [], feitos = hs.filter(h => h.feito).length;
  txt(dir, `rotina · ${feitos} de ${hs.length} hábitos`, 12, C.apagado, "bold");
  dir.addSpacer(4);
  const itens = [
    ...(d.tarefas || []).map(t => ({ s: (t.foco ? "★ " : "• ") + t.titulo, cor: t.atrasada ? C.cereja : C.tinta })),
    ...hs.filter(h => !h.feito).map(h => ({ s: "○ " + h.titulo, cor: C.tinta })),
  ];
  const MAX = 5;
  if (!itens.length) txt(dir, "tudo feito hoje 💃", 14, C.creme, "bold");
  itens.slice(0, MAX).forEach(i => { txt(dir, i.s, 13, i.cor); dir.addSpacer(2); });
  if (itens.length > MAX) txt(dir, `+${itens.length - MAX} no app`, 11, C.apagado);
  dir.addSpacer();
  return w;
}

const widget = await monta();
if (config.runsInWidget) Script.setWidget(widget); else await widget.presentMedium();
Script.complete();
