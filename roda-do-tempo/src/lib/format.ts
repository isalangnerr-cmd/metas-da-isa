const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (n?: number | null) => (n == null || isNaN(n) ? '' : brl.format(n));
/** Aceita "12,50", "1.234,56", "12.5" */
export function parseMoney(s: string): number | null {
  const t = s.trim().replace(/[R$\s]/g, '');
  if (!t) return null;
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(norm);
  return isFinite(n) ? Math.round(n * 100) / 100 : null;
}
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const uid = () => (crypto as any).randomUUID ? crypto.randomUUID() :
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
export const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
export function normalize(s: string) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
