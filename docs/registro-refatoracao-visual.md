# Registro de mudanças — Refatoração visual

## Fundação

- `frontend/src/app/globals.css`: paleta semântica, superfícies, texto, bordas, foco, espaço, raios, sombras e tipografia; padrões `ui-*` para páginas, botões, campos, tabelas, painéis e dialogs; redução de movimento.
- `frontend/src/app/layout.tsx`: identidade comum e manutenção do provider de instalação PWA.
- `frontend/src/app/(authenticated)/layout.tsx`: acesso rápido ao conteúdo por teclado e contenção de largura.
- `frontend/src/lib/brand.ts`: grafite para metadados/PNG, conferido contra CSS por teste.

## Componentes

- Novos `ui/MetricCard.tsx`, `ui/DomainIcon.tsx` e `ui/DialogFocus.tsx`: métricas operacionais com destino, vetores de domínio e ciclo de foco modal.
- `Header.tsx`: navegação em duas linhas no desktop para não sobrepor marca/ações, estados ativos acessíveis, avatar e popovers neutros. Instalação PWA preservada.
- `BuscaRapidaModal.tsx`: cores neutras por entidade, campo identificado, apresentação e foco comuns; Ctrl/Cmd+K, setas e Enter preservados.
- `ClienteModal.tsx`, `MaquinaModal.tsx`, `ProdutoModal.tsx`: campos/labels comuns, associação de rótulos, ícones vetoriais, seleção acessível e foco modal. Título de produto pode quebrar linha no mobile.
- `MovimentacaoEstoqueModal.tsx`: seleção âmbar, ícones de direção e saldo/validações preservados; removida configuração decorativa de cor por operação.
- `CompatibilidadeModal.tsx`: campos, mensagens e superfície padronizados, foco contido/restaurado.
- `ConfirmModal.tsx`: hierarquia cancelar/confirmar, contraste da ação destrutiva e altura rolável.
- `EmptyState.tsx`: hierarquia legível de título/descrição e redução de moldura decorativa.
- `InstallAppButton.tsx`: botão neutro, dialog comum e teclado; prompt/portal/lógica de instalação preservados.
- `OrdemServicoImpressao.tsx`: nenhum conteúdo/contrato alterado; testes de A4 e isolamento de impressão aprovados. Cores de papel/tinta são exceção documentada.

## Páginas

Todas as 14 telas receberam revisão de classes, tipografia, ícones e controles. Nenhuma foi descartada por parecer adequada.

- `dashboard/page.tsx`: banner, marcas d'água e quatro estilos de cartões substituídos por cabeçalho operacional e métricas reutilizáveis; últimas OS vêm antes de acessos rápidos; todos os contadores, destinos e retries mantidos, com retry explícito também para estoque.
- `clientes/page.tsx` e `clientes/[id]/page.tsx`: leitura de cadastro/contatos/histórico, filtros e ações padronizados.
- `maquinas/page.tsx` e `maquinas/[id]/page.tsx`: tipos com Lucide, situações textuais neutras, pesquisa, resumo e histórico preservados.
- `ordens-servico/page.tsx`: filtros ativos consistentes, controles nomeados no mobile e tabela comum.
- `ordens-servico/nova/page.tsx`: título claro, rótulos associados e grupos de atendimento preservados.
- `ordens-servico/[id]/page.tsx`: ações/WhatsApp sem cor por status, abas sem emojis, resumo financeiro neutro, dialogs locais com semântica/foco/Escape e IDs originais de testes preservados.
- `produtos/page.tsx`: tipos vetoriais, placeholder sem emoji, ação/filtros com nomes acessíveis; cabeçalho quebra em 320px.
- `estoque/page.tsx` e `estoque/movimentacoes/page.tsx`: resumos neutros, atenção/crítico identificados, movimentações por rótulo/direção, campos e tabelas comuns.
- `relatorios/page.tsx`: seis abas mantidas, leitura das tabelas/presets/exportações e nomes dos controles padronizados.
- `configuracoes/page.tsx`: grupos comerciais/contato/endereço mantidos, campos associados e mensagens sem cor decorativa por resultado.
- `login/page.tsx`: fotografia monocromática, remoção de losangos decorativos, controles/foco/contraste comuns. Qualidade de imagem usa o padrão suportado pelo Next, evitando os avisos/recusas do otimizador. Fluxo de login, sessão e 2FA preservado.

## Tipos, modelos e PWA

- `lib/types.ts`: alterados apenas metadados de apresentação (badges e nomes de ícones de opções). Valores de domínio, DTOs e rótulos não mudaram.
- `lib/whatsappHelper.ts`: retirada apenas a mão decorativa das saudações geradas; números, valores, status e texto operacional mantidos. Conteúdo fornecido pelo usuário não é filtrado.
- `app/manifest.ts` e `lib/pwaIcon.tsx`: fundo grafite comum, sem mudar rotas, tamanhos, escopo ou instalação.
- Nenhuma dependência, regra de negócio, configuração de segurança, migration ou arquivo do backend foi alterado pela refatoração.

## Evidências e cobertura

- [Auditoria por rota e componente](auditoria-visual.md).
- [Design System e regras de uso](design-system.md).
- [76 capturas e comparativo antes/depois](visual/README.md).
- Novos testes: `designSystem.test.ts` (contraste/tokens/emojis/paleta), `visual-review.spec.ts` (14 telas × 6 larguras), `visual-interactions.spec.ts` (10 dialogs × 6 larguras, foco/teclado e abas), fixtures isolados de dados reais.
- Testes existentes mantidos, sem remover asserts ou aumentar timeouts. A matriz anterior também cobre 320–2560px e os testes de recibo verificam A4/overflow/impressão.

O baseline visual pertence ao checkout inicial, anterior aos 13 commits de PWA incorporados de `main`. Os snapshots finais usam o build de produção; o botão de instalação adicional é esperado e está documentado.
