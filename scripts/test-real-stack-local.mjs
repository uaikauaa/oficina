// Complete synthetic local stack, with production migrations and a real SMTP sink.
import { spawn, execFileSync } from 'node:child_process';
import { openSync, closeSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash, createCipheriv } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Fail before Docker/Java if local configuration could override the synthetic target.
// Do not import operational dotenv files or JVM/Spring connection overrides.
if (['.env', '../.env', 'backend/.env'].some(file => existsSync(path.resolve(root, file))) ||
    Object.keys(process.env).some(key => /^(SPRING_|spring\.|JAVA_TOOL_OPTIONS$|JDK_JAVA_OPTIONS$|_JAVA_OPTIONS$)/.test(key))) {
  throw new Error('Real-stack runner requires a clean isolated worktree and no inherited Spring/JVM overrides');
}
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
  const startBackend = (port, jwtSecret = 'ci-integration-only-jwt-2026-synthetic-value-never-for-production', pollMs = 5000) => spawn('java', ['-jar', 'backend/target/backend-0.0.1-SNAPSHOT.jar'], { cwd: root, windowsHide: true,
    stdio: ['ignore', log, log], env: { ...process.env, SPRING_PROFILES_ACTIVE: 'dev', PORT: String(port), TRUSTED_PROXIES: '',
      DB_URL: 'jdbc:postgresql://127.0.0.1:15433/oficina_integracao_ci', DB_USERNAME: 'ci_isolado', DB_PASSWORD: 'ci-integration-db-only',
      JWT_SECRET: jwtSecret, RATE_LIMIT_SECRET: 'ci-integration-independent-rate-secret-only-2026', SECURITY_COOKIE_SECURE: 'false',
      SECURITY_JWT_LEGACY_SESSIONLESS_ALLOWED: 'false',
      PASSWORD_RECOVERY_REQUESTS_ENABLED: 'true',
      INVITE_OUTBOX_KEYS: '1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      INVITE_OUTBOX_POLL_MS: String(pollMs),
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

  // Same signing key and database across JVM replacement: failures must come from
  // persisted revocation, never key rotation or an in-memory cache.
  const psqlSession = sql => {
    assert.equal(owned(names[0]), true);
    return docker(['exec', names[0], 'psql', '-U', 'ci_isolado', '-d', 'oficina_integracao_ci', '-tA', '-c', sql]).trim();
  };
  psqlSession('DELETE FROM security_rate_limits');
  const client = () => {
    const jar = new Map();
    return {jar, async request(route, method = 'GET', body) {
      const headers = {Cookie: [...jar].map(([k,v]) => k+'='+v).join('; ')};
      if (method !== 'GET') {
        const csrf = await this.request('/api/auth/csrf');
        headers['X-XSRF-TOKEN'] = (await csrf.json()).token;
        headers.Cookie = [...jar].map(([k,v]) => k+'='+v).join('; ');
        headers['Content-Type'] = 'application/json';
      }
      const response = await fetch('http://127.0.0.1:8080'+route, {method,headers,
        ...(body === undefined ? {} : {body:JSON.stringify(body)})});
      for(const item of response.headers.getSetCookie()) {const pair=item.split(';')[0],eq=pair.indexOf('=');jar.set(pair.slice(0,eq),pair.slice(eq+1));}
      return response;
    }};
  };
  const mailboxText = async (recipient, pattern) => {
    for(let i=0;i<60;i++) {
      const list=await (await fetch('http://127.0.0.1:8025/api/v1/messages')).json();
      for(const m of list.messages.filter(m=>m.To?.some(to=>to.Address===recipient))) {
        const message=await (await fetch('http://127.0.0.1:8025/api/v1/message/'+m.ID)).json();
        const match=message.Text?.match(pattern); if(match) return match[1];
      }
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    throw Error('Synthetic message missing');
  };
  const sessionEmail='ci.integration@oficina.invalid';
  const loginSession = async (c,password) => {
    // Empty only the task-owned SMTP sink to avoid reading an earlier challenge.
    assert.equal(owned(names[1]),true);
    await fetch('http://127.0.0.1:8025/api/v1/messages',{method:'DELETE'});
    const login=await c.request('/api/auth/login','POST',{email:sessionEmail,senha:password,rememberMe:true});
    assert.equal(login.status,200);
    const challenge=await login.json();
    assert.equal(challenge.twoFactorRequired,true);
    const code=await mailboxText(sessionEmail,/Seu código de verificação é:\s*(\d{6})/);
    const verified=await c.request('/api/auth/2fa/verify','POST',{challengeToken:challenge.challengeToken,code});
    assert.equal(verified.status,200);
    return JSON.parse(Buffer.from(c.jar.get('access_token').split('.')[1],'base64url'));
  };
  await new Promise(resolve=>setTimeout(resolve,31000));
  const a=client(),b=client();
  // The preceding browser recovery test has already changed this synthetic password.
  const claimsA=await loginSession(a,'RecoveredSynthetic#2026!');
  await new Promise(resolve=>setTimeout(resolve,31000));
  const claimsB=await loginSession(b,'RecoveredSynthetic#2026!');
  assert.ok(claimsA.sessionId && claimsB.sessionId && claimsA.sessionId!==claimsB.sessionId);
  assert.equal((await a.request('/api/auth/me')).status,200);
  assert.equal((await b.request('/api/auth/sessoes/'+claimsA.sessionId,'DELETE')).status,200);
  assert.equal((await a.request('/api/auth/me')).status,401);
  assert.equal((await b.request('/api/auth/me')).status,200);
  await stop(backend); backend=startBackend(8080); await waitReady(backend,8080);
  assert.equal((await a.request('/api/auth/me')).status,401);
  assert.equal((await b.request('/api/auth/me')).status,200);
  assert.equal((await a.request('/api/auth/refresh','POST')).status,401);
  const oldRefreshB=b.jar.get('refresh_token');
  assert.equal((await b.request('/api/auth/refresh','POST')).status,200);
  const rotated=JSON.parse(Buffer.from(b.jar.get('access_token').split('.')[1],'base64url'));
  assert.equal(rotated.sessionId,claimsB.sessionId);
  const replay=client(); replay.jar.set('refresh_token',oldRefreshB);
  assert.equal((await replay.request('/api/auth/refresh','POST')).status,401);
  assert.equal((await b.request('/api/auth/me')).status,401);
  console.log('PASS: real login+2FA sessions; immediate revoke; same-key JVM restart rejects A, preserves B; refresh retains sessionId; replay invalidates family.');

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

  // Persist a synthetic pending delivery while both processes exist, then restart
  // both workers. Only a hash enters the invite table and only GCM ciphertext enters the outbox.
  const recipient = 'ci.restart@oficina.invalid';
  const inviteToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(inviteToken).digest('hex');
  const psql = sql => docker(['exec', names[0], 'psql', '-U', 'ci_isolado', '-d', 'oficina_integracao_ci', '-tA', '-c', sql]).trim();
  const inviteId = Number(psql(`INSERT INTO convites_usuarios(email,token_hash,role_id,expira_em)
    VALUES ('${recipient}','${tokenHash}',(SELECT id FROM roles WHERE nome='ROLE_CONSULTA'),now()+interval '24 hours') RETURNING id`).split('\n')[0]);
  assert.ok(Number.isSafeInteger(inviteId) && inviteId > 0);
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.alloc(32), nonce);
  cipher.setAAD(Buffer.from(String(inviteId), 'ascii'));
  const payload = Buffer.concat([cipher.update(inviteToken, 'ascii'), cipher.final(), cipher.getAuthTag()]);
  psql(`INSERT INTO invite_delivery_outbox(invite_id,key_version,nonce,ciphertext,next_attempt_at)
    VALUES (${inviteId},1,decode('${nonce.toString('hex')}','hex'),decode('${payload.toString('hex')}','hex'),now()+interval '30 seconds')`);
  assert.equal(psql(`SELECT status FROM invite_delivery_outbox WHERE invite_id=${inviteId}`), 'PENDING');
  await stop(backend); await stop(replica);
  backend = startBackend(8080, 'ci-integration-rotated-jwt-key-distinct-from-rate-2026', 250);
  replica = startBackend(8082, 'ci-integration-rotated-jwt-key-distinct-from-rate-2026', 250);
  await Promise.all([waitReady(backend, 8080), waitReady(replica, 8082)]);
  let delivered = false;
  for (let i = 0; i < 90; i++) {
    if (psql(`SELECT status FROM invite_delivery_outbox WHERE invite_id=${inviteId}`) === 'SENT') { delivered = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(delivered, 'pending encrypted invitation survives restart and is delivered');
  const messages = await (await fetch('http://127.0.0.1:8025/api/v1/messages')).json();
  assert.equal(messages.messages.filter(message => message.To?.some(to => to.Address?.toLowerCase() === recipient)).length, 1);
  assert.equal(psql(`SELECT ciphertext IS NULL AND nonce IS NULL FROM invite_delivery_outbox WHERE invite_id=${inviteId}`), 't');
  console.log('PASS: pending encrypted invitation survived restart, two real JVM workers produced one Mailpit message, and ciphertext was erased.');
} finally {
  await stop(backend); await stop(replica);
  closeSync(log);
  for (const name of names) if (owned(name)) docker(['rm', '-f', '-v', name]);
}
