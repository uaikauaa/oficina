# Diretrizes de Banco de Dados — Oficina Gestão

## 1. Banco de Dados Oficial

- **Motor**: PostgreSQL (versão 16+)
- **Hospedagem em Nuvem**: Neon (Serverless PostgreSQL)
  - **Desenvolvimento**: Neon Development Database
  - **Produção**: Neon Production Database
- **Acesso**: Exclusivo pelo Backend (Spring Boot via Spring Data JPA / Hibernate)
- **Regra de Infraestrutura**: O banco principal de desenvolvimento é o **Neon**, e **NÃO** um container PostgreSQL local. O Docker Desktop é reservado para Testcontainers e serviços auxiliares futuros.

---

## 2. Configuração de Conexão e Variáveis de Ambiente

A conexão com o Neon é configurada estritamente via variáveis de ambiente ou pelo arquivo `.env` local (ignorado pelo Git). Nenhuma credencial deve ser commitada no repositório.

### Variáveis Obrigatórias:

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `DB_URL` | URL JDBC de conexão com o banco Neon | `jdbc:postgresql://<neon-host>/neondb?sslmode=require` |
| `DB_USERNAME` | Usuário do banco de dados | `neondb_owner` |
| `DB_PASSWORD` | Senha de acesso ao banco | `sua_senha_secreta` |

---

## 3. Versionamento e Migrations (Flyway)

1. Todas as alterações estruturais (DDL) e cargas iniciais (DML) são controladas exclusivamente pelo **Flyway**.
2. O Hibernate está configurado com `ddl-auto=validate`, garantindo que **nunca** altere ou crie schemas automaticamente.
3. Convenção de nomenclatura:
   ```text
   V<Versão>__<descricao_em_snake_case>.sql
   Exemplo: V1__create_initial_schema.sql
   ```
4. Os arquivos de migration residem no backend em:
   - `backend/src/main/resources/db/migration/`
   - E são espelhados para referência em `database/migrations/`.

---

## 4. Schema Inicial (Migration V1)

A migration `V1__create_initial_schema.sql` provisiona as seguintes tabelas centrais:
- `usuarios`: Usuários do sistema e credenciais.
- `roles`: Perfis de acesso (`ROLE_ADMIN`, `ROLE_GERENTE`, `ROLE_MECANICO`, `ROLE_ATENDENTE`).
- `usuario_roles`: Associação N:N entre usuários e perfis.
- `clientes`: Dados cadastrais de clientes PF e PJ.
- `fornecedores`: Parceiros e fornecedores de peças e insumos.
- `enderecos`: Endereços vinculados a clientes ou fornecedores.
- `maquinas`: Veículos, equipamentos e maquinários sob manutenção.
- `categorias`: Categorização de produtos, peças e serviços.
- `produtos`: Peças, insumos e serviços prestados.
- `produto_maquina`: Matriz de compatibilidade entre peças e máquinas.
- `ordens_servico`: Cabeçalho e fluxo da Ordem de Serviço.
- `ordem_servico_itens`: Peças e serviços adicionados à OS.
- `estoque_movimentacoes`: Histórico detalhado de movimentações de estoque.
- `auditoria`: Rastreabilidade de ações críticas em formato JSONB.

---

## 5. Inspeção e Validação com DBeaver

- O **DBeaver** (ou qualquer cliente SQL) deve ser utilizado exclusivamente para **inspeção e consulta** do schema.
- Nenhuma alteração estrutural deve ser executada diretamente pelo DBeaver; toda alteração deve passar pelo versionamento do Flyway.
