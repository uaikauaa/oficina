// Complete synthetic local stack, with production migrations and a real SMTP sink.
import { spawn, execFileSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docker = args => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
// Every run starts with a genuinely empty database; never reuse a prior seeded volume.
const runId = randomUUID().slice(0, 8);
const names = ['oficina-hml-postgres-' + runId, 'oficina-hml-mailpit-' + runId];
const owned = name => {
  try { return JSON.parse(docker(['inspect', name]))[0].Config.Labels?.['oficina.security-hml'] === runId; }
  catch { return false; }
};
let backend;
let replica;
const stop = async child => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const done = once(child, 'exit'); child.kill(); await done;
};
const waitReady = async (child, port) => {
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch('http://127.0.0.1:' + port + '/api/health')).ok) return; } catch {}
    if (child.exitCode !== null) throw new Error('Synthetic backend exited; inspect the local log');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Synthetic backend did not become ready');
};
const log = openSync(path.join(root, 'audit-hardening-real-backend.log'), 'w');
try {
  for (const name of names) {
    let exists = false;
    try { docker(['inspect', name]); exists = true; } catch {}
    if (exists && !owned(name)) throw new Error('Container is not task-owned');
    if (exists) docker(['start', name]);
    else docker(['run', '-d', '--name', name, '--label', 'oficina.security-hml=' + runId,
      ...(name.includes('postgres') ? ['-p', '127.0.0.1:15433:5432', '-e', 'POSTGRES_DB=oficina_integracao_ci',
        '-e', 'POSTGRES_USER=ci_isolado', '-e', 'POSTGRES_PASSWORD=ci-integration-db-only', 'postgres:16-alpine']
        : ['-p', '127.0.0.1:1025:1025', '-p', '127.0.0.1:8025:8025', 'axllent/mailpit:latest'])]);
  }
  const startBackend = (port, jwtSecret = 'ci-integration-only-jwt-2026-synthetic-value-never-for-production') => spawn('java', ['-jar', 'backend/target/backend-0.0.1-SNAPSHOT.jar'], { cwd: root, windowsHide: true,
    stdio: ['ignore', log, log], env: { ...process.env, SPRING_PROFILES_ACTIVE: 'dev', PORT: String(port), TRUSTED_PROXIES: '',
      DB_URL: 'jdbc:postgresql://127.0.0.1:15433/oficina_integracao_ci', DB_USERNAME: 'ci_isolado', DB_PASSWORD: 'ci-integration-db-only',
      JWT_SECRET: jwtSecret, RATE_LIMIT_SECRET: 'ci-integration-independent-rate-secret-only-2026', SECURITY_COOKIE_SECURE: 'false',
      INVITE_OUTBOX_KEYS: '1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000', MAIL_HOST: '127.0.0.1', MAIL_PORT: '1025',
      MAIL_USERNAME: 'ci.integration@oficina.invalid', MAIL_PASSWORD: 'ci-smtp-only', MAIL_FROM: 'ci.integration@oficina.invalid',
      MAIL_SMTP_AUTH: 'false', MAIL_SMTP_STARTTLS: 'false', INITIAL_ADMIN_NAME: 'Admin Sintetico CI',
      SUPER_ADMIN_BOOTSTRAP_EMAIL: 'ci.superadmin@oficina.invalid',
      INITIAL_ADMIN_EMAIL: 'ci.integration@oficina.invalid', INITIAL_ADMIN_PASSWORD: 'CiIntegration#2026Secure!',
    } });
  backend = startBackend(8080);
  await waitReady(backend, 8080);
  const tests = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'e2e/integration-real.spec.ts', '--workers=1'], {
    cwd: path.join(root, 'frontend'), stdio: 'inherit', windowsHide: true, env: { ...process.env, RUN_REAL_INTEGRATION: 'true',
      CI_INTEGRATION_ADMIN_EMAIL: 'ci.integration@oficina.invalid', CI_INTEGRATION_ADMIN_PASSWORD: 'CiIntegration#2026Secure!',
      CI_INTEGRATION_POSTGRES_CONTAINER: names[0],
      INTERNAL_BACKEND_URL: 'http://127.0.0.1:8080',
    },
  });
  const [code] = await once(tests, 'exit');
  if (code !== 0) throw new Error('Real isolated integration failed');

  replica = startBackend(8082);
  await waitReady(replica, 8082);
  assert.equal(owned(names[0]), true);
  docker(['exec', names[0], 'psql', '-U', 'ci_isolado', '-d', 'oficina_integracao_ci', '-c', 'DELETE FROM security_rate_limits']);
  const attempt = async (port, index) => {
    const base = 'http://127.0.0.1:' + port;
    const csrf = await fetch(base + '/api/auth/csrf');
    assert.equal(csrf.status, 200);
    const token = (await csrf.json()).token;
    const cookie = csrf.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    return fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json',
      Cookie: cookie, 'X-XSRF-TOKEN': token, 'X-Forwarded-For': '192.0.2.' + index,
    }, body: JSON.stringify({ email: 'load-' + index + '@oficina.invalid', senha: 'WrongSynthetic#2026!' }) });
  };
  const distributed = await Promise.all(Array.from({ length: 12 }, (_, index) => attempt(index % 2 ? 8080 : 8082, index)));
  assert.equal(distributed.filter(response => response.status === 401).length, 10);
  assert.equal(distributed.filter(response => response.status === 429).length, 2);
  await stop(backend);
  backend = startBackend(8080, 'ci-integration-rotated-jwt-key-distinct-from-rate-2026');
  await waitReady(backend, 8080);
  assert.equal((await attempt(8080, 100)).status, 429);
  assert.equal((await attempt(8082, 101)).status, 429);
  console.log('PASS: two real JVMs, 12 concurrent distributed attempts, exact shared request budget, forged XFF ignored, restart with JWT key rotation preserved the block.');
} finally {
  await stop(backend); await stop(replica);
  closeSync(log);
  for (const name of names) if (owned(name)) docker(['rm', '-f', '-v', name]);
}
