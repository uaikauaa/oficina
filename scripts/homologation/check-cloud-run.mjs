// Read-only. Never deploys, changes IAM, or prints identity tokens.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { assertApprovedTarget, assertProjectMetadata, assertServiceMetadata, accounts } from './cloud-target.mjs';

try {
const env = process.env;
const project = env.HML_PROJECT;
assertApprovedTarget(env);
const region = env.HML_REGION;
const call = args => {
  try {
    // Identifiers and URL arguments are constrained below; no credential is passed as an argument.
    return execFileSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud', args, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', windowsHide: true,
    }).trim();
  } catch { throw new Error('Cloud Run read/identity command failed; command output omitted'); }
};
const describe = name => {
  assert.match(name || '', /^[a-z][a-z0-9-]+$/);
  const data = JSON.parse(call(['run', 'services', 'describe', name, '--project', project, '--region', region, '--format=json']));
  const url = data.status?.url;
  assert.match(url || '', /^https:\/\/[a-z0-9.-]+\.run\.app$/);
  return { url, data };
};
assertProjectMetadata(JSON.parse(call(['projects', 'describe', project, '--format=json'])));
const backendService = describe(env.HML_BACKEND_SERVICE);
const frontendService = describe(env.HML_FRONTEND_SERVICE);
assertServiceMetadata(backendService.data, 'backend');
assertServiceMetadata(frontendService.data, 'frontend');
const backend = backendService.url;
const frontend = frontendService.url;
const account = env.HML_FRONTEND_SERVICE_ACCOUNT;
const denied = env.HML_DENIED_SERVICE_ACCOUNT;
assert.equal(account, accounts.frontend);
assert.equal(denied, accounts.denied);
for (const value of [account, denied]) assert.match(value || '', new RegExp(`^[a-z0-9-]+@${project}\\.iam\\.gserviceaccount\\.com$`));
assert.equal(frontendService.data.spec?.template?.spec?.serviceAccountName, account, 'Frontend service identity must match the tested caller');
const variables = service => service.data.spec?.template?.spec?.containers?.[0]?.env || [];
assert.equal(variables(frontendService).find(value => value.name === 'INTERNAL_BACKEND_URL')?.value, backend);
const frontSecret = variables(frontendService).find(value => value.name === 'SERVICE_PROXY_SECRET')?.valueFrom?.secretKeyRef;
const backSecret = variables(backendService).find(value => value.name === 'SERVICE_PROXY_SECRET')?.valueFrom?.secretKeyRef;
assert.ok(frontSecret?.name && frontSecret?.key, 'Frontend service secret must come from Secret Manager');
assert.equal(backSecret?.name, frontSecret.name); assert.equal(backSecret?.key, frontSecret.key);
const rateSecret = variables(backendService).find(value => value.name === 'RATE_LIMIT_SECRET')?.valueFrom?.secretKeyRef;
const jwtSecret = variables(backendService).find(value => value.name === 'JWT_SECRET')?.valueFrom?.secretKeyRef;
assert.ok(rateSecret?.name && jwtSecret?.name, 'JWT and rate keys must come from Secret Manager');
assert.equal(new Set([rateSecret.name, jwtSecret.name, backSecret.name]).size, 3, 'Separate secret references are required');
assert.equal(variables(frontendService).find(value => value.name === 'TRUSTED_PROXY_HOPS')?.value, env.HML_EXPECTED_PROXY_HOPS);
assert.match(env.HML_EXPECTED_PROXY_HOPS || '', /^[1-5]$/);
const policy = JSON.parse(call(['run', 'services', 'get-iam-policy', env.HML_BACKEND_SERVICE, '--project', project, '--region', region, '--format=json']));
const invokers = policy.bindings?.filter(b => b.role === 'roles/run.invoker').flatMap(b => b.members || []) || [];
assert.ok(invokers.includes('serviceAccount:' + account));
assert.ok(!invokers.includes('allUsers') && !invokers.includes('allAuthenticatedUsers'));
assert.ok(!invokers.includes('serviceAccount:' + denied));
assert.deepEqual(new Set(invokers), new Set(['serviceAccount:' + account]), 'Backend invoker must be restricted to the frontend identity');
const identity = (caller, audience) => call(['auth', 'print-identity-token', '--impersonate-service-account=' + caller, '--audiences=' + audience, '--include-email']);
const invoke = (url, token) => fetch(url + '/api/health', { redirect: 'error', signal: AbortSignal.timeout(15000),
  headers: token ? { 'X-Serverless-Authorization': 'Bearer ' + token } : {} });
assert.ok([401, 403].includes((await invoke(backend)).status), 'Anonymous backend invocation must fail');
assert.equal((await invoke(backend, identity(account, backend))).status, 200, 'Allowed service identity');
assert.ok([401, 403].includes((await invoke(backend, identity(account, 'https://wrong-audience.invalid'))).status), 'Wrong audience must fail');
assert.ok([401, 403].includes((await invoke(backend, identity(denied, backend))).status), 'Denied service identity must fail');
const proxied = await invoke(frontend);
assert.equal(proxied.status, 200, 'Public frontend must invoke the private backend');
assert.equal(proxied.headers.get('x-serverless-authorization'), null);
const unauthenticatedBusiness = await fetch(frontend + '/api/clientes', { redirect: 'error', signal: AbortSignal.timeout(15000) });
assert.equal(unauthenticatedBusiness.status, 401, 'Service identity and client context must pass while user authentication remains required');
assert.match(proxied.headers.get('strict-transport-security') || '', /max-age=31536000/);
const plain = await fetch(frontend.replace('https:', 'http:') + '/api/health', { redirect: 'manual', signal: AbortSignal.timeout(15000) });
assert.notEqual(plain.status, 200, 'Public HTTP must not serve application traffic');
if (plain.headers.has('location')) assert.equal(new URL(plain.headers.get('location'), frontend).protocol, 'https:');
const output = { executedAt: new Date().toISOString(), environment: 'isolated-google-cloud', checks: {
  iamPolicy: true, anonymousDenied: true, callerAllowed: true, wrongAudienceDenied: true, otherAccountDenied: true, frontendProxy: true,
}, productionApproved: false };
writeFileSync('docs/security-hardening/cloud-run-homologation.json', JSON.stringify(output, null, 2) + '\n');
console.log('PASS: isolated Cloud Run IAM, audience and frontend proxy; tokens omitted.');
} catch {
  console.error('FAIL: Cloud Run homologation verification failed; private values and tokens omitted. No deployment or IAM changes performed.');
  process.exitCode = 1;
}
