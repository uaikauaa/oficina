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

### Fase 4B — Máquinas e Equipamentos Técnicos (Próxima Fase)
- Modelagem e gestão de equipamentos: Máquinas de Solda (MIG/MAG, TIG, Eletrodo Revestido, Inversoras, Corte Plasma) e Geradores de Energia (Diesel e Gasolina).
- Vínculo relacional N:1 com clientes (`cliente_id`) e histórico completo de manutenções.
- Especificações técnicas: tipo, marca, modelo, número de série (sem constraint UNIQUE global), potência (kVA/kW), tensão de operação (110V, 220V, 380V, 440V, bivolt, trifásico), horímetro e especificações complementares em JSONB.
- Backend (Controller, Service, Repository, DTOs, Validações) e Frontend (listagem, filtros, formulário de cadastro/edição, visualização por cliente).

### Fase 4C — Ordens de Serviço (Fluxo Central de Assistência Técnica)
- Fluxo de trabalho técnico completo: Abertura -> Diagnóstico -> Orçamento/Aprovação -> Manutenção -> Peças -> Testes Técnicos em Bancada -> Conclusão.
- Ciclo de status oficiais: `ABERTA`, `EM_DIAGNOSTICO`, `AGUARDANDO_APROVACAO`, `EM_MANUTENCAO`, `AGUARDANDO_PECA`, `PRONTA`, `CONCLUIDA`, `CANCELADA`.
- Registro de testes realizados (arco elétrico, estabilidade de rotação, tensão e amperagem).
- Vínculo atômico com peças/serviços e baixa automática de estoque com bloqueio de saldo negativo.

### Fase 5 — Produtos, Peças, Insumos e Fornecedores
- Cadastro de peças e componentes eletrônicos (placas inversoras, pontes retificadoras, IGBTs, tiristores, capacitores, cabos, tochas, bicos, filtros, reguladores AVR).
- Matriz de compatibilidade entre peças e máquinas/equipamentos (`produto_maquina`).
- Cadastro de fornecedores de componentes e insumos.

### Fase 6 — Controle de Estoque Técnico
- Movimentações de estoque: Entradas por compra, Saídas vinculadas a Ordens de Serviço, Ajustes manuais com justificativa obrigatória e rastreabilidade por auditoria.
- Prevenção rigorosa de estoque negativo.

### Fase 7 — Histórico e Consultas Rápidas
- Busca ágil por cliente, número de série do equipamento ou número da OS para atendimento em balcão.
- Linha do tempo de manutenções anteriores por equipamento.

### Fase 8 — Relatórios Gerenciais
- Faturamento de serviços e peças, equipamentos mais atendidos, produtividade e consumo de peças em garantia.

### Fase 9 — Auditoria e Segurança
- Log detalhado de operações críticas (alterações em OS, movimentações de estoque, cancelamentos).

### Fase 10 — Melhorias Administrativas e Multi-usuário
- Expansão de perfis (gerente, técnico/mecânico, atendente) mantendo o RBAC estruturado na V1.
