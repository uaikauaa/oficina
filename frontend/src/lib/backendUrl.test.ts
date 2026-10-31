import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBackendOrigin } from './backendUrl.ts';
import { assertProxyTarget } from '../../docker-entrypoint.mjs';

test('proxy accepts only origins and never embeds credentials or URL paths', () => {
  assert.equal(validateBackendOrigin('https://backend.example.invalid/'), 'https://backend.example.invalid');
  assert.equal(validateBackendOrigin('http://backend:8080'), 'http://backend:8080');
  for (const url of ['file:///etc/passwd', 'https://u:p@host.invalid', 'https://host.invalid/path',
    'https://host.invalid/?token=value', 'https://host.invalid/#fragment', 'not a URL']) {
    assert.throws(() => validateBackendOrigin(url));
  }
});

test('standalone startup rejects runtime/build mismatch without revealing target values', () => {
  const manifest = { rewrites: { beforeFiles: [], afterFiles: [
    { source: '/api/:path*', destination: 'https://backend.example.invalid/api/:path*' },
  ], fallback: [] } };
  assert.doesNotThrow(() => assertProxyTarget(manifest, undefined));
  assert.doesNotThrow(() => assertProxyTarget(manifest, 'https://backend.example.invalid/'));
  assert.throws(() => assertProxyTarget(manifest, 'https://wrong.example.invalid'), /diverge do build/);
  assert.throws(() => assertProxyTarget({ rewrites: [] }, undefined), /ausente/);
});
