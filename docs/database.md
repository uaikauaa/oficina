# Diretrizes de Banco de Dados — Oficina Gestão

## 1. Banco de Dados Oficial

- **Motor**: PostgreSQL
- **Hospedagem em Nuvem**: Neon (Serverless PostgreSQL)
- **Acesso**: Exclusivo pelo Backend (Spring Boot via Spring Data JPA / Hibernate)

---

## 2. Versionamento e Migrations (Flyway)

Nas fases de desenvolvimento de banco (a partir da Fase 1):
1. Todas as alterações estruturais (DDL) e cargas iniciais de sistema (DML) serão controladas exclusivamente pelo **Flyway**.
2. Nenhuma alteração manual será realizada diretamente no console do banco sem o respectivo script versionado.
3. Convenção de nomenclatura dos arquivos de migration:
   ```text
   V<Versão>__<descricao_em_snake_case>.sql
   Exemplo: V1__create_initial_tables.sql
   ```
4. Os arquivos de migration residirão no backend em `backend/src/main/resources/db/migration/` e espelhados para referência em `database/migrations/`.

---

## 3. Estado Atual (Fase 0)

- Nenhuma tabela, migration ou conexão ativa com banco de dados foi criada na Fase 0.
- A fundação foca na integridade do ambiente e na validação do ciclo de build e comunicação da aplicação.
