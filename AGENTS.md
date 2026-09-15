# AGENTS.md — Diretrizes e Regras do Projeto "Oficina Gestão"

Este documento define as regras fundamentais, restrições arquiteturais e padrões de trabalho para todos os agentes de IA e desenvolvedores que atuam no projeto **Oficina Gestão**.

---

## Regras Fundamentais do Projeto

1. **Arquitetura WebApp Exclusiva**: O projeto é exclusivamente um WebApp. Não implementar JavaFX, FXML, Scene Builder, jpackage ou qualquer arquitetura desktop.
2. **Frontend Oficial**: A stack do frontend é Next.js (App Router), React, TypeScript, Tailwind CSS, TanStack Query, React Hook Form e Zod.
3. **Backend Oficial**: A stack do backend é Java 21, Spring Boot (Spring Web, Spring Security, Spring Data JPA, Hibernate, Flyway, Jakarta Validation, OpenAPI).
4. **Banco de Dados Oficial**: PostgreSQL hospedado no Neon.
5. **Isolamento do Banco de Dados**: O frontend **NUNCA** deve acessar o banco de dados diretamente. Toda comunicação passa pela API REST/JSON do Spring Boot.
6. **Segurança e Gestão de Secrets**: Segredos, tokens e credenciais **NUNCA** devem ser expostos no frontend ou commitados no Git. Utilizar variáveis de ambiente (.env local não versionado).
7. **Versionamento de Banco via Migrations**: Todas as alterações no banco de dados devem ser realizadas exclusivamente através de migrations do Flyway.
8. **Regras de Negócio no Backend**: Todas as regras de negócio críticas e validações de domínio devem permanecer estritamente no backend.
9. **Controle de Dependências**: Não adicionar tecnologias, bibliotecas ou dependências que não estejam previstas na arquitetura sem justificativa técnica explícita.
10. **Aderência ao Roadmap**: Não implementar funcionalidades fora do roadmap definido (respeitar escopo de cada fase).
11. **Granularidade de Tarefas**: Trabalhar em tarefas pequenas, modulares e verificáveis passo a passo.
12. **Garantia de Qualidade e Testes**: Executar builds e testes automatizados após alterações relevantes no código.
13. **Versionamento e Commits Contínuos**: A cada prompt/tarefa concluída, realizar o commit das alterações realizadas e enviar (`git push`) para o repositório oficial `https://github.com/uaikauaa/oficina`.

---

## Fluxo de Comunicação Arquitetural

```
Browser
   ↓
Next.js (Frontend)
   ↓ REST / JSON
Spring Boot (Backend)
   ↓
PostgreSQL / Neon (Database)
```
