// Local-only evidence, deliberately excludes log content and environment properties.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const output='docs/admin-rbac/evidence-stage4a';
const hash=x=>createHash('sha256').update(x).digest('hex');
const read=file=>{const b=fs.readFileSync(file);return b.toString(b[0]===255 && b[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'');};
const specs=[
  ['backend','stage4a-maven.log',/Tests run: 893, Failures: 0, Errors: 0, Skipped: 0/],
  ['build','stage4a-build.log',/Compiled successfully/],
  ['real-browser','stage4a-real.log',/3 passed/],
  ['same-key-jvm-restart','stage4a-real.log',/same-key JVM restart rejects A, preserves B/],
  ['distributed-limiter','stage4a-real.log',/restart with JWT key rotation preserved the block/],
  ['outbox-restart','stage4a-real.log',/ciphertext was erased/],
  ['timing-diagnostic-only','stage4a-timing.log',/BUILD SUCCESS/],
  ['lint','stage4a-lint.log',/> eslint/],
  ['e2e-types','stage4a-e2e-types.log',/^\s*$/],
  ['production-npm-audit','stage4a-audit.log',/found 0 vulnerabilities/],
  ['tls-smtp-and-config-sanitization','stage4a-tools.log',/pass 3/],
];
const gates=specs.map(([name,file,expected])=>{
  if(!expected.test(read(file)))throw Error('Missing successful local evidence: '+name);
  return {name,log:file,sha256:hash(fs.readFileSync(file)),completedAt:fs.statSync(file).mtime.toISOString()};
});
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
const names=new Set((git(['diff','--name-only'])+'\n'+git(['ls-files','--others','--exclude-standard'])).split('\n'));
const sourceHashes=[...names].filter(p=>/^(backend\/src|frontend\/e2e|scripts\/|\.github\/)/.test(p))
  .filter(p=>fs.existsSync(p)).sort().map(file=>({file,sha256LF:hash(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'))}));
fs.writeFileSync(output+'/execution.json',JSON.stringify({referenceCommit:'ba18f6c9791f680c23bc1d8096824e927823c2c7',
  branch:git(['branch','--show-current']),scope:'Synthetic loopback PostgreSQL and SMTP only; no original Neon access',
  gates,sourceHashes},null,2)+'\n');
console.log('PASS: local evidence summarized without log contents or environment values');
