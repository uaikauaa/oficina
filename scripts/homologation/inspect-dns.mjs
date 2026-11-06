// Public DNS reads only. Never changes Registro.br or invents Firebase records.
import { promises as dns } from 'node:dns';
import { mkdirSync, writeFileSync } from 'node:fs';
const domain = 'oficinabrunosoldas.com.br';
const report = { checkedAt: new Date().toISOString(), domain, records: {} };
for (const name of [domain, 'www.' + domain]) {
  report.records[name] = {};
  for (const type of ['NS', 'A', 'AAAA', 'CNAME', 'MX', 'TXT']) {
    try { report.records[name][type] = await dns.resolve(name, type); }
    catch (error) { report.records[name][type] = { status: ['ENODATA', 'ENOTFOUND'].includes(error.code) ? error.code : 'NOT_TESTED' }; }
  }
}
report.firebaseRequiredRecords = 'PENDING_AUTHENTICATED_FIREBASE_RESPONSE';
report.dnsChanged = false;
mkdirSync('logs/homologation', { recursive: true });
writeFileSync('logs/homologation/dns.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
