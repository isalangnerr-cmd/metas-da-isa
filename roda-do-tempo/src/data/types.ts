import type { Recurrence } from '@/lib/recurrence';

export interface Base { id: string; family_id: string; created_at: string; updated_at: string; created_by?: string | null; deleted?: boolean }

export type MemberKind = 'adult' | 'child' | 'pet';
export interface Avatar {
  skin: string; hair: string; hairStyle: number; shirt: string; pants: string; accessory: number;
  beard?: boolean; beardColor?: string; glasses?: number; glassesColor?: string; freckles?: boolean; outfit?: number; striped?: boolean;
  shoes?: string; cap?: boolean; capColor?: string; checkered?: boolean; bow?: string;
}
export interface Member extends Base {
  user_id?: string | null; kind: MemberKind; name: string; nickname?: string | null; color: string;
  avatar: Avatar; birth_date?: string | null; photo_path?: string | null; info?: { label: string; value: string }[]; position: number;
}
export interface Family extends Base { name: string; settings: FamilySettings }
export interface FamilySettings { gamification: boolean; examples_seeded?: boolean; unlocked?: string[] }

/** Responsável: id de um membro, ou "both" (os dois adultos) ou "family". */
export type Assignee = string;
export type Priority = 'low' | 'normal' | 'high';
export type TaskStatus = 'todo' | 'doing' | 'done';
export interface Subtask { id: string; title: string; done: boolean }
export interface Attachment { id: string; name: string; path?: string; url?: string; type?: string }
export interface Task extends Base {
  title: string; description?: string; assignee: Assignee; category: string;
  start_date?: string | null; due_date?: string | null; due_time?: string | null;
  priority: Priority; status: TaskStatus; recurrence?: Recurrence | null;
  subtasks: Subtask[]; notes?: string; attachments: Attachment[]; stars: number;
  adventure_id?: string | null; wish_id?: string | null; completed_at?: string | null; completed_by?: string | null; remind_min?: number | null;
  example?: boolean;
}
export interface TaskCompletion extends Base { task_id: string; title: string; member_id?: string | null; date: string; stars: number }

export interface ShopList extends Base {
  name: string; icon: string; color: string; description?: string; category: string; owners: Assignee[];
  adventure_id?: string | null; archived?: boolean; position: number; example?: boolean;
}
export interface ListItem extends Base {
  list_id: string; name: string; qty?: number | null; unit?: string; notes?: string; price?: number | null;
  link?: string; image_path?: string | null; done: boolean; position: number; done_at?: string | null;
}

export interface CalEvent extends Base {
  title: string; date: string; end_date?: string | null; start_time?: string | null; end_time?: string | null; all_day: boolean;
  location?: string; description?: string; participants: string[]; category: string; color?: string | null;
  recurrence?: Recurrence | null; reminders: number[]; adventure_id?: string | null; exdates?: string[]; example?: boolean;
}

export type ChildRecordKind = 'moment' | 'consult' | 'vaccine' | 'growth' | 'food' | 'sleep' | 'school' | 'medicine' | 'reminder';
export interface ChildRecord extends Base {
  member_id: string; kind: ChildRecordKind; date: string; time?: string | null; title: string; description?: string; category?: string;
  data?: { weight?: number | null; height?: number | null; dose?: string; next_date?: string | null; link?: string }; media_path?: string | null;
}
export interface Memory extends Base { member_id?: string | null; title: string; date: string; body: string; tags: string[]; media_path?: string | null; author_id?: string | null }

export type WishStatus = 'dreaming' | 'planning' | 'progress' | 'done' | 'archived';
export interface Wish extends Base {
  title: string; description?: string; category: string; owner: Assignee; image_path?: string | null; link?: string;
  value?: number | null; priority: Priority; deadline?: string | null; progress: number; status: WishStatus; achieved_at?: string | null;
  adventure_id?: string | null;
}

export type AdvStatus = 'future' | 'active' | 'done';
export interface Adventure extends Base {
  name: string; cover: string; cover_path?: string | null; description?: string; participants: string[];
  start_date?: string | null; end_date?: string | null; status: AdvStatus; budget?: number | null; notes?: string;
  links: { id: string; title: string; url: string }[]; completed_at?: string | null; example?: boolean;
}

export type MessageKind = 'note' | 'thanks' | 'surprise' | 'future' | 'capsule';
export interface Message extends Base {
  sender_id: string; recipient_id: string; /* membro ou "family" */ title: string; kind: MessageKind;
  open_at?: string | null; /* YYYY-MM-DD */ read_at?: string | null; private: boolean; stamp: number;
  body?: string | null; /* só presente quando liberado */ attachments?: Attachment[];
}

export interface AppNotification extends Base { user_id?: string | null; type: string; title: string; body?: string; link?: string; read_at?: string | null; key?: string }
export interface Achievement extends Base { key: string; unlocked_at: string }
export interface StarTx extends Base { member_id?: string | null; amount: number; source: 'task' | 'wish' | 'adventure' | 'bonus'; ref_id?: string | null; note?: string }

export interface UserPrefs {
  theme: 'light' | 'dark' | 'system'; sounds: boolean; reduceMotion: boolean;
  notify: Record<NotifType, boolean>; push: boolean; reminderLead: number; gameStars: number; character?: string;
}
export type NotifType = 'task_assigned' | 'task_due' | 'event_soon' | 'list_changed' | 'message' | 'capsule' | 'wish_done' | 'adventure_done' | 'health';

export type TableName = 'members' | 'tasks' | 'task_completions' | 'lists' | 'list_items' | 'events' | 'child_records' | 'memories' |
  'wishes' | 'adventures' | 'messages' | 'notifications' | 'achievements' | 'star_transactions';

export interface Tables {
  members: Member; tasks: Task; task_completions: TaskCompletion; lists: ShopList; list_items: ListItem; events: CalEvent;
  child_records: ChildRecord; memories: Memory; wishes: Wish; adventures: Adventure; messages: Message;
  notifications: AppNotification; achievements: Achievement; star_transactions: StarTx;
}
export const TABLES: TableName[] = ['members', 'tasks', 'task_completions', 'lists', 'list_items', 'events', 'child_records', 'memories',
  'wishes', 'adventures', 'messages', 'notifications', 'achievements', 'star_transactions'];
