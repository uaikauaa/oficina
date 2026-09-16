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

### Fase 4B — Máquinas e Equipamentos Técnicos (Concluída)
- Modelagem e gestão de equipamentos: Máquinas de Solda (MIG/MAG, TIG, Eletrodo Revestido, Inversoras, Corte Plasma) e Geradores de Energia (Diesel e Gasolina).
- Vínculo relacional N:1 com clientes (`cliente_id`) e histórico completo de manutenções.
- Especificações técnicas: tipo, marca, modelo, número de série (sem constraint UNIQUE global), potência (kVA/kW), tensão de operação (110V, 220V, 380V, 440V, bivolt, trifásico), horímetro e especificações complementares em JSONB.
- Backend (Controller, Service, Repository, DTOs, Validações) e Frontend (listagem, filtros, formulário de cadastro/edição, visualização por cliente).

### Fase 4C — Ordens de Serviço (Fluxo Central de Assistência Técnica) (Concluída)
- Fluxo de trabalho técnico completo: Abertura -> Diagnóstico -> Orçamento/Aprovação -> Manutenção -> Peças -> Testes Técnicos em Bancada -> Conclusão.
- Ciclo de status oficiais: `ABERTA`, `EM_DIAGNOSTICO`, `AGUARDANDO_APROVACAO`, `EM_MANUTENCAO`, `AGUARDANDO_PECA`, `PRONTA`, `CONCLUIDA`, `CANCELADA`.
- Registro obrigatório de testes técnicos em bancada para transição para `PRONTA` (arco elétrico sob carga, amperagem, tensão, frequência em Hz, etc.).
- Sequence nativa (`ordens_servico_seq`) para geração concorrente segura de numeração amigável de OS.

### Fase 5 — Fornecedores, Produtos, Peças e Compatibilidade (Concluída)
- Cadastro de fornecedores de componentes e insumos industriais.
- Catálogo de peças técnicas para máquinas de solda e geradores (IGBTs, diodos, capacitores, placas inversoras, reguladores AVR, escovas, bicos, tochas).
- Matriz relacional de compatibilidade peça <-> equipamento (`produto_maquina`) com operações de vínculo e desvínculo.
- Categorização técnica formal de componentes.

### Fase 6 — Produtos, Peças e Controle de Estoque (Concluída)
- Entidade e gestão completa de Categorias (`Categoria`) com endpoints CRUD e listagem de ativas.
- Adição de marca técnica em produtos e filtros combinados por categoria, fornecedor, tipo e status.
- Controle atômico de estoque com Lock Pessimista de Escrita (`PESSIMISTIC_WRITE`) para prevenção de concorrência e race conditions.
- Endpoints dedicados para movimentações: `POST /api/estoque/entrada`, `POST /api/estoque/saida`, `POST /api/estoque/ajuste`.
- Integração total com Ordem de Serviço (`OrdemServicoItem`):
  - Baixa atômica de estoque ao adicionar peça na OS;
  - Congelamento histórico do preço unitário de venda na OS;
  - Atualização automática do subtotal de peças e total geral da OS;
  - Estorno automático e devolução física ao estoque em caso de exclusão de item ou cancelamento de OS;
  - Prevenção rigorosa de estoque negativo a nível de regra de negócio e constraint de banco de dados (`chk_produtos_estoque_nao_negativo`).
- Frontend com telas completas: `/produtos`, `/estoque`, `/estoque/movimentacoes`, e seção "Peças & Componentes Utilizados" em `/ordens-servico/[id]`.
- 134 testes automatizados no backend cobrindo 100% dos fluxos e regras.

### Fase 7 — Histórico Técnico e Consultas Rápidas (Concluída)
- Central de busca rápida global (`Ctrl+K` / `Cmd+K` e botão no cabeçalho) pesquisando simultaneamente em Clientes, Equipamentos, Ordens de Serviço e Peças/Produtos com debounce de 250ms e navegação completa por teclado (setas + Enter + Esc).
- Tela dedicada de consulta global de equipamentos técnicos (`/maquinas`) com filtros combinados por tipo (máquina de solda, gerador, outro), marca, modelo, número de série e cliente vinculado, com botão direto para histórico.
- Tela de histórico técnico e timeline da máquina (`/maquinas/[id]`):
  - 4 Cards de KPI no topo: Total de atendimentos, Data da última manutenção, Número da última OS e Valor total acumulado (restringido a OS com status `CONCLUIDA`);
  - Linha do tempo visual linear ordenada cronologicamente (da mais recente para a mais antiga);
  - Detalhamento de cada atendimento: problema relatado, diagnóstico técnico, solução aplicada, testes em bancada validados;
  - Seção de peças utilizadas com expansão/recolhimento e exibição do preço unitário histórico congelado da OS;
  - Estado vazio amigável quando o equipamento não possui atendimentos anteriores com botão direto de abertura de OS.
- Visão rápida e resumo na ficha do cliente (`/clientes/[id]`):
  - 5 Cards de KPI: Quantidade de equipamentos cadastrados, Quantidade total de OS, Quantidade de OS abertas/em andamento, Data da última visita e Valor total acumulado (somente OS concluídas);
  - Ação direta "Ver Histórico" em cada card de equipamento do cliente, direcionando sem atrito para a timeline da máquina.
- Consulta avançada e compacta de Ordens de Serviço (`/ordens-servico`) com busca combinada multivariável e atalhos rápidos de período ("Últimos 30 dias", "Últimos 90 dias", "Este Ano", "Todos").
- Filtro por termo (peça código/nome e usuário responsável) nas movimentações de estoque (`/estoque/movimentacoes`).
- Testes automatizados de regressão: isolamento estrito entre máquinas e entre clientes, cálculo financeiro exato e busca rápida global.

### Fase 8 — Relatórios e Impressão de OS (Concluída)
- Geração vetorial nativa em PDF A4 via OpenPDF (`GET /api/ordens-servico/{id}/pdf`) com cabeçalho oficial, dados do cliente/equipamento, defeito/diagnóstico/solução, testes de bancada, tabela com 6 colunas de peças (preços históricos congelados), totais, badge de status (vermelho em canceladas mantendo o histórico), garantia e assinaturas.
- Layout de impressão moderno no frontend (`window.print()` / `@media print`) via componente `OrdemServicoImpressao.tsx`, com estilos monocromáticos de alta fidelidade para entrega ao cliente no balcão.
- Ações de "Gerar PDF" e "Imprimir" integradas na página de detalhes da OS (`/ordens-servico/[id]`) disponíveis em todos os estados da Ordem de Serviço.
- Novo módulo completo de relatórios operacionais e gerenciais (`/relatorios`) com 6 abas dinâmicas:
  1. **Ordens de Serviço por Período**: Indicadores de Total, Concluídas, Abertas, Canceladas, Faturamento Total de Concluídas, filtros por data e status, e tabela paginada;
  2. **Situação do Estoque**: Controle de reposição por categoria e fornecedor, filtros de estoque baixo/zerado, e badges visuais (Normal, Baixo, Zerado);
  3. **Movimentações de Estoque**: Auditoria completa de entradas, saídas, ajustes e devoluções com paginação e filtros combinados;
  4. **Peças Mais Utilizadas**: Ranking analítico dos componentes de maior consumo em ordens de serviço para planejamento preventivo de compras;
  5. **Clientes**: Consolidado da carteira com contagem de equipamentos, total de OS, última visita e receita acumulada;
  6. **Equipamentos**: Relatório consolidado por máquina com histórico de manutenções e faturamento acumulado.
- 151 testes automatizados no backend aprovados com 100% de sucesso.
- Frontend com 0 erros de lint e build de produção Next.js 16.3.5 / Turbopack concluído com êxito.

### Fase 9 — Hardening, Homologação e Preparação para Release 1.0 (Concluída)
- Revisão de segurança e conformidade jurídica dos textos de garantia do PDF e impressão de balcão (redação neutra adotada).
- Parametrização da flag `Secure` em cookies HttpOnly via variável `SECURITY_COOKIE_SECURE` para suporte estrito a HTTPS em produção.
- Automação de CI/CD através do GitHub Actions (`.github/workflows/ci.yml`) cobrindo testes de backend e lint/build de frontend.
- Documentação operacional completa elaborada:
  - `docs/deployment.md`: Guia passo a passo de implantação em produção (Vercel/Railway/Neon);
  - `docs/backup.md`: Procedimentos detalhados de backup lógico (`pg_dump`), restauração (`pg_restore`) e PITR no Neon;
  - `docs/release.md`: Changelog consolidado da Release 1.0.0, instrução de corte de tag Git e checklist para a proprietária da oficina.
- Elaboração do relatório executivo de homologação `QA-RELEASE-1.0-REPORT.md` com matriz de riscos e veredito GO/NO-GO.
- 151 testes automatizados no backend com 100% de sucesso e build limpo no frontend.

### Versão 1.1 — Escopo Fechado de Produtividade Operacional (Concluída)
A V1.1 implementou cirurgicamente 6 melhorias e correções validadas durante o piloto real da V1.0.0, com foco em redução de atrito no balcão e agilidade técnica, mantendo 0 migrations e 100% de estabilidade da V1.0:

1. **BUG-001: Modal de Busca Rápida (`Ctrl+K`) Responsivo**:
   - Ajuste de padding de viewport (`pt-6 sm:pt-12 pb-6`) e altura máxima dinâmica (`max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-6rem)]`).
   - Scroll interno dedicado na lista de resultados (`overflow-y-auto min-h-0`) e rodapé de atalhos fixo (`shrink-0`), eliminando qualquer vazamento em monitores 1366x768 com zoom/escala de 125%.
2. **BUG-002: Normalização e Sanitização do Horímetro**:
   - Sanitização unificada em `OrdemServicoService` e `MaquinaService`: remoção de espaços em branco, conversão de vírgula para ponto, validação estrita de formato numérico (`^-?\\d+(\\.\\d+)?$`), conversão para `BigDecimal` e rejeição de valores negativos (`>= 0`).
   - Inputs frontend com pré-tratamento em tempo real nos formulários de nova OS, edição de OS e modal de equipamento.
   - Suíte de testes parametrizados cobrindo entradas válidas (`120,5`, `120.5`, `120 , 5`, ` 120.5 `, ` 120 , 50 `) e rejeição de inválidas (`abc`, `-10`, `12,3,4`, `..`, `1.2.3`).
3. **FEATURE-002: Laudos Rápidos de Bancada em 1 Clique**:
   - Modelos padronizados de testes de bancada exibidos durante a transição para o status `PRONTA` no modal de status da OS (`/ordens-servico/[id]`).
   - Chips de preenchimento rápido segmentados para Máquinas de Solda (3 modelos) e Geradores de Energia (3 modelos).
   - Fluxo com revisão humana obrigatória: o modelo preenche o campo de texto, permitindo edição e complementação antes da confirmação. Exigência de `testesRealizados != vazio` rigorosamente mantida no backend.
4. **FEATURE-003: Filtro e Atalho "Prontas para Retirada"**:
   - Botão de filtro rápido "Prontas para Retirada" na listagem de Ordens de Serviço (`/ordens-servico?status=PRONTA`), ativando instantaneamente o filtro `status=PRONTA`.
   - Card de indicador no topo do Dashboard (`/dashboard`) com contagem em tempo real de ordens prontas e link direto para visualização filtrada.
5. **FEATURE-001: Notificação de Retirada via WhatsApp (`wa.me`)**:
   - Botão "Avisar no WhatsApp" em `/ordens-servico/[id]` disponível para ordens com status `PRONTA` e `CONCLUIDA`.
   - Normalização automática do telefone do cliente para o formato internacional E.164 (`55...`), removendo máscaras e pontuações.
   - Construção de link direto via protocolo web seguro `https://wa.me/55...` com texto pré-preenchido contendo nome do cliente, modelo da máquina, número da OS e valor total formatado.
   - Totalmente isento de integrações de API paga, sem armazenamento em banco e com revisão manual pelo operador antes do envio.
6. **FEATURE-004: Exportação de Relatórios em CSV**:
   - Utilitário dedicado `csvHelper.ts` gerando arquivos CSV compatíveis com RFC 4180: delimitador `;`, quebras de linha `\r\n`, escape correto de aspas duplas (`""`) e UTF-8 com BOM (`\uFEFF`) para abertura nativa no Microsoft Excel em português e Bloco de Notas sem corrupção de caracteres.
   - Disponível nos 6 relatórios do sistema: Ordens de Serviço, Situação do Estoque, Movimentações, Peças Mais Utilizadas, Clientes e Equipamentos.
   - Regra estrita de exportação: exporta exatamente os registros visualizados de acordo com os filtros aplicados em tela.

### Próximas Fases (Pós-V1.1)
- Expansão de perfis (gerente, técnico/mecânico, atendente) mantendo o RBAC estruturado.



