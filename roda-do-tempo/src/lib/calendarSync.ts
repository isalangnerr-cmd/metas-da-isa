// Ponto de extensão para sincronizar o calendário com serviços externos (ex.: Google Calendar).
// Ainda NÃO há integração ativa: hoje o app exporta .ics (veja ics.ts), que pode ser importado
// no Google Agenda, Apple Calendário ou Outlook. Para integrar de verdade:
//  1. Criar um projeto no Google Cloud com a Calendar API e um OAuth Client (tipo Web).
//  2. Implementar um provedor abaixo (provavelmente via Edge Function para guardar tokens).
//  3. Registrar em `providers`.
import type { CalEvent } from '@/data/types';

export interface CalendarProvider {
  id: string; name: string;
  connect(): Promise<void>;
  push(events: CalEvent[]): Promise<{ ok: number; failed: number }>;
  pull?(from: string, to: string): Promise<Partial<CalEvent>[]>;
}
export const providers: CalendarProvider[] = [];
