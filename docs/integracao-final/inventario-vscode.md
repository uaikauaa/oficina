# Inventário das contagens visíveis no VS Code

Transcrição manual das capturas [04–06](../auditoria/prints/README.md) de 31/10/2026. O painel mostra **540** itens; as linhas legíveis abaixo atribuem **535** ocorrências a **65** arquivos distintos. A linha de ProdutoControllerTest aparece em duas imagens e foi contada uma vez. A diferença de 5 itens não é atribuível com segurança a um arquivo a partir dos recortes. A transcrição não contém mensagens, severidade ou código dos diagnósticos.

No build Maven de 03/11/2026, os 65 arquivos da lista foram localizados. “Compilou” indica arquivo .class no output atual; “suite executada” indica relatório Surefire para a classe. Os demais são auxiliares de teste ou classes de produção. Isso comprova compilação, não a correção de cada aviso do JDT LS.

| Captura | Arquivo | Contagem exibida | Compilou | Suite executada |
|---|---|---:|---|---|
| 04 — produção | [BoundedSortConfiguration.java](../../backend/src/main/java/com/oficinagestao/config/BoundedSortConfiguration.java#L1) | 4 | sim | não se aplica |
| 04 — produção | [ProductionSecurityValidator.java](../../backend/src/main/java/com/oficinagestao/config/ProductionSecurityValidator.java#L1) | 3 | sim | não se aplica |
| 04 — produção | [GlobalExceptionHandler.java](../../backend/src/main/java/com/oficinagestao/exception/GlobalExceptionHandler.java#L1) | 3 | sim | não se aplica |
| 04 — produção | [JwtAuthenticationFilter.java](../../backend/src/main/java/com/oficinagestao/security/JwtAuthenticationFilter.java#L1) | 3 | sim | não se aplica |
| 04 — produção | [JwtService.java](../../backend/src/main/java/com/oficinagestao/security/JwtService.java#L1) | 1 | sim | não se aplica |
| 04 — produção | [SecurityConfig.java](../../backend/src/main/java/com/oficinagestao/security/SecurityConfig.java#L1) | 2 | sim | não se aplica |
| 04 — produção | [AuthService.java](../../backend/src/main/java/com/oficinagestao/service/AuthService.java#L1) | 3 | sim | não se aplica |
| 04 — produção | [CategoriaService.java](../../backend/src/main/java/com/oficinagestao/service/CategoriaService.java#L1) | 3 | sim | não se aplica |
| 04 — produção | [ClienteService.java](../../backend/src/main/java/com/oficinagestao/service/ClienteService.java#L1) | 4 | sim | não se aplica |
| 04 — produção | [EmailServiceImpl.java](../../backend/src/main/java/com/oficinagestao/service/EmailServiceImpl.java#L1) | 1 | sim | não se aplica |
| 04 — produção | [FornecedorService.java](../../backend/src/main/java/com/oficinagestao/service/FornecedorService.java#L1) | 5 | sim | não se aplica |
| 04 — produção | [MaquinaService.java](../../backend/src/main/java/com/oficinagestao/service/MaquinaService.java#L1) | 3 | sim | não se aplica |
| 04 — produção | [NotificacaoService.java](../../backend/src/main/java/com/oficinagestao/service/NotificacaoService.java#L1) | 1 | sim | não se aplica |
| 04 — produção | [OrdemServicoItemService.java](../../backend/src/main/java/com/oficinagestao/service/OrdemServicoItemService.java#L1) | 3 | sim | não se aplica |
| 04 — produção | [OrdemServicoService.java](../../backend/src/main/java/com/oficinagestao/service/OrdemServicoService.java#L1) | 3 | sim | não se aplica |
| 04 — produção | [ProdutoService.java](../../backend/src/main/java/com/oficinagestao/service/ProdutoService.java#L1) | 12 | sim | não se aplica |
| 04 — testes | [AdminAccountBootstrapTest.java](../../backend/src/test/java/com/oficinagestao/config/AdminAccountBootstrapTest.java#L1) | 22 | sim | sim |
| 04 — testes | [ProductionSecurityValidatorTest.java](../../backend/src/test/java/com/oficinagestao/config/ProductionSecurityValidatorTest.java#L1) | 15 | sim | sim |
| 04 — testes | [AuthControllerTest.java](../../backend/src/test/java/com/oficinagestao/controller/AuthControllerTest.java#L1) | 24 | sim | sim |
| 04 — testes | [ClienteControllerTest.java](../../backend/src/test/java/com/oficinagestao/controller/ClienteControllerTest.java#L1) | 32 | sim | sim |
| 04 — testes | [ConfiguracaoOficinaControllerTest.java](../../backend/src/test/java/com/oficinagestao/controller/ConfiguracaoOficinaControllerTest.java#L1) | 6 | sim | sim |
| 04 — testes | [ConfiguracaoOficinaHttpIsolationTest.java](../../backend/src/test/java/com/oficinagestao/controller/ConfiguracaoOficinaHttpIsolationTest.java#L1) | 9 | sim | sim |
| 04 — testes | [HealthControllerUnitTest.java](../../backend/src/test/java/com/oficinagestao/controller/HealthControllerUnitTest.java#L1) | 6 | sim | sim |
| 04 — testes | [NotificacaoControllerTest.java](../../backend/src/test/java/com/oficinagestao/controller/NotificacaoControllerTest.java#L1) | 1 | sim | sim |
| 04 — testes | [OrdemServicoControllerTest.java](../../backend/src/test/java/com/oficinagestao/controller/OrdemServicoControllerTest.java#L1) | 24 | sim | sim |
| 04 — testes | [ProdutoControllerTest.java](../../backend/src/test/java/com/oficinagestao/controller/ProdutoControllerTest.java#L1) | 8 | sim | sim |
| 05 — testes | [GlobalExceptionHandlerTest.java](../../backend/src/test/java/com/oficinagestao/exception/GlobalExceptionHandlerTest.java#L1) | 4 | sim | sim |
| 05 — testes | [AuthLifecycleAuditIntegrationTest.java](../../backend/src/test/java/com/oficinagestao/security/AuthLifecycleAuditIntegrationTest.java#L1) | 2 | sim | sim |
| 05 — testes | [CsrfAndCorsSecurityTest.java](../../backend/src/test/java/com/oficinagestao/security/CsrfAndCorsSecurityTest.java#L1) | 7 | sim | sim |
| 05 — testes | [CsrfIsolationTest.java](../../backend/src/test/java/com/oficinagestao/security/CsrfIsolationTest.java#L1) | 8 | sim | sim |
| 05 — testes | [CsrfMvcRoutingTest.java](../../backend/src/test/java/com/oficinagestao/security/CsrfMvcRoutingTest.java#L1) | 8 | sim | sim |
| 05 — testes | [ForwardedHeadersSpringIntegrationTest.java](../../backend/src/test/java/com/oficinagestao/security/ForwardedHeadersSpringIntegrationTest.java#L1) | 4 | sim | sim |
| 05 — testes | [RefreshReusePersistenceTest.java](../../backend/src/test/java/com/oficinagestao/security/RefreshReusePersistenceTest.java#L1) | 7 | sim | sim |
| 05 — testes | [RefreshTokenHashSecurityTest.java](../../backend/src/test/java/com/oficinagestao/security/RefreshTokenHashSecurityTest.java#L1) | 4 | sim | sim |
| 05 — testes | [RouteAuthorizationAuditTest.java](../../backend/src/test/java/com/oficinagestao/security/RouteAuthorizationAuditTest.java#L1) | 18 | sim | sim |
| 05 — testes | [SensitiveOutputAuditTest.java](../../backend/src/test/java/com/oficinagestao/security/SensitiveOutputAuditTest.java#L1) | 1 | sim | sim |
| 05 — testes | [TokenVersionSecurityTest.java](../../backend/src/test/java/com/oficinagestao/security/TokenVersionSecurityTest.java#L1) | 4 | sim | sim |
| 05 — testes | [AuditoriaIpSecurityTest.java](../../backend/src/test/java/com/oficinagestao/service/AuditoriaIpSecurityTest.java#L1) | 1 | sim | sim |
| 05 — testes | [AuthServiceTest.java](../../backend/src/test/java/com/oficinagestao/service/AuthServiceTest.java#L1) | 34 | sim | sim |
| 05 — testes | [CategoriaServiceTest.java](../../backend/src/test/java/com/oficinagestao/service/CategoriaServiceTest.java#L1) | 5 | sim | sim |
| 05 — testes | [ClienteServiceTest.java](../../backend/src/test/java/com/oficinagestao/service/ClienteServiceTest.java#L1) | 4 | sim | sim |
| 05 — testes | [ConfiguracaoOficinaServiceIntegrityTest.java](../../backend/src/test/java/com/oficinagestao/service/ConfiguracaoOficinaServiceIntegrityTest.java#L1) | 22 | sim | sim |
| 05 — testes | [EstoqueServiceTest.java](../../backend/src/test/java/com/oficinagestao/service/EstoqueServiceTest.java#L1) | 7 | sim | sim |
| 05 — testes | [FinanceRegressionIntegrationTest.java](../../backend/src/test/java/com/oficinagestao/service/FinanceRegressionIntegrationTest.java#L1) | 6 | sim | sim |
| 05 — testes | [FormClearIntegrationTest.java](../../backend/src/test/java/com/oficinagestao/service/FormClearIntegrationTest.java#L1) | 1 | sim | sim |
| 05 — testes | [FornecedorServiceTest.java](../../backend/src/test/java/com/oficinagestao/service/FornecedorServiceTest.java#L1) | 4 | sim | sim |
| 05 — testes | [HistoricoBuscaTest.java](../../backend/src/test/java/com/oficinagestao/service/HistoricoBuscaTest.java#L1) | 6 | sim | sim |
| 05 — testes | [IntegracaoEstoqueOSTest.java](../../backend/src/test/java/com/oficinagestao/service/IntegracaoEstoqueOSTest.java#L1) | 5 | sim | sim |
| 05 — testes | [MaquinaServiceTest.java](../../backend/src/test/java/com/oficinagestao/service/MaquinaServiceTest.java#L1) | 1 | sim | sim |
| 05 — testes | [NotificacaoServiceTest.java](../../backend/src/test/java/com/oficinagestao/service/NotificacaoServiceTest.java#L1) | 4 | sim | sim |
| 05 — testes | [OrdemServicoConcurrencyIntegrationTest.java](../../backend/src/test/java/com/oficinagestao/service/OrdemServicoConcurrencyIntegrationTest.java#L1) | 19 | sim | sim |
| 06 — testes | [OrdemServicoItemServiceTest.java](../../backend/src/test/java/com/oficinagestao/service/OrdemServicoItemServiceTest.java#L1) | 8 | sim | sim |
| 06 — testes | [OrdemServicoServiceTest.java](../../backend/src/test/java/com/oficinagestao/service/OrdemServicoServiceTest.java#L1) | 19 | sim | sim |
| 06 — testes | [PdfConfiguracaoOficinaIsolationTest.java](../../backend/src/test/java/com/oficinagestao/service/PdfConfiguracaoOficinaIsolationTest.java#L1) | 5 | sim | sim |
| 06 — testes | [ProdutoEstoqueConcurrencyIntegrationTest.java](../../backend/src/test/java/com/oficinagestao/service/ProdutoEstoqueConcurrencyIntegrationTest.java#L1) | 2 | sim | sim |
| 06 — testes | [ProdutoServiceTest.java](../../backend/src/test/java/com/oficinagestao/service/ProdutoServiceTest.java#L1) | 11 | sim | sim |
| 06 — testes | [RefreshTokenConcurrencyIntegrationTest.java](../../backend/src/test/java/com/oficinagestao/service/RefreshTokenConcurrencyIntegrationTest.java#L1) | 3 | sim | sim |
| 06 — testes | [RelatorioServiceTest.java](../../backend/src/test/java/com/oficinagestao/service/RelatorioServiceTest.java#L1) | 14 | sim | sim |
| 06 — testes | [ReleaseSmokeTest.java](../../backend/src/test/java/com/oficinagestao/service/ReleaseSmokeTest.java#L1) | 5 | sim | sim |
| 06 — testes | [TwoFactorConcurrencyIntegrationTest.java](../../backend/src/test/java/com/oficinagestao/service/TwoFactorConcurrencyIntegrationTest.java#L1) | 6 | sim | sim |
| 06 — testes | [SyntheticMigrations.java](../../backend/src/test/java/com/oficinagestao/testsupport/SyntheticMigrations.java#L1) | 4 | sim | auxiliar |
| 06 — testes | [TestDatabaseSafetyAutoConfiguration.java](../../backend/src/test/java/com/oficinagestao/testsupport/TestDatabaseSafetyAutoConfiguration.java#L1) | 14 | sim | auxiliar |
| 06 — testes | [TestDatabaseSafetyAutoConfigurationTest.java](../../backend/src/test/java/com/oficinagestao/testsupport/TestDatabaseSafetyAutoConfigurationTest.java#L1) | 38 | sim | sim |
| 06 — testes | [TestDatabaseSafetyGuard.java](../../backend/src/test/java/com/oficinagestao/testsupport/TestDatabaseSafetyGuard.java#L1) | 1 | sim | auxiliar |
| 06 — testes | [TestDatabaseSafetyGuardTest.java](../../backend/src/test/java/com/oficinagestao/testsupport/TestDatabaseSafetyGuardTest.java#L1) | 18 | sim | sim |

Resumo: produção 54 itens visíveis; testes 481. Arquivos ausentes: 0; classes não compiladas: 0.
