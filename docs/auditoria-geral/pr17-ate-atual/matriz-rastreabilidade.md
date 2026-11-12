# Matriz de rastreabilidade por arquivo

Fonte: metadados e arquivos alterados de cada PR no GitHub; comparação `git diff <head-do-PR> HEAD` e árvore candidata `fc1560a` na criação deste inventário. **Mesmo conteúdo** é igualdade de blob no caminho, não aprovação de comportamento. **Evoluído** significa diferença posterior; **ausente** não implica remoção indevida. PR #17 foi revertido; PRs #18 e #26 são branches paralelas.

| PR | Commit final | Arquivo | Tipo | Estado na candidata | Risco/revisão | Teste/veredito |
|---|---|---|---|---|---|---|
| #17 | `f020be0da` | `.dockerignore` | Infra/CI | Revertido pelo #19 | Médio | CI/configuração isolada |
| #17 | `f020be0da` | `.env.homolog.example` | Infra/CI | Revertido pelo #19 | Médio | CI/configuração isolada |
| #17 | `f020be0da` | `.env.homolog.local.example` | Infra/CI | Revertido pelo #19 | Médio | CI/configuração isolada |
| #17 | `f020be0da` | `.github/workflows/ci.yml` | Infra/CI | Revertido pelo #19 | Médio | CI/configuração isolada |
| #17 | `f020be0da` | `.gitignore` | Domínio | Revertido pelo #19 | Médio | Maven/regressão |
| #17 | `f020be0da` | `backend/src/main/java/com/oficinagestao/config/FlywayConfig.java` | Banco/Flyway | Revertido pelo #19 | Alto | Flyway em PostgreSQL isolado |
| #17 | `f020be0da` | `backend/src/main/java/com/oficinagestao/config/HomologationDatabaseGuard.java` | Domínio | Revertido pelo #19 | Médio | Maven/regressão |
| #17 | `f020be0da` | `backend/src/test/java/com/oficinagestao/config/FlywayConfigTest.java` | Banco/Flyway | Revertido pelo #19 | Alto | Teste incluído; verificar execução |
| #17 | `f020be0da` | `backend/src/test/java/com/oficinagestao/config/FlywayEmptySchemaIntegrationTest.java` | Banco/Flyway | Revertido pelo #19 | Alto | Teste incluído; verificar execução |
| #17 | `f020be0da` | `backend/src/test/java/com/oficinagestao/config/HomologationDatabaseGuardTest.java` | Testes | Revertido pelo #19 | Médio | Teste incluído; verificar execução |
| #17 | `f020be0da` | `backend/src/test/java/com/oficinagestao/testsupport/ProductionMigrationPathTest.java` | Testes | Revertido pelo #19 | Médio | Teste incluído; verificar execução |
| #17 | `f020be0da` | `docs/deployment-google-cloud-run.md` | Infra/CI | Revertido pelo #19 | Médio | CI/configuração isolada |
| #17 | `f020be0da` | `docs/neon-homologacao-segura.md` | Infra/CI | Revertido pelo #19 | Médio | CI/configuração isolada |
| #17 | `f020be0da` | `docs/security-hardening/homologacao.md` | Identidade/AppSec | Revertido pelo #19 | Alto | Maven segurança/integr. |
| #17 | `f020be0da` | `scripts/homologation/CheckNeonTls.java` | Infra/CI | Revertido pelo #19 | Médio | CI/configuração isolada |
| #17 | `f020be0da` | `scripts/homologation/configure-neon-hml.mjs` | Infra/CI | Revertido pelo #19 | Médio | CI/configuração isolada |
| #17 | `f020be0da` | `scripts/homologation/neon-hml.mjs` | Infra/CI | Revertido pelo #19 | Médio | CI/configuração isolada |
| #17 | `f020be0da` | `scripts/homologation/neon-hml.test.mjs` | Infra/CI | Revertido pelo #19 | Médio | Teste incluído; verificar execução |
| #17 | `f020be0da` | `scripts/homologation/prepare-neon-secrets.mjs` | Infra/CI | Revertido pelo #19 | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `.env.cloud.backend.local.example` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `.env.cloud.frontend.local.example` | Frontend | Exclusivo de branch paralela | Médio | Vitest/Playwright/build |
| #18 | `dc8823d9f` | `.env.cloud.homolog.local.example` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `.env.homolog.example` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `.env.homolog.local.example` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `.env.smtp.homolog.local.example` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `.firebaserc` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `.github/workflows/ci.yml` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `.github/workflows/integration-real.yml` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `backend/src/main/java/com/oficinagestao/config/HomologationDatabaseGuard.java` | Domínio | Exclusivo de branch paralela | Médio | Maven/regressão |
| #18 | `dc8823d9f` | `backend/src/test/java/com/oficinagestao/config/HomologationDatabaseGuardTest.java` | Testes | Exclusivo de branch paralela | Médio | Teste incluído; verificar execução |
| #18 | `dc8823d9f` | `docs/deployment-google-cloud-run.md` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `docs/homologacao-final-gcp-firebase.md` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `docs/neon-homologacao-segura.md` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `docs/security-hardening/homologacao.md` | Identidade/AppSec | Exclusivo de branch paralela | Alto | Maven segurança/integr. |
| #18 | `dc8823d9f` | `firebase-public/.gitkeep` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `firebase.json` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `frontend/docker-entrypoint.mjs` | Frontend | Exclusivo de branch paralela | Médio | Vitest/Playwright/build |
| #18 | `dc8823d9f` | `frontend/src/lib/firebaseSession.test.ts` | Identidade/AppSec | Exclusivo de branch paralela | Alto | Teste incluído; verificar execução |
| #18 | `dc8823d9f` | `frontend/src/server/backendProxy.ts` | Frontend | Exclusivo de branch paralela | Médio | Vitest/Playwright/build |
| #18 | `dc8823d9f` | `frontend/src/server/firebaseSession.ts` | Identidade/AppSec | Exclusivo de branch paralela | Alto | Maven segurança/integr. |
| #18 | `dc8823d9f` | `scripts/homologation/CheckNeonTls.java` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `scripts/homologation/check-cloud-run.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `scripts/homologation/cloud-target.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `scripts/homologation/cloud-target.test.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | Teste incluído; verificar execução |
| #18 | `dc8823d9f` | `scripts/homologation/deployment-plan.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `scripts/homologation/hosting-config.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `scripts/homologation/hosting-predeploy.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `scripts/homologation/inspect-cloud-hml.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `scripts/homologation/inspect-dns.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `scripts/homologation/neon-hml.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `scripts/homologation/neon-hml.test.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | Teste incluído; verificar execução |
| #18 | `dc8823d9f` | `scripts/homologation/prepare-deployment.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `scripts/homologation/prepare-neon-secrets.mjs` | Infra/CI | Exclusivo de branch paralela | Médio | CI/configuração isolada |
| #18 | `dc8823d9f` | `scripts/homologation/test-firebase-session-local.mjs` | Identidade/AppSec | Exclusivo de branch paralela | Alto | Teste incluído; verificar execução |
| #19 | `80faf0eea` | `.dockerignore` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #19 | `80faf0eea` | `.env.homolog.example` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #19 | `80faf0eea` | `.env.homolog.local.example` | Infra/CI | Ausente | Médio | CI/configuração isolada |
| #19 | `80faf0eea` | `.github/workflows/ci.yml` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #19 | `80faf0eea` | `.gitignore` | Domínio | Evoluído | Médio | Maven/regressão |
| #19 | `80faf0eea` | `backend/src/main/java/com/oficinagestao/config/FlywayConfig.java` | Banco/Flyway | Mesmo conteúdo | Alto | Flyway em PostgreSQL isolado |
| #19 | `80faf0eea` | `backend/src/main/java/com/oficinagestao/config/HomologationDatabaseGuard.java` | Domínio | Ausente | Médio | Maven/regressão |
| #19 | `80faf0eea` | `backend/src/test/java/com/oficinagestao/config/FlywayConfigTest.java` | Banco/Flyway | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #19 | `80faf0eea` | `backend/src/test/java/com/oficinagestao/config/FlywayEmptySchemaIntegrationTest.java` | Banco/Flyway | Evoluído | Alto | Teste incluído; verificar execução |
| #19 | `80faf0eea` | `backend/src/test/java/com/oficinagestao/config/HomologationDatabaseGuardTest.java` | Testes | Ausente | Médio | Teste incluído; verificar execução |
| #19 | `80faf0eea` | `backend/src/test/java/com/oficinagestao/testsupport/ProductionMigrationPathTest.java` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #19 | `80faf0eea` | `docs/deployment-google-cloud-run.md` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #19 | `80faf0eea` | `docs/neon-homologacao-segura.md` | Infra/CI | Ausente | Médio | CI/configuração isolada |
| #19 | `80faf0eea` | `docs/security-hardening/homologacao.md` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #19 | `80faf0eea` | `scripts/homologation/CheckNeonTls.java` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #19 | `80faf0eea` | `scripts/homologation/configure-neon-hml.mjs` | Infra/CI | Ausente | Médio | CI/configuração isolada |
| #19 | `80faf0eea` | `scripts/homologation/neon-hml.mjs` | Infra/CI | Ausente | Médio | CI/configuração isolada |
| #19 | `80faf0eea` | `scripts/homologation/neon-hml.test.mjs` | Infra/CI | Ausente | Médio | Teste incluído; verificar execução |
| #19 | `80faf0eea` | `scripts/homologation/prepare-neon-secrets.mjs` | Infra/CI | Ausente | Médio | CI/configuração isolada |
| #20 | `67e15decc` | `.github/workflows/.gitkeep` | Infra/CI | Ausente | Médio | CI/configuração isolada |
| #20 | `67e15decc` | `README.md` | Domínio | Evoluído | Médio | Maven/regressão |
| #20 | `67e15decc` | `docs/database.md` | Documentação | Evoluído | Baixo | Revisão documental |
| #20 | `67e15decc` | `docs/development.md` | Documentação | Evoluído | Baixo | Revisão documental |
| #20 | `67e15decc` | `docs/homologacao-gcp-20261104/README.md` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #20 | `67e15decc` | `docs/homologacao-gcp-20261104/evidencias/dependency-tree.txt` | Infra/CI | Ausente | Médio | CI/configuração isolada |
| #20 | `67e15decc` | `docs/homologacao-gcp-20261104/evidencias/npm-audit-runtime.json` | Infra/CI | Ausente | Médio | CI/configuração isolada |
| #20 | `67e15decc` | `docs/repository-audit-20261108/README.md` | Documentação | Ausente | Baixo | Revisão documental |
| #20 | `67e15decc` | `docs/repository-audit-20261108/inventory.csv` | Documentação | Ausente | Baixo | Revisão documental |
| #20 | `67e15decc` | `docs/repository-audit-20261108/validation.json` | Documentação | Ausente | Baixo | Revisão documental |
| #20 | `67e15decc` | `frontend/README.md` | Frontend | Evoluído | Médio | Vitest/Playwright/build |
| #20 | `67e15decc` | `scripts/.gitkeep` | Domínio | Ausente | Médio | Maven/regressão |
| #21 | `5a9beb181` | `.env.example` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #21 | `5a9beb181` | `.github/workflows/.gitkeep` | Infra/CI | Ausente | Médio | CI/configuração isolada |
| #21 | `5a9beb181` | `.gitignore` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #21 | `5a9beb181` | `Auditoria de segurança - Oficina Gestão.md` | Domínio | Ausente | Médio | Maven/regressão |
| #21 | `5a9beb181` | `README.md` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #21 | `5a9beb181` | `docs/database.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #21 | `5a9beb181` | `docs/development.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #21 | `5a9beb181` | `docs/homologacao-gcp-20261104/README.md` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #21 | `5a9beb181` | `docs/homologacao-gcp-20261104/evidencias/dependency-tree.txt` | Infra/CI | Ausente | Médio | CI/configuração isolada |
| #21 | `5a9beb181` | `docs/homologacao-gcp-20261104/evidencias/npm-audit-runtime.json` | Infra/CI | Ausente | Médio | CI/configuração isolada |
| #21 | `5a9beb181` | `docs/homologacao-gcp-20261104/gitleaks-triagem.md` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #21 | `5a9beb181` | `docs/release-pre-homologacao/README.md` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #21 | `5a9beb181` | `docs/repository-audit/README.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #21 | `5a9beb181` | `docs/security-hardening/README.md` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #21 | `5a9beb181` | `docs/security-hardening/continuacao.md` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #21 | `5a9beb181` | `docs/security-hardening/matriz-rotas.md` | Identidade/AppSec | Ausente | Alto | Maven segurança/integr. |
| #21 | `5a9beb181` | `scripts/.gitkeep` | Domínio | Ausente | Médio | Maven/regressão |
| #21 | `5a9beb181` | `scripts/inventory-release.mjs` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #22 | `ada7332e5` | `backend/src/test/java/com/oficinagestao/DatabaseIdentityRegressionTest.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #22 | `ada7332e5` | `backend/src/test/java/com/oficinagestao/config/DotenvEnvironmentPostProcessorTest.java` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #22 | `ada7332e5` | `docs/neon-admin-readiness/README.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #22 | `ada7332e5` | `docs/neon-admin-readiness/permission-matrix.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #23 | `9842bda1f` | `.env.example` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #23 | `9842bda1f` | `.env.homolog.example` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #23 | `9842bda1f` | `.env.production.example` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #23 | `9842bda1f` | `.github/workflows/ci.yml` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/controller/AdminAuditController.java` | Domínio | Evoluído | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/controller/AdminDashboardController.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/controller/AdminInfrastructureController.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/controller/AdminRoleController.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/controller/AdminUserController.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/controller/InviteController.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/dto/AcceptInviteRequest.java` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/dto/AdminChangeRequest.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/dto/AdminUserResponse.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/dto/BootstrapSuperAdminRequest.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/dto/CreateInviteRequest.java` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/dto/CurrentUserResponse.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/dto/RoleChangeRequest.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/dto/RoleResponse.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/entity/Permissao.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/entity/Role.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/repository/UsuarioRepository.java` | Domínio | Evoluído | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/security/JwtAuthenticationFilter.java` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/security/OperationalPermissionCatalog.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/security/SecurityConfig.java` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/service/AdminUserService.java` | Domínio | Evoluído | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/service/AuthService.java` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/service/EmailService.java` | Domínio | Evoluído | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/service/EmailServiceImpl.java` | Domínio | Evoluído | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/service/InfrastructureMonitoringService.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/service/InviteService.java` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `backend/src/main/java/com/oficinagestao/service/RoleManagementService.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/resources/application.properties` | Domínio | Evoluído | Médio | Maven/regressão |
| #23 | `9842bda1f` | `backend/src/main/resources/db/migration/V25__admin_rbac.sql` | Banco/Flyway | Mesmo conteúdo | Alto | Flyway em PostgreSQL isolado |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/DatabaseConnectionTest.java` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/config/FlywayEmptySchemaIntegrationTest.java` | Banco/Flyway | Evoluído | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/config/ProductionOpenApiSecurityTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/controller/AuthControllerTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/controller/ClienteControllerTest.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/controller/NotificacaoControllerTest.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/controller/OrdemServicoControllerTest.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/controller/ProdutoControllerTest.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/controller/SystemControllerTest.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/exception/GlobalExceptionHandlerTest.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/security/AdminUserLifecycleIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/security/CsrfMvcRoutingTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/security/CurrentGrantJwtFilterTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/security/CustomRoleRevocationIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/security/IndependentRouteAuditTest.java` | Identidade/AppSec | Evoluído | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/security/InfrastructureMonitoringIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/security/InviteLifecycleIntegrationTest.java` | Identidade/AppSec | Evoluído | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/security/RouteAuthorizationAuditTest.java` | Identidade/AppSec | Evoluído | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/security/SuperAdminBootstrapIntegrationTest.java` | Identidade/AppSec | Evoluído | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/testsupport/ProductionMigrationPathTest.java` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/testsupport/SyntheticMigrations.java` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/java/com/oficinagestao/testsupport/WithOperationalUser.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/resources/db/synthetic-migration/V25__admin_rbac.sql` | Banco/Flyway | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `backend/src/test/resources/synthetic-migrations.sha256` | Banco/Flyway | Evoluído | Alto | Teste incluído; verificar execução |
| #23 | `9842bda1f` | `docs/admin-rbac/implementation-plan.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #23 | `9842bda1f` | `docs/admin-rbac/infrastructure.md` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #23 | `9842bda1f` | `docs/admin-rbac/provisioning.md` | Documentação | Evoluído | Baixo | Revisão documental |
| #23 | `9842bda1f` | `docs/admin-rbac/report.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #23 | `9842bda1f` | `frontend/src/app/(authenticated)/administracao/auditoria/page.tsx` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `frontend/src/app/(authenticated)/administracao/infraestrutura/page.tsx` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `frontend/src/app/(authenticated)/administracao/page.tsx` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `frontend/src/app/(authenticated)/administracao/papeis/page.tsx` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `frontend/src/app/(authenticated)/administracao/usuarios/page.tsx` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #23 | `9842bda1f` | `frontend/src/app/convite/page.tsx` | Frontend | Mesmo conteúdo | Médio | Vitest/Playwright/build |
| #23 | `9842bda1f` | `frontend/src/components/Header.tsx` | Frontend | Evoluído | Médio | Vitest/Playwright/build |
| #23 | `9842bda1f` | `frontend/src/lib/types.ts` | Frontend | Mesmo conteúdo | Médio | Vitest/Playwright/build |
| #23 | `9842bda1f` | `scripts/generate-rbac-catalog.mjs` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #24 | `09728bf6f` | `.github/workflows/ci.yml` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #24 | `09728bf6f` | `backend/src/main/java/com/oficinagestao/controller/ConfiguracaoOficinaController.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #24 | `09728bf6f` | `backend/src/main/java/com/oficinagestao/repository/UsuarioRepository.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #24 | `09728bf6f` | `backend/src/main/java/com/oficinagestao/service/AdminUserService.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #24 | `09728bf6f` | `backend/src/main/java/com/oficinagestao/service/ConfiguracaoOficinaService.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #24 | `09728bf6f` | `backend/src/main/resources/db/migration/V26__restrict_consulta_permissions.sql` | Banco/Flyway | Mesmo conteúdo | Alto | Flyway em PostgreSQL isolado |
| #24 | `09728bf6f` | `backend/src/test/java/com/oficinagestao/DatabaseConnectionTest.java` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #24 | `09728bf6f` | `backend/src/test/java/com/oficinagestao/config/FlywayEmptySchemaIntegrationTest.java` | Banco/Flyway | Evoluído | Alto | Teste incluído; verificar execução |
| #24 | `09728bf6f` | `backend/src/test/java/com/oficinagestao/security/ConsultaPermissionIntegrationTest.java` | Identidade/AppSec | Evoluído | Alto | Teste incluído; verificar execução |
| #24 | `09728bf6f` | `backend/src/test/java/com/oficinagestao/testsupport/ProductionMigrationPathTest.java` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #24 | `09728bf6f` | `backend/src/test/java/com/oficinagestao/testsupport/SyntheticMigrations.java` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #24 | `09728bf6f` | `backend/src/test/resources/db/synthetic-migration/V26__restrict_consulta_permissions.sql` | Banco/Flyway | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #24 | `09728bf6f` | `backend/src/test/resources/synthetic-migrations.sha256` | Banco/Flyway | Evoluído | Alto | Teste incluído; verificar execução |
| #24 | `09728bf6f` | `docs/admin-rbac/independent-audit-stage3-initial.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #24 | `09728bf6f` | `docs/admin-rbac/independent-audit-stage3.md` | Documentação | Evoluído | Baixo | Revisão documental |
| #24 | `09728bf6f` | `frontend/e2e/admin-responsive.spec.ts` | Frontend | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #24 | `09728bf6f` | `frontend/e2e/logout.spec.ts` | Frontend | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #24 | `09728bf6f` | `frontend/next.config.ts` | Frontend | Evoluído | Médio | Vitest/Playwright/build |
| #24 | `09728bf6f` | `frontend/playwright.config.ts` | Frontend | Mesmo conteúdo | Médio | Vitest/Playwright/build |
| #24 | `09728bf6f` | `frontend/src/lib/securityHeaders.test.ts` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #24 | `09728bf6f` | `nginx/nginx.conf` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #25 | `bae5104d0` | `.env.example` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #25 | `bae5104d0` | `.env.homolog.example` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #25 | `bae5104d0` | `.env.production.example` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #25 | `bae5104d0` | `.github/workflows/ci.yml` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #25 | `bae5104d0` | `.github/workflows/oracle-readiness.yml` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #25 | `bae5104d0` | `backend/pom.xml` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #25 | `bae5104d0` | `backend/src/main/java/com/oficinagestao/service/EmailServiceImpl.java` | Domínio | Evoluído | Médio | Maven/regressão |
| #25 | `bae5104d0` | `backend/src/main/java/com/oficinagestao/service/InviteOutbox.java` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #25 | `bae5104d0` | `backend/src/main/java/com/oficinagestao/service/InviteService.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #25 | `bae5104d0` | `backend/src/main/resources/application.properties` | Domínio | Evoluído | Médio | Maven/regressão |
| #25 | `bae5104d0` | `backend/src/main/resources/db/migration/V27__invite_delivery_outbox.sql` | Banco/Flyway | Mesmo conteúdo | Alto | Flyway em PostgreSQL isolado |
| #25 | `bae5104d0` | `backend/src/test/java/com/oficinagestao/DatabaseConnectionTest.java` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #25 | `bae5104d0` | `backend/src/test/java/com/oficinagestao/config/FlywayEmptySchemaIntegrationTest.java` | Banco/Flyway | Evoluído | Alto | Teste incluído; verificar execução |
| #25 | `bae5104d0` | `backend/src/test/java/com/oficinagestao/security/InviteLifecycleIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #25 | `bae5104d0` | `backend/src/test/java/com/oficinagestao/security/InviteOutboxIntegrationTest.java` | Identidade/AppSec | Evoluído | Alto | Teste incluído; verificar execução |
| #25 | `bae5104d0` | `backend/src/test/java/com/oficinagestao/security/SuperAdminBootstrapIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #25 | `bae5104d0` | `backend/src/test/java/com/oficinagestao/testsupport/ProductionMigrationPathTest.java` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #25 | `bae5104d0` | `backend/src/test/java/com/oficinagestao/testsupport/SyntheticMigrations.java` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #25 | `bae5104d0` | `backend/src/test/resources/application-test.properties` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #25 | `bae5104d0` | `backend/src/test/resources/db/synthetic-migration/V27__invite_delivery_outbox.sql` | Banco/Flyway | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #25 | `bae5104d0` | `backend/src/test/resources/synthetic-migrations.sha256` | Banco/Flyway | Evoluído | Alto | Teste incluído; verificar execução |
| #25 | `bae5104d0` | `docker-compose.yml` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #25 | `bae5104d0` | `docs/admin-rbac/independent-audit-stage3-2.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #25 | `bae5104d0` | `docs/admin-rbac/independent-audit-stage3.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #25 | `bae5104d0` | `docs/admin-rbac/provisioning.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #25 | `bae5104d0` | `docs/neon-admin-readiness/stage3-2-homologation.md` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #25 | `bae5104d0` | `frontend/e2e/integration-real.spec.ts` | Frontend | Evoluído | Médio | Teste incluído; verificar execução |
| #25 | `bae5104d0` | `frontend/src/app/(authenticated)/administracao/usuarios/page.tsx` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #25 | `bae5104d0` | `scripts/test-real-stack-local.mjs` | Testes | Evoluído | Médio | Teste incluído; verificar execução |
| #26 | `c5caa53b7` | `AGENTS.md` | Domínio | Exclusivo de branch paralela | Médio | Maven/regressão |
| #26 | `c5caa53b7` | `SECURITY.md` | Identidade/AppSec | Exclusivo de branch paralela | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `.env.example` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #27 | `69ef399ff` | `.env.homolog.example` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #27 | `69ef399ff` | `.env.production.example` | Infra/CI | Evoluído | Médio | CI/configuração isolada |
| #27 | `69ef399ff` | `.github/workflows/ci.yml` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/config/DotenvEnvironmentPostProcessor.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/controller/AdminAuditController.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/controller/PasswordRecoveryController.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/controller/SessionController.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/dto/AcceptInviteRequest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/dto/AlterarSenhaRequest.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/dto/CompletePasswordRecoveryRequest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/dto/CreateInviteRequest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/dto/LoginChallengeResponse.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/dto/LoginRequest.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/dto/LoginResult.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/dto/PasswordRecoveryRequest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/dto/TwoFactorResendRequest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/dto/TwoFactorVerifyRequest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/entity/RefreshToken.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/exception/GlobalExceptionHandler.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/security/ConsultaResponseRedaction.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/security/SecurityConfig.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/service/AuthService.java` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/service/EmailService.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/service/EmailServiceImpl.java` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/service/InviteOutbox.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/java/com/oficinagestao/service/PasswordRecoveryService.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `backend/src/main/resources/application.properties` | Domínio | Evoluído | Médio | Maven/regressão |
| #27 | `69ef399ff` | `backend/src/main/resources/db/migration/V28__password_recovery.sql` | Banco/Flyway | Mesmo conteúdo | Alto | Flyway em PostgreSQL isolado |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/DatabaseConnectionTest.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/config/DotenvEnvironmentPostProcessorTest.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/config/FlywayEmptySchemaIntegrationTest.java` | Banco/Flyway | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/security/AdminAuditFilterIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/security/ConsultaPermissionIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/security/IndependentRouteAuditTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/security/PasswordRecoveryIntegrationTest.java` | Identidade/AppSec | Evoluído | Alto | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/security/RoleMatrixRouteIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/security/RouteAuthorizationAuditTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/security/SessionControllerIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/service/SmtpNetwork5xxTest.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/testsupport/ProductionMigrationPathTest.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/java/com/oficinagestao/testsupport/SyntheticMigrations.java` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/resources/db/synthetic-migration/V28__password_recovery.sql` | Banco/Flyway | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `backend/src/test/resources/synthetic-migrations.sha256` | Banco/Flyway | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `docs/admin-rbac/stage33-config-and-retention.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #27 | `69ef399ff` | `docs/admin-rbac/stage33-report.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #27 | `69ef399ff` | `docs/admin-rbac/stage4-operational-plan.md` | Documentação | Evoluído | Baixo | Revisão documental |
| #27 | `69ef399ff` | `frontend/e2e/integration-real.spec.ts` | Frontend | Evoluído | Médio | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `frontend/e2e/visual-refinement.spec.ts` | Frontend | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #27 | `69ef399ff` | `frontend/next.config.ts` | Frontend | Mesmo conteúdo | Médio | Vitest/Playwright/build |
| #27 | `69ef399ff` | `frontend/src/app/(authenticated)/administracao/auditoria/page.tsx` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `frontend/src/app/(authenticated)/sessoes/page.tsx` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #27 | `69ef399ff` | `frontend/src/app/esqueci-senha/page.tsx` | Frontend | Mesmo conteúdo | Médio | Vitest/Playwright/build |
| #27 | `69ef399ff` | `frontend/src/app/login/page.tsx` | Frontend | Mesmo conteúdo | Médio | Vitest/Playwright/build |
| #27 | `69ef399ff` | `frontend/src/app/recuperar-senha/page.tsx` | Frontend | Mesmo conteúdo | Médio | Vitest/Playwright/build |
| #27 | `69ef399ff` | `frontend/src/components/Header.tsx` | Frontend | Mesmo conteúdo | Médio | Vitest/Playwright/build |
| #28 | `f49707d70` | `backend/src/test/java/com/oficinagestao/security/InviteOutboxIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #28 | `f49707d70` | `backend/src/test/java/com/oficinagestao/security/PasswordRecoveryIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #28 | `f49707d70` | `docs/admin-rbac/stage34-final-audit.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #29 | `ba18f6c97` | `backend/src/main/java/com/oficinagestao/repository/RefreshTokenRepository.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #29 | `ba18f6c97` | `backend/src/main/java/com/oficinagestao/security/JwtAuthenticationFilter.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #29 | `ba18f6c97` | `backend/src/main/java/com/oficinagestao/security/JwtService.java` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #29 | `ba18f6c97` | `backend/src/main/java/com/oficinagestao/service/AuthService.java` | Identidade/AppSec | Evoluído | Alto | Maven segurança/integr. |
| #29 | `ba18f6c97` | `backend/src/main/resources/application.properties` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #29 | `ba18f6c97` | `backend/src/test/java/com/oficinagestao/security/AccessTokenSessionBindingIntegrationTest.java` | Identidade/AppSec | Evoluído | Alto | Teste incluído; verificar execução |
| #29 | `ba18f6c97` | `backend/src/test/java/com/oficinagestao/security/PasswordRecoveryTimingIntegrationTest.java` | Identidade/AppSec | Evoluído | Alto | Teste incluído; verificar execução |
| #29 | `ba18f6c97` | `backend/src/test/resources/application-test.properties` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #29 | `ba18f6c97` | `docs/admin-rbac/stage35-final-audit.md` | Documentação | Evoluído | Baixo | Revisão documental |
| #30 | `fc1560ab0` | `.env.production.example` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #30 | `fc1560ab0` | `.github/workflows/oracle-readiness.yml` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #30 | `fc1560ab0` | `backend/src/main/java/com/oficinagestao/security/JwtService.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #30 | `fc1560ab0` | `backend/src/main/java/com/oficinagestao/service/AuthService.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Maven segurança/integr. |
| #30 | `fc1560ab0` | `backend/src/test/java/com/oficinagestao/security/AccessTokenSessionBindingIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #30 | `fc1560ab0` | `backend/src/test/java/com/oficinagestao/security/OperationalCriticalFlowsIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #30 | `fc1560ab0` | `backend/src/test/java/com/oficinagestao/security/PasswordRecoveryTimingIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #30 | `fc1560ab0` | `backend/src/test/java/com/oficinagestao/security/ProductionSessionParityIntegrationTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #30 | `fc1560ab0` | `backend/src/test/java/com/oficinagestao/service/AuthServiceTest.java` | Identidade/AppSec | Mesmo conteúdo | Alto | Teste incluído; verificar execução |
| #30 | `fc1560ab0` | `docker-compose.yml` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #30 | `fc1560ab0` | `docs/admin-rbac/evidence-stage4a/execution.json` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #30 | `fc1560ab0` | `docs/admin-rbac/evidence-stage4a/private-config-presence.json` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #30 | `fc1560ab0` | `docs/admin-rbac/evidence-stage4a/recovery-timing.csv` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #30 | `fc1560ab0` | `docs/admin-rbac/evidence-stage4a/recovery-timing.json` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #30 | `fc1560ab0` | `docs/admin-rbac/evidence-stage4a/stage35-junit.json` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #30 | `fc1560ab0` | `docs/admin-rbac/evidence-stage4a/stage4a-junit.json` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #30 | `fc1560ab0` | `docs/admin-rbac/stage35-final-audit.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #30 | `fc1560ab0` | `docs/admin-rbac/stage4-operational-plan.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #30 | `fc1560ab0` | `docs/admin-rbac/stage4a-neon-runbook.md` | Documentação | Mesmo conteúdo | Baixo | Revisão documental |
| #30 | `fc1560ab0` | `docs/admin-rbac/stage4a-prehomologation.md` | Infra/CI | Mesmo conteúdo | Médio | CI/configuração isolada |
| #30 | `fc1560ab0` | `frontend/e2e/integration-real.spec.ts` | Frontend | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #30 | `fc1560ab0` | `scripts/analyze-recovery-timing.mjs` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #30 | `fc1560ab0` | `scripts/audit-private-config.mjs` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #30 | `fc1560ab0` | `scripts/audit-private-config.test.mjs` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
| #30 | `fc1560ab0` | `scripts/collect-stage4a-evidence.mjs` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #30 | `fc1560ab0` | `scripts/summarize-maven-reports.mjs` | Domínio | Mesmo conteúdo | Médio | Maven/regressão |
| #30 | `fc1560ab0` | `scripts/test-real-stack-local.mjs` | Testes | Mesmo conteúdo | Médio | Teste incluído; verificar execução |
