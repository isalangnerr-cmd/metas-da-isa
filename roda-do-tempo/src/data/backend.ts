// Duas implementações da mesma interface:
//  - CloudBackend: Supabase (Postgres + RLS + Realtime + Storage privado)
//  - LocalBackend: tudo neste aparelho (localStorage + IndexedDB), sem compartilhamento
import { supabase } from './supabase';
import { idbGet, idbPut } from './idb';
import { uid } from '@/lib/format';

export type Row = Record<string, any> & { id: string; updated_at: string };
export type ChangeHandler = (table: string, row: Row) => void;

export interface Backend {
  mode: 'cloud' | 'local';
  fetchAll(table: string, familyId: string, since?: string): Promise<Row[]>;
  fetchOne(table: string, id: string): Promise<Row | null>;
  /** Grava linhas. Retorna as que o servidor aceitou (o servidor ignora versões mais antigas). */
  upsert(table: string, rows: Row[]): Promise<Row[]>;
  subscribe(familyId: string, tables: string[], cb: ChangeHandler): () => void;
  fetchBodies(ids: string[]): Promise<Record<string, string>>;
  upload(familyId: string, file: Blob, ext: string): Promise<string>;
  fileUrl(path: string): Promise<string | null>;
  removeFile(path: string): Promise<void>;
}

const BATCH = 200;

export class CloudBackend implements Backend {
  mode = 'cloud' as const;
  private urlCache = new Map<string, { url: string; exp: number }>();
  private get sb() { if (!supabase) throw new Error('Supabase não configurado'); return supabase; }

  async fetchAll(table: string, familyId: string, since?: string) {
    const out: Row[] = [];
    for (let from = 0; ; from += 1000) {
      let q = this.sb.from(table).select('*').eq('family_id', familyId).order('updated_at').range(from, from + 999);
      if (since) q = q.gt('updated_at', since);
      const { data, error } = await q;
      if (error) throw error;
      out.push(...(data as Row[]));
      if (!data || data.length < 1000) break;
    }
    return out;
  }
  async fetchOne(table: string, id: string) {
    const { data, error } = await this.sb.from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Row | null;
  }
  async upsert(table: string, rows: Row[]) {
    const out: Row[] = [];
    // Linhas marcadas com _op 'update' (ex.: marcar carta recebida como lida) vão por UPDATE,
    // pois o INSERT exigiria ser o remetente.
    for (const r of rows.filter((r) => r._op === 'update')) {
      const { _op, ...clean } = r;
      const { data, error } = await this.sb.from(table).update(clean).eq('id', r.id).select();
      if (error) throw error;
      out.push(...((data as Row[]) || []));
    }
    rows = rows.filter((r) => r._op !== 'update').map(({ _op, ...r }) => r as Row);
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      // avisos: se o servidor já criou o mesmo aviso (mesma pessoa + chave), ignora o nosso
      const opts = table === 'notifications' && chunk.every((r) => r.key && !r.read_at)
        ? { onConflict: 'user_id,key', ignoreDuplicates: true }
        : { onConflict: table === 'message_bodies' ? 'message_id' : 'id' };
      const { data, error } = await this.sb.from(table).upsert(chunk, opts).select();
      if (error) throw error;
      out.push(...((data as Row[]) || []));
    }
    return out;
  }
  subscribe(familyId: string, tables: string[], cb: ChangeHandler) {
    const ch = this.sb.channel(`family:${familyId}`);
    for (const t of tables) {
      ch.on('postgres_changes' as any, { event: '*', schema: 'public', table: t, filter: `family_id=eq.${familyId}` }, (p: any) => {
        if (p.new && p.new.id) cb(t, p.new as Row);
      });
    }
    ch.subscribe();
    return () => { this.sb.removeChannel(ch); };
  }
  async fetchBodies(ids: string[]) {
    if (!ids.length) return {};
    const { data, error } = await this.sb.from('message_bodies').select('message_id, body').in('message_id', ids);
    if (error) throw error;
    return Object.fromEntries((data || []).map((r: any) => [r.message_id, r.body]));
  }
  async upload(familyId: string, file: Blob, ext: string) {
    const path = `${familyId}/${uid()}.${ext}`;
    const { error } = await this.sb.storage.from('family-media').upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  }
  async fileUrl(path: string) {
    const c = this.urlCache.get(path);
    if (c && c.exp > Date.now()) return c.url;
    const { data, error } = await this.sb.storage.from('family-media').createSignedUrl(path, 3600);
    if (error || !data) return null;
    this.urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 3000e3 });
    return data.signedUrl;
  }
  async removeFile(path: string) { await this.sb.storage.from('family-media').remove([path]); }
}

export class LocalBackend implements Backend {
  mode = 'local' as const;
  private urls = new Map<string, string>();
  async fetchAll() { return []; }
  async fetchOne() { return null; }
  async upsert(_t: string, rows: Row[]) { return rows; }
  subscribe() { return () => {}; }
  async fetchBodies() { return {}; }
  async upload(_f: string, file: Blob, ext: string) { const path = `local/${uid()}.${ext}`; await idbPut(path, file); return path; }
  async fileUrl(path: string) {
    if (this.urls.has(path)) return this.urls.get(path)!;
    const b = await idbGet(path).catch(() => undefined);
    if (!b) return null;
    const u = URL.createObjectURL(b); this.urls.set(path, u); return u;
  }
  async removeFile() { /* mantém: pode ser referenciado por backup */ }
}
