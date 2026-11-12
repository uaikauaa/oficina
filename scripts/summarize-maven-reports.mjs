// Counts JUnit XML, not overwritten @Nested textual container summaries.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const directory=process.argv[2] || 'backend/target/surefire-reports';
const suites=fs.readdirSync(directory).filter(f=>/^TEST-.*\.xml$/.test(f)).sort().map(file=>{
  const bytes=fs.readFileSync(path.join(directory,file)), xml=bytes.toString('utf8');
  const tag=xml.match(/<testsuite\s[^>]+>/)?.[0];
  if(!tag)throw Error('Missing suite');
  const attr=n=>tag.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1];
  const summaryFile=path.join(directory,file.slice(5,-4)+'.txt');
  const textTests=fs.existsSync(summaryFile)?Number(fs.readFileSync(summaryFile,'utf8').match(/Tests run: (\d+)/)?.[1]):null;
  const row={name:attr('name'),tests:Number(attr('tests')),failures:Number(attr('failures')),errors:Number(attr('errors')),
    skipped:Number(attr('skipped')),cases:(xml.match(/<testcase\s/g)||[]).length,textTests,
    sha256:createHash('sha256').update(bytes).digest('hex')};
  if(row.cases!==row.tests)throw Error('XML testcase count differs from suite total');
  return row;
});
const totals=suites.reduce((sum,row)=>{for(const k of ['tests','failures','errors','skipped'])sum[k]+=row[k];return sum;},
  {tests:0,failures:0,errors:0,skipped:0});
console.log(JSON.stringify({totals,textTests:suites.reduce((s,r)=>s+(r.textTests||0),0),
  textDiscrepancies:suites.filter(r=>r.textTests!==r.tests),suites},null,2));
