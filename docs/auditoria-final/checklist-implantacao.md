# Checklist ordenado — não executado na nuvem

**Não executar deploy/merge com base apenas neste documento.** Obter aprovação explícita para a implantação após revisão do PR e evidências de homologação. Nenhum comando abaixo autoriza acesso ao Neon de produção.

1. [ ] Revisar PR #10 e PR da auditoria separadamente, conferir os SHAs e CI. Resolver/aceitar formalmente os riscos de `vulnerabilidades.md`; manter NO-GO enquanto faltarem requisitos essenciais.
2. [ ] Selecionar projeto, região e orçamento. Registrar estimativa de compute, rede, build, registry, secrets, logs, Neon e SMTP; configurar alertas/cotas antes de publicar endpoints.
3. [ ] Criar ambiente Neon de homologação com dados sintéticos e credenciais próprias. Conferir versão PostgreSQL, limite de conexões, latência e estratégia de backup. Não reutilizar segredo de produção.
4. [ ] Restaurar backup em banco separado e medir RPO/RTO; comparar checksums Flyway. Não usar `repair`, `clean`, baseline ou DDL manual para contornar falhas desconhecidas.
5. [ ] Revisar contas de serviço e IAM. Separar frontend/backend/CI, restringir Secret Accessor por segredo, Registry privado e invoker por serviço. Configurar WIF/OIDC sem chave JSON e com condições de repo/ref/environment.
6. [ ] Registrar versões dos secrets no Secret Manager. Validar JWT forte e único, SMTP autenticado com STARTTLS obrigatório/hostname validado, JDBC verify-full com CA confiável. Verificar conexão sem registrar valores sensíveis.
7. [ ] Decidir backend público versus IAM. Com rewrite atual, IAM privado ainda exige implementação de proxy autenticado. Se público, concluir limitação de abuso e testes diretos antes de aceitar tráfego.
8. [ ] Construir backend do commit revisado, escanear a imagem exata e registrar digest. Validar `prod`, cookies Secure, OpenAPI desligado, porta, startup, shutdown e pool calculado para número máximo de instâncias/revisões.
9. [ ] Com autorização, publicar backend de **homologação**, inicialmente sem dados sensíveis; validar logs, probe, TLS Neon, SMTP, cold start, suspensão/reconexão e Flyway. Testar acesso direto anônimo e de papel inadequado.
10. [ ] Usar a URL HTTPS real do backend como `_BACKEND_URL` no build frontend. Não incluir secrets no build. Escanear imagem standalone, registrar digest e confirmar que a origem do manifesto corresponde ao ambiente.
11. [ ] Com autorização, publicar frontend de homologação; runtime INTERNAL_BACKEND_URL deve coincidir com o build ou ficar ausente. Confirmar assets, SSR, manifesto, ícones e `/api/auth/csrf`.
12. [ ] Definir CORS com origem HTTPS exata do frontend, sem wildcard, userinfo, caminho, query ou barra final. Verificar headers reais pelo navegador, incluindo Set-Cookie, HttpOnly, Secure, SameSite e ausência de Domain amplo.
13. [ ] Executar fluxo completo 2FA → dados → estoque → OS → PDFs → refresh → logout. Testar expiração, troca de senha, revogação, duas abas e refresh concorrente. Não copiar cookies/códigos para relatório.
14. [ ] Executar testes negativos limitados em homologação: CSRF, CORS hostil, papel inadequado, IDs/vínculos divergentes, métodos/content-types, mass assignment, SQLi/XSS, limites de tamanho/tempo. Confirmar 401/403/404/429/500 sem stacktrace e sem cache de dados sensíveis.
15. [ ] Medir memória sob PDFs/relatórios concorrentes, startup, CPU, pool, fila, p95 e timeouts. Testar SIGTERM com trabalho em andamento e rollback de revisão. Confirmar política de liveness que não amplifique falha externa.
16. [ ] Verificar domínios HTTPS/PWA no dispositivo real, ausência de tokens no bundle/storage/logs e comportamento offline. Não adicionar cache de `/api` ou documentos privados para “fazer PWA funcionar”.
17. [ ] Conferir alertas, acesso a logs, retenção de imagens/backups, remoção de senha de bootstrap e agendamento externo da manutenção que não pode depender de instância ativa.
18. [ ] Registrar evidência por requisito, responsável e data; fechar bloqueadores e emitir novo veredito. Só então solicitar aprovação final para promoção a produção por digest, com backup e rollback preparados.

## Consultas de verificação (somente quando houver acesso autorizado)

Use o Console ou comandos que mostrem apenas metadados necessários. Evite imprimir `spec`/variáveis completas, pois uma configuração incorreta pode conter secrets em texto.

```powershell
# Valores abaixo são identificadores, não credenciais.
gcloud run services describe oficina-backend --region=$REGION --format="value(status.url)"
gcloud run services get-iam-policy oficina-backend --region=$REGION
gcloud run services get-iam-policy oficina-frontend --region=$REGION
gcloud artifacts repositories get-iam-policy $REPO --location=$REGION
gcloud secrets get-iam-policy oficina-db-password
gcloud iam service-accounts keys list --iam-account=$BACKEND_SERVICE_ACCOUNT
```

Exportar somente resultados sanitizados e registrar quais controles foram de fato comprovados. Os comandos de escrita/deploy do guia original continuam sujeitos à aprovação do usuário.
