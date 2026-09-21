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
4. Os arquivos de migration residem exclusivamente no backend em:
   - `backend/src/main/resources/db/migration/`

---

## 4. Schemas e Migrations

### Migration V1 — Schema Inicial (`V1__create_initial_schema.sql`)
Provisiona as 14 tabelas centrais:
- `usuarios`: Usuários do sistema e credenciais (sem usuários fictícios).
- `roles`: Perfis de acesso da aplicação.
- `usuario_roles`: Associação N:N entre usuários e perfis.
- `clientes`: Dados cadastrais de clientes PF e PJ.
- `fornecedores`: Parceiros e fornecedores de peças e insumos.
- `enderecos`: Endereços vinculados a clientes ou fornecedores.
- `maquinas`: Máquinas e equipamentos técnicos (máquinas de solda, geradores de energia e componentes) sob manutenção.
- `categorias`: Categorização de produtos, peças e serviços.
- `produtos`: Peças, insumos e serviços prestados.
- `produto_maquina`: Matriz de compatibilidade entre peças e máquinas/equipamentos.
- `ordens_servico`: Cabeçalho e fluxo da Ordem de Serviço.
- `ordem_servico_itens`: Peças e serviços adicionados à OS.
- `estoque_movimentacoes`: Histórico detalhado de movimentações de estoque.
- `auditoria`: Rastreabilidade de ações críticas em formato JSONB.

### Migration V2 — Simplificação de Papéis para o MVP (`V2__simplify_initial_roles.sql`)
- **Contexto de Negócio**: O sistema será utilizado inicialmente por uma única usuária (proprietária da oficina), com acesso administrativo irrestrito.
- **Papel Disponível**: Exclusivamente `ROLE_ADMIN`. Os papéis `ROLE_GERENTE`, `ROLE_MECANICO` e `ROLE_ATENDENTE` foram removidos nesta migration.
- **Extensibilidade**: A estrutura relacional RBAC (`roles`, `usuario_roles`) é mantida íntegra, permitindo que novos papéis e operadores sejam cadastrados futuramente sem qualquer alteração estrutural no banco de dados.
- **Segurança**: Nenhum usuário padrão ou senha hardcoded é inserido nas migrations; a conta da proprietária será criada na Fase 2 de autenticação de forma segura.

### Migration V3 — Tabela de Refresh Tokens (`V3__add_refresh_tokens.sql`)
- **Contexto de Segurança**: Hardening da autenticação da Fase 2.1.
- **Tabela Criada**: `refresh_tokens` (15ª tabela da aplicação).
- **Campos**: `id`, `usuario_id` (FK -> `usuarios(id)` ON DELETE CASCADE), `token` (VARCHAR(255) UNIQUE), `data_expiracao` (TIMESTAMPTZ), `revogado` (BOOLEAN DEFAULT FALSE), `criado_em` (TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP).
- **Índices**: `idx_refresh_tokens_token` e `idx_refresh_tokens_usuario`.
- **Objetivo**: Armazenar tokens de renovação opacos (UUID), permitindo rotação obrigatória a cada uso e revogação real no logout sem necessidade de blocklist.

### Migration V4 — Correção do Domínio de Equipamentos (`V4__correct_equipment_domain.sql`)
- **Contexto de Negócio**: Correção crítica de domínio para eliminar conceitos e terminologias automotivas e alinhar o modelo relacional estritamente com o negócio de oficina técnica de máquinas de solda e geradores de energia.
- **Alterações em `maquinas`**:
  - Remoção de índices automotivos: `DROP INDEX idx_maquinas_placa`, `DROP INDEX idx_maquinas_chassi`.
  - Renomeação de colunas: `tipo` -> `tipo_equipamento`, `numero_serie_chassi` -> `numero_serie`, `horimetro_quilometragem` -> `horimetro`.
  - Exclusão de coluna automotiva: `placa_identificacao` removida.
  - Novos campos técnicos: `potencia VARCHAR(50)`, `tensao VARCHAR(50)`, `especificacoes_tecnicas JSONB`.
  - Novos índices técnicos: `idx_maquinas_tipo_equipamento`, `idx_maquinas_numero_serie` (sem unicidade global), `idx_maquinas_cliente_numero_serie`.
- **Alterações em `ordens_servico`**:
  - Renomeação de coluna: `horimetro_quilometragem_atual` -> `horimetro_atual`.
- **Preservação de Dados**: 100% dos dados, chaves primárias e relacionamentos com clientes e ordens de serviço preservados.

### Migration V5 — Alinhamento do Domínio de Ordens de Serviço (`V5__align_service_order_domain.sql`)
- **Contexto de Negócio**: Alinhamento do ciclo de vida das Ordens de Serviço ao fluxo real de assistência técnica de máquinas de solda e geradores de energia (Diagnóstico -> Peças -> Mão de Obra -> Testes Técnicos -> Conclusão).
- **Alterações em `ordens_servico`**:
  - Nova coluna: `testes_realizados TEXT` (registro dos testes em bancada: arco elétrico, ciclo de trabalho, amperagem, tensão e estabilidade).
  - Atualização da constraint de status para os 8 status do fluxo técnico real:
    `status IN ('ABERTA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'EM_MANUTENCAO', 'AGUARDANDO_PECA', 'PRONTA', 'CONCLUIDA', 'CANCELADA')`.
  - Valor padrão da coluna `status` atualizado para `'ABERTA'`.

### Migration V6 — Ajustes e Constraint de Tipo de Equipamento (`V6__maquinas_tipo_check_and_adjustments.sql`)
- **Contexto de Negócio**: Reforço da restrição de domínio técnico para máquinas cadastradas.
- **Alterações em `maquinas`**:
  - Constraint de tipo de equipamento estritamente técnico:
    `tipo_equipamento IN ('MAQUINA_SOLDA', 'GERADOR_ENERGIA', 'OUTRO')`.

### Migration V7 — Constraints e Índices para Estoque (`V7__add_stock_constraints_and_indices.sql`)
- **Contexto de Negócio**: Garantia de integridade física e prevenção de saldo negativo a nível de banco de dados.
- **Alterações em `produtos`**:
  - Constraint `chk_produtos_estoque_nao_negativo`: `CHECK (estoque_atual >= 0)`.
  - Constraint `chk_produtos_estoque_minimo_nao_negativo`: `CHECK (estoque_minimo >= 0)`.
  - Índices `idx_produtos_estoque_baixo`, `idx_produtos_ativo`, `idx_produtos_tipo`.
- **Alterações em `estoque_movimentacoes`**:
  - Índice `idx_estoque_mov_tipo`.

### Migration V8 — Sequence Nativa para Ordens de Serviço (`V8__add_ordem_servico_sequence.sql`)
- **Contexto de Concorrência**: Prevenção de race conditions na geração de numeração amigável de OS (`OS-YYYY-XXXXX`).
- **Objeto Criado**: Sequence nativa `ordens_servico_seq` no PostgreSQL.
- **Sincronização**: Script procedural para alinhar o valor inicial com os registros já persistidos no banco.

### Migration V9 — Marca de Produtos e Carga Inicial de Categorias (`V9__add_produto_marca_and_seed_categorias.sql`)
- **Contexto de Negócio**: Fase 6 — Produtos, Peças e Estoque.
- **Alterações em `produtos`**:
  - Nova coluna `marca VARCHAR(100)` com índice `idx_produtos_marca`.
- **Carga Inicial em `categorias`**:
  - Inserção idempotente (`ON CONFLICT (nome) DO NOTHING`) das 6 categorias técnicas oficiais:
    - *Eletrônica* (placas inversoras, IGBTs, diodos, capacitores, controladores);
    - *Máquina de Solda* (tochas MIG/TIG, tracionadores de arame, roletes, bicos);
    - *Gerador* (reguladores AVR, escovas de carvão, estatores, rotores);
    - *Elétrica* (contatores, relés, cabos e conectores);
    - *Mecânica* (rolamentos, eixos, ventiladores, carcaças);
    - *Consumíveis* (bicos de contato, bocais cerâmicos, difusores, filtros).

---

## 5. Inspeção e Validação com DBeaver

- O **DBeaver** (ou qualquer cliente SQL) deve ser utilizado exclusivamente para **inspeção e consulta** do schema.
- Nenhuma alteração estrutural deve ser executada diretamente pelo DBeaver; toda alteração deve passar pelo versionamento do Flyway.

