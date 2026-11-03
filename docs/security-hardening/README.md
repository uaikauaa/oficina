# Auditoria de segurança e hardening — 03/11/2026

**Revisão mais recente:** [auditoria independente sobre 6566c3a e correções subsequentes](../auditoria-independente-20261103/README.md), com 60 cenários e nova cobertura das 83 rotas. Os resultados abaixo são históricos, não prova suficiente da árvore atual.

**Estado atualizado do PR #13:** veja [continuação da implementação, evidências e riscos residuais](continuacao.md). O texto abaixo preserva o registro inicial de `b968f5e`; os estados ABUSE-01, EDGE-01, CSP-01 e DATA-01 foram substituídos pela continuação. Nenhum resultado local aprova automaticamente IAM, Neon ou SMTP do ambiente Google.

**Base:** `main` em `65e7e44b7f37383f605cfec54ea21a3d5a6a4d36` (PR #12). Trabalho isolado em `security/hardening-production-20261103`, PR #13. Nenhum deploy, merge ou acesso ao Neon de produção foi realizado. O PDF de pesquisa fornecido pelo solicitante foi lido como catálogo de ameaças; as decisões abaixo usam o código e testes desta revisão.

## Escopo e evidências

- [Matriz das 83 combinações de método e rota](matriz-rotas.md), [inventário estruturado](rotas-api.json), com autenticação, autorização, CSRF, entrada e dados processados. A matriz testa a fronteira HTTP com Spring Test; não prova cada regra de negócio para todo corpo JSON.
- [SBOM CycloneDX do backend](sbom-backend.json), [Trivy backend](trivy-backend.json) e [Trivy frontend](trivy-frontend.json). As duas varreduras finais de imagem retornaram **0 CVEs** de severidade baixa a crítica. Isso descreve o banco de advisories e as imagens examinadas, não ausência de falhas desconhecidas.
- `npm audit --omit=dev`: 0 alertas de runtime. O audit completo mantém 16 moderados em ferramentas de desenvolvimento, já registrados no [relatório anterior](../integracao-final/cves.md).
- Java 21.0.12.1; `backend/./mvnw.cmd -B -ntp clean verify -Djunit.jupiter.execution.parallel.enabled=false` com PostgreSQL 16 descartável, `TEST_DB_*` explícitos e migrations sintéticas verificadas. Resultado final: ver seção **Testes**.
- `frontend`: `npm ci`, ESLint, `tsc --noEmit`, 364 testes unitários, build Next.js 16.4.1, Playwright e builds Docker. Testes ofensivos limitados a mocks/containers locais.
- Trivy secret scanner `fs --offline-scan --scanners secret`, excluindo `.git`, `node_modules`, `.next` e `target`: 0 achados. A primeira tentativa online falhou com HTTP 429 no Maven Central; a execução offline completou. Não é prova de inexistência de segredos fora dos arquivos examinados ou do histórico Git.

## Dependências: antes e depois

O baseline do [PR #12](../integracao-final/cves.md) registrava 13 alertas: 3 críticos, 4 altos, 5 médios e 1 baixo **segundo Trivy**. Spring Boot 3.4.13 gerenciava Framework 6.2.19, Security 6.4.13, Data Commons 3.4.13 e Micrometer 1.14.14. Migramos para Spring Boot **4.0.9**, Framework **7.0.10**, Security **7.0.8**, Data Commons **4.0.8** e Micrometer **1.16.8**, via BOM oficial. Também foram validados Hibernate 7.2.25.Final, Flyway 11.14.1, springdoc 3.2.0, PostgreSQL JDBC 42.7.12, JWT 0.12.6, OpenPDF 2.0.3 e SMTP. O bridge Jackson 2 do Boot 4 preserva a serialização REST existente. Java 21 foi mantido. A árvore Maven foi regenerada e a SBOM foi produzida após a migração; não há ignorefile global de CVEs.

| CVE | Dependência afetada no baseline; severidade Trivy | Resultado após atualização |
|---|---|---|
| 2026-40984 | Micrometer Core; alta | Micrometer 1.16.8; ausente do Trivy final |
| 2026-40973 | Spring Boot; alta | Boot 4.0.9; ausente |
| 2026-41001 | Spring Boot autoconfigure; média | Boot 4.0.9; ausente |
| 2026-41695 | Spring Data Commons; alta | Data Commons 4.0.8; ausente |
| 2026-41716 | Spring Data Commons; alta | Data Commons 4.0.8; ausente |
| 2026-41711 | Spring Data Commons; média | Data Commons 4.0.8; ausente |
| 2026-41721 | Spring Data Commons; média | Data Commons 4.0.8; ausente |
| 2026-22751 | Spring Security Core; média | Security 7.0.8; ausente |
| 2026-22746 | Spring Security Core; baixa | Security 7.0.8; ausente |
| 2026-22732 | Spring Security Web; crítica | Security 7.0.8; ausente |
| 2026-47838 | Spring Security Web; média | Security 7.0.8; ausente |
| 2026-47884 | Spring Web MVC; crítica Trivy, média no fornecedor | Framework 7.0.10; ausente |
| 2026-47890 | Spring Web MVC; crítica Trivy, baixa no fornecedor | Framework 7.0.10; ausente |

Esses alertas eram transitivos dos starters/BOM; [triagem e advisories oficiais individuais](../integracao-final/cves.md) explicam pré-condições e divergências de severidade. O resultado não é uma declaração de exploração comprovada no baseline. Atualizações futuras devem repetir o scanner e a suíte, especialmente após mudança de rotas.

## Achados e decisões

| ID / gravidade | Causa, impacto, evidência | Correção, regressão e estado |
|---|---|---|
| DEP-01 / alta | `backend/pom.xml:7`: linha Boot 3.4.13 e transitivas acima com 13 avisos. Risco de manter bibliotecas sem correção OSS. Baseline: `docs/integracao-final/cves.md`. | Boot 4.0.9 e módulos compatíveis; 0 CVEs nas imagens finais; `clean verify`, build Docker e SBOM. **Corrigido no inventário conhecido**. |
| AUTH-01 / alta | `backend/src/main/java/com/oficinagestao/security/JwtService.java:111`: JWT assinado continha nome, sem `iss`/`aud` obrigatórios nem algoritmo explícito. Payload JWT é legível e pode expor dados desnecessários. | Nome removido, emissor/audiência e HS256 exigidos, `iat` e `exp` obrigatórios. `JwtServiceTest` cobre token emitido, outro escopo e ausência de expiração. **Corrigido**. Tokens antigos perdem validade no corte; exigir novo login. O e-mail ainda é `sub` legível, necessário ao filtro atual; migração futura para ID opaco requer testes de compatibilidade. |
| AUTH-02 / alta | `backend/src/main/java/com/oficinagestao/service/AuthService.java:178` e `entity/TwoFactorChallenge.java:31`: risco de vazamento de 2FA exigia prova de fluxo. | `AuthLifecycleAuditIntegrationTest` comprova SecureRandom, envio apenas ao serviço de e-mail simulado, ausência do código na resposta, hash BCrypt no banco e ausência de refresh token antes do segundo fator. Testes existentes cobrem expiração, consumo único, reenvio, concorrência, sessão e revogação. **Nenhum vazamento confirmado no fluxo testado**. `challengeToken` é UUID v4 opaco, retornado no corpo e associado ao usuário/desafio; não é access token. Não usar em URL/log. |
| UI-01 / média | `frontend/src/app/login/page.tsx:205`: ao clicar em “Voltar para o login” após erro de 2FA, a troca síncrona de formulários causava um novo POST de login. Reproduzido nas duas larguras Playwright, inclusive no trace de rede. | `event.preventDefault()` antes da troca. Os dois cenários Playwright passaram e a suíte completa voltou a ficar verde. **Corrigido**. |
| ABUSE-01 / alta | `backend/src/main/java/com/oficinagestao/security/LoginAttemptService.java:42`: `ConcurrentHashMap` limita tentativas somente por instância; reinício/escala horizontal pode contornar o limite. 2FA e reenvio têm limite persistido por desafio/conta, mas isso não resolve password spraying. | **Pendente para produção.** Proposta: tabela Flyway `login_attempt_buckets` com chave HMAC de IP e IP+conta, janela/expiração, atualização atômica `INSERT ... ON CONFLICT DO UPDATE` em transação própria que não seja revertida pelo login 401; teste concorrente com duas instâncias e reinício. Complementar com Cloud Armor/WAF e quotas por endpoint. Ver plano abaixo. |
| EDGE-01 / alta | `frontend/next.config.ts:15`: rewrite estático encaminha `/api/*`, mas não obtém ID token Google. Um backend Cloud Run com IAM privado responderia 401 antes de chegar ao Spring. | **Pendente para produção.** Implementar proxy server-side com conta de serviço exclusiva, ID token com audience do backend e `X-Serverless-Authorization`, preservando Authorization da aplicação, cookies, CSRF, métodos, streaming e PDFs. Configurar `roles/run.invoker` somente ao frontend e testar em ambiente sintético Cloud Run. Não abrir backend para contornar o problema. |
| CSP-01 / média | `frontend/src/lib/securityHeaders.ts:19`: CSP de produção permite `script-src 'unsafe-inline'`. Isso reduz a proteção contra XSS, embora outros controles de React e validação de URLs permaneçam. | **Pendente.** O guia local Next 16 exige nonce aleatório por requisição em Proxy e renderização dinâmica; 14 páginas hoje são prerenderizadas. Migrar com teste de hidratação, login, PWA, navegação e modo standalone antes de ativar política estrita. Não trocar a diretiva isoladamente e quebrar o WebApp. |
| TLS-01 / alta | `backend/src/main/resources/application.properties:16`: `DB_URL` é externo e não há prova de que a URL de produção use `sslmode=verify-full`, CA válida e hostname correto. `application-prod.properties:68-75` exige STARTTLS/autenticação/validação SMTP; `AuthController.java:153` define cookies Secure em prod. | **Pendente verificação de ambiente** para Neon, frontend↔backend e SMTP reais. Configurar URL JDBC com `sslmode=verify-full` e CA confiável, ensaiar falha com certificado/nome inválido, TLS público/HSTS no domínio real. Não usar Neon de produção nos testes. |
| DATA-01 / média | Limites de resposta/consulta e exportações podem causar custo/DoS; matriz mostra paginação máxima de 2000 e busca global, PDFs e CSV sem quota compartilhada. Integridade de estoque/OS depende dos locks/transações já testados. | **Pendente para produção:** quotas por categoria de rota na borda e servidor, limites de payload e paginação conforme custo, ensaio concorrente e telemetria. Testes existentes de estoque, OS, PDF e injeção controlada passaram. |

## 2FA, sessões e dados

`AuthService` gera seis dígitos com `SecureRandom`, guarda somente BCrypt, expira no backend, consome uma vez e limita tentativas sob lock transacional. A resposta de login contém apenas `twoFactorRequired`, `challengeToken` e mensagem genérica; o JWT autenticado nasce só após `verify`. Os testes de ciclo e concorrência cobrem código inválido/expirado, reenvio, reutilização e refresh rotativo. O código digitado atravessa a requisição HTTPS de verificação, que é parte necessária do fluxo. O frontend não o grava em localStorage/sessionStorage e não há uso de query string para o código. A auditoria estática e os testes não substituem verificação dos logs/traces do serviço real de e-mail e da plataforma.

Access/refresh ficam em cookies HttpOnly com Secure em produção e escopos de Path distintos; mutações com cookies exigem CSRF, enquanto bearer sem cookie não usa credencial ambiente. `tokenVersion` é consultado no banco para rejeitar usuário inativo/sessão revogada; refresh token gira e reutilização é testada. O novo `iss`/`aud` rejeita tokens anteriores: comunicar corte de sessão e rotação de `JWT_SECRET` via Secret Manager. A chave de usuário do aplicativo é diferente do ID token Google entre Cloud Run. Não há `nbf` porque o emissor atual entrega token válido imediatamente.

Proteção de dados: senhas e códigos 2FA são **hashes com salt**, não criptografia reversível; refresh tokens seguem o esquema de hash atual. Cookies/JWT/SMTP/PostgreSQL dependem de **TLS em trânsito** na implantação; não se comprovou TLS ponta a ponta real nem criptografia de backup/colunas em repouso. Não se deve criptografar todos os campos sem modelo de ameaça e gestão de chaves. Evitar `NEXT_PUBLIC_*` para segredos; o frontend recebe somente API da mesma origem e assets públicos. A CSP deve sair de `unsafe-inline` antes de tratar XSS como mitigado por política.

## Plano de implantação bloqueado

1. Construir o proxy Next server-side para Cloud Run privado. Frontend público chama backend HTTPS com ID token do metadata server; `aud` = URL do serviço receptor; `X-Serverless-Authorization` transporta o token Google, `Authorization` segue como credencial da aplicação. IAM sem `allUsers`, conta de serviço exclusiva e invoker restrito. Validar 401 anônimo, 200 frontend, CSRF, cookies, PDF/CSV streaming, cabeçalhos e cancelamento. Rewrite estático atual deve sair quando esse proxy existir.
2. Criar Flyway e limiter PostgreSQL atômico para login e quotas proporcionais para 2FA, refresh, busca, PDF, CSV, estoque e financeiro. O registro de falha não pode ser revertido pela transação de autenticação. Testar duas réplicas, reinício e concorrência. Ajustar limite de corpo e paginação. Cloud Armor pode complementar, sem substituir limite por conta.
3. Migrar CSP para nonce por requisição no Proxy Next 16, com renderização dinâmica e testes E2E de hidratação/PWA. Revisar cache privado `Cache-Control: no-store` e telemetria de violações CSP.
4. Verificar no ambiente real, sem copiar segredos para o repositório: HTTPS e HSTS, JDBC `sslmode=verify-full` com CA, STARTTLS e identidade SMTP, Secret Manager/rotação, criptografia e acesso de backup, ingress/IAM e custos/limites Cloud Run. Fazer teste sintético controlado antes de homologar.

## Cobertura do catálogo de ameaças

As 83 rotas REST são protegidas na matriz; testes existentes cobrem BOLA no modelo de oficina compartilhada, CORS/CSRF, sort limitado, SQL parametrizado, cookies, headers, injeções controladas, transações de estoque/OS e status. Swagger e Actuator ficam restritos em produção. Buscas no código não encontraram GraphQL, WebSocket, upload de arquivos, execução de shell, parser XML de entrada ou templates server-side controlados por usuário; essas superfícies não foram tratadas como vulnerabilidades inventadas. SSRF, path traversal, host header, CRLF, request smuggling e cache poisoning ainda exigem ensaio no ingress/proxy real; revisão estática não comprova ausência. O PDF de pesquisa e [OWASP ASVS](https://asvs.owasp.org/), [WSTG](https://wstg.owasp.org/latest/2-Introduction/) e [API Top 10](https://api-security.owasp.org/) serviram como lista de categorias, não como certificado de conformidade.

## Testes e veredito

| Gate | Resultado |
|---|---|
| Maven/Java 21 + Flyway/PostgreSQL isolado | 804 testes, 0 falhas/erros, `BUILD SUCCESS` após a exigência final de expiração |
| Frontend ESLint, TS, unit, build | Passou; 364/364 unitários |
| Playwright | 116 passaram, 2 ignorados por configuração existente; inclui mobile/desktop 2FA corrigido |
| Docker backend/frontend | Ambos construídos; Trivy 0 CVEs em cada imagem |
| Secret scan offline | 0 achados nos arquivos examinados |
| Cloud Run/IAM/Neon/SMTP públicos | Não executado; sem acesso/teste autorizado de infraestrutura real |

**Correções:** parcialmente concluídas. **Segurança do código:** bloqueada para merge de produção por ABUSE-01 e EDGE-01; CSP-01 e limites de recurso seguem abertos. **Homologação Cloud Run:** bloqueada. **Produção:** **NO-GO**. PR permanece draft para revisão; nenhuma alteração é aplicada em produção. Diagnósticos locais do VS Code sem exportação textual continuam pendentes de classificação e não foram contados como falhas Maven.
