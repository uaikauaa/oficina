import assert from 'node:assert/strict';
export const PROJECT_ID = 'oficinagestao-homologacao';
export const PROJECT_NUMBER = '193690344577';
export const REGION = 'us-central1';
export const accounts = Object.fromEntries(['frontend', 'backend', 'denied'].map(role => [role,
  `oficina-${role}-hml@${PROJECT_ID}.iam.gserviceaccount.com`]));

export function assertApprovedTarget(env) {
  assert.equal(env.HML_ISOLATED, 'true', 'Confirme isolamento de homologação');
  assert.equal(env.HML_PROJECT, PROJECT_ID, 'Projeto não autorizado');
  assert.equal(env.HML_PROJECT_NUMBER, PROJECT_NUMBER, 'Número de projeto não autorizado');
  assert.equal(env.HML_REGION, REGION, 'Região de homologação não autorizada');
  assert.notEqual(env.NODE_TLS_REJECT_UNAUTHORIZED, '0', 'TLS obrigatório');
}

export function assertProjectMetadata(project) {
  assert.equal(project.projectId, PROJECT_ID);
  assert.equal(String(project.projectNumber), PROJECT_NUMBER);
  assert.equal(project.lifecycleState, 'ACTIVE');
}

export function assertServiceMetadata(service, role) {
  assert.ok(['frontend', 'backend'].includes(role));
  assert.equal(service.metadata?.labels?.environment, 'homologation');
  assert.equal(service.metadata?.labels?.app, 'oficina-gestao');
  assert.equal(service.spec?.template?.spec?.serviceAccountName, accounts[role]);
  assert.equal(service.metadata?.labels?.['cloud.googleapis.com/location'], REGION);
  assert.equal(service.metadata?.annotations?.['run.googleapis.com/maxScale'], '1', 'Limite máximo deve ser do serviço');
  assert.ok([undefined, '0'].includes(service.metadata?.annotations?.['run.googleapis.com/minScale']), 'Sem mínimo permanentemente ativo');
  assert.ok(Number(service.spec?.template?.spec?.containerConcurrency) >= 1
    && Number(service.spec?.template?.spec?.containerConcurrency) <= (role === 'backend' ? 2 : 4), 'Concorrência acima do limite inicial');
  assert.match(service.status?.url || '', /^https:\/\/[a-z0-9.-]+\.run\.app$/);
  const variables = service.spec?.template?.spec?.containers?.[0]?.env || [];
  const value = name => variables.find(entry => entry.name === name)?.value;
  const secret = name => variables.find(entry => entry.name === name)?.valueFrom?.secretKeyRef;
  const requiredSecrets = role === 'backend' ? ['DB_PASSWORD', 'JWT_SECRET', 'RATE_LIMIT_SECRET', 'SERVICE_PROXY_SECRET', 'MAIL_PASSWORD']
    : ['SERVICE_PROXY_SECRET', 'FIREBASE_SESSION_SECRET'];
  if (role === 'backend' && variables.some(entry => entry.name === 'INITIAL_ADMIN_PASSWORD')) requiredSecrets.push('INITIAL_ADMIN_PASSWORD');
  for (const name of requiredSecrets) {
    const reference = secret(name);
    assert.equal(reference?.name, name, 'Segredos devem ter referências exclusivas por finalidade');
    assert.match(reference?.key || '', /^[1-9][0-9]*$/, 'Exigida versão numérica do segredo');
    assert.ok(value(name) === undefined, 'Segredo em variável pública é proibido');
  }
  if (role === 'frontend') {
    assert.equal(value('FIREBASE_HOSTING_MODE'), 'true');
    assert.equal(value('CLOUD_RUN_IAM'), 'true');
    for (const entry of variables) assert.ok(!/^(DB_|NEON_|JWT_SECRET$|RATE_LIMIT_SECRET$|MAIL_|INITIAL_ADMIN_)/.test(entry.name), 'Credencial backend no frontend');
  } else {
    assert.equal(value('SPRING_PROFILES_ACTIVE'), 'prod');
    assert.equal(value('APP_ENVIRONMENT'), 'homologation');
    assert.equal(value('SECURITY_COOKIE_SECURE'), 'true');
    assert.equal(value('HML_NEON_ISOLATED'), 'true');
    assert.equal(value('HML_DB_NAME'), 'oficina_security_test');
    assert.equal(value('HML_DB_USER'), 'oficina_security_test_owner');
    assert.equal(value('DB_USERNAME'), 'oficina_security_test_owner');
    assert.equal(value('HML_MIGRATIONS_APPROVED'), 'true', 'Serviço inicializado exige autorização prévia de migration');
    const host = value('HML_DB_HOST') || '';
    assert.ok(/^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)*\.sa-east-1\.aws\.neon\.tech$/.test(host) && !host.includes('-pooler'), 'Exigido hostname direto Neon em sa-east-1');
    assert.ok(value('DB_URL') === `jdbc:postgresql://${host}:5432/oficina_security_test?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory&channelBinding=require`, 'JDBC isolado deve corresponder ao hostname aprovado e TLS validado');
  }
}
