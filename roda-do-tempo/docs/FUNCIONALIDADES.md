# Funcionalidades

## World 01 — Início
- Saudação pelo horário de Brasília, data por extenso, avatares, sininho de notificações e status de sincronização.
- HUD: **WORLD 01 · MISSÕES feitas/total de hoje · ♥♥♥ · CO-OP + patinha** (com dados reais) e estrelas do time.
- **Minigame** de plataforma em pixel art: casa, correio, quadro de missões, baú, balanço na árvore, poço dos desejos,
  bandeira e placa de aventuras. Cada lugar leva à área do app. Dia/noite conforme o horário real.
  - Computador: clique no jogo, ← → ou A/D, espaço para pular, Enter para entrar.
  - Celular: botões ←, →, pular e A. Só roda quando está visível na tela.
  - Escolha com quem jogar; a cachorrinha segue você; os outros passeiam perto de casa.
  - Estrelinhas do jogo são contadas à parte (não mexem no progresso real).
  - Conquistas desbloqueiam enfeites no cenário (flores, bandeira, lanterna, casinha na árvore, arco-íris, vaga-lumes, correio vermelho).
- Ações rápidas (missão, checkpoint, item de lista, carta) e os 7 atalhos numerados.
- Resumo: missões de hoje e de amanhã, as que ficaram para trás (sem culpa), próximos checkpoints, listas ativas,
  lembretes de cuidados, aventuras, desejos em andamento, cartas recentes e progresso do time.

## 01 · Missões
Título, descrição, responsável (eu, parceiro(a), nós dois, família), categoria, início, prazo, horário, prioridade,
status, repetição (diária, dias úteis, semanal, mensal, anual, com intervalo e data final), etapas (checklist),
anotações, anexos (arquivo ou link), recompensa em estrelas, lembrete e aventura vinculada.
Criar, editar, duplicar, excluir (com desfazer), concluir, reabrir, filtros (responsável, categoria, prioridade),
visões Hoje/Semana/Futuras/Todas e histórico de conclusões. Missão repetida avança sozinha para a próxima data.
Adição rápida com Enter. Tecla **N** em qualquer tela abre uma nova missão.

## 02 · Inventário
Listas com nome, ícone, cor, descrição, categoria e responsáveis; 10 modelos prontos; progresso.
Itens com quantidade, unidade, observações, preço, link e foto. Adicionar digitando “2 leite”.
Reordenar, marcar/restaurar, limpar concluídos, duplicar, arquivar, excluir.
Total automático: a comprar, no carrinho e geral (preço × quantidade). Tempo real entre aparelhos.

## 03 · Checkpoints
Visões mês, semana, dia e agenda. Título, data, início/fim, dia inteiro, vários dias, local, descrição,
participantes, categoria, cor, repetição, lembretes. Editar a série ou só uma data; excluir uma data da série;
reagendar para o dia seguinte. Exportação **.ics** (tudo ou um evento) com fuso America/Sao_Paulo.
`src/lib/calendarSync.ts` é o ponto de extensão para integrar o Google Agenda no futuro (ainda não há integração ativa).

## 04 · Mini player
Perfil (nome, apelido, nascimento, idade automática, foto ou personagem, informações importantes).
Linha do tempo por ano com categorias, fotos e links. Rotina e saúde: consultas, vacinas, peso e altura,
alimentação, sono, escola, medicamentos informados e lembretes, com “próximos cuidados”.
Diário de memórias com busca, filtro por ano, marcadores e “neste dia, em outros anos”.
Registros de saúde são só organizacionais: o app não faz diagnóstico nem recomendação.

## 05 · Estrelas
Desejos com categoria, dono, imagem, link, valor, prioridade, prazo, progresso e status
(sonhando, planejando, em andamento, realizado, arquivado). Viram aventura ou missão.
Ao realizar: data registrada, celebração e histórico de sonhos realizados.

## 06 · Aventuras
Campanhas com capa (7 paisagens em pixel art ou foto), descrição, participantes, datas, status, orçamento,
fases (missões vinculadas, progresso automático), checkpoints, listas (com soma de valores), anotações e links.
Ao concluir todas as fases, o app pergunta se quer concluir a aventura.

## 07 · Correio
Bilhetes, agradecimentos, surpresas, cartas para o futuro e cápsulas do tempo, em envelopes com selos.
Para um adulto, para a filha ou para a família toda. Data de abertura com atalhos (“aos 18 anos dela”).
Com servidor, o conteúdo **só sai do banco na data**. Cartas privadas, status de leitura e avisos.

## 08 · Nossa família
Perfis (adultos, crianças, pets) com editor de personagem (pele, cabelo, penteado, acessório, roupas; pelagem e coleira do pet),
cor, foto e informações. Convite por link ou e-mail. Tema claro/escuro/automático, sons, redução de animações,
gamificação liga/desliga, preferências por tipo de aviso, antecedência dos lembretes, push.
Conquistas do time (sem ranking). Exportar JSON e .ics, adicionar/remover exemplos, sair, sair da família e excluir tudo.

## Gamificação (opcional, cooperativa)
Estrelas do time por missões, sonhos realizados (+5) e aventuras concluídas (+10). Nove conquistas.
Sem rankings individuais, sem perder pontos, sem punição por atraso.

## Acessibilidade e uso diário
Alvos de toque de 44 px, foco visível, rótulos para leitores de tela, contraste nos dois temas,
respeito a “reduzir movimento” do sistema, confirmação em ações destrutivas, estados vazios e de carregamento.
