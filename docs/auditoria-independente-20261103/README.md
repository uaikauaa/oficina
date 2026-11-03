# Auditoria final independente — PR #13

Revisão iniciada sobre `6566c3a87a2c80433f84d851d8a83ea65dd2a250`, incluindo suas correções. Os resultados anteriores não foram usados como evidência de aprovação. Esta entrega contém novas reproduções, correções e execuções. Não houve merge, deploy ou uso de credenciais/dados de produção. O PR deve continuar draft.

## Escopo e interpretação

O PDF fornecido, “Relatório de pesquisa: ataques conhecidos contra sistemas web e roteiro de auditoria de segurança”, tem 17 páginas (SHA256 `4751091d605571b984b6d11bd49a4e6d2b20844f86cd2250b0e8d979565a7300`) e organiza famílias de ataques e um checklist; não contém uma lista literal numerada de 60 casos. A [matriz de 60 cenários](matriz-ameacas.md) decompõe essas famílias em verificações operacionais, incluindo os requisitos expressos do solicitante. “Local” não equivale a homologação da infraestrutura; ausência de uma superfície é uma conclusão sobre este código, não um ataque executado contra um serviço externo.

Foram revisados os controllers, DTOs, filtros e serviços associados às 83 combinações de método e rota, além dos repositórios e superfícies Next.js. A [matriz de rotas](matriz-rotas.md) identifica origem, entrada, dados e política. [Sondagens independentes com JWT real](independent-route-coverage.json) confrontam o inventário documentado com os mappings efetivamente registrados. O teste falha diante de rota nova ou removida. IDs inexistentes e JSON vazio verificam a fronteira sem criar dados indevidos; não representam todos os corpos válidos possíveis. Regras positivas são cobertas pelos testes de domínio e pela integração real local.

## Achados reproduzidos e corrigidos

| ID / gravidade | Reprodução no baseline | Correção e regressão |
|---|---|---|
| INDEP-01 / alta | Trocar somente o JWT secret abria um novo orçamento do rate limiter, pois ambos derivavam da mesma chave. `RateKeyRotationAuditTest.jwtRotationMustNotResetAnActiveRateBudget` falhou antes da correção. | `RATE_LIMIT_SECRET` obrigatório e independente de JWT e SERVICE_PROXY_SECRET. Registro Flyway V24 da geração, transações próprias, UPSERT atômico e bloqueio da mudança de chave enquanto existem contadores ativos. Seis testes de rotação/concorrência, mais reinício com JWT diferente em duas JVMs reais. |
| INDEP-02 / média | `escaparCsv('=1+1')` retornava fórmula executável; aspas RFC não neutralizam fórmulas. Teste `csvSecurityAudit` falhou no baseline. | Campo textual potencialmente fórmula recebe TAB dentro das aspas; reconhece prefixos invisíveis e equivalentes de largura cheia, preservando números negativos. Regressões unitárias e download CSV real pelo navegador. Não houve teste em Excel/LibreOffice ou de salvar/reabrir nesses programas. |
| INDEP-03 / média | Stream de request sem fim permanecia aberto após 11 s antes de alcançar o backend. `backendProxyAudit` falhou no baseline. | Prazo total de leitura de 10 s, buffer limitado a 64 KiB, cancelamento sem esperar um produtor travado, tratamento de aborto e erro genérico. Regressão inclui cancelamento que nunca resolve. Não é ensaio de saturação do ingresso Google. |
| INDEP-04 / baixa | HTML 404 de caminho terminado em `.html` não recebia CSP por exclusão genérica de pontos no matcher. `csp-errors.spec.ts` falhou antes da correção. Não se demonstrou XSS nesse caminho. | Matcher exclui os assets conhecidos e `_next`, mantendo nonce/CSP nas páginas de erro da aplicação, inclusive caminhos pontuados. Teste de navegador para duas variantes 404. |

Os logs locais de falha são `audit-independent-baseline-rotation.log`, `audit-independent-baseline-csv.log`, `audit-independent-baseline-body.log` e `audit-independent-baseline-csp.log`; não são versionados para evitar copiar dados de execução. As regressões ficam no repositório e a síntese das novas execuções em [evidências](evidencias.json).

## Chaves, criptografia e transição

JWT usa HS256 com `iss`, `aud`, expiração e `iat`; a validação de usuário ativo e tokenVersion permanece no banco. Testes incluem assinatura adulterada, unsigned, algoritmo diferente, datas futuras/expiradas e rotação. Senhas/2FA/refresh são hashes, não criptografia reversível. TLS e criptografia em repouso do ambiente real não foram comprovados.

`JWT_SECRET`, `RATE_LIMIT_SECRET` e `SERVICE_PROXY_SECRET` precisam de três valores aleatórios independentes e referências distintas no Secret Manager. Chaves curtas/reutilizadas falham na inicialização, sem imprimir os valores. A rotação de JWT invalida tokens assinados pela chave anterior nas instâncias atualizadas e preserva os contadores. Durante rollout misto, instâncias antigas ainda aceitam a chave antiga: corte global/revogação coordenada precisa de homologação.

A rotação do RATE_LIMIT_SECRET é deliberadamente uma manutenção: drenar/parar todos os escritores antigos, aguardar a maior janela configurada (padrão 15 minutos), trocar a chave e reiniciar de modo coordenado. Não apagar contadores para contornar o bloqueio. Gerações concorrentes não podem dividir o orçamento; uma geração divergente falha com 503 enquanto houver janela ativa. A atualização a partir de 6566c3a também encontra contadores legados sem registro e bloqueia até expirarem. Isso preserva segurança com impacto de disponibilidade explícito. Não se promete rotação sem interrupção.

O SERVICE_PROXY_SECRET exige troca coordenada entre Next e API: assinatura antiga é recusada pelo verificador novo, e vice-versa. O token IAM vem apenas do servidor; o JWT da aplicação segue em Authorization e o IAM em X-Serverless-Authorization. A validação de audience/expiração/metadados tem testes locais; **a efetiva restrição IAM no Cloud Run é NÃO VERIFICADA**.

## Exclusões Playwright

Os dois testes antes ignorados eram o login dependente de credenciais locais e a integração de stack real. O login passou a usar uma conta sintética com resposta controlada e exigir a tela de 2FA. Não foram criadas novas exclusões para obter verde. A suíte mockada separa `integration-real.spec.ts` via `testIgnore`, porque esse arquivo exige PostgreSQL e SMTP sintéticos; o arquivo é executado pelo job e script próprios com `RUN_REAL_INTEGRATION=true`. Essa separação não é evidência de aprovação: o resultado da execução real é registrado separadamente. Não existem outros `skip`/`fixme` em e2e além da guarda ambiental desse arquivo.

## Novas execuções e artefatos

| Verificação | Resultado desta revisão |
|---|---|
| Java 21 / `mvnw clean verify` | 829 testes, 0 falhas/erros/skips; `verify` posterior com a regressão adicional JWT: **830**, 0 falhas/erros/skips |
| ESLint / TypeScript da aplicação e e2e / Next produção | Aprovados; Next 16.4.1 |
| Unitários frontend | **376** aprovados, zero skips |
| Playwright UI/mockado | **119** aprovados, zero skips; CSP/nonce, erros HTML, 2FA, PWA e responsividade |
| Playwright stack real | **1** cenário aprovado, zero skips; API + migrations reais V1–V24 + PostgreSQL + Mailpit + navegador |
| Limiter compartilhado | 64 operações/8 threads/3 clientes DB; 32 chamadas com gerações divergentes; 12 tentativas em duas JVMs, 10 respostas 401 e 2 respostas 429; reinício/JWT novo mantém 429 |
| Proxy standalone + parser HTTP/1 | Métodos, cookies, CSRF, JWT, erro, PDF/CSV bytes, 413 e rejeição 400 de CL+TE/CL conflitantes |
| TLS/SMTP sintéticos locais | 2 testes aprovados: confiança/hostname e STARTTLS obrigatório; não homologam fornecedores |
| Docker backend e frontend | Rebuilds concluídos; IDs nos relatórios Trivy/evidências |
| Trivy imagens e secret scan de arquivos | **0 CVEs e 0 secrets** nas duas imagens; 0 secrets no scan fs offline com exclusões explícitas |
| npm audit | Runtime: **0**; completo: **16 moderados**, 0 altos/críticos, em ferramentas de desenvolvimento |
| SBOM / árvore Maven | Regeneradas nesta revisão |

[Evidências estruturadas](evidencias.json), [830 casos JUnit](junit-cases.json), [hashes LF das fontes](source-fingerprints.json), [manifest Next compilado](next-app-manifest.json), [sondagens negativas](independent-negative-vectors.json), [SBOM](sbom-backend.json), [árvore Maven](dependency-tree.txt), [Trivy backend](trivy-backend.json), [Trivy frontend](trivy-frontend.json), [scan de arquivos](trivy-files.json), [npm runtime](npm-audit-runtime.json) e [npm completo](npm-audit-full.json). `scripts/collect-independent-audit.mjs` recusa evidências locais incompletas e registra hashes dos logs sem publicá-los. O SHA do commit da entrega e as execuções remotas finais são vinculados no [PR #13](https://github.com/uaikauaa/oficina/pull/13); resultados remotos não são antecipados neste texto.

Os 16 alertas moderados não são tratados como inexistentes. A árvore de execução empacotada tem scan sem CVEs conhecidas nesta base; ESLint e ferramentas de desenvolvimento permanecem expostos ao processamento de arquivos no CI. Não foi aplicado `npm audit fix --force` com downgrade incompatível para mascarar esse risco. A execução fs offline exclui `.git`, node_modules, `.next`, target e logs audit; o scan de imagens examina o runtime empacotado. Uma tentativa Trivy frontend encontrou cache ocupado por outro scanner; a repetição serial concluiu e substituiu o arquivo incompleto.

## Riscos residuais e homologação obrigatória

| Risco | Nível residual | Estado / critério de saída |
|---|---|---|
| IAM público indevido, identidade/audience errada, IP forjado no ingresso real | Alto | **NÃO VERIFICADO**. Em projeto Google isolado, anônimo e identidade sem invoker devem falhar, identidade correta deve passar; testar cadeia exata de proxies e segredo de contexto sem vazamento no navegador/log. |
| TLS Google/Neon/SMTP, CA/hostname, STARTTLS downgrade, credenciais/backup em repouso | Alto | **NÃO VERIFICADO** no ambiente real. Scripts `scripts/homologation/` preparados; certificados efêmeros e Mailpit locais não aprovam fornecedores. Testar também privilégios mínimos, PITR/restore e retenção. |
| Rotação e rollout misto de três chaves; transição V24 | Médio/alto disponibilidade | Procedimento de drenagem acima obrigatório. Homologar manutenção, rollback e réplicas antigas; não há fallback que zere orçamento. |
| Limites por janela fixa, volume de chaves e pressão no pool PostgreSQL | Médio | Atomicidade, reinício e carga limitada locais testados; capacidade/custo/limiares em Neon e quotas/WAF do ingresso **NÃO VERIFICADOS**. Leituras auxiliares e relatórios devem ter massa de homologação representativa; não há prova de carga de produção. |
| Request smuggling/cache poisoning entre ingressos Google | Alto | Parser HTTP/1 do Next testado localmente com dois requests malformados, rejeitados. Cadeia GFE/Cloud Run e cache externo **NÃO VERIFICADOS**. |
| `style-src-attr 'unsafe-inline'`, apps de planilha, variantes novas de injeção | Médio | Scripts usam nonce sem unsafe-eval/unsafe-inline em produção. Exceção de estilos por compatibilidade documentada; Excel/LibreOffice e ciclo salvar/reabrir **NÃO VERIFICADOS**. |
| Enumeração por diferença estatística de tempo, abuso de e-mail e entrega real 2FA | Médio | Mensagens e budgets locais testados; amostragem estatística de timing e reputação/quotas SMTP reais **NÃO VERIFICADAS**. |
| Oficina compartilhada entre ADMINs | Aceito pelo modelo atual | Não há multitenancy por conta/filial. Autorização impede ROLE_USER; vínculo item/OS e cliente/máquina tem testes. Adotar multitenancy requer outro modelo. |
| CVEs futuras, ferramentas de desenvolvimento e histórico Git | Médio | Scanners descrevem suas bases e escopo no instante da execução, não ausência absoluta de falhas. Alertas de desenvolvimento são discriminados nas evidências. Scanner de arquivos não examina todo o histórico Git nem Secret Manager. |
| Logs, alertas, resposta a incidente e restauração no provedor | Alto | **NÃO VERIFICADOS** operacionalmente. Auditoria local e ausência de tokens nas respostas não comprovam SIEM/alertas/retention reais. |
| 540 diagnósticos do VS Code | Pendente editor | Maven é a evidência de compilação; falta exportação textual/local do Language Server para classificar todos os avisos. Não se declara essa contagem resolvida. |

## Vereditos separados

- **Código:** **APROVADO NO ESCOPO LOCAL TESTADO**, com os quatro achados corrigidos e as novas suítes/scanners acima concluídos. Há riscos residuais explícitos, incluindo 16 alertas moderados de ferramentas de desenvolvimento. Isso não é certificação de ausência de vulnerabilidades nem aprovação da infraestrutura.
- **Homologação:** **NÃO VERIFICADA / BLOQUEADA** até executar o roteiro isolado Google, Neon e SMTP com evidências reais, incluindo rotações e capacidade.
- **Produção:** **NÃO APROVADA**. PR permanece draft; nenhum merge ou deploy autorizado nesta tarefa.

Referências técnicas: [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection) (neutralização não universal entre consumidores); [PostgreSQL locks](https://www.postgresql.org/docs/17/explicit-locking.html) (locks transacionais e row SHARE). A auditoria não transformou recomendações desses textos em afirmações de testes externos executados.
