// --check is offline; --inspect uses read-only JDBC. Neither mode migrates or deploys.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigurationError, loadPrivateConfiguration, jdbcEnvironment } from './neon-hml.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
try {
  const mode = process.argv.slice(2);
  if (mode.length !== 1 || !['--check', '--inspect', '--prepare'].includes(mode[0]))
    throw new ConfigurationError('Use --check (local), --prepare (arquivo privado sem senhas) ou --inspect (JDBC remoto somente leitura).');
  const { config } = loadPrivateConfiguration(root);
  const call = (command, args, options = {}) => execFileSync(command, args, {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000, ...options,
  });
  const ignored = call('git', ['check-ignore', '--no-index', '.env.homolog.local']).trim();
  const tracked = call('git', ['ls-files', '--', '.env.homolog.local']).trim();
  if (ignored !== '.env.homolog.local' || tracked) throw new ConfigurationError('Arquivo privado deve estar ignorado e fora do índice Git.');
  call(process.execPath, ['scripts/check-flyway-baseline.mjs']);
  console.log('PASS: URL privada, isolamento declarado, bloqueio de endpoints operacionais, TLS verify-full, Git e B24/V1–V24 validados localmente.');
  if (mode[0] === '--inspect') {
    const version = readFileSync(path.join(root, 'backend/pom.xml'), 'utf8').match(/<postgresql.version>([^<]+)<\/postgresql.version>/)?.[1];
    const jar = path.join(homedir(), '.m2/repository/org/postgresql/postgresql', version, `postgresql-${version}.jar`);
    if (!existsSync(jar)) throw new ConfigurationError('Driver JDBC ausente. Execute backend/mvnw dependency:go-offline antes da inspeção.');
    // No credentials in argv, stdout, stderr, generated files or GitHub Actions.
    const result = call('java', ['--class-path', jar, 'scripts/homologation/CheckNeonTls.java'], { env: jdbcEnvironment(config) });
    if (!result.startsWith('PASS:')) throw new ConfigurationError('Inspeção JDBC sem evidência válida; migrations bloqueadas.');
    console.log(result.trim());
  } else if (mode[0] === '--prepare') {
    const destination = path.join(root, '.env.homolog.backend.local');
    if (existsSync(destination)) throw new ConfigurationError('.env.homolog.backend.local já existe; não será sobrescrito.');
    writeFileSync(destination, JSON.stringify({ SPRING_PROFILES_ACTIVE: 'prod', APP_ENVIRONMENT: 'homologation',
      DB_URL: config.jdbcUrl, DB_USERNAME: config.user, HML_NEON_ISOLATED: 'true', HML_DB_HOST: config.host,
      HML_DB_NAME: config.database, HML_DB_USER: config.user, HML_APPROVED_DATABASE: config.database,
      HML_MIGRATIONS_APPROVED: 'false', SECURITY_COOKIE_SECURE: 'true', HIKARI_MAX_POOL_SIZE: '5', HIKARI_MIN_IDLE: '0',
      SWAGGER_ENABLED: 'false', API_DOCS_ENABLED: 'false',
    }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('PASS: .env.homolog.backend.local preparado em JSON para --env-vars-file. Sem senhas; migrations bloqueadas até autorização explícita.');
  } else console.log('CONEXÃO NEON: NÃO TESTADA. Execute --inspect para inspecionar TLS/JDBC e banco vazio; nenhuma migration será executada.');
} catch (error) {
  console.error(error instanceof ConfigurationError ? error.message : 'FAIL: verificação local/JDBC falhou; detalhes privados omitidos. Nenhuma migration executada.');
  process.exitCode = 1;
}
