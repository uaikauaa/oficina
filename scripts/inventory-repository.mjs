import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' })
  .toString('utf8').split('\0').filter(Boolean);
const role = (p) => {
  if (p.endsWith('/.gitkeep')) return ['REDUNDANTE', 'Marcador de diretório já preenchido', 'baixo'];
  if (p.startsWith('backend/src/main/resources/db/migration/')) return ['ESSENCIAL', 'Migração Flyway', 'alto'];
  if (p.startsWith('backend/src/test/resources/db/synthetic-migration/')) return ['ESSENCIAL', 'Migração isolada de teste', 'alto'];
  if (p.startsWith('backend/')) return ['ESSENCIAL', 'Backend ou teste', 'alto'];
  if (p.startsWith('frontend/')) return ['ESSENCIAL', 'Frontend ou teste', 'alto'];
  if (p.startsWith('.github/')) return ['ESSENCIAL', 'Automação de CI', 'alto'];
  if (p.startsWith('scripts/')) return ['ÚTIL', 'Script operacional ou de auditoria', 'médio'];
  if (p.startsWith('docs/historico/') || p.startsWith('docs/auditoria/') || p.startsWith('docs/visual/'))
    return ['ÚTIL', 'Registro histórico ou evidência visual', 'médio'];
  if (p.startsWith('docs/')) return ['ÚTIL', 'Documentação ou evidência', 'médio'];
  if (p.endsWith('.example')) return ['ÚTIL', 'Modelo de configuração sem credencial', 'médio'];
  if (p.startsWith('nginx/') || p.startsWith('ops/') || p === 'docker-compose.yml')
    return ['ESSENCIAL', 'Infraestrutura ou recuperação', 'alto'];
  return ['ÚTIL', 'Configuração ou documentação raiz', 'médio'];
};
const csv = (s) => `"${String(s).replaceAll('"', '""')}"`;
const rows = [['caminho', 'bytes', 'sha256', 'classe', 'finalidade', 'risco_remocao']];
for (const path of files) {
  const [kind, purpose, risk] = role(path);
  const content = readFileSync(path);
  rows.push([path, statSync(path).size, createHash('sha256').update(content).digest('hex'), kind, purpose, risk]);
}
mkdirSync('docs/repository-audit', { recursive: true });
writeFileSync('docs/repository-audit/inventory.csv', rows.map((r) => r.map(csv).join(',')).join('\n') + '\n');
console.log(`${files.length} arquivos versionados inventariados`);
