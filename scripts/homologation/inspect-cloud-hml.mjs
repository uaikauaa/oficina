// Metadata only. Never creates services/secrets, reads secret payloads, changes IAM or deploys.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { assertApprovedTarget, assertProjectMetadata, PROJECT_ID, PROJECT_NUMBER, REGION, accounts } from './cloud-target.mjs';
const call = args => {
  try { return execFileSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud', args, {
    encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true, timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim(); } catch { throw new Error('gcloud não autenticado/disponível ou leitura não autorizada; detalhes omitidos.'); }
};
try {
  if (process.argv.slice(2).join(' ') !== '--metadata') throw new Error('Use --metadata; nenhuma mutação é permitida.');
  assertApprovedTarget(process.env);
  assertProjectMetadata(JSON.parse(call(['projects', 'describe', PROJECT_ID, '--format=json'])));
  const policy = JSON.parse(call(['projects', 'get-iam-policy', PROJECT_ID, '--format=json']));
  const identities = Object.values(accounts).map(account => 'serviceAccount:' + account);
  const broad = policy.bindings?.filter(binding => ['roles/owner', 'roles/editor', 'roles/secretmanager.secretAccessor'].includes(binding.role)
    && binding.members?.some(member => identities.includes(member) || ['allUsers', 'allAuthenticatedUsers'].includes(member))) || [];
  if (broad.length) throw new Error('IAM do projeto concede acesso amplo às identidades de execução; revisar antes de publicar.');
  const serviceAccounts = JSON.parse(call(['iam', 'service-accounts', 'list', '--project=' + PROJECT_ID, '--format=json']));
  for (const email of Object.values(accounts)) if (!serviceAccounts.some(account => account.email === email && !account.disabled)) throw new Error('Identidade esperada ausente/inativa.');
  const secretNames = JSON.parse(call(['secrets', 'list', '--project=' + PROJECT_ID, '--format=json'])).map(secret => secret.name.split('/').at(-1));
  const secrets = [];
  for (const name of ['JWT_SECRET', 'RATE_LIMIT_SECRET', 'SERVICE_PROXY_SECRET', 'DB_PASSWORD', 'MAIL_PASSWORD', 'FIREBASE_SESSION_SECRET', 'INITIAL_ADMIN_PASSWORD']) {
    if (!secretNames.includes(name)) { secrets.push({ name, exists: false }); continue; }
    const versions = JSON.parse(call(['secrets', 'versions', 'list', name, '--project=' + PROJECT_ID, '--format=json']));
    const secretPolicy = JSON.parse(call(['secrets', 'get-iam-policy', name, '--project=' + PROJECT_ID, '--format=json']));
    const access = secretPolicy.bindings?.filter(binding => binding.role === 'roles/secretmanager.secretAccessor').flatMap(binding => binding.members || []) || [];
    const allowed = name === 'SERVICE_PROXY_SECRET' ? [accounts.frontend, accounts.backend]
      : name === 'FIREBASE_SESSION_SECRET' ? [accounts.frontend] : [accounts.backend];
    if (access.some(member => !allowed.map(email => 'serviceAccount:' + email).includes(member))) throw new Error('Accessor inesperado em segredo; política não será alterada automaticamente.');
    secrets.push({ name, exists: true, enabledVersions: versions.filter(version => version.state === 'ENABLED').map(version => version.name.split('/').at(-1)),
      expectedIdentitiesBound: allowed.every(email => access.includes('serviceAccount:' + email)) });
  }
  const services = JSON.parse(call(['run', 'services', 'list', '--project=' + PROJECT_ID, '--region=' + REGION, '--format=json']));
  const repositories = JSON.parse(call(['artifacts', 'repositories', 'list', '--project=' + PROJECT_ID, '--location=' + REGION, '--format=json']));
  const token = call(['auth', 'print-access-token']);
  const response = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}`, {
    headers: { Authorization: 'Bearer ' + token }, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Metadados Firebase não acessíveis; identidade/número não confirmados.');
  const firebase = await response.json();
  if (firebase.projectId !== PROJECT_ID || String(firebase.projectNumber) !== PROJECT_NUMBER) throw new Error('Projeto Firebase incorreto.');
  const hostingResponse = await fetch(`https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites`, {
    headers: { Authorization: 'Bearer ' + token }, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!hostingResponse.ok) throw new Error('Sites Hosting não acessíveis.');
  const sites = (await hostingResponse.json()).sites || [];
  const site = sites.find(site => site.type === 'DEFAULT_SITE') || (sites.length === 1 ? sites[0] : undefined);
  const siteId = site?.name?.split('/').at(-1);
  const domains = [];
  if (siteId && /^[a-z0-9-]+$/.test(siteId)) {
    for (const domain of ['oficinabrunosoldas.com.br', 'www.oficinabrunosoldas.com.br']) {
      const domainResponse = await fetch(`https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites/${siteId}/customDomains/${domain}`, {
        headers: { Authorization: 'Bearer ' + token }, redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      if (domainResponse.status === 404) { domains.push({ domain, status: 'PENDING_NOT_REGISTERED' }); continue; }
      if (!domainResponse.ok) throw new Error('Metadados do domínio não acessíveis.');
      const data = await domainResponse.json();
      domains.push({ domain, hostState: data.hostState, ownershipState: data.ownershipState, certificateState: data.cert?.state,
        requiredDnsUpdates: data.requiredDnsUpdates || null, redirectTarget: data.redirectTarget || null });
    }
  }
  const report = { checkedAt: new Date().toISOString(), projectId: PROJECT_ID, projectNumber: PROJECT_NUMBER, region: REGION,
    serviceAccountsVerified: true, projectIamRead: true, inheritedIamBeyondProject: 'NOT_TESTED', secrets,
    cloudRunServices: services.map(service => service.metadata?.name), artifactRepositories: repositories.map(repository => repository.name),
    firebaseProjectVerified: true, hostingSite: siteId || null, domains, deployExecuted: false, productionApproved: false };
  mkdirSync('logs/homologation', { recursive: true });
  writeFileSync('logs/homologation/cloud-metadata.json', JSON.stringify(report, null, 2) + '\n');
  console.log('PASS: projeto/número, identidades e metadados verificados. Relatório sem segredos em logs/homologation/cloud-metadata.json. Nada alterado remotamente.');
} catch {
  console.error('BLOQUEADO: metadados Google Cloud/Firebase não aprovados. Verifique gcloud/login, projeto/número, IAM e isolamento; detalhes privados omitidos. Nenhuma mutação executada.');
  process.exitCode = 1;
}
