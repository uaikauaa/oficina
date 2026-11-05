# Triagem dos nove achados históricos

Data: 04/11/2026. Regra: `generic-api-key`, Gitleaks 8.30.1. Nenhum valor de chave/token foi reproduzido. Revisão do conteúdo e do uso no commit de origem, não apenas do nome do arquivo.

| # | Origem | Classificação e evidência de uso | Ação |
| --- | --- | --- | --- |
| 1 | `.env.example:27`, `e578fd5` | Instrução textual em português para gerar chave independente; placeholder, não material aleatório de credencial | Não usar como segredo. Nenhuma revogação de provedor aplicável |
| 2 | `.env.example:26`, `bdb4d04` | Instrução textual para gerar chave independente de rate limiting; placeholder | Mesma ação do #1 |
| 3 | `.github/workflows/oracle-readiness.yml:35`, `bdb4d04` | Valor explicitamente sintético de CI, usado em `docker compose config --quiet`; o job não implanta serviços operacionais | Exclusivo de validação; jamais promover para ambiente real |
| 4 | `TokenHashUtilTest.java:15`, `b5c6037` | UUID literal que entra em duas funções de hash e na comparação determinística; não foi obtido de emissor ou sessão | Fixture de teste, sem revogação externa |
| 5 | `sessionResilience.test.ts:434`, `b5c6037` | Challenge fictício retornado por substituição local de `global.fetch` | Fixture de resposta mockada, sem sessão real |
| 6 | `sessionResilience.test.ts:453`, `b5c6037` | A mesma fixture do #5 em uma asserção do consumidor | Não é outra credencial; nenhuma rotação externa |
| 7 | `RefreshTokenHashSecurityTest.java:334`, `b5c6037` | UUID de amostra usado em cálculo SHA-256 Java e PostgreSQL para comparar algoritmos; não representa refresh token emitido | Fixture computacional, sem revogação externa |
| 8 | `JwtServiceTest.java:128`, `eda78c2` | Chave propositalmente fraca passada ao construtor em teste negativo; o teste exige rejeição e ausência do valor no erro | Fixture inválida, sem rotação externa |
| 9 | `docs/api.md:59`, `f9926a8` | Exemplo de token truncado com reticências, sem JWT completo utilizável | Exemplo documental, sem sessão revogável |

Resultado: **nove ocorrências classificadas como placeholders/fixtures/exemplo, zero credenciais operacionais confirmadas**. Isso não comprova que um operador nunca tenha reutilizado uma fixture fora do repositório. Se qualquer valor público tiver sido reutilizado, considerá-lo comprometido: revogar sessões/refresh afetados, substituir a chave JWT, trocar a chave de proxy coordenadamente e rotacionar RATE_LIMIT_SECRET com drenagem/expiração das janelas V24. Credenciais de provedor reutilizadas exigem revogação no provedor. Nenhuma conta externa foi acessada, revogada ou rotacionada nesta tarefa.

`.gitleaksignore` registra somente os nove fingerprints exatos `commit:arquivo:regra:linha`. Não há exclusão de diretórios, regex ampla ou desativação da regra. Novos achados continuam a falhar a CI; os registros brutos do scan original permanecem documentados em [gitleaks-summary.json](evidencias/gitleaks-summary.json). As ocorrências antigas não foram apagadas do histórico Git.
