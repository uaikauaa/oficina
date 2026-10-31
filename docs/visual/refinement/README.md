# Refinamento visual final — 29/10/2026

Segunda rodada de acabamento do frontend, a partir de `a8c7389`. Paleta, fotografia, stack e contratos existentes foram mantidos. Backend, migrations, credenciais e regras de autenticação não foram alterados.

## Notificações e acabamento

Os toasts de OS e relatórios usavam fundos com apenas 5% de opacidade; erros e avisos também misturavam a cor do estado diretamente com o conteúdo atrás. A apresentação agora é compartilhada em `FeedbackNotice` e usa a superfície elevada sólida `#1c232b`, com texto `#e7e9ed` (contraste calculado de 13,04:1). A cor semântica fica no ícone e na borda discreta, sem blur ou transparência na mensagem.

O componente atende OS, relatórios, clientes, produtos e nova OS. Mensagens, ações, posição superior/inferior/interna e timers continuam sob controle de cada tela. Erros de OS continuam visíveis até o fechamento; os demais tempos de exibição foram preservados. Foram incluídos anúncios `status`/`alert`, quebra de textos extensos e botão de fechar com nome acessível.

Toasts flutuantes têm largura limitada ao viewport, margem de 16px, suporte a safe areas e rolagem em telas baixas. O header tem fundo sólido, navegação menos carregada, controles mais uniformes e painel de notificações opaco. O painel permite rolagem, quebra de linha nas ações e fechamento explícito. Bordas de superfícies e botões secundários foram suavizadas dentro dos tokens existentes.

## Login

A fotografia original voltou a ter cor, com saturação controlada e overlays escuros mais leves. O formulário mantém superfície sólida, separação clara da imagem, pesos tipográficos moderados e mais espaço útil em 1024px. A apresentação mobile ganhou título com hierarquia própria e uma lista simples de recursos, substituindo os cards repetidos.

O texto “Sistema interno • Oficina Gestão” foi removido de ambas as versões. A barra decorativa ao lado do título do formulário também foi removida. Login, senha visível/oculta, manter conectado, mensagem de recuperação de senha, CSRF, loading, verificação de sessão, 2FA, expiração, reenvio e limite de tentativas foram preservados. O modal mobile usa altura dinâmica, rolagem interna e o gerenciador de foco já existente no projeto.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run lint` | Passou, sem erros ou avisos |
| `npm run build` | Passou, incluindo TypeScript da aplicação |
| `npm test` | 362 testes passaram |
| Playwright, build de produção na porta 3001 | 104 cenários passaram |
| Playwright, regressão de logout na porta 3000 | 10 cenários passaram |
| `git diff --check` | Passou |
| Checagem adicional `npx tsc -p e2e/tsconfig.json --noEmit` | Aprovada na revisão do PR #9; adicionada como etapa obrigatória do CI |

Os 104 cenários incluem 28 novos testes de refinamento e as suítes existentes de responsividade, interações, formulários, produto, impressão, PWA e recuperação de sessão. Foram verificadas 360, 390, 768, 1024, 1366 e 1920px, além da matriz anterior de 320 a 2560px. Não foi observado overflow horizontal global; tabelas continuam com rolagem interna. Modais, notificações e seus controles foram verificados dentro do viewport. O modal de login também foi exercitado em 360×520px, com Tab, Shift+Tab, Escape e retorno de foco.

As respostas dos cenários operacionais e de autenticação são sintéticas, interceptadas no navegador: não houve criação ou alteração de registros reais para validar a interface. O servidor de desenvolvimento permaneceu disponível na porta 3000 durante a validação do build em 3001.

Na revisão do PR #9, os sete diagnósticos `TS2339` dos testes E2E em `frontend/e2e/forms-b02-b07.spec.ts` foram corrigidos substituindo os acessos de propriedades de uma variável capturada assincronamente por asserções de objeto com Playwright, sem alterar os cenários nem o comportamento de produção. A validação `npx tsc -p e2e/tsconfig.json --noEmit` passou no GitHub Actions, onde agora é obrigatória antes dos testes de navegador. Os avisos preexistentes sobre `middleware` e uso de `next start` com saída `standalone` permanecem fora da alteração visual.

## Antes e depois

Todas as imagens usam dados sintéticos. O baseline foi capturado antes das alterações no servidor de desenvolvimento; o resultado final usa o build de produção, sem o indicador de desenvolvimento do Next.js. As capturas são de página inteira, com viewport de 900px de altura.

| Comparação | Antes | Depois |
| --- | --- | --- |
| Login desktop, 1366px | [Antes](before/login-1366.png) | [Depois](after/login-1366.png) |
| Login mobile, 390px | [Antes](before/login-390.png) | [Depois](after/login-390.png) |
| Formulário mobile, 390px | [Antes](before/login-form-390.png) | [Depois](after/login-form-390.png) |
| Toast sobre a OS, 1366px | [Antes](before/toast-os-1366.png) | [Depois](after/toast-os-1366.png) |
| Toast sobre a OS, 390px | [Antes](before/toast-os-390.png) | [Depois](after/toast-os-390.png) |
| Notificações, 1366px | [Antes](before/notificacoes-1366.png) | [Depois](after/notificacoes-1366.png) |
| Notificações, 390px | [Antes](before/notificacoes-390.png) | [Depois](after/notificacoes-390.png) |

Estados complementares: [2FA desktop](after/login-2fa-1366.png), [2FA mobile](after/login-2fa-390.png), [erro desktop](after/login-error-1366.png), [erro mobile](after/login-error-390.png), [notificações preenchidas desktop](after/notificacoes-preenchidas-1366.png), [notificações preenchidas mobile](after/notificacoes-preenchidas-390.png), [exportação desktop](after/toast-relatorios-1366.png) e [exportação mobile](after/toast-relatorios-390.png).

## Arquivos alterados

- [globals.css](../../../frontend/src/app/globals.css): superfícies, bordas e estilos compartilhados dos feedbacks.
- [login/page.tsx](../../../frontend/src/app/login/page.tsx): fotografia, tipografia, alertas, modal e remoção do texto institucional.
- [Header.tsx](../../../frontend/src/components/Header.tsx): navegação, ações e notificações.
- [FeedbackNotice.tsx](../../../frontend/src/components/ui/FeedbackNotice.tsx): componente de apresentação compartilhado, novo.
- [clientes/page.tsx](../../../frontend/src/app/(authenticated)/clientes/page.tsx): apresentação dos feedbacks de sucesso/erro.
- [produtos/page.tsx](../../../frontend/src/app/(authenticated)/produtos/page.tsx): apresentação dos feedbacks de sucesso/erro.
- [ordens-servico/[id]/page.tsx](../../../frontend/src/app/(authenticated)/ordens-servico/[id]/page.tsx): toasts superiores de OS.
- [ordens-servico/nova/page.tsx](../../../frontend/src/app/(authenticated)/ordens-servico/nova/page.tsx): feedback de cadastro.
- [relatorios/page.tsx](../../../frontend/src/app/(authenticated)/relatorios/page.tsx): toasts inferiores de exportação.
- [visual-refinement.spec.ts](../../../frontend/e2e/visual-refinement.spec.ts): cobertura nova e capturas finais.
- [visual-review.spec.ts](../../../frontend/e2e/visual-review.spec.ts) e [visual-interactions.spec.ts](../../../frontend/e2e/visual-interactions.spec.ts): diretório de evidências configurável, preservando as capturas da primeira rodada.
- [playwright.config.ts](../../../frontend/playwright.config.ts): porta configurável para testar produção sem interromper o desenvolvimento.
- Este relatório e as capturas em `before/` e `after/`.

## Reproduzir

No diretório `frontend`, em PowerShell:

```powershell
$env:INTERNAL_BACKEND_URL = 'http://127.0.0.1:8080'
npm run build
$env:PLAYWRIGHT_PORT = '3001'
$env:VISUAL_OUTPUT_DIR = 'test-results/visual-regression'
npx playwright test e2e/visual-refinement.spec.ts e2e/visual-review.spec.ts e2e/visual-interactions.spec.ts e2e/a01-a06-regression.spec.ts e2e/forms-b02-b07.spec.ts e2e/print-config-b11.spec.ts e2e/produto-modal.spec.ts e2e/pwa-install.spec.ts e2e/session-recovery.spec.ts --workers=3
Remove-Item Env:PLAYWRIGHT_PORT
npx playwright test e2e/logout.spec.ts --workers=1 --output=test-results/logout-refinement
```
