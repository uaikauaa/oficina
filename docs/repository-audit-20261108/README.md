# Auditoria e limpeza do repositório restaurado

Data: **08/11/2026**, America/Sao_Paulo. Escopo: organização documental e exclusão de redundâncias comprovadas. Nenhum deploy, merge, reescrita de histórico ou conexão a banco remoto.

## Restauração e isolamento

- [PR #19](https://github.com/uaikauaa/oficina/pull/19) integrado em 06/11/2026. Base obtida por `git fetch origin`: `62e8f62d4166f5f9695c49e6588897e31777b038`.
- `git rev-parse 'origin/main^{tree}'`: **`56c61a479f478c28b1b9e36d2f79804784723eac`**, igual à árvore de `fb64a44f1171b4320c439ac608fbfdd8411efd94`. `git diff` entre esses dois estados: vazio. O commit de reversão `80faf0eea0fc7273dfd6dc22ed867cf267b9cd24` é ancestral da base.
- A API GitHub confirmou `main.protected=true` e **oito checks obrigatórios**. Isso não comprova configurações administrativas adicionais, como número de revisões exigidas; nenhuma proteção foi alterada.
- Os quatro workflows e seus oito jobs passaram no head exato do PR #19: [CI](https://github.com/uaikauaa/oficina/actions/runs/42174782198), [Flyway/E2E/imagens](https://github.com/uaikauaa/oficina/actions/runs/42174782229), [integração real](https://github.com/uaikauaa/oficina/actions/runs/42174782216), [Oracle/Nginx](https://github.com/uaikauaa/oficina/actions/runs/42174782157).
- O [PR #18](https://github.com/uaikauaa/oficina/pull/18) continua aberto e não integrado. Sua branch não foi usada como base.
- Trabalho na branch `chore/repository-audit-cleanup`, no worktree `oficina-repository-audit-cleanup-20261106`, encontrado limpo na base restaurada. Os demais worktrees foram preservados, incluindo as alterações locais não commitadas em `oficina-auditoria-final-20261030`. A `main` local não foi modificada.

## Inventário e critérios

O [inventário por arquivo](inventory.csv) cobre **697 arquivos versionados**, 24.120.198 bytes no checkout inicial, antes das exclusões. Registra caminho, função, referências, consumidores, necessidade, obsolescência, decisão, risco, justificativa, duplicatas, tamanho, SHA-256 e commit da base.

A busca recursiva considera somente `git ls-files`: caminhos, nomes únicos, símbolos Java/TypeScript e referências textuais com arquivo/linha. Ela não substitui um grafo completo de chamadas. Consumidores por convenção (App Router, Spring, JPA, Surefire, Flyway, Playwright, GitHub Actions) são identificados separadamente; ausência de referência textual não foi tratada como autorização para apagar. Arquivos ignorados, credenciais, caches, backups e dados locais não integraram as exclusões. Os hashes do CSV representam os bytes do checkout, sujeitos ao tratamento de finais de linha pelo Git; a identidade versionada é o commit base.

Foram revisados os quatro workflows, scripts e suas cadeias de chamadas, Dockerfiles/Compose/Nginx, modelos de ambiente, configuração JDBC/Hikari/Hibernate/Flyway, guard de testes, manifestos de migrations e documentação operacional/histórica. A revisão de todos os caminhos é um inventário de manutenção; não se declara auditoria formal exaustiva de vulnerabilidades de cada linha da aplicação.

Foram encontrados **13 grupos de conteúdo exatamente igual**: nove pares de migrations oficiais/sintéticas, dois pares de evidências Maven/npm e dois pares de inventários/matrizes de rotas. A igualdade de bytes foi apenas um indício; as finalidades e os consumidores determinaram a decisão.

## Exclusões realizadas

As quatro exclusões ocorreram **depois do inventário e da baseline completa**. São reversíveis pelo Git e não alteram contratos públicos.

| Arquivo | Bytes | Motivo | Referências verificadas | Risco |
| --- | ---: | --- | --- | --- |
| `.github/workflows/.gitkeep` | 51 | Apenas comentário marcando diretório que já contém quatro workflows | Git, quatro YAMLs, buscas textuais e inventário histórico; nenhum consumidor de execução | Baixo |
| `scripts/.gitkeep` | 64 | Apenas comentário marcando diretório já populado | Scripts, workflows e buscas textuais; nenhum script lê o marcador | Baixo |
| `docs/homologacao-gcp-20261104/evidencias/dependency-tree.txt` | 10.590 | Cópia byte a byte de `docs/auditoria-independente-20261103/dependency-tree.txt` | Link no README de homologação consolidado; scripts de coleta e snapshots históricos avaliados | Baixo |
| `docs/homologacao-gcp-20261104/evidencias/npm-audit-runtime.json` | 389 | Cópia byte a byte de `docs/auditoria-independente-20261103/npm-audit-runtime.json` | Link no README de homologação consolidado; a coleta independente mantém o arquivo canônico | Baixo |

**11.094 bytes redundantes eliminados**, além da redução dos guias genéricos/desatualizados. Os SHA-256 das duas evidências canônicas estão em [validation.json](validation.json). O relatório de 04/11 mantém sua data e proveniência; a consolidação não representa nova execução dos scanners daquela etapa. Menções a arquivos removidos nos inventários históricos são registros do snapshot original, não links operacionais quebrados.

O README principal recebeu estrutura, estado da restauração e ponteiros para documentação. `frontend/README.md` deixou de recomendar ferramentas/provedores genéricos e passou a documentar o frontend deste projeto. `docs/development.md` consolida instalação e testes com os cinco parâmetros obrigatórios do banco sintético. `docs/database.md` esclarece B24, TLS verificável e a diferença entre banco original e banco descartável. Nenhum arquivo de código funcional, dependência ou configuração de runtime foi removido.

## Preservações justificadas

| Grupo | Motivo para manter |
| --- | --- |
| `.env.example`, `.env.homolog.example`, `.env.production.example` | Destinos e exigências diferentes: desenvolvimento, sandbox e produção futura; não são duplicatas. Os modelos permanecem sem alterações nesta limpeza. |
| `scripts/backup.env.example`, `backup-neon-offsite.sh`, `ops/systemd/*`, `docs/backup.md` | Recuperação e contingência; não executar backup remoto nesta tarefa. Guias antigos devem ser confrontados com a configuração real antes do uso. |
| `nginx/*`, `docker-compose.yml`, `preflight-oracle.sh`, `oracle-readiness.yml` | Infraestrutura VPS legada ainda exercitada por check obrigatório; sua remoção seria de risco alto. |
| `scripts/homologation/*` e guias Cloud Run | Verificadores de sandbox, com testes TLS/SMTP locais; não equivalem à homologação remota nem autorizam deploy. |
| `scripts/collect-independent-audit.mjs`, `audit-vscode-prints.mjs`, `inventory-release.mjs` | Reprodução de evidências datadas; possuem entradas/expectativas históricas e não devem ser executados para fabricar aprovação atual. |
| V1–V24, B24, migrations sintéticas e manifestos/checksums | Histórico Flyway e segurança do banco de testes. Pares SQL iguais têm consumidores distintos e não podem ser deduplicados. |
| `docs/security-hardening/rotas-api.json`, `matriz-rotas.md` e pares da auditoria independente | O JSON de segurança é entrada direta de `IndependentRouteAuditTest`; matrizes e snapshots mantêm o contexto de cada auditoria. |
| `docs/historico/`, demais relatórios JSON/SBOM, ZIP de imagem e capturas | Evidências por SHA/data e links entre auditorias. O ZIP é evidência preservada, não um build temporário abandonado. |
| Fontes, testes, assets, dependências, Dockerfiles, ignores, quatro workflows | Comportamento, build, CI e proteções existentes; não foi comprovada dependência sem consumidor que justificasse remoção. |

Nenhuma exclusão de risco médio/alto foi realizada. Não houve evidência suficiente para propor remoções adicionais. Conteúdo histórico não descreve o estado atual de produção; os documentos de entrada apontam para o estado vigente, preservando a rastreabilidade.

## Comparação de validações

Baseline executada no checkout restaurado antes das quatro exclusões. Revalidação posterior: **em andamento neste primeiro commit; consultar a atualização final e os checks do PR antes de aprovar**. Comandos, hashes dos logs e ambiente: [validation.json](validation.json). Logs brutos, imagens OCI e capturas geradas ficam no diretório temporário desta tarefa, fora dos commits.

| Verificação | Antes | Depois |
| --- | --- | --- |
| Maven `clean verify`, PostgreSQL sintético, Java 21 | 839 testes; 0 falhas/erros/ignorados; JAR gerado | PENDENTE |
| Frontend `npm test` | 378 aprovados; 0 ignorados | PENDENTE |
| Chaves efêmeras de build | 3 testes aprovados | PENDENTE |
| ESLint; TypeScript app e E2E; build Next | Todos aprovados | PENDENTE |
| Playwright Chromium, sessão/logout/CSP/responsividade | 119 aprovados | PENDENTE |
| Proxy standalone e parser HTTP/1 | Cookies/CSRF/JWT/PDF/CSV/limites e negativos aprovados | PENDENTE |
| Integração real Next → Spring → PostgreSQL/SMTP | 1 cenário aprovado; duas JVMs e reinício aprovados | PENDENTE |
| Flyway oficial em PostgreSQL novo | `migrate`/`validate`; B24 SQL_BASELINE; zero usuários e singleton neutro | PENDENTE |
| V1–V24/checksums, equivalência B24 e defaults neutros | Aprovados | PENDENTE |
| TLS/SMTP com certificados efêmeros | 2 testes aprovados | PENDENTE |
| Compose sintético, `bash -n`, sintaxe MJS | Aprovados; 23 scripts MJS | PENDENTE |
| Nginx build/configuração/handshake TLS real local | Aprovado, TLS 1.3 | PENDENTE |
| Imagens backend/frontend, dois builds independentes sem cache | Digests idênticos por serviço | PENDENTE |
| Trivy 0.74.0, SBOM das imagens e segredos | 0 HIGH/CRITICAL; nenhum segredo detectado | PENDENTE |
| Gitleaks 8.30.1 histórico alcançável | Sem achados, com exclusões exatas existentes | PENDENTE |
| npm audit completo / runtime | 8 moderadas em desenvolvimento; 0 altas/críticas; runtime 0 | PENDENTE |
| Links Markdown locais | 84 documentos; 0 ausentes | PENDENTE |

Ambiente local: Java 21.0.12.1, Node 24.21.0/npm 11.19.0 e Docker 29.8.0. A CI e as imagens frontend usam Node 22; essa diferença é registrada, não substitui os checks de CI. Imagens locais foram construídas sem autenticação, publicação ou deploy.

Ocorrências de execução foram corrigidas sem alterar código ou reduzir testes: propriedade Maven inicialmente sem aspas no PowerShell; porta Playwright sem `E2E_BASE_URL` correspondente; uma colisão de trace entre suítes concorrentes que compartilham `test-results`; caminho OCI absoluto do Windows incompatível com Trivy. A execução completa sequencial final de baseline passou 119/119, e os seis scans de imagem passaram com caminhos relativos. As capturas históricas versionadas regravadas pelos testes foram restauradas a partir do HEAD limpo; as capturas transitórias foram preservadas fora do repositório.

## Banco original e migrations

O datasource original usa `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` em `application.properties`, com driver PostgreSQL. Não há destino remoto seguro dedutível de um modelo `.example`; usuário, projeto, branch e hostname originais precisam de confirmação privada e credenciais rotacionadas. Não havia esse conjunto confirmado no worktree isolado. **BANCO NEON ORIGINAL: NÃO TESTADO.** Nenhum acesso foi feito ao projeto temporário `oficina-homologacao`, nem reutilizada senha exposta.

HikariCP: máximo 10, mínimo ocioso 2, max lifetime 600.000 ms, idle timeout 300.000 ms, connection timeout 20.000 ms e keepalive 120.000 ms, parametrizados por `HIKARI_*`. Hibernate: `ddl-auto=validate`, `open-in-view=false`; Flyway: habilitado, validação ativa, `baseline-on-migrate=false`, `migrate()` no startup e nenhum `repair` automático. A limpeza preserva integralmente essas configurações.

Neon externo exige TLS com `verify-full`, CA confiável e hostname validado; a integração TLS remota não foi aprovada por testes locais. O `CheckNeonTls.java` existente possui guard de sandbox e não foi adaptado para contornar essa restrição ou iniciar conexão ao banco original.

As validações usaram somente bancos locais novos, identificados como pertencentes à tarefa. Os testes Maven verificam repositories/transações e caminhos sintéticos de upgrade; Flyway oficial foi validado separadamente, e a integração real confirmou persistência usando B24. Isso demonstra compatibilidade local do código e das migrations; não demonstra identidade, TLS, histórico ou dados reais do Neon. O banco original não sofreu leitura nem escrita por esta tarefa.

## Segurança e próximos gates

JWT, 2FA, CSRF, CSP, autorização, limites de payload e rate limiting permanecem no código e nas suítes. A integração real verificou o contador compartilhado entre duas JVMs e sua preservação após reinício/troca da chave JWT. Gitleaks mantém as exclusões exatas já revisadas; nada foi suprimido nesta limpeza. Trivy cobre HIGH/CRITICAL por SBOM e segredos; análise offline não equivale a varredura online exaustiva de todas as CVEs. Oito avisos npm moderados da cadeia ESLint/typescript-eslint/minimatch continuam como pendência; não foi aplicado `audit fix --force` nem alterado o lockfile para esconder alertas.

IAM Google Cloud, SMTP externo, restauração/PITR, custos, domínio e HTTPS remoto não foram testados. A preparação local não comprova publicação. Fora deste PR, ainda é necessário:

1. Confirmar identidade e credenciais rotacionadas do Neon original em canal privado; validar conexão somente leitura, TLS e histórico sem inicializar Spring/Flyway no banco operacional.
2. Aprovar ambiente sintético de homologação, SMTP sandbox, backup/restore, limites e orçamento; validar funcionalidade real antes de produção.
3. Revisar separadamente a proposta Cloud Run/Firebase do PR #18 após a restauração; impedir reintrodução acidental do PR #17. Confirmar sessão/cookies/CSRF no caminho do Hosting, IAM e imagens por digest antes de publicar.
4. Conferir DNS no Registro.br e propriedade de `oficinabrunosoldas.com.br`, preservar MX/TXT, obter destinos oficiais do provedor e validar HTTPS/certificado. Nenhuma alteração DNS nesta tarefa.
5. Reavaliar dependências moderadas sem regressão de versões, executar os oito checks no SHA final e obter aprovação humana. Homologação remota pendente; **produção NO-GO até validação real**.

## Veredito de acompanhamento

Restauração confirmada e integridade do código original preservada. As exclusões de baixo risco e a consolidação documental foram aplicadas; a conclusão depende da comparação posterior e da CI do PR. Não haverá merge automático.
