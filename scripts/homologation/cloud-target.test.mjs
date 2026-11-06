import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertApprovedTarget, assertProjectMetadata, assertServiceMetadata, PROJECT_ID, PROJECT_NUMBER, REGION, accounts } from './cloud-target.mjs';
import { validateHostingConfiguration } from './hosting-config.mjs';
import { spawnSync } from 'node:child_process';
import { deploymentPlan } from './deployment-plan.mjs';

const settings = { HML_ISOLATED: 'true', HML_PROJECT: PROJECT_ID, HML_PROJECT_NUMBER: PROJECT_NUMBER, HML_REGION: REGION };
const secret = name => ({ name, valueFrom: { secretKeyRef: { name, key: '1' } } });
const service = role => ({ metadata: { labels: { app: 'oficina-gestao', environment: 'homologation', 'cloud.googleapis.com/location': REGION }, annotations: { 'run.googleapis.com/maxScale': '1' } },
  status: { url: `https://oficina-${role}-hml-synthetic.us-central1.run.app` },
  spec: { template: { spec: { serviceAccountName: accounts[role], containerConcurrency: role === 'backend' ? 2 : 4, containers: [{ env: role === 'frontend'
    ? [...['SERVICE_PROXY_SECRET', 'FIREBASE_SESSION_SECRET'].map(secret), { name: 'CLOUD_RUN_IAM', value: 'true' }, { name: 'FIREBASE_HOSTING_MODE', value: 'true' }]
    : [...['DB_PASSWORD', 'JWT_SECRET', 'RATE_LIMIT_SECRET', 'SERVICE_PROXY_SECRET', 'MAIL_PASSWORD'].map(secret),
      ...Object.entries({ SPRING_PROFILES_ACTIVE: 'prod', APP_ENVIRONMENT: 'homologation', SECURITY_COOKIE_SECURE: 'true',
        HML_NEON_ISOLATED: 'true', HML_DB_NAME: 'oficina_security_test', HML_DB_USER: 'oficina_security_test_owner',
        DB_USERNAME: 'oficina_security_test_owner', HML_DB_HOST: 'ep-synthetic.sa-east-1.aws.neon.tech', HML_MIGRATIONS_APPROVED: 'true',
        DB_URL: 'jdbc:postgresql://ep-synthetic.sa-east-1.aws.neon.tech:5432/oficina_security_test?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory&channelBinding=require' }).map(([name, value]) => ({ name, value }))] }] } } } });

test('only exact approved project, number, region and isolation can pass', () => {
  assert.doesNotThrow(() => assertApprovedTarget(settings));
  for (const HML_PROJECT of ['production', 'oficinagestao-homologaca-4848f', 'other-security-test', ''])
    assert.throws(() => assertApprovedTarget({ ...settings, HML_PROJECT }));
  for (const key of ['HML_PROJECT_NUMBER', 'HML_REGION', 'HML_ISOLATED'])
    assert.throws(() => assertApprovedTarget({ ...settings, [key]: 'wrong' }));
  assert.throws(() => assertApprovedTarget({ ...settings, NODE_TLS_REJECT_UNAUTHORIZED: '0' }));
  assert.doesNotThrow(() => assertProjectMetadata({ projectId: PROJECT_ID, projectNumber: PROJECT_NUMBER, lifecycleState: 'ACTIVE' }));
  assert.throws(() => assertProjectMetadata({ projectId: PROJECT_ID, projectNumber: 'wrong', lifecycleState: 'ACTIVE' }));
});

test('service metadata requires isolated labels, exact service identities and numeric secret references', () => {
  for (const role of ['backend', 'frontend']) {
    const valid = service(role); assert.doesNotThrow(() => assertServiceMetadata(valid, role));
    for (const change of [data => data.metadata.labels.environment = 'production', data => data.spec.template.spec.serviceAccountName = accounts.denied,
      data => data.spec.template.spec.containers[0].env[0].valueFrom.secretKeyRef.key = 'latest']) {
      const data = structuredClone(valid); change(data); assert.throws(() => assertServiceMetadata(data, role));
    }
  }
  const frontend = service('frontend'); frontend.spec.template.spec.containers[0].env.push({ name: 'DB_PASSWORD', value: 'PRIVATE-sentinel' });
  assert.throws(() => assertServiceMetadata(frontend, 'frontend'));
});

test('Firebase configuration routes all requests to Next SSR and blocks unapproved public deployment', () => {
  assert.equal(validateHostingConfiguration(), true);
  for (const vars of [{}, { ...settings, GCLOUD_PROJECT: 'oficinagestao-homologaca-4848f', HML_HOSTING_PUBLICATION_APPROVED: 'true' },
    { ...settings, GCLOUD_PROJECT: PROJECT_ID, HML_HOSTING_PUBLICATION_APPROVED: 'false' }]) {
    const result = spawnSync(process.execPath, ['scripts/homologation/hosting-predeploy.mjs'], { env: { ...process.env, ...vars }, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1); assert.match(result.stderr, /bloqueado/);
  }
});

test('deploy plan pins approved digests, service accounts, numeric secrets and economical bounds without executing', () => {
  const inputs = { ...settings, HML_BACKEND_IMAGE: `us-central1-docker.pkg.dev/${PROJECT_ID}/synthetic/backend@sha256:${'a'.repeat(64)}`,
    HML_FRONTEND_IMAGE: `us-central1-docker.pkg.dev/${PROJECT_ID}/synthetic/frontend@sha256:${'b'.repeat(64)}` };
  for (const name of ['DB_PASSWORD', 'JWT_SECRET', 'RATE_LIMIT_SECRET', 'SERVICE_PROXY_SECRET', 'MAIL_PASSWORD', 'FIREBASE_SESSION_SECRET']) inputs[`HML_${name}_VERSION`] = '1';
  const plan = deploymentPlan(inputs); assert.equal(plan.executed, false);
  for (const role of ['backend', 'frontend']) {
    assert.ok(plan.commands[role].includes('--min=0')); assert.ok(plan.commands[role].includes('--max=1'));
    assert.ok(plan.commands[role].includes('--service-account=' + accounts[role]));
  }
  assert.ok(plan.commands.backend.includes('--no-allow-unauthenticated'));
  assert.throws(() => deploymentPlan({ ...inputs, HML_BACKEND_IMAGE: inputs.HML_BACKEND_IMAGE.replace(/@sha256:.*/, ':latest') }));
  assert.throws(() => deploymentPlan({ ...inputs, HML_DB_PASSWORD_VERSION: 'latest' }));
});
