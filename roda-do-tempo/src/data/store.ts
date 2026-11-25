// Store central: cache local + fila de envio (outbox) + tempo real.
// - Toda escrita vai primeiro para o cache (a interface responde na hora) e para a fila.
// - A fila é enviada quando há conexão; se falhar, tenta de novo depois (funciona offline).
// - Conflitos: vence a versão com updated_at mais recente (o banco ignora versões antigas
//   via trigger). Quando a nossa perde, buscamos a versão do servidor e avisamos.
import { useSyncExternalStore } from 'react';
import type { Backend, Row } from './backend';
import { TABLES, type TableName, type Tables } from './types';
import { ls } from '@/lib/storage';
import { uid } from '@/lib/format';

type Listener = () => void;
interface OutboxEntry { table: string; row: Row; tries: number }

export interface SyncState { online: boolean; pending: number; syncing: boolean; lastSync?: string; error?: string; ready: boolean }

export class Store {
  data: { [K in TableName]: Map<string, Tables[K]> } = Object.fromEntries(TABLES.map((t) => [t, new Map()])) as any;
  bodies = new Map<string, string>();
  outbox: OutboxEntry[] = [];
  sync: SyncState = { online: typeof navigator === 'undefined' ? true : navigator.onLine, pending: 0, syncing: false, ready: false };
  onConflict?: (table: string, row: Row) => void;
  private listeners = new Set<Listener>();
  private versions: Record<string, number> = {};
  private persistTimer: any;
  private flushing = false;
  private unsub?: () => void;
  private retryTimer: any;

  constructor(public backend: Backend, public familyId: string, public userId: string) {}

  private get key() { return `rdt:${this.backend.mode}:${this.familyId}`; }

  // ---------- assinatura (React) ----------
  subscribe = (l: Listener) => { this.listeners.add(l); return () => this.listeners.delete(l); };
  version(t: string) { return this.versions[t] || 0; }
  private emit(tables: string[]) {
    for (const t of tables) this.versions[t] = (this.versions[t] || 0) + 1;
    this.versions.__sync = (this.versions.__sync || 0) + 1;
    this.listeners.forEach((l) => l());
  }
  private schedulePersist() {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persist(), 250);
  }
  persist() {
    const snap: Record<string, Row[]> = {};
    for (const t of TABLES) snap[t] = [...this.data[t].values()] as any;
    ls.set(this.key + ':cache', snap);
    ls.set(this.key + ':outbox', this.outbox);
    ls.set(this.key + ':bodies', Object.fromEntries(this.bodies));
    ls.set(this.key + ':lastSync', this.sync.lastSync || null);
  }

  // ---------- ciclo de vida ----------
  async start() {
    const snap = ls.get<Record<string, Row[]>>(this.key + ':cache', {});
    for (const t of TABLES) for (const r of snap[t] || []) this.data[t].set(r.id, r as any);
    this.outbox = ls.get<OutboxEntry[]>(this.key + ':outbox', []);
    this.bodies = new Map(Object.entries(ls.get<Record<string, string>>(this.key + ':bodies', {})));
    this.sync.lastSync = ls.get<string | null>(this.key + ':lastSync', null) || undefined;
    this.sync.pending = this.outbox.length;
    this.emit(TABLES);
    if (this.backend.mode === 'local') { this.sync.ready = true; this.emit([]); return; }
    window.addEventListener('online', this.goOnline);
    window.addEventListener('offline', this.goOffline);
    document.addEventListener('visibilitychange', this.onVisible);
    this.unsub = this.backend.subscribe(this.familyId, [...TABLES], (t, r) => this.applyRemote(t, r));
    await this.pull().catch((e) => { this.sync.error = String(e?.message || e); });
    this.sync.ready = true;
    this.emit([]);
    this.flush();
  }
  stop() {
    this.unsub?.();
    window.removeEventListener('online', this.goOnline);
    window.removeEventListener('offline', this.goOffline);
    document.removeEventListener('visibilitychange', this.onVisible);
    clearTimeout(this.retryTimer);
    this.persist();
  }
  private goOnline = () => { this.sync.online = true; this.emit([]); this.flush(); this.pull().catch(() => {}); };
  private goOffline = () => { this.sync.online = false; this.emit([]); };
  private onVisible = () => { if (document.visibilityState === 'visible' && this.sync.online) { this.pull().catch(() => {}); this.flush(); } };

  /** Busca do servidor o que mudou desde a última sincronização. */
  async pull() {
    if (this.backend.mode === 'local') return;
    this.sync.syncing = true; this.emit([]);
    const started = new Date(Date.now() - 60_000).toISOString(); // margem para relógios
    const since = this.sync.lastSync;
    try {
      const res = await Promise.all(TABLES.map((t) => this.backend.fetchAll(t, this.familyId, since).then((rows) => [t, rows] as const)));
      const changed: string[] = [];
      for (const [t, rows] of res) {
        for (const r of rows) if (this.mergeRow(t, r)) changed.push(t);
      }
      this.sync.lastSync = started; this.sync.error = undefined;
      this.emit([...new Set(changed)]);
      this.schedulePersist();
    } finally { this.sync.syncing = false; this.emit([]); }
  }

  private pendingIds() { return new Set(this.outbox.map((o) => o.table + ':' + o.row.id)); }

  /** Aplica uma linha vinda do servidor se for mais nova que a nossa e não tivermos edição pendente. */
  private mergeRow(table: string, r: Row, force = false) {
    const map = (this.data as any)[table] as Map<string, Row> | undefined;
    if (!map) return false;
    const cur = map.get(r.id);
    if (!force && this.pendingIds().has(table + ':' + r.id)) return false;
    if (!force && cur && cur.updated_at > r.updated_at) return false;
    if (table === 'messages' && cur?.body && !r.body) r = { ...r, body: cur.body };
    map.set(r.id, r);
    return true;
  }
  private applyRemote(table: string, r: Row) {
    if (this.mergeRow(table, r)) { this.emit([table]); this.schedulePersist(); }
  }

  // ---------- leitura ----------
  all<K extends TableName>(t: K): Tables[K][] {
    return [...this.data[t].values()].filter((r: any) => !r.deleted);
  }
  get<K extends TableName>(t: K, id?: string | null): Tables[K] | undefined {
    if (!id) return undefined;
    const r = this.data[t].get(id) as any;
    return r && !r.deleted ? r : undefined;
  }

  // ---------- escrita ----------
  stamp() { return new Date().toISOString(); }
  save<K extends TableName>(t: K, patch: Partial<Tables[K]> & { id?: string }, opts: { update?: boolean } = {}): Tables[K] {
    const id = patch.id || uid();
    const cur = this.data[t].get(id) as any;
    const now = this.stamp();
    const row = {
      ...(cur || { id, family_id: this.familyId, created_at: now, created_by: this.userId }),
      ...patch, id, family_id: this.familyId,
      updated_at: cur && cur.updated_at >= now ? new Date(Date.parse(cur.updated_at) + 1).toISOString() : now,
    } as any;
    let body: string | undefined;
    if (t === 'messages' && this.backend.mode === 'cloud' && 'body' in row) { body = row.body ?? undefined; }
    this.data[t].set(id, row);
    const wire = { ...row };
    if (t === 'messages' && this.backend.mode === 'cloud') delete wire.body;
    if (opts.update) wire._op = 'update';
    this.enqueue(t, wire);
    if (body !== undefined && (patch as any).body !== undefined) {
      this.bodies.set(id, body);
      this.enqueue('message_bodies', { id, message_id: id, family_id: this.familyId, body, updated_at: row.updated_at } as any);
    }
    this.emit([t]);
    this.schedulePersist();
    return row;
  }
  remove<K extends TableName>(t: K, id: string) {
    const cur = this.data[t].get(id);
    if (!cur) return;
    this.save(t, { id, deleted: true } as any);
  }
  saveMany<K extends TableName>(t: K, rows: (Partial<Tables[K]> & { id?: string })[]) { return rows.map((r) => this.save(t, r)); }

  private enqueue(table: string, row: Row) {
    const i = this.outbox.findIndex((o) => o.table === table && o.row.id === row.id);
    if (i >= 0) this.outbox[i] = { table, row, tries: 0 }; else this.outbox.push({ table, row, tries: 0 });
    this.sync.pending = this.outbox.length;
    if (this.backend.mode === 'local') { this.outbox = []; this.sync.pending = 0; return; }
    queueMicrotask(() => this.flush());
  }

  /** Envia a fila. Mantém o que falhar para tentar de novo. */
  async flush() {
    if (this.flushing || this.backend.mode === 'local' || !this.sync.online || !this.outbox.length) return;
    this.flushing = true; this.sync.syncing = true; this.emit([]);
    try {
      while (this.outbox.length) {
        const batch = this.outbox.slice(0, 200);
        const order = ['members', 'adventures', 'wishes', 'lists', 'tasks', 'events', 'messages', 'message_bodies'];
        const byTable = new Map<string, OutboxEntry[]>();
        for (const e of batch) { if (!byTable.has(e.table)) byTable.set(e.table, []); byTable.get(e.table)!.push(e); }
        const tables = [...byTable.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
        for (const t of tables) {
          const entries = byTable.get(t)!;
          const accepted = await this.backend.upsert(t, entries.map((e) => e.row));
          const ok = new Set(accepted.map((r) => r.id ?? r.message_id));
          // remove da fila (só se não houve nova edição enquanto enviávamos)
          this.outbox = this.outbox.filter((o) => !(o.table === t && entries.some((e) => e.row === o.row)));
          for (const e of entries) {
            if (!ok.has(e.row.id)) {
              // o servidor tinha uma versão mais nova: buscamos e avisamos
              if (t !== 'message_bodies') {
                const fresh = await this.backend.fetchOne(t, e.row.id).catch(() => null);
                if (fresh) { this.mergeRow(t, fresh, true); if (t !== 'notifications') this.onConflict?.(t, fresh); this.emit([t]); }
                else if (t === 'notifications') { (this.data as any)[t].delete(e.row.id); this.emit([t]); } // o servidor já tinha esse aviso
              }
            } else if (t !== 'message_bodies') {
              const srv = accepted.find((r) => r.id === e.row.id);
              if (srv) this.mergeRow(t, srv);
            }
          }
        }
        this.sync.pending = this.outbox.length;
      }
      this.sync.error = undefined;
    } catch (e: any) {
      this.sync.error = String(e?.message || e);
      for (const o of this.outbox) o.tries++;
      clearTimeout(this.retryTimer);
      const wait = Math.min(60_000, 2000 * 2 ** Math.min(5, this.outbox[0]?.tries || 1));
      this.retryTimer = setTimeout(() => this.flush(), wait);
    } finally {
      this.flushing = false; this.sync.syncing = false; this.sync.pending = this.outbox.length;
      this.emit([]); this.schedulePersist();
    }
  }

  async loadBodies(ids: string[]) {
    if (this.backend.mode === 'local') return;
    const need = ids.filter((id) => !this.bodies.has(id));
    if (!need.length) return;
    const got = await this.backend.fetchBodies(need);
    for (const [k, v] of Object.entries(got)) this.bodies.set(k, v);
    this.emit(['messages']); this.schedulePersist();
  }
  body(id: string) {
    if (this.backend.mode === 'local') return (this.data.messages.get(id) as any)?.body ?? null;
    return this.bodies.get(id) ?? null;
  }

  exportAll() {
    const out: Record<string, unknown> = {};
    for (const t of TABLES) out[t] = this.all(t);
    out.message_bodies = Object.fromEntries(this.bodies);
    return out;
  }
  wipeLocal() { for (const k of ls.keys(this.key)) ls.del(k); }
}

// ---------- hooks ----------
let current: Store | null = null;
export const setStore = (s: Store | null) => { current = s; };
export const getStore = () => { if (!current) throw new Error('store não iniciado'); return current; };

export function useTable<K extends TableName>(t: K): Tables[K][] {
  const s = getStore();
  const v = useSyncExternalStore(s.subscribe, () => s.version(t));
  return useMemoTable(s, t, v);
}
const memo = new WeakMap<Store, Record<string, { v: number; rows: any[] }>>();
function useMemoTable<K extends TableName>(s: Store, t: K, v: number): Tables[K][] {
  let m = memo.get(s); if (!m) { m = {}; memo.set(s, m); }
  if (!m[t] || m[t].v !== v) m[t] = { v, rows: s.all(t) };
  return m[t].rows;
}
export function useSync(): SyncState {
  const s = getStore();
  useSyncExternalStore(s.subscribe, () => s.version('__sync'));
  return s.sync;
}
