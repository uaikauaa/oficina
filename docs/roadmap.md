# Roadmap de Desenvolvimento — Oficina Gestão

O desenvolvimento segue um planejamento faseado rigoroso, evitando a introdução prematura de complexidade.

---

## 📌 Fases do Projeto

### Fase 0 — Fundação (Atual)
- Auditoria do ambiente e ferramentas de desenvolvimento.
- Estrutura de diretórios e governança (`AGENTS.md`, documentação inicial).
- Setup do Frontend (Next.js, TypeScript, Tailwind CSS) com build validado.
- Setup do Backend (Spring Boot, Java 21) com endpoint `/api/health` e build validado.
- Configuração de versionamento e `.gitignore`.
- Validação técnica da fundação.

### Fase 1 — Modelagem e Banco de Dados
- Configuração da conexão com PostgreSQL / Neon via variáveis de ambiente seguras.
- Criação das primeiras migrations Flyway para criação de schemas e tabelas.
- Mapeamento de entidades JPA base e auditoria de entidades.

### Fase 2 — Autenticação e Segurança
- Implementação de Spring Security e autenticação JWT.
- Controle de acessos e perfis de usuário (RBAC).
- Integração de login no frontend Next.js.

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
