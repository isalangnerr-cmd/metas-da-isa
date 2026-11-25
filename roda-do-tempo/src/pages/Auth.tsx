import { useEffect, useState } from 'react';
import { supabase, cloudConfigured } from '@/data/supabase';
import { chooseLocal, createFamily } from '@/data/session';
import { Logo } from '@/components/Logo';
import { Icon, Field, useUI } from '@/components/ui';
import { Sprite } from '@/components/Avatar';
import { DEFAULT_AVATARS } from '@/game/sprites';
import { COLORS } from '@/lib/domain';
import { ls } from '@/lib/storage';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-4 safe-t safe-b">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-4"><Logo /></div>
        <div className="flex justify-center items-end gap-2 mb-4" aria-hidden>
          <Sprite kind="adult" avatar={DEFAULT_AVATARS.a} size={44} /><Sprite kind="adult" avatar={DEFAULT_AVATARS.b} size={44} />
          <Sprite kind="child" avatar={DEFAULT_AVATARS.child} size={30} /><Sprite kind="pet" avatar={DEFAULT_AVATARS.pet} size={22} />
        </div>
        <div className="px-box p-5 anim-rise">{children}</div>
        <p className="text-center hud text-[10px] text-muted mt-4">Nossa aventura / 03 · Press start</p>
      </div>
    </div>
  );
}

const errPt = (m: string) => {
  if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(m)) return 'Este e-mail já tem conta. Tente entrar.';
  if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/Email not confirmed/i.test(m)) return 'Confirme o e-mail pelo link que enviamos.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  if (/fetch/i.test(m)) return 'Sem conexão com o servidor.';
  return m;
};

export function AuthScreen({ onDone }: { onDone: () => void }) {
  const [tab, setTab] = useState<'login' | 'signup' | 'magic'>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const redirect = location.origin + location.pathname;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setMsg(null);
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error; chooseLocal(false); onDone();
      } else if (tab === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password: pass, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        chooseLocal(false);
        if (data.session) onDone(); else setMsg({ t: 'Conta criada! Abra o e-mail de confirmação e volte aqui.' });
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
        if (error) throw error; chooseLocal(false);
        setMsg({ t: 'Enviamos um link de acesso para o seu e-mail.' });
      }
    } catch (e: any) { setMsg({ t: errPt(e.message || String(e)), err: true }); }
    setBusy(false);
  };
  const forgot = async () => {
    if (!supabase || !email) { setMsg({ t: 'Digite seu e-mail primeiro.', err: true }); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect });
    setMsg(error ? { t: errPt(error.message), err: true } : { t: 'Enviamos um link para redefinir a senha.' });
  };

  return (
    <Frame>
      <h1 className="h-pixel text-2xl text-center">Press Start</h1>
      <p className="text-center text-sm text-muted mb-4">Uma aventura em família.</p>
      {cloudConfigured ? (
        <>
          <div className="flex gap-1 p-1 px-inset mb-4" role="tablist">
            {([['login', 'Entrar'], ['signup', 'Criar conta'], ['magic', 'Link mágico']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={`tab flex-1 ${tab === k ? 'tab-on' : ''}`} onClick={() => { setTab(k); setMsg(null); }}>{l}</button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            <Field label="E-mail"><input className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            {tab !== 'magic' && <Field label="Senha"><input className="field" type="password" required minLength={6} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} value={pass} onChange={(e) => setPass(e.target.value)} /></Field>}
            {msg && <p className={`text-sm font-semibold ${msg.err ? 'text-[#A8432E]' : 'text-moss'}`} role="alert">{msg.t}</p>}
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Aguarde…' : tab === 'login' ? 'Entrar' : tab === 'signup' ? 'Criar conta' : 'Enviar link'}</button>
            {tab === 'login' && <button type="button" className="text-sm link w-full text-center" onClick={forgot}>Esqueci a senha</button>}
          </form>
          <div className="my-4 flex items-center gap-2 text-muted"><span className="flex-1 border-t-2 border-dashed border-line/20" /><span className="hud text-[10px]">ou</span><span className="flex-1 border-t-2 border-dashed border-line/20" /></div>
        </>
      ) : (
        <div className="px-inset p-3 text-sm mb-4">
          <b>Modo neste aparelho.</b> O servidor (Supabase) ainda não foi configurado, então os dados ficam salvos só neste navegador e não são compartilhados.
          Veja o <code>README</code> para ativar contas e sincronização.
        </div>
      )}
      <button className="btn-ghost w-full" onClick={() => { chooseLocal(true); onDone(); }}>
        <Icon name="home" size={16} /> Usar só neste aparelho
      </button>
      <p className="text-xs text-muted mt-2 text-center">Sem conta: nada sai deste aparelho e nada é compartilhado.</p>
    </Frame>
  );
}

export function FamilySetup({ mode, userId, email, onDone }: { mode: 'cloud' | 'local'; userId: string; email?: string | null; onDone: () => void }) {
  const ui = useUI();
  const [invite, setInvite] = useState<string>(ls.get('rdt:invite', ''));
  const [info, setInfo] = useState<null | { family_name: string; member_name: string | null; expired: boolean; used: boolean }>(null);
  const [famName, setFamName] = useState('Nossa família');
  const [myName, setMyName] = useState(email ? email.split('@')[0] : '');
  const [color, setColor] = useState(COLORS[1]);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'create' | 'join'>(invite ? 'join' : 'create');

  useEffect(() => {
    if (mode !== 'cloud' || !invite || invite.length < 8) { setInfo(null); return; }
    supabase!.rpc('invite_info', { p_code: invite.trim() }).then(({ data }) => setInfo((data as any)?.[0] || null));
  }, [invite, mode]);

  const create = async () => {
    setBusy(true);
    try { await createFamily(mode, userId, famName.trim() || 'Nossa família', myName.trim() || 'Eu', color, { ...DEFAULT_AVATARS.a, shirt: color }); onDone(); }
    catch (e: any) { ui.toast(e.message || 'Não foi possível criar a família', 'err'); }
    setBusy(false);
  };
  const join = async () => {
    setBusy(true);
    const { error } = await supabase!.rpc('accept_invite', { p_code: invite.trim(), p_name: myName.trim() || null });
    setBusy(false);
    if (error) { ui.toast(error.message, 'err'); return; }
    ls.del('rdt:invite'); location.hash = '#/'; onDone();
  };

  return (
    <Frame>
      <h1 className="h-pixel text-2xl text-center mb-1">Novo jogo</h1>
      <p className="text-center text-sm text-muted mb-4">{mode === 'local' ? 'Vamos criar sua família neste aparelho.' : 'Crie o grupo da família ou entre com um convite.'}</p>
      {mode === 'cloud' && (
        <div className="flex gap-1 p-1 px-inset mb-4">
          <button className={`tab flex-1 ${view === 'create' ? 'tab-on' : ''}`} onClick={() => setView('create')}>Criar família</button>
          <button className={`tab flex-1 ${view === 'join' ? 'tab-on' : ''}`} onClick={() => setView('join')}>Tenho convite</button>
        </div>
      )}
      <div className="space-y-3">
        <Field label="Seu nome ou apelido"><input className="field" value={myName} onChange={(e) => setMyName(e.target.value)} maxLength={60} /></Field>
        {view === 'create' ? (
          <>
            <Field label="Nome da família"><input className="field" value={famName} onChange={(e) => setFamName(e.target.value)} maxLength={80} /></Field>
            <div><span className="label">Sua cor</span>
              <div className="flex gap-2 flex-wrap">{COLORS.map((c) => <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} className={`w-9 h-9 rounded-[4px] border-[3px] ${c === color ? 'border-line scale-110' : 'border-line/30'}`} style={{ background: c }} />)}</div>
            </div>
            <button className="btn-primary w-full" disabled={busy || !myName.trim()} onClick={create}>{busy ? 'Criando…' : 'Começar aventura'}</button>
          </>
        ) : (
          <>
            <Field label="Código do convite" hint="Está no final do link que você recebeu."><input className="field font-mono" value={invite} onChange={(e) => setInvite(e.target.value.replace(/.*convite\//, '').trim())} /></Field>
            {info && <div className="px-inset p-3 text-sm">{info.expired ? 'Este convite expirou.' : info.used ? 'Este convite já foi usado.' : <>Convite para <b>{info.family_name}</b>{info.member_name ? <> como <b>{info.member_name}</b></> : null}.</>}</div>}
            <button className="btn-primary w-full" disabled={busy || !invite || (info ? info.expired || info.used : false)} onClick={join}>{busy ? 'Entrando…' : 'Entrar na família'}</button>
          </>
        )}
        {mode === 'cloud' && <button className="text-sm link w-full text-center" onClick={() => supabase!.auth.signOut().then(onDone)}>Sair da conta ({email})</button>}
      </div>
    </Frame>
  );
}
