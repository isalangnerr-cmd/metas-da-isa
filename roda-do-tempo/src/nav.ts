import type { IconName } from '@/components/icons';
export interface NavItem { to: string; n: string; theme: string; func: string; desc: string; icon: IconName; color: string }
export const NAV: NavItem[] = [
  { to: '/', n: '00', theme: 'World 01', func: 'Início', desc: 'Nossa aventura', icon: 'home', color: '#E9B949' },
  { to: '/missoes', n: '01', theme: 'Missões', func: 'Tarefas', desc: 'Desafios do dia', icon: 'sword', color: '#C2643C' },
  { to: '/inventario', n: '02', theme: 'Inventário', func: 'Listas', desc: 'Tudo anotado', icon: 'bag', color: '#5E7B3A' },
  { to: '/checkpoints', n: '03', theme: 'Checkpoints', func: 'Calendário', desc: 'Datas e encontros', icon: 'flag', color: '#6E9FB5' },
  { to: '/mini-player', n: '04', theme: 'Mini player', func: 'Nossa filha', desc: 'O mundo dela', icon: 'rattle', color: '#D9A62E' },
  { to: '/estrelas', n: '05', theme: 'Estrelas', func: 'Desejos', desc: 'Nossos desejos', icon: 'star', color: '#E9B949' },
  { to: '/aventuras', n: '06', theme: 'Aventuras', func: 'Planos', desc: 'Próximos planos', icon: 'map', color: '#8A5A3B' },
  { to: '/correio', n: '07', theme: 'Correio', func: 'Mensagens', desc: 'Mensagens no tempo', icon: 'mail', color: '#8A5A7A' },
  { to: '/familia', n: '08', theme: 'Nossa família', func: 'Configurações', desc: 'Personalização', icon: 'gear', color: '#7A6553' },
];
