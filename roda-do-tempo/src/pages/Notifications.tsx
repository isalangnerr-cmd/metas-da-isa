import { useNavigate } from 'react-router-dom';
import { getStore, useTable } from '@/data/store';
import { useSession } from '@/data/session';
import { Empty, Icon, Modal } from '@/components/ui';
import type { IconName } from '@/components/icons';
import { relDay } from '@/lib/dates';

const ICON: Record<string, IconName> = { task_assigned: 'sword', task_due: 'clock', event_soon: 'flag', list_changed: 'bag', message: 'mail', capsule: 'unlock', wish_done: 'star', adventure_done: 'map', health: 'pill' };

export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSession(); const nav = useNavigate(); const st = getStore();
  const all = useTable('notifications').filter((n) => !n.user_id || n.user_id === s.userId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);
  const unread = all.filter((n) => !n.read_at);
  const mark = (id: string) => st.save('notifications', { id, read_at: new Date().toISOString() }, { update: true });
  return (
    <Modal open={open} onClose={onClose} title="Notificações" footer={unread.length ? <button className="btn-ghost btn-sm" onClick={() => unread.forEach((n) => mark(n.id))}><Icon name="check" size={12} />Marcar todas como lidas</button> : undefined}>
      {all.length === 0 ? <Empty icon="bell" title="Tudo tranquilo" text="Avisos de missões, checkpoints, cartas e cápsulas aparecem aqui." /> : (
        <ul className="space-y-2">
          {all.map((n) => (
            <li key={n.id}>
              <button className={`w-full text-left px-box-flat p-3 flex gap-3 ${n.read_at ? 'opacity-60' : ''}`} onClick={() => { mark(n.id); if (n.link) { nav(n.link); onClose(); } }}>
                <span className={`grid place-items-center w-9 h-9 rounded-[4px] border-2 border-line shrink-0 ${n.read_at ? 'bg-panel2' : 'bg-sun text-[rgb(58_42_30)]'}`}><Icon name={ICON[n.type] || 'bell'} size={16} /></span>
                <span className="flex-1 min-w-0"><span className="block font-semibold text-sm">{n.title}</span>{n.body && <span className="block text-sm text-muted truncate">{n.body}</span>}<span className="block text-[11px] text-muted">{relDay(n.created_at.slice(0, 10))} · {new Date(n.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</span></span>
                {!n.read_at && <span className="w-2.5 h-2.5 bg-terra mt-2" aria-label="Não lida" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
