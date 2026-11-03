# Matriz independente — 60 cenários

Decomposição operacional das famílias do PDF e do pedido; não transcrição de uma lista numerada original. **LOCAL** = exercício automatizado/revisão na árvore final, sujeito ao resultado em evidencias.json; **AUSENTE** = superfície não encontrada por inventário/revisão, sem simular exploração inexistente; **PARCIAL** = parte local coberta, parte indicada não verificada; **NÃO VERIFICADO** = sem evidência da infraestrutura real. Uma linha pode reunir vários vetores, não implica apenas um teste por ameaça.

| ID | Ameaça / controle | Evidência reproduzível / escopo | Estado e limite |
|---|---|---|---|
| T01 | Acesso anônimo indevido | IndependentRouteAuditTest: todos os 83 mappings; rotas protegidas 401 | LOCAL |
| T02 | Escalada por função/BFLA | Mesmo inventário: JWT real ROLE_USER 403; ADMIN alcança handler | LOCAL |
| T03 | BOLA / vínculo item-OS e cliente-máquina | OrdemServicoItemServiceTest, MaquinaServiceTest, integração real wrong-parent 404 | LOCAL; modelo compartilhado entre ADMINs |
| T04 | BOPLA / mass assignment | DTOs de criação/atualização; integração real força id, ativo e roles | LOCAL |
| T05 | SQL injection | JPQL/JDBC parametrizados revisados; HistoricoBuscaTest e dados canário nos testes de rota | LOCAL; não é fuzzing exaustivo de SQL |
| T06 | Sort/paginação como injeção ou recursão | BoundedSortConfiguration e testes; ResourceLimitsIntegrationTest | LOCAL |
| T07 | NoSQL, LDAP, XPath injection | Dependências, repositórios e chamadas não usam esses interpretadores | AUSENTE |
| T08 | OS command / code injection | Sem Runtime.exec/ProcessBuilder/eval a partir de entradas nas superfícies da aplicação | AUSENTE; ferramentas locais de auditoria não são endpoints |
| T09 | SSTI | Sem templates de servidor interpolando código fornecido pelo usuário | AUSENTE |
| T10 | XSS refletido | DTO/React escaping, CSP, formulários e canários de erro | LOCAL; não garante cobertura de todo payload possível |
| T11 | XSS armazenado | Integração real salva markup em cliente e confirma texto sem execução no navegador | LOCAL |
| T12 | DOM XSS / URLs perigosas | Segurança de URL e saída React, testes unitários e Playwright | LOCAL |
| T13 | CSV injection | INDEP-02, csvSecurityAudit + download CSV real com `=1+1` | PARCIAL; consumidor Excel/LibreOffice não testado |
| T14 | Prototype pollution | Integração real envia __proto__/roles e verifica Object.prototype e DTO de resposta | LOCAL; Java não expõe binding de classes arbitrárias |
| T15 | CSRF ausente em mutações | IndependentRouteAuditTest: todas as mutações com cookie sem token 403 | LOCAL |
| T16 | CSRF divergente/entre sessões | CsrfAndCorsSecurityTest, CsrfIsolationTest, CsrfMvcRoutingTest | LOCAL |
| T17 | CORS indevido | CsrfAndCorsSecurityTest, ProductionSecurityValidatorTest | LOCAL; configuração real precisa de homologação |
| T18 | Clickjacking / headers | RouteAuthorizationAuditTest e CSP no navegador | LOCAL; CDN/ingresso não testados |
| T19 | CSP fraca, nonce ou erro HTML sem política | csp-errors, login, CSP unitários e Playwright; INDEP-04 | LOCAL; style-src-attr inline permanece documentado |
| T20 | Cache de dados autenticados | ConfiguracaoOficinaHttpIsolationTest, CsrfMvcRoutingTest, PDF real e proxy transport | LOCAL; cache compartilhado externo não verificado |
| T21 | Open redirect | URLs seguras e login/roteamento sem destino externo controlável | LOCAL; inventário de redirecionamentos |
| T22 | Host / forwarded host poisoning | IndependentRouteAuditTest, ForwardedHeadersSpringIntegrationTest | LOCAL; cadeia real de proxies não verificada |
| T23 | CRLF / response splitting | Sondagem canário de query e headers no teste independente | LOCAL; não cobre todos os parsers intermediários |
| T24 | JWT alg none / confusão de algoritmo | JwtBoundaryAuditTest, verificador HS256 explícito | LOCAL |
| T25 | JWT adulterado / chave errada | JwtBoundaryAuditTest, JwtServiceTest | LOCAL |
| T26 | JWT issuer/audience incorretos | JwtServiceTest e validação obrigatória de iss/aud | LOCAL |
| T27 | JWT expirado, iat futuro, nbf futuro | JwtBoundaryAuditTest e JwtServiceTest | LOCAL |
| T28 | Rotação de JWT reseta proteção ou mantém assinatura antiga | RateKeyRotationAuditTest; duas JVMs reais com reinício e JWT diferente | LOCAL; rollout global coordenado não homologado |
| T29 | Reutilização de segredos entre funções | RateKeyRotationAuditTest rejeita rate=JWT, rate=proxy, JWT=proxy; check-cloud-run exige referências distintas | LOCAL; valores/referências reais não verificados |
| T30 | Rotação RATE abre novos budgets / gerações concorrentes | Seis RateKeyRotationAuditTest, inclusive legado e 32 chamadas concorrentes | LOCAL; falha fechada com manutenção, sem promessa zero downtime |
| T31 | Rotação de assinatura IP/contexto | ProxyClientContextVerifierTest: assinatura antiga/nova recusada pela outra geração | LOCAL; rollout coordenado real não homologado |
| T32 | Corrida no rate limiter / atomicidade | SharedRateLimitIntegrationTest: PostgreSQL, clientes independentes e concorrência controlada | LOCAL |
| T33 | Tentativas distribuídas entre réplicas e XFF forjado | test-real-stack-local: 12 tentativas, duas JVMs, budget exato 10/2 | LOCAL; não ensaio DDoS externo |
| T34 | Reinício perde contadores | Mesma integração real: reinicia JVM com outro JWT e mantém 429 em ambas | LOCAL |
| T35 | Rollback de login falho apaga budget | SharedRateLimitIntegrationTest; transação REQUIRES_NEW | LOCAL |
| T36 | Falsificação/replay do contexto IP | ProxyClientContextVerifierTest: tempo, método, path, assinatura; ForwardedHeadersSpringIntegrationTest | LOCAL; confiabilidade de IP do ingresso depende de homologação |
| T37 | IAM exposto ao browser / JWT sobrescrito | backendProxyAudit, testes proxy transporte e fixture metadados; erro/PDF/CSV/cookies | LOCAL; autorização Google efetiva é T55 |
| T38 | Bypass 2FA / token antes do código | AuthServiceTest, AuthLifecycleAuditIntegrationTest, integração real com Mailpit | LOCAL |
| T39 | Código 2FA inválido/expirado / brute force | AuthServiceTest e suíte de segurança/limites | LOCAL |
| T40 | Reuso/corrida 2FA | TwoFactorConcurrencyIntegrationTest | LOCAL |
| T41 | Resend spam e budgets por IP/conta | AuthServiceTest e limiter compartilhado | LOCAL; custo/quotas/entrega externa não verificados |
| T42 | Enumeração de usuário / timing | AuthControllerTest/AuthServiceTest: mensagens genéricas e caminho de hash | PARCIAL; comparação estatística de tempos não executada |
| T43 | Logout, usuário inativo, senha e tokenVersion | TokenVersionSecurityTest e AuthLifecycleAuditIntegrationTest; logout real UI | LOCAL |
| T44 | Refresh reuso/rotação/concurrency | RefreshReusePersistenceTest, RefreshTokenConcurrencyIntegrationTest, RefreshTokenHashSecurityTest | LOCAL |
| T45 | SSRF | Destino backend validado/fixo e metadata endpoint fixo; sem fetch baseado em URL de cliente; PDF usa texto/tabelas | PARCIAL; egress policy Google não verificada |
| T46 | Traversal / LFI / leitura de arquivos | PDF não carrega caminhos/URLs fornecidos; sem endpoints de arquivo arbitrário; rotas catch-all proxy permanecem confinadas ao backend | LOCAL por revisão; não fuzzing de todo stack externo |
| T47 | XXE | API JSON sem parser XML exposto | AUSENTE; bibliotecas transitivas não representam endpoint XML |
| T48 | Desserialização insegura | DTOs tipados, sem ObjectInputStream ou default typing de classes de entrada | LOCAL por revisão e JSON malformado nos testes |
| T49 | Upload malicioso | Nenhum mapping multipart/upload; sondagem autenticada /api/upload 404 | AUSENTE |
| T50 | GraphQL introspection / abuso | Sem dependência/rota; /graphql e /api/graphql autenticados 404 | AUSENTE |
| T51 | WebSocket auth/origin | Sem endpoint WebSocket; /ws autenticado 404 | AUSENTE |
| T52 | WebDAV e métodos perigosos | TRACE/CONNECT/PROPFIND rejeitados em IndependentRouteAuditTest | LOCAL; ingresso Google não testado |
| T53 | Request smuggling / CL+TE | audit-http-parser: dois requests limitados, Next HTTP/1 local rejeita 400 | PARCIAL; GFE/Cloud Run **NÃO VERIFICADO** |
| T54 | Payload, slow body, paginação e custo | INDEP-03; ResourceLimitsIntegrationTest, backendProxyAudit; bounds e timeout de query | LOCAL; capacidade real, lookup não paginado e massa representativa pendentes |
| T55 | Invoker IAM, backend privado e identidade real | Roteiro check-cloud-run preparado; nenhum deploy ou teste de conta Google foi realizado | **NÃO VERIFICADO** |
| T56 | TLS/Neon/SMTP e dados em repouso | tls-isolated.test local com CA/hostname/STARTTLS; fornecedores reais sem acesso/teste | **NÃO VERIFICADO** no ambiente real |
| T57 | Corridas de estoque/OS e abuso de estado | OrdemServicoConcurrencyIntegrationTest, ProdutoEstoqueConcurrencyIntegrationTest, IntegracaoEstoqueOSTest; oversell e cancelamento reais | LOCAL; não há promessa universal de idempotência em POST legítimo |
| T58 | Manipulação de preço / arredondamento / histórico | FinanceRegressionIntegrationTest, OrdemServicoItemServiceTest, FormClearIntegrationTest | LOCAL |
| T59 | Dependências, supply chain e secrets em artefatos | SBOM, árvores, npm audit, Trivy imagens/arquivos; Actions por SHA | PARCIAL; histórico Git, credenciais externas e CVEs futuras fora da prova |
| T60 | Logs, alertas, resposta e restauração | AuditoriaServiceTest, SensitiveOutputAuditTest, revisão de logs e validação fail closed | **NÃO VERIFICADO** operacionalmente: SIEM, retenção, backup/PITR e resposta reais |

Resultados individuais e contagens vêm dos relatórios recém-gerados. Uma linha LOCAL com testes aprovados significa somente as propriedades e vetores descritos, não “ameaça eliminada”. Itens parciais e externos permanecem na matriz de riscos do README.
