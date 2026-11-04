import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const historical = readFileSync(path.join(root, 'backend/src/main/resources/db/migration/V11__create_configuracao_oficina.sql'), 'utf8');
const values = [...historical.split(') VALUES (')[1].matchAll(/'([^']*)'/g)].map(match => match[1].toLowerCase());
// Identify private business fields from the immutable legacy seed, without copying or printing them.
const forbidden = [1, 2, 3, 6, 7, 8, 9, 11, 12].map(index => values[index]);
assert.ok(forbidden.every(value => typeof value === 'string' && value.length >= 5));
const roots = process.argv.includes('--bundle') ? ['frontend/.next/static'] : ['frontend/src', 'backend/src/main/java'];
let files = 0;
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) inspect(file);
    else if (/\.(tsx?|java|js|json|css)$/.test(file) && !/\.(test|spec)\./.test(file)) {
      files++;
      const text = readFileSync(file, 'utf8').toLowerCase();
      assert.ok(!forbidden.some(value => text.includes(value)), `Legacy business identity found in ${path.relative(root, file)}; values omitted`);
    }
  }
}
for (const dir of roots) { assert.ok(existsSync(path.join(root, dir))); inspect(path.join(root, dir)); }
assert.ok(files > 0);
console.log(`PASS: ${files} runtime/bundle files checked; no legacy business identity fallback.`);
