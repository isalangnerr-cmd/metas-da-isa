import { supabase } from '@/data/supabase';

export function registerSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

export const notifSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const pushSupported = () => notifSupported() && 'serviceWorker' in navigator && 'PushManager' in window;

/** Mostra uma notificação do sistema (quando permitido). */
export async function systemNotify(title: string, body: string, url = './') {
  if (!notifSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png', data: { url } });
    else new Notification(title, { body, icon: './icons/icon-192.png' });
  } catch { /* ignora */ }
}

function b64ToU8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Ativa push de verdade (precisa da chave VAPID e da Edge Function publicada). */
export async function enablePush(): Promise<'ok' | 'denied' | 'unsupported' | 'no-key' | 'error'> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!key || !supabase) return 'no-key';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) }));
    const j = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: j.endpoint, keys: j.keys });
    return error ? 'error' : 'ok';
  } catch { return 'error'; }
}
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
  } catch { /* */ }
}
