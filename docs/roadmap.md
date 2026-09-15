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

### Fase 3 — Cadastros Base
- Gestão de Clientes e Veículos.
- Gestão de Fornecedores e Peças/Estoque básico.
- Gestão de Serviços e Mecânicos/Técnicos.

### Fase 4 — Ordens de Serviço (Core do Negócio)
- Ciclo de vida da Ordem de Serviço (Abertura, Orçamento, Aprovação, Execução, Conclusão).
- Adição de itens de peças e mão de obra com baixa em estoque.
- Impressão e exportação de relatórios da OS.

### Fase 5 — Financeiro e Relatórios
- Contas a pagar e receber vinculadas às Ordens de Serviço.
- Formas de pagamento e controle de caixa.
- Dashboard com indicadores operacionais e financeiros.
