# Etapa 3.3 — relatório de pré-homologação

Data: 11/11/2026. Base: PR #25, `bae5104d08d85ae1671284cdf814226ba2462ccb`. Commit funcional validado: `a177516b3a0b15c071721fccb7b4c3acd9f8fac2`. Branch e SHA final do relatório: head do [PR #27](https://github.com/uaikauaa/oficina/pull/27), em draft sobre o PR #25; consultar os checks associados ao head para o estado do CI. Os PRs #21–#25 permaneciam abertos; #22 depende de #21, #23 de #22, #24 de #23 e #25 de #24. Nenhum merge, deploy, e-mail real, conta real ou acesso ao Neon original ocorreu nesta etapa.

## Mudanças e migrations

- V28 acrescenta `session_id` aos refresh tokens e cria verificador de recuperação (`token_hash` SHA-256, expiração, uso e revogação) e outbox cifrada. V1–V27 e B24 permanecem intactas. A migração foi exercitada nos caminhos sintético novo e incremental em PostgreSQL descartável.
- Recuperação pública: resposta genérica para e-mail desconhecido/inativo, limites persistentes por IP/e-mail, token aleatório de 256 bits, uso único, validade de 5–60 minutos, senha conforme política existente, invalidação de `token_version`, refresh tokens e desafios 2FA. O link usa fragmento URL; a página o remove do histórico, aplica `no-referrer` e `no-store`. A outbox só entrega após commit, usa AES-GCM com AAD distinto do convite, retry limitado e apaga ciphertext em estado terminal. Auditoria registra IDs e categorias, sem credenciais.
- Sessões: ID estável durante rotação do refresh token, inventário de sessões ativas com criação e expiração verificáveis, identificação por cookie de refresh, revogação individual, das outras ou de todas. Nenhuma localização, dispositivo ou última atividade é inferida. Revogação individual/outras impede refresh imediatamente; um access JWT já emitido pode durar até 15 minutos. Revogação geral incrementa `token_version` e invalida access JWT. IDs de terceiros são recusados.
- Auditoria administrativa: filtros por ação, ator/alvo e período, ordenação controlada, paginação limitada a 100, detalhes e acesso por permissão de backend. Sem exclusão automática: a retenção efetiva e a decisão operacional pendente estão em [configuração e retenção](stage33-config-and-retention.md). Exportação não foi adicionada sem contrato de autorização e retenção definido.
- Respostas para `ROLE_CONSULTA` minimizam contato/documentos nas leituras preservadas. Um usuário que também possua `ROLE_OPERADOR_GERAL`, `ROLE_SUPER_ADMIN` ou `ROLE_ADMIN` conserva os dados necessários ao trabalho operacional; há regressão específica para a combinação de papéis.
- Modelos `.env` e carregamento de desenvolvimento/teste foram revistos. Configuração prevista para Secret Manager, TLS `sslmode=verify-full` e limites constam do documento acima. [Plano separado da Etapa 4](stage4-operational-plan.md) cobre backup/restauração, segredos, migrations, conta principal, Geisa e rollback; não foi executado.

## Evidências locais

| Verificação | Resultado | Limite |
|---|---|---|
| `mvnw.cmd clean verify` com `TEST_DB_*` e PostgreSQL 16 em `127.0.0.1:5433` | 884 testes, 0 falhas, 0 erros, 0 ignorados; build aprovado | Banco descartável, guard de destino e migrations sintéticas com hashes. |
| Frontend `npm test`, ESLint, TypeScript e build Next | 379 testes e demais comandos aprovados | Sem backend nesses comandos. |
| Playwright mockado | 115 aprovados nos cinco viewports da etapa 3.2 | Respostas administrativas simuladas. |
| Playwright real, Next → Spring → PostgreSQL descartável → Mailpit | 3 aprovados | Login/2FA, operação, convite, administração, RBAC selecionado e recuperação/replay. Não é a matriz integral de operações reais por papel. |
| Duas JVMs e outbox | Aprovado | Rate limit distribuído e convite pendente após reinício; uma mensagem no Mailpit e ciphertext apagado. |
| SMTP 550 por TCP loopback | Aprovado no teste unitário de transporte | Propagação do 550 comprovada; classificação terminal na outbox é coberta separadamente por exceção sintética. A combinação ponta a ponta ainda requer teste. |
| Flyway V28 | Aprovado pela suíte de migrations | Somente PostgreSQL descartável; sem Neon original. |
| Segredos | Placeholders revisados; Gitleaks CI aprovado em `dac77588001683846cbbdb483fc9589e6cb5371b` | Segredos operacionais não foram fornecidos nem testados. |

Os quatro workflows GitHub Actions de `dac77588001683846cbbdb483fc9589e6cb5371b` concluíram com sucesso: CI Pipeline (backend, frontend e Gitleaks), Flyway/E2E complementar (incluindo Playwright, imagens, Trivy e SBOM), integração real e Oracle Readiness. Esta atualização documental posterior não modifica código executável; os checks do head atual do PR devem ser consultados antes de revisão/merge.

## Matriz de autorização verificada

O teste `RoleMatrixRouteIntegrationTest` percorre todas as regras do catálogo HTTP para os nove papéis integrados, comparando cada resultado com o grant persistido. Testes de objeto, revogação e cenários de privilégio complementam a matriz. A tabela descreve o escopo observado, sem afirmar que cada formulário de cada papel foi percorrido em browser real.

| Papel | Cobertura | Limite |
|---|---|---|
| `ROLE_SUPER_ADMIN` | Rotas do catálogo, administração e provisionamento sintético real | Conta principal real não criada. |
| `ROLE_OPERADOR_GERAL` | Catálogo, negativas administrativas e operações reais selecionadas: clientes, máquina, produto, estoque, OS, PDF e relatório | Todas as combinações de estado/financeiro não tiveram percurso Playwright real. |
| `ROLE_ADMIN` | Catálogo e bootstrap/provisionamento sintético | Legado não equivale a SUPER_ADMIN. |
| `ROLE_GERENTE`, `ROLE_ATENDENTE`, `ROLE_TECNICO`, `ROLE_ESTOQUISTA`, `ROLE_FINANCEIRO` | Positivos/negativos de método/rota contra grants persistidos | Sem fluxo browser completo por papel. |
| `ROLE_CONSULTA` | Nove leituras, negativas administrativas/financeiras e minimização de dados pessoais | Revisão de minimização deve ser repetida com dados representativos na homologação. |
| Papel personalizado | Criação, edição e atribuição em fluxo real isolado | Sem varredura de todos os grants personalizados possíveis. |

## Pendências separadas

**Testes não executados:** matriz integral de formulários e mutações reais para cada papel; todas as combinações de erro, estado vazio, expiração e acessibilidade do painel no browser com stack real; SMTP 550 atravessando toda a outbox por rede. **Falhas comprovadas:** nenhuma na suíte final ou no Playwright; um rerun intermediário de `clean verify` falhou porque as JVMs do ensaio real ainda mantinham o JAR aberto no Windows. Após o encerramento, o rerun final passou. **Riscos potenciais:** access JWT de sessão revogada individualmente pode valer até 15 minutos; SMTP pode aceitar a mensagem e falhar antes do ack, permitindo reenvio; enumeração por tempo de resposta da solicitação de recuperação não foi medida. **Melhorias opcionais:** exportação auditada após política de retenção e identidade de dispositivo somente com coleta consentida e fonte verificável.

## Veredito e gates

**NO-GO para declarar a Etapa 3.3 tecnicamente concluída ou produção pronta.** Os fluxos essenciais implementados, os testes sintéticos locais e os quatro workflows CI avançaram, mas a matriz Playwright real integral, a validação SMTP 5xx de ponta a ponta e a homologação operacional permanecem gates. A Etapa 4 está apenas planejada; backup/restauração do Neon original, TLS e identidade no destino, Secret Manager, conta principal com 2FA, transição da Geisa e rollback exigem autorização e execução futuras.
