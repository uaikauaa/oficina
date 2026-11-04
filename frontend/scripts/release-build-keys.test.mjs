import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deriveBuildKeys, normalizePreviewKeys, assertNoPublicBuildSecrets } from './release-build-keys.mjs';

test('private inputs reproduce independently separated keys and rotate across releases', () => {
  const seed = randomBytes(32);
  const keys = deriveBuildKeys(seed, 'a'.repeat(40));
  assert.deepEqual(keys, deriveBuildKeys(seed, 'a'.repeat(40)));
  assert.notDeepEqual(keys, deriveBuildKeys(seed, 'b'.repeat(40)));
  assert.notDeepEqual(keys, deriveBuildKeys(randomBytes(32), 'a'.repeat(40)));
  assert.equal(new Set([Buffer.from(keys.actions, 'base64').toString('hex'), ...Object.values(keys.preview)]).size, 4);
  assert.throws(() => deriveBuildKeys(Buffer.alloc(8), 'a'.repeat(40)));
  assert.throws(() => deriveBuildKeys(seed, 'main'));
});

test('preview normalization preserves routes and fails closed for an unknown consumer or version', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'oficina-preview-test-'));
  try {
    mkdirSync(path.join(directory, '.next/server'), { recursive: true });
    const old = deriveBuildKeys(randomBytes(32), 'a'.repeat(40));
    const replacement = deriveBuildKeys(randomBytes(32), 'a'.repeat(40));
    const manifestPath = path.join(directory, '.next/prerender-manifest.json');
    const propsPath = path.join(directory, '.next/server/preview-props.json');
    writeFileSync(manifestPath, JSON.stringify({ version: 4, routes: { '/': { initialRevalidateSeconds: false } }, preview: old.preview }));
    writeFileSync(propsPath, JSON.stringify(old.preview));
    assert.throws(() => normalizePreviewKeys(directory, replacement, 'future'), /compatibility/);
    const consumer = path.join(directory, 'consumer.js');
    writeFileSync(consumer, old.preview.previewModeSigningKey);
    assert.throws(() => normalizePreviewKeys(directory, replacement, '16.4.1'), /Additional compiled/);
    assert.deepEqual(JSON.parse(readFileSync(propsPath)), old.preview);
    rmSync(consumer);
    normalizePreviewKeys(directory, replacement, '16.4.1');
    assert.deepEqual(JSON.parse(readFileSync(propsPath)), replacement.preview);
    assert.deepEqual(JSON.parse(readFileSync(manifestPath)).routes, { '/': { initialRevalidateSeconds: false } });
  } finally { rmSync(directory, { recursive: true }); }
});

test('public output rejects private keys without printing the value', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'oficina-public-test-'));
  try {
    const seed = randomBytes(32);
    const keys = deriveBuildKeys(seed, 'a'.repeat(40));
    writeFileSync(path.join(directory, 'client.js'), 'public content');
    assert.doesNotThrow(() => assertNoPublicBuildSecrets(directory, seed, keys));
    writeFileSync(path.join(directory, 'client.js'), keys.preview.previewModeEncryptionKey);
    assert.throws(() => assertNoPublicBuildSecrets(directory, seed, keys), /Private build input/);
  } finally { rmSync(directory, { recursive: true }); }
});
