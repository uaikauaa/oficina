# Auditoria do repositório e plano de saneamento histórico

Data: 08/11/2026. Base: `main` em `62e8f62d4166f5f9695c49e6588897e31777b038`.

## Estado de partida

- O PR #19 foi mesclado nesse commit. O tree SHA da `main` é `56c61a479f478c28b1b9e36d2f79804784723eac`, idêntico ao de `fb64a44f1171b4320c439ac608fbfdd8411efd94`, anterior ao PR #17. `git diff fb64a44 62e8f62` não apresentou alterações.
- O PR #18 está aberto e não foi incorporado. A branch local estava sincronizada com `origin/main` e a árvore de trabalho estava limpa. Havia um worktree.
- A API de branches informa `protected: true` para `main`. A leitura dos detalhes de proteção retornou 403 pela integração GitHub. O registro de 04/11 em `docs/homologacao-gcp-20261104/evidencias/main-protection-20261104.json` é histórico e não substitui a verificação atual.
- Os quatro workflows do commit restaurado concluíram com sucesso: CI, integração real, validação complementar e prontidão Oracle. Links: [CI](https://github.com/uaikauaa/oficina/actions/runs/42175718445), [integração](https://github.com/uaikauaa/oficina/actions/runs/42175718450), [Flyway e E2E](https://github.com/uaikauaa/oficina/actions/runs/42175718494), [Oracle](https://github.com/uaikauaa/oficina/actions/runs/42175718390).

## Inventário e limpeza

O [inventário anterior às exclusões](inventory.csv) registra os 697 arquivos versionados, tamanho, SHA-256, função por categoria e risco inicial de remoção. A classificação é uma triagem reproduzível por caminho; não substitui a análise de uso de cada arquivo. O tamanho somado dos blobs da árvore inicial é 23.984.606 bytes; após a limpeza e a inclusão deste inventário e relatório, 24.121.255 bytes. O aumento vem da documentação de auditoria. Os diretórios de maior risco são backend, frontend, CI, migrations, infraestrutura e backup. As 25 migrations de produção (V1–V24 e B24) e suas cópias sintéticas de teste foram preservadas.

Exclusões realizadas:

| Caminho | Evidência | Efeito |
| --- | --- | --- |
| `.github/workflows/.gitkeep` | O diretório contém quatro workflows reais; o marcador não é referenciado pelo CI. | Nenhum arquivo executável removido. |
| `scripts/.gitkeep` | O diretório contém scripts reais; o marcador não é referenciado. | Nenhum script removido. |

Permaneceram os quatro modelos `.example`: a documentação de instalação e backup usa seus nomes e eles não contêm credenciais operacionais confirmadas. Scripts de Oracle, Google Cloud, backup, testes e auditoria permanecem porque são referenciados por CI ou documentação, ou porque sua utilidade para recuperação ainda não foi descartada com segurança. Relatórios antigos e evidências duplicadas também permanecem: alguns são citados por relatórios com hashes e datas; retirar cópias exige verificar a cadeia de evidência. O ZIP versionado de auditoria de imagens é grande, mas o relatório indica que a cópia preserva um artefato remoto com expiração; por isso não foi removido.

O `.gitignore` passou a cobrir arquivos `.env.*` não exemplares. O README foi ampliado com funções, estrutura e contribuição. Nenhuma regra de negócio, migration, dependência ou dado do banco foi modificado.

## Testes e limites

| Verificação | Antes | Depois |
| --- | --- | --- |
| Backend `clean verify` | Compilou 162 fontes e 87 fontes de teste; 835 testes iniciados, 289 erros por ausência de `TEST_DB_*` isolado | Mesmo resultado: 835 iniciados, 0 falhas de asserção, 289 erros de ambiente. Pendente de PostgreSQL descartável; o Docker local não estava ativo. |
| Frontend unitário | 378/378 | 378/378. |
| Lint, TypeScript app/E2E, build Next | Aprovados após `npm ci` | Aprovados; as mudanças não afetam código de execução. |
| Playwright Chromium | 119/119 | Aprovados; o teste gerou imagens locais, excluídas do PR. |
| Integração real, Flyway com PostgreSQL | CI do commit de base aprovada | Pendente de CI na branch. |
| Neon original | NÃO TESTADO | NÃO TESTADO; nenhuma conexão ou migration remota. |

## Auditoria do histórico

`git fetch origin --prune` e a busca de `refs/pull/*/head` cobriram as referências acessíveis: 23 branches remotas, 6 tags e 20 cabeças de PR. `git rev-list --all --count` encontrou **201 commits**; `git rev-list --objects --all` encontrou 4.249 objetos e **1.003 caminhos históricos distintos**. O Gitleaks 8.30.1, com checksum do binário conferido, examinou o histórico alcançável com `--log-opts=--all` e não produziu novos achados. A ferramenta informa 180 commits varridos porque analisa diffs e não contabiliza todos os merge commits da mesma forma que `git rev-list`.

A triagem anterior documenta nove fingerprints exatos em `.gitleaksignore`: placeholders, fixtures de teste, valor sintético de CI e exemplo truncado de API. A [triagem](../homologacao-gcp-20261104/gitleaks-triagem.md) descreve cada um sem reproduzir valores. Nenhuma credencial operacional foi confirmada nesta auditoria. Não houve teste de validade em provedores externos; reutilização desses valores em produção permanece **inconclusiva**. Não foram examinados forks, clones de terceiros, caches privados, todos os artefatos expirados ou dados internos de provedores.

| Severidade | Achados confirmados nesta auditoria |
| --- | ---: |
| Crítico / alto / médio / baixo | 0 / 0 / 0 / 0 |
| Falsos positivos previamente triados | 9 |
| Credenciais com rotação comprovadamente necessária | 0 |

## Saneamento histórico

Não há arquivo ou trecho comprovadamente sensível para remover do histórico neste momento. Reescrever 201 commits sem candidato confirmado adicionaria risco de perda de SHAs, assinaturas e diffs de PR sem reduzir um risco demonstrado. Por isso a simulação de `git-filter-repo` **não foi executada** e nenhuma referência remota foi alterada.

Se surgir um segredo confirmado: revogar ou rotacionar primeiro no provedor; identificar o primeiro commit, demais objetos, refs e PRs; criar `git bundle --all` verificável e clone espelho separado; aplicar `git-filter-repo` apenas no clone; comparar a árvore funcional e os SHAs antes/depois; executar a mesma CI; preparar rollback e instruções de reclone para colaboradores; solicitar ao GitHub Support a limpeza das referências/caches aplicáveis. Um push forçado, alteração de tags ou branch protection exigirá autorização explícita separada. Caches, PRs, forks e clones podem conservar cópias antigas.

## Metadados GitHub

Descrição proposta: `Sistema web de gestão de oficinas com ordens de serviço, estoque, autenticação e relatórios. Next.js, Spring Boot e PostgreSQL.`

Topics: `oficina-gestao`, `ordens-de-servico`, `controle-de-estoque`, `nextjs`, `spring-boot`, `postgresql`, `java`, `typescript`.

Website: deixar vazio até comprovar publicação HTTPS. A integração GitHub disponível não expõe edição de descrição/topics; o CLI local não está autenticado. Estes campos dependem de edição manual em **Settings → General → About** ou de uma conexão com permissão de escrita para metadados.
