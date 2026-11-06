import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { deploymentPlan } from './deployment-plan.mjs';
try {
  if (process.argv.slice(2).join(' ') !== '--plan') throw new Error();
  const settings = parseEnv(readFileSync('.env.cloud.homolog.local', 'utf8'));
  const plan = deploymentPlan(settings);
  writeFileSync('.env.cloud.deploy-plan.local', JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('PASS: plano privado de comandos criado sem executar deploy/IAM. Exige autorização separada e env-vars privados revisados.');
} catch {
  console.error('Plano bloqueado: preencha .env.cloud.homolog.local com projeto/isolamento, digests e versões aprovadas. Arquivo existente não é sobrescrito. Nenhum comando cloud executado.');
  process.exitCode = 1;
}
