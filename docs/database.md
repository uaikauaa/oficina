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

### Migration V10 — FK Composta OS → Máquina → Cliente (`V10__add_composite_foreign_key_os_maquina_cliente.sql`)
- **Contexto de Integridade**: Garantia relacional estrita de que a máquina associada a uma Ordem de Serviço pertence obrigatoriamente ao cliente titular daquela OS.
- **Alterações**:
  - Constraint de unicidade composta `uq_maquinas_id_cliente` na tabela `maquinas`.
  - Chave estrangeira composta `fk_os_maquina_cliente` vinculando `(maquina_id, cliente_id)` em `ordens_servico` a `(id, cliente_id)` em `maquinas`.

### Migration V11 — Configuração da Oficina (`V11__create_configuracao_oficina.sql`)
- **Contexto de Negócio**: Tabela singleton para armazenar identidade visual, dados cadastrais e parâmetros operacionais da oficina técnica.
- **Tabela Criada**: `configuracao_oficina`.
- **Campos**: Nome fantasia, razão social, CNPJ, telefone, e-mail, endereço completo, termos de garantia e textos de cabeçalho/rodapé de ordens de serviço.

### Migration V12 — Atualização de Defaults da Oficina (`V12__update_admin_and_config_defaults.sql`)
- **Contexto de Negócio**: Saneamento de dados iniciais e alinhamento dos padrões cadastrais da oficina.

### Migration V13 — Estruturas Fiscais Transitórias (`V13__create_fiscal_dps_and_tomador_ibge.sql`)
- **Contexto**: Criação transitória de tabelas de DPS (`dps_numeracao`, `dps_fiscal`) e coluna `codigo_ibge` em clientes.

### Migration V14 — Desacoplamento Fiscal (`V14__remove_unused_fiscal_structures.sql`)
- **Contexto de Simplificação**: Desacoplamento do escopo de emissão de NFS-e direta.
- **Alterações**:
  - Remoção (`DROP TABLE`) de `dps_fiscal` e `dps_numeracao`.
  - Remoção de coluna `codigo_ibge` em `configuracao_oficina`.

### Migration V15 — Remoção de Código IBGE em Clientes (`V15__remove_cliente_codigo_ibge.sql`)
- **Contexto**: Eliminação de resíduos fiscais no cadastro de clientes.
- **Alterações**: `ALTER TABLE clientes DROP COLUMN IF EXISTS codigo_ibge`.

### Migration V16 — Código Sequencial P-XXX e Link de Compra (`V16__refactor_produto_codigo_and_link_compra.sql`)
- **Contexto**: Facilidade de identificação visual de peças na bancada e cotação rápida.
- **Alterações**:
  - Sequence nativa `produtos_codigo_seq` para formatação amigável `P-001`, `P-002`.
  - Nova coluna `link_compra VARCHAR(500)` para links diretos de reposição de insumos com fornecedores.

### Migration V17 — Remember Me em Refresh Tokens (`V17__add_remember_me_to_refresh_tokens.sql`)
- **Contexto de UX/Sessão**: Persistência de preferência de sessão estendida pelo usuário.
- **Alterações**: Nova coluna `remember_me BOOLEAN NOT NULL DEFAULT FALSE` na tabela `refresh_tokens`.

### Migration V18 — Desafios de Autenticação 2FA (`V18__create_two_factor_challenges.sql`)
- **Contexto de Segurança**: Armazenamento efêmero dos códigos do segundo fator de autenticação.
- **Tabela Criada**: `two_factor_challenges`.
- **Campos**: `id`, `usuario_id`, `codigo_hash` (VARCHAR(60) — BCrypt), `expiracao` (TIMESTAMPTZ — 5 min), `tentativas` (INTEGER DEFAULT 0), `utilizado` (BOOLEAN DEFAULT FALSE), `criado_em`.

### Migration V19 — Central de Notificações (`V19__create_notificacoes.sql`)
- **Contexto Operacional**: Persistência de alertas internos de estoque crítico e alterações em ordens de serviço.
- **Tabela Criada**: `notificacoes`.
- **Campos**: `id`, `tipo` (`ESTOQUE_BAIXO`, `ORDEM_SERVICO`, `SISTEMA`), `titulo`, `mensagem`, `lida`, `link_acao`, `criado_em`.

### Migration V20 — Invalidação Imediata de Sessões (`V20__add_token_version_to_usuarios.sql`)
- **Contexto de Segurança SEC-07**: Invalidação imediata de JWTs de acesso em caso de logout ou alteração de credenciais.
- **Alterações**: Nova coluna `token_version INTEGER NOT NULL DEFAULT 1` na tabela `usuarios`.

### Migration V21 — Hashing de Refresh Tokens (`V21__hash_refresh_tokens.sql`)
- **Contexto de Hardening ADC-01**: Proteção contra vazamento de tokens de renovação em dumps ou consultas não autorizadas.
- **Alterações**:
  - Remoção da coluna de texto claro `token`.
  - Criação da coluna `token_hash VARCHAR(64) NOT NULL UNIQUE` (hash SHA-256 do token gerado).
  - Atualização dos índices de busca por hash.

---

## 5. Inspeção e Validação com DBeaver

- O **DBeaver** (ou qualquer cliente SQL) deve ser utilizado exclusivamente para **inspeção e consulta** do schema.
- Nenhuma alteração estrutural deve ser executada diretamente pelo DBeaver; toda alteração deve passar pelo versionamento do Flyway.
