# Achados verificáveis e decisões

Severidade avaliada para exposição futura; nenhum achado autoriza acessar Neon. Caminhos/linhas são da candidata desta branch. Testes sintéticos não eliminam risco de configuração real.

| ID | Severidade | Origem/arquivo | Evidência e impacto | Correção/teste | Estado |
|---|---|---|---|---|---|
| JWT-01 | Alto | #29, `backend/src/main/java/com/oficinagestao/security/JwtAuthenticationFilter.java:102`; property em #29 | Override `legacy-sessionless-allowed=true` aceita JWT sem sessão e evita revogação individual até expiração | Fail-fast em `ProductionSecurityValidator.java:39`; regressão `ProductionSecurityValidatorTest` e paridade prod | Corrigido para profile prod/production; verificar runtime efetivo antes do GO |
| REC-01 | Alto | #27, `PasswordRecoveryService.java:73–89` | Caminho existente executa escritas e outbox; Stage 4A mediu diferença 5,277 ms, IC95% [4,933; 5,514] | 503 antes da busca por default e `prod` rejeita habilitação; `PasswordRecoveryExposureTest` e guard unitário | Exposição pública bloqueada; mitigação assíncrona e HTTP temporal pendentes |
| UI-01 | Médio | código anterior a #30, `frontend/src/app/login/page.tsx:281–286` | Timer 50 ms focou e-mail depois da senha; 1/115 Playwright falhou, screenshot mostrou campos corrompidos | Preservar foco em input já ativo dentro do diálogo; Playwright de 390 px com asserções de foco/valores | Corrigido, 115/115 no rerun final |
| INF-01 | Alto operacional | container preexistente, fora do código novo | Metadados declarados: DB_URL Neon sem verify-full, segredos obrigatórios RBAC ausentes, bootstrap legado presente | Não tocar container; plano de substituição/configuração validada e autorização Neon separada | Bloqueia uso do container para diagnóstico/ativação |
| GOV-01 | Médio | PR #26, `SECURITY.md` paralelo | Check histórico de Integração Real falhou após 2FA; causa não provada | Manter separado; revalidar na base atual antes de integrar | Pendente |
| DATA-01 | Alto operacional | V25–V28 | Nenhum snapshot original/restore ensaiado; testes sintéticos não demonstram compatibilidade de dados legados | Gate read-only, backup privado, restore e ensaio segundo runbook, com autorizações distintas | Bloqueia migrations reais |

Falhas intermediárias preservadas no registro: primeiro Maven 897 casos, 3 erros de contexto `test,prod` pela nova propriedade de teste; fixtures corrigidos e rerun 897/897 verde. Playwright mock 114/115 localizou UI-01; primeira correção passou a falhar no teste de foco inicial e foi ajustada para preservar inputs ativos, mantendo autofocus inicial. Os checks históricos verdes não apagam esses episódios.
