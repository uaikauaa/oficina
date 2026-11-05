import { hkdfSync } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ensure = (condition, message) => { if (!condition) throw new Error(message); };

// The seed is a PRIVATE release input, never a public hash or a runtime secret.
// Domain separation preserves independent 256-bit keys, including across SHAs.
export function deriveBuildKeys(seed, revision) {
  ensure(Buffer.isBuffer(seed) && seed.length === 32, 'Expected a private 32-byte release seed');
  ensure(/^[a-f0-9]{40}$/.test(revision), 'Expected the full source SHA');
  const derive = (purpose, length = 32) => Buffer.from(hkdfSync('sha256', seed, revision, 'oficina-next-build-v1/' + purpose, length));
  return {
    actions: derive('server-actions').toString('base64'),
    preview: {
      previewModeId: derive('preview-id', 16).toString('hex'),
      previewModeSigningKey: derive('preview-signing').toString('hex'),
      previewModeEncryptionKey: derive('preview-encryption').toString('hex'),
    },
  };
}

function* files(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(file);
    else if (entry.isFile()) yield file;
  }
}

// Next 16.4.1 has no supported preview-key environment setting. Its standalone
// runtime reads these two manifests. Normalize only those private inputs after
// compilation, with fail-closed checks for any additional key consumer. Do not
// patch framework code, global randomness, timestamps or authentication logic.
export function normalizePreviewKeys(standalone, keys, nextVersion) {
  ensure(nextVersion === '16.4.1', 'Review preview manifest compatibility when upgrading Next');
  const manifestPath = path.join(standalone, '.next/prerender-manifest.json');
  const propsPath = path.join(standalone, '.next/server/preview-props.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const props = JSON.parse(readFileSync(propsPath, 'utf8'));
  const names = ['previewModeId', 'previewModeSigningKey', 'previewModeEncryptionKey'];
  ensure(Object.keys(props).sort().join() === [...names].sort().join(), 'Unexpected preview manifest structure');
  for (const name of names) {
    const pattern = name === 'previewModeId' ? /^[a-f0-9]{32}$/ : /^[a-f0-9]{64}$/;
    ensure(pattern.test(props[name]) && props[name] === manifest.preview?.[name], 'Inconsistent preview manifests; values omitted');
  }
  const oldValues = names.map(name => Buffer.from(props[name]));
  for (const file of files(standalone)) {
    if (file === manifestPath || file === propsPath) continue;
    const content = readFileSync(file);
    ensure(!oldValues.some(value => content.includes(value)), 'Additional compiled preview-key consumer; review required');
  }
  manifest.preview = keys.preview;
  writeFileSync(manifestPath, JSON.stringify(manifest));
  writeFileSync(propsPath, JSON.stringify(keys.preview));
}

export function assertNoPublicBuildSecrets(publicDirectory, seed, keys) {
  const secrets = [seed.toString('base64'), seed.toString('hex'), keys.actions,
    keys.preview.previewModeSigningKey, keys.preview.previewModeEncryptionKey].map(value => Buffer.from(value));
  for (const file of files(publicDirectory)) {
    const content = readFileSync(file);
    ensure(!secrets.some(secret => content.includes(secret)), 'Private build input in public artifact; values omitted');
  }
}
