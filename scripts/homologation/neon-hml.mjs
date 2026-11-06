// Pure parsing and local configuration. Never falls back to the development DB.
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';

export class ConfigurationError extends Error {}
const fail = message => { throw new ConfigurationError(message); };
const placeholder = value => /CHANGE.?ME|PLACEHOLDER|example\.invalid|[<>]|\$\{/i.test(value);
const endpoint = host => host.toLowerCase().replace('-pooler.', '.');

export function parseNeonUrl(raw, settings, operationalHosts = []) {
  if (!raw || placeholder(raw)) fail('Preencha NEON_HML_URL em .env.homolog.local com o banco isolado.');
  let url;
  try { url = new URL(raw); } catch { fail('NEON_HML_URL inválida; detalhes privados omitidos.'); }
  const host = url.hostname;
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hash || (url.port && url.port !== '5432')
      || !/^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)*\.neon\.tech$/.test(host)) fail('Exigida origem Neon válida na porta 5432.');
  if (host.includes('-pooler') || !host.endsWith('.sa-east-1.aws.neon.tech'))
    fail('Exigida conexão direta Neon em sa-east-1, sem pooler.');
  if (host !== settings.NEON_HML_EXPECTED_HOST || settings.NEON_HML_ISOLATED !== 'true')
    fail('Confirme NEON_HML_EXPECTED_HOST e NEON_HML_ISOLATED=true para o projeto/branch novo.');
  if (operationalHosts.map(endpoint).includes(endpoint(host))) fail('Endpoint operacional conhecido bloqueado, inclusive alias pooler.');
  let user, password, database;
  try { user = decodeURIComponent(url.username); password = decodeURIComponent(url.password); database = decodeURIComponent(url.pathname.slice(1)); }
  catch { fail('Codificação inválida nos campos privados da URL.'); }
  if (!/^[a-z0-9_]*security_test[a-z0-9_]*$/.test(user) || !password || /[\x00-\x1f\x7f]/.test(password))
    fail('Exigidos papel dedicado contendo security_test e senha não vazia, sem caracteres de controle.');
  if (!/^[a-z][a-z0-9_]*_security_test$/.test(database)
      || (database !== 'oficina_security_test' && database !== settings.NEON_HML_APPROVED_DATABASE))
    fail('Use oficina_security_test ou aprove explicitamente outro nome terminado em _security_test.');
  const seen = new Set();
  for (const [key] of url.searchParams) {
    if (seen.has(key) || !['sslmode', 'channel_binding'].includes(key)) fail('Parâmetro duplicado ou não autorizado na URL.');
    seen.add(key);
  }
  if (url.searchParams.get('sslmode') !== 'verify-full') fail('TLS exige sslmode=verify-full; require não valida a identidade.');
  if (url.searchParams.get('channel_binding') !== 'require') fail('Exigido channel_binding=require explícito.');
  const channelBinding = 'require';
  return { host, database, user, password, jdbcUrl: `jdbc:postgresql://${host}:5432/${database}?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory&channelBinding=${channelBinding}` };
}

export function loadPrivateConfiguration(root) {
  const file = path.join(root, '.env.homolog.local');
  if (!existsSync(file)) fail('Crie .env.homolog.local a partir de .env.homolog.local.example e preencha NEON_HML_URL.');
  let settings;
  try { settings = parseEnv(readFileSync(file, 'utf8')); } catch { fail('Não foi possível ler .env.homolog.local.'); }
  if (settings.NEON_HML_CREDENTIAL_ROTATED !== 'true') fail('Rotacione a senha exposta, preencha somente o arquivo privado e confirme NEON_HML_CREDENTIAL_ROTATED=true.');
  if (settings.NEON_HML_PROJECT !== 'oficina-homologacao' || settings.NEON_HML_BRANCH !== 'production'
      || settings.NEON_HML_PROJECT_ISOLATED !== 'true')
    fail('Confirme o projeto oficina-homologacao, branch production e NEON_HML_PROJECT_ISOLATED=true após auditar ausência de dados operacionais.');
  const operationalHosts = [];
  // Read identifiers only to build a denylist; never use these credentials to connect.
  for (const relative of ['.env', 'backend/.env', '.env.production', '.env.development']) {
    const candidate = path.join(root, relative);
    if (!existsSync(candidate)) continue;
    try {
      const value = parseEnv(readFileSync(candidate, 'utf8')).DB_URL;
      if (value) {
        const host = new URL(value.replace(/^jdbc:/, '')).hostname;
        if (!host) fail('Não foi possível validar a lista local de endpoints operacionais.');
        operationalHosts.push(host);
      }
    } catch { fail('Não foi possível validar a lista local de endpoints operacionais; conexão bloqueada.'); }
  }
  const config = parseNeonUrl(settings.NEON_HML_URL, settings, operationalHosts);
  if (config.database !== 'oficina_security_test' || config.user !== 'oficina_security_test_owner')
    fail('O fluxo atual exige banco oficina_security_test e role oficina_security_test_owner.');
  return { config, settings };
}

export function jdbcEnvironment(config, env = process.env) {
  if (['JAVA_TOOL_OPTIONS', '_JAVA_OPTIONS', 'JDK_JAVA_OPTIONS'].some(key => env[key]))
    fail('Remova overrides de JVM antes da inspeção TLS.');
  return { ...env, HML_NEON_ISOLATED: 'true', HML_DB_HOST: config.host, HML_DB_NAME: config.database,
    HML_EXPECTED_HOST: config.host, HML_APPROVED_DATABASE: config.database,
    HML_DB_USER: config.user, HML_DB_PASSWORD: config.password };
}
