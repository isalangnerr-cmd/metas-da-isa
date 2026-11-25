// localStorage protegido (modo privado do Safari pode lançar exceção).
export const ls = {
  get<T>(k: string, def: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* */ } },
  keys(prefix: string) { try { return Object.keys(localStorage).filter((k) => k.startsWith(prefix)); } catch { return []; } },
};
