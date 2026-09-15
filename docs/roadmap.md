# Roadmap de Desenvolvimento — Oficina Gestão

O desenvolvimento segue um planejamento faseado rigoroso, evitando a introdução prematura de complexidade.

---

## 📌 Fases do Projeto

### Fase 0 — Fundação (Concluída)
- Auditoria do ambiente e ferramentas de desenvolvimento.
- Estrutura de diretórios e governança (`AGENTS.md`, documentação inicial).
- Setup do Frontend (Next.js, TypeScript, Tailwind CSS) com build validado.
- Setup do Backend (Spring Boot, Java 21) com endpoint `/api/health` e build validado.
- Configuração de versionamento e `.gitignore`.
- Validação técnica da fundação.

### Fase 1 — Modelagem e Banco de Dados (Concluída)
- Configuração da conexão com PostgreSQL / Neon via variáveis de ambiente seguras.
- Integração de Spring Data JPA, Hibernate (modo `validate`) e Flyway.
- Criação e aplicação da migration `V1__create_initial_schema.sql` (14 tabelas, constraints e índices).
- Criação e aplicação da migration `V2__simplify_initial_roles.sql` (ajuste para modelo de usuária única com `ROLE_ADMIN`).
- Validação automatizada da integridade relacional e conexão real com o banco Neon.

### Fase 2 — Autenticação e Segurança (Concluída)
- Implementação de Spring Security e autenticação stateless com JWT.
- Tokens assinados com HMAC-SHA256 e transmitidos via cookie `HttpOnly` com `SameSite=Lax` e header `Authorization: Bearer`.
- Controle de acesso restrito à proprietária da oficina (`ROLE_ADMIN`) sem permissões fictícias ou múltiplos níveis no MVP.
- Inicialização segura da conta administrativa da proprietária via variáveis de ambiente (`INITIAL_ADMIN_*`), sem credenciais hardcoded.
- Registro de auditoria (`auditoria`) para eventos de login e logout com endereço IP.
- Frontend Next.js com tela de login responsiva (React Hook Form + Zod), middleware para proteção de rotas privadas (`/dashboard`) e dashboard inicial protegido.

### Fase 2.1 — Hardening da Autenticação (Concluída)
- Redução da exposição de tokens: JWT completamente removido do corpo da resposta do login (`LoginResponse` retorna exclusivamente dados da usuária).
- Par de tokens: Access Token curto (15 minutos, JWT) + Refresh Token de longa duração (7 dias, UUID opaco armazenado no PostgreSQL Neon).
- Migration Flyway `V3__add_refresh_tokens.sql` criando a tabela `refresh_tokens` com índices e integridade referencial em cascata.
- Rotação estrita de tokens: a cada renovação silenciosa (`POST /api/auth/refresh`), o token anterior é revogado e um novo par é gerado.
- Proteção CSRF aprofundada: Access Token com `SameSite=Lax` (Path `/`) e Refresh Token com `SameSite=Strict` (Path restrito `/api/auth`).
- Revogação ativa no logout (`POST /api/auth/logout` revoga o refresh token no banco de dados e expira ambos os cookies).
- Frontend adaptado com renovação silenciosa no dashboard ao detectar access token expirado (401).
- 29 testes automatizados no backend e build limpo no frontend Next.js.

### Fase 3 — Fundação da API e Padrões do Backend (Concluída)
- Reorganização modular da estrutura de pacotes: `config`, `security`, `auth`, `usuario`, `auditoria`, `exception`, `common` e reserva dos pacotes de domínio (`cliente`, `maquina`, `produto`, `estoque`, `fornecedor`, `ordem`, `relatorio`).
- Estabelecimento do fluxo em camadas estrito: `Controller -> DTO -> Service -> Repository -> Entity`.
- Contrato padronizado de tratamento global de exceções via `GlobalExceptionHandler` e `ApiErrorResponse`, com segurança contra vazamento de stack traces, queries SQL ou segredos.
- Contrato genérico de paginação via `PageResponse<T>`.
- Integração do SpringDoc OpenAPI 3 / Swagger UI com suporte a esquemas de autenticação via Cookie e Bearer token.
- Endpoint autenticado de diagnóstico `GET /api/system/status` restrito à `ROLE_ADMIN`.
- Preservação da integridade e isolamento de banco de dados (zero alteração em migrations Flyway existentes).
- 40 testes automatizados no backend e builds 100% verdes no frontend e backend.

### Correção Crítica de Domínio — Máquinas de Solda e Geradores (Concluída)
- Eliminação definitiva de conceitos e terminologias automotivas (veículos, placas, chassis).
- Migration Flyway `V4__correct_equipment_domain.sql` aplicada no Neon: remoção de colunas e índices automotivos, adição de atributos técnicos (`potencia`, `tensao`, `especificacoes_tecnicas`, `tipo_equipamento`, `numero_serie`, `horimetro`) e índices otimizados para histórico.
- Atualização e aprovação de 41 testes automatizados.

### Fase 4A — Módulo de Clientes (Concluída)
- Cadastro de Clientes Pessoa Física (PF) e Pessoa Jurídica (PJ) da oficina técnica.
- Gestão completa de endereços principais e dados de contato (telefone, celular, e-mail).
- Prevenção rigorosa de duplicidades (CPF, CNPJ, telefone, celular, nome/razão social).
- Pesquisa paginada flexível e eficiente por ID, nome, razão social, documento ou contato.
- Arquitetura estrita `Controller -> DTO -> Service -> Repository -> Entity` sem exposição de entidades JPA.
- Frontend Next.js com páginas `/clientes` e `/clientes/[id]` (tabela responsiva, filtros, modais, feedback visual e confirmação de ações).
- Estrutura preparada para relacionar máquinas e geradores futuramente.
- 53 testes automatizados no backend e builds 100% aprovados.

### Fase 4B — Máquinas e Equipamentos Técnicos (Pendente)
- Gestão de Máquinas de Solda (MIG/MAG, TIG, Eletrodo Revestido, Inversoras, Corte Plasma) e Geradores de Energia (Diesel e Gasolina).
- Vínculo relacional com clientes (histórico de manutenções e ordens de serviço).
- Cadastro de especificações técnicas (potência kVA/kW, tensão 110V/220V/380V/440V, corrente máxima, número de série e horímetro).

### Fase 4C — Fornecedores, Peças, Insumos e Serviços (Pendente)
- Gestão de Fornecedores de Peças, Componentes Eletrônicos e Consumíveis.
- Gestão de Peças, Insumos e Estoque Técnico.
- Gestão de Serviços e Diagnósticos Técnicos.

### Fase 5 — Ordens de Serviço (Core do Negócio)
- Ciclo de vida da Ordem de Serviço (Abertura, Orçamento, Aprovação, Execução, Conclusão).
- Adição de itens de peças e mão de obra com baixa em estoque.
- Impressão e exportação de relatórios da OS.

### Fase 6 — Financeiro e Relatórios
- Contas a pagar e receber vinculadas às Ordens de Serviço.
- Formas de pagamento e controle de caixa.
- Dashboard com indicadores operacionais e financeiros.
