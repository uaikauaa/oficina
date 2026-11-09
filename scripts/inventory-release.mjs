import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Generated inventories are local artifacts. An explicit directory supports exports
// without overwriting the historical evidence already committed under docs/.
const outputDirectory = process.argv[2] ?? 'backups/repository-inventory';

const paths = execFileSync('git', ['ls-files', '-z']).toString('utf8').split('\0').filter(Boolean);
const rows = paths.map(path => {
  const bytes = readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const category = path.startsWith('docs/historico/') ? 'historico'
    : path.startsWith('docs/') ? 'evidencia-ou-documentacao'
    : /(^|\/)(test-results|playwright-report|target|\.next)\//.test(path) || /\.(log|tmp|cache)$/.test(path) ? 'temporario'
    : 'codigo-ou-configuracao-revisar';
  return { path, bytes: bytes.length, sha256, category };
});
const groups = Map.groupBy(rows, row => row.sha256);
for (const group of groups.values()) {
  if (group.length > 1) for (const row of group) row.category = 'duplicado-exato-revisar';
}
const csv = ['path,bytes,sha256,classification', ...rows.map(row =>
  [row.path, row.bytes, row.sha256, row.category].map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n') + '\n';
const output = `${outputDirectory}/inventario-inicial.csv`;
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, csv);
const duplicates = [...groups.values()].filter(group => group.length > 1)
  .map(group => ({ bytes: group[0].bytes, files: group.map(row => row.path) }))
  .sort((a, b) => b.bytes - a.bytes);
const lines = ['# Duplicatas exatas do inventário inicial', '',
  `Base: ${execFileSync('git', ['rev-parse', 'HEAD']).toString().trim()}; ${rows.length} arquivos versionados; ${rows.reduce((sum, row) => sum + row.bytes, 0)} bytes.`, '',
  ...duplicates.flatMap(group => [`- ${group.bytes} bytes por arquivo: ${group.files.map(file => `\`${file}\``).join(', ')}`])];
writeFileSync(`${outputDirectory}/duplicatas-iniciais.md`, lines.join('\n') + '\n');
console.log(`${rows.length} tracked files; ${duplicates.length} duplicate groups; ${duplicates.reduce((sum, group) => sum + group.bytes * (group.files.length - 1), 0)} potentially redundant bytes`);
