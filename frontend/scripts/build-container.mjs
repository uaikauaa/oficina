import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { deriveBuildKeys, normalizePreviewKeys, assertNoPublicBuildSecrets } from './release-build-keys.mjs';

const keyPath = '/run/secrets/next_actions_key';
const encoded = existsSync(keyPath) ? readFileSync(keyPath, 'utf8').trim() : randomBytes(32).toString('base64');
if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error('Invalid private release seed encoding');
// Ordinary local compose builds remain supported; only the release script
// requires a committed SHA and an externally retained, private seed.
const revision = process.env.OFICINA_BUILD_ID === 'development' ? '0'.repeat(40) : process.env.OFICINA_BUILD_ID;
const seed = Buffer.from(encoded, 'base64');
const keys = deriveBuildKeys(seed, revision);
execFileSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
  stdio: 'inherit', env: { ...process.env, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: keys.actions },
});
const version = JSON.parse(readFileSync('node_modules/next/package.json', 'utf8')).version;
normalizePreviewKeys('.next/standalone', keys, version);
assertNoPublicBuildSecrets('.next/static', seed, keys);
assertNoPublicBuildSecrets('public', seed, keys);
console.log('PASS: private release inputs normalized; no build keys in public artifacts.');
