# Etapa 5A — preparação offline do novo Neon

Data: 13/11/2026. Base: PR #32 draft, `dfdd803df1618efa6a15dffba9cc9264e04ee30a`, checkout candidato `stage4a2`. Entrega: PR #33 draft empilhado sobre #32, sem merge ou deploy. Este trabalho diz respeito ao projeto **novo**; os procedimentos e a ficha do Neon original não autorizam uso neste alvo.

## Correções e estado privado

| Item | Resultado |
| --- | --- |
| `.env` | **APROVADA quanto a presença/formato offline**; identidade oficial e handshake TLS pendentes. Arquivo permanece somente no checkout antigo e fora do Git. |
| Segurança local | **APROVADA offline**: JWT, rate limit e proxy distintos, cada um com formato forte; outbox v1 Base64 de 32 bytes; bootstrap legado desabilitado; profile dev, CORS, cookies e URL pública local coerentes. |
| DB_URL | Corrigida privadamente para JDBC PostgreSQL, porta 5432, hostname direto no formato Neon, `sslmode=verify-full`, `DefaultJavaSSLFactory`; usuário e senha separados. O hostname da URL não prova identidade oficial. CA/truststore e certificado remoto exigem verificação posterior. |
| SMTP | **CONFIGURADO; envio real pendente**. Dev agora exige AUTH, STARTTLS e verificação do hostname; base define timeouts finitos. TLS/SMTP sintético aprovado; nenhuma mensagem real enviada. |
| Flyway B24–V29 | **PRONTO EM ISOLAMENTO**; estrutura, catálogo, índices/constraints e histórico validados em PostgreSQL descartável. Aplicação no novo Neon bloqueada até autorização específica. |
| Primeiro SUPER_ADMIN | **IMPLEMENTADO E TESTADO EM ISOLAMENTO**; execução real bloqueada até alvo, URL pública HTTPS, autorização e migrations concluídas. |

O verificador privado leu valores apenas na memória e emitiu estados booleanos: zero variáveis obrigatórias ausentes, zero chaves fracas por formato, três segredos distintos, outbox v1 válida, perfil local coerente, SMTP autenticado com timeouts. Entropia real, identidade do projeto, CA remota e entrega SMTP não são comprováveis offline. Nenhum valor privado, hostname completo ou credencial entra neste relatório.

## Implementação

- `scripts/launch-candidate-local.mjs` lê a `.env` externa indicada por `OFICINA_PRIVATE_ENV_FILE`, rejeita cópias no checkout candidato, conexão sem verify-full, pooler, credencial embutida, perfil incorreto e bootstrap legado. `--check` é offline. `--frontend` entrega ao processo Next.js só o ambiente de sistema mínimo e `INTERNAL_BACKEND_URL`; nenhum segredo ou `NEXT_PUBLIC_*`. `--backend --approved-migration-start` requer arquivo privado com alvo, role, referência, responsável e janela, então define `SPRING_PROFILES_ACTIVE=dev` no processo. **Não usar esse startup como diagnóstico**: Flyway e demais escritores podem gravar.
- `application-dev.properties` fixa AUTH, STARTTLS obrigatório e checagem de identidade. O teste integrado com Mailpit usa exceções explícitas só para o SMTP sintético em loopback; os defaults reais continuam seguros.
- `InitialSuperAdminProvisioner` é serviço sem `@Component`, chamado apenas pelo comando de manutenção sem contexto Spring. Sob transação, advisory lock e locks de todas as tabelas da aplicação, exige Flyway B24–V29 íntegro e somente os seeds neutros esperados; qualquer usuário, cliente, convite, outbox, evento ou outro dado operacional bloqueia a ação. Cria apenas convite de 32 bytes, hash na tabela de convites, token cifrado na outbox e evento de auditoria com referência de aprovação. A segunda tentativa e estado inesperado falham. Não cria senha, conta, role, endpoint ou privilégio permanente.
- `InitialSuperAdminCommand` exige arquivo privado absoluto de autorização com operação, organização/projeto/branch/compute, alvo/role, destinatário, URL pública HTTPS, responsável/referência e janela UTC. Verifica JDBC direto, porta 5432, verify-full, truststore/CA, alvo e role antes de abrir conexão. Não sobe Spring, não invoca Flyway e usa serviço SMTP que falha fechado. O arquivo é um **gate operacional**, não uma assinatura criptográfica; o responsável deve validar sua origem no procedimento aprovado.
- Após entrega separadamente autorizada do convite, o titular usa a aceitação oficial para definir senha; o login exige 2FA. A conta Geisa será **nova**, mediante convite `ROLE_OPERADOR_GERAL` por SUPER_ADMIN autenticado, sem importar hash, ID, refresh tokens, sessões ou dados do banco antigo.

## Evidência isolada

| Verificação | Resultado |
| --- | --- |
| `mvnw clean verify` | 913 testes, zero falhas/erros/skips, antes dos dois ajustes finais de guarda; teste direcionado posterior: 13/13 (provisionador/Flyway, aprovação e propriedades SMTP). |
| Flyway oficial | B24 + V25–V29 em banco novo descartável, checksum/ordem, catálogo, constraints e índices; upgrades sintéticos V24–V28, validação e segunda execução sem pendências. Nenhuma migration de produção foi alterada. |
| Provisionamento inicial | Convite único cifrado/auditado, dispatch sintético e limpeza do ciphertext; concorrência e recusa em banco com usuário ou cliente preexistente. |
| Frontend | TypeScript e ESLint sem erros; Next build aprovado; 379/379 unitários; Playwright mockado 115/115. |
| TLS/SMTP e auditor offline | 3/3 testes isolados; CA/hostname incorretos e STARTTLS ausente recusados. |
| Stack real sintética | Playwright 3/3 com PostgreSQL e Mailpit descartáveis; sessões, 2FA, convite, RBAC e recuperação. Duas JVMs passaram revogação/replay, limite distribuído, convite cifrado entregue uma vez e recuperação persistente após reinício. |
| Segredos | Varredura local de 700 arquivos de fonte candidato: nenhuma ocorrência dos valores privados de senha, conexão, chaves ou segredos; `git diff --check` limpo. CI deve repetir o scan de histórico. |

Os testes sintéticos usam somente containers identificados como próprios da etapa. O checkout antigo mantém as alterações que já existiam. O teste visual gerou imagens temporárias, removidas/restauradas após a aprovação.

No primeiro CI do PR #33, o build da imagem recebeu HTTP 429 do Maven Central antes do scan; o rerun passou sem mudar dependências nem critérios. A integração real teve uma ocorrência de `CSRF_INVALID` no helper do teste: o token da resposta e o cookie compartilhado podiam ser lidos em instantes diferentes enquanto o painel carregava. O helper agora fixa o par token/cookies de um mesmo snapshot; TypeScript, ESLint e a stack real sintética completa passaram novamente. O CI do head que contém essa correção deve ser conferido separadamente.

## Operação futura: gates separados

1. **Primeira conexão somente leitura:** preencher a ficha privada `stage5a-new-neon-target-template.md` fora do Git pelo painel oficial do projeto novo: organização, Project ID, branch/compute, hostname direto, banco, role de leitura, referência da credencial, CA, responsável e janela. Comparar com a configuração privada sem publicar identificadores. Pedir autorização específica com SELECTs, TLS, timeouts, `psql -X`, `REPEATABLE READ READ ONLY` e `ROLLBACK`. Sem aprovação, não conectar. A ficha do Neon antigo não serve.
2. **Migration:** somente depois do diagnóstico aprovado, comprovação de banco vazio, backup/rollback definidos e autorização distinta de escrita para o alvo exato. Fixar o artefato do commit aprovado e Flyway CLI **11.14.1** (mesma versão do jar local), configurado em arquivo privado fora do Git com URL JDBC direta verify-full, role e senha do cofre, truststore/CA e `locations=filesystem:<diretorio-absoluto>/backend/src/main/resources/db/migration`. Antes de usar, rejeitar qualquer configuração concorrente de sistema/CLI. Preparar, sem executar nesta etapa:

   ```powershell
   flyway "-configFiles=$env:OFICINA_NEW_NEON_FLYWAY_CONF" -baselineOnMigrate=false -validateOnMigrate=true -cleanDisabled=true info
   flyway "-configFiles=$env:OFICINA_NEW_NEON_FLYWAY_CONF" -baselineOnMigrate=false -validateOnMigrate=true -cleanDisabled=true migrate
   flyway "-configFiles=$env:OFICINA_NEW_NEON_FLYWAY_CONF" -baselineOnMigrate=false -validateOnMigrate=true -cleanDisabled=true validate
   ```

   `info` e `validate` também abrem conexão e exigem autorização; `migrate` exige autorização de escrita própria. Conferir que apenas B24/V25–V29 estão resolvidas, versão final 29, histórico sem falha e segunda execução sem pendências. Não usar `clean`, `repair`, baseline manual ou startup Spring para criar o banco. O arquivo privado de configuração deve ser protegido por ACL e não pode aparecer em logs, argumentos ou artefatos.
3. **Convite inicial:** após migration e validação, obter autorização específica com alvo, role escritora, destinatário real, URL pública HTTPS, referência e janela. Preparar arquivo privado de aprovação com os campos exigidos pelo comando; a versão do template está fora do Git. Em `backend`, com variáveis fornecidas pelo cofre ao processo e classpath privado, o comando futuro é:

   ```powershell
   .\mvnw.cmd -q dependency:build-classpath "-Dmdep.outputFile=$env:OFICINA_PRIVATE_CLASSPATH_FILE" -DincludeScope=runtime
   $runtimeClasspath = (Get-Content -LiteralPath $env:OFICINA_PRIVATE_CLASSPATH_FILE -Raw).Trim()
   java -cp "target/classes;$runtimeClasspath" com.oficinagestao.maintenance.InitialSuperAdminCommand --execute $env:OFICINA_PRIVATE_INITIAL_ADMIN_APPROVAL_FILE
   ```

   Executar somente na janela aprovada; ativar a entrega outbox por worker aprovado separadamente; titular define senha e conclui 2FA. Reexecução em base com qualquer estado de conta/convite/evento é recusada. Não executar nesta etapa.
4. **Geisa:** somente depois de SUPER_ADMIN ativo e aprovação própria; SUPER_ADMIN emite convite oficial para `ROLE_OPERADOR_GERAL`, Geisa define senha e passa por 2FA. Verificar acesso operacional completo por RBAC no ambiente novo. Não migrar identidade ou sessão antiga.

## GO / NO-GO

**GO somente para solicitar a autorização de diagnóstico:** o código candidato e a configuração têm formato aprovado offline, e a ficha privada deve ser preenchida e conferida no painel oficial. **NO-GO para primeira conexão agora:** identidade oficial, role de leitura, referência da credencial, CA/handshake e janela ainda não confirmados/autorizados. **NO-GO para migration, startup, convite real, envio SMTP real, merge e deploy:** exigem etapas e autorizações separadas.
