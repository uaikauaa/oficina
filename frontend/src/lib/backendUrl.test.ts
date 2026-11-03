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

test('standalone validates the runtime origin and refuses insecure Cloud Run configuration', () => {
  const manifest = { rewrites: { beforeFiles: [], afterFiles: [
    { source: '/api/:path*', destination: 'https://backend.example.invalid/api/:path*' },
  ], fallback: [] } };
  assert.throws(() => assertProxyTarget(manifest, undefined));
  assert.doesNotThrow(() => assertProxyTarget(manifest, 'https://backend.example.invalid/'));
  assert.doesNotThrow(() => assertProxyTarget(manifest, 'https://runtime.example.invalid'));
  assert.throws(() => assertProxyTarget({}, 'http://backend:8080', { K_SERVICE: 'synthetic' }), /HTTPS/);
  assert.throws(() => assertProxyTarget({}, 'https://backend.invalid', { K_SERVICE: 'synthetic', CLOUD_RUN_IAM: 'false' }), /identidade/);
});
