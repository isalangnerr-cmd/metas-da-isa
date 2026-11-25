import type { IconName } from '@/components/icons';
export interface NavItem { to: string; n: string; theme: string; func: string; desc: string; icon: IconName; color: string }
export const NAV: NavItem[] = [
  { to: '/', n: '00', theme: 'World 01', func: 'Início', desc: 'Nossa aventura', icon: 'home', color: '#E8624D' },
  { to: '/entrada', n: '✦', theme: 'Caixa de entrada', func: 'Recados', desc: 'Mande, a gente organiza', icon: 'sparkle', color: '#D99A1E' },
  { to: '/missoes', n: '01', theme: 'Missões', func: 'Tarefas', desc: 'Desafios do dia', icon: 'sword', color: '#E8624D' },
  { to: '/inventario', n: '02', theme: 'Inventário', func: 'Listas', desc: 'Tudo anotado', icon: 'bag', color: '#4A9B6A' },
  { to: '/checkpoints', n: '03', theme: 'Checkpoints', func: 'Calendário', desc: 'Datas e encontros', icon: 'flag', color: '#4F8CC9' },
  { to: '/mini-player', n: '04', theme: 'Mini player', func: 'Nossa filha', desc: 'O mundo dela', icon: 'rattle', color: '#E0457B' },
  { to: '/estrelas', n: '05', theme: 'Estrelas', func: 'Desejos', desc: 'Nossos desejos', icon: 'star', color: '#D99A1E' },
  { to: '/aventuras', n: '06', theme: 'Aventuras', func: 'Planos', desc: 'Próximos planos', icon: 'map', color: '#B0703F' },
  { to: '/correio', n: '07', theme: 'Correio', func: 'Mensagens', desc: 'Mensagens no tempo', icon: 'mail', color: '#8B63AA' },
  { to: '/familia', n: '08', theme: 'Nossa família', func: 'Configurações', desc: 'Personalização', icon: 'gear', color: '#64748B' },
];
