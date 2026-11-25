// Widget "Metas da Isa" para o app Scriptable (iPhone), tamanho médio.
// Esquerda: sequência de leitura + barrinha da meta do dia. Direita: rotina de hoje (tarefas e hábitos que faltam).
// Coloque a chave secreta abaixo (ela só permite LER esses dados).
const CHAVE = "COLE_A_CHAVE_AQUI";
const URL_DADOS = "https://oojnqitywbasfxuispiw.supabase.co/functions/v1/metas-widget?k=" + CHAVE;

const C = {
  fundo: new Color("#2E0F17"), card: new Color("#451A25"), trilho: new Color("#5A2432"),
  tinta: new Color("#FFF4EC"), apagado: new Color("#EBC6CC"), cereja: new Color("#FF4D6A"), creme: new Color("#FFE8C7"),
};
const PAD = 14, ESQ = 108, VAO = 14;
// largura aproximada do widget médio (varia com o modelo do iPhone)
const LARG = Math.round(Device.screenSize().width * 0.87);
const DIR = Math.max(150, LARG - 2 * PAD - ESQ - VAO);

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

function txt(st, s, size, cor, bold) {
  const t = st.addText(String(s));
  t.font = bold ? Font.boldRoundedSystemFont(size) : Font.mediumRoundedSystemFont(size);
  t.textColor = cor; t.lineLimit = 1; t.minimumScaleFactor = 0.7;
  return t;
}
function barra(st, w, frac, cor) {
  const h = 6, dc = new DrawContext();
  dc.size = new Size(w, h); dc.opaque = false; dc.respectScreenScale = true;
  const p = new Path(); p.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2);
  dc.addPath(p); dc.setFillColor(C.trilho); dc.fillPath();
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) { const q = new Path(); q.addRoundedRect(new Rect(0, 0, Math.max(h, w * f), h), h / 2, h / 2); dc.addPath(q); dc.setFillColor(cor); dc.fillPath(); }
  const img = st.addImage(dc.getImage()); img.imageSize = new Size(w, h);
}
function item(st, icone, corIcone, titulo, corTxt) {
  const r = st.addStack(); r.layoutHorizontally(); r.centerAlignContent();
  const i = r.addStack(); i.size = new Size(16, 0); txt(i, icone, 12, corIcone, true);
  r.addSpacer(4); txt(r, titulo, 13, corTxt, false); r.addSpacer();
}

async function monta() {
  const w = new ListWidget();
  w.backgroundColor = C.fundo; w.setPadding(PAD, PAD, PAD, PAD);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  const d = await dados();
  if (!d) { txt(w, "metas da isa ✦", 15, C.tinta, true); w.addSpacer(4); txt(w, "não consegui carregar agora", 12, C.apagado); return w; }

  const linha = w.addStack(); linha.layoutHorizontally();

  // ---- esquerda: leitura ----
  const L = d.leitura, ok = L.feito >= L.meta;
  const esq = linha.addStack(); esq.layoutVertically(); esq.size = new Size(ESQ, 0);
  esq.backgroundColor = C.card; esq.cornerRadius = 18; esq.setPadding(12, 12, 12, 12);
  txt(esq, "🔥 leitura", 11, C.apagado, true);
  esq.addSpacer();
  txt(esq, L.sequencia, 36, C.creme, true);
  txt(esq, L.sequencia === 1 ? "dia seguido" : "dias seguidos", 11, C.apagado, false);
  esq.addSpacer();
  barra(esq, ESQ - 24, L.feito / L.meta, ok ? C.creme : C.cereja);
  esq.addSpacer(5);
  txt(esq, ok ? "meta batida ✦" : (L.leuHoje ? `+${L.feito}% de ${L.meta}%` : "ainda não leu hoje"), 11, ok ? C.creme : C.tinta, true);

  linha.addSpacer(VAO);

  // ---- direita: rotina de hoje ----
  const hs = d.habitos || [], feitos = hs.filter(h => h.feito).length;
  const dir = linha.addStack(); dir.layoutVertically(); dir.size = new Size(DIR, 0);
  dir.setPadding(2, 0, 0, 0);
  const cab = dir.addStack(); cab.layoutHorizontally(); cab.centerAlignContent();
  txt(cab, "rotina de hoje", 11, C.apagado, true); cab.addSpacer();
  txt(cab, `${feitos}/${hs.length} hábitos`, 11, feitos === hs.length ? C.creme : C.apagado, true);
  dir.addSpacer(6);
  barra(dir, DIR, hs.length ? feitos / hs.length : 0, C.creme);
  dir.addSpacer(8);

  const itens = [
    ...(d.tarefas || []).map(t => t.atrasada ? ["!", C.cereja, t.titulo, C.cereja] : [t.foco ? "★" : "•", C.creme, t.titulo, C.tinta]),
    ...hs.filter(h => !h.feito).map(h => ["○", C.apagado, h.titulo, C.tinta]),
  ];
  const MAX = 4;
  if (!itens.length) { dir.addSpacer(); txt(dir, "tudo feito hoje 💃", 15, C.creme, true); }
  itens.slice(0, itens.length > MAX ? MAX - 1 : MAX).forEach((x, n) => { if (n) dir.addSpacer(3); item(dir, ...x); });
  if (itens.length > MAX) { dir.addSpacer(3); item(dir, "+", C.apagado, `mais ${itens.length - MAX + 1} no app`, C.apagado); }
  dir.addSpacer();

  linha.addSpacer();
  return w;
}

const widget = await monta();
if (config.runsInWidget) Script.setWidget(widget); else await widget.presentMedium();
Script.complete();
