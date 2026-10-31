# Achados, correções e risco residual

As linhas correspondem aos arquivos da branch de auditoria; os símbolos e testes identificados permanecem a referência quando novas linhas forem adicionadas. Os cinco cenários iniciais de `AuthLifecycleAuditIntegrationTest` falharam na base e passaram após correção. Os demais achados distinguem reprodução comportamental, revisão de código e alerta de versão.

## A01 — Refresh após logout e corrida de revogação — ALTA — corrigido

- Rotas: `POST /api/auth/refresh`, `POST /api/auth/logout`.
- Origem: `AuthService.logout/refresh`, `UsuarioRepository.findByIdForUpdate`, `RefreshTokenRepository.findUsuarioIdByTokenHash`.
- Evidência: emitir A, rotacionar A→B, efetuar logout com A, renovar usando B. Na base B continuava válido. Duas transações simultâneas também deixavam um refresh ativo.
- Causa: logout incrementava tokenVersion, mas revogava apenas o refresh apresentado; o descendente podia emitir novo JWT com a versão atual.
- Impacto: continuidade/ressurreição de sessão após logout, inclusive por detentor de refresh anterior.
- Correção: lock da conta antes do lock de token, ordem consistente em login/2FA/refresh/logout/troca de senha; logout global coerente com a revogação global de access tokens já existente; revogação de todos os refresh e desafios. Reuso detectado também incrementa tokenVersion.
- Regressão: `logoutWithOldCookieRevokesRotatedDescendant`, `refreshRacingLogoutCannotLeaveAnActiveRefreshToken`, `RefreshTokenConcurrencyIntegrationTest`, `RefreshReusePersistenceTest`, `TokenVersionSecurityTest`.
- Residual: duas abas renovando o mesmo refresh podem acionar a detecção de reuso e encerrar a sessão. Seguro contra reuso, mas exige nova autenticação; não foi adicionado grace period que reabilite tokens antigos.

## A02 — Desafio anterior à troca de senha permanece utilizável — ALTA — corrigido

- Rotas: `PUT /api/auth/alterar-senha`, `POST /api/auth/2fa/verify`.
- Origem: `AuthService.alterarSenha`, `TwoFactorChallengeRepository.revokeAllActiveByUsuarioId`.
- Evidência: criar desafio com credenciais antigas, trocar senha e confirmar o desafio antigo. A base emitia sessão nova.
- Impacto: revogação incompleta após mudança de credencial, se o atacante também obtiver o segundo fator pendente.
- Correção: revogar desafios na mesma transação e sob o mesmo lock da conta que serializa verificação de 2FA.
- Regressão: `passwordChangeRevokesPendingSecondFactor`; suites de senha e concorrência 2FA.

## A03 — Conta desativada conclui segundo fator — MÉDIA — corrigido

- Rota: `POST /api/auth/2fa/verify`; origem `AuthService.verificarTwoFactor`.
- Evidência: gerar desafio, desativar usuário e confirmar o código. Eram emitidos tokens; a API rejeitava seu uso por consultar `ativo`.
- Causa: estado da conta não era revalidado nessa etapa.
- Correção: validar conta bloqueada, revogar desafio e responder erro genérico de credenciais.
- Regressão: `inactiveAccountCannotCompleteSecondFactor`. Não classificado como acesso demonstrado a dados de conta desativada.

## A04 — Novos logins contornam limite de e-mails — MÉDIA — corrigido com limites

- Rotas: `POST /api/auth/login`, `POST /api/auth/2fa/resend`; origem `AuthService.validarLimiteEmail`.
- Evidência: repetir login com senha correta enviava vários e-mails; o cooldown só existia para reenvio do mesmo desafio.
- Impacto: spam, custo SMTP e facilitação de abuso do segundo fator. Exige conhecer a senha.
- Correção: intervalo mínimo de 30 s e dez desafios por hora/conta, incluindo usados/revogados, consultados no PostgreSQL sob lock da conta. `RateLimitException` retorna 429 com `Retry-After`.
- Regressão: `loginCannotBypassEmailCooldown`, `hourlyEmailBudgetIncludesAlreadyRevokedChallenges`.
- Residual: erros SMTP fazem rollback da transação e não contam como envio concluído; limites de tentativas de senha por IP continuam em memória. `Retry-After: 60` é orientação de nova tentativa, não garantia de liberação antes de terminar a janela de uma hora. Resolver abuso distribuído antes de exposição pública (R01).

## A05 — SMTP aceita ausência de STARTTLS e não exige identidade — ALTA — corrigido

- Fluxo: envio do segundo fator. Origem: `application-prod.properties`, `ProductionSecurityValidator.validate`.
- Evidência: um servidor SMTP loopback que omite STARTTLS aceita conexão quando apenas `starttls.enable=true`; com `starttls.required=true` a conexão é recusada. Reproduzido por `SmtpDowngradeAuditTest`, sem transmitir credenciais reais.
- Causa: habilitar STARTTLS não equivale a exigi-lo; verificação de identidade do servidor não estava explicitada.
- Correção: `mail.smtp.starttls.required=true` e `mail.smtp.ssl.checkserveridentity=true`; validator recusa falso, vazio ou ausente em produção.
- Regressão: `SmtpDowngradeAuditTest`, `ProductionSmtpConfigurationTest` e suite do validator.
- Limite: certificado e disponibilidade do provedor SMTP real não foram testados. [Semântica oficial Angus Mail](https://eclipse-ee4j.github.io/angus-mail/docs/api/org.eclipse.angus.mail/org/eclipse/angus/mail/smtp/package-summary.html).

## A06 — Detalhes de exceções em logs — MÉDIA — corrigido nos caminhos identificados

- Rotas/fluxos: login/reenvio 2FA, health, erros não tratados e de integridade, purga de tokens e sincronização de notificações.
- Origem: `AuthService`, `EmailServiceImpl`, `HealthController`, `GlobalExceptionHandler`, `RefreshTokenCleanupScheduler`, `NotificacaoService`.
- Evidência: mensagens SMTP/JDBC e cadeia de exceções eram registradas sem redução; podem conter corpo de mensagem, dados de registros ou parâmetros do provedor. Teste injeta um marcador sintético em exceções SMTP/SQL e verifica sua ausência no log.
- Correção: registrar categoria da exceção e identificador operacional; erro geral mantém origem de código sem mensagem/cadeia com dados.
- Regressão: `SensitiveOutputAuditTest.upstreamExceptionsCannotLeakCodesPasswordsOrDatabaseRows`.
- Residual: e-mails/IPs de auditoria continuam sendo dados pessoais; aplicar retenção e acesso mínimo aos logs. A configuração de Cloud Logging não foi inspecionada. Logging de debug/SQL não deve ser habilitado em produção.

## A07 — Número de OS entra sem escape em Content-Disposition — BAIXA — corrigido

- Rotas: `GET /api/ordens-servico/{id}/pdf`, `/documento-servico`, `/recibo`.
- Origem: `OrdemServicoController.gerarPdf/gerarDocumentoServico/gerarRecibo`.
- Evidência: `numeroOs` aceita texto limitado a 30 caracteres; aspas, ponto-e-vírgula e controles eram concatenados no header. Não foi demonstrado response splitting em Tomcat; o achado é composição insegura do header/arquivo.
- Correção: allowlist ASCII no nome do arquivo, aplicada inclusive aos dados já armazenados; conteúdo comercial da OS preservado.
- Regressão: `storedOrderNumberCannotInjectPdfDispositionParametersOrHeaders`; download real dos três formatos.

## A08 — Ordenação não limitada e advisories Spring Data — MÉDIA/ALTA potencial — mitigado

- Rotas paginadas da matriz; origem: argumentos `Pageable`, `BoundedSortConfiguration`.
- Evidência: HTTP encaminhava nomes de propriedades arbitrários à resolução do Spring Data. Scanners identificam CVE-2026-41711/41716/41695. Não foi executada exaustão destrutiva de heap/stack.
- Correção compensatória: interceptor antes da resolução de argumentos aceita somente conjunto finito de campos simples, até três ordenações, 64 caracteres por valor, direção asc/desc; não permite caminhos recursivos, campos aleatórios ou parâmetros repetidos ilimitados.
- Regressão: `boundedSortRejectsRecursiveUnknownAndPollutedPathsBeforeDataParsing`; consulta válida continua 200.
- `@ProjectedPayload`, Querydsl web bindings e APIs MappingContext não são expostos pela aplicação. Ainda assim, o pacote permanece em versão sinalizada: revisar antes de produção e planejar atualização suportada. [Aviso de Sort](https://spring.io/security/cve-2026-41711/), [cache de propriedades](https://spring.io/security/cve-2026-41716/).

## A09 — Dependências vulneráveis — severidade de scanner até CRÍTICA — corrigido/triado

- npm: Next 16.3.8→16.4.1, Zod 4.6.5→4.6.6, source-map-js→1.2.2, sharp→0.35.5; eslint-config-next alinhado. `npm audit`: quatro pacotes sinalizados antes, zero depois.
- Maven: Tomcat→10.1.61, Jackson BOM→2.18.11, PostgreSQL JDBC→42.7.12, Logback→1.5.34, Commons Lang→3.18.0, Log4j2→2.25.5. Tomcat 10.1.58 indicado em advisory não estava publicado no Central; foi usada versão existente posterior. Build e regressões passaram.
- Next: advisories incluem SVG/image optimization, cache e Server Actions. A aplicação não usa uploads SVG, `use cache` ou Server Actions; não foi alegada exploração de RCE. Corrigiu-se a versão mesmo assim.
- Imagem frontend: 21 registros iniciais pertenciam a npm/corepack herdados do Node, não ao bundle standalone. Ferramentas desnecessárias foram removidas somente do runner; imagem final e dependências da aplicação sem alertas na base consultada.
- Maven/imagem backend mantêm **13 registros** de versões Spring/Micrometer; detalhes abaixo. Não são ocultados por ignorefile global.

| Advisory remanescente | Triagem do código atual / ação |
|---|---|
| CVE-2026-22732, Security headers | Workaround oficial `HeaderWriterFilter.shouldWriteHeadersEagerly=true`; testes de headers em 404/CSRF e PDF no-store. O scanner continua identificando a versão. [Fornecedor](https://spring.io/security/cve-2026-22732/) |
| CVE-2026-47884, WebMVC XsltView | Sem XsltView, resolução XSLT ou views implícitas; controllers REST. Não aplicável ao caminho atual; reavaliar se adicionar templates. [Fornecedor](https://spring.io/security/cve-2026-47884/) |
| CVE-2026-47890, fragmentos SSE | Sem SSE/views de fragmentos; caminho afetado não usado. Reavaliar se adicionar streaming de views. |
| CVE-2026-40984, instrumentação HTTP Micrometer | O advisory abrange múltiplas instrumentações, não somente Jetty. Neste Spring MVC, DefaultServerRequestObservationConvention do Spring Web 6.2.19 normaliza métodos desconhecidos para UNKNOWN (bytecode verificado); não há instrumentação Jetty/Jersey configurada. Métodos sintéticos retornaram 400 localmente. Reavaliar novas instrumentações. [Correção upstream](https://github.com/micrometer-metrics/micrometer/commit/36da131525228188a36779a28471a76c79213dd4) |
| CVE-2026-40973, Boot ApplicationTemp | Sem sessão servlet persistente; JWT stateless, instância isolada sem diretório compartilhado. Não satisfaz pré-condições identificadas. |
| CVE-2026-41001, Artemis | Sem broker Artemis embarcado. |
| CVE-2026-41695 / 41716 / 41711 / 41721, Data Commons | Sem Querydsl/ProjectedPayload; entrada Sort agora finita e limitada. Ver A08. |
| CVE-2026-22751, JdbcOneTimeTokenService | 2FA próprio com lock transacional; não usa esse serviço. |
| CVE-2026-22746, DaoAuthenticationProvider | Login efetivo usa AuthService e BCrypt/dummy hash; não autentica via DaoAuthenticationProvider. |
| CVE-2026-47838, X.509 | Não há autenticação por certificado de cliente. |

A classificação “não aplicável” depende da configuração atual, não remove a vulnerabilidade do pacote. Preservar Boot 3.4/Security 6.4 exigiu mitigação e triagem; a decisão de manutenção/upgrade com suporte é bloqueador de governança para produção. Evidências estruturadas em `dependencias.json` e `evidencias.json`.

## A10 — Destino do proxy divergente no runtime — ALTA operacional — corrigido

- Origem: `next.config.ts`, `frontend/Dockerfile`, `docker-entrypoint.mjs`, PR #10.
- Evidência: rewrites são compilados; runtime sozinho não troca a origem. A imagem anteriormente declarava default `backend:8080` também no runner, potencialmente divergente do build Cloud Run.
- Correção: validar origem HTTP(S), sem credenciais/caminho/query; remover default enganoso do runner; startup compara a configuração runtime com o manifesto realmente compilado e aborta em divergência, sem imprimir o valor. Troca de origem exige rebuild.
- Regressão: `backendUrl.test.ts`; contêiner divergente encerra com código 1; testes reais e fixture de transporte preservam métodos, CSRF, dois Set-Cookie, PDFs e 401/403/404/429/500.
- Cloud Build passa substituições por variáveis de ambiente, não interpoladas como código shell. É defesa adicional sobre entrada de operador, não evidência de RCE por usuário da aplicação.

## Riscos residuais e prazos

| ID | Risco | Controle/pendência | Prazo e responsável proposto |
|---|---|---|---|
| R01 | ALTO: abuso distribuído/custo/lockout coletivo | Limitador de senha em memória e IP de proxy ainda não validado no Cloud Run. Não confiar em XFF arbitrário. Definir limitação por conta/IP no edge/armazenamento compartilhado, e testar scale-out/scale-to-zero. | Antes de tráfego público; segurança + infraestrutura |
| R02 | ALTO: confiança TLS/credenciais de infraestrutura não comprovadas | Neon, SMTP, IAM, secrets, buckets/registry, WIF e domínio só revisados como configuração proposta. `sslmode=require` não valida identidade. Usar verify-full com CA confiável. | Antes de homologação com dados sensíveis; infraestrutura |
| R03 | MÉDIO: volume de payload, PDFs e consultas | Sem limite explícito global de JSON/intervalo de relatórios; paginação tem teto padrão 2000, campos texto podem ser longos. Aplicar limite no edge/backend e ensaiar cargas limitadas antes de liberar acesso público. | Antes de produção; backend + infraestrutura |
| R04 | MÉDIO: dupla submissão de movimentação | Locks evitam saldo negativo e corridas, mas duas requisições legítimas distintas são duas operações; não há chave de idempotência. | Aceite formal na homologação; avaliar idempotência em até 30 dias |
| R05 | MÉDIO: manutenção de dependências | Treze alertas remanescentes triados; atualizações corrigidas dessa linha podem exigir suporte comercial. Escolher upgrade suportado ou aceite de mitigação com monitoramento. | Antes de produção; responsável técnico |
| R06 | MÉDIO: CSP com unsafe-inline | React escapa conteúdo e teste XSS armazenado passou, mas CSP não bloqueia todo script inline. Planejar nonce/hashes sem quebrar App Router. | Até 30 dias após aceite formal; frontend |
| R07 | MÉDIO: revogação e UX entre abas | Mutex frontend só por contexto JS; reuso concorrente pode invalidar sessão. Não cria bypass confirmado. Testes backend de concorrência passaram; UX completa multiabas reais pendente. | Homologação; frontend/backend |
| R08 | MÉDIO: saúde pública e jobs em escala zero | `/api/health` consulta banco; chamadas podem acordar Neon. Cron local de limpeza não é execução garantida com CPU suspensa/zero instâncias. | Antes de produção; infraestrutura |
| R09 | BAIXO/MÉDIO: reprodutibilidade de ferramentas | Actions agora fixadas por SHA; bases Docker e serviços de teste ainda usam tags. Registrar digests, automatizar renovação e alinhar CLI Flyway 11 do workflow com versão 10.20.1 embarcada. | Antes de produção; DevOps |
| R10 | MÉDIO: CORS depende de operação correta | Validator impede wildcard/localhost, mas não valida integralmente URI HTTPS; usar somente origem HTTPS exata conforme checklist e validar header real. | Antes de produção; infraestrutura/backend |

Os prazos são propostas técnicas, não aceites do proprietário. Nenhum risco foi silenciosamente aprovado em nome do usuário.

## Localização das correções

| Achado | Arquivo e linha na entrega |
|---|---|
| A01 | [backend/src/main/java/com/oficinagestao/service/AuthService.java:450](../../backend/src/main/java/com/oficinagestao/service/AuthService.java#L450) |
| A02 | [backend/src/main/java/com/oficinagestao/service/AuthService.java:492](../../backend/src/main/java/com/oficinagestao/service/AuthService.java#L492) |
| A03 | [backend/src/main/java/com/oficinagestao/service/AuthService.java:210](../../backend/src/main/java/com/oficinagestao/service/AuthService.java#L210) |
| A04 | [backend/src/main/java/com/oficinagestao/service/AuthService.java:555](../../backend/src/main/java/com/oficinagestao/service/AuthService.java#L555) |
| A05 | [backend/src/main/java/com/oficinagestao/config/ProductionSecurityValidator.java:16](../../backend/src/main/java/com/oficinagestao/config/ProductionSecurityValidator.java#L16) |
| A06 | [backend/src/main/java/com/oficinagestao/exception/GlobalExceptionHandler.java:24](../../backend/src/main/java/com/oficinagestao/exception/GlobalExceptionHandler.java#L24) |
| A07 | [backend/src/main/java/com/oficinagestao/controller/OrdemServicoController.java:49](../../backend/src/main/java/com/oficinagestao/controller/OrdemServicoController.java#L49) |
| A08 | [backend/src/main/java/com/oficinagestao/config/BoundedSortConfiguration.java:15](../../backend/src/main/java/com/oficinagestao/config/BoundedSortConfiguration.java#L15) |
| A09 | [backend/pom.xml:17](../../backend/pom.xml#L17) |
| A09 | [frontend/package.json:14](../../frontend/package.json#L14) |
| A10 | [frontend/docker-entrypoint.mjs:1](../../frontend/docker-entrypoint.mjs#L1) |

Severidades do scanner representam o pacote; podem divergir da classificação do fornecedor e do risco do caminho efetivamente utilizado. A ausência de exploração demonstrada não transforma um pacote vulnerável em corrigido.
