// IndexedDB mínimo para arquivos (fotos) no modo "neste aparelho" e cache de miniaturas.
const DB = 'roda-do-tempo';
let dbp: Promise<IDBDatabase> | null = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
export async function idbPut(key: string, val: Blob) {
  const d = await db();
  await new Promise<void>((res, rej) => { const t = d.transaction('files', 'readwrite'); t.objectStore('files').put(val, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
export async function idbGet(key: string): Promise<Blob | undefined> {
  const d = await db();
  return new Promise((res, rej) => { const r = d.transaction('files').objectStore('files').get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function idbDel(key: string) {
  const d = await db();
  await new Promise<void>((res) => { const t = d.transaction('files', 'readwrite'); t.objectStore('files').delete(key); t.oncomplete = () => res(); t.onerror = () => res(); });
}
export async function idbClear() {
  const d = await db();
  await new Promise<void>((res) => { const t = d.transaction('files', 'readwrite'); t.objectStore('files').clear(); t.oncomplete = () => res(); t.onerror = () => res(); });
}
