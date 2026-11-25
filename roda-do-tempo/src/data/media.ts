import { useEffect, useState } from 'react';
import { getStore } from './store';

/** Reduz imagens grandes antes de enviar (economiza dados e espaço). */
export async function compressImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', quality));
  } catch { return file; }
}

export async function uploadFileWithType(file: File): Promise<{ path: string; type: string }> {
  const s = getStore();
  if (file.size > 15 * 1024 * 1024) throw new Error('Arquivo maior que 15 MB');
  const isImg = file.type.startsWith('image/');
  const blob = isImg ? await compressImage(file, 2000, 0.85) : file;
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase();
  return { path: await s.backend.upload(s.familyId, blob, ext), type: blob.type || file.type };
}

export async function uploadFile(file: File): Promise<string> {
  const s = getStore();
  if (file.size > 15 * 1024 * 1024) throw new Error('Arquivo maior que 15 MB');
  const isImg = file.type.startsWith('image/');
  const blob = isImg ? await compressImage(file) : file;
  const ext = isImg ? (blob.type === 'image/jpeg' ? 'jpg' : file.name.split('.').pop() || 'png') : (file.name.split('.').pop() || 'bin');
  return s.backend.upload(s.familyId, blob, ext.toLowerCase());
}

export function usePhoto(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    if (/^https?:|^data:/.test(path)) { setUrl(path); return; }
    getStore().backend.fileUrl(path).then((u) => { if (alive) setUrl(u); }).catch(() => {});
    return () => { alive = false; };
  }, [path]);
  return url;
}
