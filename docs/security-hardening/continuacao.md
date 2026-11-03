# Continuação do PR #13 — controles compartilhados e proxy privado

Esta revisão substitui o estado dos achados ABUSE-01, EDGE-01, CSP-01 e DATA-01 registrado em `b968f5e`. PR permanece **draft**, sem merge ou deploy. Todo dado usado nos ensaios foi sintético; não houve conexão com Neon, SMTP ou serviços Google de produção.

## Resultado por requisito

| Requisito | Implementado e comprovado localmente | Dependência de homologação real |
|---|---|---|
| ABUSE-01 | Migration Flyway V23, contadores PostgreSQL por UPSERT atômico, relógio do banco, HMAC dos identificadores, transação REQUIRES_NEW independente do rollback de login. Não há fallback para memória. Cotas antes da autenticação e por usuário/operação. Concorrência, expiração, reinicialização, rollback e distribuição testados. | Latência/capacidade Neon com réplicas Cloud Run, cadeia real de proxies, WAF e custo. |
| EDGE-01 | Route Handler Node substitui rewrite. Busca identidade no metadata server fixo, valida audience/expiração, cacheia até antes de expirar, mantém JWT da aplicação em Authorization e IAM em X-Serverless-Authorization. Preserva cookies separados, CSRF, métodos, erros, Retry-After e streaming PDF/CSV. | IAM real, audience emitida pelo Google, conta de serviço do frontend, ingress e revogação de invoker. |
| CSP-01 | Nonce criptográfico novo em cada resposta HTML, CSP de scripts com nonce/strict-dynamic, sem unsafe-inline/unsafe-eval em produção. Renderização dinâmica no layout; hidratação, login, 2FA, PWA e responsividade passaram no Chromium. HTML com script injetado sem nonce foi bloqueado. | Validar domínio/HTTPS real e demais navegadores de suporte. A exceção de estilos por atributo está descrita abaixo. |
| DATA-01 | Corpo de 64 KiB por bytes reais, incluindo chunked, parâmetros/páginas limitados, cotas persistentes por operação e exportação CSV limitada com erro explícito. Query timeout Hibernate de 10 s. Health compartilha amostra por 3 s para evitar rajadas de conexões. | Ajustar os valores com carga/custos medidos; configurar concorrência, instâncias, rede e limites do provedor. |
| TLS/IAM/Neon/SMTP | Ferramentas de homologação guardadas por ambiente isolado, mais testes locais positivos e negativos de TLS/STARTTLS. | **Não executado no Google Cloud/Neon/SMTP remoto. Não aprovado.** |
| Playwright ignorados | O login sem credenciais foi convertido em cenário determinístico sintético. A integração real usa seleção explícita e foi executada separadamente, sem mocks, PostgreSQL e Mailpit descartáveis. | Não representa aprovação de uma conta operacional ou de SMTP público. |

## Implementação e limites

`SharedRateLimitService` serializa cada contador pela chave primária PostgreSQL. O valor e a expiração são atualizados numa operação `INSERT ... ON CONFLICT ... RETURNING`. O limite é aplicado ao resultado dessa operação, inclusive entre réplicas. A gravação usa transação própria; um 401 ou rollback posterior não a apaga. Chaves contêm somente escopo e HMAC, sem IP/e-mail em claro. Limpeza indexada remove até 5.000 entradas expiradas a cada 10 s. Banco indisponível gera 503, sem liberar solicitações sem limite.

| Escopo | Orçamento padrão | Local da decisão |
|---|---|---|
| API total | 5.000/min compartilhado | Antes da autenticação, exceto OPTIONS/probe |
| IP verificado | 600/min | Antes da autenticação |
| Login | 10 requisições/min/IP; 5 falhas/15 min por IP e par IP/conta | Antes de autenticar + AuthService persistente |
| Verificar 2FA / reenviar | 20/min/IP / 5/min/IP | Antes de autenticar; continuam as 5 tentativas/desafio e orçamento persistente de e-mail por conta |
| Refresh, logout e CSRF | 60/min/IP | Antes da autenticação |
| Usuário autenticado | 600/min | Interceptor após autorização |
| Busca / mutações / relatórios | 60 / 60 / 120 por min/usuário | Interceptor antes do negócio |
| PDF, recibo e documento de serviço | 10/min/usuário | Uma cota compartilhada para os três aliases |
| Body / query / parâmetros | 65.536 bytes / 4.096 caracteres / 30 parâmetros, até 512 caracteres por valor | Next + Spring; corpo comprimido rejeitado |
| Página / tamanho | page 0..10.000; size 1..200; duplicações rejeitadas | Spring, antes dos resolvers |
| Exportação CSV | Até 10.000 registros e 100 páginas; sem truncamento silencioso | Helper do frontend e cotas de relatórios no backend |

São janelas fixas: duas rajadas próximas da fronteira de expiração podem consumir duas janelas. Os limites são proteção proporcional de aplicação e não substituem mitigação de DDoS na borda. Falhas de senha não são esquecidas quando uma conta válida autentica no mesmo IP; somente o par IP/conta é limpo. Os mecanismos 2FA existentes continuam limitados e transacionais.

## Identidade entre serviços e IP do cliente

No Cloud Run (`K_SERVICE`), o frontend exige HTTPS, identidade Google ativa, `TRUSTED_PROXY_HOPS` de 1 a 5 e `SERVICE_PROXY_SECRET` com pelo menos 32 caracteres. O backend também exige o segredo de contexto no Cloud Run. Usar Secret Manager para esse segredo compartilhado, distinto de JWT_SECRET. A inicialização recusa configuração incompleta. Não há token IAM nem segredo em variável NEXT_PUBLIC.

O frontend descarta headers de IAM/contexto fornecidos pelo navegador. Ele seleciona o IP do sufixo confiável de X-Forwarded-For conforme a cadeia **que deverá ser verificada no ambiente**, e assina IP, timestamp, método e caminho. O backend valida HMAC em tempo constante e uma janela de 30 s antes de usar o IP. Contexto ausente, expirado ou adulterado retorna 403 no Cloud Run. Isso evita agrupar todos os usuários pelo endereço do serviço intermediário e impede que um header arbitrário do navegador escolha o contador. A configuração de hops não é uma prova da cadeia: sua validação real continua bloqueante.

O ID token Google vem apenas de `metadata.google.internal`, com `Metadata-Flavor: Google`, audience igual à origem do serviço backend e validação de expiração antes do cache. O IAM do Cloud Run precisa verificar assinatura e permissão reais; os testes de metadata locais usam respostas sintéticas e **não substituem essa verificação**. Redirecionamentos externos do backend são rejeitados para não enviar credenciais a outra origem. Cabeçalhos retornados são selecionados; IAM/contexto nunca voltam ao cliente. Downloads não são acumulados em memória no proxy.

Fonte da implementação: [autenticação entre serviços Cloud Run](https://docs.cloud.google.com/run/docs/authenticating/service-to-service). A migração de CSP seguiu o guia da versão Next instalada em `frontend/node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`.

## Evidências e regressões

| Gate executado | Resultado local final |
|---|---|
| Java 21, Maven clean verify, PostgreSQL/Flyway | 820 testes, zero falhas/erros/skips |
| ESLint e TypeScript aplicação/E2E | Passaram |
| Unitários frontend | 370 passaram, zero skips |
| Next produção + Playwright mockado/UI | Build passou; 118 cenários passaram, zero skips |
| Playwright de stack real separado | 1 cenário passou, zero skips; SMTP Mailpit real |
| Distribuição HTTP entre duas JVMs | 12 tentativas concorrentes: 10 rejeições de credencial e 2 respostas 429; bloqueio mantido nas duas JVMs após reiniciar uma |
| Transporte Next standalone | Métodos, cookies, JWT/CSRF, erros, PDF/CSV, 413 passaram |
| TLS/SMTP sintéticos | 2 testes passaram, incluindo CA/hostname negativos e STARTTLS obrigatório |
| Docker + Trivy runtime | Duas imagens construídas; zero CVEs conhecidos e zero segredos detectados em cada imagem |

Os quatro workflows do PR são reexecutados no head publicado; os links e a conclusão remota ficam registrados na descrição do [PR #13](https://github.com/uaikauaa/oficina/pull/13). A suíte de integração CI usa o mesmo runner de duas JVMs/reinicialização. Esses resultados não são homologação Google Cloud.

- `SharedRateLimitIntegrationTest`: 64 operações concorrentes, 8 threads e 3 clientes independentes do mesmo PostgreSQL; exatamente 7 admissões para orçamento 7. Inclui estado persistente após recriar o serviço, expiração, rollback externo e limitação global de sujeitos distribuídos.
- `ResourceLimitsIntegrationTest`: HTTP real, payload com Content-Length e chunked, páginas fora do limite, poluição de parâmetros, aliases PDF, mutações, busca, relatórios e headers XFF falsificados. Requisições rejeitadas por CSRF também consomem cota de login.
- `ResourceLimitsFailureTest`: indisponibilidade do contador gera 503; contexto inválido gera 403; nenhuma das falhas libera o handler nem expõe detalhes.
- `ProxyClientContextVerifierTest` + `backendProxy.test.ts`: HMAC, método/caminho, expiração, assinatura, sufixo configurado, isolamento entre token IAM e token da aplicação, erros, dois Set-Cookie e bytes exatos de download.
- `test-proxy-runtime.mjs`: Next standalone real contra fixture local, cobrindo métodos, cookies/JWT/CSRF, 401/403/404/429/500, Retry-After, PDF/CSV e 413.
- `tls-isolated.test.mjs`: certificados efêmeros gerados no diretório temporário e apagados; CA confiável, CA inválida, hostname errado e SMTP que exige STARTTLS antes de AUTH. Nenhum e-mail é enviado por esse ensaio.
- `strict-csp.spec.ts`: nonces diferentes entre respostas, nonce no HTML, hidratação, tentativa de script refletido no HTML sem nonce, manifest e ícones PWA. Os demais testes cobrem login, 2FA e viewports 320–1920 px. `style-src-attr 'unsafe-inline'` permanece para atributos de estilo usados por React; scripts e blocos de estilo não ganham essa permissão.
- `test-real-stack-local.mjs`: navegador e API reais, migrations de produção em banco descartável e Mailpit local; em seguida duas JVMs fazem tentativas concorrentes e uma delas é reiniciada preservando o bloqueio. Nenhum serviço operacional é usado.

## Dois testes anteriormente ignorados

O cenário de login dependia de INITIAL_ADMIN_EMAIL/PASSWORD locais e aceitava até navegação direta ao dashboard. Agora usa conta sintética com resposta controlada e exige a tela de 2FA, sem credenciais externas. Não é mais ignorado.

A integração real requer PostgreSQL, Mailpit, API e dados isolados. A configuração padrão não a coleta; `RUN_REAL_INTEGRATION=true` a seleciona no runner próprio. Ela foi **executada separadamente**, e o workflow `integration-real.yml` executa a stack e o ensaio de duas JVMs. A exclusão da suíte mockada evita usar serviços/credenciais operacionais; não é contada como teste aprovado. O relatório apresenta as duas execuções separadamente, com zero skips nas execuções realizadas.

## Matriz de riscos residuais

| ID | Gravidade residual | Evidência que falta | Decisão |
|---|---|---|---|
| HML-IAM | Alta | Chamador real permitido, anônimo e outra conta negados, audience errada negada, invoker/ingress e identidade do frontend | Bloqueia homologação e produção; executar roteiro isolado |
| HML-IP | Alta | Cadeia GFE/Load Balancer medida; sufixo XFF seleciona o IP real em duas origens distintas; prefixos falsificados não mudam o contador | Bloqueia homologação; não fixar hops por suposição |
| HML-TLS | Alta | Certificados/HTTPS do domínio, JDBC verify-full no Neon de teste, SMTP sandbox autenticado com STARTTLS e certificados válidos | Bloqueia homologação; testes locais não aprovam o provedor |
| HML-COST | Média | Throughput e latência de UPSERT, saturação do pool, concorrência Cloud Run e custo sob carga sintética | Dimensionar antes de liberar; o contador falha fechado |
| HML-SECRETS | Alta | Secret Manager/IAM e criptografia/acesso a backups, rotações testadas do segredo de serviço e JWT | Nenhuma credencial real foi examinada ou aprovada |
| CSP-STYLE | Baixa | Estilos por atributo ainda permitidos, mantendo layout e estilos dinâmicos atuais | Exceção explícita de CSS; não permite scripts inline |
| RATE-WINDOW | Média | Janela fixa permite rajada na fronteira; tráfego antes do Next exige proteção de borda | Quotas/WAF e calibração na homologação; sem alegação de proteção absoluta contra DDoS |
| CONTEXT-REPLAY | Baixa | Contexto HMAC pode ser reutilizado durante até 30 s se capturado no canal confiável | TLS + IAM + método/caminho + JWT/CSRF; contexto não autoriza recurso de negócio |
| CSV-LARGE | Baixa | Exportações acima de 10.000 linhas passam a exigir filtro mais restrito | Erro explícito; exportação assíncrona maior fica fora deste escopo |
| EDITOR | Não classificada | Mensagens exatas dos aproximadamente 540 diagnósticos VS Code | Pendente; Maven não permite declarar todos os diagnósticos do editor resolvidos |

Consulte [o roteiro de homologação](homologacao.md), [matriz de rotas atualizada](matriz-rotas.md), SBOM/árvore e JSONs Trivy neste diretório. A aprovação dos testes locais não concede aprovação ao ambiente Google. O PR segue draft e a produção segue **NO-GO** até executar e registrar os gates reais acima.
