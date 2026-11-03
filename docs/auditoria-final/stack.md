# Linguagens, frameworks e versões observadas

Inventário do código e das dependências resolvidas em 30/10/2026. A lista completa, inclusive transitivas, está em [dependencias.json](dependencias.json). Versão instalada e faixa declarada no manifesto não são equivalentes.

| Camada | Tecnologia | Versão efetiva |
|---|---|---|
| Linguagem backend | Java | 21; host 21.0.12.1, imagem Temurin 21.0.13 |
| Framework backend | Spring Boot | 3.4.13 |
| REST e infraestrutura | Spring Framework / Web MVC | 6.2.19 |
| Autenticação/autorização | Spring Security | 6.4.13 |
| Persistência | Spring Data JPA / Commons | 3.4.13 |
| ORM | Hibernate ORM | 6.6.39.Final |
| Migrations SQL | Flyway embarcado | 10.20.1; workflow de validação usa CLI 11 |
| Banco SQL | PostgreSQL | 16.15 local; versão do Neon real não consultada |
| Driver JDBC | PostgreSQL JDBC | 42.7.12 |
| Servlet HTTP | Tomcat embarcado | 10.1.61 |
| JSON | Jackson BOM | 2.18.11 |
| Tokens | JJWT | 0.12.6 |
| Documentação API | springdoc OpenAPI | 2.8.5 |
| PDF | OpenPDF | 2.0.3 |
| Logs | Logback / Log4j2 | 1.5.34 / 2.25.5 |
| Linguagem frontend | TypeScript | 5.9.3 |
| Framework web | Next.js App Router | 16.4.1 |
| Interface | React / React DOM | 19.2.8 |
| Estilos CSS | Tailwind CSS / plugin PostCSS | 4.3.3 |
| Formulários | React Hook Form / resolvers | 7.88.0 / 5.9.1 |
| Validação frontend | Zod | 4.6.6 |
| Ícones | lucide-react | 1.46.0 |
| Imagens | sharp | 0.35.5 |
| Runtime JavaScript | Node.js | host 24.21.0; imagem 22.23.4 |
| Gerenciador frontend | npm | host 11.19.0; removido do runner final |
| Testes de navegador | Playwright | 1.63.0 |
| Lint | ESLint / eslint-config-next | 9.39.5 / 16.4.1 |
| Build Java | Maven | wrapper 3.9.16; builder Docker 3.9.11 |
| Containers | Docker / Alpine runner frontend | 29.8.0 / 3.24.3 |
| Scanner | Trivy | 0.76.1 |

Há JavaScript em scripts `.mjs`, TypeScript/TSX no frontend, HTML produzido por JSX, CSS e SQL PostgreSQL nas migrations. PowerShell e shell/Bash apoiam automação. JSON, YAML, XML, Markdown e Dockerfile são formatos/configurações; não possuem uma versão de linguagem instalada comparável ao JDK. O compilador TypeScript define o alvo JavaScript no `tsconfig.json`.

**TanStack Query consta da arquitetura oficial, mas não está instalado nem utilizado nesta versão.** O cliente HTTP e a gestão de sessão são implementados no código local. Esta auditoria não adicionou uma biblioteca sem necessidade funcional.

O backend também usa Jakarta Validation, Hibernate Validator, HikariCP, Actuator e Angus Mail; suas versões exatas e as bibliotecas de teste JUnit/Mockito estão na árvore Maven do inventário. O frontend não acessa PostgreSQL: browser → Next → REST Spring Boot → banco. Não há JavaFX/FXML ou aplicação desktop.
