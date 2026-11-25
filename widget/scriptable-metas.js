// Widget "Metas da Isa" para o app Scriptable (iPhone), tamanho médio. Estilo "adesivinhos".
// Esquerda: adesivo cereja com a sequência de leitura. Direita: saudação, frase do dia,
// tarefas com estrela (foco) em pílulas e o resto resumido em "+ x coisinhas".
// Coloque a chave secreta abaixo (ela só permite LER esses dados).
const CHAVE = "COLE_A_CHAVE_AQUI";
const URL_DADOS = "https://oojnqitywbasfxuispiw.supabase.co/functions/v1/metas-widget?k=" + CHAVE;

const C = {
  fundo: new Color("#2E0F17"), card: new Color("#451A25"), linha: new Color("#6B2E3D"),
  tinta: new Color("#FFF4EC"), apagado: new Color("#EBC6CC"), rosa: new Color("#FFC2CD"),
  cereja: new Color("#FF4D6A"), creme: new Color("#FFE8C7"), cremeTinta: new Color("#5A2A10"), branco: new Color("#FFFFFF"),
};
const MAX_PILULAS = 2;
const APP = "https://isalangnerr-cmd.github.io/metas-da-isa/";
// tocar no widget roda este script no Scriptable com ?abrir=1, e ele manda o Safari abrir o app
// (o link direto às vezes é ignorado pelo iPhone e só abre o Scriptable)
const TOQUE = "scriptable:///run/" + encodeURIComponent(Script.name()) + "?abrir=1";

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

function txt(st, s, size, cor, bold, linhas = 1) {
  const t = st.addText(String(s));
  t.font = bold ? Font.boldRoundedSystemFont(size) : Font.semiboldRoundedSystemFont(size);
  t.textColor = cor; t.lineLimit = linhas; t.minimumScaleFactor = 0.7;
  return t;
}
function centro(st, s, size, cor, bold) {
  const r = st.addStack(); r.layoutHorizontally(); r.addSpacer();
  const t = txt(r, s, size, cor, bold); t.centerAlignText(); r.addSpacer(); return t;
}
function pilula(st, s, fundo, cor, borda) {
  const r = st.addStack(); r.layoutHorizontally();
  const p = r.addStack(); p.backgroundColor = fundo; p.cornerRadius = 11; p.setPadding(3, 9, 3, 9);
  if (borda) { p.borderWidth = 1.5; p.borderColor = borda; }
  txt(p, s, 12, cor, true); r.addSpacer();
}
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? "bom dia" : h < 18 ? "boa tarde" : "boa noite"; };
function frase(hs, feitos, tarefas) {
  const falta = hs.length - feitos;
  if (!falta && !tarefas.length) return "tudo feito hoje, que mulher 💃";
  if (!falta) return "hábitos todos feitos ✦ arrasou";
  if (falta === 1) return "falta só 1 hábito, você tá voando";
  if (!feitos) return new Date().getHours() < 12 ? "um passinho de cada vez ✦" : "bora começar pelo mais fácil?";
  return `faltam ${falta} hábitos, bora? ✦`;
}

async function monta() {
  const w = new ListWidget();
  w.backgroundColor = C.fundo; w.setPadding(12, 12, 12, 12); w.url = TOQUE;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  const d = await dados();
  if (!d) { txt(w, `${saudacao()}, isa ✦`, 17, C.tinta, true); w.addSpacer(4); txt(w, "não consegui carregar agora, já já eu tento de novo", 12, C.apagado, false, 2); return w; }

  const linha = w.addStack(); linha.layoutHorizontally(); linha.centerAlignContent();

  // ---- adesivo da leitura ----
  const L = d.leitura;
  const ad = linha.addStack(); ad.layoutVertically(); ad.size = new Size(112, 132);
  ad.backgroundColor = C.cereja; ad.cornerRadius = 20; ad.borderWidth = 3; ad.borderColor = C.branco;
  ad.setPadding(8, 6, 8, 6);
  ad.addSpacer();
  centro(ad, "📚", 20, C.branco, true);
  centro(ad, L.sequencia, 38, C.branco, true);
  if (!L.sequencia) centro(ad, "comece hoje ✦", 12, C.branco, true);
  else {
    centro(ad, L.sequencia === 1 ? "dia lendo" : "dias lendo", 12, C.branco, true);
    centro(ad, L.leuHoje ? "sem parar 🥹" : "bora ler hoje?", 12, C.branco, true);
  }
  ad.addSpacer();

  linha.addSpacer(12);

  // ---- saudação + rotina ----
  const hs = d.habitos || [], feitos = hs.filter(h => h.feito).length, ts = d.tarefas || [];
  const dir = linha.addStack(); dir.layoutVertically();
  txt(dir, `${saudacao()}, isa ✦`, 17, C.tinta, true);
  dir.addSpacer(1);
  txt(dir, frase(hs, feitos, ts), 12, C.apagado, true, 2);
  dir.addSpacer(8);

  const estrela = ts.filter(t => t.foco);
  const mostra = estrela.slice(0, MAX_PILULAS);
  const resto = ts.length - mostra.length + (hs.length - feitos);
  mostra.forEach((t, n) => { if (n) dir.addSpacer(5); pilula(dir, "★ " + t.titulo, C.creme, C.cremeTinta); });
  if (resto > 0) { if (mostra.length) dir.addSpacer(5); pilula(dir, `+ ${resto} coisinha${resto === 1 ? "" : "s"}`, C.card, C.rosa, C.linha); }
  dir.addSpacer();

  linha.addSpacer();
  return w;
}

if (!config.runsInWidget && args.queryParameters && args.queryParameters.abrir) {
  Safari.open(APP);
} else {
  const widget = await monta();
  if (config.runsInWidget) Script.setWidget(widget); else await widget.presentMedium();
}
Script.complete();
