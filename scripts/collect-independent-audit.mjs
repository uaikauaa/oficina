// Collect only fresh local artifacts. Does not contact/deploy any remote service.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const out = 'docs/auditoria-independente-20261103';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => {
  const bytes = fs.readFileSync(file);
  return (bytes[0] === 255 && bytes[1] === 254 ? bytes.toString('utf16le') : bytes.toString('utf8')).replace(/^\uFEFF/, '');
};
const json = file => JSON.parse(read(file));
const save = (file, value) => fs.writeFileSync(`${out}/${file}`, JSON.stringify(value, null, 2) + '\n');
const command = (file, args) => execFileSync(file, args, { encoding: 'utf8', windowsHide: true }).trim();
const gates = [
  ['maven-clean', 'audit-independent-maven-final.log', /Tests run: 829, Failures: 0, Errors: 0, Skipped: 0/],
  ['maven-final-expanded', 'audit-independent-maven-complete.log', /Tests run: 830, Failures: 0, Errors: 0, Skipped: 0/],
  ['frontend-unit', 'audit-independent-unit.log', /(?:pass 376|passed 376)/],
  ['next-build', 'audit-independent-build.log', /Compiled successfully/],
  ['playwright-ui', 'audit-independent-playwright.log', /119 passed/],
  ['playwright-real-and-two-jvms', 'audit-independent-real.log', /restart with JWT key rotation preserved the block/],
  ['http-proxy-and-parser', 'audit-independent-proxy.log', /PASS: local Next HTTP\/1 parser rejects/],
  ['tls-smtp-local', 'audit-independent-tls.log', /pass 2/],
  ['docker-backend', 'audit-independent-docker-backend.log', /naming to docker.io\/library\/oficina-security-backend/],
  ['docker-frontend', 'audit-independent-docker-frontend.log', /naming to docker.io\/library\/oficina-security-frontend/],
];
const executions = gates.map(([name, file, expected]) => {
  const body = read(file);
  if (!expected.test(body)) throw new Error(`Missing passing evidence: ${name}`);
  return { name, localLog: file, sha256: digest(fs.readFileSync(file)), completedAt: fs.statSync(file).mtime.toISOString(), result: 'PASS' };
});
const suites = fs.readdirSync('backend/target/surefire-reports').filter(file => /^TEST-.*\.xml$/.test(file)).map(file => {
  const xml = read(`backend/target/surefire-reports/${file}`);
  const tag = xml.match(/<testsuite\s[^>]+>/)?.[0];
  const attr = name => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  return { name: attr('name'), tests: Number(attr('tests')), failures: Number(attr('failures')), errors: Number(attr('errors')), skipped: Number(attr('skipped')),
    cases: [...xml.matchAll(/<testcase\s[^>]*\bname="([^"]*)"/g)].map(match => match[1]) };
});
const totals = suites.reduce((sum, suite) => {
  for (const key of ['tests', 'failures', 'errors', 'skipped']) sum[key] += suite[key];
  return sum;
}, { tests: 0, failures: 0, errors: 0, skipped: 0 });
if (totals.tests !== 830 || totals.failures || totals.errors || totals.skipped) throw new Error('Fresh JUnit inventory is incomplete');
save('junit-cases.json', { totals, suites });
for (const file of ['independent-route-coverage.json', 'independent-negative-vectors.json']) fs.copyFileSync(`backend/target/${file}`, `${out}/${file}`);
const routes = json(`${out}/independent-route-coverage.json`);
if (routes.length !== 83) throw new Error('Route coverage is incomplete');
const trivy = {};
for (const name of ['backend', 'frontend', 'files']) {
  const report = json(`${out}/trivy-${name}.json`);
  if (!report.SchemaVersion || !report.CreatedAt) throw new Error(`Incomplete Trivy report ${name}`);
  trivy[name] = { createdAt: report.CreatedAt, artifact: report.ArtifactName, imageId: report.Metadata?.ImageID,
    vulnerabilities: (report.Results ?? []).flatMap(row => row.Vulnerabilities ?? []).length,
    secrets: (report.Results ?? []).flatMap(row => row.Secrets ?? []).length };
}
const files = new Set((command('git', ['ls-files', '-z']) + '\0' + command('git', ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean));
const audited = [...files].filter(file => /^(backend\/src\/(main|test)|frontend\/(src|e2e)|scripts|\.github\/workflows)\//.test(file)
  && /\.(java|sql|properties|ts|tsx|mjs|yml|sha256)$/.test(file)).sort();
const hashes = audited.map(file => ({ file, sha256Lf: digest(read(file).replace(/\r\n/g, '\n')) }));
save('source-fingerprints.json', hashes);
const appManifest = json('frontend/.next/server/app-paths-manifest.json');
save('next-app-manifest.json', Object.keys(appManifest).sort());
save('evidencias.json', {
  generatedAt: new Date().toISOString(), baseline: '6566c3a87a2c80433f84d851d8a83ea65dd2a250',
  branch: command('git', ['branch', '--show-current']), node: process.version,
  codeIdentity: 'source-fingerprints.json uses normalized LF SHA256; PR final head identifies the committed delivery',
  junit: totals, frontendUnit: { passed: 376, skipped: 0 }, playwright: { ui: 119, real: 1, skippedInExecutedRuns: 0 },
  apiMappings: routes.length, addedOrRemovedMappings: 0, negativeVectors: json(`${out}/independent-negative-vectors.json`),
  executions, trivy, npm: { runtime: json(`${out}/npm-audit-runtime.json`).metadata.vulnerabilities, full: json(`${out}/npm-audit-full.json`).metadata.vulnerabilities },
  remoteWorkflows: 'Consult PR #13 checks for the final commit; local records do not claim future CI success',
  externalControls: { googleCloudIam: 'NAO VERIFICADO', googleIngressIpAndTls: 'NAO VERIFICADO', neon: 'NAO VERIFICADO', smtpReal: 'NAO VERIFICADO', production: 'NAO APROVADA' },
});
console.log(JSON.stringify({ junit: totals, routes: routes.length, trivy, sourceFiles: hashes.length }));
