import { HashRouter } from 'react-router-dom';
import { useEffect } from 'react';
import { useBoot, SessionProvider } from '@/data/session';
import { UIProvider, Spinner } from '@/components/ui';
import { AuthScreen, FamilySetup } from '@/pages/Auth';
import { App } from '@/App';
import { applyTheme, mergePrefs } from '@/data/prefs';
import { Logo } from '@/components/Logo';
import { ls } from '@/lib/storage';

export function Root() {
  const { state, reload } = useBoot();
  useEffect(() => { applyTheme(mergePrefs(ls.get('rdt:prefs:last', null))); }, []);
  // guarda código de convite vindo do link (#/convite/CODIGO) para depois do login
  useEffect(() => {
    const m = location.hash.match(/#\/convite\/([a-f0-9]{8,64})/i);
    if (m) ls.set('rdt:invite', m[1]);
  }, []);

  return (
    <UIProvider sounds={state.k === 'ready' ? state.ctx.initialPrefs.sounds : false}>
      {state.k === 'loading' && <div className="min-h-full grid place-items-center"><div className="text-center"><Logo /><Spinner label="Press start" /></div></div>}
      {state.k === 'error' && (
        <div className="min-h-full grid place-items-center p-6"><div className="px-box p-6 max-w-md text-center">
          <div className="h-pixel text-2xl mb-2">Ops, travou a fase</div>
          <p className="text-sm text-muted mb-4">{state.message}</p>
          <button className="btn-primary" onClick={reload}>Tentar de novo</button>
        </div></div>
      )}
      {state.k === 'auth' && <AuthScreen onDone={reload} />}
      {state.k === 'nofamily' && <FamilySetup mode={state.mode} userId={state.userId} email={state.email} onDone={reload} />}
      {state.k === 'ready' && (
        <SessionProvider ctx={state.ctx}>
          <HashRouter><App /></HashRouter>
        </SessionProvider>
      )}
    </UIProvider>
  );
}
