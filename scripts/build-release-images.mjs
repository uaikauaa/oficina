// Local artifact build only. Never authenticates to a registry, pushes or deploys.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, windowsHide: true, encoding: 'utf8', ...options });
const sha = run('git', ['rev-parse', 'HEAD']).trim();
assert.match(sha, /^[a-f0-9]{40}$/);
assert.equal(run('git', ['status', '--porcelain', '--untracked-files=no']).trim(), '', 'Commit tracked changes before a release build');
const epoch = run('git', ['show', '-s', '--format=%ct', sha]).trim();
const inputs = JSON.parse(readFileSync(path.join(root, 'scripts/release-build-inputs.json'), 'utf8'));
const keyFile = process.env.OFICINA_ACTIONS_KEY_FILE;
assert.ok(keyFile && path.isAbsolute(keyFile), 'Supply an absolute, non-versioned OFICINA_ACTIONS_KEY_FILE (32 random bytes, base64)');
const key = readFileSync(keyFile, 'utf8').trim();
assert.match(key, /^[A-Za-z0-9+/]{43}=$/, 'Invalid build key encoding; value omitted');
assert.equal(Buffer.from(key, 'base64').length, 32);
const output = path.resolve(process.env.OFICINA_BUILD_OUTPUT || path.join(root, 'build/release-images', sha));
assert.ok(!existsSync(output), 'Use a new output directory; existing release artifacts are never overwritten');
mkdirSync(output, { recursive: true });
const workspace = mkdtempSync(path.join(tmpdir(), 'oficina-release-'));
const builder = 'oficina-release-' + randomUUID().slice(0, 8);
let builderCreated = false;
try {
  // Only committed files become build inputs, even if the worktree contains ignored local files.
  const archive = path.join(workspace, 'source.tar');
  writeFileSync(archive, run('git', ['archive', '--format=tar', sha, 'backend', 'frontend'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }));
  run('tar', ['-xf', archive, '-C', workspace]);
  run('docker', ['buildx', 'create', '--name', builder, '--driver', 'docker-container', '--driver-opt', 'image=' + inputs.buildkit]);
  builderCreated = true;
  const result = { sourceSha: sha, sourceDateEpoch: Number(epoch), inputs, reproduced: process.argv.includes('--verify-reproducible'), images: {}, published: false };
  for (const service of ['backend', 'frontend']) {
    const dockerfile = readFileSync(path.join(workspace, service, 'Dockerfile'), 'utf8');
    for (const base of (service === 'backend' ? [inputs.maven, inputs.java] : [inputs.node])) assert.ok(dockerfile.includes(base), 'Dockerfile/lock mismatch');
    const digests = [];
    for (let iteration = 1; iteration <= (result.reproduced ? 2 : 1); iteration++) {
      const target = path.join(output, `${service}-${iteration}.oci.tar`);
      run('docker', ['buildx', 'build', '--builder', builder, '--platform', inputs.platform, '--no-cache', '--pull',
        '--provenance=false', '--sbom=false', '--build-arg', 'SOURCE_DATE_EPOCH=' + epoch,
        '--build-arg', 'SOURCE_REVISION=' + sha,
        ...(service === 'frontend' ? ['--secret', 'id=next_actions_key,src=' + keyFile] : []),
        '--output', 'type=oci,dest=' + target + ',rewrite-timestamp=true',
        '--metadata-file', path.join(output, `${service}-${iteration}.metadata.json`), path.join(workspace, service)], { stdio: 'inherit' });
      const index = JSON.parse(run('tar', ['-xOf', target, 'index.json']));
      assert.equal(index.manifests.length, 1, 'Exactly one platform manifest is expected');
      const digest = index.manifests[0].digest;
      assert.match(digest, /^sha256:[a-f0-9]{64}$/);
      digests.push(digest);
    }
    assert.ok(digests.every(digest => digest === digests[0]), `${service} manifests differ across independent no-cache builds`);
    result.images[service] = { digest: digests[0], comparedDigests: digests, archive: `${service}-1.oci.tar` };
  }
  writeFileSync(path.join(output, 'release-manifest.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (builderCreated) run('docker', ['buildx', 'rm', builder]);
  const actual = realpathSync(workspace);
  assert.equal(actual, path.resolve(workspace));
  assert.ok(actual.startsWith(path.join(realpathSync(tmpdir()), 'oficina-release-')));
  rmSync(actual, { recursive: true });
}
