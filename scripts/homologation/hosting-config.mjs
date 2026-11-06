import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PROJECT_ID, REGION } from './cloud-target.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function validateHostingConfiguration(directory = root) {
  const rc = JSON.parse(readFileSync(path.join(directory, '.firebaserc'), 'utf8'));
  assert.deepEqual(rc.projects, { default: PROJECT_ID });
  const hosting = JSON.parse(readFileSync(path.join(directory, 'firebase.json'), 'utf8')).hosting;
  assert.equal(hosting.public, 'firebase-public');
  // No static index.html fallback: every application path reaches Next SSR.
  assert.deepEqual(readdirSync(path.join(directory, 'firebase-public')), ['.gitkeep']);
  assert.deepEqual(hosting.rewrites, [{ source: '**', run: { serviceId: 'oficina-frontend-hml', region: REGION, pinTag: true } }]);
  assert.deepEqual(hosting.predeploy, ['node scripts/homologation/hosting-predeploy.mjs']);
  assert.ok(!hosting.redirects, 'Domínio canônico exige registros/aceite reais antes de redirecionar');
  return true;
}
