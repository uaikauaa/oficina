# Qualidade, dependências e governança

Revisão focal de autenticação, controllers administrativos, migrations, proxy e fluxos operacionais; não há alegação de revisão linha a linha de todo o repositório. `JwtService` deixou de usar ThreadLocal no #30 e recebe sessionId explícito, reduzindo estado implícito. O backend preserva transações no service de recuperação/convite e constraints no PostgreSQL; as operações de OS/estoque mais críticas têm testes de persistência. Falta perfil de concorrência/carga para todos os módulos e análise N+1 em produção. Não refatorar serviços amplos sem defeito reproduzido.

Frontend: `npm ci`, 379 testes, TypeScript, ESLint e build passaram nesta branch; Playwright registra o único bug de foco corrigido. `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades; audit completo: 7 moderadas de ferramentas de desenvolvimento, 0 altas/críticas. Não houve atualização arbitrária de frameworks. CI do SHA funcional `578af98` aprovou Gitleaks histórico e Trivy/SBOM; o estado do head documental final deve ser verificado nos checks do PR #31.

Licenças e dependências Java foram inventariadas indiretamente pelo SBOM CI, sem parecer jurídico de compatibilidade de todas as licenças. Não há evidência para recomendar Redis, Terraform, WAF ou outro serviço pago. Custos e IAM Cloud Run permanecem gates operacionais, não mudanças desta branch.

Governança: `AGENTS.md` raiz define arquitetura e exige commit/push; `frontend/AGENTS.md` alerta sobre documentação específica do Next instalado. `SECURITY.md` é exclusivo do PR #26, que não foi incorporado nem aprovado por herança. Nenhum review thread/comentário Codex apareceu na consulta do conector para #17–#30; isso não substitui revisão independente.
