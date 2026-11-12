# Etapa 4 — plano operacional, sem execução

> Atualização 12/11/2026: o procedimento detalhado vigente está em [Etapa 4A — runbook Neon](stage4a-neon-runbook.md). O provisionamento será exclusivamente por convite, com senha definida pelo titular e login 2FA; não entregar senha inicial. A transição da Geisa preserva o registro, mas o fluxo oficial revoga sessões e exige novo login. Este plano anterior permanece como histórico.

Este documento descreve a ativação futura do banco Neon original. A Etapa 3.3 não executa nenhuma ação nele, não cria contas reais e não altera o acesso da Geisa.

## Pré-condições e autorização

1. Aprovar o resultado da homologação isolada, incluindo matriz de papéis, recuperação, SMTP, ingress/IAM, TLS e restauração. Manter o PR em draft até os gates aprovados.
2. Registrar responsáveis, janela, canal de incidente, critérios de parada, duração máxima e autorização explícita para a operação no ambiente original. Inventariar versões atuais, schema, extensões, grants e conexões sem exportar dados pessoais para o repositório.
3. Confirmar limites de custo e permissões mínimas de Cloud Run, Secret Manager e Neon. Separar identidade de aplicação, operação e backup.

## Cópia de segurança e ensaio

1. Verificar snapshot/PITR do Neon e executar dump cifrado antes da primeira mudança. Registrar timestamp, versão PostgreSQL, checksum, tamanho e local de custódia fora do Git.
2. Restaurar a cópia em banco descartável com acesso restrito. Comparar contagens e checksums de tabelas selecionadas, constraints e capacidade de login de contas sintéticas sem enviar e-mail a pessoas reais.
3. Medir duração de backup e restore. Se não houver restauração validada, interromper a ativação.

## Configuração privada

1. Criar versões independentes de `DB_PASSWORD`, `JWT_SECRET`, `RATE_LIMIT_SECRET`, `SERVICE_PROXY_SECRET`, `INVITE_OUTBOX_KEYS` e credenciais SMTP no Secret Manager. Conceder acesso somente às identidades que precisam de cada segredo; frontend recebe apenas contexto de proxy e URL privada do backend.
2. Configurar `DB_URL` com host original validado, `sslmode=verify-full` e CA confiável. Testar recusa de CA e hostname incorretos. Não usar `sslmode=require` como substituto. Confirmar `APP_PUBLIC_URL`, `MAIL_FROM`, STARTTLS obrigatório, cookies Secure, CORS exato, `TRUSTED_PROXY_HOPS` e expiração de recuperação.
3. Definir alertas, logs sem URLs sensíveis, retenção de auditoria e runbook de rotação. Não colocar segredos em `.env`, imagem, CI output, comentário ou PR.

## Migração e provisionamento

1. Obter janela de manutenção e impedir escritas concorrentes durante avaliação do schema. Registrar versão Flyway e checksums antes da execução. Aplicar apenas migrations incrementais pendentes com uma instância migradora; verificar efeitos e row counts após cada passo.
2. Provisionar a conta principal pelo fluxo aprovado, com identidade e e-mail reais confirmados fora do Git, senha inicial entregue por canal seguro e 2FA validado. Remover a referência de bootstrap imediatamente.
3. Conferir permissões atuais da Geisa antes de qualquer transição. Planejar a mudança mínima e reversível, colher aprovação específica, executar somente após a conta principal estar funcional e verificar acesso operacional e administrativo de ambas as contas. Não remover acesso da Geisa por suposição.
4. Validar convite, recuperação, sessões, operações essenciais, relatório PDF/CSV, auditoria e envio SMTP controlado. Registrar evidências sanitizadas.

## Parada e rollback

- Parar se a cópia falhar, o TLS não validar, a migration divergir, o 2FA/SMTP falhar, a conta principal não entrar, ou houver regressão de permissões/dados.
- Para erro de configuração, voltar à revisão anterior e às versões anteriores dos segredos conforme runbook. Para erro de dados/schema, suspender escritas e restaurar o snapshot validado; migrations destrutivas não têm rollback SQL implícito.
- Antes de reabrir tráfego, comparar integridade, contagens, acesso da Geisa, conta principal e trilha de auditoria. Registrar incidente e decisão de continuidade.

Nenhuma destas ações está autorizada ou executada pela Etapa 3.3.
