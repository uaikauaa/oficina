# Oficina Gestão

Sistema web completo para gestão operacional, técnica e administrativa de **oficina técnica industrial e elétrica**. O sistema é especializado no atendimento a equipamentos de alta demanda como **máquinas de solda (inversoras, transformadores, MIG/MAG, TIG), geradores de energia, compressores, ferramentas elétricas e equipamentos industriais em geral**.

---

## 🏛 Arquitetura Geral

O projeto é concebido sob uma arquitetura estritamente **WebApp** (sem componentes desktop, FXML ou JavaFX), adotando o padrão de separação total entre cliente e servidor:

```text
Navegador (Usuário / Balcão / Oficina)
   │
   ▼ HTTPS / TLS
Frontend (Next.js 16 — App Router) — Porta 3000
   │
   ▼ REST API / JSON (Cookies HttpOnly SameSite)
Backend (Spring Boot 3.4 / Java 21) — Porta 8080
   │
   ▼ JDBC / HikariCP (SSL Obrigatório)
Banco de Dados (PostgreSQL no Neon Serverless)
```

> **Princípio de Isolamento:** O frontend **nunca** estabelece conexão direta com o banco de dados. Todas as regras de negócio, cálculos, validações de domínio, autenticação e controle transacional residem exclusivamente no backend.

---

## 🛠 Stack Tecnológica

### Frontend
* **Framework:** Next.js 16.3.8 (App Router, Turbopack)
* **Biblioteca Base:** React 19.2.8
* **Linguagem:** TypeScript 5.9
* **Estilização:** Tailwind CSS 4
* **Formulários e Validação:** React Hook Form 7.88.0 + Zod 4.6
* **Comunicação e Estado:** Fetch nativo via cliente centralizado (`apiFetch`) e React Hooks
* **Testes Automatizados:** Node.js Native Test Runner (`node:test` + `node:assert/strict`)
* **Testes End-to-End (E2E):** Playwright 1.63
* **Qualidade de Código:** ESLint 9

### Backend
* **Linguagem:** Java 21 (LTS — Eclipse Adoptium Temurin)
* **Framework Principal:** Spring Boot 3.4.13
* **Segurança:** Spring Security 6.4.13 (Spring Framework 6.2.19)
* **Persistência / ORM:** Spring Data JPA + Hibernate ORM
* **Versionamento de Banco:** Flyway Core 10
* **Pool de Conexões:** HikariCP
* **Documentação de API:** SpringDoc OpenAPI 2.8 / Swagger (desabilitado em produção)
* **Envio de Mensagens (2FA):** Spring Boot Mail / JavaMailSender via Gmail SMTP
* **Gerenciamento de Build:** Apache Maven com Maven Wrapper (`mvnw` / `mvnw.cmd`)

### Banco de Dados
* **SGBD:** PostgreSQL (versão 18.6)
* **Hospedagem:** Neon Serverless PostgreSQL (Região AWS `sa-east-1` — São Paulo)
* **Controle de Schema:** 21 migrations Flyway sequenciais e idempotentes

---

## ⚙️ Funcionalidades do Sistema

O **Oficina Gestão** foi desenhado para cobrir todo o ciclo operacional de uma oficina técnica:

1. **Dashboard Operacional e Gerencial:**
   * Contadores em tempo real de Ordens de Serviço por status.
   * Indicadores de faturamento mensal e ticket médio.
   * Resumo de saúde de estoque (produtos com estoque baixo, estoque zerado e valor total imobilizado).
   * Alertas operacionais e atalhos rápidos.

2. **Gestão de Clientes:**
   * Cadastro completo de Pessoas Físicas (CPF) e Jurídicas (CNPJ com validação).
   * Múltiplos endereços (principal, cobrança, entrega).
   * Consulta de CEP com preenchimento automatizado via ViaCEP.
   * Histórico detalhado de equipamentos vinculados e ordens de serviço já realizadas.

3. **Parque de Equipamentos e Máquinas:**
   * Cadastro técnico de máquinas de solda, geradores, compressores e equipamentos elétricos.
   * Especificações técnicas personalizadas: número de série, tensão de alimentação, potência, horímetro atual e especificações em JSONB.
   * Rastreabilidade completa de todas as manutenções do equipamento ao longo de sua vida útil.

4. **Ordens de Serviço (OS):**
   * Numeração sequencial formatada e auditável (`OS-YYYY-NNNN`).
   * Registro detalhado de defeito reclamado, diagnóstico técnico e laudo pericial.
   * Inclusão de peças/produtos com baixa automática e sincronizada no estoque.
   * Inclusão de serviços e mão de obra técnica.
   * Registro de testes em bancada (arco elétrico, ciclo de trabalho, amperagem, tensão de saída e estabilidade).
   * Emissão de documento comercial / comprovante de entrada e saída em formato A4 para impressão ou PDF.

5. **Controle de Produtos, Peças e Estoque:**
   * Código de identificação sequencial amigável (`P-001`, `P-002`).
   * Categorização técnica oficial (Eletrônica, Máquinas de Solda, Geradores, Elétrica, Mecânica, Consumíveis).
   * Cadastro de marca, modelo, link externo para recompra e estoque mínimo.
   * Bloqueio pessimista de concorrência (`SELECT FOR UPDATE`) para garantir integridade física e impedir saldo de estoque negativo.
   * Histórico de movimentações de estoque (entradas, saídas manuais, baixas por OS, ajustes e estornos).

6. **Fornecedores:**
   * Cadastro de parceiros comerciais e fornecedores de peças e componentes.
   * Vínculo opcional nos produtos para cotações e reposição rápida.

7. **Relatórios e Inteligência:**
   * Visões consolidadas: financeiro, faturamento mensal, ordens por status, peças mais utilizadas e rentabilidade por cliente.
   * Exportação dos dados para planilhas em formato CSV.

8. **Central de Notificações:**
   * Notificações operacionais persistidas no banco de dados.
   * Avisos automáticos de estoque crítico/baixo e atualizações de ordens de serviço.
   * Leitura, paginação e contadores em tempo real na barra de cabeçalho.

9. **Configurações da Oficina:**
   * Parametrização dos dados cadastrais da empresa (razão social, CNPJ, telefone, endereço, cabeçalho e rodapé de ordens de serviço).

10. **Busca Rápida Global (Ctrl + K):**
    * Atalho de busca universal para localização instantânea de clientes, equipamentos e ordens de serviço.

---

## 🔄 Fluxo do Ciclo de Vida da Ordem de Serviço

O fluxo da Ordem de Serviço segue estritamente a máquina de estados validada no backend ([`StatusOrdemServico.java`](backend/src/main/java/com/oficinagestao/entity/StatusOrdemServico.java)) e espelhada no frontend:

```text
[ ABERTA ] (Equipamento recebido no balcão)
    │
    ▼
[ EM_DIAGNOSTICO ] (Técnico analisa na bancada)
    │
    ▼
[ AGUARDANDO_APROVACAO ] (Orçamento enviado ao cliente)
    │
    ▼ (Cliente aprovou)
[ EM_MANUTENCAO ] (Execução do conserto e substituição de peças)
    │        ▲
    │        │ (Peça recebida do fornecedor)
    ▼        │
[ AGUARDANDO_PECA ] (Necessidade de componente sem saldo em estoque)
    │
    ▼ (Manutenção finalizada)
[ PRONTA ] (Aprovado nos testes de carga/bancada; aguardando retirada)
    │
    ▼
[ CONCLUIDA ] (Equipamento entregue e pagamento registrado)
```

* **Cancelamento:** A transição para `CANCELADA` é permitida a partir de qualquer status não-terminal (`ABERTA`, `EM_DIAGNOSTICO`, `AGUARDANDO_APROVACAO`, `EM_MANUTENCAO`, `AGUARDANDO_PECA` ou `PRONTA`).
* **Estados Terminais:** `CONCLUIDA` e `CANCELADA` são terminais; nenhuma transição subsequente é permitida.
* **Integridade de Estoque:** Ao adicionar peças na OS durante a manutenção, o sistema executa reserva e baixa sob transação com lock pessimista.

---

## 🔒 Arquitetura de Segurança e Autenticação

A aplicação adota um padrão de defesa em profundidade construído sobre o Spring Security:

* **Armazenamento de Senhas:** Hashing unidirecional via `BCryptPasswordEncoder` com sal aleatório e fator de custo calibrado.
* **Autenticação em Dois Fatores (2FA) por E-mail:**
  * Segundo fator obrigatório no fluxo de login.
  * Código numérico de 6 dígitos gerado com `SecureRandom`.
  * Código armazenado no banco exclusivamente como hash BCrypt (nunca em texto claro).
  * Desafio com validade de 5 minutos, limite rígido de 5 tentativas consecutivas e cooldown de 30 segundos entre reenvios.
  * O envio é realizado via SMTP dedicado do Gmail (App Password).
* **Gestão de Sessão e Tokens:**
  * Sessão stateless na API com emissão de par de tokens:
    * `access_token`: JWT de curta duração (15 minutos), transmitido via cookie `HttpOnly` com diretiva `SameSite=Lax`.
    * `refresh_token`: Identificador de renovação (7 dias), transmitido via cookie `HttpOnly` com diretiva `SameSite=Strict` e restrito ao caminho `/api/auth`.
  * Em ambiente de produção, a flag `Secure` é forçada via configuração (`security.cookie.secure=true`).
  * **Ausência de Tokens em Storage:** Nenhum token é gravado em `localStorage`, `sessionStorage` ou exposto em query strings de URL, neutralizando o vetor clássico de exfiltração via XSS.
* **Rotação e Hashing de Refresh Tokens:**
  * O valor do refresh token é armazenado no PostgreSQL exclusivamente como hash SHA-256 (`token_hash VARCHAR(64)`).
  * A cada renovação (`/api/auth/refresh`), o token anterior é imediatamente revogado e um novo par é gerado.
  * Bloqueio pessimista (`PESSIMISTIC_WRITE`) no banco para evitar race conditions em requisições concorrentes de renovação.
* **Invalidação Instantânea de Sessões (`tokenVersion`):**
  * Cada usuário possui um contador numérico `token_version`.
  * A claim `tokenVersion` é validada pelo filtro de autenticação a cada requisição.
  * Trocas de senha e operações de encerramento global de sessão incrementam o contador, invalidando imediatamente todos os access tokens emitidos anteriormente sem necessidade de blacklist em memória.
* **Mitigação de Força Bruta e DoS:**
  * Rate limiter com chave dupla: bloqueio tanto por IP de origem quanto por combinação de IP + E-mail.
  * Normalização de tempo contra enumeração de usuários (`DUMMY_PASSWORD_HASH`), eliminando diferenças de latência em tentativas com e-mails inexistentes.
  * Sanitização de logs: senhas e códigos 2FA nunca são impressos em console ou arquivo.
* **Proteção contra Spoofing de Rede:**
  * `IpAddressResolver` aceita cabeçalhos `X-Forwarded-For` e `CF-Connecting-IP` estritamente quando a conexão provém de proxies cadastrados em `TRUSTED_PROXIES`.
* **Headers HTTP e Content Security Policy (CSP):**
  * `X-Content-Type-Options: nosniff`.
  * `X-Frame-Options: DENY` e `frame-ancestors 'none'` contra clickjacking.
  * `Referrer-Policy: strict-origin-when-cross-origin`.
  * `Permissions-Policy` restringindo uso de câmera, microfone e geolocalização.
  * HSTS ativado em produção (`max-age=31536000; includeSubDomains`).
  * CSP configurado no Next.js (com `unsafe-inline` documentado como risco residual inerente à hidratação de estilos/scripts do framework e `unsafe-eval` estritamente restrito ao modo de desenvolvimento).
* **Validação de Inicialização em Produção:**
  * `ProductionSecurityValidator` executa no startup do Spring Boot e aborta a inicialização caso `JWT_SECRET` esteja ausente, fraco ou padrão, ou caso o CORS permita origens inseguras (`localhost` ou `*`).
* **Superfície Exposta Reduzida:**
  * Swagger UI e OpenAPI habilitados apenas em ambiente de desenvolvimento (`dev`), desabilitados por padrão em produção.
  * Spring Boot Actuator restrito exclusivamente a `/actuator/health` com `show-details=never`.

---

## 🗄 Banco de Dados e Migrations (Flyway)

O banco de dados é versionado estritamente através do Flyway, garantindo rastreabilidade absoluta de schema e dados em qualquer ambiente:

| Migration | Identificador | Resumo da Operação |
| :---: | :--- | :--- |
| **V1** | `create_initial_schema` | Criação das 14 tabelas base (usuarios, roles, clientes, produtos, maquinas, os, etc.). |
| **V2** | `simplify_initial_roles` | Simplificação para perfil `ROLE_ADMIN`. |
| **V3** | `add_refresh_tokens` | Criação da tabela de controle de sessões e refresh tokens. |
| **V4** | `correct_equipment_domain` | Expurgada modelagem automotiva; introduzidos campos técnicos (potência, tensão, horímetro). |
| **V5** | `align_service_order_domain` | Alinhamento do ciclo de vida da OS (8 status técnicos e campo de testes em bancada). |
| **V6** | `maquinas_tipo_check_and_adjustments` | Constraints de domínio para tipos de equipamento técnico. |
| **V7** | `add_stock_constraints_and_indices` | Constraint de estoque ≥ 0 e índices de busca. |
| **V8** | `add_ordem_servico_sequence` | Sequence nativa para geração atômica de numeração de OS (`OS-YYYY-NNNN`). |
| **V9** | `add_produto_marca_and_seed_categorias` | Campo marca em produtos e carga inicial de categorias técnicas. |
| **V10** | `add_composite_foreign_key_os_maquina_cliente` | Integridade referencial composta garantindo que a máquina pertence ao cliente da OS. |
| **V11** | `create_configuracao_oficina` | Tabela singleton para dados e identidade visual da oficina. |
| **V12** | `update_admin_and_config_defaults` | Ajustes de inicialização cadastral da oficina. |
| **V13** | `create_fiscal_dps_and_tomador_ibge` | Criação transitória de tabelas fiscais de DPS. |
| **V14** | `remove_unused_fiscal_structures` | Remoção e purga de tabelas fiscais de DPS e desacoplamento do módulo fiscal. |
| **V15** | `remove_cliente_codigo_ibge` | Remoção da coluna de código IBGE da tabela `clientes`. |
| **V16** | `refactor_produto_codigo_and_link_compra` | Sequencial amigável `P-XXX` e campo de link de compra de insumos. |
| **V17** | `add_remember_me_to_refresh_tokens` | Flag de persistência estendida de sessão. |
| **V18** | `create_two_factor_challenges` | Tabela para desafios efêmeros de autenticação em dois fatores (código com hash). |
| **V19** | `create_notificacoes` | Tabela de notificações operacionais da aplicação. |
| **V20** | `add_token_version_to_usuarios` | Controle de invalidação imediata de JWTs por usuário. |
| **V21** | `hash_refresh_tokens` | Refatoração de segurança: tokens armazenados exclusivamente como hash SHA-256 (`token_hash`). |

---

## 🧪 Suíte de Testes Automatizados

A qualidade e a integridade da aplicação são asseguradas por uma suíte completa de testes unitários, de integração com banco real e testes de isolamento de concorrência:

* **Backend (Spring Boot + JUnit 5 + Mockito + Testcontainers):**
  * **477 testes aprovados** (0 falhas, 0 erros, 0 ignorados).
  * Cobertura de controllers, serviços de domínio, repositórios JPA, segurança JWT, rate limiting, locks pessimistas de estoque, concorrência de refresh tokens e isolamento sanitário de banco.
* **Frontend (Node.js Native Test Runner):**
  * **306 testes aprovados** distribuídos em 122 suites de teste (0 falhas).
  * Testes de componentes, validações com Zod, resiliência de sessão, interceptação de cookies e fluxo de telas.
* **TypeScript & Linter:**
  * Compilação TypeScript com verificação estrita (`tsc --noEmit`): **0 erros**.
  * ESLint: **0 erros e 0 warnings**.
* **Total Geral:** **783 testes automatizados**.

---

## 📁 Estrutura do Projeto

```text
oficina/
├── .env.example                     # Modelo oficial de variáveis de ambiente
├── .gitignore
├── AGENTS.md                        # Diretrizes e regras fundamentais do projeto
├── README.md                        # Documentação oficial do projeto
├── docs/                            # Documentação técnica e de governança
│   ├── api.md                       # Especificação de contratos e endpoints REST
│   ├── architecture.md              # Princípios e decisões arquiteturais
│   ├── database.md                  # Modelo de dados e histórico de migrações
│   ├── deployment.md                # Guia de implantação e infraestrutura
│   ├── development.md               # Guia de configuração para desenvolvedores
│   ├── backup.md                    # Procedimentos operacionais de salvaguarda
│   ├── release.md                   # Notas de versão e homologação
│   ├── roadmap.md                   # Roadmap de evolução técnica
│   └── historico/                   # Relatórios e auditorias das fases anteriores
│
├── frontend/                        # Aplicação Web (Next.js 16 / React 19)
│   ├── src/
│   │   ├── app/                     # Rotas do App Router
│   │   │   ├── (authenticated)/     # Páginas com sessão protegida (Dashboard, Clientes, etc.)
│   │   │   ├── login/               # Fluxo de login e verificação 2FA
│   │   │   ├── globals.css          # Estilos globais e tokens Tailwind
│   │   │   └── layout.tsx           # Shell principal da aplicação
│   │   ├── components/              # Componentes de interface e modais operacionais
│   │   └── lib/                     # Clientes de API, tipos TypeScript e testes
│   ├── e2e/                         # Testes End-to-End com Playwright
│   ├── next.config.ts               # Rewrites de API e headers HTTP de segurança
│   └── package.json
│
└── backend/                         # API REST (Spring Boot 3.4 / Java 21)
    ├── pom.xml                      # Descritor Maven e dependências
    ├── mvnw / mvnw.cmd              # Maven Wrapper
    └── src/
        ├── main/
        │   ├── java/com/oficinagestao/
        │   │   ├── config/          # Inicializadores, validações de produção e Swagger
        │   │   ├── controller/      # Endpoints REST (14 controllers)
        │   │   ├── dto/             # Records imutáveis de entrada e saída
        │   │   ├── entity/          # Entidades persistentes JPA (21 entidades)
        │   │   ├── exception/       # Manipulação global de erros e respostas estruturadas
        │   │   ├── repository/      # Interfaces de acesso a dados (Spring Data JPA)
        │   │   ├── security/        # Filtros JWT, autenticação, rate limiting e hashes
        │   │   └── service/         # Regras de negócio, transações e envio de e-mails
        │   └── resources/
        │       ├── application.properties        # Propriedades padrão da aplicação
        │       ├── application-dev.properties    # Configurações do profile de desenvolvimento
        │       ├── application-prod.properties   # Configurações estritas do profile de produção
        │       └── db/migration/                 # 21 Migrations SQL controladas pelo Flyway
        └── test/                    # 477 testes unitários e de integração
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* **Java JDK:** 21 (LTS) instalado e configurado no PATH (`java -version`).
* **Node.js:** Versão >= 20.x e npm >= 10.x (`node -v` e `npm -v`).
* **PostgreSQL / Neon:** Projeto ativo no [Neon](https://neon.tech) com credenciais de acesso.

---

### Passo 1 — Clonar o Repositório
```bash
git clone https://github.com/uaikauaa/oficina.git
cd oficina
```

---

### Passo 2 — Configurar Variáveis de Ambiente
Copie o modelo de variáveis na raiz do repositório:
```powershell
# Windows PowerShell
Copy-Item .env.example .env
```
```bash
# Linux / macOS
cp .env.example .env
```

Edite o arquivo `.env` preenchendo as credenciais com valores seguros (utilize placeholders locais para desenvolvimento):

```env
# Conexão com o Banco Neon (PostgreSQL)
DB_URL=jdbc:postgresql://<seu-endpoint-neon>.sa-east-1.aws.neon.tech/neondb?sslmode=require
DB_USERNAME=neondb_owner
DB_PASSWORD=sua_senha_neon_aqui

# Porta do Backend
SERVER_PORT=8080

# Chave JWT (pelo menos 32 caracteres aleatórios para desenvolvimento)
JWT_SECRET=uma_chave_segura_de_pelo_menos_32_caracteres_aleatorios_123

# Endereços permitidos no CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Configurações de E-mail / SMTP (Autenticação 2FA via Gmail)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SMTP_AUTH=true
MAIL_SMTP_STARTTLS=true
MAIL_USERNAME=seu_email_remetente@gmail.com
MAIL_PASSWORD=sua_senha_de_app_do_google
MAIL_FROM=seu_email_remetente@gmail.com
```

> **Aviso de Segurança:** O arquivo `.env` contém credenciais e **nunca** deve ser versionado no Git. Ele já está listado no `.gitignore`.

---

### Passo 3 — Executar o Backend (Spring Boot)
Abra um terminal na raiz do projeto:
```powershell
# Windows PowerShell
cd backend
.\mvnw.cmd spring-boot:run
```
```bash
# Linux / macOS
cd backend
./mvnw spring-boot:run
```
O backend carregará o perfil padrão, o Flyway aplicará automaticamente as migrações no banco Neon e o servidor estará disponível em `http://localhost:8080`.

* Health check público: `http://localhost:8080/api/health`
* Swagger UI (apenas em ambiente de desenvolvimento): `http://localhost:8080/swagger-ui/index.html`

---

### Passo 4 — Executar o Frontend (Next.js)
Abra outro terminal na raiz do projeto:
```powershell
cd frontend
npm install
npm run dev
```
A interface gráfica estará acessível em: `http://localhost:3000`.

> O Next.js possui rewrite configurado para redirecionar chamadas de `/api/*` diretamente para o backend na porta 8080. Mantenha os dois serviços em execução simultânea.

---

### Executando os Testes Automatizados

* **Backend (477 testes):**
  ```powershell
  cd backend
  .\mvnw.cmd clean test
  ```
* **Frontend (306 testes):**
  ```powershell
  cd frontend
  npm test
  ```
* **Validação de Tipagem TypeScript:**
  ```powershell
  cd frontend
  npx tsc --noEmit
  ```
* **Linter:**
  ```powershell
  cd frontend
  npm run lint
  ```

---

## 📊 Status do Projeto

* **Estágio Atual:** Homologação e Preparação para Produção (Hardening de Segurança e Isolamento Sanitário de Testes Concluídos).
* **Branch Principal:** `main`
* **Commit de Baseline:** `e0beb46`
* **Estabilidade:** 783 testes automatizados com 100% de aprovação (0 falhas).
* **Integridade Operacional:** Provedor único de e-mail padronizado via SMTP Gmail; purga total de resíduos legados do Microsoft Graph e do módulo fiscal; refresh tokens com hashing SHA-256 e controle de concorrência com locks pessimistas.

---

## 📄 Licença e Uso

Projeto desenvolvido para gestão de oficina técnica industrial. Todos os direitos reservados.
