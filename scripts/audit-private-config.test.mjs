import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('offline config audit never emits supplied secret, host, role or malformed URL',()=>{
  const directory=mkdtempSync(path.join(os.tmpdir(),'oficina-config-audit-'));
  const file=path.join(directory,'.env');
  const sentinel='PrivateCanaryThatMustNeverAppear0123456789';
  try {
    writeFileSync(file,`DB_URL=jdbc:postgresql://private-canary.neon.tech/hidden?sslmode=verify-full\nDB_USERNAME=hidden_role\nDB_PASSWORD=${sentinel}\nJWT_SECRET=${sentinel}\nRATE_LIMIT_SECRET=${sentinel}\nINVITE_OUTBOX_KEYS=1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n`);
    const run=()=>execFileSync(process.execPath,['scripts/audit-private-config.mjs','--dotenv',file],{encoding:'utf8',windowsHide:true});
    const output=run(),report=JSON.parse(output).reports[0];
    for(const value of [sentinel,'private-canary','hidden_role'])assert.ok(!output.includes(value));
    assert.equal(report.presence.DB_PASSWORD,true);
    assert.equal(report.checks.databaseVerifyFull,true);
    assert.equal(report.checks.rateIndependent,false);
    assert.equal(report.checks.configuredSecretsDistinct,false);
    assert.equal(report.checks.outboxKeysAndActiveVersionValid,true);
    writeFileSync(file,`DB_URL=${sentinel}\nINVITE_OUTBOX_KEYS=${sentinel}\n`);
    const invalid=run(); assert.ok(!invalid.includes(sentinel));
    assert.equal(JSON.parse(invalid).reports[0].checks.databaseUrlParsable,false);
  } finally {unlinkSync(file);rmdirSync(directory);}
});
