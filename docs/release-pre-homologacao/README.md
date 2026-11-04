# Release pré-homologação — auditoria de 03/11/2026

**Escopo:** integração de código e limpeza documental. Nenhum deploy, acesso ao Neon de produção ou exclusão de branch remota foi realizado. O estado abaixo é verificado por SHA; a homologação Google Cloud será uma tarefa separada.

## Vereditos

| Critério | Estado |
| --- | --- |
| INTEGRAÇÃO NA MAIN | **CONCLUÍDA** para o PR #13 em `03901a09388cf680df7a6d119e78cf453afb2fd0`; limpeza ainda em PR separado |
| LIMPEZA DO REPOSITÓRIO | **PARCIAL** até os checks e o merge do PR de limpeza |
| TESTES DA MAIN | **APROVADOS** no SHA `03901a0` pelos quatro workflows; a limpeza requer nova execução |
| SEGURANÇA DO CÓDIGO | **APROVADA NO ESCOPO TESTADO** do PR #13; ambiente real e varredura histórica completa pendentes |
| HOMOLOGAÇÃO GOOGLE CLOUD | **PENDENTE** |
| PRODUÇÃO | **NO-GO** |

## Main e PRs

A `main` foi buscada novamente após o merge do [PR #13](https://github.com/uaikauaa/oficina/pull/13): HEAD `03901a09388cf680df7a6d119e78cf453afb2fd0`. O merge commit conserva os quatro commits `75e70ad`, `b968f5e`, `6566c3a` e `bdb4d04`; sua árvore é idêntica à árvore do head do PR. Os PRs [#1–#10](https://github.com/uaikauaa/oficina/pulls?q=is%3Apr+is%3Amerged), [#12](https://github.com/uaikauaa/oficina/pull/12) e [#13](https://github.com/uaikauaa/oficina/pull/13) estão mesclados. O [#11](https://github.com/uaikauaa/oficina/pull/11) foi encerrado sem merge após comentário: sua branch tem zero commits exclusivos e o conteúdo foi absorvido pelo #12. O histórico foi preservado.

Os quatro workflows de `push` no SHA efetivamente integrado `03901a0` terminaram com sucesso: [CI](https://github.com/uaikauaa/oficina/actions/runs/41740095213), [Flyway/E2E](https://github.com/uaikauaa/oficina/actions/runs/41740095256), [integração real](https://github.com/uaikauaa/oficina/actions/runs/41740095189) e [Oracle Readiness](https://github.com/uaikauaa/oficina/actions/runs/41740095194). Os quatro também estavam verdes no head exato `bdb4d04` do PR #13. Não houve bypass de checks.

## Inventário de branches após o PR #13

Comparação de commits: `git rev-list origin/main..branch`. A recomendação de exclusão é **somente para avaliação do proprietário**; nenhuma branch remota foi apagada. Branches atrás da main mantêm arquivos históricos diferentes, mas não contêm commits exclusivos. A branch visual foi mesclada por squash: seus oito commits parecem exclusivos no grafo, porém a árvore de `2344e16` é **idêntica** à árvore do merge do PR #9 em `a52457e`; reaplicá-los reintroduziria código antigo.

| Branch remota | SHA | Estado / PR | Commits não integrados | Recomendação e justificativa |
| --- | --- | --- | ---: | --- |
| `main` | `03901a09388cf680df7a6d119e78cf453afb2fd0` | atual | 0 | Manter; referência de integração. |
| `audit/seguranca-cloud-run-20261030` | `5c1a7628c0bd48ec6e3e95fecbd49268ad0b1c20` | #11 fechado | 0 | Elegível após aprovação; absorvida pelo #12. |
| `ci/auditoria-pos-pr1-20261023` | `814358dde12b37c2ca313d52f7b8d11040a8d405` | #2 mesclado | 0 | Elegível após aprovação; ancestral. |
| `ci/integracao-real-postgres-2fa-estoque-os-20261023` | `a377bd1d92eb73b03601880b53b009c58a61f026` | #4 mesclado | 0 | Elegível após aprovação; ancestral. |
| `ci/validar-flyway-real-e-playwright-20261023` | `9d0c5f80273d5d23b7a1f0da427a1586af76d322` | #3 mesclado | 0 | Elegível após aprovação; ancestral. |
| `deploy/cloud-run-dual-service-20261030` | `a788f6372dfa1b8e0dceeaaa3212e5e5f0ab82de` | #10 mesclado | 0 | Elegível após aprovação; ancestral do #12. |
| `feat/frontend-redesign` | `0e75724c8970aefb6c11fda248de6b1c3b0c7f26` | sem PR localizado | 0 | Revisar com proprietário antes de excluir; ancestral antigo. |
| `feat/pwa-instalacao-oficina-20261026` | `967c1900bf31a7c0ab16936ab602cd2cbf9db391` | #8 mesclado | 0 | Elegível após aprovação; ancestral. |
| `fix/csrf-stale-token-first-request-20261026` | `f39456ef29619d7f136458ce4ebf2972ef66acd4` | #5 mesclado | 0 | Elegível após aprovação; ancestral. |
| `fix/playwright-relatorios-mock-contract-20261026` | `861f1d08cf7a83d02b6bf8b0833c0cc33a3f7e88` | #7 mesclado | 0 | Elegível após aprovação; ancestral. |
| `integrate/cloud-run-security-20261031` | `e266a646a49cd50fb96ee6bcf49f552f3621a586` | #12 mesclado | 0 | Elegível após aprovação; árvore igual ao merge #12. |
| `refactor/identidade-visual-oficina` | `2344e16bc7a6ae032eb9258bedd036e934dc9079` | #9 mesclado por squash | 8 no grafo; 0 mudanças exclusivas na árvore do #9 | Elegível após aprovação; não fazer merge. |
| `release/oficina-pre-oracle-20261023` | `9a796bc2347acda4be6941d18466dce1bed1d386` | #1 mesclado | 0 | Elegível após aprovação; ancestral. |
| `release/oracle-tls-backup-readiness-20261026` | `e3aed38dc22ff8cd6313eccffe7ec696854186df` | #6 mesclado | 0 | Elegível após aprovação; ancestral. |
| `security/hardening-production-20261103` | `bdb4d04ed179cf4fe549e763f4d12f8b85d5122a` | #13 mesclado | 0 | Elegível após aprovação; merge commit preserva a origem. |

A branch local de trabalho `chore/limpeza-pre-homologacao-20261103` foi criada **a partir de `03901a0`** para esta limpeza e terá PR próprio.

## Inventário de arquivos e decisões

O [inventário inicial por arquivo](inventario-inicial.csv) registra caminho, bytes, SHA-256 e classificação dos **669 arquivos versionados, 23.856.215 bytes** no HEAD `03901a0`. A [lista de hashes iguais](duplicatas-iniciais.md) encontrou 14 grupos e 171.427 bytes potencialmente redundantes. A classificação automática é ponto de partida, não autorização para remover tudo que tem hash igual.

| Removido nesta branch | Bytes | Justificativa e referência preservada |
| --- | ---: | --- |
| `docs/security-hardening/dependency-tree.txt` | 10.590 | Cópia exata da árvore em `docs/auditoria-independente-20261103/`; referência atualizada. |
| `docs/security-hardening/npm-audit-runtime.json` | 389 | Cópia exata da evidência no relatório independente; o relatório de segurança continua disponível. |
| `docs/integracao-final/visual/toast-relatorios-390.png` | 53.238 | Cópia exata da captura em `docs/visual/refinement/after/`; link histórico corrigido. |

**Economia por exclusões:** 64.217 bytes no checkout atual; o histórico Git permanece intacto. O README e o guia Cloud Run foram reescritos por estarem desatualizados. Os modelos de ambiente foram separados em desenvolvimento, homologação e produção, com `verify-full` para Neon externo. Arquivos `.env`, testes, caches e resíduos adicionais foram reforçados nos ignores. Nenhum log, artefato de build ou cache estava versionado no inventário inicial.

O verificador `scripts/check-doc-links.mjs` conferiu os links relativos dos **81 arquivos Markdown versionados** após as exclusões: zero destinos ausentes. Links `file://` de relatórios históricos apontam para a antiga estação do autor e foram excluídos dessa checagem.

**Preservados:** migrations oficiais V1–V24 e cópias sintéticas de teste (necessárias ao guard de banco); `rotas-api.json` e `matriz-rotas.md` em ambos os relatórios (referências históricas e teste de cobertura usam caminhos próprios); SBOM/Trivy de execuções distintas, cujos hashes não são iguais; capturas restantes em `docs/visual/` e `docs/auditoria/prints/` (evidência visual e diagnósticos VS Code); assets de login, favicon, PWA e dashboard usados pelo frontend; `nginx/`, `ops/`, `docker-compose.yml`, scripts de backup e workflow Oracle (ainda referenciados e sem substituto operacional de backup Cloud Run comprovado).

## Testes e segurança

No head do PR #13: **830 JUnit** e Flyway real V1–V24 aprovados na CI; **376 unitários frontend**, lint, tipos da aplicação/E2E, build Next e **119 Playwright UI** aprovados localmente nesta auditoria; proxy standalone aprovado. Integração real com PostgreSQL, Mailpit e duas JVMs passou no workflow do PR e no `push` da main. O `clean verify` local foi iniciado, mas a guarda de segurança rejeitou 288 contextos porque `TEST_DB_*` não estava configurado; o daemon Docker local estava indisponível. Isso não foi contabilizado como aprovação local do backend.

As imagens documentadas no PR #13 foram varridas por Trivy: zero CVEs conhecidas e zero segredos no escopo examinado. `npm audit` completo ainda mostra **16 alertas moderados** em ferramentas de desenvolvimento, zero altos/críticos; runtime sem alertas naquela execução. Nesta limpeza não houve novo scan de imagem local porque o daemon Docker está indisponível. Uma busca dirigida no histórico por blocos de chave privada, prefixos de tokens GitHub, chaves AWS e prefixos de chaves de API retornou zero commits; ela **não substitui um secret scanner histórico completo**. Nenhum segredo real foi confirmado ou reproduzido aqui.

O job `image-audit` foi acrescentado à validação complementar da branch de limpeza: reconstrói as duas imagens, gera SBOM CycloneDX, verifica vulnerabilidades altas/críticas nos SBOMs e segredos nas imagens e arquivos com Trivy 0.74.0, guardando relatórios por SHA. Duas tentativas de análise direta dos JARs foram interrompidas por HTTP 429 do Maven Central, sem veredito. A análise de SBOM evita a consulta remota; POMs transitivos ausentes podem reduzir o inventário, portanto o scan online anterior do PR #13 permanece como evidência complementar. O resultado final deve ser confirmado no head do PR e no merge da `main`.

A `main` está **sem proteção de branch** na API pública (`protected=false`). O proprietário deve habilitar regra para `main`: exigir PR e ao menos uma revisão humana, exigir os jobs dos quatro workflows CI/validação/integração real/Oracle (incluindo `image-audit`) no SHA atual, exigir resolução de conversas, bloquear force push e exclusão, limitar bypass a administradores necessários e verificar a regra após salvar. A integração GitHub disponível não expõe escrita de regras; nenhuma proteção foi alterada. O repositório continua público.

Os **540 diagnósticos do VS Code** permanecem sem exportação textual/classificação individual; cinco não são atribuíveis às capturas. Java 21/CI verde não equivale a declará-los resolvidos.

## Pendências para homologação Google Cloud

- [ ] Banco Neon **isolado**, URL JDBC `sslmode=verify-full`, CA e hostname comprovados; privilégios mínimos, capacidade, PITR e restauração.
- [ ] Backend Cloud Run privado por IAM; frontend com `roles/run.invoker`; testar acesso anônimo, identidade errada, audience, cadeia de proxy e IP real.
- [ ] Secret Manager com JWT, rate limiter e contexto do proxy independentes; testar drenagem, janela V24, rollout misto e rollback.
- [ ] SMTP sandbox com STARTTLS, identidade, entrega/limites do 2FA; não usar conta operacional.
- [ ] TLS/ingresso, CSP nonce, cookies, CSRF, PWA, PDF/CSV, estoque/OS, limites de payload e quotas sob carga representativa.
- [ ] Logs, alertas, custos, backup e recuperação com evidências; aprovar orçamento e limites de instâncias.
- [ ] Reclassificar diagnósticos VS Code e reavaliar os 16 avisos de desenvolvimento.

**Produção permanece NO-GO até aceite separado. Não houve deploy.**
