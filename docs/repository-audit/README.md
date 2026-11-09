# Revisão final do PR #21 e saneamento histórico

Data: 08/11/2026. Repositório: `uaikauaa/oficina`. Branch: `chore/full-repository-security-cleanup`. [PR #21](https://github.com/uaikauaa/oficina/pull/21), sem merge.

## Main e escopo

A `main` permanece em `62e8f62d4166f5f9695c49e6588897e31777b038`, merge do PR #19, com árvore `56c61a479f478c28b1b9e36d2f79804784723eac`. A árvore é idêntica à de `fb64a44f1171b4320c439ac608fbfdd8411efd94`, anterior ao PR #17. O PR #18 continua aberto e não incorporado. As alterações deste PR não modificam Java, TypeScript de execução, dependências, workflows ou migrations.

Os oito checks do head inicial desta revisão, `626bf34037e5031ad8a405370d65e49e7a04da52`, estavam aprovados: backend, frontend, Gitleaks, integração real, Flyway real, Playwright, imagens/Trivy/SBOM e Oracle/TLS. A conclusão dos checks do novo head deve ser conferida na página do PR.

## Exclusões comprovadas

As referências foram pesquisadas em todos os arquivos versionados, incluindo Maven, Node, Docker, CI, testes, scripts e documentação. As três cópias documentais abaixo eram idênticas aos arquivos preservados, tanto no Git quanto na árvore local. Os links de entrada foram atualizados.

| Arquivo removido da main restaurada | Bytes no Git | Evidência de baixo risco e destino |
| --- | ---: | --- |
| `.github/workflows/.gitkeep` | 50 | Marcador sem consumidor; quatro workflows já mantêm o diretório. |
| `scripts/.gitkeep` | 63 | Marcador sem consumidor; os scripts já mantêm o diretório. |
| `docs/security-hardening/matriz-rotas.md` | 41.604 | Apenas dois links Markdown; ambos apontam agora para a cópia idêntica em `docs/auditoria-independente-20261103/matriz-rotas.md`. O teste lê o JSON, que foi preservado. |
| `docs/homologacao-gcp-20261104/evidencias/dependency-tree.txt` | 10.432 | Apenas link documental atualizado para `docs/auditoria-independente-20261103/dependency-tree.txt`. Não é entrada de build, CI, testes ou recuperação. |
| `docs/homologacao-gcp-20261104/evidencias/npm-audit-runtime.json` | 367 | Apenas link documental atualizado para `docs/auditoria-independente-20261103/npm-audit-runtime.json`. O coletor de auditoria usa a cópia preservada. |

Total: cinco exclusões de baixo risco e 52.516 bytes redundantes retirados da árvore restaurada. Além disso, o CSV de 125.935 bytes e o novo script de 2.228 bytes introduzidos na primeira versão do PR foram retirados do diff final: duplicavam o inventário já existente. `scripts/inventory-release.mjs` foi reaproveitado e agora gera arquivos sob demanda em `backups/repository-inventory/`, ignorado pelo Git, ou em um diretório informado pelo operador. Sua classificação é triagem, sem presumir que todo arquivo seja essencial.

| Árvore versionada | Arquivos | Bytes dos blobs |
| --- | ---: | ---: |
| Main restaurada | 697 | 23.984.606 |
| PR #21 antes desta revisão | 698 | 24.121.312 |
| PR #21 revisado | 693 | 23.947.236 |

Redução líquida: 37.370 bytes em relação à main e 174.076 bytes em relação ao head anterior do PR. A medição usa `git ls-tree -r -l` e não inclui `.git`, dependências instaladas, logs, arquivos privados ou backups. A exclusão na árvore atual não reduz os blobs já preservados no histórico Git.

O conteúdo de `docs/development.md` foi consolidado em um guia atual, com configuração completa do guard de banco e comandos PowerShell testados. O README e `docs/database.md` descrevem V1–V24 e B24 corretamente. Relatórios anteriores foram identificados como históricos. A regra de `.gitignore` foi corrigida para preservar `.env.example` e proteger também arquivos como `backup.env`.

## Candidatos preservados

| Candidato | Risco e evidência | Recomendação |
| --- | --- | --- |
| `docs/security-hardening/rotas-api.json` | Alto: `IndependentRouteAuditTest` lê esse caminho diretamente. | Preservar; unificar somente com alteração explícita e teste de cobertura. |
| V1–V24, B24, migrations sintéticas e manifests | Alto: Flyway, checksums e guard de testes dependem desses arquivos. | Preservar integralmente; a equivalência de schema foi testada. |
| `scripts/preflight-oracle.sh`, Nginx, Compose e workflow Oracle | Médio/alto: a CI executa os scripts e valida TLS; não há retirada formal dessa opção de implantação. | Preservar até decisão de arquitetura e substituto validado. |
| `scripts/backup-neon-offsite.sh`, `ops/systemd/` e `backup.env.example` | Alto: são o procedimento documentado de backup/recuperação. | Preservar até comprovar outro mecanismo de contingência. |
| `scripts/homologation/*` | Médio: testes TLS/SMTP e guias atuais ainda os referenciam. | Preservar; não confundir o nome do diretório com autorização para usar o projeto Neon temporário. |
| ZIP `image-audit-d54087d.zip` | Médio: 77.032 bytes locais; cópia de artefato CI com expiração, citada com checksum pelo relatório. | Manter até existir arquivo externo durável e verificado. |
| SBOMs, scans e relatórios de execuções diferentes | Médio: conteúdo e hashes distintos; não são duplicatas exatas. | Preservar ou arquivar futuramente com índice de proveniência. |
| Capturas visuais, relatórios históricos e inventário de 03/11 | Médio: registram comparação, decisões e evidências citadas. | Preservar; gerar inventários novos fora do Git. |
| Quatro modelos `.example` | Médio: desenvolvimento, homologação, produção e backup têm consumidores e requisitos distintos. | Preservar; não foram encontradas credenciais operacionais nesses modelos. |

## Baseline e regressão local

O Docker Desktop foi iniciado para disponibilizar o engine Linux. Ele reativou três containers antigos da stack local; esses containers foram parados, sem alterar sua configuração, para evitar executar a aplicação antiga contra o Neon durante a auditoria. Os testes usaram containers próprios, identificados, com PostgreSQL em loopback e SMTP Mailpit sintético. Os dois PNGs locais já existentes foram preservados e as capturas geradas pelos testes não integram o PR.

Ambiente local: Java 21.0.12.1, Node.js 24.21.0, Docker 29.8.0 e PostgreSQL descartável 16.15. A CI valida o frontend com Node.js 22.

| Verificação | Antes desta revisão | Depois |
| --- | --- | --- |
| Maven `clean verify`, PostgreSQL 16 descartável | 839 testes; 0 falhas, 0 erros, 0 ignorados | 839 testes; 0 falhas, 0 erros, 0 ignorados. |
| Frontend unitário | 378/378 | 378/378. |
| ESLint, TypeScript app/E2E, build Next | Aprovados | Aprovados. |
| Playwright Chromium com API mockada | 119/119 | 119/119. |
| Integração real Next → Spring → PostgreSQL + Mailpit | 1 cenário de navegador aprovado; verificação distribuída com duas JVMs aprovada | Mesmo cenário e verificação distribuída aprovados. |
| Flyway real em banco novo | B24 aplicada; `validate` aprovou 25 migrations | B24 aplicada em outro banco novo; 25 migrations validadas. |
| V1–V24 e baseline neutra | Checks de imutabilidade e defaults aprovados | Aprovados. |
| Gitleaks do histórico alcançável | 0 novos achados | 0 novos achados; diff preparado também sem achados. |
| Links Markdown locais | 85 documentos, 0 links ausentes | 84 documentos, 0 links ausentes. |
| Docker Compose e TLS/SMTP sintético | Checks do head inicial aprovados | Compose válido; 2 testes TLS/SMTP aprovados. |
| Transporte no Next standalone | Check do head inicial aprovado | Proxy real preservou cookies, CSRF, JWT, PDF/CSV e erros; parser rejeitou ambiguidades HTTP. |

A suíte Maven cobre autenticação, permissões, transações, integridade de estoque/OS e caminhos Flyway de banco novo e histórico. O cenário real cobre JWT/cookies, entrega de 2FA por SMTP, CSRF inválido/ausente, criação e consulta de dados sintéticos, entrada/baixa/devolução de estoque, rejeição de saldo insuficiente sem alterar o saldo, vínculo item/OS, três PDFs, CSV, logout e tratamento de erros. O limitador foi testado entre duas JVMs, com 12 tentativas concorrentes, IP encaminhado falsificado e reinício com mudança de chave JWT. Essa cobertura não certifica todas as combinações possíveis de entradas e permissões.

## Neon original: APROVADO em leitura

Não havia `.env` privado ou `DB_*` exportado nesta cópia. Foi localizada configuração em um container da stack antiga criado em 07/10/2026, anterior ao trabalho de homologação. Nenhum valor, hostname, usuário ou identificador do banco foi publicado. O projeto temporário `oficina-homologacao` não foi utilizado.

O probe usou o driver JDBC e as entidades compiladas do backend atual, certificado/hostname verificados com `sslmode=verify-full` e truststore da JVM. As conexões foram configuradas com `readOnly=true`, `readOnlyMode=always` e transações de leitura; `current_setting('transaction_read_only')` retornou `on`. `SELECT current_database(), current_user` correspondeu à configuração privada, sem divulgar os identificadores.

O histórico contém 24 registros, todos bem-sucedidos, e está em V24. O Flyway `info` encontrou zero migrations pendentes; `validateWithResult` aprovou os checksums e as 25 migrations disponíveis no projeto, incluindo B24. O Hibernate validou o schema das 17 entidades com `hbm2ddl.auto=validate`, sem inicializar Spring, bootstrap de usuários ou tarefas agendadas. Nenhum `migrate`, `repair` ou comando de escrita foi enviado pelo probe.

`pg_stat_ssl` foi consultado e retornou `ssl=false`, sem versão TLS no backend PostgreSQL. Isso não foi apresentado como confirmação de TLS. A conexão cliente→endpoint foi estabelecida exigindo `verify-full`; a interpretação de que a visão observa outro trecho atrás do proxy decorre da arquitetura com proxy do Neon e da definição da visão por backend no PostgreSQL. Fontes primárias: [conexões seguras do Neon](https://neon.com/docs/security/security-overview) e [definição de pg_stat_ssl](https://www.postgresql.org/docs/16/monitoring-stats.html#MONITORING-PG-STAT-SSL-VIEW). O trecho interno não foi auditado independentemente.

A primeira tentativa do probe recebeu `08P01` ao enviar parâmetros de startup via `options`; a conexão passou após mover o controle de leitura para o JDBC/transação. Isso foi uma limitação da abertura do probe, não evidência de indisponibilidade do banco. A documentação do [Neon sobre parâmetros de startup](https://neon.com/docs/connect/connection-errors) descreve essa restrição de endpoints com pooler.

A configuração antiga não exigia `verify-full`; recomenda-se reforçar esse parâmetro na configuração privada antes de uma implantação atual, com a CA apropriada. Não foi confirmada exposição dessa credencial nesta revisão. Credencial comprovadamente exposta exige rotação. A aprovação em leitura não equivale a homologação de escrita, backup ou capacidade do serviço.

## Histórico e segredos

A primeira auditoria cobriu 201 commits alcançáveis e 1.003 caminhos históricos, incluindo branches, tags e cabeças de PR disponíveis. Esta revisão buscou novamente as 21 cabeças de PR e examinou 203 commits alcançáveis antes do commit final. Os nove fingerprints de `.gitleaksignore` foram reabertos em seus commits de origem: dois placeholders, um valor sintético de interpolação CI, quatro fixtures de hash/resposta, uma chave fraca em teste negativo e um exemplo de API truncado. A [triagem sanitizada](../homologacao-gcp-20261104/gitleaks-triagem.md) foi atualizada. As exclusões continuam restritas aos nove fingerprints exatos.

Nenhum segredo operacional novo foi confirmado e nenhum valor público foi testado em provedor externo. A análise não cobre clones de terceiros, todos os caches/forks ou artefatos já expirados. Não há candidato comprovado para reescrita; nenhuma simulação destrutiva ou reescrita remota foi executada.

Se surgir segredo real: rotacionar/revogar no provedor; identificar blobs, commits, refs e PRs; criar bundle verificável e clone espelho separado; simular `git-filter-repo`; comparar árvores, SHAs e assinaturas; executar a suíte completa; preparar rollback e reclone de colaboradores; apresentar os impactos para autorização separada. GitHub Support pode precisar sanear referências e caches; apagar do Git não invalida uma credencial nem remove cópias de terceiros.

## About e decisão de merge

O About mantém a descrição e oito topics conferidos. O website permanece vazio, sem publicação HTTPS comprovada.

O merge depende dos oito checks aprovados no head final e da revisão humana exigida pela branch. A recomendação é GO para a limpeza quando esses checks concluírem com sucesso. A verificação do Neon foi somente leitura; publicação, backup, recuperação, SMTP operacional e capacidade continuam fora da homologação desta tarefa. Não houve merge ou deploy.
