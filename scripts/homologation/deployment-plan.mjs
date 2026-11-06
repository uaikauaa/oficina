// Pure argv preparation. No subprocess or network; the caller must separately approve execution.
import assert from 'node:assert/strict';
import { PROJECT_ID, REGION, accounts, assertApprovedTarget } from './cloud-target.mjs';
export function deploymentPlan(settings) {
  assertApprovedTarget(settings);
  const image = role => {
    const value = settings[`HML_${role.toUpperCase()}_IMAGE`] || '';
    assert.ok(new RegExp(`^us-central1-docker\\.pkg\\.dev/${PROJECT_ID}/[a-z][a-z0-9-]*/${role}@sha256:[a-f0-9]{64}$`).test(value), 'Imagem exige registry/projeto aprovados e digest imutável');
    return value;
  };
  const names = { backend: ['DB_PASSWORD', 'JWT_SECRET', 'RATE_LIMIT_SECRET', 'SERVICE_PROXY_SECRET', 'MAIL_PASSWORD'], frontend: ['SERVICE_PROXY_SECRET', 'FIREBASE_SESSION_SECRET'] };
  const version = name => {
    const value = settings[`HML_${name}_VERSION`] || '';
    assert.ok(/^[1-9][0-9]*$/.test(value), 'Exigidas versões numéricas aprovadas dos segredos');
    return value;
  };
  const services = Object.fromEntries(['backend', 'frontend'].map(role => [role, [
    'run', 'deploy', `oficina-${role}-hml`, '--project=' + PROJECT_ID, '--region=' + REGION,
    '--image=' + image(role), '--service-account=' + accounts[role], '--port=' + (role === 'backend' ? '8080' : '3000'),
    '--min=0', '--max=1', '--cpu=1', '--memory=' + (role === 'backend' ? '1Gi' : '512Mi'),
    '--concurrency=' + (role === 'backend' ? '2' : '4'), '--timeout=60', '--cpu-throttling',
    '--labels=app=oficina-gestao,environment=homologation',
    '--env-vars-file=.env.cloud.' + role + '.local',
    '--set-secrets=' + names[role].map(name => `${name}=${name}:${version(name)}`).join(','),
    role === 'backend' ? '--no-allow-unauthenticated' : '--allow-unauthenticated', '--quiet',
  ]]));
  return { project: PROJECT_ID, region: REGION, executed: false, publicImpactRequiresApproval: true, commands: services,
    backendInvokerAfterCreation: ['run', 'services', 'add-iam-policy-binding', 'oficina-backend-hml', '--project=' + PROJECT_ID,
      '--region=' + REGION, '--member=serviceAccount:' + accounts.frontend, '--role=roles/run.invoker'],
    rollback: 'Use previous approved image digests and numeric secret versions; no schema rollback or destructive SQL.' };
}
