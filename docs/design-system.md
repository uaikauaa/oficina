# Design System — Oficina Gestão

Identidade industrial, com hierarquia operacional e paleta restrita. Implementação em `frontend/src/app/globals.css`; sem bibliotecas adicionais. Valores para metadados e PNG ficam em `frontend/src/lib/brand.ts` porque esses consumidores não interpretam CSS.

## Cores e intenção

| Token / classes Tailwind | Uso |
| --- | --- |
| `canvas` / `#0B1017` | Fundo principal, campos e backdrop por opacidade |
| `surface`, `elevated`, `hover` | Camadas neutras `#131920`, `#1C232B`, `#262E37` |
| `ink` / `#E7E9ED` | Texto, ícones e informação principal |
| `muted`, `subtle` | Texto secundário e auxiliar, `#B2B8C1`, `#979FA9` |
| `line`, `control` | Separadores discretos e bordas de campos, `#303943`, `#73808C` |
| `accent` / `#D4A64A` | Ação principal, seleção, foco, atenção |
| `danger` / `#D78181` | Erro, exclusão, cancelamento e criticidade real |
| `inverse` | Texto grafite sobre ações sólidas âmbar/vermelho |

São quatro famílias principais; os demais valores são variações dos neutros. O vermelho de referência `#C76565` foi clareado para leitura em superfícies elevadas/hover. Nenhum status depende só da cor: rótulos permanecem em todos os badges; seleção de botões expõe `aria-pressed`, navegação expõe `aria-current`.

Exceções: recibo usa papel branco e tinta escura para impressão A4; logo, favicon e ícones PNG reutilizam o asset de marca existente. O login usa foto monocromática; o dashboard deixou de usar banner fotográfico e marcas d'água.

## Medidas e tipografia

- Espaçamento base: 4px (`--spacing`), grupos 12/16/24/32px.
- Raio: 6px em detalhes, 10px em controles, 14px em painéis/dialogs.
- Fonte: Geist; Geist Mono para identificadores. Títulos 20–28px, seção 16px, corpo 14px, auxiliares/labels 13px; texto operacional de 9–11px removido.
- `.ui-page-title` controla títulos; `.ui-section-title` controla seções; números de tabela e métricas usam algarismos tabulares.
- Controles: 40px de altura. Ações somente com ícone têm alvo mínimo de 32px; ícones compactos padronizados em 16px, com 20/24px para hierarquia maior.
- Tabela: `.ui-table`, espaçamento de célula 14×16px, divisórias discretas e rolagem horizontal contida no componente.
- Sombras neutras para elevação. Não usar brilho colorido ou movimento decorativo de cartões.

## Padrões reutilizáveis

| Padrão | Como usar |
| --- | --- |
| Botão principal | `ui-btn ui-btn-primary`; nova OS, salvar ou confirmar ação principal |
| Secundário | `ui-btn ui-btn-secondary`; cancelar, impressão, WhatsApp e ações paralelas |
| Terciário | `ui-btn ui-btn-ghost`; ação contextual de baixo destaque |
| Destrutivo | `ui-btn ui-btn-danger`; confirmar exclusão/inativação |
| Ícone | `ui-icon-btn` com `aria-label` ou `title` significativo |
| Campo/label | `ui-field` + `ui-label`; associar `htmlFor` ao ID do controle |
| Painel | `ui-panel`; neutro com borda discreta |
| Dialog | `ui-dialog`; corpo rolável e altura limitada ao viewport |
| Métrica com destino | `MetricCard`; label, valor, descrição, Lucide e link completo |
| Ícone de domínio | `DomainIcon`; equipamento/produto sem emojis, `aria-hidden` |
| Foco modal | `DialogFocus`; Tab/Shift+Tab contidos e retorno ao acionador; `onDismiss` opcional para dialogs locais |
| Vazio | `EmptyState`; ícone neutro, título, explicação curta e ação opcional |

## Estados e acessibilidade

Sucesso, ativo, disponível e concluído usam neutros com texto e ícone de confirmação. Atenção/baixo estoque usam âmbar; estoque zerado e falhas reais usam vermelho. Movimentações normais de entrada/saída/ajuste têm nomes e ícones direcionais, sem atribuir cor de erro a uma saída normal.

Foco visível de 2px com afastamento de 3px; link para pular navegação; bordas de campos atingem 3:1 contra superfícies sólidas. Teste automatizado calcula 4,5:1 para os tokens de texto nas quatro superfícies, e 4,5:1 para texto sobre ações sólidas. Esses testes não equivalem a certificação integral WCAG.

Dialogs preservam Escape e bloqueios de envio; foco é capturado antes do autofocus dos campos, contido durante navegação e restaurado ao fechar. Labels existentes foram associados sem renomear IDs originais, nomes de campos ou endpoints. Campos de busca/filtros recebem nomes acessíveis. Redução de movimento respeita a preferência do sistema.

Referências: [WCAG 2.2 — contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) e [WAI-ARIA — dialogs modais](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## Manutenção e validação

Alterar cores e medidas centrais no CSS e manter `brand.ts` em paridade para o PWA. Não voltar a atribuir cores por módulo nem inserir emojis em textos estáticos; dados e mensagens digitados pelos usuários permanecem livres.

`designSystem.test.ts` impede emojis e classes de cores externas e verifica contrastes/paridade PWA. `visual-review.spec.ts` cobre as 14 telas em seis larguras. `visual-interactions.spec.ts` cobre dez dialogs, teclado e abas. Os testes funcionais existentes continuam sendo a referência para contratos, autenticação, formulários, relatórios e impressão.
