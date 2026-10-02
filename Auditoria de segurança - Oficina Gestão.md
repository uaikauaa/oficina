# Auditoria de Segurança — Oficina Gestão

**Data:** 26 de setembro de 2026  
**Escopo:** código original do WebApp, sem considerar Docker nem a configuração local de PostgreSQL.

## Resumo executivo

A análise encontrou riscos principalmente no fluxo de autenticação, na confiança em cabeçalhos de proxy e em dependências desatualizadas. Não foram encontrados indícios de SQL injection, execução arbitrária de comandos, uso de `eval`, uso de `dangerouslySetInnerHTML`, chaves privadas ou credenciais reais versionadas.

## Vulnerabilidades encontradas

### 1. Alta — segredo JWT padrão conhecido

O arquivo `backend/src/main/resources/application.properties` possui uma chave JWT padrão. Se a aplicação for publicada sem definir `JWT_SECRET` e sem que o ambiente seja reconhecido explicitamente como produção, essa chave será utilizada.

Quem conhece o código pode fabricar um token com a autoridade `ROLE_ADMIN`. A detecção de produção depende dos profiles `prod` ou `production`, ou de variáveis específicas do Render e Railway, deixando outras formas de implantação sujeitas a configuração insegura.

**Correção recomendada:** remover o valor padrão, tornar `JWT_SECRET` obrigatório em todos os ambientes fora de testes e utilizar uma chave aleatória com pelo menos 256 bits.

### 2. Média — bloqueio deliberado da conta

O serviço de login bloqueia um endereço de e-mail durante 15 minutos após cinco tentativas incorretas. Um atacante que conheça o e-mail administrativo pode repetir tentativas inválidas e manter a conta bloqueada continuamente, mesmo alternando o endereço IP.

**Correção recomendada:** utilizar atraso progressivo, limitar principalmente por IP/dispositivo e evitar bloqueio rígido de conta provocado apenas por requisições não autenticadas.

### 3. Média — falsificação do endereço IP

O backend confia diretamente nos cabeçalhos `CF-Connecting-IP`, `X-Real-IP` e `X-Forwarded-For`. Não é verificado se a conexão realmente veio de um proxy confiável.

Um cliente pode enviar esses cabeçalhos manualmente para falsificar o endereço registrado, contornar parte do rate limit e inserir dados incorretos nos registros de auditoria.

**Correção recomendada:** aceitar cabeçalhos encaminhados somente quando `request.getRemoteAddr()` pertencer a uma lista de proxies confiáveis. Caso contrário, usar exclusivamente o endereço remoto da conexão.

### 4. Média — concorrência na rotação do refresh token

A consulta e a revogação do refresh token não utilizam bloqueio pessimista, versionamento ou uma atualização atômica. Duas requisições simultâneas podem validar o mesmo token antes da revogação e criar duas novas sessões.

**Correção recomendada:** consumir o token atomicamente, usando bloqueio de linha, versionamento otimista ou uma operação condicional que somente revogue tokens ainda ativos.

### 5. Baixa — enumeração de usuários pelo tempo da resposta

Quando um e-mail não existe, a verificação BCrypt não é executada. Quando existe, a operação custosa é realizada. Apesar de a mensagem HTTP ser igual, a diferença de latência pode permitir identificar contas cadastradas.

**Correção recomendada:** executar uma comparação BCrypt contra um hash fictício quando o usuário não for encontrado.

### 6. Baixa — proteção CSRF desabilitada

O Spring Security desabilita completamente a proteção CSRF, embora a autenticação também seja transportada por cookies. `SameSite`, CORS e o uso de JSON reduzem a exposição, mas não substituem integralmente uma proteção explícita.

**Correção recomendada:** validar o cabeçalho `Origin` nos endpoints mutáveis ou habilitar um token CSRF compatível com a aplicação frontend.

### 7. Baixa — access token continua válido após logout ou troca de senha

O logout e a troca de senha revogam os refresh tokens, mas não invalidam imediatamente o JWT de acesso. Uma cópia desse token continua funcionando até o prazo de expiração, atualmente de aproximadamente 15 minutos.

**Correção recomendada:** aceitar formalmente a janela curta de risco ou implementar uma versão de sessão/usuário verificada pelo backend para invalidação imediata.

### 8. Dependências desatualizadas

- **Next.js 16.3.5:** pertence a uma faixa afetada por uma vulnerabilidade crítica de execução remota corrigida na versão 16.3.6. O projeto não utiliza atualmente a API vulnerável `next/og ImageResponse`, reduzindo a exposição direta.
- **Spring Boot 3.4.3 / Spring WebMVC 6.2.3:** possuem alertas de segurança publicados posteriormente. Vários dependem de recursos estáticos, JSP ou templates que não foram encontrados no projeto, mas as versões devem ser atualizadas.

**Correção recomendada:** atualizar o Next.js para pelo menos 16.3.6 e adotar uma versão mantida do Spring Boot cujo BOM forneça Spring Framework 6.2.19 ou superior, executando todos os testes depois da atualização.

## Ordem recomendada de correção

1. Remover o segredo JWT padrão e exigir configuração segura.
2. Corrigir a confiança nos cabeçalhos de IP e o mecanismo de bloqueio de login.
3. Tornar a rotação de refresh tokens atômica.
4. Atualizar Next.js e Spring Boot/Spring Framework.
5. Uniformizar o tempo do login e reforçar CSRF e invalidação de sessões.

## Itens que não foram encontrados

- SQL injection evidente.
- Execução de comandos do sistema a partir de entrada do usuário.
- Uso de `eval` ou `dangerouslySetInnerHTML`.
- Tokens armazenados no `localStorage`.
- Chaves privadas ou credenciais reais versionadas.
- Endpoints de negócio públicos sem exigência de `ROLE_ADMIN`.

---

## Status das Correções e Hardening (Outubro de 2026)

Todas as 8 vulnerabilidades identificadas nesta auditoria foram integralmente tratadas, homologadas e consolidadas nos commits `b5c6037` e `e0beb46`:

1. **Item 1 (JWT sem valor padrão em produção - SEC-01):** `ProductionSecurityValidator` implementado; o Spring Boot aborta o startup em produção se `JWT_SECRET` for nulo, vazio ou default.
2. **Item 2 (Rate limit DoS e bloqueio de conta - SEC-02):** Implementada chave composta dupla (IP e IP+Email), com scheduler de limpeza e desalocação por eviction.
3. **Item 3 (Falsificação de IP / Spoofing - SEC-03):** `IpAddressResolver` aceita `X-Forwarded-For` e `CF-Connecting-IP` estritamente a partir de proxies explicitamente listados em `TRUSTED_PROXIES`.
4. **Item 4 (Concorrência no Refresh Token - SEC-04):** Adicionado bloqueio pessimista (`PESSIMISTIC_WRITE`) na consulta de refresh tokens no PostgreSQL Neon.
5. **Item 5 (Enumeração de Usuários por Timing - SEC-05):** `DUMMY_PASSWORD_HASH` implementado para equalizar o tempo de comparação de senhas via BCrypt mesmo quando o usuário não existe.
6. **Item 6 (CORS e Headers - SEC-06):** CORS restrito com validação fail-fast em produção e `allowedHeaders` configurados estritamente para `Content-Type` e `Authorization`.
7. **Item 7 (Invalidação Imediata de Sessões - SEC-07):** Adicionado `tokenVersion` por usuário na tabela `usuarios` (migration V20) e no payload JWT; qualquer logout ou alteração de senha invalida instantaneamente todos os tokens ativos.
8. **Item 8 (Atualização de Dependências - SEC-08):** Next.js atualizado para `16.3.8` e Spring Boot para `3.4.13` (com Spring Framework `6.2.19`).

### Riscos Residuais Conhecidos e Documentados:
* **CSP (`unsafe-inline`):** Mantido para dar suporte aos estilos injetados e aos scripts de hidratação do framework Next.js/React. Não foram encontrados usos de `eval`, `new Function` ou `dangerouslySetInnerHTML`.
