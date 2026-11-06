import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNeonUrl, loadPrivateConfiguration, jdbcEnvironment } from './neon-hml.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const host = 'ep-synthetic.sa-east-1.aws.neon.tech';
const settings = { NEON_HML_EXPECTED_HOST: host, NEON_HML_ISOLATED: 'true' };
const raw = (password = 'synthetic-only', database = 'oficina_security_test', hostname = host, query = 'sslmode=verify-full&channel_binding=require') =>
  `postgresql://hml_security_test:${encodeURIComponent(password)}@${hostname}/${database}?${query}`;
const fixture = fn => {
  const directory = mkdtempSync(path.join(tmpdir(), 'oficina-neon-config-'));
  try { return fn(directory); }
  finally {
    assert.ok(path.resolve(directory).startsWith(path.join(tmpdir(), 'oficina-neon-config-')));
    rmSync(directory, { recursive: true });
  }
};

test('percent-encoded credentials round-trip without putting password in JDBC URL', () => {
  for (const password of ['p@ss:/?#%&=+ space', 'á漢字$`!"\\', 'plus+percent%']) {
    const result = parseNeonUrl(raw(password), settings);
    assert.equal(result.password, password);
    assert.equal(result.user, 'hml_security_test');
    assert.ok(!result.jdbcUrl.includes(password));
    assert.match(result.jdbcUrl, /sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory&channelBinding=require$/);
  }
});

test('isolation requires independently confirmed host, dedicated role and approved database', () => {
  for (const url of [raw('unused', 'neondb'), raw('unused', 'postgres'), raw('unused', 'other_security_test'),
    raw('unused', 'oficina_security_test', 'attacker.invalid'), raw().replace('hml_security_test', 'neondb_owner'),
    raw() + '#private', raw().replace('ep-synthetic', 'CHANGE_ME')]) {
    assert.throws(() => parseNeonUrl(url, settings));
  }
  assert.throws(() => parseNeonUrl(raw().replace(host, host + ':5433'), settings));
  assert.throws(() => parseNeonUrl(raw(), { ...settings, NEON_HML_ISOLATED: 'false' }));
  assert.throws(() => parseNeonUrl(raw(), { ...settings, NEON_HML_EXPECTED_HOST: 'ep-other.neon.tech' }));
  assert.equal(parseNeonUrl(raw('unused', 'approved_security_test'), { ...settings, NEON_HML_APPROVED_DATABASE: 'approved_security_test' }).database, 'approved_security_test');
});

test('operational endpoints and their pooled aliases are denied before networking', () => {
  assert.throws(() => parseNeonUrl(raw(), settings, [host]));
  assert.throws(() => parseNeonUrl(raw(), settings, [host.replace('ep-synthetic.', 'ep-synthetic-pooler.')]));
});

test('TLS downgrades, unsafe factories, routing overrides and duplicate parameters fail closed', () => {
  for (const query of ['sslmode=disable', 'sslmode=allow', 'sslmode=prefer', 'sslmode=require', 'sslmode=verify-ca',
    '', 'sslmode=verify-full&sslmode=require', 'sslmode=verify-full&sslfactory=NonValidatingFactory',
    'sslmode=verify-full&host=other', 'sslmode=verify-full&user=other', 'sslmode=verify-full&password=hidden',
    'sslmode=verify-full&channel_binding=disable', 'sslmode=verify-full&options=unsafe']) {
    assert.throws(() => parseNeonUrl(raw('unused', 'oficina_security_test', host, query), settings));
  }
});

test('errors never include raw URL, decoded password or URL parser causes', () => {
  const sentinel = 'PRIVATE-sentinel/@?#%';
  for (const url of ['bad://' + sentinel, raw(sentinel, 'neondb'), raw(sentinel) + '&password=' + encodeURIComponent(sentinel)]) {
    try { parseNeonUrl(url, settings); assert.fail('must reject'); }
    catch (error) {
      assert.ok(!String(error).includes(sentinel));
      assert.ok(!String(error).includes(encodeURIComponent(sentinel)));
      assert.equal(error.cause, undefined);
    }
  }
});

test('private file required even with env set; development settings never used as fallback', () => fixture(directory => {
  writeFileSync(path.join(directory, '.env'), `DB_URL=jdbc:postgresql://${host}/operational\nDB_PASSWORD=PRIVATE-sentinel`);
  assert.throws(() => loadPrivateConfiguration(directory), /Crie .env.homolog.local/);
  writeFileSync(path.join(directory, '.env.homolog.local'), `NEON_HML_URL=${raw()}\nNEON_HML_EXPECTED_HOST=${host}\nNEON_HML_ISOLATED=true`);
  assert.throws(() => loadPrivateConfiguration(directory), /operacional/);
}));

test('standalone Java inspector rejects invalid identity without printing JDBC credentials', () => {
  const child = spawnSync('java', [path.join(root, 'scripts/homologation/CheckNeonTls.java')], {
    encoding: 'utf8', windowsHide: true,
    env: { ...process.env, HML_NEON_ISOLATED: 'true', HML_DB_HOST: 'wrong.invalid', HML_EXPECTED_HOST: host,
      HML_DB_NAME: 'neondb', HML_DB_USER: 'neondb_owner', HML_DB_PASSWORD: 'PRIVATE-jdbc-sentinel' },
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /FAIL: isolated Neon TLS\/identity check/);
  assert.ok(!child.stderr.includes('PRIVATE-jdbc-sentinel'));
  assert.equal(child.stdout, '');
});

test('JDBC process receives password only through environment and blocks JVM overrides', () => {
  const config = parseNeonUrl(raw('private-value'), settings);
  assert.equal(jdbcEnvironment(config, {}).HML_DB_PASSWORD, 'private-value');
  for (const key of ['JAVA_TOOL_OPTIONS', '_JAVA_OPTIONS', 'JDK_JAVA_OPTIONS'])
    assert.throws(() => jdbcEnvironment(config, { [key]: '-Dunsafe' }));
});

test('example contains placeholders only and private paths are ignored by Git and Docker contexts', () => {
  const example = readFileSync(path.join(root, '.env.homolog.local.example'), 'utf8');
  assert.match(example, /NEON_HML_URL=postgresql:\/\/CHANGE_ME_security_test:CHANGE_ME_PASSWORD@/);
  const homolog = readFileSync(path.join(root, '.env.homolog.example'), 'utf8');
  assert.match(homolog, /^APP_ENVIRONMENT=homologation$/m);
  assert.match(homolog, /^HML_MIGRATIONS_APPROVED=false$/m);
  for (const relative of ['.env.homolog.local', '.env.homolog.backend.local', 'backend/.env.homolog.local', 'frontend/.env.homolog.local']) {
    assert.equal(execFileSync('git', ['check-ignore', '--no-index', relative], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(), relative);
    assert.equal(execFileSync('git', ['ls-files', '--', relative], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(), '');
  }
  for (const relative of ['.dockerignore', 'backend/.dockerignore', 'frontend/.dockerignore']) {
    const rules = readFileSync(path.join(root, relative), 'utf8').split(/\r?\n/);
    assert.ok(rules.includes('.env.*') || rules.includes('**/.env.*'));
    assert.ok(!rules.includes('!.env.homolog.local'));
  }
  assert.match(readFileSync(path.join(root, 'scripts/build-release-images.mjs'), 'utf8'), /git', \['archive'/);
});

test('CLI rejects private malformed input with sanitized stderr, no shell history arguments', () => fixture(directory => {
  mkdirSync(path.join(directory, 'scripts/homologation'), { recursive: true });
  for (const name of ['configure-neon-hml.mjs', 'neon-hml.mjs'])
    writeFileSync(path.join(directory, 'scripts/homologation', name), readFileSync(path.join(root, 'scripts/homologation', name)));
  writeFileSync(path.join(directory, '.env.homolog.local'), 'NEON_HML_URL=PRIVATE-sentinel-not-a-url');
  const child = spawnSync(process.execPath, [path.join(directory, 'scripts/homologation/configure-neon-hml.mjs'), '--inspect'], { encoding: 'utf8', windowsHide: true });
  assert.equal(child.status, 1);
  assert.ok(!child.stderr.includes('PRIVATE-sentinel'));
  assert.match(child.stderr, /inválida/);
  assert.equal(child.stdout, '');
}));

test('CLI checks and prepares an isolated config without secrets, overwrite or migrations', () => fixture(directory => {
  mkdirSync(path.join(directory, 'scripts/homologation'), { recursive: true });
  for (const name of ['configure-neon-hml.mjs', 'neon-hml.mjs'])
    cpSync(path.join(root, 'scripts/homologation', name), path.join(directory, 'scripts/homologation', name));
  for (const name of ['check-flyway-baseline.mjs', 'legacy-migrations-v24.json'])
    cpSync(path.join(root, 'scripts', name), path.join(directory, 'scripts', name));
  cpSync(path.join(root, 'backend/src/main/resources/db/migration'), path.join(directory, 'backend/src/main/resources/db/migration'), { recursive: true });
  writeFileSync(path.join(directory, '.gitignore'), '.env*.local\n');
  const privateFile = path.join(directory, '.env.homolog.local');
  writeFileSync(privateFile, `NEON_HML_URL=${raw('PRIVATE-prepare-sentinel')}\nNEON_HML_EXPECTED_HOST=${host}\nNEON_HML_ISOLATED=true\n`);
  execFileSync('git', ['init', '--quiet'], { cwd: directory, windowsHide: true });
  const run = mode => spawnSync(process.execPath, ['--env-file=.env.homolog.local', 'scripts/homologation/configure-neon-hml.mjs', mode], { cwd: directory, encoding: 'utf8', windowsHide: true });
  const check = run('--check');
  assert.equal(check.status, 0, check.stderr); assert.match(check.stdout, /NÃO TESTADA/);
  const prepare = run('--prepare');
  assert.equal(prepare.status, 0, prepare.stderr);
  const content = readFileSync(path.join(directory, '.env.homolog.backend.local'), 'utf8');
  assert.ok(!content.includes('PRIVATE-prepare-sentinel')); assert.ok(!content.includes('DB_PASSWORD'));
  const data = JSON.parse(content);
  assert.equal(data.HML_MIGRATIONS_APPROVED, 'false'); assert.equal(data.SPRING_PROFILES_ACTIVE, 'prod');
  assert.equal(data.DB_URL, parseNeonUrl(raw('unused'), settings).jdbcUrl);
  assert.equal(run('--prepare').status, 1);
  assert.equal(readFileSync(path.join(directory, '.env.homolog.backend.local'), 'utf8'), content);
  assert.match(readFileSync(privateFile, 'utf8'), /PRIVATE-prepare-sentinel/);
}));
