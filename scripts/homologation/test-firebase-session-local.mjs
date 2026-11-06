// REAL local stack only: Next standalone -> Spring -> new PostgreSQL + SMTP sink.
// Does not read private .env.homolog.local or contact Google Cloud/Neon/Firebase.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(root, 'frontend/package.json'))('@playwright/test');
const runId = randomUUID().slice(0, 8);
const containers = ['oficina-firebase-pg-' + runId, 'oficina-firebase-mail-' + runId];
const docker = args => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const owned = name => {
  try { return JSON.parse(docker(['inspect', name]))[0].Config.Labels?.['oficina.firebase-test'] === runId; }
  catch { return false; }
};
mkdirSync(path.join(root, 'logs/homologation'), { recursive: true });
const log = openSync(path.join(root, 'logs/homologation/firebase-local.log'), 'w');
const children = [];
let browser;
const start = (command, args, env) => {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', log, log] });
  children.push(child); return child;
};
const wait = async (url, child) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error('Local fixture exited');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Local fixture timeout');
};
try {
  docker(['run', '-d', '--name', containers[0], '--label', 'oficina.firebase-test=' + runId, '-p', '127.0.0.1:15434:5432',
    '-e', 'POSTGRES_DB=oficina_firebase_ci', '-e', 'POSTGRES_USER=ci_isolado', '-e', 'POSTGRES_PASSWORD=local-firebase-fixture-only', 'postgres:16-alpine']);
  docker(['run', '-d', '--name', containers[1], '--label', 'oficina.firebase-test=' + runId, '-p', '127.0.0.1:11025:1025',
    '-p', '127.0.0.1:18025:8025', 'axllent/mailpit:latest']);
  await wait('http://127.0.0.1:18025/');
  const password = 'Synthetic#' + randomBytes(16).toString('hex');
  const backend = start('java', ['-jar', 'backend/target/backend-0.0.1-SNAPSHOT.jar'], {
    SPRING_PROFILES_ACTIVE: 'dev', APP_ENVIRONMENT: 'local-fixture', PORT: '18080', SERVER_PORT: '18080',
    DB_URL: 'jdbc:postgresql://127.0.0.1:15434/oficina_firebase_ci', DB_USERNAME: 'ci_isolado', DB_PASSWORD: 'local-firebase-fixture-only',
    JWT_SECRET: randomBytes(32).toString('hex'), RATE_LIMIT_SECRET: randomBytes(32).toString('hex'), SERVICE_PROXY_SECRET: '',
    SECURITY_COOKIE_SECURE: 'true', CORS_ALLOWED_ORIGINS: 'http://localhost:13004', TRUSTED_PROXIES: '',
    MAIL_HOST: '127.0.0.1', MAIL_PORT: '11025', MAIL_USERNAME: 'synthetic@example.invalid', MAIL_PASSWORD: 'local-mail-sink-only',
    MAIL_FROM: 'synthetic@example.invalid', MAIL_SMTP_AUTH: 'false', MAIL_SMTP_STARTTLS: 'false',
    INITIAL_ADMIN_NAME: 'Admin Sintetico', INITIAL_ADMIN_EMAIL: 'firebase-ci@example.invalid', INITIAL_ADMIN_PASSWORD: password,
    SPRING_FLYWAY_LOCATIONS: 'classpath:db/migration',
  });
  await wait('http://127.0.0.1:18080/api/health', backend);
  const frontend = start(process.execPath, ['frontend/.next/standalone/server.js'], {
    PORT: '13004', HOSTNAME: 'localhost', K_SERVICE: '', CLOUD_RUN_IAM: 'false', INTERNAL_BACKEND_URL: 'http://127.0.0.1:18080',
    FIREBASE_HOSTING_MODE: 'true', FIREBASE_SESSION_SECRET: randomBytes(32).toString('base64'),
  });
  await wait('http://localhost:13004/api/health', frontend);
  browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: 'http://localhost:13004' });
  const client = context.request;
  const csrf = async () => {
    const response = await client.get('/api/auth/csrf'); assert.equal(response.status(), 200);
    return { 'X-XSRF-TOKEN': (await response.json()).token };
  };
  assert.equal((await client.get('/api/clientes')).status(), 401);
  const login = await client.post('/api/auth/login', { headers: await csrf(), data: { email: 'firebase-ci@example.invalid', senha: password, rememberMe: true } });
  assert.equal(login.status(), 200); const challenge = await login.json(); assert.equal(challenge.twoFactorRequired, true);
  assert.equal((await client.get('/api/auth/me')).status(), 401, 'No authentication before 2FA');
  const messages = await (await fetch('http://127.0.0.1:18025/api/v1/messages')).json();
  const id = messages.messages.find(message => message.To?.some(recipient => recipient.Address === 'firebase-ci@example.invalid'))?.ID;
  assert.ok(id, 'Real SMTP sink must receive synthetic 2FA');
  const mail = await (await fetch('http://127.0.0.1:18025/api/v1/message/' + encodeURIComponent(id))).json();
  const code = mail.Text.match(/Seu código de verificação é:\s*(\d{6})/)?.[1]; assert.ok(code);
  const verified = await client.post('/api/auth/2fa/verify', { headers: await csrf(), data: { challengeToken: challenge.challengeToken, code } });
  assert.equal(verified.status(), 200);
  assert.equal((await client.get('/api/auth/me')).status(), 200);
  const cookies = await context.cookies(); assert.equal(cookies.length, 1); assert.equal(cookies[0].name, '__session');
  assert.equal(cookies[0].httpOnly, true); assert.equal(cookies[0].secure, true); assert.equal(cookies[0].sameSite, 'Strict');
  assert.equal((await client.post('/api/clientes', { data: {} })).status(), 403);
  assert.equal((await client.post('/api/clientes', { headers: { 'X-XSRF-TOKEN': 'invalid' }, data: {} })).status(), 403);
  const created = await client.post('/api/clientes', { headers: await csrf(), data: { tipoPessoa: 'FISICA', nomeRazaoSocial: 'Cliente Sintetico Firebase', telefone: '11987654321' } });
  assert.equal(created.status(), 201); const customer = await created.json();
  const machine = await client.post('/api/maquinas', { headers: await csrf(), data: { clienteId: customer.id, tipoEquipamento: 'MAQUINA_SOLDA', marca: 'Sintetica', modelo: 'CI' } });
  assert.equal(machine.status(), 201);
  const order = await client.post('/api/ordens-servico', { headers: await csrf(), data: { clienteId: customer.id, maquinaId: (await machine.json()).id, problemaRelatado: 'Ensaio sintetico' } });
  assert.equal(order.status(), 201);
  const pdf = await client.get(`/api/ordens-servico/${(await order.json()).id}/pdf`);
  assert.equal(pdf.status(), 200); assert.equal((await pdf.body()).subarray(0, 5).toString(), '%PDF-');
  const refreshed = await client.post('/api/auth/refresh', { headers: await csrf(), data: {} }); assert.equal(refreshed.status(), 200);
  assert.equal((await client.get('/api/auth/me')).status(), 200);
  const logout = await client.post('/api/auth/logout', { headers: await csrf(), data: {} }); assert.equal(logout.status(), 200);
  assert.equal((await client.get('/api/auth/me')).status(), 401);
  assert.ok(!(await context.cookies()).some(cookie => cookie.name === '__session'));
  console.log('PASS: REAL local Next/Spring/PostgreSQL/B24/SMTP/2FA; encrypted __session, CSRF negatives, creation, PDF, refresh and logout. No remote service contacted.');
} catch {
  console.error('FAIL: local Firebase session integration; inspect ignored local fixture log. No credential/code/response body printed.');
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const child of children.reverse()) if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
  closeSync(log);
  for (const name of containers) if (owned(name)) docker(['rm', '-f', '-v', name]);
}
