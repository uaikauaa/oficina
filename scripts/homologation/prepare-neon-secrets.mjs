// Metadata inspection and plan only. No resources, IAM bindings or versions are created.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigurationError, loadPrivateConfiguration } from './neon-hml.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
try {
  if (process.argv.slice(2).join(' ') !== '--plan') throw new ConfigurationError('Use --plan. Este script não altera recursos Google Cloud.');
  const { settings } = loadPrivateConfiguration(root);
  const call = args => execFileSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud', args, {
    windowsHide: true, shell: process.platform === 'win32', encoding: 'utf8', timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const project = 'oficinagestao-homologacao';
  const secrets = JSON.parse(call(['secrets', 'list', '--project=' + project, '--format=json']));
  for (const name of ['DB_PASSWORD', 'MAIL_PASSWORD', 'FIREBASE_SESSION_SECRET', 'INITIAL_ADMIN_PASSWORD']) {
    const exists = secrets.some(secret => secret.name?.split('/').at(-1) === name);
    let versions = [];
    if (exists) versions = JSON.parse(call(['secrets', 'versions', 'list', name, '--project=' + project, '--format=json']));
    console.log(`${name}: ${exists ? 'existe' : 'ausente'}; ${versions.length ? 'versões existentes preservadas' : 'sem versões'}; conteúdo ${name === 'DB_PASSWORD' || settings[name] ? 'disponível no arquivo privado' : 'pendente no arquivo privado'}.`);
  }
  console.log('PLANO: DB_PASSWORD recebe somente a senha extraída; envio futuro por stdin (--data-file=-), nunca por argv.');
  console.log('PLANO IAM: Secret Accessor no DB_PASSWORD somente para oficina-backend-hml@oficinagestao-homologacao.iam.gserviceaccount.com; auditar também permissões herdadas.');
  console.log('PLANO IAM: FIREBASE_SESSION_SECRET é independente (32 bytes aleatórios em base64), somente frontend; SERVICE_PROXY_SECRET permanece compartilhado somente entre frontend/backend.');
  console.log('Nenhuma criação, nova versão, alteração IAM ou implantação executada. Aprovação separada necessária para operações com cobrança.');
} catch (error) {
  console.error(error instanceof ConfigurationError ? error.message : 'Plano Google Cloud não verificado. Verifique gcloud, login e permissões de leitura; detalhes privados omitidos. Nenhum recurso alterado.');
  process.exitCode = 1;
}
