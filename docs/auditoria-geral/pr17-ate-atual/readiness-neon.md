# Próximo gate Neon — somente planejamento

O [runbook Stage 4A](../../admin-rbac/stage4a-neon-runbook.md) foi confrontado com migrations V25–V28, escritores de startup, configuração privada e container preexistente. Ele cobre identidade projeto/branch/compute/banco/role, hostname direto, TLS verify-full/CA, sessão read-only com timeouts e `ROLLBACK`, Flyway/contas agregadas, autorização separada para dump cifrado, restore isolado, integridade, ensaio de migrations, ativação/rollback e contas. Nenhum painel autenticado, API Neon, DNS do endpoint, SQL ou backup original foi acessado nesta auditoria.

**Gate imediato proposto:** autorização explícita apenas para identificar o alvo e executar o bloco diagnóstico read-only já especificado, após o titular fornecer fora do Git projeto ID, branch ID, compute/hostname direto, banco, role de leitura já existente e referência/versão da credencial no cofre. Usar TLS `verify-full`, transação `REPEATABLE READ READ ONLY`, `statement_timeout`, `lock_timeout`, `psql -X`, consultas limitadas a identidade/TLS/catálogo/Flyway e contagens/integridade de contas, terminar com `ROLLBACK`. Não usar backend ou Flyway. Mesmo leitura pode acordar compute e gerar logs/custo; transação read-only impede DML/DDL na sessão, mas role proprietária não é menor privilégio. Parar se identidade, TLS ou grants divergirem. Resultados detalhados permanecem privados; relatório público só agregados.

**Ainda excluídos:** backup, restore com dados reais, migrations, criação de role, login real, convites, SUPER_ADMIN, transição da Geisa, alteração de Cloud Run/Firebase e deploy. Cada um requer autorização própria após evidência do passo anterior. O container preexistente divergente não deve ser usado como ferramenta diagnóstica.

### Gates sequenciais para janela futura

1. Identidade oficial e configuração efetiva coincidem; TLS hostname/CA verify-full comprovado.
2. Histórico/checksums Flyway e contas existentes inventariados em leitura; incompatibilidades interrompem.
3. Backup privado cifrado, checksum, custódia e retenção aprovados separadamente; restore isolado íntegro.
4. Constraints, índices, sequences e históricos comparados; V25–V28 ensaiadas na cópia com duração/locks e rollback.
5. Todos escritores de startup neutralizados no diagnóstico; ambiente/SMTP/IAM e segredos conferidos.
6. SUPER_ADMIN provisionado futuramente por convite oficial, senha definida pelo titular e 2FA; depois Geisa alterada mantendo ID/hash/histórico/ativo e capacidade operacional, com nova sessão.
7. Plano de ativação e rollback ensaiado, janela/aprovação própria e decisão GO formal. A condição atual é **NO-GO para alteração do original e produção**.
