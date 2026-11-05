# Remediação para revisão — sem merge ou deploy

Referência original: `d54087d440243610a7e281e594a5e6e3b6ae6c18`. Branch exclusiva: `fix/homologacao-isolamento-20261104`. Nenhum projeto, faturamento, banco Neon, SMTP externo, registry remoto ou serviço Cloud Run foi provisionado. As alterações de infraestrutura limitam-se à proteção do repositório GitHub solicitada entre os bloqueadores.

## Inicialização neutra e compatibilidade Flyway

Foi adicionada **`B24__neutral_initial_schema.sql`**, uma baseline migration nativa do Flyway 11.14.1, na mesma localização oficial das migrations. Um banco novo executa B24 e as migrations futuras acima de V24. B24 cria o schema equivalente ao final da cadeia histórica, mantém somente roles/categorias genéricas e um singleton `Oficina não configurada`, sem CNPJ, responsável, contato, endereço, contas ou senhas predefinidos. **V11/V12 não são executadas nesse caminho; dados reais não são inseridos para depois serem apagados.**

V1–V24 permanecem com conteúdo e checksums preservados. Bancos com histórico Flyway ignoram B24 e continuam pela cadeia V existente. Não há V25 de limpeza, exclusão/substituição de registros de clientes, `repair`, alteração automática de checksum, nem `baseline-on-migrate=true`. Banco não vazio sem histórico continua rejeitado. O mecanismo B24 é diferente do comando administrativo `baseline`. [Comportamento documentado pelo Flyway](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/baseline-migrations).

`scripts/check-flyway-baseline.mjs` compara os hashes normalizados de V1–V24 com o manifesto congelado da referência original e verifica a composição da B24. A baseline é um novo artefato imutável: depois de aplicada, não regenerá-la para incorporar alterações; usar V25+ para evolução. Somente B24 recebe a substituição explícita do DML de identidade de V11 e a omissão do DML de V12. DDL, constraints, sequências e dados de referência são equivalentes.

**Limite de compatibilidade:** um banco legado anterior a V12 continua sujeito às migrations históricas ainda pendentes, inclusive ao DML de identidade que elas já continham. Não usar esse caminho para homologação nova. Qualquer atualização operacional antiga exige inventário/backup e revisão específica; esta mudança não autoriza executar migrations em produção. Bancos V21/V24 existentes são cobertos pelos testes de preservação.

`ProductionMigrationPathTest` cria bancos PostgreSQL inteiramente vazios com nomes aleatórios, usando somente o servidor local explicitamente identificado por `TEST_DB_*`. Testa:

- seleção da B24 oficial, nenhuma execução de V11/V12, ausência de seeds de negócio em todas as tabelas e migração idempotente;
- equivalência de colunas/defaults/tipos, constraints, índices, sequências, funções e triggers com a cadeia histórica;
- migração futura V25 sintética após B24;
- atualização V21 → V24 sem alterar dados de negócio; V24 sem alterar dados/checksums;
- checksum adulterado ainda rejeitado e banco não versionado não absorvido silenciosamente.

As fixtures legadas são construídas pelas cópias sintéticas auditadas e recebem, **somente no teste**, os metadados de checksum resolvidos dos scripts oficiais. Isso simula histórico existente sem executar os antigos seeds de identificação real. Não é procedimento de repair nem código usado pela aplicação. O teste compara o schema com a baseline oficial e prova que `validate` continua a detectar corrupção. Os bancos temporários são destruídos apenas após validar seus nomes gerados.

`test-real-stack-local.mjs` agora cria containers/volumes novos por execução, com labels de propriedade, e os remove ao terminar; não reutiliza bases antigas. Assim a integração Spring/Next/SMTP também inicializa pelo caminho oficial B24, sem aproveitar dados de rodadas anteriores.

## Aplicação e identidade

`ConfiguracaoOficina` não injeta defaults reais; seus exemplos foram neutralizados. O serviço de configuração e PdfService continuam usando exclusivamente o singleton persistido, com falha controlada quando ausente ou duplicado. PDFs com configuração neutra são cobertos por novos testes. Dados configurados de bancos existentes não são alterados.

Frontend: removidos contatos/cadastro reais de `oficina.ts`, placeholders de configuração e fallbacks de nome pessoal no Header/dashboard. A identidade existente vinda da API permanece disponível para documentos e mensagens; na ausência dela há rótulos neutros e nenhum contato inventado. O Header usa o nome do software. `check-neutral-defaults.mjs` confere fontes runtime e, com `--bundle`, os arquivos públicos compilados contra identificadores extraídos da migration histórica, sem imprimir valores.

AdminAccountBootstrap: nome padrão neutro `Administrador`, nenhuma conta criada sem email/senha fornecidos, política de senha mantida e nenhum overwrite de usuários existentes. O modelo de homologação explicita bootstrap sintético e truststore JDBC compatível com o checker TLS; remover a referência da senha inicial após uso. O profile rigoroso `prod` permanece obrigatório em homologação remota.

## Segredos e governança

Os [nove achados Gitleaks](gitleaks-triagem.md) foram classificados por conteúdo/uso. Não houve revogação ou rotação externa porque nenhuma credencial operacional foi confirmada. Reutilização fora de testes, se houver, exige a resposta descrita no relatório. Os nove fingerprints históricos exatos são documentados em `.gitleaksignore`; novos achados falham o job `Segredos historicos - Gitleaks`, com checkout completo e relatório redigido.

A `main` foi protegida e a configuração relida pela API: PR, uma aprovação, descarte de aprovação obsoleta, aprovação da última alteração por outro revisor, resolução de conversas, oito jobs obrigatórios vinculados ao app GitHub Actions (15368) com base atualizada, aplicação a administradores, force push e exclusão proibidos. [Evidência da API](evidencias/main-protection-20261104.json). O PR não pode ser autoaprovado pelo próprio autor; precisa de revisor elegível. Nenhum merge, bypass ou mudança de visibilidade foi realizado.

## Imagens e publicação futura

Dockerfiles fixam bases por digest; removida a atualização aberta `apk upgrade`. Atualizações de SO passam a exigir alteração revisada do digest e novo scan. UID/GID numéricos sem root, lockfile npm, versão Maven/JDK fixada, timestamp de JAR e imagem e build ID Next derivados do SHA. O [lock de insumos](../../scripts/release-build-inputs.json) inclui a versão do BuildKit por digest e a plataforma `linux/amd64`.

O scanner atualizado encontrou três CVEs HIGH em `libexpat 2.9.0-r0` da imagem Java upstream fixada. A versão corrigida `2.10.0-r0`, disponível no repositório assinado Alpine 3.24, foi fixada no Dockerfile com `apk add --no-cache` restrito a esse pacote. Se a versão não estiver disponível, o build falha. O scanner HIGH/CRITICAL permanece obrigatório. [Libexpat 2.10.0](https://libexpat.github.io/), [Alpine: pacote corrigido](https://pkgs.alpinelinux.org/packages?name=libexpat&branch=v3.24).

`scripts/build-release-images.mjs` exige árvore rastreada limpa, exporta **somente arquivos commitados** por `git archive`, cria um builder local temporário e produz arquivos OCI, sem login/push/deploy. `--verify-reproducible` executa cada Dockerfile duas vezes com `--no-cache` e compara o digest do manifest OCI (que endereça config e layers). Qualquer diferença falha. O manifesto de release vincula SHA, epoch, plataforma, bases e digests. Attestations com timestamps variáveis são separadas da imagem; SBOM e relatórios Trivy são artefatos externos. Não confundir digest OCI, checksum do tar e Image ID local.

O Trivy recebe o diretório de layout OCI extraído de cada archive comparado, sem conversão nem reconstrução de layers. Passar o `.oci.tar` diretamente a `--input` falhou na validação inicial: esse formato de tar não é Docker archive. A CI foi ajustada para a entrada documentada, mantendo os mesmos controles e severidades. [Trivy: OCI Layout](https://github.com/aquasecurity/trivy/blob/main/docs/guide/target/container_image.md#oci-layout).

Next gera chaves de Server Functions e preview por build. Para comparar builds sem reduzir a segurança, o script exige **a mesma semente privada aleatória de 32 bytes em base64** por arquivo não versionado `OFICINA_ACTIONS_KEY_FILE`, montada como secret do BuildKit. HKDF-SHA256 deriva chaves independentes por finalidade e SHA (Server Actions, identificador, assinatura e criptografia de preview). Nunca usar semente derivada publicamente do SHA, ARG, ENV de Dockerfile ou valor commitado. As chaves são embutidas apenas no output server-side, como no comportamento padrão do Next; proteger o arquivo OCI/registry e conservar o insumo em armazenamento seguro para reproduzir aquela release. Não publicar o arquivo da semente ou os archives em artefatos públicos. A CI usa semente efêmera de teste, apaga o arquivo e publica apenas manifest/SBOM/relatórios; nenhum segredo operacional entra no build. [Next: chave de Server Functions](https://nextjs.org/docs/app/guides/self-hosting#server-functions-encryption-key), [Docker: builds reproduzíveis](https://docs.docker.com/build/ci/github-actions/reproducible-builds/).

A primeira comparação detectou diferenças em exatamente dois arquivos de preview. Next 16.4.1 não oferece variável pública para essas chaves. `frontend/scripts/release-build-keys.mjs` normaliza exclusivamente `prerender-manifest.json` e `server/preview-props.json` no standalone, preservando rotas e demais campos. Falha se a versão mudar, os formatos divergirem ou qualquer outro arquivo compilado consumir as chaves antigas; não altera o framework, a fonte global de aleatoriedade, cookies, criptografia ou autenticação. Confere também a ausência de chaves privadas nos arquivos públicos. Três testes cobrem determinismo/rotação, rejeição de consumidores inesperados e prevenção de exposição. Este adaptador é um ponto explícito de revisão em futuras atualizações do Next. Builds Compose locais sem secret continuam gerando semente aleatória; apenas o procedimento de release promete reprodução com insumos privados conservados.

Procedimento de publicação **não executado** e condicionado a nova revisão/autorização de infraestrutura:

1. Confirmar SHA aprovado, todos os checks no head exato, chave de build independente segura, ferramentas Buildx/BuildKit fixadas e Trivy/SBOM atualizados. Não presumir que reconstrução com outra chave terá o mesmo digest. A CI é validação; imagens de release exigem insumos próprios e o mesmo processo verificado.
2. Em checkout limpo desse SHA, configurar `OFICINA_ACTIONS_KEY_FILE` com caminho absoluto e `OFICINA_BUILD_OUTPUT` com diretório novo. Executar `node scripts/build-release-images.mjs --verify-reproducible`. Varrer **esses archives**, preservar `release-manifest.json` e os relatórios de ambos os serviços.
3. Somente após aprovação, usar repositório Artifact Registry privado já autorizado no projeto `*-security-test`. Skopeo é ferramenta de transporte de OCI, não dependência da aplicação; fixar/validar sua versão antes do uso. Autenticar por sessão curta/WIF, sem chave JSON, sem tokens em argumentos ou logs.
4. Para cada archive, executar `skopeo copy --preserve-digests oci-archive:<arquivo> docker://<regiao>-docker.pkg.dev/<projeto>/<repo>/<servico>:<SHA>`. Esse comando publica e **não faz parte dos testes/CI atuais**. Ele não deve ser executado antes do aceite financeiro.
5. Ler o manifest remoto por digest com `skopeo inspect --raw docker://<imagem>@<digest-esperado>` e conferir seu SHA-256 com o manifest local; falhar se o registry reescrever o conteúdo. Registrar digest de destino, SHA e assinatura/atestado do processo de publicação. Um nome de tag não comprova equivalência.
6. Deploy futuro usa exclusivamente `<imagem>@sha256:...`, após nova autorização. Guardar par de digests/versões de segredos anterior para rollback, sem reverter schema destrutivamente. Nenhuma etapa de push/deploy está automatizada neste PR.

## Verificação e limites

Os resultados finais e o head exato estão vinculados aos checks do [PR #16](https://github.com/uaikauaa/oficina/pull/16) e ao manifesto de release produzido pela CI. Não há declaração de aprovação enquanto algum job falhar. A suíte backend completa contém 839 JUnit, incluindo os cinco cenários de migration e três novos de PDF. Localmente também passaram 378 testes unitários frontend, três de insumos privados de build, lint/build/tipos, TLS/SMTP isolados e o proxy standalone. A integração real passou com PostgreSQL vazio, SMTP sink, login/2FA, cadastro/estoque/OS e duas JVMs: 12 tentativas simultâneas respeitaram o orçamento compartilhado e o bloqueio persistiu após restart/rotação JWT. A primeira rodada de 119 Playwright encontrou um seletor preso ao placeholder removido; o teste foi corrigido e reexecutado, com a suíte completa novamente exigida na CI. Correções durante implementação não são aprovações anteriores.

Permanecem explícitas as limitações de scanner offline Maven, alertas npm moderados de desenvolvimento, ausência de SAST/DAST externo e de testes reais GCP/Neon/SMTP/backup/custos. Alteração de base fixada precisa passar pelo scan atual, sem baixar severidade ou ignorar CVEs para obter sucesso.

**SEGURANÇA DA INFRAESTRUTURA: INCONCLUSIVA**. **HOMOLOGAÇÃO FUNCIONAL NA NUVEM: INCONCLUSIVA**. **PRODUÇÃO: NO-GO**. Homologação bloqueada até nova revisão, resolução de todos os checks e aprovação separada do projeto/orçamento. Este PR não deve ser mesclado automaticamente.
