// Complete synthetic local stack, with production migrations and a real SMTP sink.
import { spawn, execFileSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cleanEnv = Object.fromEntries(
  ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'USERPROFILE', 'HOME', 'LOCALAPPDATA', 'APPDATA', 'JAVA_HOME', 'ComSpec']
    .filter(key => process.env[key]).map(key => [key, process.env[key]])
);
const docker = args => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'], env: cleanEnv }).trim();
const unsafe = Object.keys(process.env).filter(key => /^(?:SPRING_|DB_|DATABASE_URL$|MAIL_|SMTP_|INITIAL_ADMIN_|JWT_|RATE_LIMIT_|SECURITY_|SERVICE_PROXY_|CORS_|NEXT_PUBLIC_|DOCKER_|PG[A-Z_]|JAVA_TOOL_OPTIONS$|JDK_JAVA_OPTIONS$|_JAVA_OPTIONS$|NODE_OPTIONS$|E2E_BASE_URL$|RUN_REAL_INTEGRATION$|CI_TEST_DB_CONTAINER$)/i.test(key));
if (unsafe.length) throw new Error(`Unsafe inherited configuration: ${unsafe.sort().join(', ')}`);
if (process.env.INTERNAL_BACKEND_URL && process.env.INTERNAL_BACKEND_URL !== 'http://127.0.0.1:8080') {
  throw new Error('Inconsistent INTERNAL_BACKEND_URL');
}
// Every run starts with a genuinely empty database; never reuse a prior seeded volume.
const runId = randomUUID().slice(0, 8);
if (process.env.PLAYWRIGHT_PORT && process.env.PLAYWRIGHT_PORT !== '3102') throw new Error('PLAYWRIGHT_PORT must be 3102');
const playwrightPort = 3102;
const names = ['oficina-hml-postgres-' + runId, 'oficina-hml-mailpit-' + runId];
const network = 'oficina-hml-network-' + runId;
const ids = new Map();
let networkId;
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const owned = name => {
  try { const item = inspect(name); return item.Id === ids.get(name) && item.Config.Labels?.['oficina.security-hml'] === runId; }
  catch { return false; }
};
const freePort = port => new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(port, '127.0.0.1', () => server.close(resolve));
});
const expectBinding = (item, internal, external) => {
  for (const bindings of [item.HostConfig.PortBindings?.[`${internal}/tcp`], item.NetworkSettings.Ports?.[`${internal}/tcp`]]) {
    assert.equal(bindings?.length, 1);
    assert.equal(bindings[0].HostIp, '127.0.0.1');
    assert.equal(bindings[0].HostPort, String(external));
  }
};
const assertContainer = (name, image, bindings) => {
  const item = inspect(name);
  assert.equal(owned(name), true);
  assert.equal(item.Config.Image, image);
  assert.equal(item.Image, inspectImage(image));
  assert.equal(item.State.Running, true);
  assert.equal(item.HostConfig.NetworkMode, network);
  assert.equal(item.NetworkSettings.Networks[network]?.NetworkID, networkId);
  assert.deepEqual(Object.keys(item.NetworkSettings.Networks), [network]);
  assert.equal(item.HostConfig.RestartPolicy.Name, 'no');
  assert.equal(item.Mounts.every(mount => mount.Type === 'volume' && mount.Destination === '/var/lib/postgresql/data'), true);
  assert.deepEqual(Object.keys(item.HostConfig.PortBindings ?? {}).sort(), bindings.map(([port]) => `${port}/tcp`).sort());
  for (const [internal, external] of bindings) expectBinding(item, internal, external);
  return item;
};
const inspectImage = image => JSON.parse(docker(['image', 'inspect', image]))[0].Id;
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
let log;
try {
  const context = docker(['context', 'show']);
  const endpoint = JSON.parse(docker(['context', 'inspect', context]))[0].Endpoints?.docker?.Host;
  assert.match(endpoint ?? '', /^(?:unix:\/\/|npipe:\/\/|fd:\/\/)/, 'Docker must use a local daemon');
  for (const port of [15433, 1025, 8025, 8080, 8082, playwrightPort]) await freePort(port);
  networkId = docker(['network', 'create', '--label', `oficina.security-hml=${runId}`, network]);
  const networkInfo = JSON.parse(docker(['network', 'inspect', network]))[0];
  assert.equal(networkInfo.Id, networkId);
  assert.equal(networkInfo.Labels?.['oficina.security-hml'], runId);
  assert.equal(networkInfo.Internal, false);
  assert.equal(networkInfo.Driver, 'bridge');
  for (const name of names) {
    try { inspect(name); throw new Error(`Container name already exists: ${name}`); }
    catch (error) { if (error.message.startsWith('Container name already exists:')) throw error; }
    const id = docker(['run', '-d', '--name', name, '--label', 'oficina.security-hml=' + runId, '--network', network,
      ...(name.includes('postgres') ? ['-p', '127.0.0.1:15433:5432', '-e', 'POSTGRES_DB=oficina_integracao_ci',
        '-e', 'POSTGRES_USER=ci_isolado', '-e', 'POSTGRES_PASSWORD=ci-integration-db-only', 'postgres:16-alpine']
        : ['-p', '127.0.0.1:1025:1025', '-p', '127.0.0.1:8025:8025', 'axllent/mailpit:latest'])]);
    ids.set(name, id);
  }
  const database = assertContainer(names[0], 'postgres:16-alpine', [[5432, 15433]]);
  const mailpit = assertContainer(names[1], 'axllent/mailpit:latest', [[1025, 1025], [8025, 8025]]);
  for (const value of ['POSTGRES_DB=oficina_integracao_ci', 'POSTGRES_USER=ci_isolado',
    'POSTGRES_PASSWORD=ci-integration-db-only']) assert.equal(database.Config.Env.includes(value), true);
  assert.equal(mailpit.Config.Env.some(value => /^(?:MP_SMTP_RELAY|MP_SENDMAIL)/.test(value)), false);
  let stable = 0;
  for (let i = 0; i < 60; i++) {
    try {
      const identity = docker(['exec', names[0], 'psql', '-U', 'ci_isolado', '-d', 'oficina_integracao_ci', '-Atc',
        "SELECT current_database() || ':' || current_user || ':' || COUNT(*) FROM information_schema.tables WHERE table_schema='public'"]);
      stable = identity === 'oficina_integracao_ci:ci_isolado:0' ? stable + 1 : 0;
    } catch { stable = 0; }
    if (stable >= 3) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(stable >= 3, true, 'Synthetic PostgreSQL was not stably ready and empty');
  log = openSync(path.join(root, 'audit-hardening-real-backend.log'), 'w');
  const startBackend = (port, jwtSecret = 'ci-integration-only-jwt-2026-synthetic-value-never-for-production') => spawn('java', ['-jar', 'backend/target/backend-0.0.1-SNAPSHOT.jar'], { cwd: root, windowsHide: true,
    stdio: ['ignore', log, log], env: { ...cleanEnv, SPRING_PROFILES_ACTIVE: 'dev', PORT: String(port), TRUSTED_PROXIES: '',
      DB_URL: 'jdbc:postgresql://127.0.0.1:15433/oficina_integracao_ci', DB_USERNAME: 'ci_isolado', DB_PASSWORD: 'ci-integration-db-only',
      JWT_SECRET: jwtSecret, RATE_LIMIT_SECRET: 'ci-integration-independent-rate-secret-only-2026', SECURITY_COOKIE_SECURE: 'false',
      CORS_ALLOWED_ORIGINS: `http://localhost:${playwrightPort}`, MAIL_HOST: '127.0.0.1', MAIL_PORT: '1025',
      MAIL_USERNAME: 'ci.integration@oficina.invalid', MAIL_PASSWORD: 'ci-smtp-only', MAIL_FROM: 'ci.integration@oficina.invalid',
      MAIL_SMTP_AUTH: 'false', MAIL_SMTP_STARTTLS: 'false', INITIAL_ADMIN_NAME: 'Admin Sintetico CI',
      INITIAL_ADMIN_EMAIL: 'ci.integration@oficina.invalid', INITIAL_ADMIN_PASSWORD: 'CiIntegration#2026Secure!',
    } });
  backend = startBackend(8080);
  await waitReady(backend, 8080);
  assert.equal(docker(['exec', names[0], 'psql', '-U', 'ci_isolado', '-d', 'oficina_integracao_ci', '-Atc',
    'SELECT COUNT(*) ||\':\' || MAX(version) FROM flyway_schema_history WHERE success']), '1:24');
  const tests = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test',
    'e2e/integration-real.spec.ts', 'e2e/real-p1.spec.ts', '--workers=1'], {
    cwd: path.join(root, 'frontend'), stdio: 'inherit', windowsHide: true, env: { ...cleanEnv, CI: 'true', PLAYWRIGHT_PORT: String(playwrightPort),
      E2E_BASE_URL: `http://localhost:${playwrightPort}`, RUN_REAL_INTEGRATION: 'true', CI_TEST_DB_CONTAINER: names[0],
      CI_INTEGRATION_ADMIN_EMAIL: 'ci.integration@oficina.invalid', CI_INTEGRATION_ADMIN_PASSWORD: 'CiIntegration#2026Secure!',
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
  if (log !== undefined) closeSync(log);
  for (const name of names) if (owned(name)) docker(['rm', '-f', '-v', name]);
  if (networkId) {
    const item = JSON.parse(docker(['network', 'inspect', network]))[0];
    if (item.Id === networkId && item.Labels?.['oficina.security-hml'] === runId) docker(['network', 'rm', network]);
  }
}
