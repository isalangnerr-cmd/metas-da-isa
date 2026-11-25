import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getStore, useTable } from '@/data/store';
import type { ListItem, ShopList } from '@/data/types';
import { Empty, Field, Icon, Modal, PageHeader, SegBar, useUI } from '@/components/ui';
import { AssigneeSelect, ImagePicker, Photo, safeUrl } from '@/components/forms';
import { COLORS, LIST_CATS, LIST_ICONS, LIST_TEMPLATES, catOf } from '@/lib/domain';
import { money, parseMoney } from '@/lib/format';
import { useMembers, useMe } from '@/data/session';

export function listStats(items: ListItem[]) {
  const done = items.filter((i) => i.done).length;
  const priced = items.filter((i) => i.price != null);
  const sum = (xs: ListItem[]) => xs.reduce((a, i) => a + (i.price || 0) * (i.qty && i.qty > 0 ? i.qty : 1), 0);
  return { done, total: items.length, pct: items.length ? done / items.length : 0, priced: priced.length, sumAll: sum(priced), sumOpen: sum(priced.filter((i) => !i.done)), sumDone: sum(priced.filter((i) => i.done)) };
}

export function Inventory() {
  const lists = useTable('lists');
  const items = useTable('list_items');
  const [editing, setEditing] = useState<Partial<ShopList> | null>(null);
  const [tpl, setTpl] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const nav = useNavigate();
  const ui = useUI();
  const visible = lists.filter((l) => !!l.archived === showArchived).sort((a, b) => a.position - b.position || b.updated_at.localeCompare(a.updated_at));

  const fromTemplate = (i: number) => {
    const t = LIST_TEMPLATES[i]; const st = getStore();
    const l = st.save('lists', { name: t.name, icon: t.icon, color: t.color, category: t.category, owners: ['family'], position: lists.length });
    st.saveMany('list_items', t.items.map((name, k) => ({ list_id: l.id, name, done: false, position: k })));
    setTpl(false); ui.toast('Lista criada a partir do modelo'); nav(`/inventario/${l.id}`);
  };

  return (
    <div>
      <PageHeader world="02 · Inventário" title="Tudo anotado" subtitle="Listas compartilhadas em tempo real" icon="bag"
        actions={<><button className="btn-ghost" onClick={() => setTpl(true)}><Icon name="copy" size={14} />Modelos</button><button className="btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={14} />Nova lista</button></>} />
      {visible.length === 0 ? (
        <div className="px-box"><Empty icon="bag" title={showArchived ? 'Nenhuma lista arquivada' : 'Inventário vazio'} text="Crie uma lista do zero ou comece por um modelo (supermercado, farmácia, mala…)." action={!showArchived && <button className="btn-primary" onClick={() => setTpl(true)}>Ver modelos</button>} /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((l) => {
            const its = items.filter((i) => i.list_id === l.id); const st = listStats(its);
            return (
              <Link key={l.id} to={`/inventario/${l.id}`} className="px-box p-4 block hover:-translate-y-[2px] transition-transform">
                <div className="flex items-center gap-3 mb-3">
                  <span className="grid place-items-center w-11 h-11 rounded-[4px] border-[3px] border-line text-[rgb(58_42_30)]" style={{ background: l.color }}><Icon name={l.icon as any} size={22} /></span>
                  <div className="min-w-0 flex-1"><div className="h-pixel text-lg leading-tight truncate">{l.name}</div><div className="text-xs text-muted">{catOf(LIST_CATS, l.category).label}</div></div>
                </div>
                <SegBar value={st.pct} label={`Progresso de ${l.name}`} />
                <div className="flex justify-between mt-2 text-xs text-muted"><span>{st.done}/{st.total} itens</span>{st.priced > 0 && <span className="font-semibold text-ink">{money(st.sumOpen)} a comprar</span>}</div>
              </Link>
            );
          })}
        </div>
      )}
      <button className="mt-4 text-sm link" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Ver listas ativas' : 'Ver arquivadas'}</button>
      {editing && <ListEditor list={editing} onClose={() => setEditing(null)} onCreated={(id) => nav(`/inventario/${id}`)} />}
      <Modal open={tpl} onClose={() => setTpl(false)} title="Modelos de lista">
        <div className="grid sm:grid-cols-2 gap-2">
          {LIST_TEMPLATES.map((t, i) => (
            <button key={t.name} className="px-box-flat p-3 flex items-center gap-3 text-left hover:bg-panel2" onClick={() => fromTemplate(i)}>
              <span className="grid place-items-center w-9 h-9 rounded-[4px] border-2 border-line text-[rgb(58_42_30)]" style={{ background: t.color }}><Icon name={t.icon} size={18} /></span>
              <span><span className="block font-semibold text-sm">{t.name}</span><span className="text-xs text-muted">{t.items.length ? `${t.items.length} itens sugeridos` : 'Lista em branco'}</span></span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function ListEditor({ list, onClose, onCreated }: { list: Partial<ShopList>; onClose: () => void; onCreated?: (id: string) => void }) {
  const ui = useUI();
  const advs = useTable('adventures');
  const [l, setL] = useState<Partial<ShopList>>({ name: '', icon: 'cart', color: COLORS[0], category: 'compras', owners: ['family'], ...list });
  const set = (p: Partial<ShopList>) => setL((x) => ({ ...x, ...p }));
  const save = () => {
    if (!l.name?.trim()) { ui.toast('Dê um nome para a lista', 'err'); return; }
    const r = getStore().save('lists', { ...l, name: l.name.trim(), position: l.position ?? 0 });
    onClose(); if (!list.id) onCreated?.(r.id);
  };
  return (
    <Modal open onClose={onClose} title={list.id ? 'Editar lista' : 'Nova lista'} footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}>
      <div className="space-y-4">
        <Field label="Nome"><input className="field" value={l.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} placeholder="Ex.: Compras do supermercado" /></Field>
        <Field label="Descrição (opcional)"><input className="field" value={l.description || ''} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Categoria"><select className="field" value={l.category} onChange={(e) => set({ category: e.target.value })}>{LIST_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
        <div><span className="label">Ícone</span><div className="flex flex-wrap gap-2">{LIST_ICONS.map((ic) => <button key={ic} type="button" aria-label={ic} aria-pressed={l.icon === ic} onClick={() => set({ icon: ic })} className={`grid place-items-center w-10 h-10 rounded-[4px] border-2 ${l.icon === ic ? 'border-line bg-sun' : 'border-line/30'}`}><Icon name={ic} size={18} /></button>)}</div></div>
        <div><span className="label">Cor</span><div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={l.color === c} onClick={() => set({ color: c })} className={`w-9 h-9 rounded-[4px] border-[3px] ${l.color === c ? 'border-line' : 'border-line/20'}`} style={{ background: c }} />)}</div></div>
        <div><span className="label">Responsáveis</span><AssigneeSelect value={l.owners?.[0] || 'family'} onChange={(v) => set({ owners: [v] })} /></div>
        <Field label="Aventura relacionada"><select className="field" value={l.adventure_id || ''} onChange={(e) => set({ adventure_id: e.target.value || null })}><option value="">Nenhuma</option>{advs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      </div>
    </Modal>
  );
}

export function ListDetail() {
  const { id } = useParams();
  const lists = useTable('lists');
  const all = useTable('list_items');
  const l = lists.find((x) => x.id === id);
  const items = useMemo(() => all.filter((i) => i.list_id === id).sort((a, b) => a.position - b.position), [all, id]);
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<ListItem | null>(null);
  const [editList, setEditList] = useState(false);
  const ui = useUI();
  const nav = useNavigate();
  const st = getStore();
  const members = useMembers(); const me = useMe();
  if (!l) return <div className="px-box"><Empty icon="bag" title="Lista não encontrada" action={<Link className="btn-ghost" to="/inventario">Voltar</Link>} /></div>;
  const open = items.filter((i) => !i.done); const done = items.filter((i) => i.done);
  const stats = listStats(items);
  const isShopping = ['compras', 'filha', 'pet', 'casa', 'presentes'].includes(l.category) || stats.priced > 0;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    // aceita "2 leite" ou "leite x2"
    let n = name.trim(); if (!n) return;
    let qty: number | null = null;
    const m1 = n.match(/^(\d+[.,]?\d*)\s*(?:x\s+)?(.+)$/i), m2 = n.match(/^(.+?)\s*x\s*(\d+[.,]?\d*)$/i);
    if (m1) { qty = parseFloat(m1[1].replace(',', '.')); n = m1[2]; } else if (m2) { qty = parseFloat(m2[2].replace(',', '.')); n = m2[1]; }
    const minPos = open.length ? Math.min(...open.map((i) => i.position)) : 0;
    st.save('list_items', { list_id: l.id, name: n, qty, done: false, position: minPos - 1 });
    setName('');
  };
  const toggle = (i: ListItem) => st.save('list_items', { id: i.id, done: !i.done, done_at: i.done ? null : new Date().toISOString() });
  const move = (i: ListItem, dir: -1 | 1) => {
    const arr = open; const k = arr.findIndex((x) => x.id === i.id); const j = k + dir;
    if (j < 0 || j >= arr.length) return;
    const other = arr[j];
    st.save('list_items', { id: i.id, position: other.position }); st.save('list_items', { id: other.id, position: i.position === other.position ? other.position - dir : i.position });
  };
  const clearDone = async () => {
    if (!(await ui.confirm({ title: 'Limpar itens concluídos?', text: `${done.length} itens serão removidos da lista.`, ok: 'Limpar', danger: true }))) return;
    done.forEach((i) => st.remove('list_items', i.id));
  };
  const duplicate = () => {
    const nl = st.save('lists', { ...l, id: undefined, name: `${l.name} (cópia)`, created_at: undefined } as any);
    st.saveMany('list_items', items.map((i) => ({ ...i, id: undefined, list_id: nl.id, done: false, done_at: null, created_at: undefined } as any)));
    ui.toast('Lista duplicada'); nav(`/inventario/${nl.id}`);
  };
  const del = async () => {
    if (!(await ui.confirm({ title: 'Excluir lista?', text: `“${l.name}” e seus ${items.length} itens serão removidos.`, ok: 'Excluir', danger: true }))) return;
    st.remove('lists', l.id); items.forEach((i) => st.remove('list_items', i.id)); nav('/inventario');
  };

  const Row = ({ i, idx }: { i: ListItem; idx: number }) => (
    <li className={`flex items-center gap-2 px-3 py-2 ${idx ? 'border-t-2 border-line/10' : ''}`}>
      <input type="checkbox" className="px-check" checked={i.done} onChange={() => toggle(i)} aria-label={i.done ? `Restaurar ${i.name}` : `Marcar ${i.name}`} />
      {i.image_path && <Photo path={i.image_path} className="w-10 h-10 object-cover rounded-[3px] border-2 border-line/40" />}
      <button className="flex-1 min-w-0 text-left" onClick={() => setEdit(i)}>
        <span className={`font-semibold ${i.done ? 'line-through text-muted' : ''}`}>{i.qty ? <span className="text-terra">{String(i.qty).replace('.', ',')}{i.unit ? ' ' + i.unit : '×'} </span> : null}{i.name}</span>
        {(i.notes || i.link) && <span className="block text-xs text-muted truncate">{i.notes}{i.link ? ' · link' : ''}</span>}
      </button>
      {i.price != null && <span className="text-sm font-semibold tabular-nums">{money(i.price * (i.qty && i.qty > 0 ? i.qty : 1))}</span>}
      {!i.done && <div className="flex flex-col"><button className="p-1 text-muted hover:text-ink" aria-label="Subir" onClick={() => move(i, -1)}><Icon name="up" size={10} /></button><button className="p-1 text-muted hover:text-ink" aria-label="Descer" onClick={() => move(i, 1)}><Icon name="down" size={10} /></button></div>}
    </li>
  );

  return (
    <div>
      <Link to="/inventario" className="inline-flex items-center gap-1 hud text-[11px] text-muted mb-3"><Icon name="left" size={12} />Inventário</Link>
      <header className="px-box p-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-14 h-14 rounded-[4px] border-[3px] border-line text-[rgb(58_42_30)]" style={{ background: l.color }}><Icon name={l.icon as any} size={28} /></span>
          <div className="flex-1 min-w-0">
            <h1 className="h-pixel text-2xl leading-tight">{l.name}</h1>
            <div className="text-xs text-muted">{catOf(LIST_CATS, l.category).label} · {l.owners.map((o) => o === 'family' ? 'Família' : o === 'both' ? 'Nós dois' : members.find((m) => m.id === o)?.name || '').join(', ')}</div>
            {l.description && <p className="text-sm mt-1">{l.description}</p>}
          </div>
        </div>
        <SegBar value={stats.pct} className="mt-3" />
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn-ghost btn-sm" onClick={() => setEditList(true)}><Icon name="edit" size={12} />Editar</button>
          <button className="btn-ghost btn-sm" onClick={duplicate}><Icon name="copy" size={12} />Duplicar</button>
          <button className="btn-ghost btn-sm" onClick={() => st.save('lists', { id: l.id, archived: !l.archived })}><Icon name="book" size={12} />{l.archived ? 'Desarquivar' : 'Arquivar'}</button>
          <button className="btn-ghost btn-sm" onClick={del}><Icon name="trash" size={12} />Excluir</button>
        </div>
      </header>

      <form onSubmit={add} className="px-box p-2 flex gap-2 mb-4 sticky top-[72px] z-10">
        <input className="field border-0 focus:ring-0" placeholder='Adicionar item… ex.: "2 leite"' value={name} onChange={(e) => setName(e.target.value)} aria-label="Novo item" maxLength={200} />
        <button className="btn-moss" disabled={!name.trim()}><Icon name="plus" size={14} /></button>
      </form>

      {isShopping && stats.priced > 0 && (
        <div className="px-box p-3 mb-4 grid grid-cols-3 text-center">
          <div><div className="hud text-[10px] text-muted">A comprar</div><div className="font-bold tabular-nums">{money(stats.sumOpen)}</div></div>
          <div><div className="hud text-[10px] text-muted">No carrinho</div><div className="font-bold tabular-nums text-moss">{money(stats.sumDone)}</div></div>
          <div><div className="hud text-[10px] text-muted">Total</div><div className="font-bold tabular-nums">{money(stats.sumAll)}</div></div>
        </div>
      )}

      {items.length === 0 ? <div className="px-box"><Empty icon="list" title="Lista vazia" text="Adicione o primeiro item acima." /></div> : (
        <>
          {open.length > 0 && <ul className="px-box mb-4">{open.map((i, k) => <Row key={i.id} i={i} idx={k} />)}</ul>}
          {done.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2"><h2 className="hud text-[12px] text-muted">Concluídos · {done.length}</h2><button className="text-sm link" onClick={clearDone}>Limpar concluídos</button></div>
              <ul className="px-box opacity-80">{done.map((i, k) => <Row key={i.id} i={i} idx={k} />)}</ul>
            </section>
          )}
        </>
      )}
      {edit && <ItemEditor item={edit} onClose={() => setEdit(null)} />}
      {editList && <ListEditor list={l} onClose={() => setEditList(false)} />}
      <p className="sr-only">{me?.name}</p>
    </div>
  );
}

function ItemEditor({ item, onClose }: { item: ListItem; onClose: () => void }) {
  const [i, setI] = useState<ListItem>(item);
  const [price, setPrice] = useState(item.price != null ? String(item.price).replace('.', ',') : '');
  const ui = useUI(); const st = getStore();
  const set = (p: Partial<ListItem>) => setI((x) => ({ ...x, ...p }));
  const save = () => {
    if (!i.name.trim()) return ui.toast('O item precisa de um nome', 'err');
    const p = price.trim() ? parseMoney(price) : null;
    if (price.trim() && p == null) return ui.toast('Preço inválido', 'err');
    if (i.link && !safeUrl(i.link)) return ui.toast('O link precisa começar com https://', 'err');
    st.save('list_items', { ...i, name: i.name.trim(), price: p }); onClose();
  };
  return (
    <Modal open onClose={onClose} title="Item" footer={<>
      <button className="btn-ghost btn-sm mr-auto" onClick={() => { st.remove('list_items', i.id); onClose(); ui.toast('Item removido', 'ok', { label: 'Desfazer', run: () => st.save('list_items', { id: i.id, deleted: false } as any) }); }}><Icon name="trash" size={12} />Remover</button>
      <button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}>
      <div className="space-y-3">
        <Field label="Nome"><input className="field" value={i.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Quantidade"><input type="number" min={0} step="any" inputMode="decimal" className="field" value={i.qty ?? ''} onChange={(e) => set({ qty: e.target.value === '' ? null : Math.max(0, +e.target.value) })} /></Field>
          <Field label="Unidade"><input className="field" list="units" value={i.unit || ''} onChange={(e) => set({ unit: e.target.value })} placeholder="un, kg…" /></Field>
          <Field label="Preço (R$)" hint="por unidade"><input className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" /></Field>
        </div>
        <datalist id="units">{['un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'dz'].map((u) => <option key={u} value={u} />)}</datalist>
        <Field label="Observações"><textarea className="field" value={i.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <Field label="Link"><input className="field" type="url" value={i.link || ''} onChange={(e) => set({ link: e.target.value })} placeholder="https://" /></Field>
        {safeUrl(i.link) && <a className="link text-sm" href={safeUrl(i.link)} target="_blank" rel="noopener noreferrer">Abrir link</a>}
        <ImagePicker value={i.image_path} onChange={(p) => set({ image_path: p })} />
      </div>
    </Modal>
  );
}
