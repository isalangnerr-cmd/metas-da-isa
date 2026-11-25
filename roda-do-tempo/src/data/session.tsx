import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, cloudConfigured } from './supabase';
import { CloudBackend, LocalBackend } from './backend';
import { Store, setStore, useTable } from './store';
import type { Family, FamilySettings, Member, UserPrefs } from './types';
import { DEFAULT_PREFS, applyTheme, mergePrefs } from './prefs';
import { ls } from '@/lib/storage';
import { uid } from '@/lib/format';

export interface SessionCtx {
  mode: 'cloud' | 'local';
  userId: string; email?: string | null;
  family: Family; store: Store;
  prefs: UserPrefs; setPrefs: (p: Partial<UserPrefs>) => void;
  updateFamily: (patch: { name?: string; settings?: Partial<FamilySettings> }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Modo neste aparelho: trocar quem está usando */
  setLocalMe?: (memberId: string) => void;
  localMeId?: string;
}
const Ctx = createContext<SessionCtx>(null as any);
export const useSession = () => useContext(Ctx);

/** O perfil da pessoa que está usando. */
export function useMe(): Member | undefined {
  const s = useSession();
  const members = useTable('members');
  if (s.mode === 'local') return members.find((m) => m.id === s.localMeId) || members.find((m) => m.kind === 'adult');
  return members.find((m) => m.user_id === s.userId);
}
export function useMembers() {
  const members = useTable('members');
  return useMemo(() => [...members].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)), [members]);
}

// ---------- Estado de inicialização ----------
export type BootState =
  | { k: 'loading' }
  | { k: 'auth' }
  | { k: 'nofamily'; userId: string; email?: string | null; mode: 'cloud' | 'local' }
  | { k: 'ready'; ctx: Omit<SessionCtx, 'prefs' | 'setPrefs'> & { initialPrefs: UserPrefs } }
  | { k: 'error'; message: string };

const LOCAL_FLAG = 'rdt:mode';
export const isLocalChosen = () => ls.get<string>(LOCAL_FLAG, cloudConfigured ? 'cloud' : 'local') === 'local';
export const chooseLocal = (v: boolean) => ls.set(LOCAL_FLAG, v ? 'local' : 'cloud');
const localUserId = () => { let id = ls.get<string>('rdt:local:user', ''); if (!id) { id = uid(); ls.set('rdt:local:user', id); } return id; };

export function useBoot() {
  const [state, setState] = useState<BootState>({ k: 'loading' });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let store: Store | null = null;
    let cancelled = false;
    const finish = async (family: Family, userId: string, email: string | null | undefined, mode: 'cloud' | 'local') => {
      store = new Store(mode === 'cloud' ? new CloudBackend() : new LocalBackend(), family.id, userId);
      setStore(store);
      await store.start();
      if (cancelled) return;
      let prefs = mergePrefs(ls.get(`rdt:prefs:${userId}`, null));
      if (mode === 'cloud' && navigator.onLine) {
        const { data } = await supabase!.from('user_prefs').select('prefs').eq('user_id', userId).maybeSingle();
        if (data?.prefs) prefs = mergePrefs({ ...data.prefs, gameStars: Math.max(prefs.gameStars, data.prefs.gameStars || 0) });
      }
      const signOut = async () => {
        store?.stop(); setStore(null);
        if (mode === 'cloud') await supabase!.auth.signOut(); else chooseLocal(false);
        reload();
      };
      const updateFamily: SessionCtx['updateFamily'] = async (patch) => {
        const next: Family = { ...family, ...('name' in patch ? { name: patch.name! } : {}), settings: { ...family.settings, ...(patch.settings || {}) }, updated_at: new Date().toISOString() };
        family = next;
        ls.set(`rdt:family:${mode}:${userId}`, next);
        if (mode === 'cloud') {
          const { error } = await supabase!.from('families').update({ name: next.name, settings: next.settings, updated_at: next.updated_at }).eq('id', next.id);
          if (error) throw error;
        }
        setState((s) => s.k === 'ready' ? { ...s, ctx: { ...s.ctx, family: next } } : s);
      };
      const localMeId = ls.get<string>('rdt:local:me', '');
      setState({ k: 'ready', ctx: {
        mode, userId, email, family, store, signOut, updateFamily, initialPrefs: prefs,
        localMeId: mode === 'local' ? localMeId : undefined,
        setLocalMe: mode === 'local' ? (id) => { ls.set('rdt:local:me', id); setState((s) => s.k === 'ready' ? { ...s, ctx: { ...s.ctx, localMeId: id } } : s); } : undefined,
      } });
    };

    const run = async () => {
      try {
        if (!cloudConfigured || isLocalChosen()) {
          if (!cloudConfigured && ls.get<string>(LOCAL_FLAG, '') !== 'local') { setState({ k: 'auth' }); return; }
          const userId = localUserId();
          const fam = ls.get<Family | null>(`rdt:family:local:${userId}`, null);
          if (!fam) { setState({ k: 'nofamily', userId, mode: 'local' }); return; }
          await finish(fam, userId, null, 'local');
          return;
        }
        const { data: { session } } = await supabase!.auth.getSession();
        if (!session) { setState({ k: 'auth' }); return; }
        const userId = session.user.id;
        const cacheKey = `rdt:family:cloud:${userId}`;
        let family = ls.get<Family | null>(cacheKey, null);
        if (navigator.onLine) {
          const { data, error } = await supabase!.from('family_users').select('family_id, families(*)').eq('user_id', userId).order('joined_at').limit(1);
          if (error && !family) throw error;
          if (!error) {
            family = (data?.[0] as any)?.families || null;
            if (family) ls.set(cacheKey, family); else ls.del(cacheKey);
          }
        }
        if (!family) { setState({ k: 'nofamily', userId, email: session.user.email, mode: 'cloud' }); return; }
        await finish(family, userId, session.user.email, 'cloud');
      } catch (e: any) {
        setState({ k: 'error', message: e?.message || String(e) });
      }
    };
    setState({ k: 'loading' });
    run();
    const sub = supabase?.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') { if (!store || ev === 'SIGNED_OUT') reload(); } });
    return () => { cancelled = true; store?.stop(); sub?.data.subscription.unsubscribe(); };
  }, [tick, reload]);

  return { state, reload };
}

/** Cria a família (nuvem: função segura no banco; local: neste aparelho). */
export async function createFamily(mode: 'cloud' | 'local', userId: string, name: string, myName: string, color: string, avatar: object) {
  if (mode === 'cloud') {
    const { data, error } = await supabase!.rpc('create_family', { p_name: name, p_member_name: myName, p_color: color, p_avatar: avatar });
    if (error) throw error;
    return data as string;
  }
  const now = new Date().toISOString();
  const fam: Family = { id: uid(), family_id: '', name, settings: { gamification: true }, created_at: now, updated_at: now };
  fam.family_id = fam.id;
  ls.set(`rdt:family:local:${userId}`, fam);
  const me: Member = { id: uid(), family_id: fam.id, user_id: userId, kind: 'adult', name: myName || 'Eu', color, avatar: avatar as any, position: 0, created_at: now, updated_at: now, info: [] };
  ls.set(`rdt:local:${fam.id}:cache`, { members: [me] });
  ls.set('rdt:local:me', me.id);
  return fam.id;
}

export function SessionProvider({ ctx, children }: { ctx: Omit<SessionCtx, 'prefs' | 'setPrefs'> & { initialPrefs: UserPrefs }; children: ReactNode }) {
  const [prefs, setPrefsState] = useState<UserPrefs>(ctx.initialPrefs || DEFAULT_PREFS);
  useEffect(() => { applyTheme(prefs); }, [prefs]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const f = () => applyTheme(prefs); mq?.addEventListener?.('change', f); return () => mq?.removeEventListener?.('change', f);
  }, [prefs]);
  const setPrefs = useCallback((p: Partial<UserPrefs>) => {
    setPrefsState((cur) => {
      const next = mergePrefs({ ...cur, ...p, notify: { ...cur.notify, ...(p.notify || {}) } });
      ls.set(`rdt:prefs:${ctx.userId}`, next);
      if (ctx.mode === 'cloud') {
        clearTimeout((setPrefs as any)._t);
        (setPrefs as any)._t = setTimeout(() => { supabase!.from('user_prefs').upsert({ user_id: ctx.userId, prefs: next, updated_at: new Date().toISOString() }).then(() => {}); }, 800);
      }
      return next;
    });
  }, [ctx.userId, ctx.mode]);
  const value = useMemo(() => ({ ...ctx, prefs, setPrefs }), [ctx, prefs, setPrefs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
