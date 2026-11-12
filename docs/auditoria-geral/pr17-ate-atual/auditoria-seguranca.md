# Segurança, autenticação e recuperação

Revisão direta da candidata #30 mais correções desta branch. Escopo: `SecurityConfig`, `JwtAuthenticationFilter`, `JwtService`, `AuthService`, `PasswordRecoveryService`, `InviteService`, `InviteOutbox`, proxy Next, propriedades e testes. Teste sintético aprovado não comprova ambiente real.

| Fronteira | Evidência e veredito |
|---|---|
| Login/2FA | `AuthService` só emite access/refresh após desafio verificado; desafios expiram, limitam tentativa e replay. Testes `ProductionSessionParityIntegrationTest`, suíte real anterior e regressão atual. **Parcial**: SMTP/conta real fora do escopo. |
| Senha | BCrypt e `PasswordPolicyValidator`; bootstrap legado só cria em banco sem usuários, mas ainda é escritor de startup. Nunca habilitar `INITIAL_ADMIN_*` no original. **Parcial**. |
| JWT | Assinatura/expiração e `token_version` são conferidos. Filtro consulta sessão persistida e grants atuais por request. O override `legacy-sessionless-allowed=true` permitia JWT sem sessão; produção agora só aceita `false` no valor efetivo, cobrindo aliases booleanos. **Aprovado no código/teste isolado**. |
| Refresh/revogação | `sessionId` explícito no 2FA/refresh; família rotacionada, replay rejeitado, revogação de A preserva B e persiste após nova JVM com mesma chave. Evidência Stage 4A e testes atuais. **Aprovado sinteticamente**. |
| RBAC/objeto | `SecurityConfig` cobre rota/permissão; grants atuais no banco, minimização CONSULTA e testes de rota. Operações por objeto requerem ampliar testes de IDOR/BOLA além dos fluxos existentes. **Parcial**. |
| HTTP/proxy | CSRF por header/cookie, CORS estrito em produção, cookies HttpOnly/Secure/SameSite e allowlist de headers no proxy. Proxy recusa path ambíguo e redirect externo; IAM usa identidade Google separada. CSP vem da camada Next; validar cabeçalhos no destino real. **Parcial**. |
| CSV/PDF | Testes existentes verificam assinatura PDF, autorização e CSV operacional; revisar neutralização de fórmulas e minimização com todos os exportadores antes do GO. **Parcial**. |
| Segredos | CI do #30: Gitleaks 8.30.1 em `--all` com saída redigida; Trivy secrets/SBOM e npm audit altos/críticos verdes. Isso reduz risco, mas não prova rotação de eventual segredo exposto. Configuração privada examinada somente por presença/booleans. **Parcial**. |

## REC-01 — distinção temporal comprovada

`PasswordRecoveryService.request` faz rate limit comum; só para usuário ativo executa `SELECT ... FOR UPDATE`, revoga reset/outbox, gera token, insere reset, cifra na outbox e audita. Etapa 4A: 120 pares sintéticos após warmup, diferença mediana 5,277 ms, IC95% [4,933; 5,514] ms. A diferença é observável no serviço. Resposta HTTP igual não resolve. Nenhum `sleep` ou fila volátil foi introduzido.

**Bloqueio aplicado:** `security.password-recovery.requests-enabled` tem default `false`; `PasswordRecoveryController` devolve 503 antes de consultar conta. `ProductionSecurityValidator` só aceita `false` em `prod`/`production`, inclusive override efetivo e aliases booleanos. Testes de regressão verificam 503 sem interação com o service, 202 no profile sintético e fail-fast em produção. `application-test.properties` e runner real habilitam o fluxo apenas em ambiente isolado; a conclusão de token já emitido continua disponível. A tela informa falha genérica. Risco residual: recuperação pública indisponível em produção até correção revisada. Não usar um profile de teste como produção.

**Alternativa futura a avaliar, sem implementação nesta etapa:** inserir solicitação uniformemente em fila transacional durável, cifrar identificador de destino, processar depois do commit com worker e política de retenção/abuso; garantir que inexistentes não gerem e-mail. Precisa manter uso único, expiração, rate limits distribuídos e múltiplas instâncias. Evitar fila em memória. Após implementar, testar endereço existente/inexistente/inativo/inválido, repetição/concorrência, SMTP 550/indisponível, reinício, expiração e replay. Medir pelo HTTP real em configuração equivalente à produção: protocolo predefinido, ordem aleatória, warmup, carga e rate limit controlados, no mínimo 2.000 pares por cenário; estimar AUC de classificador de existência com IC95%, aceitar somente se limite superior ≤0,60 e sem via auxiliar de enumeração. Um p-valor não significativo sozinho não basta. Até lá, **NO-GO para habilitar solicitações públicas**.

## Referências e limites

O inventário usa [OWASP ASVS](https://asvs.owasp.org/) e [OWASP API Security Top 10](https://owasp.github.io/www-project-api-security/) como guias de verificação, sem reivindicar certificação. Não houve pentest no Neon, IAM, DNS ou SMTP reais. Testes de autorização por objeto e carga HTTP temporal permanecem trabalho verificável antes da produção.
