# Auditoria visual — Oficina Gestão

Data: 29/10/2026. Branch: `refactor/identidade-visual-oficina`.

## Diagnóstico anterior à implementação

O App Router inicial continha 15 rotas (14 telas e o redirecionamento `/`). Foram inspecionados layouts, componentes, contratos de `lib/types.ts`, cliente HTTP, assets e testes. Não há gráficos de biblioteca: indicadores, tabelas, rankings e histórico são construídos com HTML e Lucide.

A branch inicial `release/oficina-pre-oracle-20261023`, no commit `217cfe2`, estava 13 commits atrás de `origin/main`. A atualização da `main` foi incorporada na branch de refatoração: preserva o PWA já existente, com `InstallAppButton`, `PwaInstallProvider`, `/manifest.webmanifest` e `/pwa/icon-192.png`/`icon-512.png`. Não há service worker nem operações offline. Há também o fallback 404 gerado pelo Next (`/_not-found` no build), sem dados operacionais ou página customizada no baseline.

As capturas antigas em `frontend/screenshots` das rotas privadas mostram redirecionamentos para login e **não** servem de evidência das telas internas. Os novos comparativos usam respostas sintéticas interceptadas exclusivamente no navegador de testes, sem alterar autenticação, backend ou dados operacionais.

## Inventário por rota

Todas as páginas privadas dependem de `(authenticated)/layout.tsx` (sessão via `/api/auth/me`) e `Header` (navegação desktop/mobile, busca global, notificações e usuário). A API passa por `lib/api.ts`; nenhum acesso direto ao banco. Tabelas usam rolagem local; breakpoints predominantes são `sm` e `lg`.

| Rota / arquivo em `frontend/src/app` | Fluxo, componentes e estados | Problemas e decisão visual |
| --- | --- | --- |
| `/` — `page.tsx` | Redireciona para dashboard; layout privado determina sessão. | Sem UI própria; preservar redirecionamento e validar destino. |
| `/login` — `login/page.tsx` | RHF/Zod, email/senha, mostrar senha, manter conectado, login/2FA/reenvio/voltar; formulário desktop e dialog mobile; carregamento, bloqueio por tentativas e erro. Imagens `login-bg` e logo. | Âmbar hardcoded, sombras coloridas, losangos decorativos, contraste de placeholders. Preservar imagem contextual e formulários; remover decoração e adotar tokens, foco e controles comuns. |
| `/dashboard` | Contadores de prontas/aprovação/manutenção/estoque, atalhos, últimas OS com status/data/cliente/equipamento. Loading por bloco, fallback de contadores, erro/retry e vazio com CTA. | Banner grande, quatro cores de cartões, marcas d'água, badges/ícones redundantes. Trocar por cabeçalho operacional, métricas neutras reutilizáveis e tabela prioritária, mantendo todos os atalhos e indicadores. |
| `/clientes` | Busca com debounce, tipo PF/PJ, ativo, ordenação, contadores, tabela/paginação; `ClienteModal`, `ConfirmModal`; editar/ativar/inativar/detalhar; toasts e erro/retry/vazio. | Azul para PF/PJ e verde de sucesso concorrem com ação principal. Tipos/situações neutros com rótulos, ação principal âmbar e tipografia legível. |
| `/clientes/[id]` | Cadastro/contato/endereço, resumo, equipamentos e OS; editar cadastro/equipamento, nova máquina e nova OS; `ClienteModal`, `MaquinaModal`, `ConfirmModal`. Carregamento/erro/ausência por seção. | Gradiente e indicadores multicoloridos, subtítulos pequenos em caixa alta. Seções neutras, números tabulares e separação de ações/cadastro/histórico. |
| `/maquinas` | Busca, tipo, ativo; tabela paginada; `MaquinaModal`; abrir detalhe/cadastrar. Erro/retry/loading/vazio. | Emojis em filtros e tipo na tabela; verde/vermelho para ativo/inativo. Lucide, rótulos e controles de seleção consistentes; inativo não é erro. |
| `/maquinas/[id]` | Dados técnicos, proprietário, resumo, histórico em tabela/timeline, expansão das peças; `MaquinaModal` e `ConfirmModal`; editar/status/nova OS. | Emojis, gradiente, cores por indicador, fechar toast com caractere. Ícones vetoriais, histórico neutro, números claros, status descritivos. |
| `/ordens-servico` | Busca, status, períodos/presets/datas, contadores, tabela/paginação, nova OS/detalhes; loading/erro/vazio. | Muitas cores de status e cartões concorrendo com Nova OS. Status centralizados com texto; filtros ativos âmbar e cabeçalhos comuns. |
| `/ordens-servico/nova` | Seleção/pesquisa de cliente, máquinas do cliente, cadastro inline com modais, data/previsão/técnico/problema/observação; envio/validação/erro/sucesso. | Etapas já úteis: preservar agrupamento e contratos; unificar campos, rótulos, seleção e ação final. |
| `/ordens-servico/[id]` | Identificação/status, cliente/máquina, valores; laudo/testes, peças, histórico, observações; ações conforme status, WhatsApp, impressão, adicionar/remover peça, confirmação/transição. Loading/erro/retry/toast. | Botões roxo/verde/ciano/azul/índigo, abas com emojis, painel denso. Ações operacionais neutras/primárias âmbar, cancelamento vermelho, abas com Lucide e estados textuais. Preservar integralmente dados e permissões. |
| `/produtos` | Busca código/nome/marca/SKU/local, tipo, ativos, categoria/fornecedor, estoque, paginação; criar/editar/ativar, compatibilidade, movimentar; quatro modais compartilhados. | Emojis em placeholder/filtros/tipo, cores por categoria e controles pequenos. Ícones coerentes; alertas de saldo preservados; filtros e tabela em linguagem comum. |
| `/estoque` | Totais, crítico, zerado, valorização; busca/categoria/fornecedor/nível; tabela com movimentação e histórico; `MovimentacaoEstoqueModal`; loading/erro/vazio. | Valorização verde e histórico ciano decorativos. Métricas neutras, baixo estoque âmbar e zerado crítico vermelho, todos com rótulos. |
| `/estoque/movimentacoes` | Produto/tipo/OS/datas, tabela antes/depois/quantidade/motivo/usuário/data, paginação, voltar ao estoque. Loading/erro/vazio. | Cores por movimento sugerem que saída é falha. Movimentos neutros com texto e direção; não confundir operação normal com erro. |
| `/relatorios` | Seis abas: OS/estoque/movimentações/peças/clientes/equipamentos; presets/data/status/filtros, resumos, tabelas, paginação, CSV conforme aba, atualização. Loading/erro/toast/vazio/exportando. | Textos 10–11px e seis cores; controles de exportação competindo com indicadores. Tabelas e filtros consistentes, legenda textual e valores tabulares, foco e notificações acessíveis. |
| `/configuracoes` | Identidade comercial/contato/endereço, visualizar/editar/salvar/cancelar/recarregar; erro/loading/sucesso; dados usados no recibo. | Aviso azul, sucesso verde, título menor que outras páginas, labels sem associação explícita. Grupos discretos com títulos e controles associados; dados e salvamento preservados. |

## Inventário dos componentes compartilhados

| Componente (`frontend/src/components`) | Dependências, controles e achados |
| --- | --- |
| `Header` | `Link`, `Image`, `BuscaRapidaModal`, API de notificações/logout; três popovers, menu mobile, Ctrl/Cmd+K. Active âmbar hardcoded, avatar azul, mini-texto, sombra do logo. Uniformizar navegação, foco e contraste; preservar IDs e saída segura. |
| `BuscaRapidaModal` | API de busca, debounce, grupos de resultados, setas/Enter/Escape. Cores por entidade e símbolo de Enter; adotar neutros e ícone, preservar seleção/atalhos. |
| `ClienteModal` | RHF/Zod, PF/PJ, contato/endereço, segunda etapa opcional equipamento; erros por campo, loading e fechamento. Tipos com emojis; labels uppercase e estilos de campo duplicados. |
| `MaquinaModal` | Busca de proprietário, tipo, marca/modelo/ano/série/horímetro/potência/tensão/observações, validação e POST/PUT. Emojis e constante de campo duplicada. |
| `ProdutoModal` | Tipo/categoria/fornecedor, preço/margem/saldo/local, legado preservado, validação e POST/PUT. `TIPOS_PRODUTO_FORMULARIO` fornece emojis; formulários longos precisam manter corpo rolável e ações acessíveis. |
| `MovimentacaoEstoqueModal` | Tipo, quantidade, valor, motivo, saldo projetado, validações. Cores distintas para cada movimento; trocar por seleção âmbar e ícones direcionais neutros, mantendo erros de saldo. |
| `CompatibilidadeModal` | Buscar/selecionar máquina, observação, vincular/desvincular, lista, erros/sucesso/loading. Padronizar campos, alertas e ações destrutivas. |
| `ConfirmModal` | Escape, loading, confirmar/cancelar; vermelho/âmbar conforme intenção. Falta contenção/restauração de foco; usar padrão compartilhado de dialog sem reescrever callbacks. |
| `EmptyState` | Ícone/título/descrição/ação; título 12px e descrição 11px. Aumentar leitura e remover moldura pontilhada excessiva. |
| `OrdemServicoImpressao` | Recibo A4 via helpers e configuração do backend, dados cliente/máquina/itens/totais. Manter layout claro de impressão isolado: branco de papel/preto técnico são exceção de mídia, não nova identidade cromática. |
| `InstallAppButton` | Prompt nativo quando disponível; instruções manuais em portal fora do header sticky, Escape/fechar/Entendi. Preservar comportamento, padronizar botão/superfície/foco e manter ações visíveis em 360px. |
| `PwaInstallProvider` | Mantém evento de instalação entre navegações; detecta standalone/iOS e appinstalled. Lógica preservada; tema do manifesto/ícones passa a consumir grafite comum de `lib/brand.ts`. |

Componentes locais: filtros e paginação das listagens; `Campo` em configurações; controles de abas, laudo e dialogs de peça/status na OS; presets e tabelas em relatórios. Não introduzir abstrações para contratos distintos; extrair somente estilo de controles, superfície de dialog, métricas e ícones de domínio.

## Cores e emojis encontrados

`globals.css` só define fundo/texto claro/escuro; páginas usam `slate`, `amber`, `red`, `rose`, `emerald`, `green`, `blue`, `sky`, `cyan`, `indigo`, `purple`, `orange`, além de hex independentes (`#f59e0b`, `#d97706`, `#b45309`, `#533804`, `#1b263b`, fundos `#070a10`/`#0c101a`).

Evidências: `dashboard/page.tsx` cartões verde/roxo/azul/vermelho e sombras coloridas; `lib/types.ts` oito cores de OS e cinco de movimentação; `ordens-servico/[id]/page.tsx` ações por cor; `Header.tsx` active/avatares hardcoded; `relatorios/page.tsx` métricas/exports coloridos.

Emojis estáticos: raio/bateria/chave em `MaquinaModal`, `ClienteModal`, listagem e detalhe de máquinas; plugue/raio em `lib/types.ts`; raio/bateria/caixa/ferramentas/alfinete em produtos; raio/caixa/relógio/prancheta nas quatro abas da OS. Há também caracteres de check/fechar e Enter. `whatsappHelper.ts` inclui mão acenando nos modelos gerados pelo sistema: remover somente o adorno, mantendo mensagens do usuário e informação operacional.

## Prioridades e proposta

1. **Fundação:** tokens Tailwind v4 sem dependências: fundo/superfícies/texto/borda/ação/perigo; escala de espaço 4px, raios 6/10/14px, sombra apenas elevação, ícones 16/20/24px, controles 40px, tabelas 44px, foco 2px.
2. **Compartilhados:** classes semânticas de botão/label/field/panel/dialog/table, ícones Lucide de domínio e foco de modal. Evitar trocar contratos, endpoints, IDs, regras ou validações.
3. **Módulos:** dashboard operacional primeiro; OS e cadastros em seguida; estoque/relatórios/configuração/login por último. Migração de classes é apenas parte da implementação, acompanhada de redução estrutural da decoração e revisão semântica por contexto.
4. **Estados:** sucesso/ativo/concluído neutros com texto/ícone; seleção/foco/atenção âmbar; erro/exclusão/crítico vermelho. Saídas de estoque e inatividade não são falhas.
5. **Validação:** capturas antes/depois com os mesmos dados, todas as telas em 360/390/768/1024/1366/1920; modais/abas/menus/print; lint, TS, build, unitários e Playwright. Integração real só no ambiente descartável de CI conforme teste existente.

Paleta final: grafite `#0B1017`, gelo `#E7E9ED`, âmbar `#D4A64A`, vermelho `#D78181`. O vermelho parte da referência `#C76565`, com luminosidade ajustada para alcançar 4,5:1 inclusive em superfície de hover. Superfícies e texto secundário são variações neutras. Imagens fotográficas e favicon preexistentes são assets de marca; a fotografia do login recebeu tratamento monocromático em CSS. Os metadados PWA e a geração de PNG precisam de um valor fora do CSS: `lib/brand.ts`, mantido em paridade com o token grafite por teste.

## Resultados

Implementação concluída na branch de refatoração, após incorporar o PWA de `main`. [Design System](design-system.md), [registro dos arquivos e decisões](registro-refatoracao-visual.md) e [comparativo com 76 PNGs](visual/README.md).

| Verificação final | Resultado |
| --- | --- |
| `npm run lint` | Aprovado, sem erros ou avisos de código |
| `npx tsc --noEmit` | Aprovado |
| `npm run build` | Aprovado; 18 entradas no build incluindo manifesto e ícones PWA |
| `node --experimental-strip-types --test --test-reporter=dot src/lib/*.test.ts` | 362 testes aprovados |
| `npx playwright test --workers=2` sobre build de produção | 88 aprovados, 2 ignorados pelas condições existentes; 57,3 segundos |
| Paleta e emojis estáticos | Teste aprovado em `app`, `components` e `lib`; sem emojis nem classes cromáticas externas na UI autoral |
| Contraste dos tokens | Texto ≥ 4,5:1 e bordas de controles ≥ 3:1 nas superfícies sólidas testadas |
| Responsividade | 14 telas × 6 larguras; 10 dialogs × 6 larguras, sem overflow global; matriz anterior de 320–2560px também aprovada |
| Teclado e modais | Tab/Shift+Tab contidos, Escape e restauração de foco aprovados nos dez dialogs; campos e botões com nomes acessíveis |
| Impressão | Testes A4, textos contínuos, cinco colunas, configuração e isolamento do recibo aprovados |
| Escopo | Nenhum diff no backend, migrations, `api.ts`, middleware, dependências ou lockfile |

Os dois skips são o login com credenciais administrativas reais não fornecidas no ambiente e a integração banco/SMTP executada apenas no ambiente descartável de CI. Não foram adicionados skips, removidos asserts nem ampliados timeouts.

Ocorrências investigadas: overflow de 7px em produtos/320px corrigido por quebra das ações; controles sem nome no mobile corrigidos; foco de retorno do modal de peça corrigido antes do autofocus; vermelho clareado após teste de contraste. Uma execução interrompida registrou dois timeouts com duração anormal de aproximadamente 16 minutos; ambos passaram isoladamente sem alterações e passaram novamente na suíte final completa.

Avisos preexistentes do ambiente: convenção `middleware` depreciada pelo Next e comando `next start` usado pelo harness existente apesar de `output: standalone`. A suíte de produção completou com sucesso; a migração desses mecanismos não fez parte da mudança visual.

Limites: a verificação automatizada não certifica conformidade WCAG integral nem substitui testes com leitores de tela/dispositivos físicos. Instalação nativa do sistema operacional depende do navegador/HTTPS; o manifesto, PNGs e fluxo de instruções foram testados. As capturas usam fixtures sintéticos e não representam dados operacionais reais. O PR será aberto para revisão, sem integração automática à `main`.
