// B24 is a new Flyway baseline migration. Historical V1-V24 must never be edited.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'backend/src/main/resources/db/migration');
const normalized = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const manifest = JSON.parse(normalized(path.join(root, 'scripts/legacy-migrations-v24.json')));
let baseline = '-- B24: schema equivalent to V24, for NEW databases only.\n'
  + '-- Existing Flyway histories ignore this baseline; V1-V24 remain unchanged.\n'
  + '-- No business identity, account, password, address or contact is seeded.\n'
  + '-- Generated and checked by scripts/check-flyway-baseline.mjs.\n\n';
for (const { file, sha256 } of manifest) {
  const original = normalized(path.join(directory, file));
  assert.equal(createHash('sha256').update(original).digest('hex'), sha256, `Historical migration changed: ${file}`);
  const version = Number(file.match(/^V(\d+)__/)[1]);
  if (version === 12) continue; // Only legacy identity DML; no schema changes.
  let sql = original;
  if (version === 11) {
    assert.equal(sql.split('INSERT INTO configuracao_oficina').length, 2);
    sql = sql.split('INSERT INTO configuracao_oficina')[0]
      + "INSERT INTO configuracao_oficina (nome_sistema, nome_fantasia) VALUES ('Oficina Gestão', 'Oficina não configurada');\n";
  }
  // Frozen input SQL uses line comments, with no '--' inside string literals.
  sql = sql.replace(/--[^\n]*/g, '').split('\n').map(line => line.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  baseline += `-- Schema/reference data from V${version}; V11 has a neutral singleton.\n${sql}\n\n`;
}
assert.equal(manifest.length, 24);
baseline = baseline.trimEnd() + '\n';
const file = path.join(directory, 'B24__neutral_initial_schema.sql');
if (process.argv.includes('--write')) writeFileSync(file, baseline);
else assert.equal(normalized(file), baseline, 'B24 drifted from its reviewed schema/reference data');
assert.ok(readdirSync(directory).includes('V12__update_admin_and_config_defaults.sql'));
console.log('PASS: V1-V24 unchanged; B24 is the reviewed neutral initial schema.');
