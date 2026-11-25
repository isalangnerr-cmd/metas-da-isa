import type { UserPrefs } from './types';

export const DEFAULT_PREFS: UserPrefs = {
  theme: 'system', sounds: true, reduceMotion: false, push: false, reminderLead: 30, gameStars: 0,
  notify: { task_assigned: true, task_due: true, event_soon: true, list_changed: true, message: true, capsule: true, wish_done: true, adventure_done: true, health: true },
};
export const mergePrefs = (p?: Partial<UserPrefs> | null): UserPrefs => ({ ...DEFAULT_PREFS, ...(p || {}), notify: { ...DEFAULT_PREFS.notify, ...(p?.notify || {}) } });

export function applyTheme(p: UserPrefs) {
  const dark = p.theme === 'dark' || (p.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.motion = p.reduceMotion ? 'reduce' : 'auto';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1E1914' : '#F6EFE1');
}
