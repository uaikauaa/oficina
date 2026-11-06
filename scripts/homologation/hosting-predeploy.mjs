// The Firebase CLI hook is a public-impact gate, not an implicit deployment.
import { assertApprovedTarget, assertProjectMetadata, assertServiceMetadata, PROJECT_ID, REGION } from './cloud-target.mjs';
import { validateHostingConfiguration } from './hosting-config.mjs';
import { execFileSync } from 'node:child_process';
import { deploymentPlan } from './deployment-plan.mjs';
try {
  assertApprovedTarget(process.env);
  if (process.env.GCLOUD_PROJECT !== 'oficinagestao-homologacao'
      || process.env.HML_HOSTING_PUBLICATION_APPROVED !== 'true') throw new Error();
  validateHostingConfiguration();
  deploymentPlan(process.env); // Requires approved digests and numeric secret versions.
  const read = args => JSON.parse(execFileSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud', args, {
    encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true, timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }));
  assertProjectMetadata(read(['projects', 'describe', PROJECT_ID, '--format=json']));
  const service = read(['run', 'services', 'describe', 'oficina-frontend-hml', '--project=' + PROJECT_ID, '--region=' + REGION, '--format=json']);
  assertServiceMetadata(service, 'frontend');
  for (const name of ['SERVICE_PROXY_SECRET', 'FIREBASE_SESSION_SECRET']) {
    const version = service.spec.template.spec.containers[0].env.find(entry => entry.name === name)?.valueFrom?.secretKeyRef?.key;
    if (version !== process.env[`HML_${name}_VERSION`]) throw new Error();
  }
  if (service.spec.template.spec.containers[0].image !== process.env.HML_FRONTEND_IMAGE
      || !service.status?.latestReadyRevisionName || service.status.latestReadyRevisionName !== service.status.latestCreatedRevisionName) throw new Error();
  console.log('PASS: explicit publication gate and approved Firebase project.');
} catch {
  console.error('Hosting bloqueado: confirme projeto, número, região, isolamento e autorização explícita de publicação.');
  process.exitCode = 1;
}
