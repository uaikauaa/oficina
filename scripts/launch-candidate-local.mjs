// Private variables stay in the existing .env; this launcher never prints or copies them.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const osKeys = ['PATH','Path','SystemRoot','SYSTEMROOT','TEMP','TMP','USERPROFILE',
  'APPDATA','LOCALAPPDATA','HOME','ComSpec','COMSPEC','PATHEXT','JAVA_HOME'];
const baseEnv = Object.fromEntries(osKeys.filter(key => process.env[key])
  .map(key => [key,process.env[key]]));
const source = process.env.OFICINA_PRIVATE_ENV_FILE;
const mode = process.argv[2] || '--check';
if (!source || !resolve(source).startsWith(resolve(root, '..') + sep) || !existsSync(source))
  throw Error('Set OFICINA_PRIVATE_ENV_FILE to the approved external private .env');
const nextDotenv = ['.env','.env.local','.env.development','.env.development.local'];
if (existsSync(join(root, '.env')) || existsSync(join(root, 'backend', '.env')) ||
    readdirSync(join(root, 'frontend')).some(name => nextDotenv.includes(name)))
  throw Error('Candidate checkout must not contain a second .env');
const values = Object.create(null);
for (const line of readFileSync(source, 'utf8').split(/\r?\n/)) {
  const entry = line.trim(); if (!entry || entry.startsWith('#')) continue;
  const eq = entry.indexOf('='); if (eq < 1) throw Error('Malformed private configuration');
  const key = entry.slice(0,eq).trim();
  if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(key) || Object.hasOwn(values,key))
    throw Error('Invalid or duplicate private variable');
  let value = entry.slice(eq+1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    value = value.slice(1,-1);
  values[key] = value;
}
if (values.SPRING_PROFILES_ACTIVE !== 'dev') throw Error('Local profile must be dev');
if (Object.keys(values).some(key => key.startsWith('NEXT_PUBLIC_') ||
    (key.startsWith('SPRING_') && key !== 'SPRING_PROFILES_ACTIVE') ||
    /^(?:JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS|_JAVA_OPTIONS|MAVEN_OPTS|MAVEN_ARGS|NODE_OPTIONS|FLYWAY_|TEST_DB_|DOTENV_CONFIG_)/.test(key)))
  throw Error('Private file contains a configuration override or public frontend variable');
const db = values.DB_URL || '';
if (!db.startsWith('jdbc:postgresql://')) throw Error('JDBC URL required');
const url = new URL(db.slice(5));
if (url.searchParams.get('sslmode') !== 'verify-full' || url.username || url.password
    || url.port !== '5432' || !url.hostname.endsWith('.neon.tech') || url.hostname.includes('-pooler')
    || !(url.searchParams.has('sslrootcert')
         || url.searchParams.get('sslfactory') === 'org.postgresql.ssl.DefaultJavaSSLFactory'))
  throw Error('Direct PostgreSQL verified TLS configuration required');
if (!values.DB_USERNAME || !values.DB_PASSWORD || !values.JWT_SECRET || !values.RATE_LIMIT_SECRET
    || !values.INVITE_OUTBOX_KEYS || !values.MAIL_HOST || !values.MAIL_PASSWORD)
  throw Error('Required private configuration missing');
const publicUrl = new URL(values.APP_PUBLIC_URL || 'about:blank');
const backendUrl = new URL(values.INTERNAL_BACKEND_URL || 'about:blank');
const loopback = host => host === 'localhost' || host === '127.0.0.1';
if (publicUrl.protocol !== 'http:' || !loopback(publicUrl.hostname) ||
    backendUrl.protocol !== 'http:' || !loopback(backendUrl.hostname) ||
    values.SECURITY_COOKIE_SECURE !== 'false' ||
    !(values.CORS_ALLOWED_ORIGINS || '').split(',').some(origin => origin.trim() === publicUrl.origin))
  throw Error('Local public URL, CORS, cookie and backend origin mismatch');
if (values.INITIAL_ADMIN_EMAIL || values.INITIAL_ADMIN_PASSWORD || values.SUPER_ADMIN_BOOTSTRAP_EMAIL)
  throw Error('Legacy administrative bootstrap must remain disabled');
if (mode === '--check') {
  console.log('Candidate private configuration shape accepted offline; target identity and CA handshake remain unverified.');
  process.exit(0);
}
if (mode === '--frontend') {
  const childEnv = { ...baseEnv };
  childEnv.NODE_ENV = 'development';
  childEnv.INTERNAL_BACKEND_URL = values.INTERNAL_BACKEND_URL;
  if (!childEnv.INTERNAL_BACKEND_URL) throw Error('Frontend backend origin missing');
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['run','dev'], { cwd:join(root,'frontend'), env:childEnv, stdio:'inherit', shell:process.platform === 'win32' });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} else if (mode === '--backend') {
  if (process.argv[3] !== '--approved-migration-start' || !process.env.OFICINA_BACKEND_START_APPROVAL_FILE)
    throw Error('Backend startup requires a separately approved migration/start authorization file');
  const approval = resolve(process.env.OFICINA_BACKEND_START_APPROVAL_FILE);
  if (!existsSync(approval) || resolve(approval).startsWith(root)) throw Error('Private approval file required');
  const approved=Object.fromEntries(readFileSync(approval,'utf8').split(/\r?\n/)
    .filter(line=>line.includes('=')&&!line.trim().startsWith('#'))
    .map(line=>[line.slice(0,line.indexOf('=')).trim(),line.slice(line.indexOf('=')+1).trim()]));
  if (approved.operation!=='BACKEND_START_WITH_MIGRATIONS'
      || approved.expected_hostname!==url.hostname || approved.expected_database!==url.pathname.slice(1)
      || approved.expected_role!==values.DB_USERNAME
      || !approved.project_id || !approved.branch_id || !approved.compute_id
      || !approved.authorized_by || !approved.approval_reference
      || !approved.window_start_utc || !approved.window_end_utc
      || !Number.isFinite(Date.parse(approved.window_start_utc))
      || !Number.isFinite(Date.parse(approved.window_end_utc))
      || Date.now()<Date.parse(approved.window_start_utc)
      || Date.now()>=Date.parse(approved.window_end_utc))
    throw Error('Approved target mismatch');
  const childEnv = { ...baseEnv, ...values, SPRING_PROFILES_ACTIVE:'dev' };
  const command = process.platform === 'win32' ? 'mvnw.cmd' : './mvnw';
  const child = spawn(command, ['spring-boot:run'], { cwd:join(root,'backend'), env:childEnv, stdio:'inherit', shell:process.platform === 'win32' });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} else throw Error('Use --check, --frontend, or --backend with separate authorization');
