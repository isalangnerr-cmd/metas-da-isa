// Motor de lembretes que roda no aparelho (a cada minuto, com o app aberto).
// Cria avisos na central de notificações (com id determinístico = sem duplicar entre aparelhos)
// e mostra notificação do sistema quando a pessoa permitiu.
// Com o app fechado, quem avisa é a Edge Function de push (opcional, veja docs/PUSH.md).
import { useEffect } from 'react';
import { getStore } from '@/data/store';
import { useMe, useSession } from '@/data/session';
import type { NotifType, UserPrefs } from '@/data/types';
import { addDays, nowParts, today, zonedToDate, fmtDate } from './dates';
import { deterministicId, eventsBetween, isMine } from './domain';
import { systemNotify } from './pwa';

export interface PendingNotif { key: string; type: NotifType; title: string; body: string; link: string }

export function computeReminders(meId: string | undefined, prefs: UserPrefs, now = new Date()): PendingNotif[] {
  const s = getStore();
  const out: PendingNotif[] = [];
  const t0 = today(now), { hour } = nowParts(now);
  const ms = now.getTime();
  const want = (t: NotifType) => prefs.notify[t] !== false;

  if (want('task_due')) {
    for (const t of s.all('tasks')) {
      if (t.status === 'done' || !t.due_date || t.due_date !== t0 || !isMine(t.assignee, meId)) continue;
      if (t.due_time) {
        const lead = t.remind_min ?? prefs.reminderLead;
        const at = zonedToDate(t.due_date, t.due_time).getTime();
        if (ms >= at - lead * 60e3 && ms < at + 60 * 60e3) out.push({ key: `due:${t.id}:${t.due_date}`, type: 'task_due', title: 'Missão chegando', body: `${t.title} · ${t.due_time}`, link: `/missoes?t=${t.id}` });
      } else if (hour >= 8) {
        out.push({ key: `due:${t.id}:${t.due_date}`, type: 'task_due', title: 'Missão para hoje', body: t.title, link: `/missoes?t=${t.id}` });
      }
    }
  }
  if (want('event_soon')) {
    for (const o of eventsBetween(s.all('events'), t0, addDays(t0, 1))) {
      const e = o.ev;
      if (e.participants.length && meId && !e.participants.includes(meId) && !e.participants.includes('family')) continue;
      for (const m of e.reminders || []) {
        const at = zonedToDate(o.date, e.all_day || !e.start_time ? '09:00' : e.start_time).getTime() - (e.all_day ? 0 : 0);
        if (ms >= at - m * 60e3 && ms < at) out.push({ key: `ev:${e.id}:${o.date}:${m}`, type: 'event_soon', title: 'Checkpoint chegando', body: `${e.title}${e.start_time && !e.all_day ? ' · ' + e.start_time : ''}`, link: `/checkpoints?d=${o.date}` });
      }
    }
  }
  if (want('capsule')) {
    for (const m of s.all('messages')) {
      if (!m.open_at || m.open_at > t0 || m.read_at) continue;
      if (m.recipient_id !== meId && m.recipient_id !== 'family' && s.get('members', m.recipient_id)?.kind === 'adult') continue;
      out.push({ key: `cap:${m.id}`, type: 'capsule', title: 'Uma cápsula do tempo abriu!', body: m.title, link: `/correio?m=${m.id}` });
    }
  }
  if (want('health')) {
    for (const r of s.all('child_records')) {
      if (!['consult', 'vaccine', 'reminder'].includes(r.kind)) continue;
      const dates = [r.date, r.data?.next_date].filter(Boolean) as string[];
      for (const d of dates) {
        if (d === addDays(t0, 1) && hour >= 18) out.push({ key: `health:${r.id}:${d}`, type: 'health', title: 'Amanhã', body: `${r.title} · ${fmtDate(d)}`, link: '/mini-player?tab=cuidados' });
        if (d === t0 && hour >= 7) out.push({ key: `health:${r.id}:${d}:hoje`, type: 'health', title: 'Hoje', body: r.title, link: '/mini-player?tab=cuidados' });
      }
    }
  }
  return out;
}

export function useReminders() {
  const s = useSession();
  const me = useMe();
  useEffect(() => {
    const tick = () => {
      const st = getStore();
      for (const p of computeReminders(me?.id, s.prefs)) {
        const id = deterministicId(`${s.userId}:${p.key}`);
        if (st.data.notifications.has(id)) continue;
        st.save('notifications', { id, user_id: s.userId, type: p.type, title: p.title, body: p.body, link: p.link, key: p.key });
        systemNotify(p.title, p.body, p.link);
      }
    };
    const first = setTimeout(tick, 3000);
    const iv = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [me?.id, s.prefs, s.userId]);
}
